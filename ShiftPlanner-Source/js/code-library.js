/* Standalone-compatible UI. No external libraries or cloud credentials required offline. */
const CodeLibrary=(()=>{
 'use strict';
 const LOCAL='shiftplanner-codes-local-v1',ACTIVE='shiftplanner-codes-active-v1',CONFIG='shiftplanner-codes-cloud-v1';
 const empty=()=>({version:1,records:[],revision:0,dirty:false});
 // Public project configuration only. Passwords and session tokens are never bundled.
 const defaultConfig=CodeCatalog.config('https://omtcyjoewqtfsreshgfu.supabase.co','sb_publishable_3Ixd4qU4vGBYVRJUqTurSg_vFabVA5B');
 let store=LOCAL,doc=empty(),config=defaultConfig,session=null,loadError='',rawBackup='',storageWarning='',stale=false,busy=false,message='',category='',query='',kind=[],page=1;
 const pageSize=30;
 let motionPaused=false;
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
  store=next;doc=read(store);try{localStorage.setItem(ACTIVE,store)}catch{}page=1;category='';query='';kind=[];message='';
 }
 function commit(rows){if(busy)throw Error('รอการเชื่อมต่อให้เสร็จก่อน');persist({...doc,records:rows,dirty:true});page=1;render()}
 function error(e){message=e.message||String(e);toast(message);if(currentView==='codes')render()}
 function filtered(){return CodeCatalog.filter(doc.records,category,query,kind)}
 function status(){
  if(loadError)return loadError;
  if(storageWarning)return storageWarning;
  if(store===LOCAL)return 'คลังในเครื่อง · '+doc.records.length+' รหัส';
  return (session?'เข้าสู่ระบบแล้ว':'แคชบัญชีออนไลน์ · ยังไม่ได้เข้าสู่ระบบ')+' · '+(doc.dirty?'มีการแก้ไขรอส่งออนไลน์':'ข้อมูลที่บันทึกไว้ รุ่น '+doc.revision);
 }
 function render(){
  const host=$('codesView');if(!host)return;
  const counts=Object.fromEntries('ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(c=>[c,doc.records.filter(r=>r.code[0]===c).length]));
  host.innerHTML=`<div class="panel kitty-library">
   <div class="kitty-hero">
    <div class="kitty-welcome"><span class="kitty-eyebrow"><span class="kitty-bow" aria-hidden="true"></span> MY LITTLE CODE BOOK</span><h2>คลังโค้ดรหัส<span class="kitty-title-heart" aria-hidden="true">♡</span></h2><p>ทุกโค้ดสำคัญ เก็บไว้ใกล้มือ</p><span class="kitty-hero-note">โรค · เงื่อนไข · หัตถการ · โน้ตของเธอ</span></div>
    <div class="kitty-mascot"><span class="kitty-speech">สวัสดีคนเก่ง ♡</span><div class="kitty-character${motionPaused?' is-paused':''}" role="img" aria-label="Hello Kitty โบกมือทักทาย"><img class="kitty-character-body" src="assets/kitty/hello-kitty-cutout.png" alt="" width="1024" height="1024"><img class="kitty-character-arm" src="assets/kitty/hello-kitty-cutout.png" alt="" width="1024" height="1024"><span class="kitty-wave-mark" aria-hidden="true">✦</span></div><button class="kitty-motion" onclick="CodeLibrary.motion()" aria-pressed="${motionPaused}" aria-label="${motionPaused?'เล่นแอนิเมชันคิตตี้':'พักแอนิเมชันคิตตี้'}">${motionPaused?'▷':'Ⅱ'}</button></div>
   </div>
   <div class="code-toolbar"><p id="codeSaveStatus" class="code-save" role="status"><span class="code-save-dot" aria-hidden="true"></span>${esc(status())}</p><div class="code-main-actions"><button class="code-data-button" onclick="CodeLibrary.files()"><span aria-hidden="true">↥</span> จัดการข้อมูล</button><button class="primary code-add-button" onclick="CodeLibrary.edit()" ${busy||loadError?'disabled':''}>＋ เพิ่มรหัส</button></div></div>
   <p id="codeMessage" class="code-message" role="status">${esc(message)}</p>
   <div class="code-tools"><label class="field code-search"><span>ค้นหาในสมุดโค้ด</span><span class="code-search-box"><span class="code-search-icon" aria-hidden="true">⌕</span><input id="codeSearch" type="search" placeholder="พิมพ์รหัส ชื่อโรค หรือสิ่งที่อยากหา…" value="${esc(query)}" oninput="CodeLibrary.search(this.value)"></span></label><fieldset class="code-kind" aria-describedby="codeKindHint"><legend>รายละเอียดที่ต้องการ</legend><div class="code-kind-options">${[['conditions','มีเงื่อนไข'],['procedures','มีหัตถการ'],['note','มี Note']].map(([v,t])=>'<label class="code-kind-option"><input type="checkbox" name="codeKind" value="'+v+'" '+(kind.includes(v)?'checked':'')+' onchange="CodeLibrary.kind(this.value,this.checked)"><span>'+t+'</span></label>').join('')}</div><p id="codeKindHint">เลือกได้หลายข้อ · แสดงรหัสที่มีครบตามที่เลือก · ไม่เลือก = ทั้งหมด</p></fieldset></div>
   <div class="code-category-heading"><span>เลือกหมวดรหัส</span><span>A — Z</span></div><div class="code-alphabet" role="group" aria-label="หมวดรหัส A ถึง Z"><button aria-pressed="${!category}" onclick="CodeLibrary.category('')">ทั้งหมด<small>${doc.records.length}</small></button>${Object.entries(counts).map(([c,n])=>'<button aria-pressed="'+(category===c)+'" onclick="CodeLibrary.category(\''+c+'\')">'+c+'<small>'+n+'</small></button>').join('')}</div>
   <div class="code-results-heading"><p class="code-count" id="codeCount" role="status"></p><button id="codeClear" class="code-clear${category||query||kind.length?'':' hidden'}" onclick="CodeLibrary.clearSearch()">ล้างตัวกรอง ×</button></div><div class="code-results" id="codeResults"></div>
   <div class="kitty-library-foot"><span class="kitty-bow" aria-hidden="true"></span> a little care for every little detail <span aria-hidden="true">♡</span></div></div>`;
  renderResults();
 }
 function renderResults(){
  const rows=filtered(),max=Math.max(1,Math.ceil(rows.length/pageSize));page=Math.min(page,max);
  $('codeCount').textContent='พบ '+rows.length+' จาก '+doc.records.length+' รหัส'+(category?' · หมวด '+category:'');
  $('codeClear').classList.toggle('hidden',!category&&!query&&!kind.length);
  $('codeResults').innerHTML=rows.length?rows.slice((page-1)*pageSize,page*pageSize).map(r=>`<article class="code-card"><div class="code-card-head"><div class="code-card-title"><span class="code-badge">${esc(r.code)}</span><h3>${esc(r.disease)}</h3></div><details class="code-card-actions"><summary aria-label="จัดการรหัส ${r.code}">•••</summary><div class="code-card-menu"><button onclick="CodeLibrary.edit('${r.code}')" ${busy?'disabled':''}>แก้ไขรหัส</button><button class="code-delete" onclick="CodeLibrary.remove('${r.code}')" ${busy?'disabled':''}>ลบรหัส</button></div></details></div>${r.conditions||r.procedures||r.note?'<dl class="code-details">'+(r.conditions?'<div><dt><span aria-hidden="true">◇</span> เงื่อนไข</dt><dd>'+esc(r.conditions)+'</dd></div>':'')+(r.procedures?'<div><dt><span aria-hidden="true">✚</span> หัตถการ</dt><dd>'+esc(r.procedures)+'</dd></div>':'')+(r.note?'<div class="code-note"><dt><span aria-hidden="true">♡</span> Note ของฉัน</dt><dd>'+esc(r.note)+'</dd></div>':'')+'</dl>':'<p class="help">เพิ่มเงื่อนไข หัตถการ หรือ Note ไว้ในรหัสนี้ได้เลย</p>'}</article>`).join('')+(max>1?`<div class="code-pager"><button onclick="CodeLibrary.page(-1)" ${page===1?'disabled':''}>‹ ก่อนหน้า</button><span>หน้า ${page} / ${max}</span><button onclick="CodeLibrary.page(1)" ${page===max?'disabled':''}>ถัดไป ›</button></div>`:''):`<div class="code-empty"><div class="kitty-empty-icon" aria-hidden="true"><span class="kitty-bow"></span>♡</div><h3>${doc.records.length?'ยังหาโค้ดนี้ไม่เจอเลย':'สมุดโค้ดเล่มเล็ก พร้อมให้เริ่มแล้ว'}</h3><p>${doc.records.length?'ลองเปลี่ยนคำค้น หรือเลือกหมวดอื่นดูนะ':'เลือกหมวดด้านบน แล้วกด “เพิ่มรหัส” เพื่อเก็บโค้ดแรกของเธอ'}</p>${doc.records.length?'<button onclick="CodeLibrary.clearSearch()">ดูรหัสทั้งหมด</button>':'<span class="kitty-empty-hint">เพิ่มรหัสแรกได้จากปุ่ม ＋ ด้านบน <span aria-hidden="true">↗</span></span>'}</div>`;
 }
 function edit(code=''){
  if(busy||loadError)return;
  const r=doc.records.find(x=>x.code===code)||{code:category||'A',disease:'',conditions:'',procedures:'',note:''};
  modal(code?'แก้ไขรหัส '+code:'เพิ่มโค้ดรหัส',`<form id="codeForm" class="code-form" onsubmit="event.preventDefault();CodeLibrary.save('${code}')"><div class="code-form-grid"><label class="field">หมวด<select id="codeLetter">${'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(c=>'<option '+(c===r.code[0]?'selected':'')+'>'+c+'</option>').join('')}</select></label><label class="field">เลขหลังหมวด<input id="codeNumber" required maxlength="31" inputmode="decimal" pattern="[0-9]+([.][0-9]+)?" value="${esc(r.code.slice(1))}" placeholder="เช่น 00 หรือ 00.1"></label></div><label class="field">ชื่อโรค<input id="codeDisease" required maxlength="500" value="${esc(r.disease)}" placeholder="กรอกชื่อโรค"></label>${[['conditions','เงื่อนไข'],['procedures','หัตถการ'],['note','Note เพิ่มเติม']].map(([k,label])=>'<label class="field">'+label+' <small>(ไม่บังคับ)</small><textarea id="code-'+k+'" maxlength="8000" rows="3">'+esc(r[k])+'</textarea></label>').join('')}<p id="codeFormError" class="code-message" role="alert"></p><p class="help">เงื่อนไข หัตถการ และ Note กรอกอย่างใดอย่างหนึ่ง ทั้งหมด หรือเว้นว่างได้</p></form>`,'<button onclick="closeModal()">ยกเลิก</button><button class="primary" type="submit" form="codeForm">บันทึกรหัส</button>');
  $('codeNumber').focus();
 }
 function save(code){
  try{
   if(!$('codeForm').reportValidity())return;
   const r={code:$('codeLetter').value+$('codeNumber').value,disease:$('codeDisease').value};
   for(const k of ['conditions','procedures','note'])r[k]=$('code-'+k).value;
   commit(CodeCatalog.upsert(doc.records,r,code||null));closeModal();toast('บันทึกรหัสแล้ว'+(storageWarning?' · '+storageWarning:''));
  }catch(e){$('codeFormError').textContent=e.message}
 }
 function remove(code){if(busy)return;modal('ลบรหัส '+code,'<p>ลบรหัส <b>'+esc(code)+'</b> และรายละเอียดทั้งหมดออกจากคลังนี้หรือไม่?</p><p class="help">รายการออนไลน์จะเปลี่ยนเมื่อกดส่งข้อมูลขึ้นออนไลน์</p>','<button onclick="closeModal()">ยกเลิก</button><button onclick="CodeLibrary.confirmRemove(\''+code+'\')">ลบรหัสนี้</button>')}
 function confirmRemove(code){try{commit(doc.records.filter(r=>r.code!==code));closeModal();toast('ลบรหัสแล้ว')}catch(e){error(e)}}
 function files(){modal('จัดการสมุดโค้ดของฉัน',`<div class="code-file-menu"><p class="code-file-intro">เก็บไว้ใช้ ส่งต่อ หรือสำรองข้อมูลได้ที่นี่ ♡</p><section class="code-file-section"><h3>ส่งออก Excel</h3><p>ไฟล์ .xlsx พร้อมรหัส ชื่อโรค และรายละเอียดครบทุกช่อง</p><div class="code-export-row"><label class="field">รายการที่ต้องการ<select id="codeExportScope"><option value="all">ทั้งคลัง · ${doc.records.length} รหัส</option><option value="filtered">ผลค้นหาปัจจุบัน · ${filtered().length} รหัส</option></select></label><button class="primary" onclick="CodeLibrary.excel(document.getElementById('codeExportScope').value==='filtered')">ดาวน์โหลด Excel</button></div></section><section class="code-file-section"><h3>สำรองและนำกลับมาใช้</h3><p>เก็บไฟล์ JSON ไว้ย้ายเครื่องหรือนำกลับมาแก้ไขต่อ</p><div class="code-file-actions"><button onclick="CodeLibrary.backup()">↓ สำรอง JSON</button><button onclick="document.getElementById('codeImport').click()" ${busy||loadError?'disabled':''}>↑ นำเข้า JSON</button></div></section>${store!==LOCAL?'<button class="code-local-link" onclick="CodeLibrary.local()" '+(busy?'disabled':'')+'>เปิดสมุดที่บันทึกในเครื่อง</button>':''}<input id="codeImport" type="file" accept=".json,application/json" class="hidden" onchange="CodeLibrary.importFile(this)"><p class="help">นำเข้าแล้วรวมกับรหัสเดิมได้ หากรหัสซ้ำและรายละเอียดต่างกัน ระบบจะให้ตรวจสอบก่อน</p>${loadError?'<p class="code-message">'+esc(loadError)+'</p><button onclick="CodeLibrary.recover()">ดาวน์โหลดข้อมูลเดิมและเริ่มคลังใหม่</button>':''}</div>`)}
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
  modal('ฐานข้อมูลออนไลน์ · Supabase',`<div class="code-cloud-info"><b>${esc(status())}</b>${logged?'<p>บัญชี '+esc(session.user.email)+'</p>':''}<p>เก็บคลังแยกตามบัญชี ใช้บัญชีเดิมบนเครื่องอื่นเพื่อโหลดข้อมูล · กดส่งหรือโหลดเมื่อพร้อม</p></div><p id="cloudMessage" class="code-message" role="status">${esc(message)}</p>${logged?`<div class="code-cloud-actions"><button class="primary" onclick="CodeLibrary.push()" ${busy?'disabled':''}>ส่งข้อมูลขึ้นออนไลน์</button><button onclick="CodeLibrary.pullPrompt()" ${busy?'disabled':''}>โหลดข้อมูลจากออนไลน์</button><button onclick="CodeLibrary.copyLocal()" ${busy?'disabled':''}>รวมรหัสจากคลังในเครื่อง</button><button onclick="CodeLibrary.logout()" ${busy?'disabled':''}>ออกจากระบบ</button></div><p class="help">ส่งทั้งคลัง รวมการลบรายการ · หากมีเครื่องอื่นแก้ไขก่อน ระบบจะหยุดเพื่อป้องกันการทับข้อมูล</p>`:`<form id="cloudForm" class="code-form" onsubmit="event.preventDefault();CodeLibrary.login()"><label class="field">Project URL<input id="cloudUrl" type="url" required value="${esc(config?.url||'')}" placeholder="https://your-project.supabase.co"></label><label class="field">Publishable key / anon key<input id="cloudKey" required value="${esc(config?.key||'')}" placeholder="sb_publishable_…" autocomplete="off"></label><label class="field">อีเมล<input id="cloudEmail" type="email" required autocomplete="username"></label><label class="field">รหัสผ่าน<input id="cloudPassword" type="password" required autocomplete="current-password"></label><p class="help">ใช้ผู้ใช้ที่สร้างใน Supabase Authentication · เก็บ URL และคีย์สาธารณะในเครื่อง ไม่เก็บรหัสผ่านหรือโทเคนเข้าสู่ระบบหลังรีเฟรช</p><button class="primary" type="submit" ${busy?'disabled':''}>เข้าสู่ระบบ</button></form>`}<details class="code-cloud-guide"><summary>ขั้นตอนเชื่อมฐานข้อมูลฟรี</summary><ol><li>สร้างโปรเจกต์ Free ที่ <a href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer">Supabase</a></li><li>เปิด SQL Editor แล้วรันไฟล์ <code>supabase/code-library.sql</code> ที่ให้มาในโฟลเดอร์โปรแกรม</li><li>ที่ Authentication → Users สร้างผู้ใช้ด้วยอีเมลและรหัสผ่าน แล้วเลือกยืนยันอีเมล</li><li>คัดลอก Project URL และ Publishable key จาก Connect / Settings → API Keys ใส่ด้านบน (ห้ามใช้ secret หรือ service_role)</li><li>เข้าสู่ระบบ ถ้าออนไลน์มีข้อมูล กดโหลดก่อนแก้ไข หากเริ่มจากคลังในเครื่อง กดรวมรหัสจากคลังในเครื่อง แล้วส่งขึ้นออนไลน์</li></ol><p>แพ็กเกจ Free มีฐานข้อมูล 500 MB และโปรเจกต์อาจพักเมื่อไม่มีการใช้งานประมาณ 7 วัน <a href="https://supabase.com/pricing" target="_blank" rel="noopener noreferrer">ตรวจเงื่อนไขปัจจุบัน</a></p><p>คู่มือเต็ม: <code>ONLINE-DATABASE.md</code> · การเชื่อมนี้ใช้กับคลังโค้ดรหัส ส่วนตารางเวรยังบันทึกในเครื่อง</p></details>`);
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
  finally{busy=false;render();if($('modal').open&&$('modalTitle').textContent==='ฐานข้อมูลออนไลน์ · Supabase')cloud()}
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
 return {render,edit,save,remove,confirmRemove,files,backup,excel,importFile,cloud,login,push,pullPrompt,pull,copyLocal,logout,local,recover,confirmRecover,motion(){motionPaused=!motionPaused;const character=$('codesView').querySelector('.kitty-character'),control=$('codesView').querySelector('.kitty-motion');character.classList.toggle('is-paused',motionPaused);control.setAttribute('aria-pressed',String(motionPaused));control.setAttribute('aria-label',motionPaused?'เล่นแอนิเมชันคิตตี้':'พักแอนิเมชันคิตตี้');control.textContent=motionPaused?'▷':'Ⅱ'},
  search(v){query=v;page=1;renderResults()},kind(v,checked){if(!['conditions','procedures','note'].includes(v))return;kind=kind.filter(k=>k!==v);if(checked)kind.push(v);page=1;renderResults()},category(v){category=v;page=1;render()},page(delta){page+=delta;renderResults()},clearSearch(){category='';query='';kind=[];page=1;render()}};
})();
