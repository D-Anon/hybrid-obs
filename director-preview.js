// One operator preview at a time. Local previews use a dedicated video-only peer.
let selectedPreview=null;
async function previewRequest(id,action,extra={}){
 const response=await fetch('/preview',{method:'POST',body:JSON.stringify({id,action,...extra}),signal:AbortSignal.timeout(8000)});
 if(!response.ok)throw Error(await response.json());
 return response.json();
}
function stopDirectorPreview(){
 const current=selectedPreview;
 if(!current)return;
 selectedPreview=null;
 current.peer?.close();current.media.remove();current.button.textContent=current.label;
 if(current.lease)previewRequest(current.id,'close',{lease:current.lease}).catch(()=>{});
}
async function toggleDirectorPreview(slot,stage,button){
 const closing=selectedPreview?.id===slot.id;
 stopDirectorPreview();if(closing)return;
 const remote=slot.kind==='remote';
 const media=document.createElement(remote?'iframe':'video');
 const current={id:slot.id,media,button,label:button.textContent};
 selectedPreview=current;button.textContent='Close preview';
 media.title='Live preview of '+slot.name;stage.append(media);
 try{
  if(remote){media.allow='autoplay';media.src=slot.links[1]+'&noaudio';return}
  media.muted=true;media.autoplay=true;media.playsInline=true;
  const peer=new RTCPeerConnection({iceServers:[]});current.peer=peer;
  peer.addTransceiver('video',{direction:'recvonly'});
  peer.ontrack=event=>{media.srcObject=event.streams[0]||new MediaStream([event.track])};
  await peer.setLocalDescription(await peer.createOffer());
  if(peer.iceGatheringState!=='complete')await new Promise(resolve=>{
   const timer=setTimeout(done,5000);
   function done(){clearTimeout(timer);peer.removeEventListener('icegatheringstatechange',check);resolve()}
   function check(){if(peer.iceGatheringState==='complete')done()}
   peer.addEventListener('icegatheringstatechange',check);check();
  });
  if(selectedPreview!==current)return;
  const {lease}=await previewRequest(slot.id,'open',{sdp:peer.localDescription.sdp});current.lease=lease;
  if(selectedPreview!==current){await previewRequest(slot.id,'close',{lease});return}
  while(selectedPreview===current){
   const {answer}=await previewRequest(slot.id,'poll',{lease});
   if(selectedPreview!==current)return;
   if(answer&&!peer.remoteDescription)await peer.setRemoteDescription({type:'answer',sdp:answer});
   if(peer.connectionState==='failed')throw Error('Preview disconnected. Open Live preview to reconnect.');
   await new Promise(resolve=>setTimeout(resolve,1200));
  }
 }catch(error){
  if(selectedPreview===current){stopDirectorPreview();document.getElementById('notice').textContent=error.message}
 }
}
