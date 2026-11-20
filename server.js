'use strict';
/**
 * OPÉRATION BAKER — AGENT ARENA
 * Zero-dependency classroom multiplayer game using Node's HTTP + SSE.
 * The server is authoritative for questions, answer checking, scoring, attacks, and timing.
 */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { qrSvg } = require('./qr.js');

const PORT = Math.max(1, Number(process.env.PORT || 3000));
const ROOT = path.join(__dirname, 'public');
const MAX_PLAYERS = 40;
const MIN_PLAYERS = 2;
function playerLimit(v){const n=Number(v);return Number.isInteger(n)&&n>=MIN_PLAYERS&&n<=MAX_PLAYERS?n:12;}
const rooms = new Map();
const AVATARS = ['fox','owl','cat','raven','wolf','hare','panda','moth','otter','tiger','frog','alien'];
const CLASSROOM_REACTIONS = [
  'Touché... avec élégance ! 🎩',
  'Oups, agent repéré ! 🕵️',
  'Même les espions ont des jours sans ! 😅',
  'Opération surprise réussie ! ✨',
  'Promis, on reste amis ! 🤝',
  'Ça mérite un fou rire ! 😂',
  'Mission : garder son calme ! 😎',
  'Plot twist : on continue à jouer ! 🎬'
];
const ATTACKS = {
  tomato: {name:'Tomate surprise',emoji:'🍅'},
  ink: {name:'Bombe d’encre',emoji:'🖋️'},
  confetti: {name:'Pluie de confettis',emoji:'🎊'},
  banana: {name:'Peau de banane',emoji:'🍌'}
};
const SOURCES = {
  defense:'https://www.servicehistorique.sga.defense.gouv.fr/liste-dossiers-individuels/josephine-baker',
  education:'https://eduscol.education.gouv.fr/6438/josephine-baker-entre-au-pantheon',
  archive:'https://www.archives-nationales.culture.gouv.fr/dossiers-thematiques/la-france-rend-hommage-josephine-baker',
  museum:'https://www.womenshistory.org/education-resources/biographies/josephine-baker',
  liberation:'https://www.ordredelaliberation.fr/fr/medailles/josephine-freda-baker'
};
const QUESTIONS = [
  {id:'birth',chapter:'DOSSIER 01 · IDENTITÉ',title:'Le passeport oublié',prompt:'Dans quelle ville américaine Joséphine Baker est-elle née en 1906 ?',choices:['Saint-Louis (Missouri)','Chicago','La Nouvelle-Orléans','New York'],answer:'Saint-Louis (Missouri)',seconds:10,fact:'Elle naît à Saint-Louis dans le Missouri le 3 juin 1906, avant de connaître la pauvreté et la ségrégation.',source:SOURCES.defense,theme:'identity'},
  {id:'paris',chapter:'DOSSIER 02 · MUSIC-HALL',title:'Une star débarque',prompt:'En quelle année Joséphine Baker arrive-t-elle à Paris pour La Revue nègre ?',choices:['1925','1919','1931','1937'],answer:'1925',seconds:10,fact:'En 1925, La Revue nègre la révèle au public parisien au Théâtre des Champs-Élysées.',source:SOURCES.education,theme:'theatre'},
  {id:'citizen',chapter:'DOSSIER 03 · NOUVELLE IDENTITÉ',title:'Un nouveau drapeau',prompt:'En quelle année Joséphine Baker devient-elle française ?',choices:['1937','1925','1940','1957'],answer:'1937',seconds:10,fact:'Joséphine Baker acquiert la nationalité française en 1937 à la suite de son mariage avec Jean Lion.',source:SOURCES.defense,theme:'passport'},
  {id:'bureau',chapter:'DOSSIER 04 · RECRUTEMENT',title:'Le contact secret',prompt:'En 1939, à quel service de renseignement français se met-elle à disposition ?',choices:['Au 2e Bureau, le contre-espionnage','À la police de Londres','Aux services postaux américains','Au ministère des Beaux-Arts'],answer:'Au 2e Bureau, le contre-espionnage',seconds:10,fact:'En septembre 1939, elle entre en contact avec Jacques Abtey, responsable du contre-espionnage au 2e Bureau.',source:SOURCES.defense,theme:'spy'},
  {id:'scores',chapter:'DOSSIER 05 · PARTITION SECRÈTE',title:'L’encre invisible',prompt:'Sur quel objet Joséphine Baker dissimulait-elle parfois des informations secrètes ?',choices:['Des partitions musicales','Des tickets de métro','Des cartes postales de Paris','Des affiches de cinéma'],answer:'Des partitions musicales',seconds:10,fact:'Elle utilise des partitions annotées à l’encre sympathique pour faire circuler discrètement des renseignements.',source:SOURCES.education,theme:'cipher'},
  {id:'medal',chapter:'DOSSIER 06 · DÉCORATION',title:'Un dossier récompensé',prompt:'En quelle année reçoit-elle la Médaille de la Résistance française avec rosette ?',choices:['1946','1940','1957','1963'],answer:'1946',seconds:10,fact:'Elle reçoit la Médaille de la Résistance française avec rosette par décret du 5 octobre 1946.',source:SOURCES.liberation,theme:'military'},
  {id:'rainbow',chapter:'DOSSIER 07 · FRATERNITÉ',title:'La tribu arc-en-ciel',prompt:'Combien d’enfants Joséphine Baker a-t-elle adoptés pour sa « tribu arc-en-ciel » ?',choices:['12 enfants','8 enfants','6 enfants','15 enfants'],answer:'12 enfants',seconds:10,fact:'Elle a adopté douze enfants de différentes origines pour incarner son idéal de fraternité et de tolérance.',source:SOURCES.liberation,theme:'freedom'},
  {id:'march',chapter:'DOSSIER 08 · LIBERTÉ',title:'Une voix à Washington',prompt:'À quel événement célèbre participe-t-elle en 1963 ?',choices:['La Marche sur Washington','La conférence de Yalta','L’Exposition universelle de Bruxelles','Le Festival de Cannes'],answer:'La Marche sur Washington',seconds:10,fact:'En août 1963, elle prend la parole lors de la Marche sur Washington pour les droits civiques.',source:SOURCES.museum,theme:'freedom'},
  {id:'death',chapter:'DOSSIER 09 · DERNIER RAPPEL',title:'Les dernières années',prompt:'En quelle année Joséphine Baker est-elle décédée à Paris ?',choices:['1975','1963','1981','1970'],answer:'1975',seconds:10,fact:'Joséphine Baker meurt à Paris le 12 avril 1975, à l’âge de 68 ans.',source:SOURCES.archive,theme:'legacy'},
  {id:'honor',chapter:'DOSSIER 10 · HÉRITAGE',title:'Le dernier hommage',prompt:'En 2021, quel monument français lui rend un hommage national symbolique ?',choices:['Le Panthéon','Le Louvre','L’Arc de Triomphe','Le château de Versailles'],answer:'Le Panthéon',seconds:10,fact:'Le 30 novembre 2021, Joséphine Baker entre symboliquement au Panthéon. Elle reste inhumée à Monaco.',source:SOURCES.education,theme:'legacy'}
];

const token = () => crypto.randomBytes(20).toString('hex');
function pin(){let p; do{p=String(crypto.randomInt(1000,10000));}while(rooms.has(p));return p;}
function clean(s,n=22){return String(s||'').normalize('NFC').replace(/[<>"'\\\x00-\x1f]/g,'').trim().slice(0,n)}
function normalize(s){return String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLocaleLowerCase('fr').replace(/\s+/g,' ')}
function shuffle(arr){let a=[...arr];for(let i=a.length-1;i>0;i--){let j=crypto.randomInt(0,i+1);[a[i],a[j]]=[a[j],a[i]];}return a;}
function json(res, code, value){res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(value))}
function readBody(req){return new Promise((resolve,reject)=>{let text='';req.on('data',part=>{text+=part;if(text.length>15000){reject(new Error('Requête trop volumineuse'));req.destroy();}});req.on('end',()=>{try{resolve(JSON.parse(text||'{}'))}catch{reject(new Error('JSON invalide'))}});req.on('error',reject)});}
function lookup(body){let room=rooms.get(String(body.room||''));if(!room)throw Error('Code de mission introuvable.');room.activity=Date.now();return room;}
function checkHost(r,b){if(b.hostKey!==r.hostKey)throw Error('Accès réservé au chef de mission.');}
function checkAgent(r,b){let p=r.players.get(String(b.pid||''));if(!p)throw Error('Identité d’agent inconnue.');return p;}
function rankings(r){return [...r.players.values()].sort((a,b)=>b.score-a.score||b.correct-a.correct||b.bestStreak-a.bestStreak||a.name.localeCompare(b.name)).map((p,i)=>({rank:i+1,id:p.id,name:p.name,avatar:p.avatar,score:p.score,streak:p.streak,correct:p.correct,bestStreak:p.bestStreak,attacks:p.attacks,charges:p.charges,offset:p.offset||0,online:isOnline(r,p.id)}));}
function mission(r){if(!r.questions.length)return null;let q=r.questions[r.index];return q?{id:q.id,chapter:q.chapter,title:q.title,prompt:q.prompt,choices:q.choices,theme:q.theme,seconds:q.seconds,...(['reveal','finished'].includes(r.status)?{answer:q.answer,fact:q.fact,source:q.source}:{})}:null;}
function state(r,pid,host=false){let p=pid&&r.players.get(pid);return {type:'state',room:r.pin,status:r.status,index:r.index,total:r.questions.length,endsAt:r.endsAt,revealUntil:r.revealUntil,serverNow:Date.now(),mission:mission(r),scores:rankings(r),playerCount:r.players.size,attacks:r.attackFeed.slice(-5),settings:{speed:r.speed,mayAttack:r.mayAttack,maxPlayers:r.maxPlayers,joinLocked:r.joinLocked},...(host?{mod:modView(r)}:{}),me:!host&&p?{id:p.id,name:p.name,avatar:p.avatar,score:p.score,streak:p.streak,correct:p.correct,charges:p.charges,answered:p.answers.has(r.index),last:p.last,awards:awardsFor(p)}:null};}
function isOnline(r,id){for(const c of r.connections)if(c.pid===id)return true;return false;}
function modView(r){
 const reveal=['reveal','finished'].includes(r.status),q=r.questions[r.index];
 const players=[...r.players.values()].map(p=>{const pick=p.picks?.[r.index];return {id:p.id,name:p.name,avatar:p.avatar,online:isOnline(r,p.id),score:p.score,correct:p.correct,streak:p.streak,attacks:p.attacks,
   answered:!!pick,answer:pick?pick.answer:null,ok:pick?pick.correct:null,points:pick?pick.points:0,ms:pick?pick.ms:null,joinedAt:p.joinedAt||0};});
 const distribution={};if(q)for(const c of q.choices)distribution[c]=0;
 for(const p of players)if(p.answer!==null&&Object.hasOwn(distribution,p.answer))distribution[p.answer]++;
 return {players,answeredCount:players.filter(p=>p.answered).length,onlineCount:players.filter(p=>p.online).length,distribution,correctAnswer:q?q.answer:null,reveal};
}
function awardsFor(p){let list=[];if(p.correct>=1)list.push('Premier indice');if(p.streak>=2||p.bestStreak>=2)list.push('Duo parfait');if(p.correct>=4)list.push('Agent d’élite');if(p.attacks>=2)list.push('As du sabotage');return list;}
function emit(r,event,payload,filter=()=>true){let item='event: '+event+'\ndata: '+JSON.stringify(payload)+'\n\n';for(let c of [...r.connections]){if(!filter(c))continue;try{c.res.write(item);}catch{r.connections.delete(c);}}}
function broadcast(r){for(let c of [...r.connections]){try{c.res.write('event: state\ndata: '+JSON.stringify(state(r,c.pid,c.host))+'\n\n')}catch{r.connections.delete(c)}}}
function closeQuestion(r){if(r.status!=='running')return;r.status='reveal';r.endsAt=0;r.revealUntil=Date.now()+4800;broadcast(r);}
function nextQuestion(r){if(r.index+1>=r.questions.length){r.status='finished';r.revealUntil=0;r.endsAt=0;broadcast(r);return;}r.index++;r.hitsThisQuestion=0;r.status='running';r.revealUntil=0;for(const p of r.players.values()){p.last=null;p.charges=0;p.lastAttackAt=0;}r.endsAt=Date.now()+Math.round(r.questions[r.index].seconds*r.speed*1000);broadcast(r);}
function tick(){const now=Date.now();for(const r of rooms.values()){if(r.status==='running'&&now>=r.endsAt)closeQuestion(r);else if(r.status==='reveal'&&now>=r.revealUntil)nextQuestion(r);if(now-r.activity>4*3600*1000){for(const c of r.connections){try{c.res.end()}catch{}}rooms.delete(r.pin)}}}
setInterval(tick,240).unref();

async function api(req,res,route){try{
 const b=await readBody(req);
 if(route==='create'){
   const r={pin:pin(),hostKey:token(),maxPlayers:playerLimit(b.maxPlayers),joinLocked:false,players:new Map(),connections:new Set(),questions:QUESTIONS.map(q=>({...q,choices:shuffle(q.choices)})),status:'lobby',index:0,endsAt:0,revealUntil:0,attackFeed:[],hitsThisQuestion:0,speed:1,mayAttack:true,activity:Date.now()};rooms.set(r.pin,r);return json(res,200,{room:r.pin,hostKey:r.hostKey});
 }
 const r=lookup(b);
 if(route==='join'){
   if(r.status!=='lobby')throw Error('La partie a commencé. Demandez à jouer à la prochaine manche.');
   if(r.joinLocked)throw Error('Les inscriptions sont fermées par le chef de mission.');
   const name=clean(b.name,20),avatar=clean(b.avatar,10);
   if(name.length<2)throw Error('Choisissez un nom d’agent de 2 caractères minimum.');
   if(!AVATARS.includes(avatar))throw Error('Choisissez un avatar.');
   if(r.players.size>=r.maxPlayers)throw Error('Mission complète : '+r.maxPlayers+' agents maximum.');
   if([...r.players.values()].some(p=>p.name.toLocaleLowerCase('fr')===name.toLocaleLowerCase('fr')))throw Error('Ce nom d’agent est déjà pris.');
   const id=token();r.players.set(id,{id,name,avatar,score:0,correct:0,streak:0,bestStreak:0,charges:0,attacks:0,answers:new Set(),picks:{},joinedAt:Date.now(),last:null,lastAttackAt:0,lastMoveAt:0,offset:0,online:true});broadcast(r);return json(res,200,{room:r.pin,pid:id});
 }
 if(route==='status'){let p=b.hostKey===r.hostKey?null:checkAgent(r,b);return json(res,200,state(r,p?.id,!!b.hostKey));}
 if(route==='control'){
   checkHost(r,b);let action=String(b.action||'');
   if(action==='settings'){
      if(r.status!=='lobby')throw Error('Les réglages du cercle sont réservés à la phase de recrutement.');
      if(b.maxPlayers!==undefined){const next=Number(b.maxPlayers);if(!Number.isInteger(next)||next<MIN_PLAYERS||next>MAX_PLAYERS)throw Error('Choisissez de 2 à 40 agents.');if(next<r.players.size)throw Error('Limite inférieure au nombre de joueurs déjà inscrits.');r.maxPlayers=next;}
      if(b.joinLocked!==undefined)r.joinLocked=!!b.joinLocked;
   }else if(action==='start'){
      if(r.status!=='lobby')throw Error('La mission est déjà en cours.');
      if(r.players.size<2)throw Error('Attendez au moins deux agents pour lancer cette vraie partie multijoueur.');
      r.speed=1;
      r.mayAttack=b.mayAttack!==false;
      r.status='running';r.index=0;r.hitsThisQuestion=0;r.endsAt=Date.now()+Math.round(r.questions[0].seconds*r.speed*1000);
   }else if(action==='next'){
      if(r.status==='running')closeQuestion(r);else if(r.status==='reveal')nextQuestion(r);else throw Error('Impossible de passer à la mission suivante.');
   }else if(action==='reset'){
      r.status='lobby';r.index=0;r.hitsThisQuestion=0;r.endsAt=0;r.revealUntil=0;r.attackFeed=[];r.joinLocked=false;
      r.questions=QUESTIONS.map(q=>({...q,choices:shuffle(q.choices)}));
      for(const p of r.players.values())Object.assign(p,{score:0,correct:0,streak:0,bestStreak:0,charges:0,attacks:0,answers:new Set(),picks:{},last:null,lastAttackAt:0,lastMoveAt:0,offset:0});
   }else if(action==='kick'){
      const victim=r.players.get(String(b.pid||''));if(!victim)throw Error('Agent introuvable.');
      r.players.delete(victim.id);
      for(const c of [...r.connections]){if(c.pid!==victim.id)continue;try{c.res.write('event: kicked\ndata: {}\n\n');c.res.end()}catch{}r.connections.delete(c);}
   }else throw Error('Commande inconnue.');broadcast(r);return json(res,200,{ok:true});
 }
 if(route==='move'){
    if(!['lobby','running','reveal'].includes(r.status))throw Error('Mouvement indisponible après le podium.');
    const p=checkAgent(r,b);const dir=Number(b.dir);
    if(dir!==-1&&dir!==1)throw Error('Direction invalide.');
    if(Date.now()-p.lastMoveAt<150)return json(res,200,{ok:true,offset:p.offset||0});
    p.lastMoveAt=Date.now();p.offset=Math.max(-2,Math.min(2,(p.offset||0)+dir));
    broadcast(r);return json(res,200,{ok:true,offset:p.offset});
 }
 if(route==='answer'){
    if(r.status!=='running'||Date.now()>r.endsAt)throw Error('Le délai de réponse est terminé.');
    const p=checkAgent(r,b);if(p.answers.has(r.index))throw Error('Réponse déjà transmise.');
    const q=r.questions[r.index];p.answers.add(r.index);
    const correct=normalize(b.answer)===normalize(q.answer);
    let points=0;
    if(correct){const timeLeft=Math.max(0,(r.endsAt-Date.now())/(q.seconds*r.speed*1000));const speedPoints=Math.round(300*timeLeft);p.streak++;p.bestStreak=Math.max(p.bestStreak,p.streak);p.correct++;points=400+speedPoints+Math.min(180,(p.streak-1)*40);p.score+=points;p.charges=1;p.last={correct:true,points};}
    else{p.streak=0;p.last={correct:false,points:0};}
    p.picks[r.index]={answer:String(b.answer||'').slice(0,120),correct,points,ms:Math.max(0,Date.now()-(r.endsAt-Math.round(q.seconds*r.speed*1000)))};
    broadcast(r);return json(res,200,{correct,points,charges:p.charges});
 }
 if(route==='attack'){
    if(!r.mayAttack)throw Error('Les gadgets sont désactivés pour cette partie.');
    if(!['running','reveal'].includes(r.status))throw Error('Les gadgets sont disponibles pendant les missions.');
    const p=checkAgent(r,b);const victim=r.players.get(String(b.target||''));const kind=String(b.kind||'');
    if(!victim||victim.id===p.id)throw Error('Choisissez un autre agent.');
    if(!Object.hasOwn(ATTACKS,kind))throw Error('Gadget inconnu.');
    if(p.charges<=0||!p.answers.has(r.index)||!p.last?.correct)throw Error('Répondez correctement à cette question pour lancer un gadget.');
    if(Date.now()-p.lastAttackAt<1000)throw Error('Le gadget recharge…');
    p.charges--;p.attacks++;p.lastAttackAt=Date.now();
    // Three images maximum per question, awarded to the first 3 actual hits.
    // The server decides the reaction; later hits are polite messages only.
    const hitNumber=r.hitsThisQuestion++;
    const reaction=hitNumber<3
      ? {type:'cat',image:'/assets/cat_meme_'+((r.index+hitNumber)%3+1)+'.png',caption:['Premier agent touché ! 😹','Deuxième surprise ! 🐱','Troisième et dernier mème ! 😸'][hitNumber]}
      : {type:'text',text:CLASSROOM_REACTIONS[(hitNumber-3)%CLASSROOM_REACTIONS.length]};
    const a={id:token().slice(0,12),from:p.name,fromId:p.id,fromAvatar:p.avatar,to:victim.name,target:victim.id,kind,emoji:ATTACKS[kind].emoji,label:ATTACKS[kind].name,at:Date.now(),questionIndex:r.index,reaction};r.attackFeed.push(a);r.attackFeed=r.attackFeed.slice(-10);
    emit(r,'attack',a);broadcast(r);return json(res,200,{ok:true,charges:p.charges,reaction});
 }
 throw Error('Commande inconnue.');
 }catch(e){json(res,400,{error:e.message||'Erreur de mission'});}
}

function joinBase(req){
 const host=String(req.headers.host||'localhost:'+PORT).replace(/[^\w.:\-\[\]]/g,'');
 const proto=String(req.headers['x-forwarded-proto']||'http').split(',')[0].trim()==='https'?'https':'http';
 const ips=Object.values(os.networkInterfaces()).flat().filter(x=>x&&!x.internal&&x.family==='IPv4').map(x=>x.address);
 const base=/^(localhost|127\.0\.0\.1)(:|$)/.test(host)&&ips.length?'http://'+ips[0]+':'+PORT:proto+'://'+host;
 return {base,ips};
}
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.svg':'image/svg+xml','.webp':'image/webp','.ico':'image/x-icon','.json':'application/json'};
const server=http.createServer((req,res)=>{
 let url;try{url=new URL(req.url,'http://localhost')}catch{return json(res,400,{error:'URL invalide'})}
 if(req.method==='POST'&&url.pathname.startsWith('/api/'))return api(req,res,url.pathname.slice(5));
 if(req.method==='GET'&&url.pathname==='/events'){
   const r=rooms.get(url.searchParams.get('room'));if(!r)return json(res,404,{error:'Mission inconnue'});
   const host=url.searchParams.get('host')===r.hostKey;
   const pid=host?null:url.searchParams.get('pid');if(!host&&!r.players.has(pid))return json(res,401,{error:'Agent inconnu'});
   res.writeHead(200,{'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-cache, no-transform','Connection':'keep-alive','X-Accel-Buffering':'no'});
   let c={res,pid,host};r.connections.add(c);res.write(': connexion sécurisée\n\n');res.write('event: state\ndata: '+JSON.stringify(state(r,pid,host))+'\n\n');req.on('close',()=>{r.connections.delete(c);if(pid)broadcast(r);});r.activity=Date.now();if(pid)broadcast(r);return;
 }
 if(req.method==='GET'&&url.pathname==='/health')return json(res,200,{ok:true,rooms:rooms.size});
 if(req.method==='GET'&&url.pathname==='/api/network'){
   const n=joinBase(req);return json(res,200,{joinBase:n.base,localIPs:n.ips});
 }
 if(req.method==='GET'&&url.pathname==='/qr.svg'){
   const room=String(url.searchParams.get('room')||'').replace(/\D/g,'').slice(0,4);
   let target=joinBase(req).base+(room.length===4?'/?room='+room:'/');
   if(url.searchParams.has('mod')){const r=rooms.get(room);if(!r||url.searchParams.get('key')!==r.hostKey)return json(res,403,{error:'Accès réservé au chef de mission.'});target=joinBase(req).base+'/moderateur.html#room='+room+'&key='+encodeURIComponent(r.hostKey);}
   res.writeHead(200,{'Content-Type':'image/svg+xml; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});return res.end(qrSvg(target));
 }
 if(req.method!=='GET')return json(res,405,{error:'Méthode non autorisée'});
 let p;try{p=path.resolve(ROOT,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));}catch{return json(res,400,{error:'URL invalide'})}
 if(!p.startsWith(ROOT+path.sep)&&p!==path.join(ROOT,'index.html'))return json(res,403,{error:'Interdit'});
 fs.readFile(p,(err,data)=>{if(err){res.writeHead(404);res.end('404');return;}res.writeHead(200,{'Content-Type':mime[path.extname(p)]||'application/octet-stream','Cache-Control':'public, max-age=300','X-Content-Type-Options':'nosniff'});res.end(data)});
});
if(require.main===module){server.listen(PORT,'0.0.0.0',()=>{const ips=Object.values(os.networkInterfaces()).flat().filter(x=>x&&!x.internal&&x.family==='IPv4').map(x=>x.address);console.log('\n🕵️  OPÉRATION BAKER · AGENT ARENA');console.log('Chef de mission : http://localhost:'+PORT);ips.forEach(ip=>console.log('Téléphones (même Wi-Fi) : http://'+ip+':'+PORT));console.log('Appuyez sur Ctrl+C pour arrêter le serveur.\n')})}
module.exports={server,QUESTIONS,rooms};
