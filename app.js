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
  {id:'schulden', name:'Schulden', color:'#6b7280', subs:['Rate','Rückzahlung']},
  {id:'sonstiges', name:'Sonstiges', color:'#9aa0a6', subs:[]},
];
const SOURCES = ['Gehalt','IT-Aufträge','Verkauf','Erstattung','Geschenk','Sonstiges'];
const TABLE_NAMES = ['expenses','fixed','debts','income','trades','balances'];
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
const blank = () => ({expenses:{},fixed:{},debts:{},income:{},trades:{},balances:{},queue:[],settings:{url:'',token:''},lastSync:0});
let S = (()=>{ try{ const s=JSON.parse(localStorage.getItem(KEY)); if(s) return Object.assign(blank(),s); }catch(e){} return blank(); })();
TABLE_NAMES.forEach(t=>{ if(!S[t]) S[t]={}; });
function persist(){ try{ localStorage.setItem(KEY, JSON.stringify(S)); }catch(e){ toast('Lokales Speichern fehlgeschlagen'); } }
try{ navigator.storage && navigator.storage.persist && navigator.storage.persist(); }catch(e){}

let EXP=[], INC=[], FIX=[], FIXIN=[], DEBTS=[], TRADES=[], BAL=null, SIM={};
const live = o => Object.values(o).filter(x=>!x.deleted);
function rebuild(){
  EXP = live(S.expenses).map(e=>({...e,amount:+e.amount||0})).sort((a,b)=>String(b.date).localeCompare(String(a.date))||(b.updatedAt||0)-(a.updatedAt||0));
  INC = live(S.income).map(e=>({...e,amount:+e.amount||0})).sort((a,b)=>String(b.date).localeCompare(String(a.date))||(b.updatedAt||0)-(a.updatedAt||0));
  const fx = live(S.fixed).sort((a,b)=>(+b.amount||0)-(+a.amount||0));
  FIX = fx.filter(f=>f.kind!=='income'); FIXIN = fx.filter(f=>f.kind==='income');
  DEBTS = live(S.debts).sort((a,b)=>String(a.due||'9999').localeCompare(String(b.due||'9999')));
  TRADES = live(S.trades).sort((a,b)=>String(b.sellDate||b.buyDate).localeCompare(String(a.sellDate||a.buyDate)));
  BAL = live(S.balances).sort((a,b)=>String(b.date).localeCompare(String(a.date))||(b.updatedAt||0)-(a.updatedAt||0))[0]||null;
  SIM = {}; DEBTS.forEach(d=>SIM[d.id]=debtSim(d));
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
  ['add','list','stats','trade','fix'].forEach(x=>$('#v-'+x).classList.toggle('hidden',x!==v));
  window.scrollTo(0,0);
  render();
}

/* ---------- Erfassen ---------- */
$('#date').value = today();
document.querySelectorAll('#mode button').forEach(b=>b.onclick=()=>{ mode=b.dataset.m; renderCats(); renderQuick(); });
function renderCats(){
  document.querySelectorAll('#mode button').forEach(b=>b.classList.toggle('on',b.dataset.m===mode));
  const inc = mode==='in';
  $('#cats').classList.toggle('hidden',inc); $('#subs').classList.toggle('hidden',inc); $('#srcs').classList.toggle('hidden',!inc);
  $('#save').textContent = inc ? 'Einnahme speichern' : 'Speichern';
  $('#note').placeholder = inc ? 'z. B. Westenergie, iPad-Verkauf' : 'z. B. Rewe, Asiamarkt';
  $('#srcs').innerHTML = SOURCES.map(s=>`<button class="chip ${sel.src===s?'on':''}">${esc(s)}</button>`).join('');
  document.querySelectorAll('#srcs .chip').forEach((b,i)=>b.onclick=()=>{ sel.src=SOURCES[i]; renderCats(); });
  $('#cats').innerHTML = CATS.map(c=>`<button class="cat ${sel.cat===c.id?'on':''}" data-c="${c.id}"><span class="dot" style="background:${c.color}"></span>${esc(c.name)}</button>`).join('');
  document.querySelectorAll('#cats .cat').forEach(b=>b.onclick=()=>{ sel.cat=b.dataset.c; sel.sub=CAT[sel.cat].subs[0]||null; renderCats(); });
  const c = CAT[sel.cat];
  $('#subs').innerHTML = c && c.subs.length ? c.subs.map(s=>`<button class="chip ${sel.sub===s?'on':''}">${esc(s)}</button>`).join('') : '';
  document.querySelectorAll('#subs .chip').forEach((b,i)=>b.onclick=()=>{ sel.sub=c.subs[i]; renderCats(); });
  const isDebt = !inc && sel.cat==='schulden';
  $('#debtpick').classList.toggle('hidden', !isDebt);
  if(isDebt){
    const open = DEBTS.filter(d=>SIM[d.id].remaining>0.005);
    $('#debtsel').innerHTML = open.length ? open.map(d=>`<option value="${esc(d.id)}">${esc(d.name)} (offen ${fmt(SIM[d.id].remaining)})</option>`).join('') : '<option value="">Keine offenen Schulden angelegt</option>';
  }
  validate();
}
function validate(){ $('#save').disabled = !((mode==='in' || sel.cat) && parseAmt($('#amt').value)>0); }
$('#amt').addEventListener('input',validate);
$('#amt').addEventListener('keydown',e=>{ if(e.key==='Enter') save(); });
$('#note').addEventListener('keydown',e=>{ if(e.key==='Enter') save(); });
$('#save').onclick = save;

function renderQuick(){
  if(mode==='in'){ $('#quick').innerHTML=''; return; }
  const counts={};
  EXP.slice(0,120).forEach(e=>{ if(e.cat==='schulden') return; const k=e.cat+'|'+(e.sub||'')+'|'+(e.note||'').trim(); counts[k]=(counts[k]||0)+1; });
  const top = Object.entries(counts).filter(([,n])=>n>=2).sort((a,b)=>b[1]-a[1]).slice(0,6);
  $('#quick').innerHTML = top.map(([k])=>{ const [c,s,n]=k.split('|'); return `<button class="chip" data-k="${esc(k)}"><span class="dot" style="background:${CAT[c]?.color||'#999'};display:inline-block;margin-right:6px"></span>${esc(n||s||CAT[c]?.name)}</button>`; }).join('');
  document.querySelectorAll('#quick .chip').forEach(b=>b.onclick=()=>{ const [c,s,n]=b.dataset.k.split('|'); sel.cat=c; sel.sub=s||null; $('#note').value=n; renderCats(); $('#amt').focus(); });
}

function save(){
  const amount = parseAmt($('#amt').value);
  if(!(amount>0)) return;
  if(mode==='in'){
    put('income', { id:uid(), amount, source:sel.src||'Sonstiges', note:$('#note').value.trim(), date:$('#date').value||today() });
    toast('+'+fmt(amount)+' gespeichert');
  } else {
    if(!sel.cat) return;
    const rec = { id:uid(), amount, cat:sel.cat, sub:sel.sub||'', note:$('#note').value.trim(), date:$('#date').value||today(), debtId:'' };
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
  const all = [...EXP.map(e=>({...e,_t:'out'})), ...INC.map(e=>({...e,_t:'in'}))]
    .sort((a,b)=>String(b.date).localeCompare(String(a.date))||(b.updatedAt||0)-(a.updatedAt||0));
  const rows = all.filter(e=>!q || [(e.note||''),(e.sub||''),(e.source||''),e._t==='in'?'einnahme':(CAT[e.cat]?.name||'')].join(' ').toLowerCase().includes(q));
  if(!rows.length){ $('#list').innerHTML = `<div class="empty">${all.length?'Nichts gefunden.':'Noch nichts erfasst.'}</div>`; return; }
  let html='', cur=null, chunk=[];
  const line = e => e._t==='in'
    ? `<div class="item" data-id="${esc(e.id)}" data-t="in"><span class="dot" style="background:var(--pos)"></span><div class="t"><b>${esc(e.note||e.source||'Einnahme')}</b><span>Einnahme · ${esc(e.source||'')}</span></div><div class="a pos">+${fmt(e.amount)}</div></div>`
    : `<div class="item" data-id="${esc(e.id)}" data-t="out"><span class="dot" style="background:${CAT[e.cat]?.color||'#999'}"></span><div class="t"><b>${esc(e.note||e.sub||CAT[e.cat]?.name)}</b><span>${esc(CAT[e.cat]?.name||e.cat)}${e.sub?' · '+esc(e.sub):''}</span></div><div class="a">${fmt(e.amount)}</div></div>`;
  const flush=()=>{ if(!cur) return; const sum=chunk.reduce((a,e)=>a+(e._t==='in'?0:e.amount),0);
    const d=new Date(cur+'T12:00'); const lbl=isNaN(d)?cur:d.toLocaleDateString('de-DE',{weekday:'short',day:'numeric',month:'long'});
    html+=`<div class="day"><span>${lbl}</span><span>${sum?fmt(sum):''}</span></div>`+chunk.map(line).join(''); };
  rows.slice(0,400).forEach(e=>{ if(e.date!==cur){ flush(); cur=e.date; chunk=[]; } chunk.push(e); });
  flush();
  $('#list').innerHTML = html;
  document.querySelectorAll('#list .item').forEach(el=>el.onclick=()=> el.dataset.t==='in' ? editIncome(el.dataset.id) : editExpense(el.dataset.id));
}

function confirmBtn(btn, fn){ btn.onclick=ev=>{ if(btn.dataset.c!=='1'){ btn.dataset.c='1'; btn.textContent='Wirklich löschen?'; return; } fn(); }; }
const delRow = del => `<div class="row" style="margin-top:8px"><button class="btn sec" id="x-cancel" style="margin-top:0">Abbrechen</button>${del?'<button class="btn danger" id="x-del" style="margin-top:0">Löschen</button>':''}</div>`;
function wireSheet(table,id){ $('#x-cancel').onclick=closeSheet; if($('#x-del')) confirmBtn($('#x-del'), ()=>{ remove(table,id); closeSheet(); toast('Gelöscht'); }); }

function editExpense(id){
  const e = S.expenses[id]; if(!e) return;
  let cat=e.cat, sub=e.sub, dAmt=numIn(e.amount), dNote=e.note||'', dDate=e.date;
  const keep=()=>{ dAmt=$('#e-amt').value; dNote=$('#e-note').value; dDate=$('#e-date').value; };
  const draw=()=>{
    const c=CAT[cat];
    $('#sheet').innerHTML = `<h3>Ausgabe bearbeiten</h3>
      <label class="l">Betrag (€)</label><input type="text" id="e-amt" inputmode="decimal" value="${esc(dAmt)}">
      <label class="l">Kategorie</label><select id="e-cat">${CATS.map(x=>`<option value="${x.id}" ${x.id===cat?'selected':''}>${esc(x.name)}</option>`).join('')}</select>
      ${c&&c.subs.length?`<label class="l">Unterkategorie</label><select id="e-sub">${c.subs.map(s=>`<option ${s===sub?'selected':''}>${esc(s)}</option>`).join('')}</select>`:''}
      <label class="l">Notiz</label><input type="text" id="e-note" value="${esc(dNote)}">
      <label class="l">Datum</label><input type="date" id="e-date" value="${esc(dDate)}">
      <button class="btn" id="e-save">Speichern</button>${delRow(true)}`;
    $('#e-cat').onchange=ev=>{ keep(); cat=ev.target.value; sub=CAT[cat].subs[0]||''; draw(); };
    if($('#e-sub')) $('#e-sub').onchange=ev=>sub=ev.target.value;
    wireSheet('expenses',id);
    $('#e-save').onclick=()=>{ const a=parseAmt($('#e-amt').value); if(!(a>0)) return toast('Betrag prüfen');
      put('expenses', {...e, amount:a, cat, sub:(CAT[cat].subs.includes(sub)?sub:'')||'', note:$('#e-note').value.trim(), date:$('#e-date').value||e.date});
      closeSheet(); toast('Gespeichert'); };
  };
  draw(); openSheet();
}

function editIncome(id){
  const e = S.income[id]; if(!e) return;
  $('#sheet').innerHTML = `<h3>Einnahme bearbeiten</h3>
    <label class="l">Betrag (€)</label><input type="text" id="i-amt" inputmode="decimal" value="${esc(numIn(e.amount))}">
    <label class="l">Quelle</label><select id="i-src">${SOURCES.map(s=>`<option ${s===e.source?'selected':''}>${esc(s)}</option>`).join('')}</select>
    <label class="l">Notiz</label><input type="text" id="i-note" value="${esc(e.note||'')}">
    <label class="l">Datum</label><input type="date" id="i-date" value="${esc(e.date)}">
    <button class="btn" id="i-save">Speichern</button>${delRow(true)}`;
  wireSheet('income',id);
  $('#i-save').onclick=()=>{ const a=parseAmt($('#i-amt').value); if(!(a>0)) return toast('Betrag prüfen');
    put('income', {...e, amount:a, source:$('#i-src').value, note:$('#i-note').value.trim(), date:$('#i-date').value||e.date}); closeSheet(); toast('Gespeichert'); };
  openSheet();
}

/* ---------- Schulden: Verlauf mit Raten, Rückzahlungen und Zinsen ---------- */
function debtSim(d){
  const total=+d.total||0, rate=+d.rate||0, z=(+d.interest||0)/1200, now=ym(today());
  const start = d.start || now;
  const extras={}; EXP.filter(e=>e.debtId===d.id).forEach(e=>{ const m=ym(e.date)<start?start:ym(e.date); extras[m]=(extras[m]||0)+e.amount; });
  let bal=total, interest=0, extra=0; const rates={};
  const n=Math.max(0,mDiff(start,now));
  for(let k=0;k<=n;k++){
    const m=addM(start,k);
    if(rate && bal>0.005){ const p=Math.min(rate,bal); rates[m]=p; bal-=p; }
    const ex=extras[m]||0; bal-=ex; extra+=ex;
    if(k<n && bal>0.005 && z){ const i=bal*z; bal+=i; interest+=i; }
  }
  const remaining=Math.max(0,Math.round(bal*100)/100);
  let monthsLeft=null;
  if(rate && remaining>0.005){ let b=remaining,k=0; while(b>0.005 && k<600){ k++; b+=b*z; b-=rate; } monthsLeft=k<600?k:null; }
  return {total, remaining, interest, extra, rates, monthsLeft, paid: total+interest-remaining};
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
const tradeProfit = t => (+t.sellPrice||0) - (+t.buyPrice||0) - (+t.buyCosts||0) - (+t.fees||0);
function monthData(m){
  const vars = EXP.filter(e=>ym(e.date)===m);
  const fx = fixedFor(m);
  const incs = INC.filter(e=>ym(e.date)===m);
  const fxin = fixedIncomeFor(m);
  const sold = TRADES.filter(t=>t.sellDate && ym(t.sellDate)===m);
  const v = vars.reduce((a,e)=>a+e.amount,0), f = fx.reduce((a,x)=>a+x.amount,0);
  const tp = sold.reduce((a,t)=>a+tradeProfit(t),0);
  const inc = incs.reduce((a,e)=>a+e.amount,0) + fxin.reduce((a,x)=>a+x.amount,0) + tp;
  return {vars, fx, incs, fxin, sold, v, f, tp, total:v+f, inc, left: inc-(v+f)};
}

/* ---------- Finanzen ---------- */
function balanceEstimate(){
  if(!BAL) return null;
  const since = BAL.date;
  const plus = INC.filter(e=>e.date>since).reduce((a,e)=>a+e.amount,0)
    + TRADES.filter(t=>t.sellDate && t.sellDate>since).reduce((a,t)=>a+(+t.sellPrice||0)-(+t.fees||0),0);
  const minus = EXP.filter(e=>e.date>since).reduce((a,e)=>a+e.amount,0)
    + TRADES.filter(t=>t.buyDate && t.buyDate>since).reduce((a,t)=>a+(+t.buyPrice||0)+(+t.buyCosts||0),0);
  return {plus, minus, est:(+BAL.amount||0)+plus-minus};
}
function renderFix(){
  const be = balanceEstimate();
  $('#balance').innerHTML = BAL ? `<div class="card" id="balcard" style="cursor:pointer"><div class="sub">Kontostand am ${dDE(BAL.date)}</div><div class="big">${fmt(BAL.amount)}</div>
      ${be.plus||be.minus?`<div class="sub" style="margin-top:6px">Seitdem erfasst: <span class="pos">+${fmt(be.plus)}</span> / <span class="neg">−${fmt(be.minus)}</span>, geschätzt jetzt <b>${fmt(be.est)}</b> (ohne Fixkosten-Abbuchungen)</div>`:''}
      <button class="btn sec" id="newbal">Neuen Kontostand eintragen</button></div>`
    : `<div class="card"><div class="empty" style="padding:8px">Noch kein Kontostand eingetragen.</div><button class="btn sec" id="newbal">Kontostand eintragen</button></div>`;
  $('#newbal').onclick=e=>{ e.stopPropagation(); editBalance(); };
  const totalOpen = DEBTS.reduce((a,d)=>a+SIM[d.id].remaining,0);
  $('#debtsum').textContent = DEBTS.length ? 'offen gesamt '+fmt(totalOpen) : '';
  const soon = addDays(today(),14);
  $('#debts').innerHTML = DEBTS.length ? DEBTS.map(d=>{ const s=SIM[d.id]; const base=s.total+s.interest; const pct=base?Math.min(100,s.paid/base*100):0;
    const end = s.monthsLeft ? mLabel(addM(ym(today()),s.monthsLeft),true) : null;
    const open = s.remaining>0.005;
    const dueTxt = d.due && open ? `<span class="${d.due<=soon?'duesoon':''}">fällig ${dDE(d.due)}</span>` : '';
    const bits = [ `${fmt(s.paid)} von ${fmt(base)} getilgt`, +d.rate?'Rate '+fmt(d.rate)+'/Monat':'', +d.interest?String(d.interest).replace('.',',')+' % Zinsen p.a.'+(s.interest?' (bisher '+fmt(s.interest)+')':''):'', end&&open?'schuldenfrei ca. '+end:'' ].filter(Boolean).join(' · ');
    return `<div class="card debt" data-id="${esc(d.id)}" style="cursor:pointer"><div class="h"><b>${esc(d.name)}</b><span class="${open?'':'muted'}">${open?'offen '+fmt(s.remaining):'abbezahlt'}</span></div>
      <div class="bar"><i style="width:${pct}%;background:var(--accent)"></i></div>
      <div class="sub" style="margin-top:8px">${dueTxt}${dueTxt&&bits?' · ':''}${bits}</div>${d.note?`<div class="sub" style="margin-top:4px">${esc(d.note)}</div>`:''}</div>`; }).join('') : '<div class="empty">Keine Schulden angelegt.</div>';
  document.querySelectorAll('#debts .debt').forEach(el=>el.onclick=()=>editDebt(el.dataset.id));
  const list=(arr,empty,cls)=>{ const sum=arr.filter(f=>f.active!==false).reduce((a,f)=>a+(+f.amount||0),0);
    return arr.length ? `<div class="card" style="padding:6px 16px">${arr.map(f=>`<div class="catline" data-id="${esc(f.id)}"><div class="h"><span><i class="dot" style="background:${f.kind==='income'?'var(--pos)':(CAT[f.cat]?.color||'#999')}"></i>${esc(f.name)}${f.end?` <small class="muted">bis ${mLabel(f.end)} ${f.end.slice(2,4)}</small>`:''}</span><b class="${cls}">${fmt(f.amount)}</b></div></div>`).join('')}<div class="catline"><div class="h"><span class="muted">Summe pro Monat</span><b class="${cls}">${fmt(sum)}</b></div></div></div>` : `<div class="empty">${empty}</div>`; };
  $('#fixedin').innerHTML = list(FIXIN,'Noch keine festen Einnahmen. Zum Beispiel Gehalt als Werkstudent.','pos');
  $('#fixed').innerHTML = list(FIX,'Noch keine Fixkosten. Typisch: Miete, Handyvertrag, Fitnessstudio, Streaming, Versicherungen.','');
  document.querySelectorAll('#fixed .catline[data-id]').forEach(el=>el.onclick=()=>editFixed(el.dataset.id,'expense'));
  document.querySelectorAll('#fixedin .catline[data-id]').forEach(el=>el.onclick=()=>editFixed(el.dataset.id,'income'));
}
function addDays(d,n){ const x=new Date(d+'T12:00'); x.setDate(x.getDate()+n); return x.toISOString().slice(0,10); }
$('#addfix').onclick=()=>editFixed(null,'expense');
$('#addfixin').onclick=()=>editFixed(null,'income');
$('#adddebt').onclick=()=>editDebt(null);

function editBalance(){
  $('#sheet').innerHTML=`<h3>Kontostand eintragen</h3>
    <label class="l">Aktueller Kontostand (€)</label><input type="text" id="b-amt" inputmode="decimal" placeholder="z. B. 1234,56">
    <label class="l">Stand vom</label><input type="date" id="b-date" value="${today()}">
    <div class="sub" style="margin-top:10px">Ab diesem Stand rechnet die App mit deinen erfassten Einnahmen und Ausgaben weiter.</div>
    <button class="btn" id="b-save">Speichern</button>${delRow(false)}`;
  $('#x-cancel').onclick=closeSheet;
  $('#b-save').onclick=()=>{ const a=parseAmt($('#b-amt').value); if(!isFinite(a)) return toast('Betrag prüfen');
    put('balances',{id:uid(), amount:a, date:$('#b-date').value||today(), note:''}); closeSheet(); toast('Gespeichert'); };
  openSheet(); $('#b-amt').focus();
}

function editFixed(id, kind){
  const isIn = kind==='income';
  const f = id ? {...S.fixed[id]} : {id:uid(),name:'',amount:'',cat:isIn?'einnahme':'wohnen',sub:isIn?'':'Miete',start:ym(today()),end:'',active:true,kind};
  let cat=f.cat;
  const draw=()=>{
    const c=CAT[cat];
    $('#sheet').innerHTML=`<h3>${id?(isIn?'Feste Einnahme bearbeiten':'Fixkosten bearbeiten'):(isIn?'Neue feste Einnahme':'Neue Fixkosten')}</h3>
      <label class="l">Name</label><input type="text" id="f-name" value="${esc(f.name)}" placeholder="${isIn?'z. B. Gehalt Westenergie':'z. B. Miete, Handy, Fitnessstudio'}">
      <label class="l">Betrag pro Monat (€)</label><input type="text" id="f-amt" inputmode="decimal" value="${esc(numIn(f.amount))}">
      ${isIn?'':`<label class="l">Kategorie</label><select id="f-cat">${CATS.filter(x=>x.id!=='schulden').map(x=>`<option value="${x.id}" ${x.id===cat?'selected':''}>${esc(x.name)}</option>`).join('')}</select>
      ${c&&c.subs.length?`<label class="l">Unterkategorie</label><select id="f-sub">${c.subs.map(s=>`<option ${s===f.sub?'selected':''}>${esc(s)}</option>`).join('')}</select>`:''}`}
      <div class="row"><div><label class="l">Ab Monat</label><input type="month" id="f-start" value="${esc(f.start||'')}"></div><div><label class="l">Bis Monat (optional)</label><input type="month" id="f-end" value="${esc(f.end||'')}"></div></div>
      <button class="btn" id="f-save">Speichern</button>${delRow(!!id)}`;
    if($('#f-cat')) $('#f-cat').onchange=ev=>{ f.name=$('#f-name').value; f.amount=$('#f-amt').value; f.start=$('#f-start').value; f.end=$('#f-end').value; cat=ev.target.value; f.sub=CAT[cat].subs[0]||''; draw(); };
    wireSheet('fixed',id);
    $('#f-save').onclick=()=>{ const a=parseAmt($('#f-amt').value), n=$('#f-name').value.trim();
      if(!n||!(a>0)) return toast('Name und Betrag angeben');
      put('fixed', {...f, name:n, amount:a, cat, sub:$('#f-sub')?$('#f-sub').value:'', start:$('#f-start').value||ym(today()), end:$('#f-end').value||'', active:true, kind});
      closeSheet(); toast('Gespeichert'); };
  };
  draw(); openSheet();
}

function editDebt(id){
  const d = id ? {...S.debts[id]} : {id:uid(),name:'',total:'',rate:'',start:ym(today()),interest:'',due:'',note:''};
  const s = id ? SIM[id] : null;
  $('#sheet').innerHTML=`<h3>${id?esc(d.name):'Neue Schulden'}</h3>
    ${s?`<div class="sub">Offen: <b>${fmt(s.remaining)}</b>${s.interest?' (inkl. '+fmt(s.interest)+' Zinsen)':''}</div>
    <div class="row" style="align-items:flex-end"><div><label class="l">Rückzahlung erfassen (€)</label><input type="text" id="d-pay" inputmode="decimal" placeholder="z. B. 100"></div><div style="flex:0 0 auto"><button class="btn small" id="d-paybtn" style="margin-bottom:2px">Abziehen</button></div></div>`:''}
    <label class="l">Bezeichnung</label><input type="text" id="d-name" value="${esc(d.name)}" placeholder="z. B. Sebastian, PayPal, Krankenkasse">
    <div class="row"><div><label class="l">Offener Betrag zum Start (€)</label><input type="text" id="d-total" inputmode="decimal" value="${esc(numIn(d.total))}"></div>
    <div><label class="l">Stand vom (Monat)</label><input type="month" id="d-start" value="${esc(d.start||'')}"></div></div>
    <div class="row"><div><label class="l">Feste Rate pro Monat (€, optional)</label><input type="text" id="d-rate" inputmode="decimal" value="${+d.rate?esc(numIn(d.rate)):''}"></div>
    <div><label class="l">Zinsen % pro Jahr (optional)</label><input type="text" id="d-int" inputmode="decimal" value="${+d.interest?esc(numIn(d.interest)):''}"></div></div>
    <label class="l">Fällig bis (optional)</label><input type="date" id="d-due" value="${esc(d.due||'')}">
    <label class="l">Notiz</label><input type="text" id="d-note" value="${esc(d.note||'')}">
    <div class="sub" style="margin-top:10px">Eine feste Rate wird jeden Monat automatisch abgezogen und bei den Fixkosten mitgezählt. Einzelne Rückzahlungen trägst du hier oben oder unter „Erfassen“ mit der Kategorie Schulden ein.</div>
    <button class="btn" id="d-save">Speichern</button>${delRow(!!id)}`;
  wireSheet('debts',id);
  if(s) $('#d-paybtn').onclick=()=>{ const a=parseAmt($('#d-pay').value); if(!(a>0)) return toast('Betrag prüfen');
    put('expenses',{id:uid(), amount:a, cat:'schulden', sub:'Rückzahlung', note:d.name, date:today(), debtId:d.id}); closeSheet(); toast(fmt(a)+' abgezogen'); };
  $('#d-save').onclick=()=>{ const t=parseAmt($('#d-total').value), r=$('#d-rate').value.trim()?parseAmt($('#d-rate').value):0, z=$('#d-int').value.trim()?parseAmt($('#d-int').value):0, n=$('#d-name').value.trim();
    if(!n||!(t>0)||!(r>=0)||!(z>=0)) return toast('Bezeichnung und Betrag angeben');
    put('debts', {...d, name:n, total:t, rate:r||0, interest:z||0, start:$('#d-start').value||ym(today()), due:$('#d-due').value||'', note:$('#d-note').value.trim()});
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
  const row = t => { const p=tradeProfit(t); return `<div class="item" data-id="${esc(t.id)}"><span class="dot" style="background:${t.sellDate?(p>=0?'var(--pos)':'var(--danger)'):'var(--muted)'}"></span><div class="t"><b>${esc(t.item||'Artikel')}</b><span>${t.sellDate?`verkauft ${dDE(t.sellDate)} für ${fmt(t.sellPrice)}`:`gekauft ${dDE(t.buyDate)} für ${fmt((+t.buyPrice||0)+(+t.buyCosts||0))}`}</span></div><div class="a ${t.sellDate?(p>=0?'pos':'neg'):''}">${t.sellDate?(p>=0?'+':'')+fmt(p):fmt(+t.buyPrice||0)}</div></div>`; };
  $('#tradesopen').innerHTML = open.length ? open.map(row).join('') : '<div class="empty">Nichts im Lager.</div>';
  $('#tradesdone').innerHTML = sold.length ? sold.map(row).join('') : '<div class="empty">Noch nichts verkauft.</div>';
  document.querySelectorAll('#v-trade .item').forEach(el=>el.onclick=()=>editTrade(el.dataset.id));
}
function editTrade(id){
  const t = id ? {...S.trades[id]} : {id:uid(),item:'',buyDate:today(),buyPrice:'',buyCosts:'',sellDate:'',sellPrice:'',fees:'',note:''};
  $('#sheet').innerHTML=`<h3>${id?esc(t.item):'Ankauf erfassen'}</h3>
    <label class="l">Artikel</label><input type="text" id="t-item" value="${esc(t.item)}" placeholder="z. B. iPad Air 5, 64 GB, blau">
    <h2 style="margin-top:16px">Ankauf</h2>
    <div class="row"><div><label class="l">Datum</label><input type="date" id="t-bd" value="${esc(t.buyDate||'')}"></div><div><label class="l">Preis (€)</label><input type="text" id="t-bp" inputmode="decimal" value="${esc(numIn(t.buyPrice))}"></div></div>
    <label class="l">Nebenkosten Ankauf (€, z. B. Versand, Fahrt)</label><input type="text" id="t-bc" inputmode="decimal" value="${esc(numIn(t.buyCosts))}">
    <h2 style="margin-top:16px">Verkauf</h2>
    <div class="row"><div><label class="l">Datum</label><input type="date" id="t-sd" value="${esc(t.sellDate||'')}"></div><div><label class="l">Preis (€)</label><input type="text" id="t-sp" inputmode="decimal" value="${esc(numIn(t.sellPrice))}"></div></div>
    <label class="l">Provision und Gebühren (€)</label><input type="text" id="t-fe" inputmode="decimal" value="${esc(numIn(t.fees))}">
    <label class="l">Notiz</label><input type="text" id="t-note" value="${esc(t.note||'')}">
    <div class="sub" id="t-profit" style="margin-top:12px"></div>
    <button class="btn" id="t-save">Speichern</button>${delRow(!!id)}`;
  const val = k => { const v=$('#'+k).value.trim(); return v?parseAmt(v):0; };
  const calc = () => { const sp=val('t-sp'); const p=sp-val('t-bp')-val('t-bc')-val('t-fe');
    $('#t-profit').innerHTML = sp ? `Gewinn: <b class="${p>=0?'pos':'neg'}">${fmt(p)}</b>` : `Eingesetzt: <b>${fmt(val('t-bp')+val('t-bc'))}</b>`; };
  ['t-bp','t-bc','t-sp','t-fe'].forEach(k=>$('#'+k).addEventListener('input',calc)); calc();
  $('#t-sp').addEventListener('input',()=>{ if($('#t-sp').value.trim() && !$('#t-sd').value) $('#t-sd').value=today(); });
  wireSheet('trades',id);
  $('#t-save').onclick=()=>{ const item=$('#t-item').value.trim(); const bp=val('t-bp');
    if(!item||!(bp>=0)) return toast('Artikel und Ankaufpreis angeben');
    const sp=val('t-sp');
    put('trades',{...t, item, buyDate:$('#t-bd').value||today(), buyPrice:bp, buyCosts:val('t-bc')||0, sellDate:sp?($('#t-sd').value||today()):'', sellPrice:sp||'', fees:val('t-fe')||0, note:$('#t-note').value.trim()});
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
    const avail = d.inc - d.f - d.v;
    $('#kday').innerHTML = `Bisher ${fmt(d.v/day)} pro Tag ausgegeben (variabel). `+(d.inc?`Noch verfügbar bis Monatsende: <b class="${avail>=0?'pos':'neg'}">${fmt(avail)}</b>, also <b>${fmt(avail/rest)}</b> pro Tag für die restlichen ${rest} Tage.`:'Trag Einnahmen ein, dann siehst du, wie viel pro Tag übrig bleibt.');
  } else if(m<nowM){
    $('#kday').innerHTML = `Ø ${fmt(d.v/dim)} pro Tag ausgegeben (variabel), übrig ${fmt(d.left/dim)} pro Tag.`;
  } else $('#kday').textContent='';
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
    return `<div class="catline"><div class="h"><span><i class="dot" style="background:${cc.color}"></i>${esc(cc.name)}</span><b>${fmt(c.sum)} <small class="muted">${Math.round(pct)} %</small></b></div>
      <div class="bar"><i style="width:${pct}%;background:${cc.color}"></i></div>
      ${subs.length>1||(subs[0]&&subs[0][0]!=='Ohne')?`<div class="subs hidden">${subs.map(([s,v])=>`<div><span>${esc(s)}</span><span>${fmt(v)}</span></div>`).join('')}</div>`:''}</div>`; }).join('')
    : '<div class="empty">Keine Ausgaben in diesem Monat.</div>';
  document.querySelectorAll('#bycat .catline').forEach(el=>el.onclick=()=>{ const s=el.querySelector('.subs'); if(s) s.classList.toggle('hidden'); });
  const ib={};
  d.incs.forEach(e=>{ const k=e.source||'Sonstiges'; ib[k]=(ib[k]||0)+e.amount; });
  d.fxin.forEach(x=>{ const k=x.name+' (fest)'; ib[k]=(ib[k]||0)+x.amount; });
  if(d.tp) ib['Handel (Gewinn)']=d.tp;
  const il=Object.entries(ib).sort((a,b)=>b[1]-a[1]);
  $('#byinc').innerHTML = il.length ? il.map(([k,v])=>`<div class="catline"><div class="h"><span><i class="dot" style="background:var(--pos)"></i>${esc(k)}</span><b class="${v>=0?'pos':'neg'}">${fmt(v)}</b></div></div>`).join('') : '<div class="empty">Keine Einnahmen in diesem Monat.</div>';
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
  if(!$('#v-trade').classList.contains('hidden')) renderTrades();
  if(!$('#v-fix').classList.contains('hidden')) renderFix();
  status();
}
rebuild(); render(); sync();
if(!S.settings.url && !EXP.length) setTimeout(openSettings, 400);
if('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(()=>{});
