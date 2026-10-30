
const $=id=>document.getElementById(id),esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let state=clone(SEED),history=[],currentView='codes',editing=null,choice='',toastTimer;
const STORE='card-room-planner-v1';
try{let raw=localStorage.getItem(STORE);if(raw){let v=JSON.parse(raw);validateBackup(v);state=v}}catch(e){setTimeout(()=>toast('เปิดข้อมูลที่บันทึกไม่ได้ ใช้ข้อมูลตั้งต้นแทน'),300)}
const removedLegacySample=isLegacyOctoberSample(state.months['2026-10']);
if(removedLegacySample){checkpoint();state.months['2026-10']=freshMonth('2026-10');state.source=SEED.source}
if(!state.payRates)state.payRates=clone(DEFAULT_PAY_RATES);
function addNinthStaff(s){
 if(s.people.length!==8||!s.people.every((p,i)=>p.id===String(i+1)))return false;
 s.people.push(clone(SEED.people.find(p=>p.id==='9')));
 s.payRates={...s.payRates,'9':s.payRates?.['9']??DEFAULT_PAY_RATES['9']};
 return true;
}
const addedNinthStaff=addNinthStaff(state);
function restrictNinthStaff(s){const p=s.people.find(p=>p.id==='9');if(!p||JSON.stringify(p.allowed)===JSON.stringify(['X']))return false;p.allowed=['X'];return true}
const restrictedNinthStaff=restrictNinthStaff(state);
const normalizedPayRates=normalizePayRates(state);
state.pairExclusions=clone(DEFAULT_PAIR_EXCLUSIONS);
if(!state.mainStaffIds)state.mainStaffIds=clone(MAIN_STAFF_IDS);
if(!state.quotas)state.quotas={};
function clearManualBoundaries(s){for(const p of s.people){p.prev='';p.next=''}for(const m of Object.values(s.months))delete m.boundaries}
clearManualBoundaries(state);
function monthLabel(m){let[y,mm]=m.split('-').map(Number);return new Date(y,mm-1,1).toLocaleDateString('th-TH',{month:'long',year:'numeric'})}
function activeMonth(){return state.months[state.selected]}
function scheduleAudit(){return audit(state,state.selected,{distribution:true})}
function save(){try{localStorage.setItem(STORE,JSON.stringify(state));$('saveStatus').textContent='บันทึกในเครื่องแล้ว'}catch(e){$('saveStatus').textContent='บันทึกในเครื่องไม่ได้ — กรุณาสำรองไฟล์'}}
function checkpoint(){history.push(clone(state));if(history.length>25)history.shift()}
function normalizeCalendarState(s){let changed=false;for(const month of Object.keys(s.months))if(normalizeCalendarDemand(s,month))changed=true;return changed}
function changed(){normalizeCalendarState(state);save();render()}
function undo(){if(!history.length)return;state=history.pop();changed();toast('ย้อนการแก้ไขแล้ว')}
function toast(s,fromTop=false){
 const notice=$('toast');clearTimeout(toastTimer);
 if(notice.hasAttribute?.('popover')&&notice.matches(':popover-open'))notice.hidePopover();
 if(notice.hasAttribute?.('popover'))notice.removeAttribute('popover');
 if(notice.parentElement?.tagName==='DIALOG')document.body.appendChild(notice);
 notice.classList.remove('toast-top');notice.textContent=s;notice.classList.remove('hidden');
 if(fromTop){
  void notice.offsetWidth;notice.classList.add('toast-top');
  if(typeof notice.showPopover==='function'){notice.setAttribute('popover','manual');notice.showPopover()}
  else if($('modal').open)$('modal').appendChild(notice);
 }
 toastTimer=setTimeout(()=>{
  if(notice.hasAttribute?.('popover')&&notice.matches(':popover-open'))notice.hidePopover();
  notice.classList.add('hidden');
  if(notice.parentElement?.tagName==='DIALOG')document.body.appendChild(notice);
 },4500);
}
function view(v){if(typeof cancelPaint==='function')cancelPaint();currentView=v;for(const [name,id]of [['schedule','Schedule'],['summary','Summary'],['codes','Codes']]){const section=$(name==='codes'?'codesView':name+'View'),button=$('nav'+id);if(section)section.classList.toggle('hidden',v!==name);if(button)button.classList.toggle('active',v===name)}if(typeof CodeLibrary!=='undefined'){if(v==='codes')CodeLibrary.render();else CodeLibrary.suspend()}}
function selectMonth(m){if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(m)||+m.slice(0,4)<1900||+m.slice(0,4)>2200){toast('เลือกปี ค.ศ. 1900–2200');return}if(typeof cancelPaint==='function')cancelPaint();state.selected=m;if(!state.months[m])state.months[m]=freshMonth(m);changed()}
function changeMonth(off){selectMonth(monthOffset(state.selected,off))}
function categoryCountInfo(s,month,id,category){
 const t=totals(s,month).find(t=>t.id===id),actual=category==='total'?t.total:categoryTotals(t)[category],target=category==='total'?quotaTargets(s,month)[id]:categoryTargets(s,month)[id]?.[category],gap=target===undefined?0:target-actual;
 return{actual,target,value:target??(category==='total'?personCategoryTotal(s,month,id):actual),status:target===undefined?'auto':gap>0?'under':gap<0?'over':'complete',hint:target===undefined?'':gap>0?'ขาด '+gap:gap<0?'เกิน '+(-gap):'ครบ'};
}
function personCategoryTotal(s,month,id){return SHIFT_GROUPS.reduce((sum,g)=>sum+categoryCountInfo(s,month,id,g.id).value,0)}
function personTotal(p){return totalEditor(p,{id:'total',label:'รวม'})}
function totalEditor(p,kind){
 const info=categoryCountInfo(state,state.selected,p.id,kind.id),isTotal=kind.id==='total';
 return '<div class="total-editor"><input type="number" min="0" max="'+daysIn(state.selected)+'" step="1" inputmode="numeric" class="quota-input'+(isTotal?' person-total':'')+'" data-quota-id="'+esc(p.id)+'" data-quota-category="'+kind.id+'" value="'+info.value+'"'+(isTotal?' data-person-total="'+esc(p.id)+'"':'')+' title="ลงแล้ว '+info.actual+' เวร · กรอก 0 = ไม่รับเวร · เว้นว่าง = ให้ระบบคำนวณ · '+(isTotal?'กรอกเป้ารวมเพื่อให้ระบบแบ่งห้องบัตรและรุ่งอรุณใหม่ แทนเป้าแยกประเภทของคนนี้ · ล้างเพื่อกลับมาบวกสองช่อง':'พิมพ์ตัวเลขเพื่อกำหนดเป้า หรือล้างเพื่อกลับมานับอัตโนมัติ')+'" aria-label="'+kind.label+' จำนวนเวร '+esc(p.name)+'" oninput="this.dataset.quotaEdited=\'true\';onQuotaInput(this,\''+p.id+'\',\''+kind.id+'\')" onchange="this.dataset.quotaEdited=\'false\';onQuotaChange(\''+p.id+'\',this.value,\''+kind.id+'\')" onblur="if(this.dataset.quotaEdited===\'true\'){this.dataset.quotaEdited=\'false\';onQuotaChange(\''+p.id+'\',this.value,\''+kind.id+'\')}"></div>';
}
function targetSum(s,month){
 const categories=categoryTargets(s,month);let total;
 try{total=quotaTargets(s,month)}catch(e){total={...(s.months[month].quotas||s.quotas||{})};for(const[id,values]of Object.entries(categories))if(SHIFT_GROUPS.every(g=>values[g.id]!==undefined))total[id]=Object.values(values).reduce((a,b)=>a+b,0)}
 return monthPeople(s,month).reduce((sum,p)=>sum+(total[p.id]??personCategoryTotal(s,month,p.id)),0);
}
function categoryTargetSums(s,month){return Object.fromEntries(SHIFT_GROUPS.map(g=>[g.id,monthPeople(s,month).reduce((sum,p)=>sum+categoryCountInfo(s,month,p.id,g.id).value,0)]))}
function calendarDemandModal(){
 const d=calendarDemand(state,state.selected);
 modal('จำนวนเวรจากปฏิทิน','<p><b>'+esc(monthLabel(state.selected))+'</b></p><p>วันธรรมดา '+d.regularDays+' วัน × 2 เวร = '+(d.regularDays*2)+' เวร<br>ดึก 1 + บ่าย 1 ต่อวัน</p><p>เสาร์–อาทิตย์และวันหยุดพิเศษ '+d.holidayDays+' วัน × 4 เวร = '+(d.holidayDays*4)+' เวร<br>เช้า 2 + บ่าย 1 + ดึก 1 ต่อวัน<br>วันหยุดพิเศษที่ตรงเสาร์–อาทิตย์นับเพียงครั้งเดียว</p><p><b>ห้องบัตรทั้งหมด '+d.card+' เวร</b></p><p><b>รุ่งอรุณทั้งหมด '+d.dawn+' เวร</b> = หน้าตู้KIOS '+d.R+' + รพ.สต. '+d.X+'</p><p><b>เวรทั้งหมด '+d.total+' เวร</b> = ห้องบัตร '+d.card+' + รุ่งอรุณ '+d.dawn+' — ตรงกับกล่องเวรทั้งหมด</p><p class="help">กำหนดวันหยุดพิเศษที่หัววันที่ ระบบคำนวณใหม่ให้ทันที OFF / Vac ของบุคลากรใช้กันวันรับเวร ไม่ได้ลดจำนวนเวรของเดือน</p>');
}
function dawnShareInfo(s,month){const plan=distributionPlan(s,month),count=new Set([...(plan.totalR?plan.rIds:[]),...(plan.totalX?plan.xIds:[])]).size,total=plan.totalR+plan.totalX,low=count?Math.floor(total/count):0,high=count?Math.ceil(total/count):0;return{plan,count,total,range:low+(low!==high?'–'+high:'')}}
function dawnPlanHint(s){const info=dawnShareInfo(s,s.selected);return'เปิด '+info.total+' เวร · '+(info.count?'เฉลี่ย '+info.range+' / คน':'ไม่มีผู้รับเวร')}
function dawnPlanModal(){
 const info=dawnShareInfo(state,state.selected),plan=info.plan;
 const rows=monthPeople(state,state.selected).filter(p=>p.active).map(p=>'<tr><td>'+esc(p.name)+'</td><td>'+(plan.preferredR[p.id]||0)+'</td><td>'+(plan.preferredX[p.id]||0)+'</td><td><b>'+((plan.preferredR[p.id]||0)+(plan.preferredX[p.id]||0))+'</b></td></tr>').join('');
 modal('สัดส่วนเวรรุ่งอรุณ','<p>เปิดทั้งหมด <b>'+info.total+' เวร</b> = หน้าตู้KIOS '+plan.totalR+' + รพ.สต. '+plan.totalX+' เวร<br>'+(info.count?'เฉลี่ย '+info.total+' ÷ '+info.count+' คน = <b>คนละ '+info.range+' เวร</b>':'ยังไม่มีผู้รับเวรในประเภทที่เปิด')+'</p><p>จำนวนแนะนำด้านล่างปรับตามสิทธิ์รับเวร วันว่าง และเป้าปัจจุบัน นายปรเมศวร์รับเฉพาะ รพ.สต. ผลจัดจริงอาจต่างตาม OFF / Vac เวรล็อก และข้อจำกัดรายวัน</p>'+(plan.error?'<p class="warning">'+esc(plan.error)+'</p>':'')+'<table class="dawn-plan-table"><thead><tr><th>บุคลากร</th><th>หน้าตู้KIOS</th><th>รพ.สต.</th><th>รวมรุ่งอรุณ</th></tr></thead><tbody>'+rows+'</tbody></table><p>ให้ตัวหลักรวมพฤกษาก่อน แล้วแบ่งให้รพีพรรณ · คำนวณเวร นวก. ตามเรทรายคน ให้รายได้น้อยกว่าเฉลี่ยตัวหลัก 2–4 ประมาณ 500–700 บาท เป็นเป้าหมาย ไม่ใช่ข้อบังคับ · นวก. ยังมีเวรรวมไม่เกินตัวหลักทุกคน เป้าที่กรอกเอง วันลา และเวรล็อกมาก่อน</p>','<button class="btn primary" onclick="closeModal()">ปิด</button>');
}
function updateTargetTotals(s,skipInput=null){
 const actual=totals(s,s.selected);for(const g of SHIFT_GROUPS)$('categoryTotal-'+g.id).textContent=actual.reduce((sum,t)=>sum+categoryTotals(t)[g.id],0);
 $('dawnPlanHint').textContent=dawnPlanHint(s);
 document.querySelectorAll('[data-person-total]').forEach(el=>{if(el!==skipInput)el.value=categoryCountInfo(s,s.selected,el.dataset.personTotal,'total').value});
}
function render(){
 const month=state.selected,m=activeMonth(),n=daysIn(month),report=scheduleAudit(),tt=report.totals,included=new Set(monthPeople(state,month).map(p=>p.id));
 $('monthPicker').value=month;$('monthTitle').textContent=monthLabel(month);$('summaryMonth').textContent='· '+monthLabel(month);$('totalsMonth').textContent=monthLabel(month);
 const categorySums=Object.fromEntries(SHIFT_GROUPS.map(g=>[g.id,tt.reduce((sum,t)=>sum+categoryTotals(t)[g.id],0)])),demand=calendarDemand(state,month);
 $('sourceNote').textContent='ตารางประจำเดือน · กรุณาเพิ่มวันหยุดราชการของเดือนนี้';
 $('undoBtn').disabled=!history.length;

 $('categoryTotals').innerHTML='<div class="total-pill total-pill-all"><span>เวรทั้งหมด<button class="dawn-plan-hint" onclick="calendarDemandModal()" title="จำนวนเวรทั้งหมดจากปฏิทิน รวมรุ่งอรุณทั้งสองสี">ห้องบัตร '+demand.card+' + รุ่งอรุณ '+demand.dawn+'</button></span><strong id="calendarTotal" aria-live="polite">'+demand.total+'</strong><small>เวร</small></div>'+SHIFT_GROUPS.map(g=>'<div class="total-pill total-pill-'+g.id+'"><span>'+(g.id==='card'?'ลงแล้ว':g.label)+(g.id==='dawn'?'<button id="dawnPlanHint" class="dawn-plan-hint" onclick="dawnPlanModal()" title="ดูจำนวนรุ่งอรุณที่เปิดและสัดส่วนแนะนำรายคน">'+dawnPlanHint(state)+'</button>':'')+'</span><strong id="categoryTotal-'+g.id+'" aria-label="ผลรวม '+g.label+'" aria-live="polite">'+categorySums[g.id]+'</strong><small>เวร</small></div>').join('')+
  '<button type="button" class="total-pill total-pill-issues'+(report.complete?' complete':'')+'" onclick="issuesModal()" title="เปิดรายละเอียดตรวจเงื่อนไข"><span>รายการที่ต้องตรวจ</span><strong id="issueCount" aria-live="polite">'+report.issues.length+'</strong><small>รายการ</small></button>';
 let invalid=new Set(report.issues.filter(i=>i.p&&i.d).map(i=>key(i.p,i.d))),head='<thead><tr><th class="person">บุคลากร <span style="font-size:16px;color:#8da097">/ วันที่</span></th>';
 for(let d=1;d<=n;d++){let h=m.days[d].holiday||[0,6].includes(weekday(month,d)),outreach=m.days[d].need.X;head+='<th class="'+(h?'holiday':'')+'"><button class="day-head" onclick="dayModal('+d+')" title="'+esc((m.days[d].note||'กำหนดจำนวนเวร')+(outreach?' · ออก รพ.สต. '+outreach+' คน':''))+'"><b>'+d+'</b><small>'+['อา.','จ.','อ.','พ.','พฤ.','ศ.','ส.'][weekday(month,d)]+'</small>'+(outreach?'<span class="outreach-day">รพ.สต.</span>':'')+'</button></th>'}
 head+=SHIFT_GROUPS.map(g=>'<th class="total-head total-'+g.id+'">'+g.label+'</th>').join('')+'<th class="total-head total-total">รวม</th></tr></thead><tbody>';
 state.people.forEach((p,i)=>{if(!included.has(p.id))return;head+='<tr><th class="person"><div class="name"><span class="number">'+String(i+1).padStart(2,'0')+'</span>'+esc(p.name)+'</div><div class="role">'+esc(p.role)+(p.id==='9'?' · เฉพาะ รพ.สต.':'')+(p.active?'':' · งดจัดเวร')+(manualPeople(m).has(p.id)?' · มีเวรล็อก':'')+'</div></th>';
 for(let d=1;d<=n;d++){let c=cell(m,p.id,d),holiday=m.days[d].holiday||[0,6].includes(weekday(month,d)),label=c.code?META[c.code].label:c.block||'·',cl=c.code||c.block||'empty';head+='<td class="'+(holiday?'holiday ':'')+(invalid.has(key(p.id,d))?'bad':'')+'"><button class="cell-btn '+(!c.code&&c.block?c.block:'')+'" data-i="'+i+'" data-d="'+d+'" tabindex="-1" aria-label="'+esc(p.name+' วันที่ '+d+' '+(c.code?META[c.code].name:c.block||'ว่าง'))+'">'+(c.locked&&c.code?'<span class="lock" title="ล็อกเวร">◆</span>':'')+'<span class="chip '+cl+'">'+label+'</span>'+(c.code&&c.block?'<small style="font-size:8px;color:#ab5680">'+c.block+'</small>':'')+'</button></td>'}
 head+=SHIFT_GROUPS.map(g=>'<td class="sum total-'+g.id+'">'+totalEditor(p,g)+'</td>').join('')+'<td class="sum total-total">'+personTotal(p)+'</td></tr>'});
 head+='</tbody>';$('scheduleTable').innerHTML=head;
 let max=Math.max(...tt.map(t=>t.total),1);
 let grandTotalPay=0, sumTotal=0, sumHours=0, sumNeed=CODES.map(c=>tt.reduce((a,x)=>a+x[c],0)), sumOff=tt.reduce((a,x)=>a+x.OFF,0), sumVac=tt.reduce((a,x)=>a+x.VAC,0);
 let rowsHtml=state.people.map((p,i)=>{
  if(!included.has(p.id))return '';
  let rates=PAY_GROUPS.map(g=>payRate(state,p.id,g.id));
  let pay=totalPay(state,tt[i]);
  grandTotalPay=Math.round((grandTotalPay+pay)*100)/100;sumTotal+=tt[i].total;sumHours+=tt[i].hours;
  let isMain=(i<=3);
  return '<tr>'+
   '<td style="text-align:left;padding-left:18px"><b>'+(i+1)+'.</b> '+esc(p.name)+(isMain?' <span style="font-size:16px;background:#e0f2fe;color:#0369a1;padding:1px 5px;border-radius:4px;margin-left:4px">ตัวหลัก</span>':'')+'</td>'+
   CODES.map(c=>'<td>'+tt[i][c]+'</td>').join('')+
   '<td>'+tt[i].OFF+'</td><td>'+tt[i].VAC+'</td>'+
   SHIFT_GROUPS.map(g=>'<td>'+totalEditor(p,g)+'</td>').join('')+'<td>'+personTotal(p)+'</td>'+
   PAY_GROUPS.map((g,j)=>'<td class="pay-rate-cell" onclick="staffModal()" style="cursor:pointer" title="ปรับเรท'+g.label+'">'+rates[j].toLocaleString('th-TH')+' ฿</td>').join('')+
   '<td class="pay-col">'+pay.toLocaleString('th-TH')+' ฿</td>'+
   '<td>'+tt[i].hours+' ชม.</td>'+
   '<td><div class="bars"><i style="width:'+tt[i].total/max*100+'%"></i></div></td>'+
  '</tr>';
 }).join('');
 let footHtml='<tfoot><tr>'+
  '<td style="text-align:left;padding-left:18px"><b>รวมทั้งสิ้น</b></td>'+
  CODES.map((c,ci)=>'<td><b>'+sumNeed[ci]+'</b></td>').join('')+
  '<td>'+sumOff+'</td><td>'+sumVac+'</td>'+
  SHIFT_GROUPS.map(g=>'<td><b style="color:var(--green)">'+tt.reduce((sum,t)=>sum+categoryTotals(t)[g.id],0)+'</b></td>').join('')+
  '<td><b style="color:var(--green)">'+sumTotal+'</b></td>'+PAY_GROUPS.map(()=>'<td>—</td>').join('')+
  '<td class="pay-col" style="font-size:16px"><b>'+grandTotalPay.toLocaleString('th-TH')+' ฿</b></td>'+
  '<td><b>'+sumHours+' ชม.</b></td><td></td>'+
 '</tr></tfoot>';
 $('summaryTable').innerHTML='<thead><tr><th style="text-align:left;padding-left:18px">บุคลากร</th>'+CODES.map(c=>'<th><span class="chip '+c+'">'+META[c].label+'</span></th>').join('')+'<th>OFF</th><th>VAC</th>'+SHIFT_GROUPS.map(g=>'<th>'+g.label+'</th>').join('')+'<th>รวม</th>'+PAY_GROUPS.map(g=>'<th>เรท'+g.label+'</th>').join('')+'<th>รวมเงิน</th><th>ชั่วโมง</th><th>สัดส่วน</th></tr></thead><tbody>'+rowsHtml+'</tbody>'+footHtml;
 const distribution=distributionPlan(state,month);
 let pairIssues=report.issues.filter(i=>i.type==='exclusion');
 let pairStatusText=pairIssues.length===0?'<span style="color:#16a34a">✓ พฤกษา (ลำดับ 1) และ รพีพรรณ (ลำดับ 8) ไม่อยู่กะเดียวกันในวันเดียวกัน (ร่วมวันคนละกะได้)</span>':('<span style="color:#dc2626">⚠ พบ '+pairIssues.length+' วันที่อยู่กะเดียวกัน</span>');
 $('fairnessDetail').innerHTML='<div style="line-height:1.8"><div><b>1. ห้องบัตร:</b> ตัวหลักรวมพฤกษาก่อน → รพีพรรณ → นวก. ตามส่วนต่างรายได้ · พยายามให้ นวก. ได้น้อยกว่าเฉลี่ยตัวหลัก 2–4 ประมาณ 500–700 บาท ไม่ใช่ข้อบังคับ · รายได้คำนวณตามเรทรายคน เป้าที่กรอกเอง วันว่าง OFF / Vac และเวรล็อกมาก่อน</div><div><b>2. หน้าตู้KIOS (ร สีฟ้า):</b> จ.–ศ. เดือนนี้ '+distribution.weekdays+' วัน · เปิดไว้ '+distribution.totalR+' เวร ÷ '+distribution.rIds.length+' คน = คนละ '+distribution.rMin+(distribution.rMax!==distribution.rMin?'–'+distribution.rMax:'')+' เวรเป็นค่าเฉลี่ย · กระจายตามปกติและสิทธิ์รับเวร · ไม่นับนายปรเมศวร์</div><div><b>3. รพ.สต. (ร สีแดง):</b> เปิดไว้ '+distribution.totalX+' เวร · ผู้รับเวร '+distribution.xIds.length+' คน · กระจายคนละ 1 เมื่อพอ ถ้าไม่พอให้ตัวหลักก่อน</div><div><b>4. เงื่อนไขคู่เวร:</b> '+pairStatusText+'</div><div><b>5. ประมาณการค่าตอบแทนเดือนนี้:</b> รวมทั้งสิ้น <b style="color:#15803d;font-size:16px">'+grandTotalPay.toLocaleString('th-TH')+' บาท</b> <button class="textbtn" onclick="staffModal()" style="margin-left:8px">แก้ไขเรทที่บุคลากร →</button></div></div>';
 view(currentView);if(typeof renderEditor==='function')renderEditor()
}
function modal(title,body,foot){if(typeof stopHelpReply==='function')stopHelpReply();$('modal').classList.remove('help-chat-modal');$('modalTitle').textContent=title;$('modalBody').innerHTML=body;$('modalFoot').innerHTML=foot||'<button onclick="closeModal()">ปิด</button>';if(!$('modal').open)$('modal').showModal()}
function closeModal(){if(typeof stopHelpReply==='function')stopHelpReply();$('modal').close();editing=null}
$('modal').addEventListener('click',e=>{if(e.target===$('modal')){let r=$('modal').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeModal()}});
function cellModal(i,d){
 editing={i,d};let p=state.people[i],c=cell(activeMonth(),p.id,d);choice=c.block||c.code||'';
 modal(p.name+' · วันที่ '+d,'<div class="help" style="margin-top:0">เลือกเวรได้วันละ 1 ประเภท · ด ช บ ติดกันได้ไม่เกิน 2 วัน · รวม ร ทั้งสองสีได้ไม่เกิน 3 วันติดกัน · ระบบจะรักษาเวรที่ล็อกไว้ และจัดช่องว่างวันอื่นให้ต่อได้</div><div class="options">'+['',...CODES,'OFF','VAC'].filter(code=>canUseSymbol(p,code)).map(code=>{let t=code===''?{label:'−',name:'ว่าง / ลบเวร',time:'พร้อมให้ระบบจัดเวร'}:META[code]||{label:code,name:code==='OFF'?'วันหยุดส่วนตัว':'วันลา',time:'ไม่รับเวรทุกประเภท'};return'<button class="option '+(choice===code?'selected':'')+'" data-choice="'+code+'" onclick="chooseCell(this)"><span class="chip '+code+'">'+t.label+'</span><div><b>'+t.name+'</b><small>'+t.time+'</small></div></button>'}).join('')+'</div><p class="help">OFF และ VAC จะถูกกันออกจากการจัดเวรอัตโนมัติ</p><label class="inline-field"><input id="lockCell" type="checkbox" '+(c.locked||c.code?'checked':'')+'> ล็อกเวรเฉพาะช่องนี้</label>', '<button onclick="closeModal()">ยกเลิก</button><button class="primary" onclick="saveCell()">บันทึกช่องนี้</button>')
}
function chooseCell(el){choice=el.dataset.choice;document.querySelectorAll('[data-choice]').forEach(x=>x.classList.toggle('selected',x===el));if(CODES.includes(choice))$('lockCell').checked=true}
function saveCell(){
 const {i,d}=editing,p=state.people[i],result=manualRange(state,state.selected,p.id,d,d,choice);
 if(!result.ok){toast(result.message);return}
 const updated=result.month.cells[key(p.id,d)]||clone(cell(result.month,p.id,d));
 updated.locked=!!updated.code&&$('lockCell').checked;result.month.cells[key(p.id,d)]=updated;
 checkpoint();state.months[state.selected]=result.month;changed();closeModal();toast('บันทึกแล้ว · ตรวจเป้าหมายและจำนวนคนได้ที่สรุป');
}
function dayModal(d){
 editing={d};let item=activeMonth().days[d],weekend=[0,6].includes(weekday(state.selected,d));
 modal('วันที่ '+d+' '+monthLabel(state.selected),'<label class="inline-field"><input type="checkbox" id="dayHoliday" '+(item.holiday||weekend?'checked':'')+' '+(weekend?'disabled':'')+' onchange="holidayPreset('+d+')"> '+(weekend?'เสาร์ / อาทิตย์ (ใช้เวรวันหยุด)':'วันหยุดราชการ / วันหยุดพิเศษ')+'</label><label class="field">ชื่อวันหยุด / หมายเหตุ<input id="dayNote" value="'+esc(item.note)+'" placeholder="เช่น วันหยุดชดเชย"></label><div class="help">ห้องบัตรคำนวณจากปฏิทิน: วันธรรมดา ดึก 1 / บ่าย 1 · วันหยุด เช้า 2 / บ่าย 1 / ดึก 1</div>'+CODES.map(c=>'<label class="inline-field"><span class="chip '+c+'">'+META[c].label+'</span><span style="flex:1">'+META[c].name+'<small style="display:block;color:#8b9c90">'+META[c].time+'</small></span><input id="need'+c+'" type="number" min="0" max="'+state.people.length+'" value="'+item.need[c]+'" '+(['N','M','A'].includes(c)?'readonly aria-readonly="true"':'')+'> คน</label>').join('')+'<p class="help">ร สีฟ้า หน้าตู้KIOS เริ่มต้นมีทุก จ.–ศ. รวมวันที่เป็นวันหยุดราชการ ปรับจำนวนได้ตามการปฏิบัติงานจริง · ร สีแดงใส่จำนวนในวันที่ออก รพ.สต.</p>','<button onclick="closeModal()">ยกเลิก</button><button class="primary" onclick="saveDay()">บันทึกวันที่นี้</button>')
}
function holidayPreset(d){let holiday=$('dayHoliday').checked||[0,6].includes(weekday(state.selected,d));$('needN').value=1;$('needM').value=holiday?2:0;$('needA').value=1}
function saveDay(){let d=editing.d,need={};for(let c of CODES){let v=Number($('need'+c).value);if(!Number.isInteger(v)||v<0||v>state.people.length){toast('จำนวนคนต้องเป็นจำนวนเต็ม 0–'+state.people.length);return}need[c]=v}checkpoint();if(activeMonth().autoCapacity)activeMonth().autoCapacity[d]=clone(need);activeMonth().days[d]={holiday:$('dayHoliday').checked,note:$('dayNote').value.trim(),need};changed();closeModal();toast('บันทึกจำนวนเวรแล้ว')}
async function autoSchedule(options={}){
 const resetTargets=options.resetTargets===true;
 try{if(!resetTargets)commitPendingQuotaInputs()}catch(e){modal('ตรวจเป้าจำนวนเวรก่อนจัด','<div class="issue">'+esc(e.message)+'</div>');return}
 let btn=$('autoBtn');btn.disabled=true;btn.innerHTML='<span class="spinner"></span>กำลังจัดเวร…';
 await new Promise(r=>setTimeout(r,60));
 try{
  const draft=resetTargets?clone(state):state;if(resetTargets)resetMonthTargets(draft);
  const result=solve(draft,state.selected,{distribution:true,calendar:true,vary:true});
  if(result.ok){checkpoint();if(resetTargets)discardPendingQuotaInputs();state.months[state.selected]=result.month;changed();toast('จัดครบทุกเวรแล้ว · จัดสัดส่วนตามลำดับรายได้ วันว่าง และเป้ารายคน')}
  else{
   const hasTargets=!resetTargets&&(Object.keys(quotaTargets(state,state.selected)).length||Object.keys(categoryTargets(state,state.selected)).length);
   modal('ยังจัดให้ครบทุกเงื่อนไขไม่ได้','<div class="issue">'+esc(result.message)+'</div>'+(hasTargets?'<p class="help">เลข 0 ที่กรอกเป็นเป้า หมายถึงไม่รับเวรในช่องนั้น หากต้องการให้ระบบคำนวณใหม่ กด “ล้างเป้ารายคน แล้วจัดใหม่” ระบบจะเก็บ OFF / Vac เวรล็อก และวันเปิดเวรไว้</p>':'')+'<p class="help">ข้อมูลเดิมยังอยู่ครบ ระบบจะไม่ฝืนลงเวรในวัน OFF / VAC ทำบ่ายต่อดึก / ร ทั้งสองสี ลง ร ติดกันข้ามวันทุกคู่สี หรือลงห้องบัตรติดกันเกิน 2 วัน</p>',hasTargets?'<button onclick="closeModal()">ปิด</button><button class="primary" onclick="closeModal();autoSchedule({resetTargets:true})">ล้างเป้ารายคน แล้วจัดใหม่</button>':undefined);
  }
 }
 catch(e){modal('เกิดข้อผิดพลาด','<p>จัดเวรไม่สำเร็จ ข้อมูลเดิมยังอยู่ กรุณาตรวจการตั้งค่าและลองใหม่</p>')}
 finally{btn.disabled=false;btn.innerHTML='✧ จัดเวรอัตโนมัติ'}
}
function issuesModal(){
 let a=scheduleAudit(),capacity=solveCapacity();
 modal(a.complete?'ผ่านทุกเงื่อนไข':'ตรวจเงื่อนไขตาราง',a.complete?'<div class="issue" style="background:#eff8ef;border-color:#d7eadc">✓ จำนวนคนครบทุกประเภท<br>✓ ไม่ชน OFF / VAC<br>✓ ไม่มีบ่ายต่อดึก / ร ทั้งสองสี<br>✓ ร ทั้งสองสีไม่ติดกันข้ามวัน รวมกรณีสลับสี<br>✓ ด ช บ ไม่เกิน 2 วันติดกัน และรวม ร ทั้งสองสีไม่เกิน 3 วันติดกัน และตรวจข้ามเดือน<br>✓ เวรดึกทุกวันตามสิทธิ์รายคน ยกเว้นปรเมศวร์รับเฉพาะ รพ.สต.<br>✓ รพ.สต. กระจายให้ตัวหลักก่อนเมื่อเวรไม่พอ<br>✓ หน้าตู้KIOS กระจายตามวันว่างและสิทธิ์รับเวร</div>':(capacity?'<div class="issue" style="margin-bottom:12px"><b>กำลังคนไม่พอ:</b> '+esc(capacity)+'</div>':'')+'<div class="issues-list">'+a.issues.map((x,i)=>'<button class="issue" onclick="focusIssue('+i+')">'+esc(x.text)+(x.p?' →':'')+'</button>').join('')+'</div>')
}
function solveCapacity(){let m=activeMonth();for(let d=1;d<=daysIn(state.selected);d++){let need=CODES.reduce((s,c)=>s+m.days[d].need[c],0),available=monthPeople(state,state.selected).filter(p=>p.active&&!cell(m,p.id,d).block).length;if(need>available)return'วันที่ '+d+' ต้องการ '+need+' คน แต่มีคนไม่ติด OFF / VAC '+available+' คน'}return''}
function focusIssue(i){let x=scheduleAudit().issues[i];if(x.p&&x.d){cellModal(state.people.findIndex(p=>p.id===x.p),x.d)}else if(x.d){dayModal(x.d)}else{view('summary');closeModal()}}
function staffModal(){
 const excluded=new Set(activeMonth().excludedStaffIds||[]);
 modal('บุคลากรและเรทเงิน','<div id="staffForm">'+state.people.map((p,i)=>'<div class="staff-item" data-id="'+esc(p.id)+'"><div class="staff-heading"><b>บุคลากร '+(i+1)+'</b><label class="inline-field"><input type="checkbox" class="p-included" '+(!excluded.has(p.id)?'checked':'')+'> ลงตารางเดือนนี้</label></div><div class="staff-grid"><label class="field">ชื่อ–สกุล<input class="p-name" maxlength="100" value="'+esc(p.name)+'"></label><label class="field">ตำแหน่ง<input class="p-role" maxlength="100" value="'+esc(p.role)+'"></label></div><div class="staff-rates">'+PAY_GROUPS.map(g=>'<label class="field">เรท'+g.label+' (บาท / เวร)<input type="number" class="p-rate-'+g.id+(g.id==='card'?' p-rate':'')+'" min="0" max="10000" step="0.01" value="'+payRate(state,p.id,g.id)+'"></label>').join('')+'</div></div>').join('')+'</div><p class="help">คนที่ไม่เลือกจะไม่ปรากฏในตาราง สรุปเงิน หรือเอกสารเดือนนี้ ข้อมูลเวรเดิมยังเก็บไว้และกลับมาได้เมื่อเลือกอีกครั้ง · เรทรุ่งอรุณใช้ร่วมกันทั้งหน้าตู้KIOS และ รพ.สต. · ค่าเริ่มต้น จพ.เวช 60 / พนักงาน 50 / นวก. 80 บาท · เรทใช้กับทุกเดือน</p>','<button onclick="closeModal()">ยกเลิก</button><button class="primary" onclick="saveStaff()">บันทึกบุคลากร</button>')
}
function saveStaff(){
 const result=[],rates={},excluded=[];
 for(const el of document.querySelectorAll('.staff-item')){
  const p=state.people.find(p=>p.id===el.dataset.id),name=el.querySelector('.p-name').value.trim();
  if(!name){toast('กรอกชื่อให้ครบทุกคน');return}
  const values={};
  for(const g of PAY_GROUPS){const input=el.querySelector('.p-rate-'+g.id),value=input.value.trim(),rate=Number(value);
   if(value===''||!Number.isFinite(rate)||rate<0||rate>10000||Math.abs(rate*100-Math.round(rate*100))>1e-7){toast('เรทเงินต้องเป็นตัวเลข 0–10,000 บาท ทศนิยมไม่เกิน 2 ตำแหน่ง');input.focus();return}
   values[g.id]=rate;
  }
  rates[p.id]=values;if(!el.querySelector('.p-included').checked)excluded.push(p.id);
  result.push({...p,name,role:el.querySelector('.p-role').value.trim(),prev:'',next:''});
 }
 checkpoint();state.people=result;state.payRates=rates;activeMonth().excludedStaffIds=excluded;for(const m of Object.values(state.months))delete m.boundaries;
 if(typeof cancelPaint==='function')cancelPaint();changed();closeModal();toast('บันทึกบุคลากรเดือนนี้และเรทแยกประเภทแล้ว');
}
function resetMonthTargets(s){const m=s.months[s.selected];m.quotas={};m.categoryQuotas={}}
function discardPendingQuotaInputs(){document.querySelectorAll('[data-quota-id]').forEach(input=>input.dataset.quotaEdited='false')}
function clearModal(){modal('ล้างข้อมูลเดือนนี้','<p>เริ่มตาราง '+esc(monthLabel(state.selected))+' ใหม่ โดยล้างเวรและเป้ารายคน เพื่อให้ระบบคำนวณสัดส่วนใหม่ได้</p><label class="inline-field"><input type="checkbox" id="keepTargets"> เก็บเป้ารายคนที่กรอกเองไว้</label><p class="help">เก็บวันหยุดพิเศษและวันเปิดเวรตามปฏิทินไว้ · ย้อนกลับได้ด้วยปุ่ม ↶ ย้อนกลับ</p>','<button onclick="closeModal()">ยกเลิก</button><button onclick="clearMonth(false,$(\'keepTargets\').checked)">ล้างเวร เก็บ OFF / VAC</button><button onclick="clearMonth(true,$(\'keepTargets\').checked)">ล้างเวร + OFF / VAC</button>')}
function clearMonth(all,keepTargets=false){checkpoint();let m=activeMonth();for(let[k,c]of Object.entries(m.cells)){c.code='';c.locked=false;if(all)c.block='';if(!c.block)delete m.cells[k]}if(!keepTargets){resetMonthTargets(state);discardPendingQuotaInputs()}changed();closeModal();toast(keepTargets?'ล้างเวรแล้ว · เก็บเป้ารายคนไว้':'ล้างเวรและเป้ารายคนแล้ว · พร้อมจัดอัตโนมัติใหม่')}
function exportsModal(){modal('สร้างเอกสารและสำรองข้อมูล','<button onclick="exportDetailsModal()">ข้อมูลหัวเอกสารส่งออก</button><div class="options"><button class="option" onclick="downloadExcel()"><div><b>Excel ตามแบบต้นฉบับ</b><small>เก็บสี เส้นตาราง ช่องรวม และสูตรค่าเวร</small></div></button><button class="option" onclick="downloadCSV()"><span style="font-size:24px">▤</span><div><b>ตาราง CSV</b><small>เปิดด้วย Excel · เฉพาะเดือนนี้</small></div></button><button class="option" onclick="closeModal();window.print()"><span style="font-size:24px">▧</span><div><b>พิมพ์ / บันทึก PDF</b><small>เก็บสีของตาราง · แนวนอน</small></div></button><button class="option" onclick="downloadBackup()"><span style="font-size:24px">↓</span><div><b>สำรองข้อมูล JSON</b><small>ครบทุกเดือน รายชื่อ และเวรที่ล็อก</small></div></button><button class="option" onclick="$(\'importFile\').click()"><span style="font-size:24px">↑</span><div><b>นำเข้าไฟล์สำรอง JSON</b><small>ใช้ข้อมูลที่สำรองไว้ / ย้ายเครื่อง</small></div></button></div><p class="help">CSV เก็บข้อความ แต่ไม่เก็บสีหรือการล็อก · JSON ใช้กลับมาแก้ไขต่อได้ทั้งหมด</p>')}
function download(content,name,type){let url=URL.createObjectURL(new Blob([content],{type})),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)}
function setCategoryTarget(s,pid,category,val){
 if(!SHIFT_GROUPS.some(g=>g.id===category))throw Error('ประเภทเป้าหมายไม่ถูกต้อง');
 if(!monthPeople(s,s.selected).some(p=>p.id===pid))throw Error('บุคลากรคนนี้ไม่ได้ลงตารางเดือนนี้');
 if(pid==='9'&&category==='card'&&val!==''&&Number(val)!==0)throw Error('นายปรเมศวร์รับได้เฉพาะ รพ.สต. (ร สีแดง) เป้าห้องบัตรต้องเป็น 0');
 const m=s.months[s.selected],ids=[pid],normalized=categoryTargets(s,s.selected);m.categoryQuotas=clone(m.categoryQuotas||{});
 for(const id of ids){const values={...normalized[id]};
  if(val==='')delete values[category];else values[category]=Number(val);
  if(Object.keys(values).length)m.categoryQuotas[id]=values;else delete m.categoryQuotas[id];
 }
 m.quotas={...(m.quotas||s.quotas||{})};for(const id of ids)delete m.quotas[id];
 categoryTargets(s,s.selected);quotaTargets(s,s.selected);
}
function setTotalTarget(s,pid,val){
 val=String(val).trim();const m=s.months[s.selected],n=daysIn(s.selected);
 if(!monthPeople(s,s.selected).some(p=>p.id===pid))throw Error('บุคลากรคนนี้ไม่ได้ลงตารางเดือนนี้');
 if(val!==''&&(!Number.isInteger(Number(val))||Number(val)<0||Number(val)>n))throw Error('ระบุจำนวนเต็ม 0–'+n+' หรือเว้นว่าง');
 m.quotas={...(m.quotas||s.quotas||{})};
 if(val==='')delete m.quotas[pid];else{m.quotas[pid]=Number(val);if(m.categoryQuotas)delete m.categoryQuotas[pid]}
 quotaTargets(s,s.selected);
}
function setQuotaTarget(s,pid,category,val){if(category==='total')setTotalTarget(s,pid,val);else setCategoryTarget(s,pid,category,val)}
function commitPendingQuotaInputs(){
 const inputs=[...document.querySelectorAll('[data-quota-id]')].filter(input=>input.dataset.quotaEdited==='true');if(!inputs.length)return;
 const draft=clone(state);
 for(const input of inputs)setQuotaTarget(draft,input.dataset.quotaId,input.dataset.quotaCategory,input.value.trim());
 for(const input of inputs)input.dataset.quotaEdited='false';
 if(JSON.stringify(draft)!==JSON.stringify(state)){checkpoint();state=draft;changed()}
}
function onQuotaInput(input,pid,category='total'){
 const val=input.value.trim();if(val!==''&&(!Number.isInteger(Number(val))||Number(val)<0||Number(val)>daysIn(state.selected)))return;
 try{
  const draft=clone(state);setQuotaTarget(draft,pid,category,val);
  document.querySelectorAll('[data-quota-id]').forEach(el=>{if(el!==input&&el.dataset.quotaId===pid&&el.dataset.quotaCategory===category)el.value=val===''?categoryCountInfo(draft,state.selected,pid,category).value:input.value});
  updateTargetTotals(draft,input);
 }catch(e){}
}
function onQuotaChange(pid,val,category='total'){
 val=String(val).trim();
 try{const draft=clone(state);setQuotaTarget(draft,pid,category,val);if(JSON.stringify(draft)!==JSON.stringify(state)){checkpoint();state=draft;changed()}else render();toast(category==='total'?'บันทึกเป้ารวมแล้ว · ระบบจะแบ่งห้องบัตรและรุ่งอรุณใหม่':'บันทึกจำนวนเวรของบุคลากรคนนี้แล้ว')}catch(e){toast(e.message);render()}
}
function exportDetailsModal(){const m=activeMonth();modal('ข้อมูลหัวเอกสารส่งออก','<label class="field">เลขที่คำสั่ง<input id="exportOrder" maxlength="60" value="'+esc(m.exportMeta?.orderNumber||'')+'"></label><label class="field">วันที่ออกคำสั่ง<input type="date" id="exportDate" value="'+esc(m.exportMeta?.issuedDate||'')+'"></label><p class="help">เว้นว่างเพื่อกรอกภายหลังได้</p>','<button onclick="closeModal()">ยกเลิก</button><button class="primary" onclick="saveExportDetails()">บันทึก</button>')}
function saveExportDetails(){checkpoint();activeMonth().exportMeta={orderNumber:$('exportOrder').value.trim(),issuedDate:$('exportDate').value};changed();closeModal();toast('บันทึกข้อมูลหัวเอกสารแล้ว')}
function downloadCSV(){download(csvText(state,state.selected),'ShiftPlanner-'+state.selected+'.csv','text/csv;charset=utf-8');toast('ส่งออก CSV ตามลำดับข้อมูลต้นฉบับแล้ว')}
function downloadBackup(){download(JSON.stringify(state,null,2),'ShiftPlanner-backup-'+state.selected+'.json','application/json');toast('สำรองข้อมูลทุกเดือนแล้ว')}
function validateBackup(s){
 if(!s||s.version!==1||!Array.isArray(s.people)||s.people.length<4||s.people.length>40||!s.months||typeof s.months!=='object'||!s.months[s.selected])throw Error('รูปแบบไม่ถูกต้อง');
 let ids=new Set;for(let p of s.people){if(typeof p.id!=='string'||!p.id||ids.has(p.id)||typeof p.name!=='string'||!p.name.trim()||typeof p.role!=='string'||typeof p.active!=='boolean'||!Array.isArray(p.allowed)||p.allowed.some(c=>!CODES.includes(c))||!['',...CODES,'OFF','VAC'].includes(p.prev)||!['',...CODES,'OFF','VAC'].includes(p.next))throw Error('ข้อมูลบุคลากรไม่ถูกต้อง');ids.add(p.id)}
 for(let[month,m]of Object.entries(s.months)){if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)||+month.slice(0,4)<1900||+month.slice(0,4)>2200||!m.cells||!m.days)throw Error('ข้อมูลเดือนไม่ถูกต้อง');for(let d=1;d<=daysIn(month);d++){let day=m.days[d];if(!day||typeof day.holiday!=='boolean'||typeof day.note!=='string'||!day.need)throw Error('ข้อมูลวันที่ไม่ครบ');for(let c of CODES)if(!Number.isInteger(day.need[c])||day.need[c]<0||day.need[c]>s.people.length)throw Error('จำนวนคนไม่ถูกต้อง')}
 if(m.excludedStaffIds!==undefined&&(!Array.isArray(m.excludedStaffIds)||new Set(m.excludedStaffIds).size!==m.excludedStaffIds.length||m.excludedStaffIds.some(id=>!ids.has(id))))throw Error('รายชื่อบุคลากรประจำเดือนไม่ถูกต้อง');
 if(m.autoFillStaffIds!==undefined&&(!Array.isArray(m.autoFillStaffIds)||new Set(m.autoFillStaffIds).size!==m.autoFillStaffIds.length||m.autoFillStaffIds.some(id=>!ids.has(id))))throw Error('รายชื่อบุคลากรที่ให้จัดเติมไม่ถูกต้อง');
 if(m.calendarRules!==undefined&&typeof m.calendarRules!=='boolean')throw Error('กติกาจำนวนเวรจากปฏิทินไม่ถูกต้อง');
 if(m.distributionRules!==undefined&&typeof m.distributionRules!=='boolean')throw Error('เงื่อนไขกระจายเวรไม่ถูกต้อง');
 if(m.autoCapacity){for(let[d,need]of Object.entries(m.autoCapacity)){if(!Number.isInteger(+d)||+d<1||+d>daysIn(month)||!need||CODES.some(c=>!Number.isInteger(need[c])||need[c]<0||need[c]>s.people.length))throw Error('ข้อมูลช่องเวรอัตโนมัติไม่ถูกต้อง')}}
 if(m.boundaries){for(let[id,b]of Object.entries(m.boundaries)){if(!ids.has(id)||!b||!['',...CODES,'OFF','VAC'].includes(b.prev)||!['',...CODES,'OFF','VAC'].includes(b.next))throw Error('ข้อมูลเวรข้ามเดือนไม่ถูกต้อง')}}
 for(let[k,c]of Object.entries(m.cells)){let[id,d]=k.split('|');if(!ids.has(id)||!Number.isInteger(+d)||+d<1||+d>daysIn(month)||!['',...CODES].includes(c.code)||!['','OFF','VAC'].includes(c.block)||typeof c.locked!=='boolean')throw Error('ข้อมูลช่องเวรไม่ถูกต้อง')}
 }
 for(const month of Object.keys(s.months))quotaTargets(s,month);
 if(s.payRates){for(const[id,v]of Object.entries(s.payRates)){
  const valid=rate=>typeof rate==='number'&&Number.isFinite(rate)&&rate>=0&&rate<=10000&&Math.abs(rate*100-Math.round(rate*100))<1e-7;
  if(!ids.has(id)||(typeof v==='number'?!valid(v):!v||Array.isArray(v)||typeof v!=='object'||Object.entries(v).some(([kind,rate])=>!['card','dawn','outreach'].includes(kind)||!valid(rate))))throw Error('ค่าเวรไม่ถูกต้อง');
 }}
 for(const m of Object.values(s.months)){if(m.exportMeta&&(typeof m.exportMeta.orderNumber!=='string'||typeof m.exportMeta.issuedDate!=='string'||(m.exportMeta.issuedDate&&!/^\d{4}-\d{2}-\d{2}$/.test(m.exportMeta.issuedDate))))throw Error('ข้อมูลหัวเอกสารไม่ถูกต้อง')}
 return true;
}
async function importBackup(input){let file=input.files[0];input.value='';if(!file)return;if(file.size>5000000){toast('ไฟล์ใหญ่เกิน 5 MB');return}try{let s=JSON.parse(await file.text());validateBackup(s);editing={importState:s};modal('นำเข้าข้อมูลสำรอง','<p>พบข้อมูล '+s.people.length+' คน · '+Object.keys(s.months).length+' เดือน</p><p class="help">ข้อมูลในเบราว์เซอร์จะถูกแทนที่ด้วยไฟล์นี้ ย้อนกลับได้ด้วยปุ่ม ↶ ย้อนกลับ</p>','<button onclick="closeModal()">ยกเลิก</button><button class="primary" onclick="confirmImport()">นำเข้าข้อมูลนี้</button>')}catch(e){toast('นำเข้าไม่ได้: '+e.message)}}
function confirmImport(){let s=editing.importState;checkpoint();state=s;addNinthStaff(state);restrictNinthStaff(state);normalizePayRates(state);clearManualBoundaries(state);state.pairExclusions=clone(DEFAULT_PAIR_EXCLUSIONS);changed();closeModal();toast('นำเข้าข้อมูลสำรองแล้ว')}
const normalizedCalendar=normalizeCalendarState(state);
render();
if(addedNinthStaff||restrictedNinthStaff||normalizedPayRates||normalizedCalendar)save();
if(removedLegacySample){save();toast('ลบตัวอย่างเดือนตุลาคมแล้ว · ย้อนกลับได้ด้วยปุ่ม ↶ ย้อนกลับ')}
