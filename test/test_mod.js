'use strict';
// Espace modérateur : données réservées au chef de mission, retrait d'un agent, QR protégé.
const assert=require('node:assert');const http=require('node:http');
const {server}=require('../server.js');
server.listen(0,async()=>{
  const port=server.address().port;
  const req=(method,path,body)=>new Promise((ok,ko)=>{const r=http.request({port,path,method,headers:{'content-type':'application/json'}},res=>{let d='';res.on('data',c=>d+=c);res.on('end',()=>{let j=null;try{j=JSON.parse(d)}catch{}ok({status:res.statusCode,body:j})})});r.on('error',ko);if(body)r.write(JSON.stringify(body));r.end();});
  const post=(route,b)=>req('POST','/api/'+route,b);
  try{
    const {body:{room,hostKey}}=await post('create',{maxPlayers:10});
    const a=(await post('join',{room,name:'Agent Alpha',avatar:'fox'})).body.pid;
    const bb=(await post('join',{room,name:'Agent Bravo',avatar:'owl'})).body.pid;
    const c=(await post('join',{room,name:'Agent Charlie',avatar:'cat'})).body.pid;
    // retrait
    assert.equal((await post('control',{room,action:'kick',pid:c})).status,400,'kick sans clé refusé');
    assert.equal((await post('control',{room,hostKey,action:'kick',pid:c})).status,200);
    let host=(await post('status',{room,hostKey})).body;
    assert.equal(host.mod.players.length,2);assert.equal(host.scores.length,2);
    // partie : une réponse
    await post('control',{room,hostKey,action:'start'});
    const q=(await post('status',{room,pid:a})).body.mission;
    await post('answer',{room,pid:a,answer:q.choices[0]});
    host=(await post('status',{room,hostKey})).body;
    assert.equal(host.mod.answeredCount,1);
    assert.equal(Object.values(host.mod.distribution).reduce((x,y)=>x+y,0),1);
    assert.equal(host.mod.players.find(p=>p.id===a).answer,q.choices[0]);
    const player=(await post('status',{room,pid:bb})).body;
    assert.equal(player.mod,undefined,'un joueur ne reçoit pas les données du modérateur');
    // QR modérateur protégé
    assert.equal((await req('GET','/qr.svg?mod=1&room='+room+'&key=faux')).status,403);
    assert.equal((await req('GET','/qr.svg?mod=1&room='+room+'&key='+hostKey)).status,200);
    console.log('PASS MODÉRATEUR : retrait d’agent, réponses en direct réservées au chef, QR modérateur protégé.');
  }catch(e){console.error(e);process.exitCode=1}finally{server.close()}
});
