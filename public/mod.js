'use strict';
// Espace modérateur : suivre la partie en direct et la piloter (réservé au chef de mission).
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const AV={fox:'🦊',owl:'🦉',cat:'🐈‍⬛',raven:'🐦‍⬛',wolf:'🐺',hare:'🐇',panda:'🐼',moth:'🦋',otter:'🦦',tiger:'🐯',frog:'🐸',alien:'👽'};
const PHASE={lobby:'Recrutement',running:'Question en cours',reveal:'Réponse révélée',finished:'Partie terminée'};
const M={room:null,key:null,es:null,state:null,offset:0,fails:0,feed:new Map(),live:false,busy:false,joinBase:location.origin};

function toast(msg){const t=$('mToast');t.textContent=msg;t.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>t.classList.remove('show'),3200);}

function loadCredentials(){
  const h=new URLSearchParams(location.hash.slice(1));
  if(h.get('room')&&h.get('key')){
    M.room=h.get('room');M.key=h.get('key');
    try{localStorage.setItem('baker_mod_session',JSON.stringify({room:M.room,key:M.key}))}catch{}
    history.replaceState(null,'',location.pathname); // la clé ne reste pas dans la barre d'adresse
    return true;
  }
  try{const s=JSON.parse(localStorage.getItem('baker_ring_session')||'null');if(s?.mode==='host'&&s.room&&s.hostKey){M.room=s.room;M.key=s.hostKey;return true;}}catch{}
  try{const s=JSON.parse(localStorage.getItem('baker_mod_session')||'null');if(s?.room&&s.key){M.room=s.room;M.key=s.key;return true;}}catch{}
  return false;
}

async function control(action,extra={}){
  if(M.busy)return;M.busy=true;
  try{
    const r=await fetch('/api/control',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({room:M.room,hostKey:M.key,action,...extra})});
    const x=await r.json().catch(()=>({}));if(!r.ok)throw new Error(x.error||'Action impossible');
  }catch(e){toast(e.message)}finally{M.busy=false}
}

function connect(){
  M.es?.close();
  const es=new EventSource('/events?'+new URLSearchParams({room:M.room,host:M.key}));M.es=es;
  es.addEventListener('state',e=>{M.fails=0;$('mNet').className='m-dot on';try{const d=JSON.parse(e.data);M.offset=Date.now()-d.serverNow;M.state=d;render(d)}catch(err){console.error(err)}});
  es.onerror=async()=>{
    $('mNet').className='m-dot off';
    if(++M.fails===3){
      try{const r=await fetch('/api/status',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({room:M.room,hostKey:M.key})});
        if(!r.ok){es.close();$('mPhase').textContent='Mission introuvable';toast('Cette mission n’existe plus (le serveur a peut-être redémarré). Créez une nouvelle mission.');}}catch{}
    }
  };
}

function controls(d){
  const n=d.scores.length,s=d.settings||{};
  if(d.status==='lobby')return `
    <button class="m-btn m-go" data-act="start" ${n<2?'disabled':''}>🚀 LANCER LA PARTIE</button>
    <label class="m-toggle"><input type="checkbox" id="gadgetToggle" ${M.gadgets!==false?'checked':''}><span>Gadgets activés</span></label>
    <button class="m-btn m-ghost" data-act="lock">${s.joinLocked?'🔓 Rouvrir les inscriptions':'🔒 Fermer les inscriptions'}</button>
    <label class="m-limit">Limite <select id="limitSel">${[...Array(39)].map((_,i)=>i+2).map(v=>`<option ${v===s.maxPlayers?'selected':''}>${v}</option>`).join('')}</select></label>
    ${n<2?'<span class="m-hint">Il faut au moins 2 agents pour lancer.</span>':''}`;
  if(d.status==='running')return `<button class="m-btn m-go" data-act="next">⏭ RÉVÉLER LA RÉPONSE</button><span class="m-hint">La réponse se révèle aussi toute seule à la fin du chrono.</span><button class="m-btn m-ghost m-right" data-act="reset">↺ Recommencer</button>`;
  if(d.status==='reveal')return `<button class="m-btn m-go" data-act="next">⏭ ${d.index+1>=d.total?'VOIR LE PODIUM':'QUESTION SUIVANTE'}</button><span class="m-hint">Passage automatique dans quelques secondes.</span><button class="m-btn m-ghost m-right" data-act="reset">↺ Recommencer</button>`;
  return `<button class="m-btn m-go" data-act="csv">⬇ TÉLÉCHARGER LES SCORES (CSV)</button><button class="m-btn m-ghost" data-act="reset">🔁 Rejouer avec les mêmes agents</button>`;
}

function render(d){
  $('mLogin').hidden=true;$('mApp').hidden=false;
  const mod=d.mod||{players:[],distribution:{},answeredCount:0,onlineCount:0};
  const showTruth=mod.reveal||M.live, inGame=['running','reveal'].includes(d.status);
  $('mRoom').textContent=d.room;$('mPhase').textContent=PHASE[d.status]||d.status;
  document.body.dataset.status=d.status;
  $('sPlayers').textContent=d.scores.length;$('sLimit').textContent='sur '+(d.settings?.maxPlayers??'–')+(d.settings?.joinLocked?' · inscriptions fermées':'');
  $('sOnline').textContent=mod.onlineCount;
  const total=d.scores.length||0;
  if(inGame){$('sAnswered').textContent=mod.answeredCount+' / '+total;$('sAnsweredBar').style.width=(total?mod.answeredCount/total*100:0)+'%';$('sAnsweredLabel').textContent='Ont répondu';}
  else{$('sAnswered').textContent='–';$('sAnsweredBar').style.width='0';$('sAnsweredLabel').textContent='Réponses';}
  $('sQuestion').textContent=d.status==='lobby'?'–':Math.min(d.index+1,d.total)+' / '+d.total;
  $('sQuestionSub').textContent=d.mission&&d.status!=='lobby'?d.mission.title:'';

  const c=$('mControls');const html=controls(d);if(c.dataset.html!==html){c.innerHTML=html;c.dataset.html=html;}

  // Question en cours + répartition
  $('pQuestion').hidden=!inGame;$('pJoin').hidden=d.status!=='lobby';
  if(inGame&&d.mission){
    $('qPrompt').textContent=d.mission.prompt;
    const max=Math.max(1,...Object.values(mod.distribution));
    $('qDistribution').innerHTML=Object.entries(mod.distribution).map(([ch,n])=>{const ok=showTruth&&ch===mod.correctAnswer;
      return `<div class="m-choice ${ok?'ok':''}"><span class="m-choice-label">${ok?'✅ ':''}${esc(ch)}</span><span class="m-choice-bar"><i style="width:${n/max*100}%"></i></span><b>${n}</b></div>`}).join('');
    const waiting=total-mod.answeredCount;
    $('qHint').textContent=d.status==='running'?(waiting===0&&total?'Tout le monde a répondu : vous pouvez révéler la réponse.':waiting+' agent'+(waiting>1?'s':'')+' en train de réfléchir…'+(M.live?'':' (bonne réponse masquée jusqu’à la révélation)')):'Bonne réponse : '+mod.correctAnswer;
  }
  if(d.status==='lobby'&&!$('joinQr').dataset.room){$('joinQr').src='/qr.svg?room='+encodeURIComponent(d.room);$('joinQr').dataset.room=d.room;$('joinUrl').textContent=M.joinBase+'/?room='+d.room;}

  // Liste des agents
  const byId=new Map(mod.players.map(p=>[p.id,p]));
  const list=d.status==='lobby'?[...mod.players].sort((a,b)=>a.joinedAt-b.joinedAt).map(p=>({...p,rank:null})):d.scores.map(s=>({...byId.get(s.id),...s,rank:s.rank})).filter(p=>p.id);
  $('playersTitle').textContent=d.status==='lobby'?'Agents dans la salle ('+list.length+')':(d.status==='finished'?'Classement final (':'Classement en direct (')+list.length+')';
  $('playersHint').textContent=d.status==='lobby'?'✕ pour retirer un agent (nom inapproprié, doublon…)':'';
  $('playerList').innerHTML=list.length?list.map(p=>{
    let status='<span class="m-pill">prêt</span>';
    if(inGame){
      if(!p.answered)status='<span class="m-pill wait">⏳ réfléchit</span>';
      else if(showTruth)status=`<span class="m-pill ${p.ok?'good':'bad'}" title="${esc(p.answer)}">${p.ok?'✓ juste':'✗ faux'}${p.ok?' +'+p.points:''}</span>`;
      else status=`<span class="m-pill done">✔ a répondu${p.ms!=null?' · '+(p.ms/1000).toFixed(1)+' s':''}</span>`;
    }else if(d.status==='finished')status=`<span class="m-pill">${p.correct}/${d.total} justes</span>`;
    return `<div class="m-row ${p.online?'':'offline'}">
      <span class="m-rank">${p.rank??''}</span><span class="m-av">${AV[p.avatar]||'🕵️'}</span>
      <span class="m-name"><b>${esc(p.name)}</b><small>${p.online?'<i class="m-on"></i>en ligne':'<i class="m-off"></i>hors ligne'}${p.streak>=2?' · 🔥 '+p.streak:''}</small></span>
      ${status}<span class="m-score">${p.score} pts</span>
      <button class="m-kick" data-kick="${esc(p.id)}" data-name="${esc(p.name)}" title="Retirer ${esc(p.name)}">✕</button></div>`}).join('')
    :'<p class="m-empty">En attente des premiers agents… Montrez le QR code à la classe.</p>';

  // Fil des gadgets
  for(const a of d.attacks||[])if(!M.feed.has(a.id))M.feed.set(a.id,a);
  const feed=[...M.feed.values()].sort((a,b)=>b.at-a.at).slice(0,30);
  $('feed').innerHTML=feed.length?feed.map(a=>`<li><span>${AV[a.fromAvatar]||''} <b>${esc(a.from)}</b> ${esc(a.emoji)} → <b>${esc(a.to)}</b></span><small>Q${a.questionIndex+1}</small></li>`).join(''):'<li class="m-empty">Aucun lancer pour l’instant.</li>';
  tick();
}

function tick(){
  const d=M.state,t=$('mTimer');if(!d)return;
  if(d.status==='running'&&d.endsAt){const left=Math.max(0,Math.ceil((d.endsAt-(Date.now()-M.offset))/1000));t.hidden=false;t.textContent=String(left).padStart(2,'0')+' s';t.classList.toggle('urgent',left<=3);}
  else t.hidden=true;
}
setInterval(tick,250);

function exportCsv(){
  const d=M.state;if(!d)return;
  const rows=[['Classement','Nom de code','Points','Bonnes réponses','Meilleure série','Lancers'],...d.scores.map(p=>[p.rank,p.name,p.score,p.correct,p.bestStreak,p.attacks])];
  const csv='﻿'+rows.map(r=>r.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(';')).join('\r\n');
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));a.download='operation-baker-'+d.room+'-scores.csv';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000);
}

document.addEventListener('click',e=>{
  const b=e.target.closest('[data-act]');
  if(b){const act=b.dataset.act;
    if(act==='start')control('start',{mayAttack:$('gadgetToggle')?.checked!==false});
    else if(act==='next')control('next');
    else if(act==='lock')control('settings',{joinLocked:!M.state?.settings?.joinLocked});
    else if(act==='csv')exportCsv();
    else if(act==='reset'){if(M.state?.status==='finished'||confirm('Recommencer la partie ? Les scores actuels seront remis à zéro.'))control('reset');}
    return;}
  const k=e.target.closest('[data-kick]');
  if(k&&confirm('Retirer '+k.dataset.name+' de la partie ?'))control('kick',{pid:k.dataset.kick});
});
document.addEventListener('change',e=>{
  if(e.target.id==='limitSel')control('settings',{maxPlayers:Number(e.target.value)});
  if(e.target.id==='gadgetToggle')M.gadgets=e.target.checked;
  if(e.target.id==='liveToggle'){M.live=e.target.checked;if(M.state)render(M.state);}
});
$('phoneBtn').onclick=()=>{$('phoneQr').src='/qr.svg?mod=1&room='+encodeURIComponent(M.room)+'&key='+encodeURIComponent(M.key);$('phoneModal').hidden=false;};
$('phoneClose').onclick=()=>{$('phoneModal').hidden=true;};
$('phoneModal').onclick=e=>{if(e.target.id==='phoneModal')$('phoneModal').hidden=true;};

if(loadCredentials()){
  fetch('/api/network').then(r=>r.json()).then(r=>{if(r.joinBase){M.joinBase=r.joinBase;if(M.state)$('joinUrl').textContent=M.joinBase+'/?room='+M.state.room;}}).catch(()=>{});
  connect();
}else{$('mLogin').hidden=false;$('mPhase').textContent='Non connecté';}
