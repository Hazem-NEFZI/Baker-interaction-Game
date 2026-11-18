'use strict';
const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const path=require('node:path');
const port=8500+Math.floor(Math.random()*350);
const base=`http://127.0.0.1:${port}`;
const child=spawn(process.execPath,['server.js'],{cwd:path.resolve(__dirname,'..'),env:{...process.env,PORT:String(port)},stdio:'pipe'});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function api(op,body){const r=await fetch(base+'/api/'+op,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});return {...await r.json(),code:r.status};}
async function ready(){for(let i=0;i<70;i++){try{if((await fetch(base+'/health')).ok)return}catch{}await sleep(60)}throw Error('server not ready')}
async function connectEvents(query){
 const controller=new AbortController();const r=await fetch(base+'/events?'+new URLSearchParams(query),{signal:controller.signal});assert.equal(r.status,200);
 let buf='';const received=[];
 const loop=(async()=>{try{for await(const chunk of r.body){buf+=new TextDecoder().decode(chunk);let idx;while((idx=buf.indexOf('\n\n'))>=0){const msg=buf.slice(0,idx);buf=buf.slice(idx+2);let name=msg.match(/^event: (.+)$/m)?.[1];let data=msg.match(/^data: (.+)$/m)?.[1];if(name&&data)received.push({name,data:JSON.parse(data)})}}}catch{}})();
 return{received,controller,loop};
}
async function until(fn,timeout=2500){const st=Date.now();while(Date.now()-st<timeout){if(fn())return;await sleep(30)}throw Error('SSE event not delivered to all browsers')}
(async()=>{let conns=[];try{
 await ready();const a=await api('create',{maxPlayers:2});
 const one=await api('join',{room:a.room,name:'Alpha Fox',avatar:'fox'});
 const two=await api('join',{room:a.room,name:'Beta Owl',avatar:'owl'});
 conns=[await connectEvents({room:a.room,host:a.hostKey}),await connectEvents({room:a.room,pid:one.pid}),await connectEvents({room:a.room,pid:two.pid})];
 await until(()=>conns.every(c=>c.received.some(e=>e.name==='state'&&e.data.playerCount===2)));
 await api('control',{room:a.room,hostKey:a.hostKey,action:'start'});
 await until(()=>conns.every(c=>c.received.some(e=>e.name==='state'&&e.data.status==='running')));
 const correct=await api('answer',{room:a.room,pid:one.pid,answer:'Saint-Louis (Missouri)'});
 assert(correct.correct);
 await until(()=>conns.every(c=>c.received.some(e=>e.name==='state'&&e.data.scores.some(p=>p.id===one.pid&&p.score>0))));
 await api('attack',{room:a.room,pid:one.pid,target:two.pid,kind:'tomato'});
 await until(()=>conns.every(c=>c.received.some(e=>e.name==='attack'&&e.data.reaction.type==='cat')));
 assert(conns.every(c=>c.received.find(e=>e.name==='state').data.mission.answer===undefined));
 console.log('PASS SSE 3 clients: host + 2 player streams see the same live rounds, updated score, and traveling tomato attack event.');
}catch(e){console.error('FAIL SSE',e);process.exitCode=1}finally{for(let c of conns)c.controller.abort();child.kill('SIGTERM')}})();
