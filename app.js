/* Ausgaben: Offline-first, Speicher lokal, Abgleich mit eigenem Google Sheet */
const CATS = [
  {id:'essen', name:'Essen & Trinken', color:'#f59e0b', subs:['Einkauf','Auswärts','Mensa','Snacks & Kaffee','Lieferdienst','Getränke']},
  {id:'pflege', name:'Drogerie & Haushalt', color:'#ec4899', subs:['Körperpflege','Haushalt','Apotheke']},
  {id:'sport', name:'Sport', color:'#10b981', subs:['Ausrüstung','Mitgliedschaft','Wettkampf','Sporternährung']},
  {id:'mobil', name:'Mobilität', color:'#3b82f6', subs:['ÖPNV & Bahn','Fahrrad','Auto & Sprit','Taxi & Sharing']},
  {id:'freizeit', name:'Freizeit & Ausgehen', color:'#a855f7', subs:['Bars & Party','Kino & Events','Hobbys']},
  {id:'shopping', name:'Shopping', color:'#f43f5e', subs:['Kleidung','Elektronik','Sonstiges']},
  {id:'uni', name:'Uni & Arbeit', color:'#06b6d4', subs:['Bücher & Material','Software','Gebühren']},
  {id:'wohnen', name:'Wohnen', color:'#6366f1', subs:['Miete','Nebenkosten & Strom','Internet','Einrichtung']},
  {id:'vertraege', name:'Abos & Verträge', color:'#0ea5e9', subs:['Handy','Streaming','Versicherung','Software-Abo']},
  {id:'reisen', name:'Reisen', color:'#14b8a6', subs:['Anreise','Unterkunft','Vor Ort']},
  {id:'geschenke', name:'Geschenke', color:'#e11d48', subs:[]},
  {id:'schulden', name:'Schulden', color:'#64748b', subs:['Rate','Rückzahlung']},
  {id:'sonstiges', name:'Sonstiges', color:'#94a3b8', subs:[]},
];
const ICONS = {
  essen:'M7 3v7M5 3v4a2 2 0 0 0 4 0V3M7 10v11M17 3c-1.7 0-3 2.2-3 5.5S15.3 13 17 13v8V3',
  pflege:'M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z',
  sport:'M6.5 7v10M3.5 9.5v5M17.5 7v10M20.5 9.5v5M6.5 12h11',
  mobil:'M7 4h10a3 3 0 0 1 3 3v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a3 3 0 0 1 3-3zM4 11h16M8.5 20l1-3M15.5 20l-1-3',
  freizeit:'M12 3.5l2.5 5.2 5.7.6-4.3 3.9 1.2 5.6L12 16l-5.1 2.8 1.2-5.6-4.3-3.9 5.7-.6z',
  shopping:'M5 8h14l-1.2 12H6.2zM9 8V7a3 3 0 0 1 6 0v1',
  uni:'M3 8l9-4 9 4-9 4zM7 10v5c0 1.5 2.5 3 5 3s5-1.5 5-3v-5',
  wohnen:'M3.5 11L12 4l8.5 7M5.5 9.5V20h13V9.5M10 20v-5h4v5',
  vertraege:'M8 2.5h8a2 2 0 0 1 2 2v15a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-15a2 2 0 0 1 2-2zM11 18h2',
  reisen:'M21 3L3 10.5l7 2.5 2.5 7z M10 13l4.5-4.5',
  geschenke:'M4 11h16v9H4zM3 7.5h18V11H3zM12 7.5V20M12 7.5C10.5 4 7 4 7.5 6.5S12 7.5 12 7.5M12 7.5c1.5-3.5 5-3.5 4.5-1S12 7.5 12 7.5',
  schulden:'M3 6h18v12H3zM3 10h18M7 15h3',
  sonstiges:'M6 12h.01M12 12h.01M18 12h.01',
  in:'M17 7L7 17M7 9v8h8', out:'M7 17L17 7M9 7h8v8', tr:'M5 9h13l-3.5-3.5M19 15H6l3.5 3.5', trade:'M4 7h16v13H4zM9 7V5h6v2M4 12h16'
};
const ico = (key, color, size) => `<span class="ic${size?' '+size:''}" style="--c:${color||CAT[key]?.color||'#94a3b8'}"><svg viewBox="0 0 24 24"><path d="${ICONS[key]||ICONS.sonstiges}"/></svg></span>`;
const SOURCES = ['Gehalt','IT-Aufträge','Verkauf','Erstattung','Geschenk','Sonstiges'];
const TABLE_NAMES = ['expenses','fixed','debts','income','trades','balances','transfers'];
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
const daysIn = m => new Date(+m.slice(0,4), +m.slice(5,7), 0).getDate();
const dDE = d => { if(!d) return ''; const p=String(d).split('-'); return p.length===3?`${p[2]}.${p[1]}.${p[0]}`:d; };
const parseAmt = s => { s=String(s).trim().replace(/\s|€/g,''); if(s.includes(',')) s=s.replace(/\./g,'').replace(',','.'); const n=parseFloat(s); return isFinite(n)?Math.round(n*100)/100:NaN; };
const numIn = v => String(v??'')==='' ? '' : String(v).replace('.',',');
const uid = () => Date.now().toString(36)+Math.random().toString(36).slice(2,8);
const toast = t => { const el=$('#toast'); el.textContent=t; el.classList.add('show'); clearTimeout(toast._t); toast._t=setTimeout(()=>el.classList.remove('show'),1800); };

/* ---------- Lokaler Speicher ---------- */
const KEY='ausgaben-v1';
const blank = () => ({expenses:{},fixed:{},debts:{},income:{},trades:{},balances:{},transfers:{},prefs:{},queue:[],settings:{url:'',token:''},lastSync:0});
let S = (()=>{ try{ const s=JSON.parse(localStorage.getItem(KEY)); if(s) return Object.assign(blank(),s); }catch(e){} return blank(); })();
TABLE_NAMES.forEach(t=>{ if(!S[t]) S[t]={}; }); if(!S.prefs) S.prefs={};
function persist(){ try{ localStorage.setItem(KEY, JSON.stringify(S)); }catch(e){ toast('Lokales Speichern fehlgeschlagen'); } }
try{ navigator.storage && navigator.storage.persist && navigator.storage.persist(); }catch(e){}

let REFI={ids:new Set(),pairs:[]}, TRS=[], EXP=[], INC=[], FIX=[], FIXIN=[], DEBTS=[], TRADES=[], BAL=null, BALS=[], SIM={};
const DEFAULT_ACCOUNTS=['Gehaltskonto','Alltagskonto','Bargeld'];
const live = o => Object.values(o).filter(x=>!x.deleted);
const accOf = (e,kind) => e.account || (kind==='in'?'Gehaltskonto':'Alltagskonto');
function rebuild(){
  EXP = live(S.expenses).map(e=>({...e,amount:+e.amount||0})).sort((a,b)=>String(b.date).localeCompare(String(a.date))||(b.updatedAt||0)-(a.updatedAt||0));
  INC = live(S.income).map(e=>({...e,amount:+e.amount||0})).sort((a,b)=>String(b.date).localeCompare(String(a.date))||(b.updatedAt||0)-(a.updatedAt||0));
  TRS = live(S.transfers).map(e=>({...e,amount:+e.amount||0})).sort((a,b)=>String(b.date).localeCompare(String(a.date))||(b.updatedAt||0)-(a.updatedAt||0));
  const fx = live(S.fixed).sort((a,b)=>(+b.amount||0)-(+a.amount||0));
  FIX = fx.filter(f=>f.kind!=='income'); FIXIN = fx.filter(f=>f.kind==='income');
  DEBTS = live(S.debts).sort((a,b)=>String(a.due||'9999').localeCompare(String(b.due||'9999')));
  TRADES = live(S.trades).sort((a,b)=>String(b.sellDate||b.buyDate).localeCompare(String(a.sellDate||a.buyDate)));
  const bl = live(S.balances).sort((a,b)=>String(b.date).localeCompare(String(a.date))||(b.updatedAt||0)-(a.updatedAt||0));
  BAL = bl[0]||null;
  const seen={}; BALS=[]; bl.forEach(b=>{ if(!b.date) return; const k=b.account||'Konto'; if(!seen[k]){ seen[k]=1; BALS.push({...b,account:k}); } });
  SIM = {}; DEBTS.forEach(d=>SIM[d.id]=debtSim(d));
  // Umschuldung: neu geliehen bei A und gleich hohe Rückzahlung an B am selben Tag
  REFI={ids:new Set(),pairs:[]};
  INC.filter(i=>i.debtId).forEach(i=>{ const e=EXP.find(e=>e.debtId && e.debtId!==i.debtId && e.date===i.date && Math.abs(e.amount-i.amount)<0.005 && !REFI.ids.has(e.id));
    if(e){ REFI.ids.add(e.id); REFI.ids.add(i.id); REFI.pairs.push({inc:i,exp:e}); } });
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
    for(const t of TABLE_NAMES){
      if(!j.data[t]) continue;
      const next={};
      j.data[t].forEach(r=>{ if(r.id) next[r.id]=r; });
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
    <div class="sub" style="margin-top:14px">${S.queue.length} Änderungen warten auf Upload. ${EXP.length} Ausgaben, ${INC.length} Einnahmen gespeichert.</div>`;
  $('#s-save').onclick=()=>{ S.settings={url:$('#s-url').value.trim(), token:$('#s-token').value.trim()}; S.lastError=''; persist(); closeSheet(); sync(); };
  $('#s-export').onclick=exportCsv;
  $('#s-close').onclick=closeSheet;
  openSheet();
}
async function exportCsv(){
  const rows=[...EXP.map(e=>[e.date,'-'+String(e.amount).replace('.',','),CAT[e.cat]?.name||e.cat,e.sub||'',e.note||'']),
              ...INC.map(e=>[e.date,String(e.amount).replace('.',','),'Einnahme',e.source||'',e.note||''])].sort((a,b)=>a[0].localeCompare(b[0]));
  const lines=['Datum;Betrag;Kategorie;Unterkategorie;Notiz'].concat(rows.map(r=>r.map(x=>String(x).replace(/;/g,',')).join(';')));
  try{ await navigator.clipboard.writeText(lines.join('\n')); toast('CSV kopiert'); }catch(e){ toast('Kopieren nicht möglich'); }
}

/* ---------- Navigation ---------- */
let sel={cat:null, sub:null, src:'Gehalt'}, mode='out';
let statMonth = ym(today());
document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>show(b.dataset.v));
function show(v){
  document.querySelectorAll('nav button').forEach(b=>b.classList.toggle('on',b.dataset.v===v));
  ['home','add','list','stats','fix'].forEach(x=>$('#v-'+x).classList.toggle('hidden',x!==v));
  window.scrollTo(0,0);
  render();
}
let finTab='acc';
function showFin(f){
  finTab=f;
  document.querySelectorAll('#finseg button').forEach(b=>b.classList.toggle('on',b.dataset.f===f));
  $('#f-acc').classList.toggle('hidden',f!=='acc'); $('#f-fix').classList.toggle('hidden',f!=='fix');
  $('#f-debt').classList.toggle('hidden',f!=='debt'); $('#v-trade').classList.toggle('hidden',f!=='trade');
  render();
}
document.querySelectorAll('#finseg button').forEach(b=>b.onclick=()=>showFin(b.dataset.f));
const goFin = f => { show('fix'); showFin(f); };

/* ---------- Erfassen ---------- */
$('#date').value = today();
document.querySelectorAll('#mode button').forEach(b=>b.onclick=()=>{ mode=b.dataset.m; sel.acc=null; renderCats(); renderQuick(); });
function renderCats(){
  document.querySelectorAll('#mode button').forEach(b=>b.classList.toggle('on',b.dataset.m===mode));
  const inc = mode==='in', tr = mode==='tr';
  $('#cats').classList.toggle('hidden',inc||tr); $('#subs').classList.toggle('hidden',inc||tr); $('#srcs').classList.toggle('hidden',!inc);
  $('#trpick').classList.toggle('hidden',!tr); $('#accpick').classList.toggle('hidden',tr);
  $('#save').textContent = inc ? 'Einnahme speichern' : tr ? 'Umbuchung speichern' : 'Speichern';
  $('#note').placeholder = inc ? 'z. B. Gehalt, iPad-Verkauf' : tr ? 'z. B. Geld abgehoben' : 'z. B. Rewe, Asiamarkt';
  const accs = accounts();
  if(tr){
    const opt = v => accs.map(a=>`<option ${a===v?'selected':''}>${esc(a)}</option>`).join('');
    const f = $('#trfrom').value || S.prefs.trFrom || 'Alltagskonto', t = $('#trto').value || S.prefs.trTo || 'Bargeld';
    $('#trfrom').innerHTML = opt(f); $('#trto').innerHTML = opt(t);
  } else {
    if(!sel.acc || !accs.includes(sel.acc)) sel.acc = (inc ? S.prefs.accIn : S.prefs.accOut) || (inc ? 'Gehaltskonto' : 'Alltagskonto');
    $('#acclabel').textContent = inc ? 'Eingegangen auf' : 'Bezahlt von';
    $('#accs').innerHTML = accs.map(a=>`<button class="chip ${sel.acc===a?'on':''}">${esc(a)}</button>`).join('');
    document.querySelectorAll('#accs .chip').forEach((b,i)=>b.onclick=()=>{ sel.acc=accs[i]; S.prefs[inc?'accIn':'accOut']=sel.acc; persist(); renderCats(); });
  }
  $('#srcs').innerHTML = SOURCES.map(s=>`<button class="chip ${sel.src===s?'on':''}">${esc(s)}</button>`).join('');
  document.querySelectorAll('#srcs .chip').forEach((b,i)=>b.onclick=()=>{ sel.src=SOURCES[i]; renderCats(); });
  $('#cats').innerHTML = CATS.map(c=>`<button class="cat ${sel.cat===c.id?'on':''}" data-c="${c.id}">${ico(c.id)}<span>${esc(c.name)}</span></button>`).join('');
  document.querySelectorAll('#cats .cat').forEach(b=>b.onclick=()=>{ sel.cat=b.dataset.c; sel.sub=CAT[sel.cat].subs[0]||null; renderCats(); });
  const c = CAT[sel.cat];
  $('#subs').innerHTML = c && c.subs.length ? c.subs.map(s=>`<button class="chip ${sel.sub===s?'on':''}">${esc(s)}</button>`).join('') : '';
  document.querySelectorAll('#subs .chip').forEach((b,i)=>b.onclick=()=>{ sel.sub=c.subs[i]; renderCats(); });
  const isDebt = mode==='out' && sel.cat==='schulden';
  $('#debtpick').classList.toggle('hidden', !isDebt);
  if(isDebt){
    const open = DEBTS.filter(d=>SIM[d.id].remaining>0.005);
    $('#debtsel').innerHTML = open.length ? open.map(d=>`<option value="${esc(d.id)}">${esc(d.name)} (offen ${fmt(SIM[d.id].remaining)})</option>`).join('') : '<option value="">Keine offenen Schulden angelegt</option>';
  }
  validate();
}
function validate(){ $('#save').disabled = !((mode!=='out' || sel.cat) && parseAmt($('#amt').value)>0); }
$('#amt').addEventListener('input',validate);
$('#amt').addEventListener('keydown',e=>{ if(e.key==='Enter') save(); });
$('#note').addEventListener('keydown',e=>{ if(e.key==='Enter') save(); });
$('#save').onclick = save;

function renderQuick(){
  if(mode!=='out'){ $('#quick').innerHTML=''; return; }
  const counts={};
  EXP.slice(0,120).forEach(e=>{ if(e.cat==='schulden') return; const k=e.cat+'|'+(e.sub||'')+'|'+(e.note||'').trim(); counts[k]=(counts[k]||0)+1; });
  const top = Object.entries(counts).filter(([,n])=>n>=2).sort((a,b)=>b[1]-a[1]).slice(0,6);
  $('#quick').innerHTML = top.map(([k])=>{ const [c,s,n]=k.split('|'); return `<button class="chip" data-k="${esc(k)}"><span class="dot" style="background:${CAT[c]?.color||'#999'};display:inline-block;margin-right:6px"></span>${esc(n||s||CAT[c]?.name)}</button>`; }).join('');
  document.querySelectorAll('#quick .chip').forEach(b=>b.onclick=()=>{ const [c,s,n]=b.dataset.k.split('|'); sel.cat=c; sel.sub=s||null; $('#note').value=n; renderCats(); $('#amt').focus(); });
}

function save(){
  const amount = parseAmt($('#amt').value);
  if(!(amount>0)) return;
  if(mode==='tr'){
    const from=$('#trfrom').value, to=$('#trto').value;
    if(from===to) return toast('Von und Nach müssen verschieden sein');
    S.prefs.trFrom=from; S.prefs.trTo=to;
    put('transfers', { id:uid(), amount, from, to, note:$('#note').value.trim(), date:$('#date').value||today() });
    toast(fmt(amount)+' umgebucht');
  } else if(mode==='in'){
    put('income', { id:uid(), amount, source:sel.src||'Sonstiges', note:$('#note').value.trim(), date:$('#date').value||today(), account:sel.acc||'' });
    toast('+'+fmt(amount)+' gespeichert');
  } else {
    if(!sel.cat) return;
    const rec = { id:uid(), amount, cat:sel.cat, sub:sel.sub||'', note:$('#note').value.trim(), date:$('#date').value||today(), debtId:'', account:sel.acc||'' };
    if(sel.cat==='schulden'){ const id=$('#debtsel').value; if(id) rec.debtId=id; }
    put('expenses', rec);
    toast(fmt(amount)+' gespeichert');
  }
  $('#amt').value=''; $('#note').value=''; $('#date').value=today();
  $('#amt').focus(); validate();
}

/* ---------- Verlauf ---------- */
$('#search').addEventListener('input',renderList);
function renderList(){
  const q = $('#search').value.trim().toLowerCase();
  const all = [...EXP.map(e=>({...e,_t:'out'})), ...INC.map(e=>({...e,_t:'in'})), ...TRS.map(e=>({...e,_t:'tr'}))]
    .sort((a,b)=>String(b.date).localeCompare(String(a.date))||(b.updatedAt||0)-(a.updatedAt||0));
  const rows = all.filter(e=>!q || [(e.note||''),(e.sub||''),(e.source||''),(e.account||''),(e.from||''),(e.to||''),e._t==='in'?'einnahme':e._t==='tr'?'umbuchung':(CAT[e.cat]?.name||'')].join(' ').toLowerCase().includes(q));
  if(!rows.length){ $('#list').innerHTML = `<div class="empty">${all.length?'Nichts gefunden.':'Noch nichts erfasst.'}</div>`; return; }
  let html='', cur=null, chunk=[];
  const line = e => e._t==='in'
    ? `<div class="item" data-id="${esc(e.id)}" data-t="in">${ico('in','#10b981')}<div class="t"><b>${esc(e.note||e.source||'Einnahme')}</b><span>Einnahme · ${esc(e.source||'')} · ${esc(accOf(e,'in'))}</span></div><div class="a pos">+${fmt(e.amount)}</div></div>`
    : e._t==='tr'
    ? `<div class="item" data-id="${esc(e.id)}" data-t="tr">${ico('tr','#64748b')}<div class="t"><b>${esc(e.note||'Umbuchung')}</b><span>${esc(e.from)} → ${esc(e.to)}</span></div><div class="a muted">${fmt(e.amount)}</div></div>`
    : `<div class="item" data-id="${esc(e.id)}" data-t="out">${ico(e.cat)}<div class="t"><b>${esc(e.note||e.sub||CAT[e.cat]?.name)}</b><span>${esc(CAT[e.cat]?.name||e.cat)}${e.sub?' · '+esc(e.sub):''} · ${esc(accOf(e,'out'))}</span></div><div class="a">${fmt(e.amount)}</div></div>`;
  const flush=()=>{ if(!cur) return; const sum=chunk.reduce((a,e)=>a+(e._t==='out'?e.amount:0),0);
    const d=new Date(cur+'T12:00'); const lbl=isNaN(d)?cur:d.toLocaleDateString('de-DE',{weekday:'short',day:'numeric',month:'long'});
    html+=`<div class="day"><span>${lbl}</span><span>${sum?fmt(sum):''}</span></div>`+chunk.map(line).join(''); };
  rows.slice(0,400).forEach(e=>{ if(e.date!==cur){ flush(); cur=e.date; chunk=[]; } chunk.push(e); });
  flush();
  $('#list').innerHTML = html;
  document.querySelectorAll('#list .item').forEach(el=>el.onclick=()=> el.dataset.t==='in' ? editIncome(el.dataset.id) : el.dataset.t==='tr' ? editTransfer(el.dataset.id) : editExpense(el.dataset.id));
}

function confirmBtn(btn, fn){ btn.onclick=ev=>{ if(btn.dataset.c!=='1'){ btn.dataset.c='1'; btn.textContent='Wirklich löschen?'; return; } fn(); }; }
const delRow = del => `<div class="row" style="margin-top:8px"><button class="btn sec" id="x-cancel" style="margin-top:0">Abbrechen</button>${del?'<button class="btn danger" id="x-del" style="margin-top:0">Löschen</button>':''}</div>`;
function wireSheet(table,id){ $('#x-cancel').onclick=closeSheet; if($('#x-del')) confirmBtn($('#x-del'), ()=>{ remove(table,id); closeSheet(); toast('Gelöscht'); }); }

function editExpense(id){
  const e = S.expenses[id]; if(!e) return;
  let cat=e.cat, sub=e.sub, dAmt=numIn(e.amount), dNote=e.note||'', dDate=e.date, dAcc=accOf(e,'out');
  const keep=()=>{ dAmt=$('#e-amt').value; dNote=$('#e-note').value; dDate=$('#e-date').value; dAcc=readAccount('e-acc'); };
  const draw=()=>{
    const c=CAT[cat];
    $('#sheet').innerHTML = `<h3>Ausgabe bearbeiten</h3>
      <label class="l">Betrag (€)</label><input type="text" id="e-amt" inputmode="decimal" value="${esc(dAmt)}">
      <label class="l">Kategorie</label><select id="e-cat">${CATS.map(x=>`<option value="${x.id}" ${x.id===cat?'selected':''}>${esc(x.name)}</option>`).join('')}</select>
      ${c&&c.subs.length?`<label class="l">Unterkategorie</label><select id="e-sub">${c.subs.map(s=>`<option ${s===sub?'selected':''}>${esc(s)}</option>`).join('')}</select>`:''}
      <label class="l">Notiz</label><input type="text" id="e-note" value="${esc(dNote)}">
      <label class="l">Datum</label><input type="date" id="e-date" value="${esc(dDate)}">
      ${accountField('e-acc', dAcc)}
      <button class="btn" id="e-save">Speichern</button>${delRow(true)}`;
    wireAccount('e-acc');
    $('#e-cat').onchange=ev=>{ keep(); cat=ev.target.value; sub=CAT[cat].subs[0]||''; draw(); };
    if($('#e-sub')) $('#e-sub').onchange=ev=>sub=ev.target.value;
    wireSheet('expenses',id);
    $('#e-save').onclick=()=>{ const a=parseAmt($('#e-amt').value); if(!(a>0)) return toast('Betrag prüfen');
      put('expenses', {...e, amount:a, cat, sub:(CAT[cat].subs.includes(sub)?sub:'')||'', note:$('#e-note').value.trim(), date:$('#e-date').value||e.date, account:readAccount('e-acc')});
      closeSheet(); toast('Gespeichert'); };
  };
  draw(); openSheet();
}

function editIncome(id){
  const e = S.income[id]; if(!e) return;
  $('#sheet').innerHTML = `<h3>Einnahme bearbeiten</h3>
    <label class="l">Betrag (€)</label><input type="text" id="i-amt" inputmode="decimal" value="${esc(numIn(e.amount))}">
    <label class="l">Quelle</label><select id="i-src">${(SOURCES.includes(e.source)||!e.source?SOURCES:[...SOURCES,e.source]).map(s=>`<option ${s===e.source?'selected':''}>${esc(s)}</option>`).join('')}</select>
    <label class="l">Notiz</label><input type="text" id="i-note" value="${esc(e.note||'')}">
    <label class="l">Datum</label><input type="date" id="i-date" value="${esc(e.date)}">
    ${accountField('i-acc', accOf(e,'in'))}
    <button class="btn" id="i-save">Speichern</button>${delRow(true)}`;
  wireAccount('i-acc');
  wireSheet('income',id);
  $('#i-save').onclick=()=>{ const a=parseAmt($('#i-amt').value); if(!(a>0)) return toast('Betrag prüfen');
    put('income', {...e, amount:a, source:$('#i-src').value, note:$('#i-note').value.trim(), date:$('#i-date').value||e.date, account:readAccount('i-acc')}); closeSheet(); toast('Gespeichert'); };
  openSheet();
}

function editTransfer(id){
  const e = S.transfers[id]; if(!e) return;
  const opt = v => accounts().map(a=>`<option ${a===v?'selected':''}>${esc(a)}</option>`).join('');
  $('#sheet').innerHTML = `<h3>Umbuchung bearbeiten</h3>
    <label class="l">Betrag (€)</label><input type="text" id="u-amt" inputmode="decimal" value="${esc(numIn(e.amount))}">
    <div class="row"><div><label class="l">Von</label><select id="u-from">${opt(e.from)}</select></div><div><label class="l">Nach</label><select id="u-to">${opt(e.to)}</select></div></div>
    <label class="l">Notiz</label><input type="text" id="u-note" value="${esc(e.note||'')}">
    <label class="l">Datum</label><input type="date" id="u-date" value="${esc(e.date)}">
    <button class="btn" id="u-save">Speichern</button>${delRow(true)}`;
  wireSheet('transfers',id);
  $('#u-save').onclick=()=>{ const a=parseAmt($('#u-amt').value); if(!(a>0)) return toast('Betrag prüfen');
    if($('#u-from').value===$('#u-to').value) return toast('Von und Nach müssen verschieden sein');
    put('transfers', {...e, amount:a, from:$('#u-from').value, to:$('#u-to').value, note:$('#u-note').value.trim(), date:$('#u-date').value||e.date}); closeSheet(); toast('Gespeichert'); };
  openSheet();
}

/* ---------- Schulden: Verlauf mit Raten, Rückzahlungen und Zinsen ---------- */
function debtSim(d){
  const total=+d.total||0, rate=+d.rate||0, z=(+d.interest||0)/1200, now=ym(today());
  const start = d.start || now;
  const extras={}, borrows={}, mOf=x=>ym(x.date)<start?start:ym(x.date);
  EXP.filter(e=>e.debtId===d.id).forEach(e=>{ const m=mOf(e); extras[m]=(extras[m]||0)+e.amount; });
  INC.filter(e=>e.debtId===d.id).forEach(e=>{ const m=mOf(e); borrows[m]=(borrows[m]||0)+e.amount; });
  let bal=total, interest=0, extra=0, borrowed=0; const rates={}, hist=[];
  const n=Math.max(0,mDiff(start,now));
  for(let k=0;k<=n;k++){
    const m=addM(start,k), b0=bal;
    const br=borrows[m]||0; bal+=br; borrowed+=br;
    let rp=0; if(rate && bal>0.005 && (!d.rateStart || m>=d.rateStart)){ rp=Math.min(rate,bal); rates[m]=rp; bal-=rp; }
    const ex=extras[m]||0; bal-=ex; extra+=ex;
    let zi=0; if(k<n && bal>0.005 && z){ zi=bal*z; bal+=zi; interest+=zi; }
    hist.push({m, start:b0, borrowed:br, rate:rp, extra:ex, interest:zi, end:bal});
  }
  const remaining=Math.max(0,Math.round(bal*100)/100);
  let monthsLeft=null;
  if(rate && remaining>0.005){ let b=remaining,k=0; while(b>0.005 && k<600){ k++; b+=b*z; b-=rate; } monthsLeft=k<600?k:null; }
  return {total, remaining, interest, extra, borrowed, rates, hist, monthsLeft, paid: total+borrowed+interest-remaining};
}

/* ---------- Monatswerte ---------- */
function fixedFor(m){
  const items=[];
  FIX.forEach(f=>{ if(f.active===false) return; if(f.start && m<f.start) return; if(f.end && m>f.end) return; items.push({cat:f.cat,sub:f.sub||'',name:f.name,amount:+f.amount||0}); });
  DEBTS.forEach(d=>{ const p=SIM[d.id]&&SIM[d.id].rates[m]; if(p) items.push({cat:'schulden',sub:'Rate',name:d.name,amount:p}); });
  return items;
}
function fixedIncomeFor(m){
  return FIXIN.filter(f=>f.active!==false && !(f.start && m<f.start) && !(f.end && m>f.end)).map(f=>({name:f.name, amount:+f.amount||0}));
}
const tradeProfit = t => (+t.sellPrice||0) - (+t.buyPrice||0) - (+t.buyCosts||0) - (+t.fees||0) - (+t.partnerFee||0);
// was beim Verkauf wirklich auf dem Konto landet
const tradeCashIn = t => (+t.sellPrice||0) - (+t.fees||0) - (+t.partnerFee||0) - (!t.buyAccount && t.repay!==false && t.type!=='comm' ? (+t.buyPrice||0) : 0);
function monthData(m){
  const vars = EXP.filter(e=>ym(e.date)===m && !REFI.ids.has(e.id));
  const fx = fixedFor(m);
  const incs = INC.filter(e=>ym(e.date)===m && !e.debtId);
  const fxin = fixedIncomeFor(m);
  const sold = TRADES.filter(t=>t.sellDate && ym(t.sellDate)===m);
  const v = vars.reduce((a,e)=>a+e.amount,0), f = fx.reduce((a,x)=>a+x.amount,0);
  const tp = sold.reduce((a,t)=>a+tradeProfit(t),0);
  const inc = incs.reduce((a,e)=>a+e.amount,0) + fxin.reduce((a,x)=>a+x.amount,0) + tp;
  return {vars, fx, incs, fxin, sold, v, f, tp, total:v+f, inc, left: inc-(v+f)};
}

/* ---------- Finanzen ---------- */
const accounts = () => { const a=[...DEFAULT_ACCOUNTS]; [...TRADES.map(t=>t.buyAccount), ...TRADES.map(t=>t.sellAccount), ...BALS.map(b=>b.account), ...live(S.fixed).map(f=>f.account), ...EXP.map(e=>e.account), ...INC.map(e=>e.account), ...TRS.map(t=>t.from), ...TRS.map(t=>t.to)].forEach(x=>{ if(x && !a.includes(x)) a.push(x); }); return a; };
const bookDate = (f,m) => m+'-'+String(Math.min(+f.day||1, daysIn(m))).padStart(2,'0');
const fixActive = (f,m) => f.active!==false && !(f.start && m<f.start) && !(f.end && m>f.end);
// feste Buchungen (Einnahmen +, Kosten −) eines Kontos zwischen zwei Daten (from exklusiv, to inklusiv)
// Rate einer Schuld in Monat m: vergangene Monate aus der Simulation, künftige als Plan
function debtRateFor(d,m){
  const s=SIM[d.id]; if(!s || !(+d.rate) || !d.day) return 0;
  if(d.rateStart && m<d.rateStart) return 0;
  if(m<=ym(today())) return s.rates[m]||0;
  return s.remaining>0.005 ? Math.min(+d.rate, s.remaining) : 0;
}
function debtBookings(m, from, to, account){
  const out=[];
  DEBTS.forEach(d=>{ const a=debtRateFor(d,m); if(!a) return; if(account && (d.account||'')!==account) return;
    const dt=bookDate(d,m); if(dt>from && (to.inclusive ? dt<=to.date : dt<to.date)) out.push({date:dt,name:'Rate '+d.name,amount:-a,acc:d.account}); });
  return out;
}
function fixedBookings(from, to, account){
  const out=[]; if(!from || to<=from) return out;
  let m=ym(from); const last=ym(to);
  for(let k=0;k<36 && m<=last;k++,m=addM(m,1)){
    out.push(...debtBookings(m, from, {date:to,inclusive:true}, account));
    [...FIXIN.map(f=>({f,sign:1})), ...FIX.map(f=>({f,sign:-1}))].forEach(({f,sign})=>{
      if(!fixActive(f,m) || !f.day) return;
      if(account && (f.account||'')!==account) return;
      const d=bookDate(f,m); if(d>from && d<=to) out.push({date:d,name:f.name,amount:sign*(+f.amount||0)});
    });
  }
  return out;
}
// alle Bewegungen eines Kontos seit einem eingetragenen Stand
function movements(b, to){
  const acc=b.account, d0=b.date, u0=b.updatedAt||0;
  const after = e => e.date<=to && (e.date>d0 || (e.date===d0 && (e.updatedAt||0)>u0));
  const out = EXP.filter(e=>accOf(e,'out')===acc && after(e)).reduce((a,e)=>a+e.amount,0);
  const inc = INC.filter(e=>accOf(e,'in')===acc && after(e)).reduce((a,e)=>a+e.amount,0);
  const tr = TRS.filter(after).reduce((a,t)=>a+(t.to===acc?t.amount:0)-(t.from===acc?t.amount:0),0);
  const fx = fixedBookings(d0,to,acc).reduce((a,x)=>a+x.amount,0);
  let hd=0; TRADES.forEach(t=>{
    if(t.type!=='comm' && t.buyAccount===acc && t.buyDate && after({date:t.buyDate,updatedAt:t.updatedAt})) hd-=(+t.buyPrice||0)+(+t.buyCosts||0);
    if(t.sellAccount===acc && t.sellDate && after({date:t.sellDate,updatedAt:t.updatedAt})) hd+=tradeCashIn(t);
  });
  const parts = [['Ausgaben',-out],['Einnahmen',inc],['Umbuchungen',tr],['feste Buchungen',fx],['Handel',hd]].filter(([,v])=>Math.abs(v)>0.004);
  return {total:inc-out+tr+fx+hd, parts};
}
function upcoming(n){
  const t=today(), m0=ym(t), items=[];
  [m0, addM(m0,1)].forEach(m=>{
    FIXIN.forEach(f=>{ if(fixActive(f,m) && f.day){ const d=bookDate(f,m); if(d>=t) items.push({date:d,name:f.name,amount:+f.amount||0,acc:f.account}); } });
    FIX.forEach(f=>{ if(fixActive(f,m) && f.day){ const d=bookDate(f,m); if(d>=t) items.push({date:d,name:f.name,amount:-(+f.amount||0),acc:f.account}); } });
    DEBTS.forEach(d=>{ if(d.due && ym(d.due)===m && d.due>=t && SIM[d.id].remaining>0.005) items.push({date:d.due,name:d.name+' (fällig)',amount:-SIM[d.id].remaining}); });
    items.push(...debtBookings(m, addDays(t,-1), {date:'9999-12-31'}));
  });
  return items.sort((a,b)=>a.date.localeCompare(b.date)).slice(0,n);
}
const balRows = t => BALS.map(b=>{ const mv=movements(b,t); return {...b, mv, delta:mv.total, est:(+b.amount||0)+mv.total}; });
// Stichtag: nächster Eingang der größten festen Einnahme mit Tag (meist das Gehalt), sonst Monatsende
function nextPayday(){
  const t=today(), m0=ym(t);
  const main = FIXIN.filter(f=>f.day && f.active!==false).sort((a,b)=>(+b.amount||0)-(+a.amount||0))[0];
  if(main) for(const m of [m0,addM(m0,1),addM(m0,2)]){ if(fixActive(main,m)){ const d=bookDate(main,m); if(d>t) return {date:d,name:main.name}; } }
  return {date:addDays(m0+'-'+String(daysIn(m0)).padStart(2,'0'),1), name:null};
}
function bookingsBetween(from, to){ // from exklusiv, to exklusiv
  const items=[]; let m=ym(from);
  for(let k=0;k<4 && m<=ym(to);k++,m=addM(m,1)){
    FIXIN.forEach(f=>{ if(fixActive(f,m) && f.day){ const d=bookDate(f,m); if(d>from && d<to) items.push({date:d,name:f.name,amount:+f.amount||0,acc:f.account}); } });
    FIX.forEach(f=>{ if(fixActive(f,m) && f.day){ const d=bookDate(f,m); if(d>from && d<to) items.push({date:d,name:f.name,amount:-(+f.amount||0),acc:f.account}); } });
    items.push(...debtBookings(m, from, {date:to}));
  }
  DEBTS.forEach(d=>{ if(d.due && d.due>from && d.due<to && SIM[d.id].remaining>0.005) items.push({date:d.due,name:d.name+' (fällig)',amount:-SIM[d.id].remaining}); });
  // schon erfasste Einzelbuchungen mit Datum in der Zukunft
  const dn = id => S.debts[id]?.name || 'Schulden';
  REFI.pairs.forEach(({inc,exp})=>{ if(inc.date>from && inc.date<to) items.push({date:inc.date,name:`Umschuldung ${dn(inc.debtId)} → ${dn(exp.debtId)}`,amount:0,refi:inc.amount}); });
  EXP.forEach(e=>{ if(REFI.ids.has(e.id)) return; if(e.date>from && e.date<to) items.push({date:e.date,name:e.note||e.sub||CAT[e.cat]?.name||'Ausgabe',amount:-e.amount,acc:accOf(e,'out')}); });
  INC.forEach(e=>{ if(REFI.ids.has(e.id)) return; if(e.date>from && e.date<to) items.push({date:e.date,name:e.note||e.source||'Einnahme',amount:e.amount,acc:accOf(e,'in')}); });
  return items.sort((a,b)=>a.date.localeCompare(b.date));
}
function renderFree(show){
  const el=$('#free'); if(!el) return; if(!show){ el.classList.add('hidden'); return; } el.classList.remove('hidden');
  const t=today(), pd=nextPayday();
  const days=Math.max(1,Math.round((new Date(pd.date+'T12:00')-new Date(t+'T12:00'))/864e5));
  const lbl = pd.name ? `bis ${esc(pd.name)} am ${dDE(pd.date).slice(0,6)}` : 'bis Monatsende';
  if(!BALS.length){ el.innerHTML=`<div class="sub"><b>Was ist wirklich frei ${lbl}?</b><br>Trag unter Finanzen deine aktuellen Kontostände und dein Bargeld ein. Dann rechnet die App hier mit deinem echten Geld.</div>`; return; }
  const now = balRows(t).reduce((a,r)=>a+r.est,0);
  const items = bookingsBetween(t, pd.date);
  const inSum = items.filter(x=>x.amount>0).reduce((a,x)=>a+x.amount,0), outSum = items.filter(x=>x.amount<0).reduce((a,x)=>a+x.amount,0);
  const free = now+inSum+outSum;
  let run=now;
  el.innerHTML = `<div class="sub" style="margin-bottom:6px">Frei ${lbl} (${days} Tage)</div>
    <div class="h" style="display:flex;justify-content:space-between;align-items:baseline"><b style="font-size:26px" class="${free>=0?'pos':'neg'}">${fmt(free)}</b><span>${free>=0?fmt(free/days)+' pro Tag':'fehlt bis dahin'}</span></div>
    <div class="catline"><div class="h"><span>Geld jetzt auf allen Konten</span><b>${fmt(now)}</b></div></div>
    <div class="catline"><div class="h"><span>kommt noch rein</span><b class="pos">+${fmt(inSum)}</b></div></div>
    <div class="catline"><div class="h"><span>geht noch raus</span><b>${outSum?'−'+fmt(-outSum):fmt(0)}</b></div></div>
    ${items.length?`<button class="btn sec small" id="freetoggle" style="margin-top:8px">Buchungen bis dahin zeigen</button><div id="freelist" class="hidden" style="margin-top:6px">${items.map(x=>{ run+=x.amount; return `<div class="catline"><div class="h"><span>${dDE(x.date).slice(0,6)} ${esc(x.name)}${x.acc?` <small class="muted">${esc(x.acc)}</small>`:''}</span><b class="${x.amount>=0?'pos':''}">${x.amount>=0?'+':'−'}${fmt(Math.abs(x.amount))}</b></div><div class="sub" style="font-size:12px;text-align:right">danach ${fmt(run)}</div></div>`; }).join('')}</div>`:''}
    <div class="sub" style="margin-top:8px;font-size:13px">Gerechnet mit deinen Kontoständen inkl. allem, was du seitdem erfasst hast, plus festen Buchungen mit Tag und fälligen Schulden. Was du ab heute ausgibst, ist hier noch nicht abgezogen.</div>`;
  if($('#freetoggle')) $('#freetoggle').onclick=()=>$('#freelist').classList.toggle('hidden');
}
const MS=['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];
const bookRow = (x, after) => `<div class="brow"><span class="dte"><b>${+x.date.slice(8,10)}</b><small>${MS[+x.date.slice(5,7)-1]}</small></span>
  <span class="bt"><span class="nm">${esc(x.name)}</span>${x.acc?`<small>${esc(x.acc)}</small>`:''}</span>
  <span class="ba">${x.refi?`<span class="muted">${fmt(x.refi)}</span><small>umgeschuldet</small>`:`<b class="${x.amount>=0?'pos':''}">${x.amount>=0?'+':'−'}${fmt(Math.abs(x.amount))}</b>${after!=null?`<small>danach ${fmt(after)}</small>`:''}`}</span></div>`;
function warnings(){
  const t=today(), w=[];
  DEBTS.forEach(d=>{ if(SIM[d.id].remaining>0.005 && !d.due && !(+d.rate && d.day)) w.push({txt:`${d.name}: kein Fälligkeitsdatum und keine Rate, wird nicht eingeplant`, fn:()=>editDebt(d.id)}); });
  [...FIXIN,...FIX].forEach(f=>{ if(f.active!==false && !f.day && fixActive(f,ym(t))) w.push({txt:`${f.name}: ohne Tag, wird nicht vom Konto abgezogen`, fn:()=>editFixed(f.id,f.kind==='income'?'income':'expense')}); });
  BALS.forEach(b=>{ const n=Math.round((new Date(t+'T12:00')-new Date(b.date+'T12:00'))/864e5); if(n>14) w.push({txt:`${b.account}: seit ${n} Tagen nicht abgeglichen`, fn:()=>editBalance(b.account)}); });
  BALS.filter(b=>b.date===t).forEach(b=>[...FIX,...FIXIN].forEach(f=>{ if(f.day && (f.account||'')===b.account && fixActive(f,ym(t)) && bookDate(f,ym(t))===t) w.push({txt:`${f.name} ist heute fällig und gilt als schon im Kontostand ${b.account} enthalten`, fn:()=>editFixed(f.id,f.kind==='income'?'income':'expense')}); }));
  return w;
}
function renderHome(){
  const t=today(), pd=nextPayday();
  const days=Math.max(1,Math.round((new Date(pd.date+'T12:00')-new Date(t+'T12:00'))/864e5));
  const lbl = pd.name ? `Frei bis ${esc(pd.name)} · ${dDE(pd.date).slice(0,6)}` : 'Frei bis Monatsende';
  const rows=balRows(t), now=rows.reduce((a,r)=>a+r.est,0);
  const items=bookingsBetween(t, pd.date);
  const inSum=items.filter(x=>x.amount>0).reduce((a,x)=>a+x.amount,0), outSum=items.filter(x=>x.amount<0).reduce((a,x)=>a+x.amount,0);
  const free=now+inSum+outSum;
  let html = BALS.length ? `<div class="card hero" id="h-hero">
      <div class="lbl">${lbl}</div>
      <div class="amt ${free>=0?'':'neg'}">${fmt(free)}</div>
      <div class="per"><span class="pill">${free>=0?`${fmt(free/days)} pro Tag`:'fehlt bis dahin'}</span><span class="days">noch ${days} Tage</span></div>
      <div class="split"><div><small>Auf Konten</small><b>${fmt(now)}</b></div><div><small>Kommt rein</small><b class="pos">+${fmt(inSum)}</b></div><div><small>Geht raus</small><b>${outSum?'−'+fmt(-outSum):fmt(0)}</b></div></div>
      ${items.length?'<button class="hlink" id="h-items">Alle Buchungen bis dahin ›</button>':''}
    </div>`
    : `<div class="card hero"><div class="lbl">${lbl}</div><div class="sub" style="margin-top:8px">Trag deine Kontostände und dein Bargeld ein, dann siehst du hier, was wirklich frei ist.</div><button class="btn" id="h-firstbal">Kontostand eintragen</button></div>`;
  if(rows.length){
    const accIc = a => /bar/i.test(a) ? 'M3 7h18v10H3zM12 12m-2.5 0a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0-5 0' : 'M3 6h18v12H3zM3 10h18M7 15h3';
    html += `<h2>Konten</h2><div class="card list">${rows.map((r,i)=>`<div class="catline chev" data-acc="${esc(r.account)}"><div class="h"><span><span class="ic sm" style="--c:${['#6366f1','#0ea5e9','#10b981','#f59e0b','#a855f7'][i%5]}"><svg viewBox="0 0 24 24"><path d="${accIc(r.account)}"/></svg></span>${esc(r.account)}</span><b class="${r.est<0?'neg':''}">${fmt(r.est)}</b></div></div>`).join('')}
      ${rows.length>1?`<div class="catline total"><div class="h"><span>Gesamt</span><b>${fmt(now)}</b></div></div>`:''}</div>
      <button class="btn sec" id="h-abgleich">Kontostand abgleichen</button>`;
  }
  const next=bookingsBetween(t, addDays(t,45)).slice(0,5);
  if(next.length) html += `<div class="sect"><h2>Nächste Buchungen</h2><button class="link" id="h-more">Alle</button></div><div class="card list">${next.map(u=>bookRow(u)).join('')}</div>`;
  const w=warnings();
  if(w.length) html += `<h2>Hinweise</h2><div class="card list">${w.map((x,i)=>`<div class="catline warn chev" data-w="${i}"><div class="h"><span>${esc(x.txt)}</span><b></b></div></div>`).join('')}</div>`;
  const md=monthData(ym(t));
  html += `<h2>${mLabel(ym(t),true)}</h2><div class="card list" id="h-month">
    <div class="catline chev"><div class="h"><span>Einnahmen</span><b class="pos">${fmt(md.inc)}</b></div></div>
    <div class="catline chev"><div class="h"><span>Ausgaben</span><b>${fmt(md.total)}</b></div></div>
    <div class="catline chev"><div class="h"><span>Bilanz Monat</span><b class="${md.left>=0?'pos':'neg'}">${fmt(md.left)}</b></div></div></div>`;
  $('#home').innerHTML=html;
  if($('#h-items')) $('#h-items').onclick=()=>{ let run=now;
    $('#sheet').innerHTML=`<h3>Bis ${pd.name?'zum Gehalt am ':''}${dDE(pd.date).slice(0,6)}</h3><div class="sub">Start: ${fmt(now)} auf allen Konten · am Ende frei: ${fmt(free)}</div><div class="card list" style="margin-top:14px">${items.map(x=>{ run+=x.amount; return bookRow(x,run); }).join('')}</div>
      <div class="sub" style="margin:12px 4px 0;font-size:13px">Was du ab heute zusätzlich ausgibst, ist hier noch nicht abgezogen.</div>`;
    openSheet(); };
  if($('#h-more')) $('#h-more').onclick=()=>goFin('acc');
  if($('#h-firstbal')) $('#h-firstbal').onclick=()=>editBalance();
  if($('#h-abgleich')) $('#h-abgleich').onclick=()=>editBalance(rows[0]?.account);
  document.querySelectorAll('#home .catline[data-acc]').forEach(el=>el.onclick=()=>editBalance(el.dataset.acc));
  document.querySelectorAll('#home .catline[data-w]').forEach(el=>el.onclick=()=>w[+el.dataset.w].fn());
  document.querySelectorAll('#h-month .catline').forEach(el=>el.onclick=()=>{ statMonth=ym(t); show('stats'); });
}
function renderFix(){
  const t=today();
  const rows = balRows(t);
  const totalEst = rows.reduce((a,r)=>a+r.est,0);
  $('#balance').innerHTML = `<div class="card" style="padding:6px 16px">${rows.length ? rows.map(r=>`<div class="catline chev" data-acc="${esc(r.account)}"><div class="h"><span>${esc(r.account)}</span><b>${fmt(r.est)}</b></div>
      <div class="sub" style="font-size:13px">Eingetragen am ${dDE(r.date)}: ${fmt(r.amount)}${r.mv.parts.length?' · seitdem '+r.mv.parts.map(([l,v])=>`${l} <span class="${v>=0?'pos':'neg'}">${v>=0?'+':'−'}${fmt(Math.abs(v))}</span>`).join(', '):''}</div></div>`).join('')
      + (rows.length>1?`<div class="catline"><div class="h"><span class="muted">Gesamt</span><b>${fmt(totalEst)}</b></div></div>`:'')
      : '<div class="empty" style="padding:12px">Noch kein Kontostand eingetragen.</div>'}</div>
    <button class="btn sec" id="newbal">Kontostand abgleichen oder neues Konto</button>`;
  $('#newbal').onclick=()=>editBalance();
  document.querySelectorAll('#balance .catline[data-acc]').forEach(el=>el.onclick=()=>editBalance(el.dataset.acc));
  const up = bookingsBetween(t, addDays(t,45)).slice(0,12);
  $('#upcoming').innerHTML = up.length ? `<div class="card list">${up.map(u=>bookRow(u)).join('')}</div>` : '<div class="empty" style="padding:12px">Trag bei Fixkosten und festen Einnahmen einen Tag ein, dann siehst du hier die nächsten Buchungen.</div>';
  const totalOpen = DEBTS.reduce((a,d)=>a+SIM[d.id].remaining,0);
  $('#debtsum').textContent = DEBTS.length ? 'offen gesamt '+fmt(totalOpen) : '';
  const soon = addDays(today(),14);
  $('#debts').innerHTML = DEBTS.length ? DEBTS.filter(d=>SIM[d.id].remaining>0.005).concat(DEBTS.filter(d=>SIM[d.id].remaining<=0.005)).map(d=>{ const s=SIM[d.id]; const base=s.total+s.borrowed+s.interest; const pct=base?Math.min(100,s.paid/base*100):0;
    const end = s.monthsLeft ? mLabel(addM(ym(today()),s.monthsLeft),true) : null;
    const open = s.remaining>0.005;
    const dueTxt = d.due && open ? `<span class="${d.due<=soon?'duesoon':''}">fällig ${dDE(d.due)}</span>` : '';
    const bits = [ `${fmt(s.paid)} von ${fmt(base)} getilgt`, +d.rate?'Rate '+fmt(d.rate)+'/Monat'+(d.day?' am '+d.day+'.':'')+(d.rateStart&&d.rateStart>ym(today())?' ab '+mLabel(d.rateStart)+' '+d.rateStart.slice(2,4):'')+(d.account?' vom '+d.account:''):'', +d.interest?String(d.interest).replace('.',',')+' % Zinsen p.a.'+(s.interest?' (bisher '+fmt(s.interest)+')':''):'', end&&open?'schuldenfrei ca. '+end:'' ].filter(Boolean).join(' · ');
    return `<div class="card debt" data-id="${esc(d.id)}" style="cursor:pointer"><div class="h"><b>${esc(d.name)}</b><span class="${open?'':'muted'}">${open?'offen '+fmt(s.remaining):'abbezahlt'}</span></div>
      <div class="bar"><i style="width:${pct}%;background:var(--accent)"></i></div>
      <div class="sub" style="margin-top:8px">${dueTxt}${dueTxt&&bits?' · ':''}${bits}</div>${d.note?`<div class="sub" style="margin-top:4px">${esc(d.note)}</div>`:''}</div>`; }).join('') : '<div class="empty">Keine Schulden angelegt.</div>';
  document.querySelectorAll('#debts .debt').forEach(el=>el.onclick=()=>editDebt(el.dataset.id));
  const byDay = arr => arr.slice().sort((a,b)=>(+a.day||99)-(+b.day||99));
  const list=(arr,empty,cls)=>{ const sum=arr.filter(f=>f.active!==false).reduce((a,f)=>a+(+f.amount||0),0);
    return arr.length ? `<div class="card" style="padding:6px 16px">${byDay(arr).map(f=>`<div class="catline" data-id="${esc(f.id)}"><div class="h"><span>${f.kind==='income'?ico('in','#10b981','sm'):ico(f.cat,null,'sm')}<span class="nm">${esc(f.name)}</span></span><b class="${cls}">${fmt(f.amount)}</b></div>
      <div class="sub" style="font-size:13px;margin-left:44px">${[f.day?'am '+f.day+'.':'ohne Tag (zählt nicht im Kontostand)', f.account||'', f.end?'bis '+mLabel(f.end)+' '+f.end.slice(2,4):''].filter(Boolean).join(' · ')}</div></div>`).join('')}<div class="catline"><div class="h"><span class="muted">Summe pro Monat</span><b class="${cls}">${fmt(sum)}</b></div></div></div>` : `<div class="empty">${empty}</div>`; };
  $('#fixedin').innerHTML = list(FIXIN,'Noch keine festen Einnahmen. Zum Beispiel Gehalt als Werkstudent.','pos');
  $('#fixed').innerHTML = list(FIX,'Noch keine Fixkosten. Typisch: Miete, Handyvertrag, Fitnessstudio, Streaming, Versicherungen.','');
  document.querySelectorAll('#fixed .catline[data-id]').forEach(el=>el.onclick=()=>editFixed(el.dataset.id,'expense'));
  document.querySelectorAll('#fixedin .catline[data-id]').forEach(el=>el.onclick=()=>editFixed(el.dataset.id,'income'));
}
function addDays(d,n){ const x=new Date(d+'T12:00'); x.setDate(x.getDate()+n); return x.toISOString().slice(0,10); }
$('#addfix').onclick=()=>editFixed(null,'expense');
$('#addfixin').onclick=()=>editFixed(null,'income');
$('#adddebt').onclick=()=>editDebt(null);

const accountField = (id, val) => `<label class="l">Konto</label><select id="${id}">${accounts().map(a=>`<option ${a===val?'selected':''}>${esc(a)}</option>`).join('')}<option value="__new">Neues Konto …</option></select><input type="text" id="${id}-new" class="hidden" placeholder="Name des Kontos, z. B. Sparkonto" style="margin-top:8px">`;
const wireAccount = id => { $('#'+id).onchange=()=>{ $('#'+id+'-new').classList.toggle('hidden', $('#'+id).value!=='__new'); if($('#'+id).value==='__new') $('#'+id+'-new').focus(); }; };
const readAccount = id => $('#'+id).value==='__new' ? ($('#'+id+'-new').value.trim()||'Konto') : $('#'+id).value;

function editBalance(acc){
  const curFor = (ac, date) => { const b=BALS.find(x=>x.account===ac); if(!b || date<b.date) return null; return {b, est:(+b.amount||0)+movements(b,date).total}; };
  $('#sheet').innerHTML=`<h3>Kontostand abgleichen</h3>
    <div class="sub">Schau in deine Banking-App und trag den echten Stand ein. Ab hier rechnet die App weiter.</div>
    ${accountField('b-acc', acc||DEFAULT_ACCOUNTS[0])}
    <div id="b-cur" class="diff hidden"></div>
    <label class="l">Echter Stand laut Bank (€)</label><input type="text" id="b-amt" inputmode="decimal" placeholder="z. B. 1234,56">
    <label class="l">Stand vom</label><input type="date" id="b-date" value="${today()}">
    <div id="b-diff" class="diff hidden"></div>
    <button class="btn hidden" id="b-book"></button>
    <button class="btn" id="b-save">Stand übernehmen</button>${delRow(false)}`;
  wireAccount('b-acc');
  const upd = () => {
    const ac=readAccount('b-acc'), date=$('#b-date').value||today(), cur=curFor(ac,date), a=parseAmt($('#b-amt').value);
    $('#b-cur').classList.toggle('hidden',!cur);
    if(cur) $('#b-cur').innerHTML=`App rechnet: <b>${fmt(cur.est)}</b><div class="sub" style="font-size:13px">zuletzt eingetragen am ${dDE(cur.b.date)}: ${fmt(cur.b.amount)}</div>`;
    const diff = cur && isFinite(a) ? Math.round((a-cur.est)*100)/100 : 0;
    $('#b-diff').classList.toggle('hidden',!diff); $('#b-book').classList.toggle('hidden',!diff);
    $('#b-save').classList.toggle('sec',!!diff);
    if(diff){
      $('#b-diff').innerHTML = diff<0 ? `Differenz: <b class="neg">−${fmt(-diff)}</b><div class="sub" style="font-size:13px">Du hast weniger als berechnet, vermutlich nicht erfasste Ausgaben.</div>`
                                      : `Differenz: <b class="pos">+${fmt(diff)}</b><div class="sub" style="font-size:13px">Du hast mehr als berechnet, vermutlich nicht erfasste Einnahmen.</div>`;
      $('#b-book').textContent = diff<0 ? `${fmt(-diff)} als Ausgabe buchen und übernehmen` : `${fmt(diff)} als Einnahme buchen und übernehmen`;
      $('#b-save').textContent='Nur Stand übernehmen';
    } else $('#b-save').textContent='Stand übernehmen';
    return {ac,date,a,diff};
  };
  ['b-amt','b-date'].forEach(k=>$('#'+k).addEventListener('input',upd)); $('#b-acc').addEventListener('change',upd); upd();
  $('#x-cancel').onclick=closeSheet;
  const saveBal = ({ac,date,a}) => put('balances',{id:uid(), amount:a, date, note:'', account:ac});
  $('#b-save').onclick=()=>{ const v=upd(); if(!isFinite(v.a)) return toast('Betrag prüfen'); saveBal(v); closeSheet(); toast('Gespeichert'); };
  $('#b-book').onclick=()=>{ const v=upd(); if(!isFinite(v.a)||!v.diff) return;
    if(v.diff<0) put('expenses',{id:uid(), amount:-v.diff, cat:'sonstiges', sub:'', note:'Nicht erfasst (Abgleich)', date:v.date, debtId:'', account:v.ac});
    else put('income',{id:uid(), amount:v.diff, source:'Sonstiges', note:'Nicht erfasst (Abgleich)', date:v.date, account:v.ac});
    saveBal(v); closeSheet(); toast('Gebucht und gespeichert'); };
  openSheet(); $('#b-amt').focus();
}

function editFixed(id, kind){
  const isIn = kind==='income';
  const f = id ? {...S.fixed[id]} : {id:uid(),name:'',amount:'',cat:isIn?'einnahme':'wohnen',sub:isIn?'':'Miete',start:ym(today()),end:'',active:true,kind,day:'',account:DEFAULT_ACCOUNTS[0]};
  let cat=f.cat;
  const draw=()=>{
    const c=CAT[cat];
    $('#sheet').innerHTML=`<h3>${id?(isIn?'Feste Einnahme bearbeiten':'Fixkosten bearbeiten'):(isIn?'Neue feste Einnahme':'Neue Fixkosten')}</h3>
      <label class="l">Name</label><input type="text" id="f-name" value="${esc(f.name)}" placeholder="${isIn?'z. B. Gehalt Westenergie':'z. B. Miete, Handy, Fitnessstudio'}">
      <div class="row"><div><label class="l">Betrag pro Monat (€)</label><input type="text" id="f-amt" inputmode="decimal" value="${esc(numIn(f.amount))}"></div>
      <div style="flex:0 0 110px"><label class="l">Am Tag</label><input type="number" id="f-day" min="1" max="31" inputmode="numeric" placeholder="z. B. 20" value="${esc(f.day||'')}"></div></div>
      ${accountField('f-acc', f.account||DEFAULT_ACCOUNTS[0])}
      ${isIn?'':`<label class="l">Kategorie</label><select id="f-cat">${CATS.filter(x=>x.id!=='schulden').map(x=>`<option value="${x.id}" ${x.id===cat?'selected':''}>${esc(x.name)}</option>`).join('')}</select>
      ${c&&c.subs.length?`<label class="l">Unterkategorie</label><select id="f-sub">${c.subs.map(s=>`<option ${s===f.sub?'selected':''}>${esc(s)}</option>`).join('')}</select>`:''}`}
      <div class="row"><div><label class="l">Ab Monat</label><input type="month" id="f-start" value="${esc(f.start||'')}"></div><div><label class="l">Bis Monat (optional)</label><input type="month" id="f-end" value="${esc(f.end||'')}"></div></div>
      <button class="btn" id="f-save">Speichern</button>${delRow(!!id)}`;
    wireAccount('f-acc');
    const keep=()=>{ f.name=$('#f-name').value; f.amount=$('#f-amt').value; f.day=$('#f-day').value; f.start=$('#f-start').value; f.end=$('#f-end').value; f.account=readAccount('f-acc'); };
    if($('#f-cat')) $('#f-cat').onchange=ev=>{ keep(); cat=ev.target.value; f.sub=CAT[cat].subs[0]||''; draw(); };
    wireSheet('fixed',id);
    $('#f-save').onclick=()=>{ const a=parseAmt($('#f-amt').value), n=$('#f-name').value.trim(); const dy=parseInt($('#f-day').value,10);
      if(!n||!(a>0)) return toast('Name und Betrag angeben');
      if($('#f-day').value && !(dy>=1&&dy<=31)) return toast('Tag zwischen 1 und 31');
      put('fixed', {...f, name:n, amount:a, cat, sub:$('#f-sub')?$('#f-sub').value:'', start:$('#f-start').value||ym(today()), end:$('#f-end').value||'', active:true, kind, day:dy||'', account:readAccount('f-acc')});
      closeSheet(); toast('Gespeichert'); };
  };
  draw(); openSheet();
}

function editDebt(id){
  const d = id ? {...S.debts[id]} : {id:uid(),name:'',total:'',rate:'',start:ym(today()),interest:'',due:'',note:'',rateStart:'',day:'',account:''};
  const s = id ? SIM[id] : null;
  $('#sheet').innerHTML=`<h3>${id?esc(d.name):'Neue Schulden'}</h3>
    ${s?`<div class="card" style="margin-top:10px"><div class="sub" style="font-size:13px">Offen heute</div><div style="font-size:34px;font-weight:700;font-variant-numeric:tabular-nums" class="${s.remaining>0.005?'neg':''}">${fmt(s.remaining)}</div>
      <div class="sub" style="font-size:13px">Start ${fmt(s.total)}${s.borrowed?' + neu geliehen '+fmt(s.borrowed):''}${s.interest?' + Zinsen '+fmt(s.interest):''} − getilgt ${fmt(s.paid)}</div></div>
    <h2>Zahlung erfassen</h2>
    <div class="row"><div><label class="l" style="margin-top:0">Betrag (€)</label><input type="text" id="d-pay" inputmode="decimal" placeholder="z. B. 100"></div>
    <div><label class="l" style="margin-top:0">Datum</label><input type="date" id="d-pdate" value="${today()}"></div></div>
    ${accountField('d-pacc', S.prefs.accOut||'Alltagskonto')}
    <div class="row"><button class="btn" id="d-paybtn">Zurückgezahlt</button><button class="btn sec" id="d-borrowbtn">Neu geliehen</button></div>
    <button class="btn sec" id="d-histbtn">Verlauf Monat für Monat</button>
    <div id="d-hist" class="hidden" style="margin-top:10px"></div>
    <button class="btn sec" id="d-editbtn">Einstellungen bearbeiten</button>`:''}
    <div id="d-settings" class="${s?'hidden':''}">
    ${s?'<h2>Einstellungen</h2>':''}
    <label class="l">Bezeichnung</label><input type="text" id="d-name" value="${esc(d.name)}" placeholder="z. B. Sebastian, PayPal, Krankenkasse">
    <div class="row"><div><label class="l">Offener Betrag zum Start (€)</label><input type="text" id="d-total" inputmode="decimal" value="${esc(numIn(d.total))}"></div>
    <div><label class="l">Stand vom (Monat)</label><input type="month" id="d-start" value="${esc(d.start||'')}"></div></div>
    <label class="l">Zinsen % pro Jahr (optional)</label><input type="text" id="d-int" inputmode="decimal" value="${+d.interest?esc(numIn(d.interest)):''}">
    <h2 style="margin-top:16px">Monatliche Tilgung (optional)</h2>
    <div class="row"><div><label class="l">Rate pro Monat (€)</label><input type="text" id="d-rate" inputmode="decimal" value="${+d.rate?esc(numIn(d.rate)):''}" placeholder="z. B. 150"></div>
    <div style="flex:0 0 110px"><label class="l">Am Tag</label><input type="number" id="d-day" min="1" max="31" inputmode="numeric" placeholder="z. B. 21" value="${esc(d.day||'')}"></div></div>
    <div class="row"><div><label class="l">Ab Monat</label><input type="month" id="d-rs" value="${esc(d.rateStart||addM(ym(today()),1))}"></div><div>${accountField('d-acc', d.account||DEFAULT_ACCOUNTS[0])}</div></div>
    <label class="l">Fällig bis (optional)</label><input type="date" id="d-due" value="${esc(d.due||'')}">
    <label class="l">Notiz</label><input type="text" id="d-note" value="${esc(d.note||'')}">
    <div class="sub" style="margin-top:10px">Die Rate wird ab dem gewählten Monat jeden Monat am Tag X vom Konto abgezogen, senkt die Schulden und zählt bei „Frei bis Gehalt“ mit. Einzelne Sonderzahlungen trägst du oben bei „Zahlung erfassen“ ein.</div>
    <button class="btn" id="d-save">Speichern</button>${delRow(!!id)}
    </div>
    ${s?'<button class="btn sec" id="d-close">Fertig</button>':''}`;
  wireAccount('d-acc');
  wireSheet('debts',id);
  if($('#d-close')) $('#d-close').onclick=closeSheet;
  if($('#d-editbtn')) $('#d-editbtn').onclick=()=>{ $('#d-settings').classList.remove('hidden'); $('#d-editbtn').classList.add('hidden'); $('#d-close').classList.add('hidden'); $('#d-name').scrollIntoView({behavior:'smooth',block:'center'}); };
  if(s){
    wireAccount('d-pacc');
    $('#d-paybtn').onclick=()=>{ const a=parseAmt($('#d-pay').value); if(!(a>0)) return toast('Betrag prüfen');
      put('expenses',{id:uid(), amount:a, cat:'schulden', sub:'Rückzahlung', note:d.name, date:$('#d-pdate').value||today(), debtId:d.id, account:readAccount('d-pacc')}); closeSheet(); toast(fmt(a)+' zurückgezahlt'); };
    $('#d-borrowbtn').onclick=()=>{ const a=parseAmt($('#d-pay').value); if(!(a>0)) return toast('Betrag prüfen');
      put('income',{id:uid(), amount:a, source:'Darlehen', note:d.name, date:$('#d-pdate').value||today(), debtId:d.id, account:readAccount('d-pacc')}); closeSheet(); toast(fmt(a)+' als geliehen eingetragen'); };
    $('#d-histbtn').onclick=()=>{ const el=$('#d-hist'); el.classList.toggle('hidden'); if(el.innerHTML) return;
      const ev=[...EXP.filter(e=>e.debtId===d.id).map(e=>({date:e.date,txt:'zurückgezahlt',a:-e.amount})), ...INC.filter(e=>e.debtId===d.id).map(e=>({date:e.date,txt:'neu geliehen',a:e.amount}))].sort((x,y)=>x.date.localeCompare(y.date));
      el.innerHTML = `<div class="card" style="padding:6px 12px;font-size:13px">${s.hist.slice().reverse().filter(h=>h.borrowed||h.rate||h.extra||h.interest||h.m===s.hist[0].m||h.m===ym(today())).map(h=>`<div class="catline"><div class="h"><span><b>${mLabel(h.m,true)}</b></span><b>${fmt(h.end)}</b></div>
        <div class="sub" style="font-size:12px">Anfang ${fmt(h.start)}${h.borrowed?' · neu geliehen +'+fmt(h.borrowed):''}${h.rate?' · Rate −'+fmt(h.rate):''}${h.extra?' · zurückgezahlt −'+fmt(h.extra):''}${h.interest?' · Zinsen +'+fmt(h.interest):''}</div></div>`).join('')}</div>
        ${ev.length?`<div class="sub" style="margin-top:6px">Einzelne Zahlungen: ${ev.map(x=>dDE(x.date)+' '+x.txt+' '+fmt(Math.abs(x.a))).join(' · ')}</div>`:''}`; };
  }
  $('#d-save').onclick=()=>{ const t=parseAmt($('#d-total').value), r=$('#d-rate').value.trim()?parseAmt($('#d-rate').value):0, z=$('#d-int').value.trim()?parseAmt($('#d-int').value):0, n=$('#d-name').value.trim();
    if(!n||!(t>0)||!(r>=0)||!(z>=0)) return toast('Bezeichnung und Betrag angeben');
    const dy=parseInt($('#d-day').value,10);
    if(r && !(dy>=1&&dy<=31)) return toast('Für die Rate einen Tag zwischen 1 und 31 angeben');
    put('debts', {...d, name:n, total:t, rate:r||0, interest:z||0, start:$('#d-start').value||ym(today()), due:$('#d-due').value||'', note:$('#d-note').value.trim(), rateStart:r?($('#d-rs').value||addM(ym(today()),1)):'', day:r?dy:'', account:r?readAccount('d-acc'):''});
    closeSheet(); toast('Gespeichert'); };
  openSheet();
}

/* ---------- Handel ---------- */
$('#addtrade').onclick=()=>editTrade(null);
function renderTrades(){
  const sold = TRADES.filter(t=>t.sellDate), open = TRADES.filter(t=>!t.sellDate);
  const sum = sold.reduce((a,t)=>a+tradeProfit(t),0);
  const mon = sold.filter(t=>ym(t.sellDate)===ym(today())).reduce((a,t)=>a+tradeProfit(t),0);
  const stock = open.reduce((a,t)=>a+(+t.buyPrice||0)+(+t.buyCosts||0),0);
  $('#tsum').innerHTML = `<span class="${sum>=0?'pos':'neg'}">${fmt(sum)}</span>`;
  $('#tmonth').innerHTML = `<span class="${mon>=0?'pos':'neg'}">${fmt(mon)}</span>`;
  $('#tstock').textContent = fmt(stock);
  const row = t => { const p=tradeProfit(t); return `<div class="item" data-id="${esc(t.id)}">${ico('trade', t.sellDate?(p>=0?'#10b981':'#f43f5e'):'#64748b')}<div class="t"><b>${esc(t.item||'Artikel')}</b><span>${t.type==='comm'?`Provision ${dDE(t.sellDate)}${t.sellAccount?' · '+esc(t.sellAccount):''}`:t.sellDate?`verkauft ${dDE(t.sellDate)} für ${fmt(t.sellPrice)}${t.sellAccount?' · '+esc(t.sellAccount):''}`:`gekauft ${dDE(t.buyDate)} für ${fmt((+t.buyPrice||0)+(+t.buyCosts||0))}${t.buyAccount?' · '+esc(t.buyAccount):''}`}</span></div><div class="a ${t.sellDate?(p>=0?'pos':'neg'):''}">${t.sellDate?(p>=0?'+':'')+fmt(p):fmt(+t.buyPrice||0)}</div></div>`; };
  $('#tradesopen').innerHTML = open.length ? open.map(row).join('') : '<div class="empty">Nichts im Lager.</div>';
  $('#tradesdone').innerHTML = sold.length ? sold.map(row).join('') : '<div class="empty">Noch nichts verkauft.</div>';
  document.querySelectorAll('#v-trade .item').forEach(el=>el.onclick=()=>editTrade(el.dataset.id));
}
function editTrade(id, kind){
  const t = id ? {...S.trades[id]} : {id:uid(),type:kind||'own',item:'',buyDate:today(),buyPrice:'',buyCosts:'',sellDate:kind==='comm'?today():'',sellPrice:'',fees:'',note:'',buyAccount:S.prefs.tradeBuy??'',sellAccount:S.prefs.tradeSell||S.prefs.accOut||'Alltagskonto'};
  const comm = t.type==='comm';
  const val = k => { const v=$('#'+k).value.trim(); return v?parseAmt(v):0; };
  if(comm){
    $('#sheet').innerHTML=`<h3>${id?'Provision bearbeiten':'Provision erfassen'}</h3>
      <div class="sub">Jemand anderes hat gekauft und verkauft, du bekommst nur deine Provision.</div>
      <label class="l">Artikel</label><input type="text" id="t-item" value="${esc(t.item)}" placeholder="z. B. iPad Air 5 für Max">
      <div class="row"><div><label class="l">Provision (€)</label><input type="text" id="t-sp" inputmode="decimal" value="${esc(numIn(t.sellPrice))}"></div><div><label class="l">Datum</label><input type="date" id="t-sd" value="${esc(t.sellDate||today())}"></div></div>
      ${accountField('t-sacc', t.sellAccount||'Alltagskonto').replace('>Konto<','>Eingegangen auf<')}
      <label class="l">Eigene Kosten (€, optional, z. B. Versand)</label><input type="text" id="t-fe" inputmode="decimal" value="${+t.fees?esc(numIn(t.fees)):''}">
      <label class="l">Notiz</label><input type="text" id="t-note" value="${esc(t.note||'')}">
      <button class="btn" id="t-save">Speichern</button>${delRow(!!id)}`;
    wireAccount('t-sacc'); wireSheet('trades',id);
    $('#t-save').onclick=()=>{ const item=$('#t-item').value.trim(), sp=val('t-sp');
      if(!item||!(sp>0)) return toast('Artikel und Provision angeben');
      put('trades',{...t, type:'comm', item, buyDate:'', buyPrice:0, buyCosts:0, sellDate:$('#t-sd').value||today(), sellPrice:sp, fees:val('t-fe')||0, note:$('#t-note').value.trim(), buyAccount:'', sellAccount:readAccount('t-sacc')});
      closeSheet(); toast('Gespeichert'); };
    openSheet(); return;
  }
  $('#sheet').innerHTML=`<h3>${id?esc(t.item):'Ankauf erfassen'}</h3>
    <label class="l">Artikel</label><input type="text" id="t-item" value="${esc(t.item)}" placeholder="z. B. iPad Air 5, 64 GB, blau">
    <h2 style="margin-top:16px">Ankauf</h2>
    <div class="row"><div><label class="l">Datum</label><input type="date" id="t-bd" value="${esc(t.buyDate||'')}"></div><div><label class="l">Preis (€)</label><input type="text" id="t-bp" inputmode="decimal" value="${esc(numIn(t.buyPrice))}"></div></div>
    <label class="l">Nebenkosten Ankauf (€, z. B. Versand, Fahrt)</label><input type="text" id="t-bc" inputmode="decimal" value="${esc(numIn(t.buyCosts))}">
    ${accountField('t-bacc', t.buyAccount||'').replace('>Konto<','>Bezahlt von<')}
    <h2 style="margin-top:16px">Verkauf</h2>
    <div class="row"><div><label class="l">Datum</label><input type="date" id="t-sd" value="${esc(t.sellDate||'')}"></div><div><label class="l">Preis (€)</label><input type="text" id="t-sp" inputmode="decimal" value="${esc(numIn(t.sellPrice))}"></div></div>
    ${accountField('t-sacc', t.sellAccount||'').replace('>Konto<','>Geld eingegangen auf<')}
    <div id="t-repaybox" class="card" style="padding:10px 14px;margin-top:10px">
      <label style="display:flex;gap:10px;align-items:center;font-size:15px"><input type="checkbox" id="t-repay" style="width:22px;height:22px" ${t.repay===false?'':'checked'}> <span>Geldgeber zurückzahlen (<b id="t-repayamt"></b>)</span></label>
      <div class="sub" style="font-size:13px;margin-top:4px">Der Ankauf wurde nicht von deinem Konto bezahlt. Den Ankaufpreis gibst du beim Verkauf zurück.</div>
    </div>
    <label class="l">Provision / Danke an Mitkäufer (€)</label><input type="text" id="t-pf" inputmode="decimal" value="${+t.partnerFee?esc(numIn(t.partnerFee)):''}" placeholder="z. B. 20">
    <label class="l">Gebühren (€, z. B. Versand, Plattform)</label><input type="text" id="t-fe" inputmode="decimal" value="${+t.fees?esc(numIn(t.fees)):''}">
    <label class="l">Notiz</label><input type="text" id="t-note" value="${esc(t.note||'')}">
    <div class="sub" id="t-profit" style="margin-top:12px"></div>
    <button class="btn" id="t-save">Speichern</button>${delRow(!!id)}`;
  // alte Einträge ohne Konto: Feld leer lassen = kein Kontoeffekt
  $('#t-bacc').insertAdjacentHTML('afterbegin','<option value="">nicht von meinem Konto</option>'); if(!t.buyAccount) $('#t-bacc').value='';
  if(!t.sellAccount){ $('#t-sacc').insertAdjacentHTML('afterbegin','<option value="">kein Konto</option>'); $('#t-sacc').value=''; }
  wireAccount('t-bacc'); wireAccount('t-sacc');
  const calc = () => { const sp=val('t-sp'), mine=!!$('#t-bacc').value && $('#t-bacc').value!=='__new' || $('#t-bacc').value==='__new';
    $('#t-repaybox').classList.toggle('hidden', mine); $('#t-repayamt').textContent=fmt(val('t-bp'));
    const rep = !mine && $('#t-repay').checked ? val('t-bp') : 0;
    const p=sp-val('t-bp')-val('t-bc')-val('t-fe')-val('t-pf'), cash=sp-val('t-fe')-val('t-pf')-rep;
    $('#t-profit').innerHTML = sp ? `Gewinn: <b class="${p>=0?'pos':'neg'}">${fmt(p)}</b> · aufs Konto: <b>${fmt(cash)}</b>` : `Eingesetzt: <b>${fmt(val('t-bp')+val('t-bc'))}</b>`; };
  ['t-bp','t-bc','t-sp','t-fe','t-pf'].forEach(k=>$('#'+k).addEventListener('input',calc)); $('#t-bacc').addEventListener('change',calc); $('#t-repay').addEventListener('change',calc); calc();
  $('#t-sp').addEventListener('input',()=>{ if($('#t-sp').value.trim() && !$('#t-sd').value) $('#t-sd').value=today(); });
  wireSheet('trades',id);
  $('#t-save').onclick=()=>{ const item=$('#t-item').value.trim(); const bp=val('t-bp');
    if(!item||!(bp>=0)) return toast('Artikel und Ankaufpreis angeben');
    const sp=val('t-sp');
    S.prefs.tradeBuy=readAccount('t-bacc'); if(readAccount('t-sacc')) S.prefs.tradeSell=readAccount('t-sacc');
    put('trades',{...t, type:'own', item, buyDate:$('#t-bd').value||today(), buyPrice:bp, buyCosts:val('t-bc')||0, sellDate:sp?($('#t-sd').value||today()):'', sellPrice:sp||'', fees:val('t-fe')||0, partnerFee:val('t-pf')||0, repay:readAccount('t-bacc')?false:$('#t-repay').checked, note:$('#t-note').value.trim(), buyAccount:readAccount('t-bacc'), sellAccount:readAccount('t-sacc')});
    closeSheet(); toast('Gespeichert'); };
  openSheet();
}

/* ---------- Auswertung ---------- */
$('#mprev').onclick=()=>{ statMonth=addM(statMonth,-1); renderStats(); };
$('#mnext').onclick=()=>{ statMonth=addM(statMonth,1); renderStats(); };
function renderStats(){
  const m=statMonth, d=monthData(m), nowM=ym(today());
  $('#mlabel').textContent = mLabel(m,true);
  $('#kin').textContent = fmt(d.inc);
  $('#mtotal').textContent = fmt(d.total);
  $('#kleft').innerHTML = `<span class="${d.left>=0?'pos':'neg'}">${fmt(d.left)}</span>`;
  $('#kvar').textContent = fmt(d.v);
  $('#kfix').textContent = fmt(d.f);
  const food = d.vars.filter(e=>e.cat==='essen').reduce((a,e)=>a+e.amount,0) + d.fx.filter(x=>x.cat==='essen').reduce((a,x)=>a+x.amount,0);
  $('#kfood').textContent = fmt(food);
  const dim = daysIn(m);
  if(m===nowM){
    const day = +today().slice(8,10), rest = dim-day+1;
    $('#kday').innerHTML = `Bisher ${fmt(d.v/day)} pro Tag ausgegeben (variabel). „Bilanz Monat“ heißt: alle Einnahmen minus alle Ausgaben, feste Buchungen schon komplett mitgerechnet, auch wenn sie erst später kommen.`;
  } else if(m<nowM){
    $('#kday').innerHTML = `Ø ${fmt(d.v/dim)} pro Tag ausgegeben (variabel), übrig ${fmt(d.left/dim)} pro Tag.`;
  } else $('#kday').textContent='';
  renderFree(m===nowM);
  const prev=[1,2,3].map(i=>monthData(addM(m,-i))).filter(x=>x.vars.length);
  if(prev.length){ const avg=prev.reduce((a,x)=>a+x.v,0)/prev.length; const diff=d.v-avg;
    $('#kcompare').textContent = `Variable Ausgaben ${diff>=0?fmt(diff)+' über':fmt(-diff)+' unter'} dem Schnitt der letzten ${prev.length} Monat${prev.length>1?'e':''} (${fmt(avg)}).`;
  } else $('#kcompare').textContent = '';
  const ms=[5,4,3,2,1,0].map(i=>addM(m,-i)); const md=ms.map(monthData); const max=Math.max(1,...md.map(x=>Math.max(x.total,x.inc)));
  $('#chart').innerHTML = ms.map((mm,i)=>`<div class="c ${mm===m?'on':''}" data-m="${mm}"><em>${md[i].total?Math.round(md[i].total):''}</em><div class="bars"><div class="stack"><i style="height:${md[i].v/max*100}%"></i><i class="fx" style="height:${md[i].f/max*100}%"></i></div><i class="inc" style="height:${md[i].inc/max*100}%"></i></div><small>${mLabel(mm)}</small></div>`).join('');
  document.querySelectorAll('#chart .c').forEach(el=>el.onclick=()=>{ statMonth=el.dataset.m; renderStats(); });
  const by={};
  d.vars.forEach(e=>{ const c=by[e.cat]??={sum:0,subs:{}}; c.sum+=e.amount; const s=e.sub||'Ohne'; c.subs[s]=(c.subs[s]||0)+e.amount; });
  d.fx.forEach(x=>{ const c=by[x.cat]??={sum:0,subs:{}}; c.sum+=x.amount; const s=(x.sub||x.name)+' (fix)'; c.subs[s]=(c.subs[s]||0)+x.amount; });
  const list=Object.entries(by).sort((a,b)=>b[1].sum-a[1].sum);
  $('#bycat').innerHTML = list.length ? list.map(([cid,c])=>{ const cc=CAT[cid]||{name:cid,color:'#999'}; const pct=d.total?c.sum/d.total*100:0;
    const subs=Object.entries(c.subs).sort((a,b)=>b[1]-a[1]);
    return `<div class="catline"><div class="h"><span>${ico(cid,cc.color,'sm')}${esc(cc.name)}</span><b>${fmt(c.sum)} <small class="muted">${Math.round(pct)} %</small></b></div>
      <div class="bar"><i style="width:${pct}%;background:${cc.color}"></i></div>
      ${subs.length>1||(subs[0]&&subs[0][0]!=='Ohne')?`<div class="subs hidden">${subs.map(([s,v])=>`<div><span>${esc(s)}</span><span>${fmt(v)}</span></div>`).join('')}</div>`:''}</div>`; }).join('')
    : '<div class="empty">Keine Ausgaben in diesem Monat.</div>';
  document.querySelectorAll('#bycat .catline').forEach(el=>el.onclick=()=>{ const s=el.querySelector('.subs'); if(s) s.classList.toggle('hidden'); });
  const ib={};
  d.incs.forEach(e=>{ const k=e.source||'Sonstiges'; ib[k]=(ib[k]||0)+e.amount; });
  d.fxin.forEach(x=>{ const k=x.name+' (fest)'; ib[k]=(ib[k]||0)+x.amount; });
  if(d.tp) ib['Handel (Gewinn)']=d.tp;
  const il=Object.entries(ib).sort((a,b)=>b[1]-a[1]);
  $('#byinc').innerHTML = il.length ? il.map(([k,v])=>`<div class="catline"><div class="h"><span>${ico('in','#10b981','sm')}${esc(k)}</span><b class="${v>=0?'pos':'neg'}">${fmt(v)}</b></div></div>`).join('') : '<div class="empty">Keine Einnahmen in diesem Monat.</div>';
}
$('#export').onclick=exportCsv;

/* ---------- Sheet-Dialog ---------- */
function openSheet(){
  const sh=$('#sheet');
  if(!sh.querySelector('.sheet-top')) sh.insertAdjacentHTML('afterbegin','<div class="sheet-top"><span class="grab"></span><button class="sheet-x" type="button" aria-label="Schließen"><svg viewBox="0 0 24 24"><path d="M7 7l10 10M17 7L7 17"/></svg></button></div>');
  sh.querySelector('.sheet-x').onclick=closeSheet;
  sh.style.transform=''; sh.scrollTop=0; $('#ov').classList.add('show');
}
function closeSheet(){ $('#ov').classList.remove('show'); $('#sheet').style.transform=''; }
document.addEventListener('keydown',e=>{ if(e.key==='Escape') closeSheet(); });
(()=>{ const sh=$('#sheet'); let y0=null, dy=0;
  sh.addEventListener('touchstart',e=>{ y0 = sh.scrollTop<=0 ? e.touches[0].clientY : null; dy=0; },{passive:true});
  sh.addEventListener('touchmove',e=>{ if(y0==null) return; dy=e.touches[0].clientY-y0; if(dy>0){ sh.style.transition='none'; sh.style.transform=`translateY(${dy}px)`; } },{passive:true});
  sh.addEventListener('touchend',()=>{ if(y0==null) return; sh.style.transition=''; if(dy>110) closeSheet(); else sh.style.transform=''; y0=null; });
})();
$('#ov').addEventListener('click',e=>{ if(e.target.id==='ov') closeSheet(); });

/* ---------- Render & Start ---------- */
function render(){
  renderCats(); renderQuick();
  if(!$('#v-home').classList.contains('hidden')) renderHome();
  if(!$('#v-list').classList.contains('hidden')) renderList();
  if(!$('#v-stats').classList.contains('hidden')) renderStats();
  if(!$('#v-trade').classList.contains('hidden')) renderTrades();
  if(!$('#v-fix').classList.contains('hidden')) renderFix();
  status();
}
rebuild(); render(); sync();
if(!S.settings.url && !EXP.length) setTimeout(openSettings, 400);
if('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(()=>{});
