'use strict';
const {spawn}=require('node:child_process');
const assert=require('node:assert/strict');
const path=require('node:path');
const port=4800+Math.floor(Math.random()*600);
const server=spawn(process.execPath,['server.js'],{cwd:path.resolve(__dirname,'..'),env:{...process.env,PORT:String(port)},stdio:'pipe'});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function api(op,b){const r=await fetch('http://127.0.0.1:'+port+'/api/'+op,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(b)});return {httpStatus:r.status,...await r.json()}}
async function main(){
 try {
  let live=false;for(let i=0;i<45;i++){await sleep(100);try{live=(await fetch('http://127.0.0.1:'+port+'/health')).ok;if(live)break}catch{}}
  assert(live,'server started');
  const room=await api('create',{});assert(room.room&&room.hostKey);
  const first=await api('join',{room:room.room,name:'Agent A',avatar:'fox'});
  const second=await api('join',{room:room.room,name:'Agent B',avatar:'owl'});
  const spectator=await api('join',{room:room.room,name:'Agent C',avatar:'frog'});
  const initial=(await api('status',{room:room.room,pid:first.pid}));
  assert.equal(initial.scores.length,3);assert(initial.scores.every(x=>x.offset===0));
  const moved=await api('move',{room:room.room,pid:first.pid,dir:1});assert.equal(moved.offset,1);
  const moved2=await api('status',{room:room.room,pid:second.pid});assert.equal(moved2.scores.find(x=>x.id===first.pid).offset,1);
  assert.equal((await api('move',{room:room.room,pid:second.pid,dir:100})).httpStatus,400);
  assert.equal((await api('move',{room:room.room,pid:'fake',dir:1})).httpStatus,400);
  await api('control',{room:room.room,hostKey:room.hostKey,action:'start'});
  const watcher=await fetch('http://127.0.0.1:'+port+'/events?room='+room.room+'&pid='+spectator.pid);
  assert.equal(watcher.status,200);const abortTimer=setTimeout(()=>watcher.body.cancel().catch(()=>{}),4000);
  const answer=await api('answer',{room:room.room,pid:first.pid,answer:'Saint-Louis (Missouri)'});assert(answer.correct);
  const errorBefore=await api('attack',{room:room.room,pid:second.pid,target:first.pid,kind:'tomato'});assert.equal(errorBefore.httpStatus,400);
  const atk=await api('attack',{room:room.room,pid:first.pid,target:second.pid,kind:'tomato'});assert(atk.ok);
  const reader=watcher.body.getReader();let txt='';let got=false;
  for(let j=0;j<12;j++){const {value,done}=await reader.read();if(done)break;txt+=new TextDecoder().decode(value);if(txt.includes('event: attack')){got=true;break}}
  clearTimeout(abortTimer);await reader.cancel();
  assert(got,'SSE spectators receive thrown projectile');assert(txt.includes('"fromId":"'+first.pid+'"'),'source player ID included for physical trajectory');
  console.log('PASS V3: agent movement synchronized, direction validation, unlocked attacks only, spectating SSE visible projectiles with source ID.');
 } finally {server.kill('SIGTERM');}
}
main().catch(e=>{console.error('FAIL V3',e);process.exitCode=1;server.kill('SIGTERM')});
