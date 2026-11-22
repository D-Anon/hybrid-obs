const fs = require('node:fs');
const http = require('node:http');
const https = require('node:https');
const crypto = require('node:crypto');
const QR = require('./vendor/QRCode');
process.chdir(__dirname);
const ip = process.argv[2];
if (!/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip) || require('node:net').isIP(ip) !== 4) {
  throw Error('Run node server.js followed by the private IPv4 address of the OBS computer.');
}
const origin = 'https://' + ip + ':8443';
const desk = 'http://127.0.0.1:8080';
const keys = () => crypto.randomBytes(18).toString('hex');
let slots = fs.existsSync('slots.json') ? JSON.parse(fs.readFileSync('slots.json')) : [];
const live = new Map();
function saveSlots(next) {
  fs.writeFileSync('slots.tmp',JSON.stringify(next),{mode:0o600});
  fs.renameSync('slots.tmp','slots.json');
  slots=next;
}
function session(s) {
  if (!live.has(s.viewer)) live.set(s.viewer, { generation: keys(), seen: 0 });
  return live.get(s.viewer);
}
function tally(state) {
  return Date.now()-(state.viewerSeen||0)<6500 && typeof state.onAir==='boolean' ? state.onAir : null;
}
function previewOffer(state) {
  const preview=state.preview;
  if(preview && Date.now()-preview.seen<10000)return {id:preview.id,offer:preview.offer};
  state.preview=null;
  return null;
}
function reply(res, code, body, type='application/json') {
  res.writeHead(code, {'Content-Type':type,'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'});
  res.end(type === 'application/json' ? JSON.stringify(body) : body);
}
async function body(req) {
  let text = '';
  for await (const chunk of req) {
    text += chunk;
    if (text.length > 150000) throw Error('Request too large');
  }
  return JSON.parse(text);
}
function links(s) {
  if (s.kind === 'remote') return ['https://vdo.ninja/?push='+s.camera,'https://vdo.ninja/?view='+s.camera];
  return [origin+(s.kind==='screen'?'/screen#':'/camera#')+s.camera,origin+'/view#'+s.viewer];
}
function handler(admin) {
  return async (req,res) => {
    try {
      const url = new URL(req.url, desk);
      if (req.headers.host !== new URL(admin ? desk : origin).host ||
          (req.method === 'POST' && req.headers.origin !== (admin ? desk : origin))) return reply(res,403,'Forbidden');
      const html = file => reply(res,200,fs.readFileSync(file),'text/html; charset=utf-8');
      if (url.pathname === '/studio.css' && req.method === 'GET') {
        return reply(res,200,fs.readFileSync('studio.css'),'text/css; charset=utf-8');
      }
      if (admin) {
        if(url.pathname==='/director-preview.js' && req.method==='GET')return reply(res,200,fs.readFileSync('director-preview.js'),'text/javascript');
        if (url.pathname === '/' && req.method === 'GET') return html('desk.html');
        if (url.pathname === '/slots' && req.method === 'POST') {
          const {name,kind} = await body(req);
          if (!['local','screen','remote'].includes(kind) || typeof name !== 'string' || !name.trim()) return reply(res,400,'Enter a name');
          const entry = {name:name.trim().slice(0,64),kind,camera:keys(),viewer:keys()};
          saveSlots([...slots,entry]);
          return reply(res,201,true);
        }
        if(url.pathname==='/slots/edit' && req.method==='POST'){
          const {id,name,before}=await body(req);
          const index=slots.findIndex(s=>s.viewer===id);
          if(index<0)return reply(res,404,'Source removed');
          const next=[...slots];
          if(typeof name==='string' && name.trim() && name.trim().length<=64){
            next[index]={...next[index],name:name.trim()};
          }else if(before===null || (before!==id && slots.some(s=>s.viewer===before))){
            const [entry]=next.splice(index,1);
            next.splice(before===null?next.length:next.findIndex(s=>s.viewer===before),0,entry);
          }else return reply(res,400,'Invalid edit');
          saveSlots(next);return reply(res,200,true);
        }
        if(url.pathname==='/preview' && req.method==='POST'){
          const {id,action,lease,sdp}=await body(req);
          const slot=slots.find(s=>s.viewer===id && s.kind!=='remote');
          if(!slot)return reply(res,404,'Source removed');
          const state=session(slot);
          if(action==='open' && typeof sdp==='string' && sdp.startsWith('v=0')){
            state.preview={id:keys(),offer:sdp,seen:Date.now()};
          }else{
            if(!previewOffer(state) || state.preview.id!==lease)return reply(res,409,'Preview expired');
            if(action==='close'){state.preview=null;return reply(res,200,true)}
            if(action!=='poll')return reply(res,400,'Invalid action');
            state.preview.seen=Date.now();
          }
          return reply(res,200,{lease:state.preview.id,answer:state.preview.answer});
        }
        if (url.pathname === '/slots/remove' && req.method === 'POST') {
          const {id}=await body(req);
          if (typeof id!=='string' || !id) return reply(res,400,'Missing source ID');
          const slot=slots.find(s=>s.viewer===id);
          if (slot) {
            saveSlots(slots.filter(s=>s!==slot));
            live.delete(slot.viewer);
          }
          return reply(res,200,true);
        }
        if (url.pathname === '/slots' && req.method === 'GET') return reply(res,200,slots.map(s=>({
          lastSeen:session(s).seen,previewAt:session(s).thumbnailAt||0,health:session(s).health,onAir:tally(session(s)),received:Date.now()-(session(s).receivedAt||0)<6500,id:s.viewer,name:s.name,kind:s.kind,links:links(s),thumbnail:Date.now()-(session(s).thumbnailAt||0)<8000 ? session(s).thumbnail : null,active:Date.now()-session(s).seen<8000,connected:Date.now()-(session(s).connectedAt||0)<8000
        })));
        if (url.pathname === '/qr') {
          const slot=slots.find(s=>s.camera===url.searchParams.get('id') && s.kind==='local');
          if (!slot) return reply(res,404,'Unknown camera');
          const qr=new QR(-1,1); qr.addData(links(slot)[0]); qr.make();
          const n=qr.getModuleCount(); let squares='';
          for(let y=0;y<n;y++) for(let x=0;x<n;x++) if(qr.isDark(y,x)) squares+='M'+x+' '+y+'h1v1h-1z';
          return reply(res,200,'<svg xmlns="http://www.w3.org/2000/svg" viewBox="-4 -4 '+(n+8)+' '+(n+8)+'" shape-rendering="crispEdges"><rect x="-4" y="-4" width="100%" height="100%" fill="white"/><path d="'+squares+'"/></svg>','image/svg+xml');
        }
      } else {
        if (['/camera','/screen','/view'].includes(url.pathname) && req.method==='GET') return html('feed.html');
        if (url.pathname==='/signal' && req.method==='POST') {
          const {token,action,generation,sdp,connected,thumbnail,health,onAir,received,lease}=await body(req);
          const slot=slots.find(s=>s.kind!=='remote' && [s.camera,s.viewer].includes(token));
          if (!slot) return reply(res,403,'Invalid link');
          const camera=slot.camera===token;
          const state=session(slot);
          if(action==='previewAnswer'){
            if(!camera || !previewOffer(state) || state.preview.id!==lease)return reply(res,409,'Preview expired');
            if(typeof sdp!=='string' || !sdp.startsWith('v=0'))return reply(res,400,'Invalid answer');
            state.preview.answer=sdp;return reply(res,200,true);
          }
          if(!camera){
            state.viewerSeen=Date.now();
            state.onAir=typeof onAir==='boolean'?onAir:null;
            if(received===true)state.receivedAt=Date.now();
          }
          if (camera) {
            state.seen=Date.now();
            if(health && typeof health==='object'){
              state.health={width:Number(health.width)||0,height:Number(health.height)||0,
                level:Number.isFinite(health.level)?Math.max(0,Math.min(1,health.level)):null,
                audio:['muted','enabled','unavailable'].includes(health.audio)?health.audio:'unavailable'};
            }
            if(action==='reset'){state.thumbnail=null;state.thumbnailAt=0;}
            if(action==='poll' && typeof thumbnail==='string' && thumbnail.length<80000 &&
               /^data:image\/jpeg;base64,\/9j\/[A-Za-z0-9+/]*={0,2}$/.test(thumbnail)){
              state.thumbnail=thumbnail; state.thumbnailAt=state.seen;
            }
            state.connectedAt=connected===true && generation===state.generation ? state.seen : 0;
          }
          if (action==='reset') {
            state.connectedAt=0; state.generation=keys(); state.offer=null; state.answer=null;
          } else if (action==='write') {
            if (generation!==state.generation) return reply(res,409,'Session changed');
            if (typeof sdp!=='string' || !sdp.startsWith('v=0')) return reply(res,400,'Invalid session');
            state[camera?'answer':'offer']=sdp;
          } else if (action!=='poll') return reply(res,400,'Unknown action');
          return reply(res,200,{preview:camera?previewOffer(state):undefined,onAir:tally(state),generation:state.generation,sdp:state[camera?'offer':'answer']});
        }
      }
      reply(res,404,'Unknown page');
    } catch(e) { if (!res.headersSent) reply(res,400,e.message); }
  };
}
const certDir = process.env.HYBRID_CERT_DIR || __dirname;
const path = require('node:path');
let listening = 0;
function ready() {
  if (++listening === 2) {
    console.log('Operator dashboard: '+desk+' (keep this window open)');
    if (process.send) process.send('ready');
  }
}
https.createServer({
  key:fs.readFileSync(path.join(certDir,'key.pem')),
  cert:fs.readFileSync(path.join(certDir,'cert.pem'))
},handler(false)).listen(8443,ip,ready);
http.createServer(handler(true)).listen(8080,'127.0.0.1',ready);
