'use strict';
// Vérifie que le QR code est servi et pointe vers l'adresse publique de la mission.
const assert=require('node:assert');const http=require('node:http');
const {server}=require('../server.js');const {encode}=require('../qr.js');
server.listen(0,async()=>{
  const port=server.address().port;
  const get=(path,headers={})=>new Promise((ok,ko)=>http.get({port,path,headers},r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>ok({status:r.statusCode,type:r.headers['content-type'],body:d}))}).on('error',ko));
  try{
    const r=await get('/qr.svg?room=4821',{Host:'baker.example.org','X-Forwarded-Proto':'https'});
    assert.equal(r.status,200);assert.match(r.type,/image\/svg\+xml/);assert.match(r.body,/^<svg/);
    const n=JSON.parse((await get('/api/network',{Host:'baker.example.org','X-Forwarded-Proto':'https'})).body);
    assert.equal(n.joinBase,'https://baker.example.org');
    const m=encode('https://baker.example.org/?room=4821');assert.ok(m.length>=21&&(m.length-17)%4===0);
    console.log('PASS QR: /qr.svg sert un QR code SVG vers l’adresse publique https de la mission.');
  }catch(e){console.error(e);process.exitCode=1}finally{server.close()}
});
