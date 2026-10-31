/* Local assistant: search the active code library and manage shift/leave dates. */
const CHAT_MONTH_NAMES=['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
const CHAT_MONTH_SHORT=['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
const CHAT_MONTH_CASUAL=['มกรา','กุมภา','มีนา','เมษา','พฤษภา','มิถุนา','กรกฎา','สิงหา','กันยา','ตุลา','พฤศจิกา','ธันวา'];
const CHAT_ACTIONS=[
 {id:'outreach',label:'เลือกวันออก รพ.สต.',topic:'วันออก รพ.สต.',code:'X',kind:'need'},
 {id:'dawn',label:'วันหน้าตู้KIOS (ร)',topic:'วันหน้าตู้KIOS (ร)',code:'R',kind:'need'},
 {id:'off',label:'OFF',topic:'OFF',code:'OFF',kind:'leave'},
 {id:'vac',label:'Vac',topic:'Vac',code:'VAC',kind:'leave'}
];
let helpMessages=[],outreachChat={step:'idle',operation:'add',action:'outreach',month:'',pid:'',daysText:''};
let helpMode='schedule',helpDiseaseMessages=[];
function clearDiseaseChat(){
 helpDiseaseMessages=[];
 if(outreachChatOpen()&&helpMode==='diseases')renderHelpChat();
}
function currentChatAction(){return CHAT_ACTIONS.find(a=>a.id===outreachChat.action)||CHAT_ACTIONS[0]}
function removingChatDays(){return outreachChat.operation==='remove'}
function chatActionLabel(action){return removingChatDays()?'ยกเลิก '+action.topic:action.label}
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
function cancelMonthDays(s,month,days,code,pid=''){
 if(!validChatMonth(month)||!Array.isArray(days)||!days.length||days.some(d=>!Number.isInteger(d)||d<1||d>daysIn(month)))throw Error('เดือนหรือวันที่ไม่ถูกต้องค่ะ');
 if(!['R','X','OFF','VAC'].includes(code))throw Error('ประเภทรายการที่ต้องการยกเลิกไม่ถูกต้องค่ะ');
 const shift=['R','X'].includes(code);
 if(!shift&&!s.people.some(p=>p.id===pid))throw Error('กรุณาเลือกบุคลากรให้ถูกต้องค่ะ');
 if(!s.months[month])return null;
 const m=clone(s.months[month]),selected=new Set(days);
 if(shift)for(const d of selected){m.days[d].need[code]=0;if(m.autoCapacity)m.autoCapacity[d]={...(m.autoCapacity[d]||m.days[d].need),[code]:0}}
 for(const[k,c]of Object.entries(m.cells)){
  const[id,day]=k.split('|');if(!selected.has(Number(day)))continue;
  if(shift&&c.code===code){c.code='';c.locked=false}
  else if(!shift&&id===pid&&c.block===code)c.block='';
  else continue;
  if(!c.code&&!c.block)delete m.cells[k];
 }
 return m;
}
function leaveMonthWithDays(s,month,pid,days,code){
 if(!validChatMonth(month)||!Array.isArray(days)||!days.length||days.some(d=>!Number.isInteger(d)||d<1||d>daysIn(month)))throw Error('เดือนหรือวันที่ไม่ถูกต้องค่ะ');
 if(!['OFF','VAC'].includes(code))throw Error('ประเภทวันหยุดไม่ถูกต้องค่ะ');
 let m=clone(s.months[month]||freshMonth(month));
 for(const d of days){const draft={...s,months:{...s.months,[month]:m}},result=manualRange(draft,month,pid,d,d,code);if(!result.ok)throw Error(result.message);m=result.month}
 return m;
}
function outreachChatOpen(){return $('modal').open&&$('modal').classList.contains('help-chat-modal')}
function helpModal(){
 modal('ผู้ช่วยพฤกษา','<div class="help-chat-intro"><img class="help-chat-avatar" src="img/kitty.webp" alt=""><div class="help-chat-identity"><div class="help-chat-name"><b>ผู้ช่วยพฤกษา</b><span class="help-chat-badge">พร้อมช่วย</span></div><small>'+(helpMode==='diseases'?'ค้นหาโรคและรหัสจากคลังที่เปิดอยู่ค่ะ':'เลือกเดือน แล้วพิมพ์วันที่ได้เลยค่ะ')+'</small></div><button type="button" class="help-chat-reset" onclick="resetHelpChat()">เริ่มคุยใหม่</button></div><div class="help-mode-tabs" role="group" aria-label="เลือกผู้ช่วย">'+[['diseases','ค้นหาโรค'],['schedule','จัดตารางเวร']].map(([id,label])=>'<button type="button" aria-pressed="'+(helpMode===id)+'" onclick="setHelpMode(\''+id+'\')">'+label+'</button>').join('')+'</div><div id="helpMessages" class="help-messages" role="log" aria-label="บทสนทนาผู้ช่วยพฤกษา" aria-live="polite" aria-relevant="additions text"></div><div id="helpControls" class="help-controls"></div>');
 $('modalFoot').innerHTML='';
 $('modal').classList.add('help-chat-modal');
 if(!helpMessages.length)helpMessages.push({side:'guide',text:'สวัสดีค่ะ วันนี้มีอะไรให้ช่วยคะ'});
 renderHelpChat();
}
function helpMessageMarkup(message,index){
 const matches=(message.matches||[]).map(r=>'<details class="help-disease-result"><summary><b>'+esc(r.code)+'</b><span>'+esc(r.disease)+'</span></summary><dl>'+[['conditions','เงื่อนไข'],['procedures','หัตถการ'],['note','Note']].map(([key,label])=>'<div><dt>'+label+'</dt><dd>'+esc(r[key]||'ไม่ได้ระบุ')+'</dd></div>').join('')+'</dl></details>').join('');
 const all=message.matches?.length?'<button type="button" class="help-show-results" onclick="openHelpDiseaseResults('+index+')">ดูผลทั้งหมด '+message.total+' รายการในคลัง</button>':'';
 return '<div class="help-message '+(message.side==='user'?'from-user':'from-guide')+'"><span class="help-sender">'+(message.side==='user'?'คุณ':'ผู้ช่วยพฤกษา')+'</span><div class="help-bubble">'+esc(message.text).replace(/\n/g,'<br>')+matches+all+'</div></div>';
}
function setHelpMode(mode){
 if(!outreachChatOpen()||!['schedule','diseases'].includes(mode))return;
 helpMode=mode;helpModal();
}
function renderDiseaseChat(){
 if(!helpDiseaseMessages.length)helpDiseaseMessages.push({side:'guide',text:'พิมพ์ชื่อโรคหรือรหัสที่ต้องการค้นหาได้เลยค่ะ'});
 const log=$('helpMessages');log.innerHTML=helpDiseaseMessages.map(helpMessageMarkup).join('');
 $('helpControls').innerHTML='<form class="help-action-form" onsubmit="submitDiseaseSearch();return false"><label for="helpDiseaseQuery">ชื่อโรค รหัส หรือคำในรายละเอียด</label><div class="help-input-row"><input id="helpDiseaseQuery" type="search" maxlength="500" placeholder="เช่น ไข้ หรือ A09" autocomplete="off" required><button class="primary" type="submit">ค้นหา</button></div></form>';
 log.scrollTop=log.scrollHeight;$('helpDiseaseQuery').focus?.({preventScroll:true});
}
function submitDiseaseSearch(){
 if(!outreachChatOpen()||helpMode!=='diseases')return;
 const raw=$('helpDiseaseQuery').value.trim();if(!raw)return;
 helpDiseaseMessages.push({side:'user',text:raw});
 try{
  const query=raw.replace(/^(?:ช่วย(?:ค้นหา|หา)(?:โรค|รหัส)?|ค้นหา(?:โรค|รหัส)?|หา(?:โรค|รหัส))\s*/u,'').trim();
  const rows=CodeLibrary.lookup(query);
  helpDiseaseMessages.push({side:'guide',query,total:rows.length,matches:rows.slice(0,6),text:rows.length?'พบ '+rows.length+' รายการในคลังค่ะ กดแต่ละรายการเพื่อดูรายละเอียดได้เลย'+(rows.length>6?'\nแสดง 6 รายการแรก':''):'ไม่พบรายการที่ตรงกันในคลังที่เปิดอยู่ค่ะ ลองใช้ชื่อโรคบางส่วนหรือรหัสอื่นนะคะ'});
 }catch(e){helpDiseaseMessages.push({side:'guide',text:e.message||'ค้นหาไม่ได้ กรุณาลองใหม่ค่ะ'})}
 renderDiseaseChat();
}
function openHelpDiseaseResults(index){
 if(!outreachChatOpen()||helpMode!=='diseases')return;
 const reply=helpDiseaseMessages[index];if(!reply?.matches?.length)return;
 CodeLibrary.openSearch(reply.query);
}
function renderHelpChat(){
 if(helpMode==='diseases'){renderDiseaseChat();return}
 const log=$('helpMessages'),controls=$('helpControls'),action=currentChatAction();
 log.innerHTML=helpMessages.map(helpMessageMarkup).join('');
 if(outreachChat.step==='month'){
  const person=state.people.find(p=>p.id===outreachChat.pid);
  controls.innerHTML='<form class="help-action-form" onsubmit="chooseOutreachMonth();return false">'+(action.kind==='leave'?'<div class="help-month-choice"><b>'+esc(person?.name||'ยังไม่ได้เลือกบุคลากร')+'</b><button type="button" class="textbtn" onclick="changeChatPerson()">เปลี่ยนบุคลากร</button></div>':'')+'<label for="helpMonth">เลือกเดือนสำหรับ'+esc(removingChatDays()?chatActionLabel(action):action.topic)+'</label><div class="help-input-row"><input id="helpMonth" type="month" min="1900-01" max="2200-12" value="'+esc(outreachChat.month||state.selected)+'" required><button class="primary" type="submit">เลือกเดือนนี้</button></div></form>';
 }else if(outreachChat.step==='person'){
  controls.innerHTML='<form class="help-action-form" onsubmit="chooseChatPerson();return false"><label for="helpPerson">เลือกบุคลากรสำหรับ '+esc(chatActionLabel(action))+'</label><div class="help-input-row"><select id="helpPerson" required><option value="">เลือกบุคลากร</option>'+state.people.filter(p=>removingChatDays()||canUseSymbol(p,action.code)).map(p=>'<option value="'+esc(p.id)+'">'+esc(p.name)+'</option>').join('')+'</select><button class="primary" type="submit">เลือกคนนี้</button></div></form>';
 }else if(outreachChat.step==='days'){
  const person=state.people.find(p=>p.id===outreachChat.pid),hint=removingChatDays()?(action.kind==='need'?'ปิดวันและลบเวร'+action.topic+' ในวันที่เลือก รวมช่องที่ล็อกไว้':'ล้างเฉพาะ '+action.label+' ของ '+(person?.name||'บุคลากรที่เลือก')):(action.kind==='need'?'เพิ่ม'+action.topic+' วันละอย่างน้อย 1 คน':'ลง '+action.label+' ให้ '+(person?.name||'บุคลากรที่เลือก'));
  controls.innerHTML='<form class="help-action-form" onsubmit="submitOutreachDays();return false"><div class="help-month-choice"><b>'+esc(monthLabel(outreachChat.month))+'</b><button type="button" class="textbtn" onclick="changeOutreachMonth()">เปลี่ยนเดือน</button></div>'+(action.kind==='leave'?'<div class="help-month-choice"><span>'+esc(person?.name||'ยังไม่ได้เลือกบุคลากร')+'</span><button type="button" class="textbtn" onclick="changeChatPerson()">เปลี่ยนบุคลากร</button></div>':'')+'<label for="helpDays">วันที่เท่าไหร่บ้างคะ</label><div class="help-input-row"><input id="helpDays" type="text" maxlength="300" value="'+esc(outreachChat.daysText)+'" placeholder="เช่น 3, 5-6" autocomplete="off" required><button class="primary" type="submit">'+(removingChatDays()?'ยกเลิกวันที่เลือก':'บันทึกวัน')+'</button></div><small>'+esc(hint)+'</small></form>';
 }else{
  controls.innerHTML='<div class="help-operation-tabs" role="group" aria-label="เพิ่มหรือยกเลิกวัน">'+[['add','เพิ่ม / ลงวัน'],['remove','ยกเลิกวัน']].map(([id,label])=>'<button type="button" data-chat-operation="'+id+'" aria-pressed="'+((outreachChat.operation||'add')===id)+'" onclick="setChatOperation(\''+id+'\')">'+label+'</button>').join('')+'</div><div class="help-action-grid">'+CHAT_ACTIONS.map(a=>'<button class="help-start-action help-action-'+a.id+(removingChatDays()?' help-remove-action':'')+'" data-chat-action="'+a.id+'" type="button" onclick="startChatAction(\''+a.id+'\')">'+esc(chatActionLabel(a))+'</button>').join('')+'</div>';
 }
 if(['month','person','days'].includes(outreachChat.step))controls.innerHTML+='<button class="textbtn help-cancel-entry" type="button" onclick="cancelChatEntry()">ยกเลิกการกรอก</button>';
 log.scrollTop=log.scrollHeight;
 if(outreachChat.step==='days')$('helpDays').focus?.({preventScroll:true});
 if(outreachChat.step==='person')$('helpPerson').focus?.({preventScroll:true});
}
function startChatAction(id){
 if(!outreachChatOpen())return;
 const action=CHAT_ACTIONS.find(a=>a.id===id);if(!action)return;
 const label=chatActionLabel(action);
 helpMessages.push({side:'user',text:label},{side:'guide',text:action.kind==='leave'?'ต้องการ'+(removingChatDays()?'ยกเลิก ':'ลง ')+action.label+' ให้ใครคะ':'ต้องการ'+(removingChatDays()?'ยกเลิก':'ลง')+action.topic+' เดือนอะไรคะ'});
 outreachChat={step:action.kind==='leave'?'person':'month',operation:outreachChat.operation||'add',action:id,month:action.kind==='leave'?'':state.selected,pid:'',daysText:''};renderHelpChat();
}
function setChatOperation(operation){
 if(!outreachChatOpen()||!['idle','done'].includes(outreachChat.step)||!['add','remove'].includes(operation))return;
 outreachChat={step:'idle',operation,action:'outreach',month:'',pid:'',daysText:''};renderHelpChat();
}
function cancelChatEntry(){
 if(!outreachChatOpen()||!['month','person','days'].includes(outreachChat.step))return;
 outreachChat={step:'idle',operation:outreachChat.operation||'add',action:'outreach',month:'',pid:'',daysText:''};
 helpMessages.push({side:'guide',text:'ยกเลิกการกรอกแล้วค่ะ ยังไม่ได้เปลี่ยนตาราง'});renderHelpChat();
}
function startOutreachChat(){startChatAction('outreach')}
function chooseOutreachMonth(){
 if(!outreachChatOpen()||outreachChat.step!=='month')return;
 const month=$('helpMonth').value;
 if(!validChatMonth(month)){helpMessages.push({side:'guide',text:'กรุณาเลือกเดือนและปีให้ถูกต้องค่ะ'});renderHelpChat();return}
 const action=currentChatAction();
 if(action.kind==='leave'&&!state.people.some(p=>p.id===outreachChat.pid)){outreachChat.step='person';helpMessages.push({side:'guide',text:'กรุณาเลือกบุคลากรก่อนค่ะ'});renderHelpChat();return}
 if(action.kind==='leave'&&!removingChatDays()&&!chatPeopleForMonth(state,month).some(p=>p.id===outreachChat.pid)){
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
 if(!removingChatDays()&&!canUseSymbol(person,currentChatAction().code)){helpMessages.push({side:'guide',text:person.name+' รับได้เฉพาะ รพ.สต. (ร สีแดง) หรือช่องว่างค่ะ'});renderHelpChat();return}
 outreachChat.pid=person.id;outreachChat.step='month';outreachChat.month='';outreachChat.daysText='';helpMessages.push({side:'user',text:person.name},{side:'guide',text:'ต้องการ'+(removingChatDays()?'ยกเลิก ':'ลง ')+currentChatAction().label+' เดือนอะไรคะ'});renderHelpChat();
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
 if(typeof Planner!=='undefined'&&!Planner.guard(outreachChat.month))return;
 const raw=$('helpDays').value.trim();outreachChat.daysText=raw;
 let days,next;const action=currentChatAction();
 try{days=parseOutreachDays(raw,outreachChat.month);next=removingChatDays()?cancelMonthDays(state,outreachChat.month,days,action.code,outreachChat.pid):action.kind==='need'?shiftMonthWithDays(state,outreachChat.month,days,action.code):leaveMonthWithDays(state,outreachChat.month,outreachChat.pid,days,action.code)}catch(e){helpMessages.push({side:'user',text:raw},{side:'guide',text:e.message});renderHelpChat();return}
 if(removingChatDays()&&(!next||JSON.stringify(next)===JSON.stringify(state.months[outreachChat.month]))){outreachChat.step='done';outreachChat.daysText='';helpMessages.push({side:'user',text:raw},{side:'guide',text:'ไม่มีรายการ'+action.topic+' ที่ต้องยกเลิกในวันที่เลือกค่ะ ตารางยังเหมือนเดิม'});renderHelpChat();return}
 const month=outreachChat.month,needsChange=state.selected!==month||!state.months[month]||JSON.stringify(next)!==JSON.stringify(state.months[month]);
 outreachChat.step='done';
 if(typeof cancelPaint==='function')cancelPaint();
 if(needsChange)checkpoint();state.months[month]=next;state.selected=month;view('schedule');changed();
 const person=state.people.find(p=>p.id===outreachChat.pid),reply=action.kind==='need'?'บันทึก'+action.topic+' วันที่ '+days.join(', ')+' '+monthLabel(month)+' แล้วค่ะ\nกดหัววันที่เพื่อตรวจจำนวนคน หรือกด “จัดเวรอัตโนมัติ” เพื่อจัดบุคลากรลงเวรได้ค่ะ':'บันทึก '+action.label+' ให้ '+person.name+' วันที่ '+days.join(', ')+' '+monthLabel(month)+' แล้วค่ะ';
 const cancellation='ยกเลิก'+action.topic+(action.kind==='leave'?' ของ '+person.name:'')+' วันที่ '+days.join(', ')+' '+monthLabel(month)+' แล้วค่ะ\nย้อนกลับได้ด้วยปุ่ม “ย้อนกลับ” ในตาราง';
 helpMessages.push({side:'user',text:raw},{side:'guide',text:removingChatDays()?cancellation:reply});
 outreachChat.daysText='';renderHelpChat();toast((removingChatDays()?'ยกเลิก':'บันทึก')+action.topic+'แล้ว');
}
function resetHelpChat(){
 if(helpMode==='diseases')helpDiseaseMessages=[];
 else{helpMessages=[];outreachChat={step:'idle',operation:'add',action:'outreach',month:'',pid:'',daysText:''}}
 helpModal();
}
