/* Direct schedule editing: one drag is one validated, undoable transaction. */
const PAINT_TOOLS=[['N','ดึก','1'],['M','เช้า','2'],['A','บ่าย','3'],['R','ห้องบัตร','4'],['X','รพ.สต.','5'],['OFF','หยุด','6'],['VAC','ลา','7'],['','ยางลบ','0']];
let paintTool=null,paintDrag=null,paintFocus={i:0,d:1},paintRange=null,paintFrame=0;
const schedule=$('scheduleTable');
function paintRows(){const included=new Set(monthPeople(state,state.selected).map(p=>p.id));return state.people.map((p,i)=>included.has(p.id)?i:-1).filter(i=>i>=0)}
function toolName(code){return PAINT_TOOLS.find(t=>t[0]===code)?.[1]||'ดู / แก้รายช่อง'}
function setPaintTool(code){cancelPaint();paintTool=code;renderEditor()}
function renderEditor(){
 if(!$('paintTools'))return;
 const rows=paintRows();if(!rows.includes(paintFocus.i))paintFocus.i=rows[0]??0;paintFocus.d=Math.min(paintFocus.d,daysIn(state.selected));
 $('paintTools').innerHTML=PAINT_TOOLS.map(([code,name,shortcut])=>'<button class="paint-tool '+(paintTool===code?'chosen':'')+'" data-tool="'+code+'" aria-pressed="'+(paintTool===code)+'" title="'+name+' · คีย์ '+shortcut+'"><span class="chip '+code+'">'+(META[code]?.label||code||'ลบ')+'</span><span>'+name+'</span><kbd>'+shortcut+'</kbd></button>').join('');
 $('inspectTool').setAttribute('aria-pressed',String(paintTool===null));
 schedule.classList.toggle('paint-enabled',paintTool!==null);
 for(const b of schedule.querySelectorAll('.cell-btn'))b.tabIndex=(+b.dataset.i===paintFocus.i&&+b.dataset.d===paintFocus.d)?0:-1;
 $('paintStatus').textContent=paintTool===null?'เลือกชนิดเวรด้านบน แล้วคลิกหรือลากตามวันที่ของคนที่ต้องการ':toolName(paintTool)+' พร้อมใช้ · ลากในแถวเดียวกัน แล้วปล่อยเพื่อบันทึก';
 markPaintRange();
}
function paintButton(i,d){return schedule.querySelector('[data-i="'+i+'"][data-d="'+d+'"]')}
function focusPaint(i,d){
 const rows=paintRows();if(!rows.length)return;
 const visible=rows.includes(i)?i:i<paintFocus.i?([...rows].reverse().find(row=>row<=i)??rows[0]):(rows.find(row=>row>=i)??rows[rows.length-1]);
 paintFocus={i:visible,d:Math.max(1,Math.min(daysIn(state.selected),d))};
 for(const b of schedule.querySelectorAll('.cell-btn'))b.tabIndex=-1;
 const b=paintButton(paintFocus.i,paintFocus.d);if(b){b.tabIndex=0;b.focus({preventScroll:true});b.scrollIntoView({block:'nearest',inline:'nearest'})}
}
function markPaintRange(){
 const range=paintDrag||paintRange;
 for(const b of schedule.querySelectorAll('.cell-btn')){
  const selected=!!range&&+b.dataset.i===range.i&&+b.dataset.d>=Math.min(range.start,range.end)&&+b.dataset.d<=Math.max(range.start,range.end);
  b.classList.toggle('paint-preview',selected);b.removeAttribute('data-preview');
  if(selected&&paintTool!==null)b.dataset.preview=META[paintTool]?.label||paintTool||'ลบ';
 }
 if(range)$('paintStatus').textContent=state.people[range.i].name+' · วันที่ '+Math.min(range.start,range.end)+'–'+Math.max(range.start,range.end)+' · '+(Math.abs(range.end-range.start)+1)+' ช่อง · '+(paintDrag?'ปล่อยเพื่อบันทึก / Esc ยกเลิก':'Enter ใส่เวร / Esc ยกเลิก');
}
function cancelPaint(){
 const drag=paintDrag;paintDrag=null;paintRange=null;cancelAnimationFrame(paintFrame);
 if(drag&&schedule.hasPointerCapture(drag.pointerId))schedule.releasePointerCapture(drag.pointerId);
 markPaintRange();
}
function commitPaint(i,start,end,code){
 const result=manualRange(state,state.selected,state.people[i].id,start,end,code);
 if(!result.ok){toast(result.message);renderEditor();return false}
 if(!result.changed){renderEditor();return true}
 checkpoint();state.months[state.selected]=result.month;changed();
 toast('บันทึก'+toolName(code)+' '+result.changed+' ช่องแล้ว · Ctrl+Z ย้อนกลับทั้งชุด');return true;
}
function updateDrag(x,y){
 if(!paintDrag)return;
 paintDrag.x=x;paintDrag.y=y;
 const b=document.elementFromPoint(x,y)?.closest('.cell-btn');
 if(b&&schedule.contains(b)&&+b.dataset.i===paintDrag.i){paintDrag.end=+b.dataset.d;markPaintRange()}
}
function scrollDrag(){
 if(!paintDrag)return;
 const wrap=schedule.parentElement,r=wrap.getBoundingClientRect(),first=schedule.querySelector('.person').getBoundingClientRect();
 if(paintDrag.y>=r.top&&paintDrag.y<=r.bottom){
  const step=paintDrag.x>r.right-38?14:paintDrag.x<first.right+28?-14:0;
  if(step){wrap.scrollLeft+=step;updateDrag(Math.max(first.right+2,Math.min(r.right-18,paintDrag.x)),paintDrag.y)}
 }
 paintFrame=requestAnimationFrame(scrollDrag);
}
$('paintTools').addEventListener('click',e=>{const b=e.target.closest('[data-tool]');if(b)setPaintTool(b.dataset.tool)});
$('inspectTool').addEventListener('click',()=>setPaintTool(null));
schedule.addEventListener('pointerdown',e=>{
 const b=e.target.closest('.cell-btn');if(!b||e.button!==0||!e.isPrimary)return;
 paintFocus={i:+b.dataset.i,d:+b.dataset.d};paintRange=null;
 if(paintTool===null)return;
 e.preventDefault();b.focus({preventScroll:true});
 paintDrag={i:paintFocus.i,start:paintFocus.d,end:paintFocus.d,pointerId:e.pointerId,x:e.clientX,y:e.clientY};
 schedule.setPointerCapture(e.pointerId);markPaintRange();paintFrame=requestAnimationFrame(scrollDrag);
});
schedule.addEventListener('pointermove',e=>{if(paintDrag&&e.pointerId===paintDrag.pointerId)updateDrag(e.clientX,e.clientY)});
schedule.addEventListener('pointerup',e=>{
 if(!paintDrag||e.pointerId!==paintDrag.pointerId)return;
 updateDrag(e.clientX,e.clientY);const drag={...paintDrag};cancelPaint();
 commitPaint(drag.i,drag.start,drag.end,paintTool);focusPaint(drag.i,drag.end);
});
schedule.addEventListener('pointercancel',()=>{cancelPaint();renderEditor()});
schedule.addEventListener('lostpointercapture',()=>{if(paintDrag){cancelPaint();renderEditor()}});
window.addEventListener('blur',()=>{cancelPaint();renderEditor()});
schedule.addEventListener('click',e=>{
 const b=e.target.closest('.cell-btn');if(!b)return;
 paintFocus={i:+b.dataset.i,d:+b.dataset.d};
 if(paintTool===null)cellModal(paintFocus.i,paintFocus.d);
 // Keyboard/assistive activation has detail 0; pointer painting is handled above.
 else if(e.detail===0){commitPaint(paintFocus.i,paintFocus.d,paintFocus.d,paintTool);focusPaint(paintFocus.i,paintFocus.d)}
});
schedule.addEventListener('focusin',e=>{const b=e.target.closest('.cell-btn');if(b)paintFocus={i:+b.dataset.i,d:+b.dataset.d}});
document.addEventListener('keydown',e=>{
 if(e.isComposing||e.target.closest('input,textarea,select,[contenteditable="true"]')||$('modal').open||currentView!=='schedule')return;
 if(e.key==='Escape'){e.preventDefault();cancelPaint();renderEditor();return}
 if((e.ctrlKey||e.metaKey)&&(e.code==='KeyZ'||e.key.toLowerCase()==='z')&&!e.shiftKey){e.preventDefault();cancelPaint();undo();return}
 if(e.ctrlKey||e.metaKey||e.altKey||paintDrag)return;
 const number=/^(?:Digit|Numpad)([0-7])$/.exec(e.code)||/^([0-7])$/.exec(e.key);
 if(number){e.preventDefault();const n=+number[1];setPaintTool(n===0?'':PAINT_TOOLS[n-1][0]);return}
 const b=e.target.closest('.cell-btn');if(!b)return;
 const {i,d}=paintFocus;
 if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){
  e.preventDefault();const horizontal=e.key==='ArrowLeft'||e.key==='ArrowRight';
  const nextD=Math.max(1,Math.min(daysIn(state.selected),d+(e.key==='ArrowLeft'?-1:e.key==='ArrowRight'?1:0)));
  if(e.shiftKey&&horizontal)paintRange={i,start:paintRange?.start??d,end:nextD};else paintRange=null;
  focusPaint(i+(e.key==='ArrowUp'?-1:e.key==='ArrowDown'?1:0),nextD);markPaintRange();return;
 }
 if(e.code==='KeyE'||e.key.toLowerCase()==='e'){e.preventDefault();cancelPaint();cellModal(i,d);return}
 if(e.key==='Delete'||e.key==='Backspace'||e.key==='Enter'||e.key===' '){
  e.preventDefault();if(e.repeat)return;
  const erase=e.key==='Delete'||e.key==='Backspace';
  if(!erase&&paintTool===null){cellModal(i,d);return}
  const range=paintRange||{i,start:d,end:d};cancelPaint();commitPaint(range.i,range.start,range.end,erase?'':paintTool);focusPaint(i,d);
 }
});
function shortcutsModal(){modal('จัดเวรให้ไวขึ้น','<div class="shortcut-list"><p><kbd>1–5</kbd> ดึก · เช้า · บ่าย · ห้องบัตร · รพ.สต.</p><p><kbd>6</kbd> OFF หยุด <kbd>7</kbd> VAC ลา <kbd>0</kbd> ยางลบ</p><p><kbd>ลูกศร</kbd> เลื่อนช่อง <kbd>Shift + ← / →</kbd> เลือกหลายวัน</p><p><kbd>Enter / Space</kbd> ใส่เวรที่เลือก <kbd>Delete</kbd> ลบช่องที่เลือก</p><p><kbd>E</kbd> เปิดรายละเอียด / ปลดล็อก <kbd>Esc</kbd> ยกเลิกการเลือก</p><p><kbd>Ctrl + Z</kbd> ย้อนกลับทั้งชุดที่ลาก (Mac ใช้ Cmd + Z)</p></div><p class="help">เลือกชนิดเวรแล้วลากในแถวเดียวกัน ปล่อยเพื่อบันทึก · เปลี่ยนเป็นโหมดดู / แก้รายช่องเมื่อต้องการเลื่อนตารางบนจอสัมผัส</p><p class="help">เวรที่ลงเองจะล็อกไว้ และคงตารางทั้งเดือนของคนนั้นตอนจัดอัตโนมัติ · คีย์ลัดไม่ทำงานระหว่างกรอกข้อมูลหรือเปิดหน้าต่างแก้ไข</p>')}
renderEditor();
