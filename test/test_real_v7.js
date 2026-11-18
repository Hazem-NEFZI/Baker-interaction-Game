'use strict';
const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const path=require('node:path');
const port=7900+Math.floor(Math.random()*400);
const url=`http://127.0.0.1:${port}`;
const child=spawn(process.execPath,['server.js'],{cwd:path.resolve(__dirname,'..'),env:{...process.env,PORT:String(port)},stdio:'pipe'});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function api(route,body){const x=await fetch(`${url}/api/${route}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});return {http:x.status,...await x.json()};}
async function ready(){for(let i=0;i<80;i++){try{if((await fetch(url+'/health')).ok)return}catch{}await sleep(80)}throw Error('server never healthy')}
async function phaseNext(room,hostKey){const a=await api('control',{room,hostKey,action:'next'});assert.equal(a.http,200);const b=await api('control',{room,hostKey,action:'next'});assert.equal(b.http,200)}
(async()=>{try{
 await ready();
 const q=require('../server').QUESTIONS;
 assert.equal(q.length,10,'exactly ten historical questions');
 assert(q.every(v=>v.seconds===10),'strict 10 seconds on ALL rounds');
 assert.equal(new Set(q.map(v=>v.id)).size,10,'all ten unique');
 for(let i=1;i<=3;i++){let a=await fetch(`${url}/assets/cat_meme_${i}.png`);assert.equal(a.status,200);let b=await fetch(`${url}/assets/loser_meme_${i}.png`);assert.equal(b.status,200);}
 const admin=await api('create',{maxPlayers:5});assert.equal(admin.http,200);
 const {room,hostKey}=admin;
 const players=[];
 for(let i=0;i<5;i++){let r=await api('join',{room,name:`Agent ${i+1}`,avatar:['fox','owl','cat','tiger','frog'][i]});assert.equal(r.http,200);players.push(r.pid)}
 assert.equal((await api('join',{room,name:'Agent 6',avatar:'raven'})).http,400,'enforce room limit');
 assert.equal((await api('control',{room,hostKey:'fake',action:'start'})).http,400,'host only controls');
 assert.equal((await api('attack',{room,pid:players[0],target:players[1],kind:'tomato'})).http,400,'no gadget before answer');
 await api('control',{room,hostKey,action:'start'});
 const hostStatus=await api('status',{room,hostKey});assert.equal(hostStatus.total,10);assert.equal(hostStatus.mission.seconds,10);assert.equal(hostStatus.mission.answer,undefined,'no answers sent early');
 let initial=await api('status',{room,pid:players[1]});assert.equal(initial.scores.length,5);
 const err=await api('answer',{room,pid:players[4],answer:'Chicago'});assert.equal(err.correct,false);
 assert.equal((await api('attack',{room,pid:players[4],target:players[0],kind:'tomato'})).http,400,'wrong answer no throw');
 for(let i=0;i<4;i++){const ans=await api('answer',{room,pid:players[i],answer:'Saint-Louis (Missouri)'});assert.equal(ans.correct,true)}
 const s0=await api('status',{room,pid:players[0]});const s1=await api('status',{room,pid:players[1]});assert.deepEqual(s0.scores,s1.scores,'two devices share authoritative scores');
 for(let i=0;i<4;i++){
  const a=await api('attack',{room,pid:players[i],target:players[4],kind:['tomato','ink','banana','confetti'][i]});
  assert.equal(a.http,200);
  assert.equal(a.reaction.type,i<3?'cat':'text');
  if(i<3)assert.equal(a.reaction.image,`/assets/cat_meme_${i+1}.png`);
  else assert(!('image' in a.reaction));
  assert.equal((await api('attack',{room,pid:players[i],target:players[4],kind:'tomato'})).http,400,'one shot per correct answer');
 }
 await phaseNext(room,hostKey);
 let round=await api('status',{room,pid:players[0]});assert.equal(round.index,1);assert.equal(round.mission.seconds,10);assert.equal(round.me.charges,0);
 await api('answer',{room,pid:players[0],answer:'1925'});
 const second=await api('attack',{room,pid:players[0],target:players[4],kind:'tomato'});assert.equal(second.reaction.type,'cat');assert.equal(second.reaction.image,'/assets/cat_meme_2.png');
 for(let i=2;i<10;i++){
   await phaseNext(room,hostKey);
   round=await api('status',{room,pid:players[0]});assert.equal(round.index,i);
   assert.equal(round.total,10);
   let res=await api('answer',{room,pid:players[0],answer:q[i].answer});assert.equal(res.correct,true);
 }
 await phaseNext(room,hostKey);
 const end=await api('status',{room,pid:players[1]});
 assert.equal(end.status,'finished');assert.equal(end.scores.length,5);assert.equal(end.scores[0].correct,10);
 assert(end.scores[0].score>0,'scores retained all rounds');
 const html=await (await fetch(url)).text();assert(html.includes('10 MISSIONS'));assert(!html.includes('id="soloBtn"'),'no solo demo UI');
 const app=await (await fetch(url+'/app.js')).text();assert(app.includes('loser_meme_1.png'));assert(app.includes('finalMemeTab'));assert(!app.includes('startSolo'));
 console.log('PASS: LIVE MULTIPLAYER — 10 Q × 10 s, 5 agents, 3 cat impacts / question, 4th polite text, loser images, real synchronized scoring, full podium, server validations.');
 }catch(e){console.error('FAIL',e);process.exitCode=1;}finally{child.kill('SIGTERM')}})();
