/* Account-scoped timetable coordinator. No auth token leaves the shared auth adapter. */
const Planner=(()=>{
 let owner=null,sync=null,epoch=0,initialized=false,applying=false,authorized=false,busy=false,loading=false,stale=false,notice='',timer,pollTimer,retries=0,reason='แก้ไขตาราง',cacheError='',initialMonths={},preferRemoteMonth=false,pendingClose=null;
 const copy=v=>JSON.parse(JSON.stringify(v)),labels={review:'รอตรวจ',confirmed:'ยืนยันแล้ว',paid:'รับเงินแล้ว'};
 const date=at=>new Date(at).toLocaleString('th-TH',{timeZone:'Asia/Bangkok',dateStyle:'short',timeStyle:'short'}),money=n=>n.toLocaleString('th-TH',{maximumFractionDigits:2});
 function sameOwner(){return owner&&CodeLibrary.account()?.id===owner.id}
 function editable(key=state.selected){return !state.months[key]?.settlement&&(!owner||sameOwner()&&sync?.ready&&!loading&&!busy&&!stale&&!cacheError&&Personnel.isAccountReady()&&!sync.docs[key]?.blocked)}
 function guard(key=state.selected){if(editable(key))return true;toast(state.months[key]?.settlement?'เดือนนี้ปิดยอดแล้ว กรุณาเปิดแก้ไขก่อน':'กรุณารอโหลดตารางให้สำเร็จ หรือแก้ข้อมูลที่ต่างกันก่อน');return false}
 function summary(data){const temp={selected:data.key,people:data.people,payRates:data.rates,months:{[data.key]:data.month}},tt=totals(temp,data.key);return {count:tt.reduce((s,t)=>s+t.total,0),pay:tt.reduce((s,t)=>s+Math.round(totalPay(temp,t,data.key)*100),0)/100}}
 function status(){
  if(!owner)return 'เข้าสู่ระบบเพื่อซิงก์และสำรองตารางอัตโนมัติ';
  if(loading)return 'กำลังโหลดตารางของ '+owner.username+'…';
  if(stale)return 'ตารางถูกแก้ไขจากอีกแท็บ กรุณาสำรอง JSON แล้วรีเฟรช';
  if(cacheError||notice)return cacheError||notice;
  if(!Personnel.isAccountReady())return 'กำลังรอข้อมูลบุคลากรของบัญชี';
  if(!sync?.ready)return 'ยังโหลดตารางออนไลน์ไม่ได้';
  if(Object.values(sync.docs).some(d=>d.blocked))return 'พบตารางต่างกันระหว่างเครื่อง กรุณาเลือกฉบับที่ต้องการ';
  if(Object.values(sync.docs).some(d=>d.dirty))return 'บันทึกในเครื่องแล้ว · รอส่งตารางเข้าบัญชี';
  return 'ซิงก์ตารางกับบัญชี '+owner.username+' แล้ว · สำรองอัตโนมัติ';
 }
 function bar(){
  const m=activeMonth(),closed=m.settlement,conflict=sync?.docs[state.selected]?.blocked;
  const account=owner?'<button onclick="Planner.history()">ประวัติ / กู้คืน</button><button onclick="Planner.reload()" '+(busy||loading?'disabled':'')+'>โหลดล่าสุด</button>':'<button onclick="CodeLibrary.cloud()">เข้าสู่ระบบ</button>';
  const actions=!owner?'':closed?(closed.status==='review'?'<button class="primary" onclick="Planner.setStatus(\'confirmed\')">ยืนยันยอด</button>':closed.status==='confirmed'?'<button class="primary" onclick="Planner.setStatus(\'paid\')">ระบุรับเงินแล้ว</button>':'')+'<button onclick="Planner.reopen()">เปิดแก้ไข</button>':conflict?'<button class="primary" onclick="Planner.compare()">เปรียบเทียบฉบับ</button>':'<button class="primary" onclick="Planner.closeMonth()" '+(!editable()?'disabled':'')+'>ปิดยอดเดือนนี้</button>';
  return '<div class="planner-bar'+(closed?' planner-closed':'')+'"><div class="planner-bar-copy"><strong>'+(closed?'ปิดยอด · '+labels[closed.status]:esc(monthLabel(state.selected)))+'</strong><span role="status">'+esc(status())+'</span>'+(closed?'<small>ตรึงรายชื่อและเรทเงินแล้ว · '+money(closed.totalCents/100)+' บาท</small>':m.rateSnapshot?'<small>ใช้เรทที่เก็บไว้ของเดือนนี้ <button onclick="Planner.currentRates()">ใช้เรทปัจจุบัน</button></small>':'')+'</div><div class="planner-actions">'+account+actions+'</div></div>';
 }
 function refreshUI(){
  if(!initialized)return;for(const id of ['plannerScheduleStatus','plannerSummaryStatus']){const el=$(id);if(el)el.innerHTML=bar()}
  const disabled=!editable();document.querySelectorAll('#scheduleTable .cell-btn,#scheduleTable .day-head,#scheduleTable [data-quota-id],#summaryTable [data-quota-id],#autoBtn,#inspectTool,#paintTools button').forEach(el=>el.disabled=disabled);
  if(busy||loading)document.querySelectorAll('#plannerScheduleStatus button,#plannerSummaryStatus button').forEach(el=>el.disabled=true);
 }
 function applyDocs(){
  if(!sync||!sameOwner())return;applying=true;
  try{for(const doc of Object.values(sync.docs))PlannerModel.apply(state,doc.data);if(preferRemoteMonth){preferRemoteMonth=false;const current=PlannerModel.capture(state,state.selected);if(!sync.meaningful(current)){const populated=Object.values(sync.docs).filter(d=>sync.meaningful(d.data)).sort((a,b)=>b.data.key.localeCompare(a.data.key));if(populated.length)state.selected=populated[0].data.key}}Personnel.align();history=[];normalizeCalendarState(state);save();render()}
  finally{applying=false}
 }
 function beforeSave(){
  if(!initialized||applying||!sameOwner())return;
  if(!sync?.ready||loading||busy&&!authorized){for(const[key,m]of Object.entries(initialMonths))state.months[key]=copy(m);return}
  let repaired=false;
  for(const[key,doc]of Object.entries(sync.docs))if((doc.data.month.settlement||doc.blocked)&&!authorized&&PlannerModel.digest(state.months[key])!==PlannerModel.digest(doc.data.month)){PlannerModel.apply(state,doc.data);repaired=true}
  if(repaired)toast('เดือนที่ปิดยอดยังเก็บตารางเดิมไว้ กรุณาเปิดแก้ไขก่อน');
  if(stale||cacheError)return;
  try{
   let dirty=false;for(const key of Object.keys(state.months)){const data=PlannerModel.capture(state,key);if(sync.docs[key]?.blocked)continue;if(sync.edit(data,reason))dirty=true}
   initialMonths=copy(state.months);reason='แก้ไขตาราง';if(dirty)schedule();
  }catch(e){notice=e.message;refreshUI();toast('ตารางยังรอสำรอง: '+e.message)}
 }
 function switched(account){
  if(initialized&&owner?.id===account?.id)return;
  epoch++;sync?.dispose();sync=null;owner=account;loading=false;notice='';cacheError='';stale=false;busy=false;pendingClose=null;clearTimeout(timer);retries=0;initialMonths=copy(state.months);initialized=true;
  if(!account){refreshUI();return}
  const key='pruksa-planner:teen-program:'+account.id,target=epoch;let raw=localStorage.getItem(key);preferRemoteMonth=!raw;
  try{
   sync=new PlannerSync({cache:()=>raw?JSON.parse(raw):null,
    persist(value){if(target!==epoch)return;if(localStorage.getItem(key)!==raw){stale=true;throw Error('ตารางถูกแก้ไขจากอีกแท็บ กรุณาสำรองแล้วรีเฟรช')}try{const next=JSON.stringify(value);localStorage.setItem(key,next);raw=next;cacheError=''}catch(e){cacheError='พื้นที่บันทึกในเครื่องไม่เพียงพอ กรุณาสำรอง JSON';throw e}},
    readAll:async()=>{const result=await CodeLibrary.planner();return result.data},read:month=>CodeLibrary.planner(month),write:(month,body,etag)=>CodeLibrary.planner(month,{method:'PUT',body,etag}),
    onChange(e){if(target!==epoch)return;if(e.type==='loaded')applyDocs();else refreshUI()}
   });
   load(true);
  }catch(e){notice=e.message;refreshUI()}
 }
 async function load(migrate=false){
  if(!sync||!sameOwner()||busy)return;const target=epoch,client=sync;loading=true;refreshUI();
  try{
   const local=migrate?Object.fromEntries(Object.keys(state.months).map(key=>[key,PlannerModel.capture(state,key)])):{};
   await client.load(local);if(target!==epoch)return;loading=false;notice=client.migrated?'เก็บตารางเดิมของเครื่องนี้ในประวัติแล้ว เปิดประวัติเพื่อเลือกกู้คืนได้':'';initialMonths=copy(state.months);retries=0;refreshUI();schedule(0);
  }catch(e){if(target!==epoch)return;loading=false;notice=e.message;refreshUI();if(e.retryable){clearTimeout(timer);timer=setTimeout(()=>load(migrate),Math.min(30000,3000*2**Math.min(retries++,4)))}}
 }
 function schedule(delay=650){clearTimeout(timer);if(!sync?.ready||!sameOwner()||stale)return;timer=setTimeout(()=>flush().catch(()=>{}),delay)}
 async function flush(){
  if(!sync||!sameOwner()||!sync.ready)return;const target=epoch,client=sync;
  try{await client.flush();if(target!==epoch)return;retries=0;notice='';refreshUI();if(Object.values(client.docs).some(d=>d.dirty&&!d.blocked))schedule()}
  catch(e){if(target!==epoch)return;notice=e.message;refreshUI();if(e.retryable)schedule(Math.min(30000,3000*2**Math.min(retries++,4)));throw e}
 }
 async function reload(){if(!owner)return CodeLibrary.cloud();if(busy)return;if(stale){toast('กรุณาสำรอง JSON ของแท็บนี้แล้วรีเฟรช เพื่อเปิดข้อมูลจากอีกแท็บ');return}try{if(cacheError){sync.persist('retry');cacheError=''}await flush();await load(!sync?.ready)}catch(e){toast(e.message)}}
 async function operation(fn){
  if(!sameOwner()||!sync?.ready||loading||busy||stale||cacheError){toast('กรุณาโหลดตารางออนไลน์ให้สำเร็จก่อน');return}
  const target=epoch;busy=true;refreshUI();
  try{await flush();if(target!==epoch)return;await Personnel.flush();if(target!==epoch)return;if(!await Personnel.refreshOnline())throw Error('ยังตรวจสอบเรทบุคลากรล่าสุดไม่ได้ กรุณาลองอีกครั้ง');if(target!==epoch)return;await fn();if(target!==epoch)return;await flush()}
  catch(e){if(target===epoch){notice=e.message;toast(e.message);refreshUI()}}
  finally{if(target===epoch){busy=false;initialMonths=copy(state.months);refreshUI()}}
 }
 function commit(data,label){authorized=true;try{reason=label;PlannerModel.apply(state,data);changed()}finally{authorized=false}}
 function closeMonth(){
  if(!owner)return CodeLibrary.cloud();if(!guard())return;
  const key=state.selected,data=PlannerModel.capture(state,key),value=summary(data),issues=scheduleAudit().issues.length;
  pendingClose={key,fingerprint:PlannerModel.digest({month:data.month,rates:data.rates})};
  modal('ปิดยอด '+monthLabel(key),'<div class="planner-close-preview"><b>'+value.count+' เวร</b><strong>'+money(value.pay)+' บาท</strong><p>เก็บรายชื่อ ตาราง และเรทเงินของเดือนนี้ไว้ การเปลี่ยนข้อมูลบุคลากรภายหลังจะไม่เปลี่ยนยอดที่ปิดแล้ว</p>'+(issues?'<p class="planner-warning">ยังมีรายการต้องตรวจ '+issues+' รายการ ปิดไว้เป็นสถานะรอตรวจได้</p>':'')+'</div>','<button onclick="closeModal()">ยกเลิก</button><button class="primary" onclick="Planner.confirmClose('+esc(JSON.stringify(key))+')">ปิดยอดเพื่อรอตรวจ</button>');
 }
 async function confirmClose(key){if(key!==state.selected)return;const preview=pendingClose?.key===key?pendingClose:{key,fingerprint:PlannerModel.digest({month:PlannerModel.capture(state,key).month,rates:PlannerModel.capture(state,key).rates})};await operation(async()=>{const data=PlannerModel.capture(state,key);if(preview.fingerprint!==PlannerModel.digest({month:data.month,rates:data.rates})){pendingClose=null;busy=false;closeMonth();busy=true;toast('เรทหรือข้อมูลเปลี่ยน กรุณาตรวจยอดล่าสุดก่อนปิดเดือน');return}commit(PlannerModel.close(data),'ก่อนปิดยอด');pendingClose=null;closeModal();toast('ปิดยอดและเก็บเรทของเดือนนี้แล้ว')})}
 async function setStatus(status){
  const key=state.selected,v=activeMonth().settlement;if(!v)return;
  if(status==='confirmed'&&!scheduleAudit().complete){toast('ตารางยังมีรายการต้องตรวจ กรุณาเปิดแก้ไขก่อนยืนยัน');issuesModal();return}
  if(!confirm((status==='paid'?'ระบุว่าได้รับเงินแล้ว':'ยืนยันยอด')+' '+monthLabel(key)+' จำนวน '+money(v.totalCents/100)+' บาท?'))return;
  await operation(async()=>{commit(PlannerModel.status(PlannerModel.capture(state,key),status),'ก่อนเปลี่ยนสถานะยอด');toast('บันทึกสถานะ '+labels[status]+' แล้ว')});
 }
 async function reopen(){const key=state.selected;if(!activeMonth().settlement||!confirm('เปิดแก้ไข '+monthLabel(key)+'? จะเก็บรุ่นปิดยอดไว้ในประวัติ และยังใช้เรทเดิมของเดือนนี้'))return;await operation(async()=>{commit(PlannerModel.reopen(PlannerModel.capture(state,key)),'ก่อนเปิดแก้ไขเดือน');toast('เปิดแก้ไขเดือนนี้แล้ว')})}
 async function currentRates(){const key=state.selected;if(!guard()||!activeMonth().rateSnapshot||!confirm('เปลี่ยนเดือนนี้ให้ใช้เรทปัจจุบันจากบุคลากร? ยอดเงินจะคำนวณใหม่ และเก็บรุ่นเดิมไว้ในประวัติ'))return;await operation(async()=>{const data=PlannerModel.capture(state,key);delete data.month.rateSnapshot;commit(data,'ก่อนอัปเดตเรทเดือนนี้')})}
 function historyModal(){
  if(!owner)return CodeLibrary.cloud();const key=state.selected,doc=sync?.docs[key];
  if(!doc){toast('กำลังเตรียมประวัติของเดือนนี้');return}
  modal('ประวัติ '+monthLabel(key),'<div class="planner-history-intro">เก็บอัตโนมัติสูงสุด 20 รุ่นต่อเดือน · กู้คืนแล้วเก็บฉบับปัจจุบันไว้ย้อนกลับได้</div><div class="planner-history-list">'+[...doc.history].reverse().map(v=>{const s=summary(v.data);return '<article><div><b>'+esc(v.label)+'</b><small>'+esc(date(v.at))+'</small><span>'+s.count+' เวร · '+money(s.pay)+' บาท'+(v.data.month.settlement?' · '+labels[v.data.month.settlement.status]:'')+'</span></div><button onclick="Planner.restore('+esc(JSON.stringify(key))+','+esc(JSON.stringify(v.id))+')">กู้คืนรุ่นนี้</button></article>'}).join('')+(!doc.history.length?'<p>ยังไม่มีรุ่นก่อนหน้า ระบบจะเก็บให้เมื่อแก้ไขตาราง</p>':'')+'</div>','<button onclick="downloadBackup()">สำรอง JSON เพิ่มเติม</button><button onclick="closeModal()">ปิด</button>');
 }
 async function restore(key,id){
  const entry=sync?.docs[key]?.history.find(v=>v.id===id);if(!entry||!confirm('กู้คืน '+monthLabel(key)+' จาก '+date(entry.at)+'? ฉบับปัจจุบันจะเก็บไว้ในประวัติ'))return;
  await operation(async()=>{const data=PlannerModel.restore(entry.data);commit(data,'ก่อนกู้คืนรุ่นสำรอง');closeModal();toast('กู้คืนตารางเดือนนี้แล้ว')});
 }
 async function compare(){
  const key=state.selected,client=sync,target=epoch;if(!client?.docs[key])return;
  try{const result=await CodeLibrary.planner(key);if(target!==epoch)return;const remote=client.decode(result.data,key);if(!remote)throw Error('ไม่พบตารางออนไลน์');const local=summary(client.docs[key].data),cloud=summary(remote.data);
   modal('เลือกตาราง '+monthLabel(key),'<div class="planner-compare"><article><h3>ฉบับในเครื่องนี้</h3><b>'+local.count+' เวร</b><strong>'+money(local.pay)+' บาท</strong></article><article><h3>ฉบับออนไลน์</h3><b>'+cloud.count+' เวร</b><strong>'+money(cloud.pay)+' บาท</strong></article></div><p class="help">ฉบับที่ไม่ได้เลือกจะเก็บไว้ในประวัติ ก่อนบันทึกฉบับที่เลือกเป็นรุ่นใหม่</p>','<button onclick="downloadBackup()">สำรอง JSON</button><button onclick="Planner.resolve(\'remote\')">ใช้ฉบับออนไลน์</button><button class="primary" onclick="Planner.resolve(\'local\')">ใช้ฉบับในเครื่องนี้</button>');
  }catch(e){toast(e.message)}
 }
 async function resolve(choice){if(!['local','remote'].includes(choice)||!confirm('ใช้'+(choice==='local'?'ฉบับในเครื่องนี้':'ฉบับออนไลน์')+' สำหรับ '+monthLabel(state.selected)+'?'))return;const target=epoch,key=state.selected;try{await sync.resolve(key,choice);if(target!==epoch)return;closeModal();notice='';await flush();refreshUI()}catch(e){notice=e.message;toast(e.message)}}
 function init(){if(initialized)return;CodeLibrary.onAccount(switched);CodeLibrary.beforeLogout(flush);poll()}
 function poll(){clearTimeout(pollTimer);pollTimer=setTimeout(()=>{if(owner&&sync?.ready&&!loading&&!busy&&!stale&&!document.hidden&&!$('modal').open&&!Object.values(sync.docs).some(d=>d.dirty))Personnel.refreshOnline().then(()=>load());poll()},30000)}
 window.addEventListener('online',()=>{if(owner&&!sync?.ready)load(true);else flush().catch(()=>{})});
 window.addEventListener('focus',()=>{if(!owner||busy||$('modal').open)return;if(Object.values(sync?.docs||{}).some(d=>d.dirty))flush().catch(()=>{});else load(!sync?.ready)});
 window.addEventListener('beforeunload',e=>{if(cacheError||Object.values(sync?.docs||{}).some(d=>d.dirty)){e.preventDefault();e.returnValue=''}});
 window.addEventListener('storage',e=>{if(owner&&e.key==='pruksa-planner:teen-program:'+owner.id){stale=true;refreshUI()}});
 document.addEventListener('DOMContentLoaded',init);
 return {init,beforeSave,refreshUI,guard,note:label=>{reason=label||'แก้ไขตาราง'},flush,reload,history:historyModal,restore,closeMonth,confirmClose,setStatus,reopen,currentRates,compare,resolve};
})();
