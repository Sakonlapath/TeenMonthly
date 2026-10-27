/* Local action chat: open shift dates or record a person's OFF/VAC days. */
const CHAT_MONTH_NAMES=['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
const CHAT_MONTH_SHORT=['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
const CHAT_MONTH_CASUAL=['มกรา','กุมภา','มีนา','เมษา','พฤษภา','มิถุนา','กรกฎา','สิงหา','กันยา','ตุลา','พฤศจิกา','ธันวา'];
const CHAT_ACTIONS=[
 {id:'outreach',label:'เลือกวันออก รพ.สต.',topic:'วันออก รพ.สต.',code:'X',kind:'need'},
 {id:'dawn',label:'วันห้องบัตร (ร)',topic:'วันห้องบัตร (ร)',code:'R',kind:'need'},
 {id:'off',label:'OFF',topic:'OFF',code:'OFF',kind:'leave'},
 {id:'vac',label:'Vac',topic:'Vac',code:'VAC',kind:'leave'}
];
let helpMessages=[],outreachChat={step:'idle',action:'outreach',month:'',pid:'',daysText:''};
function currentChatAction(){return CHAT_ACTIONS.find(a=>a.id===outreachChat.action)||CHAT_ACTIONS[0]}
function chatPeopleForMonth(s,month){return s.months[month]?monthPeople(s,month):s.people}

function validChatMonth(month){return /^\d{4}-(0[1-9]|1[0-2])$/.test(month)&&+month.slice(0,4)>=1900&&+month.slice(0,4)<=2200}
function parseOutreachDays(value,month){
 if(!validChatMonth(month))throw Error('กรุณาเลือกเดือนและปีให้ถูกต้องค่ะ');
 let text=String(value??'').trim();
 if(!text||text.length>300)throw Error('พิมพ์วันที่ เช่น 3, 5-6 ได้เลยค่ะ');
 text=text.replace(/[๐-๙]/g,c=>String(c.charCodeAt(0)-'๐'.charCodeAt(0))).replace(/[‐‑‒–—−]/g,'-');
 const aliases=CHAT_MONTH_NAMES.flatMap((name,i)=>[name,CHAT_MONTH_SHORT[i],CHAT_MONTH_CASUAL[i]].map(text=>({text,month:i+1}))).sort((a,b)=>b.text.length-a.text.length);
 const mentioned=[];
 for(const alias of aliases){if(text.includes(alias.text)){mentioned.push(alias.month);text=text.split(alias.text).join(' ')}}
 if(mentioned.some(m=>m!==+month.slice(5)))throw Error('ชื่อเดือนในข้อความไม่ตรงกับเดือนที่เลือกค่ะ กรุณาเปลี่ยนเดือนหรือแก้ข้อความก่อน');
 if(mentioned.length){
  const year=/\s+(?:(?:พ\.?\s*ศ\.?|ค\.?\s*ศ\.?)\s*)?(\d{4})\s*$/.exec(text);
  if(year){const actual=+year[1]>=2400?+year[1]-543:+year[1];if(actual!==+month.slice(0,4))throw Error('ปีในข้อความไม่ตรงกับปีที่เลือกค่ะ');text=text.slice(0,year.index)}
 }
 text=text.replace(/รพ\.?\s*สต\.?/g,' ').replace(/วันที่|เดือน|ออก|วัน/g,' ');
 text=text.replace(/และ/g,',').replace(/ถึง/g,'-').trim();
 if(/[^\d,;\s-]/.test(text))throw Error('กรุณาพิมพ์เป็นวันที่หรือช่วงวันที่ เช่น 3, 5-6 ค่ะ');
 const parts=text.replace(/\s*-\s*/g,'-').split(/[,;\s]+/).filter(Boolean),days=new Set(),max=daysIn(month);
 if(!parts.length)throw Error('ยังไม่มีวันที่ค่ะ ลองพิมพ์ 3, 5-6 ได้เลย');
 for(const part of parts){
  const match=/^(\d{1,2})(?:-(\d{1,2}))?$/.exec(part);
  if(!match)throw Error('รูปแบบวันที่ไม่ถูกต้องค่ะ ใช้ เช่น 3, 5-6');
  const start=+match[1],end=+(match[2]??match[1]);
  if(start<1||end<1||start>max||end>max)throw Error('เดือนนี้มี '+max+' วันค่ะ กรุณาระบุวันที่ 1–'+max);
  if(start>end)throw Error('กรุณาเรียงช่วงวันที่จากน้อยไปมาก เช่น 5-6 ค่ะ');
  for(let d=start;d<=end;d++)days.add(d);
 }
 return [...days].sort((a,b)=>a-b);
}
function shiftMonthWithDays(s,month,days,code){
 if(!validChatMonth(month)||!Array.isArray(days)||!days.length||days.some(d=>!Number.isInteger(d)||d<1||d>daysIn(month)))throw Error('เดือนหรือวันที่ไม่ถูกต้องค่ะ');
 if(!['R','X'].includes(code))throw Error('ประเภทเวรไม่ถูกต้องค่ะ');
 const m=clone(s.months[month]||freshMonth(month));
 for(const d of days){
  const count=Math.max(1,m.days[d].need[code],m.autoCapacity?.[d]?.[code]??0);
  m.days[d].need[code]=count;
  if(m.autoCapacity)m.autoCapacity[d]={...(m.autoCapacity[d]||m.days[d].need),[code]:count};
 }
 return m;
}
function outreachMonthWithDays(s,month,days){return shiftMonthWithDays(s,month,days,'X')}
function leaveMonthWithDays(s,month,pid,days,code){
 if(!validChatMonth(month)||!Array.isArray(days)||!days.length||days.some(d=>!Number.isInteger(d)||d<1||d>daysIn(month)))throw Error('เดือนหรือวันที่ไม่ถูกต้องค่ะ');
 if(!['OFF','VAC'].includes(code))throw Error('ประเภทวันหยุดไม่ถูกต้องค่ะ');
 let m=clone(s.months[month]||freshMonth(month));
 for(const d of days){const draft={...s,months:{...s.months,[month]:m}},result=manualRange(draft,month,pid,d,d,code);if(!result.ok)throw Error(result.message);m=result.month}
 return m;
}
function outreachChatOpen(){return $('modal').open&&$('modal').classList.contains('help-chat-modal')}
function helpModal(){
 modal('แชทจัดเวร','<div class="help-chat-intro"><img class="help-chat-avatar" src="img/kitty.webp" alt=""><div><b>ผู้ช่วยจัดเวร</b><small>เลือกเดือน แล้วพิมพ์วันที่ได้เลยค่ะ</small></div><span class="help-chat-badge">พร้อมช่วย</span></div><div id="helpMessages" class="help-messages" role="log" aria-label="บทสนทนาจัดเวร" aria-live="polite" aria-relevant="additions text"></div><div id="helpControls" class="help-controls"></div>','<button class="textbtn" onclick="resetHelpChat()">เริ่มคุยใหม่</button><button class="primary" onclick="closeModal()">กลับไปจัดเวร</button>');
 $('modal').classList.add('help-chat-modal');
 if(!helpMessages.length)helpMessages.push({side:'guide',text:'สวัสดีค่ะ วันนี้มีอะไรให้ช่วยคะ'});
 renderHelpChat();
}
function helpMessageMarkup(message){
 return '<div class="help-message '+(message.side==='user'?'from-user':'from-guide')+'"><span class="help-sender">'+(message.side==='user'?'คุณ':'ผู้ช่วยจัดเวร')+'</span><div class="help-bubble">'+esc(message.text).replace(/\n/g,'<br>')+'</div></div>';
}
function renderHelpChat(){
 const log=$('helpMessages'),controls=$('helpControls'),action=currentChatAction();
 log.innerHTML=helpMessages.map(helpMessageMarkup).join('');
 if(outreachChat.step==='month'){
  const person=state.people.find(p=>p.id===outreachChat.pid);
  controls.innerHTML='<form class="help-action-form" onsubmit="chooseOutreachMonth();return false">'+(action.kind==='leave'?'<div class="help-month-choice"><b>'+esc(person?.name||'ยังไม่ได้เลือกบุคลากร')+'</b><button type="button" class="textbtn" onclick="changeChatPerson()">เปลี่ยนบุคลากร</button></div>':'')+'<label for="helpMonth">เลือกเดือนสำหรับ'+esc(action.topic)+'</label><div class="help-input-row"><input id="helpMonth" type="month" min="1900-01" max="2200-12" value="'+esc(outreachChat.month||state.selected)+'" required><button class="primary" type="submit">เลือกเดือนนี้</button></div></form>';
 }else if(outreachChat.step==='person'){
  controls.innerHTML='<form class="help-action-form" onsubmit="chooseChatPerson();return false"><label for="helpPerson">เลือกบุคลากรสำหรับ '+esc(action.label)+'</label><div class="help-input-row"><select id="helpPerson" required><option value="">เลือกบุคลากร</option>'+state.people.map(p=>'<option value="'+esc(p.id)+'">'+esc(p.name)+'</option>').join('')+'</select><button class="primary" type="submit">เลือกคนนี้</button></div></form>';
 }else if(outreachChat.step==='days'){
  const person=state.people.find(p=>p.id===outreachChat.pid),hint=action.kind==='need'?'เพิ่ม'+action.topic+' วันละอย่างน้อย 1 คน':'ลง '+action.label+' ให้ '+(person?.name||'บุคลากรที่เลือก');
  controls.innerHTML='<form class="help-action-form" onsubmit="submitOutreachDays();return false"><div class="help-month-choice"><b>'+esc(monthLabel(outreachChat.month))+'</b><button type="button" class="textbtn" onclick="changeOutreachMonth()">เปลี่ยนเดือน</button></div>'+(action.kind==='leave'?'<div class="help-month-choice"><span>'+esc(person?.name||'ยังไม่ได้เลือกบุคลากร')+'</span><button type="button" class="textbtn" onclick="changeChatPerson()">เปลี่ยนบุคลากร</button></div>':'')+'<label for="helpDays">วันที่เท่าไหร่บ้างคะ</label><div class="help-input-row"><input id="helpDays" type="text" maxlength="300" value="'+esc(outreachChat.daysText)+'" placeholder="เช่น 3, 5-6" autocomplete="off" required><button class="primary" type="submit">บันทึกวัน</button></div><small>'+esc(hint)+'</small></form>';
 }else{
  controls.innerHTML='<div class="help-action-grid">'+CHAT_ACTIONS.map(a=>'<button class="help-start-action help-action-'+a.id+'" data-chat-action="'+a.id+'" type="button" onclick="startChatAction(\''+a.id+'\')">'+esc(a.label)+'</button>').join('')+'</div>';
 }
 log.scrollTop=log.scrollHeight;
 if(outreachChat.step==='days')$('helpDays').focus?.({preventScroll:true});
 if(outreachChat.step==='person')$('helpPerson').focus?.({preventScroll:true});
}
function startChatAction(id){
 if(!outreachChatOpen())return;
 const action=CHAT_ACTIONS.find(a=>a.id===id);if(!action)return;
 helpMessages.push({side:'user',text:action.label},{side:'guide',text:action.kind==='leave'?'ต้องการลง '+action.label+' ให้ใครคะ':'ต้องการลง'+action.topic+' เดือนอะไรคะ'});
 outreachChat={step:action.kind==='leave'?'person':'month',action:id,month:action.kind==='leave'?'':state.selected,pid:'',daysText:''};renderHelpChat();
}
function startOutreachChat(){startChatAction('outreach')}
function chooseOutreachMonth(){
 if(!outreachChatOpen()||outreachChat.step!=='month')return;
 const month=$('helpMonth').value;
 if(!validChatMonth(month)){helpMessages.push({side:'guide',text:'กรุณาเลือกเดือนและปีให้ถูกต้องค่ะ'});renderHelpChat();return}
 const action=currentChatAction();
 if(action.kind==='leave'&&!state.people.some(p=>p.id===outreachChat.pid)){outreachChat.step='person';helpMessages.push({side:'guide',text:'กรุณาเลือกบุคลากรก่อนค่ะ'});renderHelpChat();return}
 if(action.kind==='leave'&&!chatPeopleForMonth(state,month).some(p=>p.id===outreachChat.pid)){
  outreachChat.month=month;helpMessages.push({side:'user',text:monthLabel(month)},{side:'guide',text:'บุคลากรคนนี้ไม่ได้ลงตาราง '+monthLabel(month)+' ค่ะ เลือกเดือนอื่น หรือเพิ่มคนนี้ผ่านเมนูบุคลากรได้ค่ะ'});renderHelpChat();return;
 }
 outreachChat={...outreachChat,step:'days',month,daysText:''};
 helpMessages.push({side:'user',text:monthLabel(month)},{side:'guide',text:chatDatesPrompt()});
 renderHelpChat();
}
function chatDatesPrompt(){return 'วันที่เท่าไหร่บ้างคะ\nพิมพ์วันที่คั่นด้วยจุลภาค หรือใช้ช่วงวันที่ เช่น 3, 5-6 ได้เลยค่ะ'}
function chooseChatPerson(){
 if(!outreachChatOpen()||outreachChat.step!=='person')return;
 const person=state.people.find(p=>p.id===$('helpPerson').value);
 if(!person){helpMessages.push({side:'guide',text:'กรุณาเลือกบุคลากรให้ถูกต้องค่ะ'});renderHelpChat();return}
 outreachChat.pid=person.id;outreachChat.step='month';outreachChat.month='';outreachChat.daysText='';helpMessages.push({side:'user',text:person.name},{side:'guide',text:'ต้องการลง '+currentChatAction().label+' เดือนอะไรคะ'});renderHelpChat();
}
function changeChatPerson(){
 if(!outreachChatOpen()||currentChatAction().kind!=='leave')return;
 outreachChat.step='person';outreachChat.pid='';outreachChat.month='';outreachChat.daysText='';helpMessages.push({side:'guide',text:'เลือกบุคลากรได้เลยค่ะ'});renderHelpChat();
}
function changeOutreachMonth(){
 if(!outreachChatOpen())return;
 outreachChat.step='month';outreachChat.daysText='';helpMessages.push({side:'guide',text:'เลือกเดือนที่ต้องการได้เลยค่ะ'});renderHelpChat();
}
function submitOutreachDays(){
 if(!outreachChatOpen()||outreachChat.step!=='days')return;
 const raw=$('helpDays').value.trim();outreachChat.daysText=raw;
 let days,next;const action=currentChatAction();
 try{days=parseOutreachDays(raw,outreachChat.month);next=action.kind==='need'?shiftMonthWithDays(state,outreachChat.month,days,action.code):leaveMonthWithDays(state,outreachChat.month,outreachChat.pid,days,action.code)}catch(e){helpMessages.push({side:'user',text:raw},{side:'guide',text:e.message});renderHelpChat();return}
 const month=outreachChat.month,needsChange=state.selected!==month||!state.months[month]||JSON.stringify(next)!==JSON.stringify(state.months[month]);
 outreachChat.step='done';
 if(typeof cancelPaint==='function')cancelPaint();
 if(needsChange)checkpoint();state.months[month]=next;state.selected=month;view('schedule');changed();
 const person=state.people.find(p=>p.id===outreachChat.pid),reply=action.kind==='need'?'บันทึก'+action.topic+' วันที่ '+days.join(', ')+' '+monthLabel(month)+' แล้วค่ะ\nกดหัววันที่เพื่อตรวจจำนวนคน หรือกด “จัดเวรอัตโนมัติ” เพื่อจัดบุคลากรลงเวรได้ค่ะ':'บันทึก '+action.label+' ให้ '+person.name+' วันที่ '+days.join(', ')+' '+monthLabel(month)+' แล้วค่ะ';
 helpMessages.push({side:'user',text:raw},{side:'guide',text:reply});
 outreachChat.daysText='';renderHelpChat();toast('บันทึก'+action.topic+'แล้ว');
}
function resetHelpChat(){helpMessages=[];outreachChat={step:'idle',action:'outreach',month:'',pid:'',daysText:''};helpModal()}
