'use strict';
const {spawn}=require('node:child_process');
const assert=require('node:assert/strict');
const path=require('node:path');
const port=5600+Math.floor(Math.random()*500);
const child=spawn(process.execPath,['server.js'],{cwd:path.resolve(__dirname,'..'),env:{...process.env,PORT:String(port)},stdio:'pipe'});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function api(op,b){const r=await fetch(`http://127.0.0.1:${port}/api/${op}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)});return {...await r.json(),statusCode:r.status};}
async function run(){try{
 for(let i=0;i<60;i++){try{if((await fetch(`http://127.0.0.1:${port}/health`)).ok)break}catch{}await sleep(75)}
 const admin=await api('create',{maxPlayers:2});assert.equal(admin.statusCode,200);
 const room=admin.room;const hostKey=admin.hostKey;
 const a=await api('join',{room,name:'Agent Mistral',avatar:'fox'});
 const b=await api('join',{room,name:'Dame Éclipse',avatar:'owl'});
 const c=await api('join',{room,name:'Fantôme Minuit',avatar:'cat'});
 assert.equal(c.statusCode,400,'configured 2 player limit enforced');
 assert.equal((await api('control',{room,hostKey:'wrong',action:'settings',maxPlayers:5})).statusCode,400,'admin settings protected');
 assert.equal((await api('control',{room,hostKey,action:'settings',maxPlayers:1})).statusCode,400,'cannot cap below current players');
 assert.equal((await api('control',{room,hostKey,action:'settings',maxPlayers:3,joinLocked:true})).statusCode,200);
 assert.equal((await api('join',{room,name:'Agent Fantôme',avatar:'cat'})).statusCode,400,'lock prevents joining');
 assert.equal((await api('control',{room,hostKey,action:'settings',joinLocked:false})).statusCode,200);
 assert.equal((await api('join',{room,name:'Agent Fantôme',avatar:'cat'})).statusCode,200,'open lobby permits new join');
 let st=await api('status',{room,pid:a.pid});assert.equal(st.settings.maxPlayers,3);assert.equal(st.settings.joinLocked,false);
 await api('control',{room,hostKey,action:'start'});
 assert.equal((await api('control',{room,hostKey,action:'settings',maxPlayers:12})).statusCode,400,'no mid-game capacity change');
 assert.equal((await api('attack',{room,pid:a.pid,target:b.pid,kind:'tomato'})).statusCode,400,'no early gadget');
 const wrong=await api('answer',{room,pid:b.pid,answer:'Chicago'});assert.equal(wrong.correct,false);
 assert.equal((await api('attack',{room,pid:b.pid,target:a.pid,kind:'ink'})).statusCode,400,'wrong answer never enables gadget');
 const good=await api('answer',{room,pid:a.pid,answer:'Saint-Louis (Missouri)'});assert.equal(good.correct,true);assert.equal(good.charges,1);
 assert.equal((await api('attack',{room,pid:a.pid,target:b.pid,kind:'tomato'})).statusCode,200,'correct answer unlocks one gadget');
 assert.equal((await api('attack',{room,pid:a.pid,target:b.pid,kind:'tomato'})).statusCode,400,'one shot only');
 await api('control',{room,hostKey,action:'next'});
 await api('control',{room,hostKey,action:'next'});
 let next=await api('status',{room,pid:a.pid});assert.equal(next.index,1);assert.equal(next.me.charges,0);assert.equal(next.me.last,null);
 assert.equal((await api('attack',{room,pid:a.pid,target:b.pid,kind:'tomato'})).statusCode,400,'correct past round does not allow attacks on new round');
 await sleep(1110);
 const right2=await api('answer',{room,pid:a.pid,answer:'1925'});assert.equal(right2.correct,true);
 assert.equal((await api('attack',{room,pid:a.pid,target:b.pid,kind:'confetti'})).statusCode,200,'new correct answer unlocks a new, per-round gadget');
 console.log('PASS V5: host player caps, lock/unlock, host auth, correct-answer-only one gadget, no stale charges across rounds, four gadget types server checked.');
}finally{child.kill('SIGTERM')}}
run().catch(e=>{console.error('FAIL V5',e);process.exitCode=1;child.kill('SIGTERM')});
