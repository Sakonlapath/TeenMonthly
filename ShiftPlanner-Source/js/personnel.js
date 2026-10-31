/* Personnel notebook. Credentials stay inside CodeLibrary; only authenticated requests cross this boundary. */
const Personnel=(()=>{
 const LOCAL_STATE='card-room-planner-v1',LOCAL_PROFILE='pruksa-personnel-local-v1',ACCOUNT_STATE=LOCAL_STATE+':teen-program:',ACCOUNT_PROFILE='pruksa-personnel:teen-program:';
 let owner=null,sync=null,profile=null,draft=null,selected='1',included=new Set(),timer,retries=0,epoch=0,initialized=false,loading=false,notice='',photoBusy=false,searchText='',awaitingNotice=false,calculations=new Map();
 const copy=v=>JSON.parse(JSON.stringify(v)),icon=(name,size=20)=>'<svg width="'+size+'" height="'+size+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+({person:'<circle cx="12" cy="8" r="4"/><path d="M4 22v-2a8 8 0 0 1 16 0v2"/>',camera:'<path d="M4 7h4l2-3h4l2 3h4v14H4Z"/><circle cx="12" cy="14" r="4"/>',coin:'<circle cx="12" cy="12" r="9"/><path d="M14.5 7.5h-4a2 2 0 0 0 0 4h3a2 2 0 0 1 0 4h-4M12 5.5v13"/>',bin:'<path d="M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7"/>',bow:'<path d="M10 9C0 0 0 23 10 15h4c10 8 10-15 0-6Z"/><circle cx="12" cy="12" r="3"/>'}[name]||'')+'</svg>';
 const isCore=id=>PersonnelModel.coreIds.includes(id),visible=()=>draft.people.filter(p=>!p.removedFrom),isOpen=()=>$('modal').open&&$('modal').classList.contains('personnel-modal');
 function current(){return sync?.profile||profile}
 function align(){if(current())PersonnelModel.apply(state,current())}
 function status(){return loading?'กำลังโหลดบุคลากร…':notice||(!owner?'บันทึกในเครื่องนี้':sync?.error|| (sync?.dirty?'รอส่งเข้าบัญชี '+owner.username:'บันทึกในบัญชี '+owner.username+' แล้ว'))}
 function refreshStatus(){const el=$('personnelStatus');if(el)el.textContent=status()}
 function applyDirectory(){align();normalizeCalendarState(state);save();render();refreshStatus()}
 function accountDefaults(account,legacy){
  const base=PersonnelModel.defaults(SEED,account?.username||'');
  if(legacy){for(const p of base.people){const old=legacy.people.find(v=>v.id===p.id);if(old){const next=PersonnelModel.person({...old,removedFrom:''});Object.assign(p,next);base.payRates[p.id]={card:payRate(legacy,p.id,'card',null),dawn:payRate(legacy,p.id,'dawn',null)}}}}
  return PersonnelModel.validate(base);
 }
 function switchAccount(account){
  if(initialized&&owner?.id===account?.id)return;
  const legacy=copy(state),previousOwner=owner;epoch++;clearTimeout(timer);sync?.dispose();sync=null;draft=null;photoBusy=false;notice='';loading=false;awaitingNotice=false;calculations.clear();
  if(initialized)save();
  owner=account;STORE=account?ACCOUNT_STATE+account.id:LOCAL_STATE;
  try{const raw=localStorage.getItem(STORE);if(raw){const loaded=JSON.parse(raw);validateBackup(loaded);state=loaded}else state=copy(account?.username==='teen'&&!previousOwner?legacy:SEED)}catch{state=copy(SEED);notice='เปิดตารางในเครื่องไม่ได้ ข้อมูลเดิมยังเก็บอยู่'}
  history=[];editing=null;if(typeof cancelPaint==='function')cancelPaint();
  const defaults=accountDefaults(account,account?.username==='teen'&&!previousOwner?legacy:!account?state:null);
  if(!account){
   try{profile=PersonnelModel.validate(JSON.parse(localStorage.getItem(LOCAL_PROFILE)||'null')||defaults)}catch{profile=defaults;notice='เปิดรายชื่อในเครื่องไม่ได้ กรุณาตรวจไฟล์สำรอง'}
   initialized=true;applyDirectory();if(isOpen())closeModal();return;
  }
  profile=defaults;loading=true;const targetEpoch=epoch,key=ACCOUNT_PROFILE+account.id;let raw=localStorage.getItem(key);
  try{
   sync=new PersonnelSync({defaults,validate:PersonnelModel.validate,cache:()=>raw?JSON.parse(raw):null,
    persist(value){if(targetEpoch!==epoch)return;if(localStorage.getItem(key)!==raw)throw Error('บุคลากรถูกแก้ไขจากอีกแท็บ กรุณาโหลดข้อมูลล่าสุด');const next=JSON.stringify(value);localStorage.setItem(key,next);raw=next},
    read:()=>{if(sync?.blocked)raw=localStorage.getItem(key);return CodeLibrary.personnel()},write:(body,etag)=>CodeLibrary.personnel({method:'PUT',body,etag}),
    onChange(){if(targetEpoch===epoch){applyDirectory();if(sync?.dirty)schedule()}}
   });
   profile=sync.profile;
  }catch(e){notice=e.message;loading=false;sync=null}
  initialized=true;applyDirectory();if(isOpen())closeModal();
  if(sync)load(false);
 }
 async function load(replace=false){
  if(!sync)return;const target=sync,targetEpoch=epoch;loading=true;notice='';refreshStatus();if(isOpen()){$('personnelSave').disabled=true;$('personnelForm').querySelector('fieldset').disabled=true}
  let success=false;
  try{await target.load(replace);if(targetEpoch!==epoch)return;loading=false;retries=0;success=true;applyDirectory();if(target.dirty)schedule(0)}
  catch(e){if(targetEpoch!==epoch)return;loading=false;notice=e.message;refreshStatus();if(e.retryable&&retries<4)scheduleLoad()}
  if(isOpen())open(true);
  return success;
 }
 function scheduleLoad(){clearTimeout(timer);timer=setTimeout(()=>load(false),Math.min(30000,3000*2**retries++))}
 function schedule(delay=650){clearTimeout(timer);if(!sync?.dirty||sync.blocked||!sync.ready)return;timer=setTimeout(flush,delay)}
 async function flush(){
  if(!sync)return;const target=sync,targetEpoch=epoch;
  try{await target.flush();if(targetEpoch!==epoch)return;retries=0;notice='';if(target.dirty)schedule();else if(awaitingNotice){awaitingNotice=false;toast('บันทึกบุคลากรในบัญชี '+owner.username+' แล้ว',true)}}
  catch(e){if(targetEpoch!==epoch)return;notice=e.message;if(awaitingNotice){awaitingNotice=false;toast('บุคลากรยังรอส่ง: '+e.message,true)}if(e.retryable)schedule(Math.min(30000,3000*2**Math.min(retries++,4)))}
  refreshStatus();
 }
 function avatar(p,large=false){return '<span class="personnel-avatar'+(large?' personnel-avatar-large':'')+'">'+(p.photo?'<img src="'+esc(p.photo)+'" alt="รูป '+esc(p.plainName)+'" width="112" height="112">':icon('person',large?52:22))+'</span>'}
 function open(keep=false){
  if(!initialized)init();
  if(!keep||!draft){draft=copy(current());included=new Set(monthPeople(state,state.selected).map(p=>p.id));selected=draft.people.find(p=>!p.removedFrom)?.id||'1';searchText='';calculations.clear()}
  if(!draft.people.some(p=>p.id===selected&&!p.removedFrom))selected=visible()[0]?.id;
  modal('สมุดบุคลากร',
   '<div class="personnel-book"><div class="personnel-intro"><div class="personnel-stamp">'+icon('bow',30)+'</div><div><h3>ทีมของพฤกษา</h3><p>8 คนหลัก'+(owner?' · สมาชิกของ '+esc(owner.username):' · ใช้งานในเครื่อง')+'</p></div><button class="personnel-add" onclick="Personnel.add()">＋ '+(owner?'เพิ่มคน':'เข้าสู่ระบบเพื่อเพิ่มคน')+'</button></div>'+
   '<div class="personnel-workspace"><aside class="personnel-directory" aria-label="รายชื่อบุคลากร"><label class="personnel-search"><span class="sr-only">ค้นหาบุคลากร</span><input id="personnelSearch" type="search" placeholder="ค้นหาชื่อหรือตำแหน่ง…" value="'+esc(searchText)+'" oninput="Personnel.search(this.value)"></label><div id="personnelList"></div></aside><section id="personnelEditor" aria-label="แก้ไขบุคลากร"></section></div></div>',
   '<div class="personnel-save-status"><span class="personnel-status-dot" aria-hidden="true"></span><span id="personnelStatus" role="status">'+esc(status())+'</span>'+(owner?'<button class="textbtn" onclick="Personnel.reload()">โหลดล่าสุด</button>':'')+'</div><button onclick="closeModal()">ยกเลิก</button><button class="primary" id="personnelSave" onclick="Personnel.save()">บันทึกบุคลากร</button>');
  $('modal').classList.add('personnel-modal');renderList();renderEditor();
 }
 function renderList(){
  const rows=visible().filter(p=>(p.name+' '+p.role).toLocaleLowerCase('th').includes(searchText.toLocaleLowerCase('th')));
  $('personnelList').innerHTML=rows.map(p=>'<button class="personnel-person'+(p.id===selected?' selected':'')+'" aria-pressed="'+(p.id===selected)+'" onclick="Personnel.select(\''+p.id+'\')">'+avatar(p)+'<span><b>'+esc(p.plainName)+'</b><small>'+esc(p.role||'ยังไม่ระบุตำแหน่ง')+'</small></span><span class="personnel-member-type">'+(isCore(p.id)?'หลัก':'เพิ่ม')+'</span></button>').join('')||'<p class="personnel-no-result">ไม่พบรายชื่อ</p>';
 }
 function renderEditor(){
  const p=draft.people.find(p=>p.id===selected),rates=draft.payRates[p.id],disabled=!!owner&&(loading||!sync?.ready||sync.blocked);
  $('personnelEditor').innerHTML='<form id="personnelForm" onsubmit="event.preventDefault();Personnel.save()"><fieldset '+(disabled?'disabled':'')+'><div class="personnel-profile"><div class="personnel-photo-wrap">'+avatar(p,true)+'<label class="personnel-photo-button" title="เพิ่มหรือเปลี่ยนรูป">'+icon('camera',18)+'<span class="sr-only">เพิ่มหรือเปลี่ยนรูปบุคลากร</span><input id="personnelPhoto" type="file" accept="image/jpeg,image/png,image/webp" onchange="Personnel.photo(this)"></label></div><div><span class="personnel-core-label">'+(isCore(p.id)?'บุคลากรหลัก':'บุคลากรเพิ่มเติม')+'</span><h3>'+esc(p.plainName)+'</h3><p>'+esc(monthLabel(state.selected))+'</p>'+(p.photo?'<button type="button" class="textbtn" onclick="Personnel.clearPhoto()">ลบรูป</button>':'')+'</div></div>'+
   '<div class="personnel-name-fields"><label class="field">คำนำหน้า<input id="personnelPrefix" list="personnelPrefixes" value="'+esc(p.prefix)+'" maxlength="30" autocomplete="honorific-prefix"><datalist id="personnelPrefixes"><option value="นางสาว"><option value="นาย"><option value="นาง"><option value="ดร."></datalist></label><label class="field">ชื่อ–สกุล<input id="personnelName" value="'+esc(p.plainName)+'" maxlength="100" autocomplete="name" required></label></div><label class="field">ตำแหน่ง<input id="personnelRole" value="'+esc(p.role)+'" maxlength="100"></label>'+
   '<label class="personnel-month-toggle"><span><b>ลงตารางเดือนนี้</b><small>'+(p.id==='9'?'เฉพาะเวรออกรพ.สต.':esc(monthLabel(state.selected)))+'</small></span><input id="personnelIncluded" type="checkbox" '+(included.has(p.id)?'checked':'')+'></label>'+
   '<div class="personnel-pay-heading"><h4>'+icon('coin',20)+' ค่าเวรของคนนี้</h4><span>บาท / เวร</span></div><div class="personnel-pay-grid">'+PAY_GROUPS.map(g=>'<section class="personnel-pay personnel-pay-'+g.id+'"><label for="personnelRate-'+g.id+'">'+g.label+'</label><div class="personnel-stepper"><button type="button" aria-label="ลดเรท'+g.label+' 10 บาท" onclick="Personnel.step(\''+g.id+'\',-10)">−</button><input id="personnelRate-'+g.id+'" type="number" min="0" max="10000" step="0.01" inputmode="decimal" value="'+rates[g.id]+'" oninput="Personnel.preview()" required aria-label="เรท'+g.label+' บาทต่อเวร"><button type="button" aria-label="เพิ่มเรท'+g.label+' 10 บาท" onclick="Personnel.step(\''+g.id+'\',10)">＋</button></div><div class="personnel-presets" aria-label="เรท'+g.label+'ที่ใช้บ่อย">'+(g.id==='card'?[330,390,520,650]:[50,60,80,100]).map(n=>'<button type="button" onclick="Personnel.preset(\''+g.id+'\','+n+')">'+n+'</button>').join('')+'</div><small>'+(g.id==='card'?'ดึก · เช้า · บ่าย':'หน้าตู้KIOS · ออกรพ.สต.')+'</small></section>').join('')+'</div>'+
   calculator(rates)+
   (!isCore(p.id)?'<button type="button" class="personnel-remove" onclick="Personnel.remove()">'+icon('bin',17)+' ลบบุคลากรคนนี้</button>':'<p class="personnel-core-note">รายชื่อหลักทั้ง 8 คนเก็บไว้เสมอ เลือกพักจากตารางเดือนนี้ได้</p>')+'</fieldset><p id="personnelError" class="personnel-error" role="alert"></p></form>';
  $('personnelSave').disabled=disabled;refreshStatus();
 }
 function collect(){
  if(!draft||!$('personnelForm'))return true;
  const p=draft.people.find(v=>v.id===selected);
  try{
   const next=PersonnelModel.person({...p,prefix:$('personnelPrefix').value,plainName:$('personnelName').value,role:$('personnelRole').value});
   const rates={};for(const g of PAY_GROUPS){const input=$('personnelRate-'+g.id);if(input.value.trim()==='')throw Error('กรอกเรทเงินให้ครบ');rates[g.id]=Number(input.value)}
   const candidate=PersonnelModel.validate({...draft,people:draft.people.map(v=>v.id===selected?next:v),payRates:{...draft.payRates,[selected]:rates}});
   draft=candidate;if($('personnelIncluded').checked)included.add(selected);else included.delete(selected);return true;
  }catch(e){$('personnelError').textContent=e.message;return false}
 }
 function select(id){if(photoBusy||!collect())return;selected=id;renderList();renderEditor();$('personnelList').querySelector('.selected')?.focus({preventScroll:true})}
 function search(value){searchText=value;renderList()}
 function add(){
  if(!owner){closeModal();CodeLibrary.cloud();return}
  if(loading||!sync?.ready||sync.blocked){toast('กรุณาโหลดบุคลากรให้สำเร็จก่อนเพิ่มคน');return}
  if(photoBusy||!collect())return;
  if(draft.people.length>=40){toast('เก็บบุคลากรได้ไม่เกิน 40 คน รวมประวัติที่ลบแล้ว');return}
  const id='staff-'+(globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+'-'+Math.random().toString(36).slice(2));
  draft.people.push({id,prefix:'นางสาว',plainName:'บุคลากรใหม่',name:'นางสาวบุคลากรใหม่',role:'',active:true,allowed:[...CODES],prev:'',next:'',photo:'',removedFrom:''});draft.payRates[id]={card:330,dawn:50};included.add(id);selected=id;searchText='';$('personnelSearch').value='';renderList();renderEditor();$('personnelName').focus();$('personnelName').select();
 }
 function remove(){
  if(!owner||isCore(selected)||photoBusy||!collect())return;
  const p=draft.people.find(v=>v.id===selected);
  if(!confirm('ลบ '+p.name+' ออกจากรายชื่อ? ประวัติเวรก่อน '+monthLabel(state.selected)+' ยังเก็บไว้'))return;
  p.removedFrom=state.selected;included.delete(p.id);selected=visible()[0].id;searchText='';$('personnelSearch').value='';renderList();renderEditor();
 }
 function preset(group,value){$('personnelRate-'+group).value=value;preview(true)}
 function step(group,delta){const input=$('personnelRate-'+group),n=Number(input.value);input.value=Math.max(0,Math.min(10000,Math.round(((Number.isFinite(n)?n:0)+delta)*100)/100));preview(true)}
 const money=n=>n.toLocaleString('th-TH',{maximumFractionDigits:2}),inputNumber=value=>String(value).trim()===''?NaN:Number(value);
 function scheduleCounts(){const t=totals(state,state.selected).find(p=>p.id===selected);return {card:String(t?t.N+t.M+t.A:0),dawn:String(t?t.R+t.X:0)}}
 function calculator(rates){
  if(!calculations.has(selected))calculations.set(selected,scheduleCounts());
  const counts=calculations.get(selected);let result,error='';
  try{result=PersonnelModel.estimate(rates,{card:inputNumber(counts.card),dawn:inputNumber(counts.dawn)},daysIn(state.selected))}catch(e){error=e.message}
  return '<section class="personnel-calculator" aria-label="เครื่องคำนวณค่าเวร"><div class="personnel-calculator-heading"><div><h4>คำนวณค่าเวรเดือนนี้</h4><span>'+esc(monthLabel(state.selected))+'</span></div><button type="button" onclick="Personnel.useSchedule()">ใช้เวรจากตาราง</button></div><div class="personnel-calculator-counts">'+PAY_GROUPS.map(g=>'<div><label for="personnelCount-'+g.id+'">จำนวนเวร'+g.label+'</label><div class="personnel-count-field"><input id="personnelCount-'+g.id+'" type="number" min="0" max="'+daysIn(state.selected)+'" step="1" inputmode="numeric" value="'+esc(counts[g.id])+'" oninput="Personnel.preview()" onkeydown="if(event.key===\'Enter\'){event.preventDefault();Personnel.preview()}"><span>เวร</span></div><output id="personnelLine-'+g.id+'">'+(result?counts[g.id]+' × '+money(rates[g.id])+' = '+money(result[g.id])+' บาท':'—')+'</output></div>').join('')+'</div><p class="personnel-calc-error" id="personnelCalcError" role="status">'+esc(error)+'</p><div class="personnel-pay-preview"><span class="personnel-coin" id="personnelCoin">'+icon('coin',30)+'</span><div><span>รายได้รวม <span id="personnelCountSummary">'+(result?result.count+' เวร':'')+'</span></span><strong><output id="personnelPreview" aria-live="polite">'+(result?money(result.total):'—')+'</output> <small>บาท</small></strong></div><span class="personnel-reward" id="personnelReward" aria-live="polite"></span></div><p class="personnel-calculator-note">คำนวณตามเรทด้านบน ไม่เปลี่ยนเวรในตาราง</p></section>';
 }
 function useSchedule(){
  const counts=scheduleCounts();for(const g of PAY_GROUPS)$('personnelCount-'+g.id).value=counts[g.id];preview(true);
 }
 function preview(celebrate=false){
  const rates={},counts={},raw={};
  for(const g of PAY_GROUPS){rates[g.id]=inputNumber($('personnelRate-'+g.id).value);raw[g.id]=String($('personnelCount-'+g.id).value);counts[g.id]=inputNumber(raw[g.id])}
  calculations.set(selected,raw);
  try{
   const result=PersonnelModel.estimate(rates,counts,daysIn(state.selected));$('personnelPreview').textContent=money(result.total);$('personnelCountSummary').textContent=result.count+' เวร';$('personnelCalcError').textContent='';
   for(const g of PAY_GROUPS)$('personnelLine-'+g.id).textContent=counts[g.id]+' × '+money(rates[g.id])+' = '+money(result[g.id])+' บาท';
  }catch(e){$('personnelPreview').textContent='—';$('personnelCountSummary').textContent='';$('personnelCalcError').textContent=e.message;for(const g of PAY_GROUPS)$('personnelLine-'+g.id).textContent='—'}
  if(celebrate){const coin=$('personnelCoin');coin.classList.remove('coin-pop');void coin.offsetWidth;coin.classList.add('coin-pop');$('personnelReward').textContent=['เก็บทีละนิด','คนเก่งของทีม','พร้อมลุยแล้ว'][Math.floor(Math.random()*3)]}
 }
 async function photo(input){
  const file=input.files?.[0];input.value='';if(!file)return;
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>8*1024*1024){$('personnelError').textContent='เลือกรูป JPG, PNG หรือ WebP ขนาดไม่เกิน 8 MB';return}
  if(!collect())return;const id=selected,targetEpoch=epoch,targetDraft=draft,button=$('personnelSave');photoBusy=true;button.disabled=true;$('personnelForm').querySelector('fieldset').disabled=true;$('personnelError').textContent='กำลังเตรียมรูป…';
  let url;
  try{
   url=URL.createObjectURL(file);const image=new Image();image.src=url;await image.decode();
   if(!image.naturalWidth||image.naturalWidth*image.naturalHeight>40000000)throw Error('รูปนี้มีขนาดใหญ่เกินไป กรุณาย่อรูปก่อน');
   const canvas=document.createElement('canvas');canvas.width=canvas.height=192;const ctx=canvas.getContext('2d'),side=Math.min(image.naturalWidth,image.naturalHeight);
   ctx.fillStyle='#fff5f9';ctx.fillRect(0,0,192,192);ctx.drawImage(image,(image.naturalWidth-side)/2,(image.naturalHeight-side)/2,side,side,0,0,192,192);
   const photo=canvas.toDataURL('image/jpeg',0.8);if(photo.length>120000)throw Error('รูปนี้ใหญ่เกินไป กรุณาเลือกรูปอื่น');
   if(epoch!==targetEpoch||draft!==targetDraft||!isOpen())return;
   draft.people.find(p=>p.id===id).photo=photo;renderList();renderEditor();
  }catch(e){if(epoch===targetEpoch&&isOpen())$('personnelError').textContent='เพิ่มรูปไม่ได้: '+e.message}
  finally{if(url)URL.revokeObjectURL(url);if(epoch===targetEpoch){photoBusy=false;if(isOpen()){const disabled=!!owner&&(loading||!sync?.ready||sync.blocked);button.disabled=disabled;$('personnelForm').querySelector('fieldset').disabled=disabled}}}
 }
 function clearPhoto(){if(!collect())return;draft.people.find(p=>p.id===selected).photo='';renderList();renderEditor()}
 function saveStaff(){
  if(loading||photoBusy||!collect())return;
  try{
   if(owner){if(!sync)throw Error('ยังโหลดบัญชีไม่ได้ กรุณาลองโหลดอีกครั้ง');sync.edit(draft)}
   else{const next=PersonnelModel.validate(draft);localStorage.setItem(LOCAL_PROFILE,JSON.stringify(next));profile=next}
   activeMonth().excludedStaffIds=draft.people.filter(p=>!included.has(p.id)).map(p=>p.id);if(activeMonth().rosterSnapshot)activeMonth().rosterSnapshot=draft.people.filter(p=>!p.removedFrom).map(p=>({...p,photo:''}));history=[];applyDirectory();closeModal();toast(owner?'บันทึกบุคลากรแล้ว กำลังส่งเข้าบัญชี':'บันทึกบุคลากรแล้ว');if(owner){awaitingNotice=true;schedule(0)}
  }catch(e){$('personnelError').textContent=e.message}
 }
 function reload(){if(sync&&!photoBusy){if(loading||sync.task){toast('กำลังเชื่อมต่อบุคลากร กรุณารอสักครู่');return}const question=sync.dirty?'โหลดบุคลากรล่าสุด? ข้อมูลที่รอส่งและการแก้ไขในหน้านี้จะถูกแทนที่ด้วยข้อมูลออนไลน์':'โหลดบุคลากรล่าสุด? การแก้ไขที่ยังไม่กดบันทึกจะถูกยกเลิก';if(!confirm(question))return;draft=null;load(true)}}
 function init(){if(initialized)return;CodeLibrary.onAccount(switchAccount);CodeLibrary.beforeLogout(async()=>{if(sync?.dirty){await sync.flush();if(sync.dirty)await sync.flush()}})}
 window.addEventListener('online',()=>{if(sync&&!sync.ready)load();else flush()});
 window.addEventListener('focus',()=>{if(sync?.dirty)flush()});
 window.addEventListener('beforeunload',e=>{if(sync?.dirty){e.preventDefault();e.returnValue=''}});
 window.addEventListener('storage',e=>{if(owner&&e.key===ACCOUNT_PROFILE+owner.id){if(sync){sync.blocked=true;notice='บุคลากรถูกแก้ไขจากอีกแท็บ กรุณารีเฟรชก่อนแก้ไขต่อ';refreshStatus();if(isOpen())$('personnelSave').disabled=true}}});
 document.addEventListener('DOMContentLoaded',init);
 async function refreshOnline(){if(!owner)return true;if(!sync||loading||photoBusy||isOpen()||sync.dirty||sync.blocked||sync.task)return false;return load(false)}
 return {init,isReady:()=>initialized,isAccountReady:()=>!owner||!!sync?.ready&&!loading,refreshOnline,open,align,select,search,add,remove,step,preset,preview,useSchedule,photo,clearPhoto,save:saveStaff,reload,flush};
})();
