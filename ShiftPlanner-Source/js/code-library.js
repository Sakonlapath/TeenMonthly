/* Standalone-compatible UI. No external libraries or cloud credentials required offline. */
const CodeLibrary=(()=>{
 'use strict';
 const LOCAL='shiftplanner-codes-local-v1',ACTIVE='shiftplanner-codes-active-v1';
 const empty=()=>({version:1,records:[],revision:0,dirty:false});
 // Public project configuration only. Passwords and session tokens are never bundled.
 const defaultConfig=CodeCatalog.config('https://omtcyjoewqtfsreshgfu.supabase.co','sb_publishable_3Ixd4qU4vGBYVRJUqTurSg_vFabVA5B');
 const config=defaultConfig;
 let store=LOCAL,doc=empty(),session=null,loadError='',rawBackup='',storageWarning='',stale=false,busy=false,message='',category=[],query='',kind=[],page=1;
 const backedUpRecords=new Map();let pendingClear=null;
 let loginUsername='teen';
 let autoSyncTimer,autoSyncTask=null,autoSyncError='',autoSyncBlocked=false,autoSyncRetries=0;
 const pageSize=12;
 let motionPaused=false,favoritesOnly=false,speechIndex=0,speechTimer;
 const speeches=['สวัสดีคนเก่งของเค้า','สู้ๆนะไอ้อ้วงง','เค้ารักอ้วนที่สุดในโลกเลยย','มากอดหน่อย','คนเก่งของเค้า','หอมแก้มม.'];
 const detailsKinds=[['conditions','มีเงื่อนไข'],['procedures','มีหัตถการ'],['note','มี Note']];
 // Draw icons as SVG so hearts and controls work even without an emoji font.
 function icon(name,extra=''){
  const paths={heart:'<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>',star:'<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z"/>',search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',plus:'<path d="M12 5v14M5 12h14"/>',file:'<path d="M14 3H5v18h14V8Zm0 0v5h5M8 12h8M8 16h6"/>',edit:'<path d="m15 4 5 5M4 20l5-1L21 7l-5-5L4 14Z"/>',trash:'<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/>',pause:'<path d="M8 5v14M16 5v14"/>',play:'<path d="m8 4 12 8-12 8Z"/>',conditions:'<path d="m12 3 10 18H2Z"/><path d="M12 9v5M12 17v.1"/>',procedures:'<path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6Z"/>',note:'<path d="M4 3h16v18H4ZM8 8h8M8 12h8M8 16h5"/>',arrow:'<path d="m9 5 7 7-7 7"/>',cloud:'<path d="M7 18a5 5 0 1 1-1-9 6 6 0 0 1 12-1 5 5 0 0 1-1 10M12 12v9m-3-3 3 3 3-3"/>'};
  paths.eye='<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>';
  paths['eye-off']=paths.eye+'<path d="m3 3 18 18"/>';
  paths.user='<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>';
  paths.upload='<path d="M12 16V3m-5 5 5-5 5 5M4 15v6h16v-6"/>';
  paths.download='<path d="M12 3v13m-5-5 5 5 5-5M4 17v4h16v-4"/>';
  paths.check='<path d="m5 12 4 4L19 6"/>';
  paths.logout='<path d="M9 4H4v16h5M14 8l4 4-4 4M8 12h13"/>';
  return '<svg class="code-icon '+extra+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">'+(paths[name]||paths.heart)+'</svg>';
 }
 function suspend(){if(speechTimer!==undefined){clearTimeout(speechTimer);speechTimer=undefined}}
 function nextSpeech(){
  if(currentView!=='codes'||motionPaused)return;
  speechIndex=(speechIndex+1)%speeches.length;
  const text=$('kittySpeechText');if(text)text.textContent=speeches[speechIndex];
 }
 function scheduleSpeech(){
  suspend();if(motionPaused||currentView!=='codes'||typeof setTimeout!=='function')return;
  speechTimer=setTimeout(()=>{speechTimer=undefined;if(typeof document==='undefined'||!document.hidden)nextSpeech();scheduleSpeech()},7000);
 }
 function motion(){
  motionPaused=!motionPaused;
  const character=$('kittyCharacter'),control=$('kittyMotion');
  if(character)character.classList.toggle('is-paused',motionPaused);
  if(control){control.setAttribute('aria-pressed',String(motionPaused));control.setAttribute('aria-label',motionPaused?'เล่นแอนิเมชันและข้อความคิตตี้':'พักแอนิเมชันและข้อความคิตตี้');control.innerHTML=icon(motionPaused?'play':'pause')}
  scheduleSpeech();
 }
 try{const active=localStorage.getItem(ACTIVE);if(active&&/^shiftplanner-codes-account:/.test(active))store=active}catch{}
 function read(key){
  loadError='';rawBackup='';storageWarning='';stale=false;
  try{const raw=localStorage.getItem(key);if(!raw)return empty();rawBackup=raw;return CodeCatalog.document(JSON.parse(raw))}
  catch(e){loadError='เปิดคลังรหัสที่บันทึกไม่ได้: '+e.message+' กรุณาดาวน์โหลดข้อมูลเดิมก่อนเริ่มคลังใหม่';return empty()}
 }
 doc=read(store);
 function persist(next){
  if(loadError)throw Error(loadError);
  next=CodeCatalog.document(next);
  try{
   if(localStorage.getItem(store)!==(rawBackup||null)){
    stale=true;loadError='คลังนี้ถูกแก้ไขจากอีกแท็บ กรุณาสำรอง JSON ของแท็บนี้ แล้วรีเฟรชก่อนแก้ไขต่อ';
    throw Error(loadError);
   }
   const serialized=JSON.stringify(next);localStorage.setItem(store,serialized);rawBackup=serialized;storageWarning='';
  }
  catch(e){if(stale)throw e;storageWarning='บันทึกในเครื่องไม่ได้ ข้อมูลรอบนี้อยู่ในหน่วยความจำเท่านั้น กรุณาสำรอง JSON ก่อนปิดหน้า';toast(storageWarning)}
  doc=next;
 }
 function switchStore(next){
  if(storageWarning){persist(doc);if(storageWarning)throw Error('ยังบันทึกคลังปัจจุบันในเครื่องไม่ได้ กรุณาสำรอง JSON ก่อนรีเฟรช แล้วนำเข้าไฟล์สำรองเมื่อมีพื้นที่เพียงพอ')}
  cancelAutoSync();autoSyncError='';autoSyncBlocked=false;autoSyncRetries=0;
  store=next;doc=read(store);try{localStorage.setItem(ACTIVE,store)}catch{}page=1;category=[];query='';kind=[];favoritesOnly=false;message='';pendingClear=null;
 }
 function commit(rows){if(busy)throw Error('รอการเชื่อมต่อให้เสร็จก่อน');persist({...doc,records:rows,dirty:true});page=1;message='';scheduleAutoSync();render()}
 function cancelAutoSync(){if(autoSyncTimer!==undefined){clearTimeout(autoSyncTimer);autoSyncTimer=undefined}}
 function canAutoSync(){return session&&store==='shiftplanner-codes-account:'+config.url+':'+session.user.id&&doc.dirty&&!loadError&&!autoSyncBlocked}
 function scheduleAutoSync(delay=600){
  cancelAutoSync();
  if(!canAutoSync()||busy||autoSyncTask)return;
  autoSyncTimer=setTimeout(()=>{autoSyncTimer=undefined;return autoSave()},delay);
 }
 function refreshSyncUI(){
  const label=$('codeSaveStatus');if(label)label.innerHTML='<span class="code-save-dot" aria-hidden="true"></span>'+esc(status());
  const notice=$('codeMessage');if(notice)notice.textContent=autoSyncError||message;
  renderAccount();
  if($('modal').open&&$('modalTitle').textContent==='บัญชีผู้ใช้')cloud();
 }
 async function saveRemote(){
  if(!session)throw Error('กรุณาเข้าสู่ระบบใหม่เพื่อส่งข้อมูลที่ค้างไว้');
  if(loadError)throw Error(loadError);
  const target=store,owner=session.user.id,next=CodeCatalog.records(doc.records),snapshot=JSON.stringify(next);
  const revision=await request('/rest/v1/rpc/save_code_library',{method:'POST',body:{expected_revision:doc.revision,entries:next}});
  if(!Number.isSafeInteger(revision)||revision<1)throw Error('รูปแบบรุ่นข้อมูลออนไลน์ไม่ถูกต้อง');
  if(store!==target||session?.user.id!==owner)throw Error('บัญชีถูกเปลี่ยน ข้อมูลในเครื่องยังรอส่ง');
  // Edits made during a background upload belong to the next revision, not this acknowledgement.
  persist({...doc,revision,dirty:JSON.stringify(doc.records)!==snapshot});
  autoSyncError='';autoSyncBlocked=false;autoSyncRetries=0;
  return next.length;
 }
 function autoSave(){
  if(autoSyncTask)return autoSyncTask;
  if(busy||!canAutoSync())return Promise.resolve();
  cancelAutoSync();autoSyncError='';
  autoSyncTask=(async()=>{
   try{await saveRemote();message=''}
   catch(e){
    autoSyncError=e.message||String(e);autoSyncBlocked=!e.retryable;autoSyncRetries++;
   }
  })().finally(()=>{
   autoSyncTask=null;refreshSyncUI();
   scheduleAutoSync(autoSyncRetries?Math.min(30000,3000*2**Math.min(autoSyncRetries-1,4)):600);
  });
  refreshSyncUI();return autoSyncTask;
 }
 function error(e){message=e.message||String(e);toast(message);if(currentView==='codes')render()}
 function filtered(){return CodeCatalog.filter(doc.records,category,query,kind).filter(r=>!favoritesOnly||r.favorite)}
 function lookup(value){
  if(loadError)throw Error(loadError);
  const text=String(value??'').trim();if(!text||text.length>500)throw Error('กรุณาพิมพ์ชื่อโรคหรือรหัสไม่เกิน 500 ตัวอักษร');
  return CodeCatalog.filter(doc.records,[],text,[]).map(r=>({...r}));
 }
 function openSearch(value){
  category=[];kind=[];favoritesOnly=false;query=String(value??'').trim().slice(0,500);page=1;
  closeModal();view('codes');render();
  $('codeCount').scrollIntoView?.({block:'start'});
 }
 function status(){
  if(loadError)return loadError;
  if(storageWarning)return storageWarning;
  if(store===LOCAL)return 'บันทึกเฉพาะเครื่องนี้ · '+doc.records.length+' รายการ';
  if(!session)return 'คลังบัญชีที่เคยเปิด · เข้าสู่ระบบเพื่อซิงก์ข้อมูล';
  return 'คลังบัญชี '+session.username+' · '+(autoSyncTask?'กำลังบันทึกออนไลน์…':autoSyncError?'ยังส่งออนไลน์ไม่สำเร็จ':doc.dirty?'รอบันทึกออนไลน์อัตโนมัติ':doc.revision?'บันทึกออนไลน์แล้ว':'ซิงก์อัตโนมัติพร้อมใช้งาน');
 }
 function renderAccount(){
  const host=$('accountControls');if(!host)return;
  const userIcon='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/></svg>';
  host.innerHTML=session?'<button class="header-account-user" onclick="CodeLibrary.cloud()" '+(busy?'disabled':'')+' aria-label="บัญชี '+esc(session.username)+'" title="'+esc(session.username)+'">'+userIcon+'<span class="header-account-name">'+esc(session.username)+'</span></button><button class="header-logout-button" onclick="CodeLibrary.logout()" aria-label="ออกจากระบบ" title="ออกจากระบบ" '+(busy?'disabled':'')+'><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 4H4v16h5M14 8l4 4-4 4M8 12h13"/></svg><span>ออกจากระบบ</span></button>':'<button class="header-login-button" onclick="CodeLibrary.cloud()" '+(busy?'disabled':'')+'>'+userIcon+(busy?'กำลังเชื่อมต่อ…':'เข้าสู่ระบบ')+'</button>';
 }
 function render(){
  renderAccount();
  const host=$('codesView');if(!host)return;
  const counts=Object.fromEntries('ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(c=>[c,doc.records.filter(r=>r.code[0]===c).length]));
  host.innerHTML=`<div class="panel kitty-library">
   <div class="kitty-hero">
    <div class="kitty-welcome"><span class="kitty-eyebrow"><span class="kitty-bow" aria-hidden="true"></span> MY LITTLE CODE BOOK</span><h2>คลังโค้ดรหัส<span class="kitty-title-heart">${icon('heart','code-heart')}</span></h2><p>ทุกโค้ดสำคัญ เก็บไว้ใกล้มือ</p><span class="kitty-hero-note">ทั้งหมด ${doc.records.length} รายการ · รายการโปรด ${doc.records.filter(r=>r.favorite).length} รายการ</span></div>
    <div class="kitty-mascot"><div class="kitty-speech"><span id="kittySpeechText">${esc(speeches[speechIndex])}</span>${icon('heart','code-heart')}</div><div id="kittyCharacter" class="kitty-character${motionPaused?' is-paused':''}" role="img" aria-label="Hello Kitty โบกมือทักทาย"><img class="kitty-character-body" src="assets/kitty/hello-kitty-cutout.png" alt="" width="1024" height="1024"><img class="kitty-character-arm" src="assets/kitty/hello-kitty-cutout.png" alt="" width="1024" height="1024"><span class="kitty-wave-mark" aria-hidden="true">${icon('heart','code-heart')}</span></div><button id="kittyMotion" class="kitty-motion" onclick="CodeLibrary.motion()" aria-pressed="${motionPaused}" aria-label="${motionPaused?'เล่นแอนิเมชันและข้อความคิตตี้':'พักแอนิเมชันและข้อความคิตตี้'}">${icon(motionPaused?'play':'pause')}</button></div>
   </div>
   <div class="code-toolbar"><p id="codeSaveStatus" class="code-save" role="status"><span class="code-save-dot" aria-hidden="true"></span>${esc(status())}</p><div class="code-main-actions"><button class="primary code-add-button" onclick="CodeLibrary.edit()" ${busy||loadError?'disabled':''}>${icon('plus')} เพิ่มรหัสใหม่</button><button class="code-data-button" onclick="CodeLibrary.files()">${icon('file')} จัดการข้อมูล</button></div></div>
   <p id="codeMessage" class="code-message" role="status">${esc(autoSyncError||message)}</p>
   <div class="code-tools"><label class="field code-search"><span>ค้นหาในสมุดโค้ด</span><span class="code-search-box"><span class="code-search-icon">${icon('search')}</span><input id="codeSearch" type="search" placeholder="พิมพ์รหัส ชื่อโรค เงื่อนไข หรือโน้ต…" value="${esc(query)}" oninput="CodeLibrary.search(this.value)"></span></label>
   <fieldset class="code-kind"><legend>รายละเอียดที่ต้องการ</legend><div class="code-kind-options">${detailsKinds.map(([v,t])=>'<label class="code-kind-option code-kind-'+v+'"><input type="checkbox" name="codeKind" value="'+v+'" '+(kind.includes(v)?'checked':'')+' onchange="CodeLibrary.kind(this.value,this.checked)">'+icon(v)+'<span>'+t+'</span></label>').join('')}</div></fieldset></div>
   <div id="codeFavorites" class="code-favorites"></div>
   <div class="code-filter-panel"><div class="code-category-heading"><span>หมวดรหัส A–Z</span><button class="code-category-all" aria-pressed="${!category.length}" onclick="CodeLibrary.category('')">ทั้งหมด <span>${doc.records.length}</span></button></div><div class="code-alphabet" role="group" aria-label="หมวดรหัส A ถึง Z เลือกได้หลายหมวด">${Object.entries(counts).map(([c,n])=>'<button class="'+(!n?'code-category-empty':'')+'" aria-pressed="'+category.includes(c)+'" onclick="CodeLibrary.category(\''+c+'\')">'+c+'<small>'+n+'</small></button>').join('')}</div></div>
   <div class="code-results-heading"><p class="code-count" id="codeCount" role="status" tabindex="-1"></p><div class="code-results-actions"><button id="codeClear" class="code-clear${category.length||query||kind.length||favoritesOnly?'':' hidden'}" onclick="CodeLibrary.clearSearch()">ล้างตัวกรอง ×</button><div id="codePagination"></div></div></div><div class="code-results" id="codeResults"></div>
   </div>`;
  renderFavorites();
  renderResults();
  scheduleSpeech();
 }
 function renderFavorites(){
  const rows=doc.records.filter(r=>r.favorite);
  $('codeFavorites').innerHTML='<button class="code-favorites-toggle" aria-pressed="'+favoritesOnly+'" onclick="CodeLibrary.favorites()">'+icon('star')+' รายการโปรด <span>'+rows.length+'</span></button>'+(favoritesOnly&&rows.length?'<div class="code-favorite-shortcuts">'+rows.slice(0,8).map(r=>'<button onclick="CodeLibrary.detail(\''+r.id+'\')" title="'+esc(r.code+' · '+r.disease)+'">'+esc(r.code)+'<span>'+esc(r.disease)+'</span></button>').join('')+'</div>':'');
 }
 function renderResults(){
  const rows=filtered(),max=Math.max(1,Math.ceil(rows.length/pageSize));page=Math.max(1,Math.min(page,max));
  $('codeCount').textContent='พบ '+rows.length+' จาก '+doc.records.length+' รหัส'+(category.length?' · หมวด '+category.join(', '):'')+(max>1?' · แสดง '+((page-1)*pageSize+1)+'–'+Math.min(page*pageSize,rows.length):'');
  $('codeClear').classList.toggle('hidden',!category.length&&!query&&!kind.length&&!favoritesOnly);
  const cards=rows.slice((page-1)*pageSize,page*pageSize).map(r=>`<article class="code-card" data-entry="${r.id}">
   <div class="code-card-head"><div class="code-card-title"><span class="code-badge">${esc(r.code)}</span><h3>${esc(r.disease)}</h3></div><button class="code-star${r.favorite?' is-favorite':''}" onclick="CodeLibrary.favorite('${r.id}')" aria-pressed="${r.favorite}" aria-label="${r.favorite?'นำออกจาก':'เพิ่มใน'}รายการโปรด ${esc(r.code+' '+r.disease)}" ${busy||loadError?'disabled':''}>${icon('star')}</button></div>
   <div class="code-tags">${detailsKinds.filter(([k])=>r[k]).map(([k,t])=>'<span class="code-tag code-tag-'+k+'">'+icon(k)+t+'</span>').join('')||'<span class="code-tag-empty">ยังไม่มีรายละเอียดเพิ่มเติม</span>'}</div>
   <p class="code-card-preview">${esc((r.note||r.conditions||r.procedures||'').slice(0,110))}</p>
   <div class="code-card-foot"><button class="primary code-detail-button" onclick="CodeLibrary.detail('${r.id}')">ดูรายละเอียด ${icon('arrow')}</button><button class="code-icon-button" onclick="CodeLibrary.edit('${r.id}')" aria-label="แก้ไข ${esc(r.code+' '+r.disease)}" title="แก้ไขรายการ" ${busy?'disabled':''}>${icon('edit')}</button><button class="code-icon-button code-delete" onclick="CodeLibrary.remove('${r.id}')" aria-label="ลบ ${esc(r.code+' '+r.disease)}" title="ลบรายการ" ${busy?'disabled':''}>${icon('trash')}</button></div>
  </article>`).join('');
  $('codePagination').innerHTML=max>1?`<nav class="code-pager" aria-label="เปลี่ยนหน้ารหัส"><button onclick="CodeLibrary.page(-1)" aria-keyshortcuts="ArrowLeft" title="ก่อนหน้า (ปุ่มลูกศรซ้าย ←)" ${page===1?'disabled':''}>‹ ก่อนหน้า</button><label>หน้า <select aria-label="เลือกหน้ารหัส" onchange="CodeLibrary.goToPage(Number(this.value))">${Array.from({length:max},(_,i)=>'<option value="'+(i+1)+'" '+(page===i+1?'selected':'')+'>'+(i+1)+'</option>').join('')}</select> / ${max}</label><button onclick="CodeLibrary.page(1)" aria-keyshortcuts="ArrowRight" title="ถัดไป (ปุ่มลูกศรขวา →)" ${page===max?'disabled':''}>ถัดไป ›</button></nav>`:'';
  $('codeResults').innerHTML=rows.length?'<div class="code-card-grid">'+cards+'</div>':`<div class="code-empty"><div class="kitty-empty-icon" aria-hidden="true"><span class="kitty-bow"></span>${icon('heart','code-heart')}</div><h3>${doc.records.length?'ไม่พบรหัส':'ยังไม่มีรหัส'}</h3>${doc.records.length?'<button onclick="CodeLibrary.clearSearch()">ดูรหัสทั้งหมด</button>':''}</div>`;
 }
 function goToPage(value){
  if(!Number.isInteger(value))return;
  const next=Math.max(1,Math.min(value,Math.max(1,Math.ceil(filtered().length/pageSize))));if(next===page)return;
  page=next;renderResults();
  const heading=$('codeCount');heading.focus({preventScroll:true});heading.scrollIntoView?.({block:'start'});
 }
 function detail(id){
  const r=doc.records.find(x=>x.id===id);if(!r)return;
  modal('รายละเอียดรหัส '+r.code,`<div class="code-detail-view"><div class="code-detail-title"><span class="code-badge">${esc(r.code)}</span><h3>${esc(r.disease)}</h3></div><dl class="code-details">${detailsKinds.map(([k,t])=>'<div class="'+(k==='note'?'code-note':'')+'"><dt>'+icon(k)+' '+t.replace('มี','')+'</dt><dd>'+esc(r[k]||'ยังไม่ได้ระบุ')+'</dd></div>').join('')}</dl></div>`,'<button onclick="closeModal()">ปิด</button><button class="primary" onclick="CodeLibrary.edit(\''+r.id+'\')" '+(busy?'disabled':'')+'>แก้ไขรายการนี้</button>');
 }
 function favorite(id){
  if(busy||loadError)return;
  try{const r=doc.records.find(x=>x.id===id);if(!r)return;commit(CodeCatalog.upsert(doc.records,{...r,favorite:!r.favorite},id))}catch(e){error(e)}
 }
 function edit(id=''){
  if(busy||loadError)return;
  const r=doc.records.find(x=>x.id===id)||{code:category.length===1?category[0]:'A',disease:'',conditions:'',procedures:'',note:''};
  if(id&&!r.id){toast('ไม่พบรายการนี้ กรุณาเปิดใหม่');return}
  modal(id?'แก้ไขรหัส '+r.code:'เพิ่มโค้ดรหัส',`<form id="codeForm" class="code-form" onsubmit="event.preventDefault();CodeLibrary.save('${id}')"><div class="code-form-grid"><label class="field">หมวด<select id="codeLetter">${'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(c=>'<option '+(c===r.code[0]?'selected':'')+'>'+c+'</option>').join('')}</select></label><label class="field">เลขหลังหมวด<input id="codeNumber" required maxlength="31" inputmode="decimal" pattern="[0-9]+([.][0-9]+)?" value="${esc(r.code.slice(1))}" placeholder="เช่น 00 หรือ 00.1"></label></div><label class="field">ชื่อโรค<input id="codeDisease" required maxlength="500" value="${esc(r.disease)}" placeholder="กรอกชื่อโรค"></label>${[['conditions','เงื่อนไข'],['procedures','หัตถการ'],['note','Note เพิ่มเติม']].map(([k,label])=>'<label class="field">'+label+' <small>(ไม่บังคับ)</small><textarea id="code-'+k+'" maxlength="8000" rows="3">'+esc(r[k])+'</textarea></label>').join('')}<p id="codeFormError" class="code-message" role="alert"></p><p class="help">ใช้รหัสและเลขซ้ำกันได้ แต่ละรายการแก้ไขหรือลบแยกกันได้</p></form>`,'<button onclick="closeModal()">ยกเลิก</button><button class="primary" type="submit" form="codeForm">บันทึกรหัส</button>');
  $('codeNumber').focus();
 }
 function save(id){
  try{
   if(!$('codeForm').reportValidity())return;
   const r={code:$('codeLetter').value+$('codeNumber').value,disease:$('codeDisease').value};
   for(const k of ['conditions','procedures','note'])r[k]=$('code-'+k).value;
   commit(CodeCatalog.upsert(doc.records,r,id||null));closeModal();toast('บันทึกรหัสแล้ว'+(storageWarning?' · '+storageWarning:''));
  }catch(e){$('codeFormError').textContent=e.message}
 }
 function remove(id){if(busy)return;const r=doc.records.find(x=>x.id===id);if(!r)return;modal('ลบรหัส '+r.code,'<p>ลบรายการ <b>'+esc(r.code)+' · '+esc(r.disease)+'</b> ออกจากคลังนี้หรือไม่?</p><p class="help">ลบเฉพาะรายการนี้ รายการอื่นที่ใช้รหัสเดียวกันยังอยู่</p>','<button onclick="closeModal()">ยกเลิก</button><button onclick="CodeLibrary.confirmRemove(\''+r.id+'\')">ลบรายการนี้</button>')}
 function confirmRemove(id){try{commit(doc.records.filter(r=>r.id!==id));closeModal();toast('ลบรายการแล้ว')}catch(e){error(e)}}
 function hasCurrentBackup(){return backedUpRecords.get(store)===JSON.stringify(doc.records)}
 function backupStatus(){return hasCurrentBackup()?'ดาวน์โหลดสำรอง JSON ของข้อมูลล่าสุดแล้ว':'ยังไม่ได้สำรอง JSON ล่าสุดในการเปิดหน้านี้'}
 function files(){pendingClear=null;modal('จัดการสมุดโค้ดของฉัน',`<div class="code-file-menu">
  <section class="code-file-section"><h3>ส่งออก Excel</h3><div class="code-export-row"><label class="field">รายการที่ต้องการ<select id="codeExportScope"><option value="all">ทั้งคลัง · ${doc.records.length} รายการ</option><option value="filtered">ผลค้นหาปัจจุบัน · ${filtered().length} รายการ</option></select></label><button class="primary" onclick="CodeLibrary.excel(document.getElementById('codeExportScope').value==='filtered')">ดาวน์โหลด Excel</button></div></section>
  <section class="code-file-section"><h3>สำรองและนำกลับมาใช้</h3><div class="code-file-actions"><button onclick="CodeLibrary.backup()">สำรอง JSON</button><button onclick="document.getElementById('codeImport').click()" ${busy||loadError?'disabled':''}>นำเข้า JSON</button></div><p id="codeBackupStatus" role="status">${backupStatus()}</p></section>
  <section class="code-file-section code-sync-section"><h3>${icon('cloud')} ซิงก์ข้ามเครื่อง</h3><p>${esc(status())}</p><p>เมื่อเข้าสู่ระบบ การแก้ไขจะส่งขึ้นออนไลน์อัตโนมัติ ใช้บัญชีเดิมบนอีกเครื่องเพื่อโหลดข้อมูล คนละบัญชีมีคลังแยกกัน</p><button onclick="CodeLibrary.cloud()" ${busy?'disabled':''}>${session?'บัญชีและสถานะการซิงก์':'เข้าสู่ระบบ'}</button></section>
  <section class="code-file-section code-delete-section"><h3>ลบโค้ดรหัสทั้งหมด</h3><p>ลบทั้งคลังที่เปิดอยู่ ${doc.records.length} รายการ รวมหมวดที่ไม่ได้เลือก โดยไม่ลบตารางเวร</p><button class="code-danger-button" onclick="CodeLibrary.removeAll()" ${busy||loadError||!doc.records.length?'disabled':''}>${icon('trash')} ลบโค้ดรหัสทั้งหมด</button></section>
  ${store!==LOCAL?'<button class="code-local-link" onclick="CodeLibrary.local()" '+(busy?'disabled':'')+'>เปิดสมุดที่บันทึกในเครื่อง</button>':''}<input id="codeImport" type="file" accept=".json,application/json" class="hidden" onchange="CodeLibrary.importFile(this)">${loadError?'<p class="code-message">'+esc(loadError)+'</p><button onclick="CodeLibrary.recover()">ดาวน์โหลดข้อมูลเดิมและเริ่มคลังใหม่</button>':''}</div>`)}
 function backup(){
  try{
   download(JSON.stringify(CodeCatalog.backup(doc.records),null,2),'CodeLibrary-'+new Date().toISOString().slice(0,10)+'.json','application/json');
   backedUpRecords.set(store,JSON.stringify(doc.records));
   for(const id of ['codeBackupStatus','codeDeleteBackupStatus']){const label=$(id);if(label)label.textContent=backupStatus()}
   return true;
  }catch(e){error(e);return false}
 }
 function removeAll(){
  if(busy||loadError||!doc.records.length)return;
  pendingClear={store,records:JSON.stringify(doc.records)};
  if(hasCurrentBackup()){clearAll();return}
  modal('ลบโค้ดรหัสทั้งหมด',`<p id="codeDeleteBackupStatus" role="status">${backupStatus()}</p><p>ยืนยันลบโค้ดรหัสทั้งหมด <b>${doc.records.length} รายการ</b> จากคลังที่เปิดอยู่หรือไม่?</p><p class="help">กู้คืนได้ด้วยการนำเข้าไฟล์สำรอง JSON เท่านั้น ตารางเวรยังอยู่เหมือนเดิม</p>`,'<button onclick="CodeLibrary.cancelRemoveAll()">ยกเลิก</button><button onclick="CodeLibrary.backup()">สำรอง JSON ก่อน</button><button class="code-danger-button" onclick="CodeLibrary.confirmRemoveAll()">ยืนยันลบทั้งหมด</button>');
 }
 function cancelRemoveAll(){pendingClear=null;closeModal()}
 function confirmRemoveAll(){if(!$('modal').open||$('modalTitle').textContent!=='ลบโค้ดรหัสทั้งหมด')return;clearAll()}
 function clearAll(){
  if(busy||loadError||!pendingClear||!doc.records.length)return;
  const expected=pendingClear;pendingClear=null;
  if(expected.store!==store||expected.records!==JSON.stringify(doc.records)){error(Error('ข้อมูลเปลี่ยนระหว่างรอยืนยัน กรุณากดลบทั้งหมดใหม่'));return}
  try{
   const count=doc.records.length;
   persist({...doc,records:[],dirty:true});backedUpRecords.delete(store);scheduleAutoSync();
   category=[];query='';kind=[];favoritesOnly=false;page=1;message='';render();closeModal();
   toast('ลบโค้ดรหัสแล้ว '+count+' รายการ'+(storageWarning?' · '+storageWarning:''));
  }catch(e){error(e)}
 }
 function excel(only){const rows=only?filtered():doc.records;try{download(CodeCatalog.xlsx(rows),'CodeLibrary-'+(only?'filtered-':'')+new Date().toISOString().slice(0,10)+'.xlsx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');toast('ส่งออก Excel '+rows.length+' รหัสแล้ว')}catch(e){error(e)}}
 async function importFile(input){
  const file=input.files[0];input.value='';if(!file||busy)return;
  const target=store;
  try{
   if(file.size>CodeCatalog.MAX_BYTES)throw Error('ไฟล์ใหญ่เกิน 4.5 MB');
   const incoming=CodeCatalog.parseBackup(JSON.parse(await file.text()));
   if(store!==target)throw Error('คลังถูกเปลี่ยนระหว่างอ่านไฟล์ กรุณานำเข้าใหม่');
   const next=CodeCatalog.merge(doc.records,incoming),added=next.length-doc.records.length;
   commit(next);closeModal();toast('นำเข้าแล้ว เพิ่ม '+added+' รหัส');
  }catch(e){error(e)}
 }
 function cloud(){
  const logged=!!session;
  const disabled=busy?'disabled':'';
  const notice=`<p id="cloudMessage" class="code-message account-notice" role="status" aria-live="polite">${esc(autoSyncError||message)}</p>`;
  const intro=`<div class="account-welcome"><span class="account-avatar">${icon('user')}<span class="kitty-bow" aria-hidden="true"></span></span><div><p class="account-kicker">${logged?'บัญชีของคุณ':'โปรแกรมพฤกษา'}</p><h3>${logged?'สวัสดี, '+esc(session.username):'ยินดีต้อนรับ'}</h3><p class="account-caption">${logged?'คลังโค้ดรหัสของคุณ':'เข้าสู่ระบบเพื่อเปิดคลังโค้ดรหัส'}</p></div>${logged?'<span class="account-signed-in">'+icon('check')+' เข้าสู่ระบบแล้ว</span>':''}</div>`;
  let content;
  if(logged){
   const issue=loadError||storageWarning||autoSyncError;
   const state=issue?'warning':busy||autoSyncTask?'working':doc.dirty?'pending':'ready';
   const heading=issue?'ยังซิงก์ข้อมูลไม่สำเร็จ':busy||autoSyncTask?'กำลังบันทึกออนไลน์…':doc.dirty?'รอบันทึกอัตโนมัติ':'เปิดซิงก์อัตโนมัติแล้ว';
   const detail=issue?(autoSyncBlocked?'ข้อมูลยังอยู่ในเครื่อง ตรวจข้อความด้านล่าง':autoSyncError?'ข้อมูลยังอยู่ในเครื่อง จะลองส่งอีกครั้งอัตโนมัติ':issue):(busy||autoSyncTask?'กรุณารอสักครู่':doc.dirty?'กำลังเตรียมส่งรายการล่าสุด':'เพิ่มหรือแก้ไขรหัส ระบบจะบันทึกขึ้นออนไลน์ให้');
   content=`${intro}<div class="account-stats"><div><span>รหัสในคลังนี้</span><strong>${doc.records.length}<small>รายการ</small></strong></div><div><span>${icon('star')} รายการโปรด</span><strong>${doc.records.filter(r=>r.favorite).length}<small>รายการ</small></strong></div></div><section class="account-sync-status account-sync-${state}" aria-label="สถานะข้อมูล"><span class="account-status-icon">${icon(issue?'conditions':busy||autoSyncTask?'cloud':doc.dirty?'upload':'check')}</span><div><h4>${heading}</h4><p>${esc(detail)}</p></div></section>${notice}<div class="account-actions"><button class="primary account-upload" onclick="CodeLibrary.push()" ${busy||autoSyncTask||loadError?'disabled':''}>${icon('upload')}<span>${busy?'กำลังเชื่อมต่อ…':'บันทึกขึ้นออนไลน์'}</span></button><div class="account-secondary-actions"><button onclick="CodeLibrary.pullPrompt()" ${busy||autoSyncTask||loadError?'disabled':''}><span class="account-action-icon">${icon('download')}</span><span><b>โหลดจากออนไลน์</b><small>ใช้ข้อมูลที่บันทึกไว้บนออนไลน์</small></span>${icon('arrow','account-action-arrow')}</button><button onclick="CodeLibrary.copyLocal()" ${busy||autoSyncTask||loadError?'disabled':''}><span class="account-action-icon">${icon('plus')}</span><span><b>รวมรหัสจากในเครื่อง</b><small>นำมาเพิ่มในคลังบัญชีนี้</small></span>${icon('arrow','account-action-arrow')}</button></div></div><div class="account-session-actions"><button class="account-signout" onclick="CodeLibrary.logout()" ${disabled}>${icon('logout')} ออกจากระบบ</button></div>`;
  }else{
   content=`${intro}${notice}<form id="cloudForm" class="code-form account-login-form" onsubmit="event.preventDefault();CodeLibrary.login()"><label class="field">ชื่อผู้ใช้<input id="cloudUsername" type="text" required minlength="3" maxlength="32" pattern="[A-Za-z][A-Za-z0-9._-]{2,31}" value="${esc(loginUsername)}" placeholder="teen" autocomplete="username" autocapitalize="none" spellcheck="false" ${disabled}></label><div class="field"><label for="cloudPassword">รหัสผ่าน</label><div class="account-password"><input id="cloudPassword" type="password" required minlength="6" autocomplete="current-password" placeholder="กรอกรหัสผ่าน" ${disabled}><button id="cloudPasswordToggle" class="account-password-toggle" type="button" onclick="CodeLibrary.togglePassword()" aria-controls="cloudPassword" aria-label="แสดงรหัสผ่าน" aria-pressed="false" title="แสดงรหัสผ่าน" ${disabled}>${icon('eye')}</button></div></div><button class="primary account-submit" type="submit" ${disabled}>${busy?'กำลังเข้าสู่ระบบ…':'เข้าสู่ระบบ'}${icon('arrow')}</button></form>`;
  }
  modal(logged?'บัญชีผู้ใช้':'เข้าสู่ระบบ',`<div class="account-panel" aria-busy="${busy||!!autoSyncTask}">${content}</div>`);
  $('modalFoot').innerHTML='';
 }
 function togglePassword(){
  const input=$('cloudPassword'),button=$('cloudPasswordToggle');
  if(!input||!button)return;
  const visible=input.type==='password';
  input.type=visible?'text':'password';
  const label=visible?'ซ่อนรหัสผ่าน':'แสดงรหัสผ่าน';
  button.setAttribute('aria-label',label);button.setAttribute('title',label);button.setAttribute('aria-pressed',String(visible));
  button.innerHTML=icon(visible?'eye-off':'eye');
 }
 async function request(path,{method='GET',body,auth=true,retry=true}={}){
  if(!config)throw Error('ยังไม่ได้ตั้งค่า Supabase');
  if(auth&&!session)throw Error('กรุณาเข้าสู่ระบบใหม่');
  const headers={apikey:config.key,'Content-Type':'application/json'};
  if(auth)headers.Authorization='Bearer '+session.access_token;
  let response;
  try{response=await fetch(config.url+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(25000)})}catch{throw Object.assign(Error('เชื่อมต่อไม่ได้ กรุณาตรวจอินเทอร์เน็ต ข้อมูลในเครื่องยังอยู่'),{retryable:true})}
  let result;try{result=await response.json()}catch{result=null}
  if(response.status===401&&auth&&retry&&session.refresh_token){
   try{
    const refreshed=await request('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:{refresh_token:session.refresh_token},auth:false});
    if(!refreshed?.access_token||refreshed.user?.id!==session.user.id)throw Error('กรุณาเข้าสู่ระบบใหม่');
    session={...refreshed,username:session.username};return request(path,{method,body,auth,retry:false});
   }catch(e){session=null;renderAccount();throw e}
  }
  if(!response.ok){
   if(result?.code==='40001')throw Object.assign(Error('ข้อมูลออนไลน์เปลี่ยนจากเครื่องอื่น กรุณาสำรอง JSON ในเครื่อง แล้วโหลดข้อมูลออนไลน์ก่อนรวมรายการและส่งใหม่'),{code:'40001'});
   if(result?.error_code==='email_not_confirmed')throw Error('บัญชียังไม่พร้อมใช้งาน กรุณาให้ผู้พัฒนายืนยันบัญชีใน Supabase ก่อน');
   if(response.status===401||result?.error_code==='invalid_credentials'){if(auth){session=null;renderAccount()}throw Error('เข้าสู่ระบบไม่ได้ Username หรือ Password ไม่ตรงกับบัญชีที่ตั้งไว้ หากยังไม่ได้สร้างบัญชี ให้ผู้ดูแลตั้งค่าบัญชีก่อน')}
   if(result?.code==='PGRST202'||result?.code==='42P01')throw Error('ยังไม่พบตารางหรือฟังก์ชัน กรุณารัน supabase/code-library.sql ใน SQL Editor ก่อน');
   throw Object.assign(Error('เชื่อมต่อไม่สำเร็จ: '+(result?.msg||result?.message||result?.error_description||response.status)),{retryable:response.status===429||response.status>=500});
  }
  return result;
 }
 async function operation(fn){
  if(busy)return;busy=true;cancelAutoSync();message='กำลังเชื่อมต่อ…';render();cloud();
  try{if(autoSyncTask)await autoSyncTask;await fn()}catch(e){message=e.message;if(e.code==='40001'){autoSyncBlocked=true;autoSyncError=e.message}toast(message)}
  finally{busy=false;render();if($('modal').open&&['เข้าสู่ระบบ','บัญชีผู้ใช้'].includes($('modalTitle').textContent))cloud();scheduleAutoSync()}
 }
 async function login(){
  if(busy||!$('cloudForm').reportValidity())return;
  let identity;try{identity=CodeCatalog.loginIdentity($('cloudUsername').value,config.url)}catch(e){$('cloudMessage').textContent=e.message;return}
  const password=$('cloudPassword').value;
  if(password.length<6){$('cloudMessage').textContent='Password ต้องมีอย่างน้อย 6 ตัวอักษร';return}
  const {username,email}=identity;
  loginUsername=username;$('cloudPassword').value='';
  await operation(async()=>{
   const result=await request('/auth/v1/token?grant_type=password',{method:'POST',body:{email,password},auth:false});
   if(typeof result?.user?.id!=='string'||!result.user.id||!result.access_token)throw Error('ข้อมูลเข้าสู่ระบบไม่ครบถ้วน');
   switchStore('shiftplanner-codes-account:'+config.url+':'+result.user.id);
   session={...result,username,user:{...result.user,email:result.user.email||email}};
   // Load a clean account immediately; resume pending uploads after login using the saved revision.
   if(loadError){message='เข้าสู่ระบบแล้ว · '+loadError;return}
   if(doc.dirty){message='เข้าสู่ระบบแล้ว กำลังเตรียมส่งข้อมูลที่ยังไม่ได้ส่งจากเครื่องนี้อัตโนมัติ';return}
   try{
    const remote=await readRemote();
    if(remote){persist(remote);page=1;message='เข้าสู่ระบบแล้ว โหลดคลัง '+doc.records.length+' รหัสเรียบร้อย'}
    else message='';
   }catch(e){message=session?'เข้าสู่ระบบแล้ว แต่โหลดคลังไม่ได้: '+e.message:'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่'}
  });
 }
 async function readRemote(){
  if(!session)throw Error('กรุณาเข้าสู่ระบบใหม่');
  const result=await request('/rest/v1/code_libraries?select=records,revision&owner_id=eq.'+encodeURIComponent(session.user.id));
  if(!Array.isArray(result)||result.length>1)throw Error('รูปแบบข้อมูลออนไลน์ไม่ถูกต้อง');
  return result.length?CodeCatalog.document({version:1,records:result[0].records,revision:result[0].revision,dirty:false}):null;
 }
 async function push(){
  if(!session)return;
  await operation(async()=>{
   const count=await saveRemote();message='บันทึกออนไลน์แล้ว '+count+' รหัส';toast(message);
  });
 }
 function pullPrompt(){
  if(!session||busy||loadError)return;
  modal('โหลดคลังจากออนไลน์','<p>โหลดข้อมูลออนไลน์มาแทนคลังบัญชีนี้ในเครื่อง'+(doc.dirty?' ซึ่งมีการแก้ไขที่ยังไม่ได้ส่ง':'')+'</p><p>ระบบจะดาวน์โหลด JSON สำรองรายการปัจจุบันก่อนแทนที่ เมื่อโหลดสำเร็จตรวจสอบว่าไฟล์สำรองถูกดาวน์โหลดแล้ว</p><p class="help">คลังในเครื่องที่แยกไว้จะไม่ถูกแทนที่</p>','<button onclick="CodeLibrary.cloud()">ยกเลิก</button><button class="primary" onclick="CodeLibrary.pull()">สำรองแล้วโหลดออนไลน์</button>');
 }
 async function pull(){
  if(!session)return;
  // Switch back so operation status and errors stay visible in the same dialog.
  cloud();
  await operation(async()=>{
   if(loadError)throw Error(loadError);
   const next=await readRemote();
   if(!next){message='ยังไม่มีข้อมูลออนไลน์ กรุณารวมรหัสจากคลังในเครื่องหรือเพิ่มรหัส แล้วส่งขึ้นออนไลน์';return}
   if(!backup())throw Error('สำรอง JSON ไม่สำเร็จ จึงยังไม่แทนที่ข้อมูลในเครื่อง');
   persist(next);autoSyncError='';autoSyncBlocked=false;autoSyncRetries=0;page=1;message='โหลดข้อมูลออนไลน์แล้ว '+doc.records.length+' รหัส';toast(message);
  });
 }
 function copyLocal(){
  if(busy||!session)return;
  try{
   const raw=localStorage.getItem(LOCAL),incoming=raw?CodeCatalog.document(JSON.parse(raw)).records:[];
   commit(CodeCatalog.merge(doc.records,incoming));message='รวมรหัสในเครื่องแล้ว รอบันทึกออนไลน์อัตโนมัติ';cloud();
  }catch(e){message=e.message;cloud()}
 }
 async function logout(){
  if(busy||!session)return;
  await operation(async()=>{
   let warning='';
   if(doc.dirty){
    try{if(autoSyncBlocked)throw Error('รอแก้ไขข้อมูล');await saveRemote()}
    catch{warning=' · ยังมีข้อมูลรอส่งในเครื่องนี้ เข้าสู่ระบบอีกครั้งเพื่อส่งต่อ'}
   }
   try{await request('/auth/v1/logout?scope=local',{method:'POST'})}catch(e){warning+=' · ยืนยันการออกจากระบบกับเซิร์ฟเวอร์ไม่ได้ กรุณาเข้าสู่ระบบใหม่เมื่อเชื่อมต่อได้'}
   finally{
    session=null;loginUsername='teen';
    try{switchStore(LOCAL)}catch(e){warning+=' · '+e.message}
   }
   message='ออกจากระบบบนเครื่องนี้แล้ว'+warning;toast(message);
  });
  if($('modal').open&&$('modalTitle').textContent==='เข้าสู่ระบบ')closeModal();
 }
 function local(){if(busy)return;if(autoSyncTask){toast('กำลังบันทึกออนไลน์ กรุณารอสักครู่');return}try{switchStore(LOCAL);session=null;render();closeModal()}catch(e){error(e)}}
 function recover(){
  if(!loadError||busy||stale){if(stale)toast('กรุณาสำรอง JSON แล้วรีเฟรชหน้าเพื่อโหลดข้อมูลจากอีกแท็บ');return}
  modal('เริ่มคลังรหัสใหม่','<p>ระบบจะดาวน์โหลดข้อมูลเดิมเป็น JSON สำหรับกู้คืน จากนั้นเริ่มคลังว่าง กรุณาเก็บไฟล์ที่ดาวน์โหลดไว้</p>','<button onclick="closeModal()">ยกเลิก</button><button onclick="CodeLibrary.confirmRecover()">ดาวน์โหลดข้อมูลเดิมและเริ่มใหม่</button>');
 }
 function confirmRecover(){
  if(stale||busy)return;
  download(rawBackup,'CodeLibrary-recovery-'+Date.now()+'.json','application/json');
  loadError='';persist(empty());closeModal();render();
 }
 window.addEventListener('keydown',e=>{
  if(currentView!=='codes'||e.defaultPrevented||e.isComposing||e.altKey||e.ctrlKey||e.metaKey||e.shiftKey||$('modal').open)return;
  if(e.key!=='ArrowLeft'&&e.key!=='ArrowRight')return;
  if(e.target?.isContentEditable||e.target?.closest?.('input,textarea,select,[contenteditable],[role="textbox"],[role="combobox"],[role="slider"]'))return;
  e.preventDefault();goToPage(page+(e.key==='ArrowRight'?1:-1));
 });
 window.addEventListener('beforeunload',e=>{if(storageWarning||busy||autoSyncTask||(session&&doc.dirty)){e.preventDefault();e.returnValue=''}});
 window.addEventListener('online',()=>scheduleAutoSync(0));
 window.addEventListener('focus',()=>{if(doc.dirty)scheduleAutoSync(0)});
 window.addEventListener('storage',e=>{
  if(e.key!==store)return;
  // A different tab must not be silently overwritten by this tab's stale copy.
  stale=true;loadError='คลังนี้ถูกแก้ไขจากอีกแท็บ กรุณาสำรอง JSON ของแท็บนี้ แล้วรีเฟรชก่อนแก้ไขต่อ';message=loadError;
  if(currentView==='codes')render();
 });
 if(currentView==='codes')render();else renderAccount();
 return {render,edit,save,remove,confirmRemove,files,backup,excel,importFile,cloud,togglePassword,login,push,pullPrompt,pull,copyLocal,logout,local,recover,confirmRecover,motion,nextSpeech,suspend,detail,favorite,goToPage,removeAll,confirmRemoveAll,cancelRemoveAll,lookup,openSearch,
  favorites(){favoritesOnly=!favoritesOnly;page=1;renderFavorites();renderResults()},search(v){query=v;page=1;renderResults()},kind(v,checked){if(!['conditions','procedures','note'].includes(v))return;kind=kind.filter(k=>k!==v);if(checked)kind.push(v);page=1;renderResults()},category(v){if(v==='')category=[];else if(/^[A-Z]$/.test(v))category=category.includes(v)?category.filter(c=>c!==v):[...category,v].sort();else return;page=1;render()},page(delta){goToPage(page+delta)},clearSearch(){category=[];query='';kind=[];favoritesOnly=false;page=1;render()}};
})();
