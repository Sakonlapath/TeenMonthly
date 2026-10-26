
const $=id=>document.getElementById(id),esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let state=clone(SEED),history=[],currentView='schedule',editing=null,choice='',toastTimer;
const STORE='card-room-planner-v1';
try{let raw=localStorage.getItem(STORE);if(raw){let v=JSON.parse(raw);validateBackup(v);state=v}}catch(e){setTimeout(()=>toast('เปิดข้อมูลที่บันทึกไม่ได้ ใช้ข้อมูลตั้งต้นแทน'),300)}
const removedLegacySample=isLegacyOctoberSample(state.months['2026-10']);
if(removedLegacySample){checkpoint();state.months['2026-10']=freshMonth('2026-10');state.source=SEED.source}
if(!state.payRates)state.payRates=clone(DEFAULT_PAY_RATES);
state.pairExclusions=clone(DEFAULT_PAIR_EXCLUSIONS);
if(!state.mainStaffIds)state.mainStaffIds=clone(MAIN_STAFF_IDS);
if(!state.quotas)state.quotas={};
function clearManualBoundaries(s){for(const p of s.people){p.prev='';p.next=''}for(const m of Object.values(s.months))delete m.boundaries}
clearManualBoundaries(state);
function monthLabel(m){let[y,mm]=m.split('-').map(Number);return new Date(y,mm-1,1).toLocaleDateString('th-TH',{month:'long',year:'numeric'})}
function activeMonth(){return state.months[state.selected]}
function save(){try{localStorage.setItem(STORE,JSON.stringify(state));$('saveStatus').textContent='บันทึกในเครื่องแล้ว'}catch(e){$('saveStatus').textContent='บันทึกในเครื่องไม่ได้ — กรุณาสำรองไฟล์'}}
function checkpoint(){history.push(clone(state));if(history.length>25)history.shift()}
function changed(){save();render()}
function undo(){if(!history.length)return;state=history.pop();changed();toast('ย้อนการแก้ไขแล้ว')}
function toast(s){$('toast').textContent=s;$('toast').classList.remove('hidden');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.add('hidden'),4500)}
function view(v){currentView=v;$('scheduleView').classList.toggle('hidden',v!=='schedule');$('summaryView').classList.toggle('hidden',v!=='summary');$('navSchedule').classList.toggle('active',v==='schedule');$('navSummary').classList.toggle('active',v==='summary')}
function selectMonth(m){if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(m)||+m.slice(0,4)<1900||+m.slice(0,4)>2200){toast('เลือกปี ค.ศ. 1900–2200');return}if(typeof cancelPaint==='function')cancelPaint();state.selected=m;if(!state.months[m])state.months[m]=freshMonth(m);changed()}
function changeMonth(off){selectMonth(monthOffset(state.selected,off))}
function totalEditor(p,total){
 const q=quotaTargets(state,state.selected)[p.id],target=q===undefined?'':q;
 return '<div class="total-editor"><b>'+total+'</b><span>/</span><input type="number" min="0" max="'+daysIn(state.selected)+'" class="quota-input '+(group(state).includes(p.id)?'group-quota-input':'')+'" data-quota-id="'+esc(p.id)+'" value="'+target+'" placeholder="auto" aria-label="เป้าเวร '+esc(p.name)+'" oninput="onQuotaInput(this,\''+p.id+'\')" onchange="onQuotaChange(\''+p.id+'\',this.value)"></div>'+(target!==''&&total!==target?'<small class="quota-warning">'+(total<target?'ขาด '+(target-total):'เกิน '+(total-target))+'</small>':'');
}
function render(){
 const month=state.selected,m=activeMonth(),n=daysIn(month),report=audit(state,month),tt=report.totals;
 $('monthPicker').value=month;$('monthTitle').textContent=monthLabel(month);$('summaryMonth').textContent='· '+monthLabel(month);
 $('sourceNote').textContent='ตารางประจำเดือน · กรุณาเพิ่มวันหยุดราชการของเดือนนี้';
 $('undoBtn').disabled=!history.length;
 let req=Object.values(m.days).reduce((s,x)=>s+CODES.reduce((a,c)=>a+x.need[c],0),0),assigned=tt.reduce((s,x)=>s+x.total,0);
 const enteredTargets=quotaTargets(state,month),targetTotal=Object.values(enteredTargets).reduce((a,v)=>a+v,0);
 let coverage=report.issues.filter(i=>i.type==='coverage').length;
 $('cards').innerHTML='<div class="card"><div class="label">บุคลากรในตาราง</div><strong>'+state.people.filter(p=>p.active).length+'</strong> <small>คน</small></div><div class="card"><div class="label">รวมเวร (จัดแล้ว / เป้า)</div><strong>'+assigned+'</strong> <small>/ <span id="quotaTotal">'+targetTotal+'</span> เวร</small><div class="total-hint">รวมเป้ารายคนจากคอลัมน์ขวาสุด</div></div><div class="card accent"><div class="label">เวรรวม คนลำดับ 2–4</div><strong>'+report.groupCounts.join(' · ')+'</strong> <small>ครั้ง</small></div><div class="card"><div class="label">รายการที่ต้องตรวจ</div><strong>'+report.issues.length+'</strong> <small>รายการ</small></div>';
 $('status').innerHTML='<div class="status-banner '+(report.complete?'ok':'')+'"><span>'+(report.complete?'✓ ตารางครบทุกเวร และผ่านเงื่อนไขที่กำหนด':('ⓘ ตารางฉบับร่าง · '+coverage+' รายการจำนวนเวรไม่ครบ/เกิน · เป้าหมายไม่ตรง '+report.issues.filter(i=>i.type==='quota').length+' คน · คู่เวรชน '+report.issues.filter(i=>i.type==='exclusion').length+' วัน'+(report.issues.some(i=>i.type==='blocked')?' · พบเวรชน OFF / VAC':'')))+'</span><button class="textbtn" onclick="issuesModal()">ตรวจเงื่อนไข →</button></div>';
 let invalid=new Set(report.issues.filter(i=>i.p&&i.d).map(i=>key(i.p,i.d))),head='<thead><tr><th class="person">บุคลากร <span style="font-size:16px;color:#8da097">/ วันที่</span></th>';
 for(let d=1;d<=n;d++){let h=m.days[d].holiday||[0,6].includes(weekday(month,d));head+='<th class="'+(h?'holiday':'')+'"><button class="day-head" onclick="dayModal('+d+')" title="'+esc(m.days[d].note||'กำหนดจำนวนเวร')+'"><b>'+d+'</b><small>'+['อา.','จ.','อ.','พ.','พฤ.','ศ.','ส.'][weekday(month,d)]+'</small></button></th>'}
 head+='<th class="total-head">รวม<small class="total-hint">จัดแล้ว / เป้า</small></th></tr></thead><tbody>';
 state.people.forEach((p,i)=>{head+='<tr><th class="person"><div class="name"><span class="number">'+String(i+1).padStart(2,'0')+'</span>'+esc(p.name)+(i>=1&&i<=3?'<span class="equal">เท่ากัน</span>':'')+'</div><div class="role">'+esc(p.role)+(p.active?'':' · งดจัดเวร')+(manualPeople(m).has(p.id)?' · จัดเองทั้งเดือน':'')+'</div></th>';
 for(let d=1;d<=n;d++){let c=cell(m,p.id,d),holiday=m.days[d].holiday||[0,6].includes(weekday(month,d)),label=c.code?META[c.code].label:c.block||'·',cl=c.code||c.block||'empty';head+='<td class="'+(holiday?'holiday ':'')+(invalid.has(key(p.id,d))?'bad':'')+'"><button class="cell-btn '+(!c.code&&c.block?c.block:'')+'" data-i="'+i+'" data-d="'+d+'" tabindex="-1" aria-label="'+esc(p.name+' วันที่ '+d+' '+(c.code?META[c.code].name:c.block||'ว่าง'))+'">'+(c.locked&&c.code?'<span class="lock" title="ล็อกเวร">◆</span>':'')+'<span class="chip '+cl+'">'+label+'</span>'+(c.code&&c.block?'<small style="font-size:8px;color:#ab5680">'+c.block+'</small>':'')+'</button></td>'}
 head+='<td class="sum">'+totalEditor(p,tt[i].total)+'</td></tr>'});
 head+='</tbody><tfoot><tr class="coverage"><th class="person">จำนวนคน / ต้องการ</th>';
 for(let d=1;d<=n;d++){let need=CODES.reduce((s,c)=>s+m.days[d].need[c],0),got=state.people.filter(p=>cell(m,p.id,d).code).length,good=!report.issues.some(i=>i.type==='coverage'&&i.d===d);head+='<td class="'+(good?'':'gap')+'" title="คลิกหัววันที่เพื่อปรับจำนวน">'+got+'/'+need+'</td>'}
 head+='<td></td></tr></tfoot>';$('scheduleTable').innerHTML=head;
 let max=Math.max(...tt.map(t=>t.total),1);
 let quotas=quotaTargets(state,month), payRates=state.payRates||DEFAULT_PAY_RATES;
 let grandTotalPay=0, sumTotal=0, sumHours=0, sumNeed=CODES.map(c=>tt.reduce((a,x)=>a+x[c],0)), sumOff=tt.reduce((a,x)=>a+x.OFF,0), sumVac=tt.reduce((a,x)=>a+x.VAC,0);
 let rowsHtml=state.people.map((p,i)=>{
  let rate=payRates[p.id]??DEFAULT_PAY_RATES[p.id]??0;
  let pay=tt[i].total*rate;
  grandTotalPay+=pay;sumTotal+=tt[i].total;sumHours+=tt[i].hours;
  let qVal=quotas[p.id]!==undefined?quotas[p.id]:'';
  let isGroup=(i>=1&&i<=3), isMain=(i<=3);
  return '<tr>'+
   '<td style="text-align:left;padding-left:18px"><b>'+(i+1)+'.</b> '+esc(p.name)+(isGroup?' <span class="equal" title="คนลำดับ 2–4 เวรเท่ากัน">2–4</span>':'')+(isMain?' <span style="font-size:16px;background:#e0f2fe;color:#0369a1;padding:1px 5px;border-radius:4px;margin-left:4px">ตัวหลัก</span>':'')+'</td>'+
   CODES.map(c=>'<td>'+tt[i][c]+'</td>').join('')+
   '<td>'+tt[i].OFF+'</td><td>'+tt[i].VAC+'</td>'+
   '<td>'+totalEditor(p,tt[i].total)+'</td>'+
   '<td class="pay-rate-cell" onclick="staffModal()" style="cursor:pointer" title="คลิกเพื่อปรับเรท">'+rate.toLocaleString('th-TH')+' ฿</td>'+
   '<td class="pay-col">'+pay.toLocaleString('th-TH')+' ฿</td>'+
   '<td>'+tt[i].hours+' ชม.</td>'+
   '<td><div class="bars"><i style="width:'+tt[i].total/max*100+'%"></i></div></td>'+
  '</tr>';
 }).join('');
 let footHtml='<tfoot><tr>'+
  '<td style="text-align:left;padding-left:18px"><b>รวมทั้งสิ้น</b></td>'+
  CODES.map((c,ci)=>'<td><b>'+sumNeed[ci]+'</b></td>').join('')+
  '<td>'+sumOff+'</td><td>'+sumVac+'</td>'+
  '<td><b style="color:var(--green)">'+sumTotal+'</b></td>'+
  '<td>—</td>'+
  '<td class="pay-col" style="font-size:16px"><b>'+grandTotalPay.toLocaleString('th-TH')+' ฿</b></td>'+
  '<td><b>'+sumHours+' ชม.</b></td><td></td>'+
 '</tr></tfoot>';
 $('summaryTable').innerHTML='<thead><tr><th style="text-align:left;padding-left:18px">บุคลากร</th>'+CODES.map(c=>'<th><span class="chip '+c+'">'+META[c].label+'</span></th>').join('')+'<th>OFF</th><th>VAC</th><th>รวม <small>จัดแล้ว / เป้า</small></th><th>เรท/เวร</th><th>รวมเงิน</th><th>ชั่วโมง</th><th>สัดส่วน</th></tr></thead><tbody>'+rowsHtml+'</tbody>'+footHtml;
 let rMainCount=tt.slice(0,4).reduce((s,x)=>s+x.R,0), rOtherCount=tt.slice(4).reduce((s,x)=>s+x.R,0);
 let rMainAvg=(rMainCount/4).toFixed(1), rOtherAvg=(rOtherCount/Math.max(1,state.people.length-4)).toFixed(1);
 let pairIssues=report.issues.filter(i=>i.type==='exclusion');
 let pairStatusText=pairIssues.length===0?'<span style="color:#16a34a">✓ พฤกษา (ลำดับ 1) และ รพีพรรณ (ลำดับ 8) ไม่ขึ้นเวรวันเดียวกัน</span>':('<span style="color:#dc2626">⚠ พบ '+pairIssues.length+' วันที่ขึ้นเวรวันเดียวกัน</span>');
 $('fairnessDetail').innerHTML='<div style="line-height:1.8"><div><b>1. ความเท่ากันของคนลำดับ 2–4:</b> '+state.people.slice(1,4).map((p,i)=>esc(p.name)+' '+report.groupCounts[i]+' เวร').join(' · ')+(new Set(report.groupCounts).size===1?' <span style="color:#16a34a">✓ เท่ากันแล้ว</span>':' <span style="color:#dc2626">⚠ ยังไม่เท่ากัน</span>')+'</div><div><b>2. เวรรุ่งอรุณ (ร · ตัวหลักห้องบัตร):</b> ตัวหลัก (ลำดับ 1–4) รวม '+rMainCount+' เวร (เฉลี่ย '+rMainAvg+' เวร/คน) · คนอื่น รวม '+rOtherCount+' เวร (เฉลี่ย '+rOtherAvg+' เวร/คน) '+'<span class="help"> · แจกเศษหลังแบ่งเท่า ๆ กัน ปรับได้เมื่อชนเงื่อนไข</span>'+'</div><div><b>3. เงื่อนไขคู่เวร:</b> '+pairStatusText+'</div><div><b>4. ประมาณการค่าตอบแทนเดือนนี้:</b> รวมทั้งสิ้น <b style="color:#15803d;font-size:16px">'+grandTotalPay.toLocaleString('th-TH')+' บาท</b> <button class="textbtn" onclick="staffModal()" style="margin-left:8px">แก้ไขเรทที่บุคลากร →</button></div></div>';
 view(currentView);if(typeof renderEditor==='function')renderEditor()
}
function modal(title,body,foot){if(typeof stopHelpReply==='function')stopHelpReply();$('modal').classList.remove('help-chat-modal');$('modalTitle').textContent=title;$('modalBody').innerHTML=body;$('modalFoot').innerHTML=foot||'<button onclick="closeModal()">ปิด</button>';if(!$('modal').open)$('modal').showModal()}
function closeModal(){if(typeof stopHelpReply==='function')stopHelpReply();$('modal').close();editing=null}
$('modal').addEventListener('click',e=>{if(e.target===$('modal')){let r=$('modal').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeModal()}});
function cellModal(i,d){
 editing={i,d};let p=state.people[i],c=cell(activeMonth(),p.id,d);choice=c.block||c.code||'';
 modal(p.name+' · วันที่ '+d,'<div class="help" style="margin-top:0">เลือกเวรได้วันละ 1 ประเภท · เมื่อมีเวรที่เลือกเองและล็อกไว้ ระบบจะคงตารางทั้งเดือนของคนนี้ และจัดเฉพาะคนที่เหลือ</div><div class="options">'+['',...CODES,'OFF','VAC'].map(code=>{let t=code===''?{label:'−',name:'ว่าง / ลบเวร',time:'พร้อมให้ระบบจัดเวร'}:META[code]||{label:code,name:code==='OFF'?'วันหยุดส่วนตัว':'วันลา',time:'ไม่รับเวรทุกประเภท'};return'<button class="option '+(choice===code?'selected':'')+'" data-choice="'+code+'" onclick="chooseCell(this)"><span class="chip '+code+'">'+t.label+'</span><div><b>'+t.name+'</b><small>'+t.time+'</small></div></button>'}).join('')+'</div><p class="help">OFF และ VAC จะถูกกันออกจากการจัดเวรอัตโนมัติ</p><label class="inline-field"><input id="lockCell" type="checkbox" '+(c.locked||c.code?'checked':'')+'> ล็อกเวรนี้ และคงตารางทั้งเดือนของคนนี้ไว้</label>', '<button onclick="closeModal()">ยกเลิก</button><button class="primary" onclick="saveCell()">บันทึกช่องนี้</button>')
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
 modal('วันที่ '+d+' '+monthLabel(state.selected),'<label class="inline-field"><input type="checkbox" id="dayHoliday" '+(item.holiday?'checked':'')+' '+(weekend?'disabled':'')+' onchange="holidayPreset('+d+')"> '+(weekend?'เสาร์ / อาทิตย์ (ใช้เวรวันหยุด)':'วันหยุดราชการ / วันหยุดพิเศษ')+'</label><label class="field">ชื่อวันหยุด / หมายเหตุ<input id="dayNote" value="'+esc(item.note)+'" placeholder="เช่น วันหยุดชดเชย"></label><div class="help">จำนวนคนที่ต้องการในวันที่นี้</div>'+CODES.map(c=>'<label class="inline-field"><span class="chip '+c+'">'+META[c].label+'</span><span style="flex:1">'+META[c].name+'<small style="display:block;color:#8b9c90">'+META[c].time+'</small></span><input id="need'+c+'" type="number" min="0" max="'+state.people.length+'" value="'+item.need[c]+'"> คน</label>').join('')+'<p class="help">ร สีฟ้าเริ่มต้นมีทุก จ.–ศ. รวมวันที่เป็นวันหยุดราชการ ปรับจำนวนได้ตามการปฏิบัติงานจริง · ร สีแดงใส่จำนวนในวันที่ออก รพ.สต.</p>','<button onclick="closeModal()">ยกเลิก</button><button class="primary" onclick="saveDay()">บันทึกวันที่นี้</button>')
}
function holidayPreset(d){let holiday=$('dayHoliday').checked||[0,6].includes(weekday(state.selected,d));$('needN').value=1;$('needM').value=holiday?2:0;$('needA').value=1}
function saveDay(){let d=editing.d,need={};for(let c of CODES){let v=Number($('need'+c).value);if(!Number.isInteger(v)||v<0||v>state.people.length){toast('จำนวนคนต้องเป็นจำนวนเต็ม 0–'+state.people.length);return}need[c]=v}checkpoint();if(activeMonth().autoCapacity)activeMonth().autoCapacity[d]=clone(need);activeMonth().days[d]={holiday:$('dayHoliday').checked,note:$('dayNote').value.trim(),need};changed();closeModal();toast('บันทึกจำนวนเวรแล้ว')}
async function autoSchedule(){
 let btn=$('autoBtn');btn.disabled=true;btn.innerHTML='<span class="spinner"></span>กำลังจัดเวร…';
 await new Promise(r=>setTimeout(r,60));
 try{let result=solve(state,state.selected);if(result.ok){checkpoint();state.months[state.selected]=result.month;changed();toast('จัดครบทุกเวรแล้ว · คนลำดับ 2–4 คนละ '+result.quota+' เวร')}else modal('ยังจัดให้ครบทุกเงื่อนไขไม่ได้','<div class="issue">'+esc(result.message)+'</div><p class="help">ข้อมูลเดิมยังอยู่ครบ ระบบจะไม่ฝืนลงเวรในวัน OFF / VAC หรือทำบ่ายต่อดึก</p>')}
 catch(e){modal('เกิดข้อผิดพลาด','<p>จัดเวรไม่สำเร็จ ข้อมูลเดิมยังอยู่ กรุณาตรวจการตั้งค่าและลองใหม่</p>')}
 finally{btn.disabled=false;btn.innerHTML='✧ จัดเวรอัตโนมัติ'}
}
function issuesModal(){
 let a=audit(state,state.selected),capacity=solveCapacity();
 modal(a.complete?'ผ่านทุกเงื่อนไข':'ตรวจเงื่อนไขตาราง',a.complete?'<div class="issue" style="background:#eff8ef;border-color:#d7eadc">✓ จำนวนคนครบทุกประเภท<br>✓ เวรคนลำดับ 2–4 เท่ากัน<br>✓ ไม่ชน OFF / VAC<br>✓ ไม่มีบ่ายต่อดึก</div>':(capacity?'<div class="issue" style="margin-bottom:12px"><b>กำลังคนไม่พอ:</b> '+esc(capacity)+'</div>':'')+'<div class="issues-list">'+a.issues.map((x,i)=>'<button class="issue" onclick="focusIssue('+i+')">'+esc(x.text)+(x.p?' →':'')+'</button>').join('')+'</div>')
}
function solveCapacity(){let m=activeMonth();for(let d=1;d<=daysIn(state.selected);d++){let need=CODES.reduce((s,c)=>s+m.days[d].need[c],0),available=state.people.filter(p=>p.active&&!cell(m,p.id,d).block).length;if(need>available)return'วันที่ '+d+' ต้องการ '+need+' คน แต่มีคนไม่ติด OFF / VAC '+available+' คน'}return''}
function focusIssue(i){let x=audit(state,state.selected).issues[i];if(x.p&&x.d){cellModal(state.people.findIndex(p=>p.id===x.p),x.d)}else if(x.d){dayModal(x.d)}else{view('summary');closeModal()}}
function staffModal(){
 modal('บุคลากรและเรทเงิน','<p class="help" style="margin-top:0">คนลำดับ 2–4 ยึดตามลำดับในหน้านี้ · เรทเงินใช้เท่ากันทุกประเภทเวร ไม่รวม OFF / VAC</p><div id="staffForm">'+state.people.map((p,i)=>'<div class="staff-item" data-id="'+esc(p.id)+'"><b>'+(i+1)+'. '+(i>=1&&i<=3?'กลุ่มจำนวนเวรเท่ากัน':'บุคลากร')+'</b><div class="staff-grid"><label class="field">ชื่อ–สกุล<input class="p-name" maxlength="100" value="'+esc(p.name)+'"></label><label class="field">ตำแหน่ง<input class="p-role" maxlength="100" value="'+esc(p.role)+'"></label></div><div class="staff-grid"><label class="field">เรทเงิน (บาท / เวร)<input type="number" class="p-rate" min="0" max="10000" step="0.01" value="'+payRate(state,p.id)+'"></label></div></div>').join('')+'</div><p class="help">ตั้งจำนวนเวรที่ต้องการได้ที่ช่อง “รวม” ในตาราง จากนั้นกดจัดเวรอัตโนมัติ</p>','<button onclick="closeModal()">ยกเลิก</button><button class="primary" onclick="saveStaff()">บันทึกบุคลากร</button>')
}
function saveStaff(){
 const result=[],rates={};
 for(const el of document.querySelectorAll('.staff-item')){
  const p=state.people.find(p=>p.id===el.dataset.id),name=el.querySelector('.p-name').value.trim(),input=el.querySelector('.p-rate'),value=input.value.trim(),rate=Number(value);
  if(!name){toast('กรอกชื่อให้ครบทุกคน');return}
  if(value===''||!Number.isFinite(rate)||rate<0||rate>10000){toast('เรทเงินต้องเป็นตัวเลข 0–10,000 บาท');input.focus();return}
  rates[p.id]=rate;result.push({...p,name,role:el.querySelector('.p-role').value.trim(),prev:'',next:''});
 }
 checkpoint();state.people=result;state.payRates=rates;for(const m of Object.values(state.months))delete m.boundaries;changed();closeModal();toast('บันทึกบุคลากรและเรทเงินแล้ว');
}
function clearModal(){modal('ล้างข้อมูลเดือนนี้','<p>เลือกข้อมูลที่ต้องการล้างใน '+esc(monthLabel(state.selected))+'</p><p class="help">ย้อนกลับได้ด้วยปุ่ม ↶ ย้อนกลับ</p>','<button onclick="closeModal()">ยกเลิก</button><button onclick="clearMonth(false)">ล้างเฉพาะเวร เก็บ OFF / VAC</button><button onclick="clearMonth(true)">ล้างเวร + OFF / VAC</button>')}
function clearMonth(all){checkpoint();let m=activeMonth();for(let[k,c]of Object.entries(m.cells)){c.code='';c.locked=false;if(all)c.block='';if(!c.block)delete m.cells[k]}changed();closeModal();toast('ล้างข้อมูลที่เลือกแล้ว')}
function exportsModal(){modal('ส่งออกและสำรองข้อมูล','<button onclick="exportDetailsModal()">ข้อมูลหัวเอกสารส่งออก</button><div class="options"><button class="option" onclick="downloadExcel()"><div><b>Excel ตามแบบต้นฉบับ</b><small>เก็บสี เส้นตาราง ช่องรวม และสูตรค่าเวร</small></div></button><button class="option" onclick="downloadCSV()"><span style="font-size:24px">▤</span><div><b>ตาราง CSV</b><small>เปิดด้วย Excel · เฉพาะเดือนนี้</small></div></button><button class="option" onclick="closeModal();window.print()"><span style="font-size:24px">▧</span><div><b>พิมพ์ / บันทึก PDF</b><small>เก็บสีของตาราง · แนวนอน</small></div></button><button class="option" onclick="downloadBackup()"><span style="font-size:24px">↓</span><div><b>สำรองข้อมูล JSON</b><small>ครบทุกเดือน รายชื่อ และเวรที่ล็อก</small></div></button><button class="option" onclick="$(\'importFile\').click()"><span style="font-size:24px">↑</span><div><b>นำเข้าไฟล์สำรอง JSON</b><small>ใช้ข้อมูลที่สำรองไว้ / ย้ายเครื่อง</small></div></button></div><p class="help">CSV เก็บข้อความ แต่ไม่เก็บสีหรือการล็อก · JSON ใช้กลับมาแก้ไขต่อได้ทั้งหมด</p>')}
function download(content,name,type){let url=URL.createObjectURL(new Blob([content],{type})),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)}
function onQuotaInput(input,pid){const ids=group(state).includes(pid)?group(state):[pid];document.querySelectorAll('[data-quota-id]').forEach(el=>{if(el!==input&&ids.includes(el.dataset.quotaId))el.value=input.value});const targets={...quotaTargets(state,state.selected)},v=input.value.trim();if(v===''||(Number.isInteger(Number(v))&&Number(v)>=0&&Number(v)<=daysIn(state.selected))){ids.forEach(id=>{if(v==='')delete targets[id];else targets[id]=Number(v)});$('quotaTotal').textContent=Object.values(targets).reduce((a,b)=>a+b,0)}}
function onQuotaChange(pid,val){
 val=String(val).trim();const n=daysIn(state.selected);
 if(val!==''&&(!Number.isInteger(Number(val))||Number(val)<0||Number(val)>n)){toast('ระบุจำนวนเต็ม 0–'+n+' หรือเว้นว่าง');render();return}
 const next={...quotaTargets(state,state.selected)},ids=group(state).includes(pid)?group(state):[pid];
 ids.forEach(id=>{if(val==='')delete next[id];else next[id]=Number(val)});
 checkpoint();activeMonth().quotas=next;changed();toast('บันทึกเป้าหมายแล้ว · จำนวนเวรที่ยังไม่ครบจะแสดงเตือน');
}
function exportDetailsModal(){const m=activeMonth();modal('ข้อมูลหัวเอกสารส่งออก','<label class="field">เลขที่คำสั่ง<input id="exportOrder" maxlength="60" value="'+esc(m.exportMeta?.orderNumber||'')+'"></label><label class="field">วันที่ออกคำสั่ง<input type="date" id="exportDate" value="'+esc(m.exportMeta?.issuedDate||'')+'"></label><p class="help">เว้นว่างเพื่อกรอกภายหลังได้</p>','<button onclick="closeModal()">ยกเลิก</button><button class="primary" onclick="saveExportDetails()">บันทึก</button>')}
function saveExportDetails(){checkpoint();activeMonth().exportMeta={orderNumber:$('exportOrder').value.trim(),issuedDate:$('exportDate').value};changed();closeModal();toast('บันทึกข้อมูลหัวเอกสารแล้ว')}
function downloadCSV(){download(csvText(state,state.selected),'ShiftPlanner-'+state.selected+'.csv','text/csv;charset=utf-8');toast('ส่งออก CSV ตามลำดับข้อมูลต้นฉบับแล้ว')}
function downloadBackup(){download(JSON.stringify(state,null,2),'ShiftPlanner-backup-'+state.selected+'.json','application/json');toast('สำรองข้อมูลทุกเดือนแล้ว')}
function validateBackup(s){
 if(!s||s.version!==1||!Array.isArray(s.people)||s.people.length<4||s.people.length>40||!s.months||typeof s.months!=='object'||!s.months[s.selected])throw Error('รูปแบบไม่ถูกต้อง');
 let ids=new Set;for(let p of s.people){if(typeof p.id!=='string'||!p.id||ids.has(p.id)||typeof p.name!=='string'||!p.name.trim()||typeof p.role!=='string'||typeof p.active!=='boolean'||!Array.isArray(p.allowed)||p.allowed.some(c=>!CODES.includes(c))||!['',...CODES,'OFF','VAC'].includes(p.prev)||!['',...CODES,'OFF','VAC'].includes(p.next))throw Error('ข้อมูลบุคลากรไม่ถูกต้อง');ids.add(p.id)}
 for(let[month,m]of Object.entries(s.months)){if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)||+month.slice(0,4)<1900||+month.slice(0,4)>2200||!m.cells||!m.days)throw Error('ข้อมูลเดือนไม่ถูกต้อง');for(let d=1;d<=daysIn(month);d++){let day=m.days[d];if(!day||typeof day.holiday!=='boolean'||typeof day.note!=='string'||!day.need)throw Error('ข้อมูลวันที่ไม่ครบ');for(let c of CODES)if(!Number.isInteger(day.need[c])||day.need[c]<0||day.need[c]>s.people.length)throw Error('จำนวนคนไม่ถูกต้อง')}
 if(m.autoCapacity){for(let[d,need]of Object.entries(m.autoCapacity)){if(!Number.isInteger(+d)||+d<1||+d>daysIn(month)||!need||CODES.some(c=>!Number.isInteger(need[c])||need[c]<0||need[c]>s.people.length))throw Error('ข้อมูลช่องเวรอัตโนมัติไม่ถูกต้อง')}}
 if(m.boundaries){for(let[id,b]of Object.entries(m.boundaries)){if(!ids.has(id)||!b||!['',...CODES,'OFF','VAC'].includes(b.prev)||!['',...CODES,'OFF','VAC'].includes(b.next))throw Error('ข้อมูลเวรข้ามเดือนไม่ถูกต้อง')}}
 for(let[k,c]of Object.entries(m.cells)){let[id,d]=k.split('|');if(!ids.has(id)||!Number.isInteger(+d)||+d<1||+d>daysIn(month)||!['',...CODES].includes(c.code)||!['','OFF','VAC'].includes(c.block)||typeof c.locked!=='boolean')throw Error('ข้อมูลช่องเวรไม่ถูกต้อง')}
 }
 for(const month of Object.keys(s.months))quotaTargets(s,month);
 if(s.payRates){for(const[id,v]of Object.entries(s.payRates)){if(!ids.has(id)||typeof v!=='number'||!Number.isFinite(v)||v<0||v>10000)throw Error('ค่าเวรไม่ถูกต้อง')}}
 for(const m of Object.values(s.months)){if(m.exportMeta&&(typeof m.exportMeta.orderNumber!=='string'||typeof m.exportMeta.issuedDate!=='string'||(m.exportMeta.issuedDate&&!/^\d{4}-\d{2}-\d{2}$/.test(m.exportMeta.issuedDate))))throw Error('ข้อมูลหัวเอกสารไม่ถูกต้อง')}
 return true;
}
async function importBackup(input){let file=input.files[0];input.value='';if(!file)return;if(file.size>5000000){toast('ไฟล์ใหญ่เกิน 5 MB');return}try{let s=JSON.parse(await file.text());validateBackup(s);editing={importState:s};modal('นำเข้าข้อมูลสำรอง','<p>พบข้อมูล '+s.people.length+' คน · '+Object.keys(s.months).length+' เดือน</p><p class="help">ข้อมูลในเบราว์เซอร์จะถูกแทนที่ด้วยไฟล์นี้ ย้อนกลับได้ด้วยปุ่ม ↶ ย้อนกลับ</p>','<button onclick="closeModal()">ยกเลิก</button><button class="primary" onclick="confirmImport()">นำเข้าข้อมูลนี้</button>')}catch(e){toast('นำเข้าไม่ได้: '+e.message)}}
function confirmImport(){let s=editing.importState;checkpoint();state=s;clearManualBoundaries(state);state.pairExclusions=clone(DEFAULT_PAIR_EXCLUSIONS);changed();closeModal();toast('นำเข้าข้อมูลสำรองแล้ว')}
render();
if(removedLegacySample){save();toast('ลบตัวอย่างเดือนตุลาคมแล้ว · ย้อนกลับได้ด้วยปุ่ม ↶ ย้อนกลับ')}
