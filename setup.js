const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { X509Certificate, createPrivateKey } = require('node:crypto');
const { createInterface } = require('node:readline/promises');
const { spawn, spawnSync, fork } = require('node:child_process');

process.chdir(__dirname);
const dashboard = 'http://127.0.0.1:8080';
function privateAddresses(interfaces) {
  return Object.entries(interfaces).flatMap(([name, addresses]) =>
    (addresses || []).filter(a => !a.internal && (a.family === 'IPv4' || a.family === 4) &&
      /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(a.address))
      .map(a => ({ name, ip: a.address })));
}
async function selectAddress() {
  const choices = privateAddresses(os.networkInterfaces());
  if (!choices.length) throw Error('Connect to the venue Wi-Fi or Ethernet and run setup again.');
  if (choices.length === 1) return choices[0].ip;
  console.log('Choose the adapter on the same network as the phones:');
  choices.forEach((a, i) => console.log((i + 1) + '. ' + a.name + '  ' + a.ip));
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    while (true) {
      const answer = (await rl.question('Adapter number: ')).trim();
      if (/^[1-9]\d*$/.test(answer) && choices[Number(answer) - 1]) return choices[Number(answer) - 1].ip;
    }
  } finally { rl.close(); }
}
function validPair(dir, ip) {
  try {
    const cert = new X509Certificate(fs.readFileSync(path.join(dir,'cert.pem')));
    return !!cert.checkIP(ip) && Date.parse(cert.validFrom) <= Date.now() &&
      Date.parse(cert.validTo) > Date.now() && cert.checkPrivateKey(createPrivateKey(fs.readFileSync(path.join(dir,'key.pem'))));
  } catch { return false; }
}
function mkcert(args) {
  const result = spawnSync('mkcert', args, { stdio: 'inherit' });
  if (result.error || result.status !== 0) throw Error('mkcert failed. Check its output and rerun setup.');
}
function prepareCertificate(ip) {
  if (validPair(__dirname, ip)) return __dirname;
  const store = path.join(__dirname,'.studio-certs');
  fs.mkdirSync(store,{recursive:true,mode:0o700});
  for (const entry of fs.readdirSync(store)) {
    const dir = path.join(store,entry);
    if (validPair(dir,ip)) return dir;
  }
  // Preserve previous certificates so a venue change is reversible.
  const hasExisting = ['cert.pem','key.pem'].some(file=>fs.existsSync(file));
  const dir = hasExisting ? fs.mkdtempSync(path.join(store,ip+'-')) : __dirname;
  mkcert(['-install']);
  mkcert(['-cert-file',path.join(dir,'cert.pem'),'-key-file',path.join(dir,'key.pem'),ip]);
  if (!validPair(dir,ip)) throw Error('Generated certificate could not be verified.');
  return dir;
}
function openDashboard() {
  const [cmd,args] = process.platform === 'win32' ? ['rundll32.exe',['url.dll,FileProtocolHandler',dashboard]] :
    process.platform === 'darwin' ? ['open',[dashboard]] : ['xdg-open',[dashboard]];
  const browser = spawn(cmd,args,{detached:true,stdio:'ignore'});
  browser.on('error',()=>console.log('Open '+dashboard+' manually.'));
  browser.unref();
}
async function main() {
  const ip = await selectAddress();
  const dir = prepareCertificate(ip);
  console.log('Local device address: https://'+ip+':8443');
  console.log('For a new device, install the public rootCA.pem from the folder printed by mkcert -CAROOT.');
  const ca = spawnSync('mkcert',['-CAROOT'],{encoding:'utf8'});
  if (ca.status===0) console.log('Certificate folder: '+ca.stdout.trim());
  const server = fork(path.join(__dirname,'server.js'),[ip],{env:{...process.env,HYBRID_CERT_DIR:dir},stdio:['inherit','inherit','inherit','ipc']});
  server.once('message',message=>{if(message==='ready')openDashboard()});
  server.on('exit',(code,signal)=>{process.exitCode=code ?? (signal==='SIGINT'?0:1)});
  process.once('SIGINT',()=>server.kill('SIGINT'));
}
if (require.main===module) main().catch(e=>{console.error(e.message);process.exitCode=1});
module.exports = {privateAddresses,validPair};
