/* Standalone-compatible UI. No external libraries or cloud credentials required offline. */
const CodeLibrary=(()=>{
 'use strict';
 const LOCAL='shiftplanner-codes-local-v1',ACTIVE='shiftplanner-codes-active-v1',CONFIG='shiftplanner-codes-cloud-v1';
 const empty=()=>({version:1,records:[],revision:0,dirty:false});
 // Public project configuration only. Passwords and session tokens are never bundled.
 const defaultConfig=CodeCatalog.config('https://omtcyjoewqtfsreshgfu.supabase.co','sb_publishable_3Ixd4qU4vGBYVRJUqTurSg_vFabVA5B');
 let store=LOCAL,doc=empty(),config=defaultConfig,session=null,loadError='',rawBackup='',storageWarning='',stale=false,busy=false,message='',category='',query='',kind=[],page=1;
 const pageSize=30;
 let motionPaused=false,favoritesOnly=false,speechIndex=0,speechTimer;
 const speeches=['สวัสดีคนเก่งของเค้า','สู้ๆนะไอ้อ้วงง','เค้ารักอ้วนที่สุดในโลกเลยย','มากอดหน่อย','คนเก่งของเค้า','หอมแก้มม.'];
 const detailsKinds=[['conditions','มีเงื่อนไข'],['procedures','มีหัตถการ'],['note','มี Note']];
 // Draw icons as SVG so hearts and controls work even without an emoji font.
 function icon(name,extra=''){
  const paths={heart:'<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>',star:'<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z"/>',search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',plus:'<path d="M12 5v14M5 12h14"/>',file:'<path d="M14 3H5v18h14V8Zm0 0v5h5M8 12h8M8 16h6"/>',edit:'<path d="m15 4 5 5M4 20l5-1L21 7l-5-5L4 14Z"/>',trash:'<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/>',pause:'<path d="M8 5v14M16 5v14"/>',play:'<path d="m8 4 12 8-12 8Z"/>',conditions:'<path d="m12 3 10 18H2Z"/><path d="M12 9v5M12 17v.1"/>',procedures:'<path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6Z"/>',note:'<path d="M4 3h16v18H4ZM8 8h8M8 12h8M8 16h5"/>',arrow:'<path d="m9 5 7 7-7 7"/>',cloud:'<path d="M7 18a5 5 0 1 1-1-9 6 6 0 0 1 12-1 5 5 0 0 1-1 10M12 12v9m-3-3 3 3 3-3"/>'};
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
 try{const active=localStorage.getItem(ACTIVE);if(active&&/^shiftplanner-codes-account:/.test(active))store=active;const c=localStorage.getItem(CONFIG);if(c){const parsed=JSON.parse(c);config=CodeCatalog.config(parsed.url,parsed.key)}}catch{}
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
  store=next;doc=read(store);try{localStorage.setItem(ACTIVE,store)}catch{}page=1;category='';query='';kind=[];favoritesOnly=false;message='';
 }
 function commit(rows){if(busy)throw Error('รอการเชื่อมต่อให้เสร็จก่อน');persist({...doc,records:rows,dirty:true});page=1;render()}
 function error(e){message=e.message||String(e);toast(message);if(currentView==='codes')render()}
 function filtered(){return CodeCatalog.filter(doc.records,category,query,kind).filter(r=>!favoritesOnly||r.favorite)}
 function status(){
  if(loadError)return loadError;
  if(storageWarning)return storageWarning;
  if(store===LOCAL)return 'บันทึกเฉพาะเครื่องนี้ · '+doc.records.length+' รายการ';
  return (session?'คลังบัญชี '+session.user.email:'คลังบัญชีที่เคยเปิด · ยังไม่ได้เข้าสู่ระบบ')+' · '+(doc.dirty?'มีข้อมูลรอส่งออนไลน์':'ข้อมูลที่โหลดไว้ รุ่น '+doc.revision);
 }
 function render(){
  const host=$('codesView');if(!host)return;
  const counts=Object.fromEntries('ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(c=>[c,doc.records.filter(r=>r.code[0]===c).length]));
  host.innerHTML=`<div class="panel kitty-library">
   <div class="kitty-hero">
    <div class="kitty-welcome"><span class="kitty-eyebrow"><span class="kitty-bow" aria-hidden="true"></span> MY LITTLE CODE BOOK</span><h2>คลังโค้ดรหัส<span class="kitty-title-heart">${icon('heart','code-heart')}</span></h2><p>ทุกโค้ดสำคัญ เก็บไว้ใกล้มือ</p><span class="kitty-hero-note">ทั้งหมด ${doc.records.length} รายการ · รายการโปรด ${doc.records.filter(r=>r.favorite).length} รายการ</span></div>
    <div class="kitty-mascot"><div class="kitty-speech"><span id="kittySpeechText">${esc(speeches[speechIndex])}</span>${icon('heart','code-heart')}</div><div id="kittyCharacter" class="kitty-character${motionPaused?' is-paused':''}" role="img" aria-label="Hello Kitty โบกมือทักทาย"><img class="kitty-character-body" src="assets/kitty/hello-kitty-cutout.png" alt="" width="1024" height="1024"><img class="kitty-character-arm" src="assets/kitty/hello-kitty-cutout.png" alt="" width="1024" height="1024"><span class="kitty-wave-mark" aria-hidden="true">${icon('heart','code-heart')}</span></div><button id="kittyMotion" class="kitty-motion" onclick="CodeLibrary.motion()" aria-pressed="${motionPaused}" aria-label="${motionPaused?'เล่นแอนิเมชันและข้อความคิตตี้':'พักแอนิเมชันและข้อความคิตตี้'}">${icon(motionPaused?'play':'pause')}</button></div>
   </div>
   <div class="code-toolbar"><p id="codeSaveStatus" class="code-save" role="status"><span class="code-save-dot" aria-hidden="true"></span>${esc(status())}</p><div class="code-main-actions"><button class="primary code-add-button" onclick="CodeLibrary.edit()" ${busy||loadError?'disabled':''}>${icon('plus')} เพิ่มรหัสใหม่</button><button class="code-data-button" onclick="CodeLibrary.files()">${icon('file')} จัดการข้อมูล</button></div></div>
   <p id="codeMessage" class="code-message" role="status">${esc(message)}</p>
   <div class="code-tools"><label class="field code-search"><span>ค้นหาในสมุดโค้ด</span><span class="code-search-box"><span class="code-search-icon">${icon('search')}</span><input id="codeSearch" type="search" placeholder="พิมพ์รหัส ชื่อโรค เงื่อนไข หรือโน้ต…" value="${esc(query)}" oninput="CodeLibrary.search(this.value)"></span></label></div>
   <div id="codeFavorites" class="code-favorites"></div>
   <div class="code-filter-panel"><div class="code-category-heading"><span>เลือกหมวดรหัส</span><span>A — Z</span></div><div class="code-alphabet" role="group" aria-label="หมวดรหัส A ถึง Z"><button aria-pressed="${!category}" onclick="CodeLibrary.category('')">ทั้งหมด<small>${doc.records.length}</small></button>${Object.entries(counts).map(([c,n])=>'<button class="'+(!n?'code-category-empty':'')+'" aria-pressed="'+(category===c)+'" onclick="CodeLibrary.category(\''+c+'\')">'+c+'<small>'+n+'</small></button>').join('')}</div>
   <fieldset class="code-kind" aria-describedby="codeKindHint"><legend>รายละเอียดที่ต้องการ</legend><div class="code-kind-options">${detailsKinds.map(([v,t])=>'<label class="code-kind-option code-kind-'+v+'"><input type="checkbox" name="codeKind" value="'+v+'" '+(kind.includes(v)?'checked':'')+' onchange="CodeLibrary.kind(this.value,this.checked)">'+icon(v)+'<span>'+t+'</span></label>').join('')}</div><p id="codeKindHint">เลือกได้หลายข้อ · แสดงรหัสที่มีครบตามที่เลือก · ไม่เลือก = ทั้งหมด</p></fieldset></div>
   <div class="code-results-heading"><p class="code-count" id="codeCount" role="status"></p><button id="codeClear" class="code-clear${category||query||kind.length||favoritesOnly?'':' hidden'}" onclick="CodeLibrary.clearSearch()">ล้างตัวกรอง ×</button></div><div class="code-results" id="codeResults"></div>
   <div class="kitty-library-foot"><span class="kitty-bow" aria-hidden="true"></span> a little care for every little detail ${icon('heart','code-heart')}</div></div>`;
  renderFavorites();
  renderResults();
  scheduleSpeech();
 }
 function renderFavorites(){
  const rows=doc.records.filter(r=>r.favorite);
  $('codeFavorites').innerHTML='<button class="code-favorites-toggle" aria-pressed="'+favoritesOnly+'" onclick="CodeLibrary.favorites()">'+icon('star')+' รายการโปรด <span>'+rows.length+'</span></button>'+(rows.length?'<div class="code-favorite-shortcuts">'+rows.slice(0,8).map(r=>'<button onclick="CodeLibrary.detail(\''+r.id+'\')" title="'+esc(r.code+' · '+r.disease)+'">'+esc(r.code)+'<span>'+esc(r.disease)+'</span></button>').join('')+'</div>':'<span class="code-favorites-hint">กดดาวบนการ์ด เพื่อเก็บรหัสที่ใช้บ่อยไว้ตรงนี้</span>');
 }
 function renderResults(){
  const rows=filtered(),max=Math.max(1,Math.ceil(rows.length/pageSize));page=Math.min(page,max);
  $('codeCount').textContent='พบ '+rows.length+' จาก '+doc.records.length+' รหัส'+(category?' · หมวด '+category:'');
  $('codeClear').classList.toggle('hidden',!category&&!query&&!kind.length&&!favoritesOnly);
  const cards=rows.slice((page-1)*pageSize,page*pageSize).map(r=>`<article class="code-card" data-entry="${r.id}">
   <div class="code-card-head"><span class="code-badge">${esc(r.code)}</span><button class="code-star${r.favorite?' is-favorite':''}" onclick="CodeLibrary.favorite('${r.id}')" aria-pressed="${r.favorite}" aria-label="${r.favorite?'นำออกจาก':'เพิ่มใน'}รายการโปรด ${esc(r.code+' '+r.disease)}" ${busy||loadError?'disabled':''}>${icon('star')}</button></div>
   <h3>${esc(r.disease)}</h3><div class="code-tags">${detailsKinds.filter(([k])=>r[k]).map(([k,t])=>'<span class="code-tag code-tag-'+k+'">'+icon(k)+t+'</span>').join('')||'<span class="code-tag-empty">ยังไม่มีรายละเอียดเพิ่มเติม</span>'}</div>
   <p class="code-card-preview">${esc((r.note||r.conditions||r.procedures||'เพิ่มรายละเอียดที่อยากจำไว้ในรหัสนี้ได้เลย').slice(0,110))}</p>
   <div class="code-card-foot"><button class="primary code-detail-button" onclick="CodeLibrary.detail('${r.id}')">ดูรายละเอียด ${icon('arrow')}</button><button class="code-icon-button" onclick="CodeLibrary.edit('${r.id}')" aria-label="แก้ไข ${esc(r.code+' '+r.disease)}" title="แก้ไขรายการ" ${busy?'disabled':''}>${icon('edit')}</button><button class="code-icon-button code-delete" onclick="CodeLibrary.remove('${r.id}')" aria-label="ลบ ${esc(r.code+' '+r.disease)}" title="ลบรายการ" ${busy?'disabled':''}>${icon('trash')}</button></div>
  </article>`).join('');
  $('codeResults').innerHTML=rows.length?'<div class="code-card-grid">'+cards+'</div>'+(max>1?`<div class="code-pager"><button onclick="CodeLibrary.page(-1)" ${page===1?'disabled':''}>‹ ก่อนหน้า</button><span>หน้า ${page} / ${max}</span><button onclick="CodeLibrary.page(1)" ${page===max?'disabled':''}>ถัดไป ›</button></div>`:''):`<div class="code-empty"><div class="kitty-empty-icon" aria-hidden="true"><span class="kitty-bow"></span>${icon('heart','code-heart')}</div><h3>${doc.records.length?'ยังหาโค้ดนี้ไม่เจอเลย':'สมุดโค้ดเล่มเล็ก พร้อมให้เริ่มแล้ว'}</h3><p>${doc.records.length?'ลองเปลี่ยนคำค้น หรือเลือกหมวดอื่นดูนะ':'เลือกหมวดด้านบน แล้วกด “เพิ่มรหัส” เพื่อเก็บโค้ดแรกของเธอ'}</p>${doc.records.length?'<button onclick="CodeLibrary.clearSearch()">ดูรหัสทั้งหมด</button>':'<span class="kitty-empty-hint">เพิ่มรหัสแรกได้จากปุ่มด้านบน</span>'}</div>`;
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
  const r=doc.records.find(x=>x.id===id)||{code:category||'A',disease:'',conditions:'',procedures:'',note:''};
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
 function files(){modal('จัดการสมุดโค้ดของฉัน',`<div class="code-file-menu">
  <p class="code-file-intro">เก็บไว้ใช้ ส่งต่อ หรือสำรองข้อมูลได้ที่นี่ ${icon('heart','code-heart')}</p>
  <section class="code-file-section"><h3>ส่งออก Excel</h3><p>ไฟล์ .xlsx พร้อมรหัส ชื่อโรค และรายละเอียดครบทุกช่อง</p><div class="code-export-row"><label class="field">รายการที่ต้องการ<select id="codeExportScope"><option value="all">ทั้งคลัง · ${doc.records.length} รายการ</option><option value="filtered">ผลค้นหาปัจจุบัน · ${filtered().length} รายการ</option></select></label><button class="primary" onclick="CodeLibrary.excel(document.getElementById('codeExportScope').value==='filtered')">ดาวน์โหลด Excel</button></div></section>
  <section class="code-file-section"><h3>สำรองและนำกลับมาใช้</h3><p>เก็บไฟล์ JSON ไว้ย้ายเครื่องหรือนำกลับมาแก้ไขต่อ</p><div class="code-file-actions"><button onclick="CodeLibrary.backup()">สำรอง JSON</button><button onclick="document.getElementById('codeImport').click()" ${busy||loadError?'disabled':''}>นำเข้า JSON</button></div></section>
  <section class="code-file-section code-sync-section"><h3>${icon('cloud')} ซิงก์ข้ามเครื่อง</h3><p>${esc(status())}</p><p>การบันทึกในเบราว์เซอร์ยังไม่ใช่การส่งขึ้นออนไลน์ ต้องเข้าสู่ระบบแล้วกดส่งหรือโหลดข้อมูล คลังออนไลน์แยกตามบัญชี คนละบัญชีจะยังไม่เห็นคลังร่วมกัน</p><button onclick="CodeLibrary.cloud()" ${busy?'disabled':''}>เข้าสู่ระบบ / ส่งและโหลดข้อมูล</button></section>
  ${store!==LOCAL?'<button class="code-local-link" onclick="CodeLibrary.local()" '+(busy?'disabled':'')+'>เปิดสมุดที่บันทึกในเครื่อง</button>':''}<input id="codeImport" type="file" accept=".json,application/json" class="hidden" onchange="CodeLibrary.importFile(this)"><p class="help">รหัสเดียวกันเก็บได้หลายรายการ นำเข้าไฟล์เดิมซ้ำแล้วจะไม่เพิ่มรายการเดิมอีก</p>${loadError?'<p class="code-message">'+esc(loadError)+'</p><button onclick="CodeLibrary.recover()">ดาวน์โหลดข้อมูลเดิมและเริ่มคลังใหม่</button>':''}</div>`)}
 function backup(){download(JSON.stringify(CodeCatalog.backup(doc.records),null,2),'CodeLibrary-'+new Date().toISOString().slice(0,10)+'.json','application/json')}
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
  modal('ซิงก์ข้อมูลข้ามเครื่อง',`<div class="code-cloud-info"><b>${esc(status())}</b>${logged?'<p>บัญชี '+esc(session.user.email)+'</p>':''}<p>ข้อมูลที่เพิ่มในเครื่องจะยังอยู่เฉพาะเบราว์เซอร์นี้ จนกว่าจะกดส่งขึ้นออนไลน์</p><p>คลังออนไลน์ผูกกับบัญชี เมื่อเปิดอีกเครื่องต้องเข้าสู่บัญชีคลังเดิมแล้วกดโหลดข้อมูล คนละบัญชีมีคลังแยกกัน และยังไม่มีสิทธิ์คลังร่วมในรุ่นนี้</p></div><p id="cloudMessage" class="code-message" role="status">${esc(message)}</p>${logged?`<div class="code-cloud-actions"><button class="primary" onclick="CodeLibrary.push()" ${busy?'disabled':''}>ส่งข้อมูลขึ้นออนไลน์</button><button onclick="CodeLibrary.pullPrompt()" ${busy?'disabled':''}>โหลดข้อมูลจากออนไลน์</button><button onclick="CodeLibrary.copyLocal()" ${busy?'disabled':''}>รวมรหัสจากคลังในเครื่อง</button><button onclick="CodeLibrary.logout()" ${busy?'disabled':''}>ออกจากระบบ</button></div><p class="help">เริ่มครั้งแรก: โหลดคลังออนไลน์ถ้ามี แล้วรวมรหัสในเครื่องก่อนส่งขึ้นออนไลน์ การส่งรวมการลบรายการด้วย หากอีกเครื่องแก้ไขก่อน ระบบจะหยุดให้ตรวจสอบ</p>`:`<form id="cloudForm" class="code-form" onsubmit="event.preventDefault();CodeLibrary.login()"><label class="field">อีเมลของบัญชีคลังรหัส<input id="cloudEmail" type="email" required autocomplete="username"></label><label class="field">รหัสผ่าน<input id="cloudPassword" type="password" required autocomplete="current-password"></label><details class="code-cloud-settings"><summary>ตั้งค่าโปรเจกต์ (สำหรับผู้พัฒนา)</summary><label class="field">Project URL<input id="cloudUrl" type="url" required value="${esc(config?.url||'')}" placeholder="https://your-project.supabase.co"></label><label class="field">Publishable key / anon key<input id="cloudKey" required value="${esc(config?.key||'')}" placeholder="sb_publishable_…" autocomplete="off"></label></details><p class="help">ตั้งค่าโปรเจกต์ให้แล้ว ใช้บัญชีที่สร้างไว้ใน Authentication เมื่อรีเฟรชต้องเข้าสู่ระบบใหม่ ไม่เก็บรหัสผ่านไว้ในไฟล์โปรแกรม</p><button class="primary" type="submit" ${busy?'disabled':''}>เข้าสู่ระบบ</button></form>`}<p class="help">คู่มือสำหรับผู้พัฒนาอยู่ในไฟล์ ONLINE-DATABASE.md</p>`);
 }
 async function request(path,{method='GET',body,auth=true,retry=true}={}){
  if(!config)throw Error('ยังไม่ได้ตั้งค่า Supabase');
  if(auth&&!session)throw Error('กรุณาเข้าสู่ระบบใหม่');
  const headers={apikey:config.key,'Content-Type':'application/json'};
  if(auth)headers.Authorization='Bearer '+session.access_token;
  let response;
  try{response=await fetch(config.url+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(25000)})}catch{throw Error('เชื่อมต่อไม่ได้ กรุณาตรวจอินเทอร์เน็ตและสถานะโปรเจกต์ ข้อมูลในเครื่องยังอยู่')}
  let result;try{result=await response.json()}catch{result=null}
  if(response.status===401&&auth&&retry&&session.refresh_token){
   const refreshed=await request('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:{refresh_token:session.refresh_token},auth:false});
   session=refreshed;return request(path,{method,body,auth,retry:false});
  }
  if(!response.ok){
   if(result?.code==='40001')throw Error('ข้อมูลออนไลน์เปลี่ยนจากเครื่องอื่น กรุณาสำรอง JSON ในเครื่อง แล้วโหลดข้อมูลออนไลน์ก่อนรวมรายการและส่งใหม่');
   if(response.status===401)throw Error('เข้าสู่ระบบไม่ได้หรือหมดอายุ กรุณาตรวจอีเมล รหัสผ่าน และยืนยันอีเมลแล้วเข้าสู่ระบบใหม่');
   if(result?.code==='PGRST202'||result?.code==='42P01')throw Error('ยังไม่พบตารางหรือฟังก์ชัน กรุณารัน supabase/code-library.sql ใน SQL Editor ก่อน');
   throw Error('เชื่อมต่อไม่สำเร็จ: '+(result?.msg||result?.message||result?.error_description||response.status));
  }
  return result;
 }
 async function operation(fn){
  if(busy)return;busy=true;message='กำลังเชื่อมต่อ…';render();cloud();
  try{await fn()}catch(e){message=e.message;toast(message)}
  finally{busy=false;render();if($('modal').open&&$('modalTitle').textContent==='ซิงก์ข้อมูลข้ามเครื่อง')cloud()}
 }
 async function login(){
  if(busy||!$('cloudForm').reportValidity())return;
  let next;try{next=CodeCatalog.config($('cloudUrl').value,$('cloudKey').value)}catch(e){$('cloudMessage').textContent=e.message;return}
  const email=$('cloudEmail').value.trim(),password=$('cloudPassword').value;
  config=next;
  await operation(async()=>{
   const result=await request('/auth/v1/token?grant_type=password',{method:'POST',body:{email,password},auth:false});
   if(!result?.user?.id||!result.access_token)throw Error('ข้อมูลเข้าสู่ระบบไม่ครบถ้วน');
   switchStore('shiftplanner-codes-account:'+config.url+':'+result.user.id);
   session=result;
   try{localStorage.setItem(CONFIG,JSON.stringify(config))}catch{}
   // Never silently replace a cached document or upload on login.
   message='เข้าสู่ระบบแล้ว เลือกโหลดจากออนไลน์ หรือรวมรหัสในเครื่องแล้วส่งขึ้นออนไลน์';
  });
 }
 async function push(){
  if(!session)return;
  await operation(async()=>{
   if(loadError)throw Error(loadError);
   const next=CodeCatalog.records(doc.records);
   const revision=await request('/rest/v1/rpc/save_code_library',{method:'POST',body:{expected_revision:doc.revision,entries:next}});
   if(!Number.isSafeInteger(revision)||revision<1)throw Error('รูปแบบรุ่นข้อมูลออนไลน์ไม่ถูกต้อง');
   persist({...doc,revision,dirty:false});message='ส่งข้อมูลขึ้นออนไลน์แล้ว '+next.length+' รหัส · รุ่น '+revision;toast(message);
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
   const result=await request('/rest/v1/code_libraries?select=records,revision&owner_id=eq.'+encodeURIComponent(session.user.id));
   if(!Array.isArray(result)||result.length>1)throw Error('รูปแบบข้อมูลออนไลน์ไม่ถูกต้อง');
   if(!result.length){message='ยังไม่มีข้อมูลออนไลน์ กรุณารวมรหัสจากคลังในเครื่องหรือเพิ่มรหัส แล้วส่งขึ้นออนไลน์';return}
   const next=CodeCatalog.document({version:1,records:result[0].records,revision:result[0].revision,dirty:false});
   backup();persist(next);page=1;message='โหลดข้อมูลออนไลน์แล้ว '+doc.records.length+' รหัส · รุ่น '+doc.revision;toast(message);
  });
 }
 function copyLocal(){
  if(busy||!session)return;
  try{
   const raw=localStorage.getItem(LOCAL),incoming=raw?CodeCatalog.document(JSON.parse(raw)).records:[];
   commit(CodeCatalog.merge(doc.records,incoming));message='รวมรหัสในเครื่องแล้ว กรุณากดส่งข้อมูลขึ้นออนไลน์';cloud();
  }catch(e){message=e.message;cloud()}
 }
 async function logout(){
  if(busy)return;
  await operation(async()=>{try{await request('/auth/v1/logout',{method:'POST'})}finally{session=null;message='ออกจากระบบแล้ว ข้อมูลที่แคชยังเปิดและแก้ไขในเครื่องได้'}});
 }
 function local(){if(busy)return;try{switchStore(LOCAL);session=null;render();closeModal()}catch(e){error(e)}}
 function recover(){
  if(!loadError||busy||stale){if(stale)toast('กรุณาสำรอง JSON แล้วรีเฟรชหน้าเพื่อโหลดข้อมูลจากอีกแท็บ');return}
  modal('เริ่มคลังรหัสใหม่','<p>ระบบจะดาวน์โหลดข้อมูลเดิมเป็น JSON สำหรับกู้คืน จากนั้นเริ่มคลังว่าง กรุณาเก็บไฟล์ที่ดาวน์โหลดไว้</p>','<button onclick="closeModal()">ยกเลิก</button><button onclick="CodeLibrary.confirmRecover()">ดาวน์โหลดข้อมูลเดิมและเริ่มใหม่</button>');
 }
 function confirmRecover(){
  if(stale||busy)return;
  download(rawBackup,'CodeLibrary-recovery-'+Date.now()+'.json','application/json');
  loadError='';persist(empty());closeModal();render();
 }
 window.addEventListener('beforeunload',e=>{if(storageWarning||busy){e.preventDefault();e.returnValue=''}});
 window.addEventListener('storage',e=>{
  if(e.key!==store)return;
  // A different tab must not be silently overwritten by this tab's stale copy.
  stale=true;loadError='คลังนี้ถูกแก้ไขจากอีกแท็บ กรุณาสำรอง JSON ของแท็บนี้ แล้วรีเฟรชก่อนแก้ไขต่อ';message=loadError;
  if(currentView==='codes')render();
 });
 if(currentView==='codes')render();
 return {render,edit,save,remove,confirmRemove,files,backup,excel,importFile,cloud,login,push,pullPrompt,pull,copyLocal,logout,local,recover,confirmRecover,motion,nextSpeech,suspend,detail,favorite,
  favorites(){favoritesOnly=!favoritesOnly;page=1;renderFavorites();renderResults()},search(v){query=v;page=1;renderResults()},kind(v,checked){if(!['conditions','procedures','note'].includes(v))return;kind=kind.filter(k=>k!==v);if(checked)kind.push(v);page=1;renderResults()},category(v){category=v;page=1;render()},page(delta){page+=delta;renderResults()},clearSearch(){category='';query='';kind=[];favoritesOnly=false;page=1;render()}};
})();
