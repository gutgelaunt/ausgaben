/* Ausgaben: Offline-first, Speicher lokal, Abgleich mit eigenem Google Sheet */
const CATS = [
  {id:'essen', name:'Essen & Trinken', color:'#e07a3f', subs:['Einkauf','Auswärts','Mensa','Snacks & Kaffee','Lieferdienst','Getränke']},
  {id:'pflege', name:'Drogerie & Haushalt', color:'#c06bb5', subs:['Körperpflege','Haushalt','Apotheke']},
  {id:'sport', name:'Sport', color:'#3f9e6b', subs:['Ausrüstung','Mitgliedschaft','Wettkampf','Sporternährung']},
  {id:'mobil', name:'Mobilität', color:'#3a7bd5', subs:['ÖPNV & Bahn','Fahrrad','Auto & Sprit','Taxi & Sharing']},
  {id:'freizeit', name:'Freizeit & Ausgehen', color:'#d4a017', subs:['Bars & Party','Kino & Events','Hobbys']},
  {id:'shopping', name:'Shopping', color:'#d0506a', subs:['Kleidung','Elektronik','Sonstiges']},
  {id:'uni', name:'Uni & Arbeit', color:'#5a8f9e', subs:['Bücher & Material','Software','Gebühren']},
  {id:'wohnen', name:'Wohnen', color:'#8a6d4b', subs:['Miete','Nebenkosten & Strom','Internet','Einrichtung']},
  {id:'vertraege', name:'Abos & Verträge', color:'#7c6fd6', subs:['Handy','Streaming','Versicherung','Software-Abo']},
  {id:'reisen', name:'Reisen', color:'#2fa3a3', subs:['Anreise','Unterkunft','Vor Ort']},
  {id:'geschenke', name:'Geschenke', color:'#e0607e', subs:[]},
  {id:'schulden', name:'Schulden', color:'#6b7280', subs:['Rate','Sondertilgung']},
  {id:'sonstiges', name:'Sonstiges', color:'#9aa0a6', subs:[]},
];
const CAT = Object.fromEntries(CATS.map(c=>[c.id,c]));
const $ = s => document.querySelector(s);
const fmt = n => new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'}).format(n||0);
const esc = s => String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const today = () => { const d=new Date(); d.setMinutes(d.getMinutes()-d.getTimezoneOffset()); return d.toISOString().slice(0,10); };
const ym = d => String(d||'').slice(0,7);
const MONTHS = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];
const MONTHS_L = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
const mLabel = (m,long) => (long?MONTHS_L:MONTHS)[+m.slice(5,7)-1] + (long?' '+m.slice(0,4):'');
const addM = (m,n) => { let y=+m.slice(0,4), mo=+m.slice(5,7)-1+n; y+=Math.floor(mo/12); mo=((mo%12)+12)%12; return y+'-'+String(mo+1).padStart(2,'0'); };
const mDiff = (a,b) => (+b.slice(0,4)-+a.slice(0,4))*12 + (+b.slice(5,7)-+a.slice(5,7));
const parseAmt = s => { s=String(s).trim().replace(/\s|€/g,''); if(s.includes(',')) s=s.replace(/\./g,'').replace(',','.'); const n=parseFloat(s); return isFinite(n)?Math.round(n*100)/100:NaN; };
const uid = () => Date.now().toString(36)+Math.random().toString(36).slice(2,8);
const toast = t => { const el=$('#toast'); el.textContent=t; el.classList.add('show'); clearTimeout(toast._t); toast._t=setTimeout(()=>el.classList.remove('show'),1800); };

/* ---------- Lokaler Speicher ---------- */
const KEY='ausgaben-v1';
const blank = () => ({expenses:{},fixed:{},debts:{},queue:[],settings:{url:'',token:''},lastSync:0});
let S = (()=>{ try{ const s=JSON.parse(localStorage.getItem(KEY)); if(s) return Object.assign(blank(),s); }catch(e){} return blank(); })();
function persist(){ try{ localStorage.setItem(KEY, JSON.stringify(S)); }catch(e){ toast('Lokales Speichern fehlgeschlagen'); } }
try{ navigator.storage && navigator.storage.persist && navigator.storage.persist(); }catch(e){}

let EXP=[], FIX=[], DEBTS=[];
function rebuild(){
  EXP = Object.values(S.expenses).filter(e=>!e.deleted).map(e=>({...e,amount:+e.amount||0}))
    .sort((a,b)=>String(b.date).localeCompare(String(a.date))||(b.updatedAt||0)-(a.updatedAt||0));
  FIX = Object.values(S.fixed).filter(f=>!f.deleted).sort((a,b)=>(+b.amount||0)-(+a.amount||0));
  DEBTS = Object.values(S.debts).filter(d=>!d.deleted);
}
function put(table, rec){
  rec = {...rec, updatedAt: Date.now()};
  S[table][rec.id] = rec;
  S.queue = S.queue.filter(q=>!(q.table===table && q.rec.id===rec.id));
  S.queue.push({table, rec});
  persist(); rebuild(); render(); sync();
}
function remove(table, id){ const r=S[table][id]; if(r) put(table, {...r, deleted:true}); }

/* ---------- Abgleich mit Google Sheet ---------- */
let syncing=false;
async function sync(){
  const {url, token} = S.settings;
  if(syncing || !url) { status(); return; }
  if(!navigator.onLine){ status(); return; }
  syncing=true; status('Synchronisiere …');
  const ops = S.queue.slice();
  try{
    const res = await fetch(url, {method:'POST', headers:{'Content-Type':'text/plain;charset=utf-8'}, body: JSON.stringify({token, ops})});
    const j = await res.json();
    if(!j.ok) throw new Error(j.error==='token' ? 'Geheimwort stimmt nicht' : (j.error||'Fehler'));
    S.queue = S.queue.filter(q=>!ops.includes(q));
    for(const t of ['expenses','fixed','debts']){
      const next={};
      (j.data[t]||[]).forEach(r=>{ if(r.id) next[r.id]=r; });
      S.queue.filter(q=>q.table===t).forEach(q=>{ next[q.rec.id]=S[t][q.rec.id]||q.rec; });
      S[t]=next;
    }
    S.lastSync=Date.now(); S.lastError='';
    persist(); rebuild(); render();
  }catch(e){
    S.lastError = e.message && e.message!=='Failed to fetch' && e.message!=='Load failed' ? e.message : 'Keine Verbindung zum Sheet';
    persist();
  }
  syncing=false; status();
}
function status(txt){
  const el=$('#stxt'), box=$('#status'); let err=false;
  if(txt){ el.textContent=txt; box.classList.remove('err'); return; }
  const n=S.queue.length, wait = n ? ` · ${n} ${n===1?'Eintrag wartet':'Einträge warten'} auf Upload` : '';
  if(!S.settings.url){ el.textContent='Nur auf diesem Gerät gespeichert. Sheet noch nicht verbunden.'; err=true; }
  else if(!navigator.onLine){ el.textContent='Offline'+wait; }
  else if(S.lastError){ el.textContent=S.lastError+wait; err=true; }
  else if(S.lastSync){ el.textContent='Synchronisiert '+new Date(S.lastSync).toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'})+wait; }
  else el.textContent='Noch nicht synchronisiert'+wait;
  box.classList.toggle('err',err);
}
window.addEventListener('online', sync);
window.addEventListener('offline', ()=>status());
document.addEventListener('visibilitychange', ()=>{ if(document.visibilityState==='visible') sync(); });
setInterval(()=>{ if(document.visibilityState==='visible' && S.queue.length) sync(); }, 30000);
setInterval(()=>{ if(document.visibilityState==='visible') sync(); }, 300000);

/* ---------- Einstellungen ---------- */
$('#opensettings').onclick = openSettings;
function openSettings(){
  $('#sheet').innerHTML = `<h3>Einstellungen</h3>
    <div class="sub">Verbindung zu deinem Google Sheet. Auf jedem Gerät einmal eintragen.</div>
    <label class="l">Web-App-URL aus Google Apps Script</label><input type="text" id="s-url" value="${esc(S.settings.url)}" placeholder="https://script.google.com/macros/s/…/exec" autocomplete="off" autocapitalize="off">
    <label class="l">Geheimwort</label><input type="text" id="s-token" value="${esc(S.settings.token)}" autocomplete="off" autocapitalize="off">
    <button class="btn" id="s-save">Speichern und synchronisieren</button>
    <button class="btn sec" id="s-export">Alle Ausgaben als CSV kopieren</button>
    <button class="btn sec" id="s-close">Schließen</button>
    <div class="sub" style="margin-top:14px">${S.queue.length} Änderungen warten auf Upload. ${EXP.length} Ausgaben gespeichert.</div>`;
  $('#s-save').onclick=()=>{ S.settings={url:$('#s-url').value.trim(), token:$('#s-token').value.trim()}; S.lastError=''; persist(); closeSheet(); sync(); };
  $('#s-export').onclick=exportCsv;
  $('#s-close').onclick=closeSheet;
  openSheet();
}
async function exportCsv(){
  const lines=['Datum;Betrag;Kategorie;Unterkategorie;Notiz'].concat(EXP.slice().reverse().map(e=>[e.date,String(e.amount).replace('.',','),CAT[e.cat]?.name||e.cat,e.sub||'',(e.note||'').replace(/;/g,',')].join(';')));
  try{ await navigator.clipboard.writeText(lines.join('\n')); toast('CSV kopiert'); }catch(e){ toast('Kopieren nicht möglich'); }
}

/* ---------- Navigation ---------- */
let sel={cat:null, sub:null};
let statMonth = ym(today());
document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>show(b.dataset.v));
function show(v){
  document.querySelectorAll('nav button').forEach(b=>b.classList.toggle('on',b.dataset.v===v));
  ['add','list','stats','fix'].forEach(x=>$('#v-'+x).classList.toggle('hidden',x!==v));
  window.scrollTo(0,0);
  render();
}

/* ---------- Erfassen ---------- */
$('#date').value = today();
function renderCats(){
  $('#cats').innerHTML = CATS.map(c=>`<button class="cat ${sel.cat===c.id?'on':''}" data-c="${c.id}"><span class="dot" style="background:${c.color}"></span>${esc(c.name)}</button>`).join('');
  document.querySelectorAll('#cats .cat').forEach(b=>b.onclick=()=>{ sel.cat=b.dataset.c; sel.sub=CAT[sel.cat].subs[0]||null; renderCats(); });
  const c = CAT[sel.cat];
  $('#subs').innerHTML = c && c.subs.length ? c.subs.map(s=>`<button class="chip ${sel.sub===s?'on':''}">${esc(s)}</button>`).join('') : '';
  document.querySelectorAll('#subs .chip').forEach((b,i)=>b.onclick=()=>{ sel.sub=c.subs[i]; renderCats(); });
  const isDebt = sel.cat==='schulden';
  $('#debtpick').classList.toggle('hidden', !isDebt);
  if(isDebt){
    const open = DEBTS.filter(d=>debtState(d).remaining>0.005);
    $('#debtsel').innerHTML = open.length ? open.map(d=>`<option value="${d.id}">${esc(d.name)} (offen ${fmt(debtState(d).remaining)})</option>`).join('') : '<option value="">Keine offenen Schulden angelegt</option>';
  }
  validate();
}
function validate(){ $('#save').disabled = !(sel.cat && parseAmt($('#amt').value)>0); }
$('#amt').addEventListener('input',validate);
$('#amt').addEventListener('keydown',e=>{ if(e.key==='Enter') save(); });
$('#note').addEventListener('keydown',e=>{ if(e.key==='Enter') save(); });
$('#save').onclick = save;

function renderQuick(){
  const counts={};
  EXP.slice(0,120).forEach(e=>{ if(e.cat==='schulden') return; const k=e.cat+'|'+(e.sub||'')+'|'+(e.note||'').trim(); counts[k]=(counts[k]||0)+1; });
  const top = Object.entries(counts).filter(([,n])=>n>=2).sort((a,b)=>b[1]-a[1]).slice(0,6);
  $('#quick').innerHTML = top.map(([k])=>{ const [c,s,n]=k.split('|'); return `<button class="chip" data-k="${esc(k)}"><span class="dot" style="background:${CAT[c]?.color||'#999'};display:inline-block;margin-right:6px"></span>${esc(n||s||CAT[c]?.name)}</button>`; }).join('');
  document.querySelectorAll('#quick .chip').forEach(b=>b.onclick=()=>{ const [c,s,n]=b.dataset.k.split('|'); sel.cat=c; sel.sub=s||null; $('#note').value=n; renderCats(); $('#amt').focus(); });
}

function save(){
  const amount = parseAmt($('#amt').value);
  if(!(amount>0) || !sel.cat) return;
  const rec = { id:uid(), amount, cat:sel.cat, sub:sel.sub||'', note:$('#note').value.trim(), date:$('#date').value||today(), debtId:'' };
  if(sel.cat==='schulden'){ const id=$('#debtsel').value; if(id) rec.debtId=id; }
  put('expenses', rec);
  toast(fmt(amount)+' gespeichert');
  $('#amt').value=''; $('#note').value=''; $('#date').value=today();
  $('#amt').focus(); validate();
}

/* ---------- Verlauf ---------- */
$('#search').addEventListener('input',renderList);
function renderList(){
  const q = $('#search').value.trim().toLowerCase();
  const rows = EXP.filter(e=>!q || [(e.note||''),(e.sub||''),CAT[e.cat]?.name||''].join(' ').toLowerCase().includes(q));
  if(!rows.length){ $('#list').innerHTML = `<div class="empty">${EXP.length?'Nichts gefunden.':'Noch keine Ausgaben erfasst.'}</div>`; return; }
  let html='', cur=null, chunk=[];
  const flush=()=>{ if(!cur) return; const sum=chunk.reduce((a,e)=>a+e.amount,0);
    const d=new Date(cur+'T12:00'); const lbl=isNaN(d)?cur:d.toLocaleDateString('de-DE',{weekday:'short',day:'numeric',month:'long'});
    html+=`<div class="day"><span>${lbl}</span><span>${fmt(sum)}</span></div>`+chunk.map(e=>`<div class="item" data-id="${esc(e.id)}"><span class="dot" style="background:${CAT[e.cat]?.color||'#999'}"></span><div class="t"><b>${esc(e.note||e.sub||CAT[e.cat]?.name)}</b><span>${esc(CAT[e.cat]?.name||e.cat)}${e.sub?' · '+esc(e.sub):''}</span></div><div class="a">${fmt(e.amount)}</div></div>`).join(''); };
  rows.slice(0,400).forEach(e=>{ if(e.date!==cur){ flush(); cur=e.date; chunk=[]; } chunk.push(e); });
  flush();
  $('#list').innerHTML = html;
  document.querySelectorAll('#list .item').forEach(el=>el.onclick=()=>editExpense(el.dataset.id));
}

function confirmBtn(btn, fn){ btn.onclick=ev=>{ if(btn.dataset.c!=='1'){ btn.dataset.c='1'; btn.textContent='Wirklich löschen?'; return; } fn(); }; }

function editExpense(id){
  const e = S.expenses[id]; if(!e) return;
  let cat=e.cat, sub=e.sub, dAmt=String(e.amount).replace('.',','), dNote=e.note||'', dDate=e.date;
  const keep=()=>{ dAmt=$('#e-amt').value; dNote=$('#e-note').value; dDate=$('#e-date').value; };
  const draw=()=>{
    const c=CAT[cat];
    $('#sheet').innerHTML = `<h3>Ausgabe bearbeiten</h3>
      <label class="l">Betrag (€)</label><input type="text" id="e-amt" inputmode="decimal" value="${esc(dAmt)}">
      <label class="l">Kategorie</label><select id="e-cat">${CATS.map(x=>`<option value="${x.id}" ${x.id===cat?'selected':''}>${esc(x.name)}</option>`).join('')}</select>
      ${c&&c.subs.length?`<label class="l">Unterkategorie</label><select id="e-sub">${c.subs.map(s=>`<option ${s===sub?'selected':''}>${esc(s)}</option>`).join('')}</select>`:''}
      <label class="l">Notiz</label><input type="text" id="e-note" value="${esc(dNote)}">
      <label class="l">Datum</label><input type="date" id="e-date" value="${esc(dDate)}">
      <button class="btn" id="e-save">Speichern</button>
      <div class="row" style="margin-top:8px"><button class="btn sec" id="e-cancel" style="margin-top:0">Abbrechen</button><button class="btn danger" id="e-del" style="margin-top:0">Löschen</button></div>`;
    $('#e-cat').onchange=ev=>{ keep(); cat=ev.target.value; sub=CAT[cat].subs[0]||''; draw(); };
    if($('#e-sub')) $('#e-sub').onchange=ev=>sub=ev.target.value;
    $('#e-cancel').onclick=closeSheet;
    confirmBtn($('#e-del'), ()=>{ remove('expenses', id); closeSheet(); toast('Gelöscht'); });
    $('#e-save').onclick=()=>{ const a=parseAmt($('#e-amt').value); if(!(a>0)) return toast('Betrag prüfen');
      put('expenses', {...e, amount:a, cat, sub:cat===e.cat||CAT[cat].subs.includes(sub)?(sub||''):'', note:$('#e-note').value.trim(), date:$('#e-date').value||e.date});
      closeSheet(); toast('Gespeichert'); };
  };
  draw(); openSheet();
}

/* ---------- Fixkosten & Schulden ---------- */
function fixedFor(m){
  const items=[];
  FIX.forEach(f=>{ if(f.active===false) return; if(f.start && m<f.start) return; if(f.end && m>f.end) return; items.push({cat:f.cat,sub:f.sub||'',name:f.name,amount:+f.amount||0}); });
  DEBTS.forEach(d=>{ const rate=+d.rate||0; if(!rate||!d.start||m<d.start) return;
    const left=(+d.total||0)-rate*mDiff(d.start,m); if(left<=0.005) return;
    items.push({cat:'schulden',sub:'Rate',name:d.name,amount:Math.min(rate,left)}); });
  return items;
}
function debtState(d){
  const total=+d.total||0, rate=+d.rate||0, now=ym(today());
  let byRate=0; if(rate && d.start && now>=d.start) byRate=Math.min(total, rate*(mDiff(d.start,now)+1));
  const extra = EXP.filter(e=>e.debtId===d.id).reduce((a,e)=>a+e.amount,0);
  const remaining=Math.max(0,total-byRate-extra);
  return {total, extra, remaining, monthsLeft: rate?Math.ceil(remaining/rate):null, paid: total-remaining};
}
function renderFix(){
  $('#debts').innerHTML = DEBTS.length ? DEBTS.map(d=>{ const s=debtState(d); const pct=s.total?Math.min(100,s.paid/s.total*100):0;
    const end = s.monthsLeft ? mLabel(addM(ym(today()),s.monthsLeft),true) : null;
    return `<div class="card debt" data-id="${esc(d.id)}" style="cursor:pointer"><div class="h"><b>${esc(d.name)}</b><span class="muted">${s.remaining>0.005?'offen '+fmt(s.remaining):'abbezahlt'}</span></div>
      <div class="bar"><i style="width:${pct}%;background:var(--accent)"></i></div>
      <div class="sub" style="margin-top:8px">${fmt(s.paid)} von ${fmt(s.total)} getilgt${+d.rate?' · Rate '+fmt(d.rate)+'/Monat':''}${s.extra?' · davon Sondertilgung '+fmt(s.extra):''}${end&&s.remaining>0.005?' · schuldenfrei ca. '+end:''}</div></div>`; }).join('') : '<div class="empty">Keine Schulden angelegt.</div>';
  document.querySelectorAll('#debts .debt').forEach(el=>el.onclick=()=>editDebt(el.dataset.id));
  const sum = FIX.filter(f=>f.active!==false).reduce((a,f)=>a+(+f.amount||0),0);
  $('#fixed').innerHTML = FIX.length ? `<div class="card" style="padding:6px 16px">${FIX.map(f=>`<div class="catline" data-id="${esc(f.id)}"><div class="h"><span><i class="dot" style="background:${CAT[f.cat]?.color||'#999'}"></i>${esc(f.name)}${f.active===false?' <small class="muted">(pausiert)</small>':''}</span><b>${fmt(f.amount)}</b></div></div>`).join('')}<div class="catline"><div class="h"><span class="muted">Summe pro Monat</span><b>${fmt(sum)}</b></div></div></div>` : '<div class="empty">Noch keine Fixkosten. Typisch: Miete, Handyvertrag, Fitnessstudio, Streaming, Versicherungen.</div>';
  document.querySelectorAll('#fixed .catline[data-id]').forEach(el=>el.onclick=()=>editFixed(el.dataset.id));
}
$('#addfix').onclick=()=>editFixed(null);
$('#adddebt').onclick=()=>editDebt(null);

function editFixed(id){
  const f = id ? {...S.fixed[id]} : {id:uid(),name:'',amount:'',cat:'wohnen',sub:'Miete',start:ym(today()),end:'',active:true};
  let cat=f.cat;
  const draw=()=>{
    const c=CAT[cat];
    $('#sheet').innerHTML=`<h3>${id?'Fixkosten bearbeiten':'Neue Fixkosten'}</h3>
      <label class="l">Name</label><input type="text" id="f-name" value="${esc(f.name)}" placeholder="z. B. Miete, Handy, Fitnessstudio">
      <label class="l">Betrag pro Monat (€)</label><input type="text" id="f-amt" inputmode="decimal" value="${f.amount!==''?esc(String(f.amount).replace('.',',')):''}">
      <label class="l">Kategorie</label><select id="f-cat">${CATS.filter(x=>x.id!=='schulden').map(x=>`<option value="${x.id}" ${x.id===cat?'selected':''}>${esc(x.name)}</option>`).join('')}</select>
      ${c&&c.subs.length?`<label class="l">Unterkategorie</label><select id="f-sub">${c.subs.map(s=>`<option ${s===f.sub?'selected':''}>${esc(s)}</option>`).join('')}</select>`:''}
      <div class="row"><div><label class="l">Ab Monat</label><input type="month" id="f-start" value="${esc(f.start||'')}"></div><div><label class="l">Bis Monat (optional)</label><input type="month" id="f-end" value="${esc(f.end||'')}"></div></div>
      <button class="btn" id="f-save">Speichern</button>
      <div class="row" style="margin-top:8px"><button class="btn sec" id="f-cancel" style="margin-top:0">Abbrechen</button>${id?'<button class="btn danger" id="f-del" style="margin-top:0">Löschen</button>':''}</div>`;
    $('#f-cat').onchange=ev=>{ f.name=$('#f-name').value; f.amount=$('#f-amt').value; f.start=$('#f-start').value; f.end=$('#f-end').value; cat=ev.target.value; f.sub=CAT[cat].subs[0]||''; draw(); };
    $('#f-cancel').onclick=closeSheet;
    if(id) confirmBtn($('#f-del'), ()=>{ remove('fixed', id); closeSheet(); toast('Gelöscht'); });
    $('#f-save').onclick=()=>{ const a=parseAmt($('#f-amt').value), n=$('#f-name').value.trim();
      if(!n||!(a>0)) return toast('Name und Betrag angeben');
      put('fixed', {...f, name:n, amount:a, cat, sub:$('#f-sub')?$('#f-sub').value:'', start:$('#f-start').value||ym(today()), end:$('#f-end').value||'', active:true});
      closeSheet(); toast('Gespeichert'); };
  };
  draw(); openSheet();
}

function editDebt(id){
  const d = id ? {...S.debts[id]} : {id:uid(),name:'',total:'',rate:'',start:ym(today())};
  $('#sheet').innerHTML=`<h3>${id?'Schulden bearbeiten':'Neue Schulden'}</h3>
    <label class="l">Bezeichnung</label><input type="text" id="d-name" value="${esc(d.name)}" placeholder="z. B. BAföG, Kredit, privat geliehen">
    <label class="l">Offener Betrag zum Start (€)</label><input type="text" id="d-total" inputmode="decimal" value="${d.total!==''?esc(String(d.total).replace('.',',')):''}">
    <div class="row"><div><label class="l">Monatliche Rate (€, optional)</label><input type="text" id="d-rate" inputmode="decimal" value="${+d.rate?esc(String(d.rate).replace('.',',')):''}"></div>
    <div><label class="l">Erste Rate im Monat</label><input type="month" id="d-start" value="${esc(d.start||'')}"></div></div>
    <div class="sub" style="margin-top:10px">Die Rate wird jeden Monat automatisch abgezogen und bei den Fixkosten mitgezählt. Sondertilgungen trägst du unter „Erfassen“ mit der Kategorie Schulden ein.</div>
    <button class="btn" id="d-save">Speichern</button>
    <div class="row" style="margin-top:8px"><button class="btn sec" id="d-cancel" style="margin-top:0">Abbrechen</button>${id?'<button class="btn danger" id="d-del" style="margin-top:0">Löschen</button>':''}</div>`;
  $('#d-cancel').onclick=closeSheet;
  if(id) confirmBtn($('#d-del'), ()=>{ remove('debts', id); closeSheet(); toast('Gelöscht'); });
  $('#d-save').onclick=()=>{ const t=parseAmt($('#d-total').value), r=$('#d-rate').value.trim()?parseAmt($('#d-rate').value):0, n=$('#d-name').value.trim();
    if(!n||!(t>0)||!(r>=0)) return toast('Bezeichnung und Betrag angeben');
    put('debts', {...d, name:n, total:t, rate:r||0, start:$('#d-start').value||ym(today())});
    closeSheet(); toast('Gespeichert'); };
  openSheet();
}

/* ---------- Auswertung ---------- */
$('#mprev').onclick=()=>{ statMonth=addM(statMonth,-1); renderStats(); };
$('#mnext').onclick=()=>{ statMonth=addM(statMonth,1); renderStats(); };
function monthData(m){
  const vars = EXP.filter(e=>ym(e.date)===m);
  const fx = fixedFor(m);
  const v = vars.reduce((a,e)=>a+e.amount,0), f = fx.reduce((a,x)=>a+x.amount,0);
  return {vars, fx, v, f, total:v+f};
}
function renderStats(){
  const m=statMonth, d=monthData(m);
  $('#mlabel').textContent = mLabel(m,true);
  $('#mtotal').textContent = fmt(d.total);
  $('#kvar').textContent = fmt(d.v);
  $('#kfix').textContent = fmt(d.f);
  const food = d.vars.filter(e=>e.cat==='essen').reduce((a,e)=>a+e.amount,0) + d.fx.filter(x=>x.cat==='essen').reduce((a,x)=>a+x.amount,0);
  $('#kfood').textContent = fmt(food);
  const prev=[1,2,3].map(i=>monthData(addM(m,-i))).filter(x=>x.vars.length);
  if(prev.length){ const avg=prev.reduce((a,x)=>a+x.v,0)/prev.length; const diff=d.v-avg;
    $('#kcompare').textContent = `Variable Ausgaben ${diff>=0?fmt(diff)+' über':fmt(-diff)+' unter'} dem Schnitt der letzten ${prev.length} Monat${prev.length>1?'e':''} (${fmt(avg)}).`;
  } else $('#kcompare').textContent = '';
  const ms=[5,4,3,2,1,0].map(i=>addM(m,-i)); const md=ms.map(monthData); const max=Math.max(1,...md.map(x=>x.total));
  $('#chart').innerHTML = ms.map((mm,i)=>`<div class="c ${mm===m?'on':''}" data-m="${mm}"><em>${md[i].total?Math.round(md[i].total):''}</em><i style="height:${md[i].v/max*100}%"></i><i class="fx" style="height:${md[i].f/max*100}%"></i><small>${mLabel(mm)}</small></div>`).join('');
  document.querySelectorAll('#chart .c').forEach(el=>el.onclick=()=>{ statMonth=el.dataset.m; renderStats(); });
  const by={};
  d.vars.forEach(e=>{ const c=by[e.cat]??={sum:0,subs:{}}; c.sum+=e.amount; const s=e.sub||'Ohne'; c.subs[s]=(c.subs[s]||0)+e.amount; });
  d.fx.forEach(x=>{ const c=by[x.cat]??={sum:0,subs:{}}; c.sum+=x.amount; const s=(x.sub||x.name)+' (fix)'; c.subs[s]=(c.subs[s]||0)+x.amount; });
  const list=Object.entries(by).sort((a,b)=>b[1].sum-a[1].sum);
  $('#bycat').innerHTML = list.length ? list.map(([cid,c])=>{ const cc=CAT[cid]||{name:cid,color:'#999'}; const pct=d.total?c.sum/d.total*100:0;
    const subs=Object.entries(c.subs).sort((a,b)=>b[1]-a[1]);
    return `<div class="catline"><div class="h"><span><i class="dot" style="background:${cc.color}"></i>${esc(cc.name)}</span><b>${fmt(c.sum)} <small class="muted">${Math.round(pct)} %</small></b></div>
      <div class="bar"><i style="width:${pct}%;background:${cc.color}"></i></div>
      ${subs.length>1||(subs[0]&&subs[0][0]!=='Ohne')?`<div class="subs hidden">${subs.map(([s,v])=>`<div><span>${esc(s)}</span><span>${fmt(v)}</span></div>`).join('')}</div>`:''}</div>`; }).join('')
    : '<div class="empty">Keine Ausgaben in diesem Monat.</div>';
  document.querySelectorAll('#bycat .catline').forEach(el=>el.onclick=()=>{ const s=el.querySelector('.subs'); if(s) s.classList.toggle('hidden'); });
}
$('#export').onclick=exportCsv;

/* ---------- Sheet-Dialog ---------- */
function openSheet(){ $('#ov').classList.add('show'); }
function closeSheet(){ $('#ov').classList.remove('show'); }
$('#ov').addEventListener('click',e=>{ if(e.target.id==='ov') closeSheet(); });

/* ---------- Render & Start ---------- */
function render(){
  renderCats(); renderQuick();
  if(!$('#v-list').classList.contains('hidden')) renderList();
  if(!$('#v-stats').classList.contains('hidden')) renderStats();
  if(!$('#v-fix').classList.contains('hidden')) renderFix();
  status();
}
rebuild(); render(); sync();
if(!S.settings.url && !EXP.length) setTimeout(openSettings, 400);
if('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(()=>{});
