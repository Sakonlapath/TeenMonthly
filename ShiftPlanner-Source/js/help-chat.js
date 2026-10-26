/* A local, guided conversation built from the planner's help topics. */
const HELP_TOPICS=[
 {id:'start',question:'เริ่มจัดเวรยังไงดี?',answer:'เริ่มได้ใน 3 ขั้นตอนครับ\n1. เลือกเดือน แล้วคลิกหัววันที่เพื่อตั้งวันหยุดและจำนวนคน\n2. ลง OFF / VAC และเวรที่ต้องการจัดเอง\n3. กรอกเป้ารายคนในช่อง “รวม” แล้วกด “จัดเวรอัตโนมัติ”\nเสร็จแล้วกด “ตรวจเงื่อนไข” เพื่อเช็กตารางอีกครั้งครับ'},
 {id:'manual',question:'ลงเวรเองหรือลากหลายวันทำยังไง?',answer:'เลือกชนิดเวรที่แถบด้านบน แล้วคลิกหรือลากตามวันที่ในแถวของคนเดียวกัน ปล่อยเมาส์เพื่อบันทึกครับ\nเวรที่ลงเองจะมี ◆ และระบบจะคงตารางทั้งเดือนของคนนั้นไว้ รวมช่องว่างด้วย\nถ้าต้องการให้ระบบจัดคนนี้อีกครั้ง ให้เปิดรายละเอียดรายช่องและปลดล็อกเวรทุกช่องของคนนั้นครับ'},
 {id:'leave',question:'กำหนดวันหยุด OFF / VAC ตรงไหน?',answer:'เลือก OFF สำหรับวันหยุดส่วนตัว หรือ VAC สำหรับวันลา จากแถบลงเวร แล้วคลิกหรือลากในแถวของคนนั้นได้เลยครับ\nระบบจะไม่จัดเวรในวันที่เป็น OFF / VAC\nส่วนวันหยุดราชการ ให้คลิกหัววันที่แล้วติ๊กวันหยุด เสาร์–อาทิตย์ระบบกำหนดให้อัตโนมัติครับ'},
 {id:'targets',question:'แถวล่างกับช่องรวมด้านขวาต่างกันยังไง?',answer:'แถวล่าง “จำนวนคน / ต้องการ” เป็นยอดรายวัน เช่น 2/2 คือจัดแล้ว 2 คน จากที่ต้องการ 2 คนครับ\nคอลัมน์ขวาสุด “รวม (จัดแล้ว / เป้า)” เป็นยอดรายคน เช่น 8/10 คือจัดแล้ว 8 เวร จากเป้า 10 เวร\nกรอกเป้าเป็นจำนวนเต็ม 0 ถึงจำนวนวันของเดือน หรือเว้นว่างให้ระบบคำนวณ เมื่อกรอกครบทุกคน ระบบปรับจำนวนรายวันตามเป้ารวมที่จัดได้ครับ\nแถวล่างและคอลัมน์ขวาจะตรึงไว้ให้เห็นเวลาเลื่อนตารางครับ'},
 {id:'equal',question:'ทำไมคนลำดับ 2–4 ต้องได้เวรเท่ากัน?',answer:'นี่เป็นกติกาของตารางครับ คนลำดับ 2–4 ต้องมีจำนวนเวรรวมเท่ากัน โดยนับทุกประเภทครั้งละ 1 เวร ไม่รวม OFF / VAC\nเมื่อเปลี่ยนเป้าของคนใดคนหนึ่งในกลุ่ม ระบบจะเปลี่ยนเป้าของทั้งสามคนให้เท่ากันด้วยครับ'},
 {id:'types',question:'ด ช บ ร แต่ละสีคือเวรอะไร?',answer:'ด = ดึก 00:00–08:00\nช = เช้า 08:00–16:00\nบ = บ่าย 16:00–00:00\nร สีฟ้า = ห้องบัตร 06:30–08:30\nร สีแดง = ออก รพ.สต. 06:30–08:30\nหนึ่งคนรับได้วันละหนึ่งประเภทเวรครับ ร สีฟ้าเริ่มต้นทุก จ.–ศ. วันละ 1 คน ส่วน ร สีแดงกำหนดจำนวนที่หัววันที่ตามวันที่ออก รพ.สต. ครับ'},
 {id:'failed',question:'กดจัดอัตโนมัติแล้วจัดไม่ได้ ทำยังไง?',answer:'ลองดูข้อความที่ระบบแจ้ง แล้วตรวจหัวข้อนี้ครับ\n• OFF / VAC ทำให้มีคนว่างไม่พอหรือเปล่า\n• เป้ารายคนมากกว่าจำนวนวันที่รับเวรได้หรือช่องเวรที่เปิดรับไหม\n• มีเวรล็อกที่ชนเงื่อนไข หรือคนที่จัดเองยังไม่ครบเป้าไหม\n• มีบ่ายต่อดึก หรือคู่ที่ห้ามขึ้นวันเดียวกันไหม\nถ้าจัดไม่สำเร็จ ระบบจะเก็บตารางเดิมไว้ครับ กด “ตรวจเงื่อนไข” เพื่อดูจุดที่ต้องแก้ได้เลย'},
 {id:'staff',question:'แก้ชื่อ ตำแหน่ง หรือเรทเงินตรงไหน?',answer:'กด “บุคลากร” แล้วแก้ชื่อ–สกุล ตำแหน่ง และเรทเงิน จากนั้นกด “บันทึกบุคลากร” ครับ\nเรทเป็นบาทต่อเวร ใช้เท่ากันทุกประเภทเวรของคนนั้น โดยไม่นับ OFF / VAC\nดูจำนวนเวรและเงินรวมได้ในหน้า “สรุปจำนวนเวร” ครับ'},
 {id:'backup',question:'บันทึก สำรอง หรือส่งออกตารางยังไง?',answer:'ตารางบันทึกอัตโนมัติในเบราว์เซอร์ที่ใช้อยู่ครับ\n• Excel ตามต้นฉบับ: ส่งออกพร้อมสี รูปแบบ และสูตรค่าเวร\n• CSV: ส่งออกข้อมูลตาราง\n• สำรอง / พิมพ์: สำรอง JSON นำเข้าไฟล์เดิม หรือพิมพ์เป็น PDF\nถ้าจะย้ายเครื่อง เปลี่ยนเบราว์เซอร์ หรือล้างข้อมูลเว็บไซต์ ให้สำรอง JSON ไว้ก่อนครับ ข้อมูลจะไม่ซิงก์ข้ามอุปกรณ์อัตโนมัติ'},
 {id:'undo',question:'ลงผิด ย้อนกลับ หรือใช้คีย์ลัดได้ไหม?',answer:'กด “↶ ย้อนกลับ” หรือ Ctrl+Z เพื่อย้อนการแก้ไขครับ บน Mac ใช้ Cmd+Z\nคีย์ 1–5 เลือกชนิดเวร · 6 = OFF · 7 = VAC · 0 = ยางลบ\nใช้ลูกศรเลื่อนช่อง และ Shift + ลูกศรซ้าย/ขวาเพื่อเลือกหลายวัน\nEnter / Space ลงเวร · Delete ลบ · E เปิดรายละเอียด · Esc ยกเลิกการเลือก\nคีย์ลัดจะหยุดทำงานระหว่างกรอกข้อมูลหรือเปิดหน้าต่างนี้ครับ'}
];
let helpMessages=[],helpPending=null,helpReplyTimer=null;
function stopHelpReply(){
 if(helpReplyTimer!==null)clearTimeout(helpReplyTimer);
 helpReplyTimer=null;
 // Keep an interrupted answer in the conversation for the next visit.
 if(helpPending){helpMessages.push({side:'guide',text:helpPending.answer});helpPending=null}
}
function helpModal(){
 modal('ถามเรื่องจัดเวร','<div class="help-chat-intro"><img class="help-chat-avatar" src="img/kitty.webp" alt=""><div><b>คู่มือจัดเวร</b><small>เลือกคำถาม แล้วคุยกันทีละเรื่อง</small></div><span class="help-chat-badge">พร้อมช่วย</span></div><div id="helpMessages" class="help-messages" role="log" aria-label="บทสนทนาวิธีใช้งาน" aria-live="polite" aria-relevant="additions text"></div><div class="help-questions"><p id="helpQuestionsLabel">อยากรู้เรื่องไหนครับ?</p><div id="helpQuestions" class="help-question-list" role="group" aria-labelledby="helpQuestionsLabel"></div></div>','<button class="textbtn" onclick="resetHelpChat()">เริ่มคุยใหม่</button><button class="primary" onclick="closeModal()">กลับไปจัดเวร</button>');
 $('modal').classList.add('help-chat-modal');
 if(!helpMessages.length)helpMessages.push({side:'guide',text:'สวัสดีครับ 👋\nมีเรื่องไหนสงสัยเกี่ยวกับการจัดเวร เลือกคำถามด้านล่างได้เลยครับ'});
 renderHelpChat();
}
function helpMessageMarkup(message){
 return '<div class="help-message '+(message.side==='user'?'from-user':'from-guide')+'"><span class="help-sender">'+(message.side==='user'?'คุณ':'คู่มือจัดเวร')+'</span><div class="help-bubble">'+esc(message.text).replace(/\n/g,'<br>')+'</div></div>';
}
function renderHelpChat(){
 const log=$('helpMessages'),questions=$('helpQuestions');
 log.innerHTML=helpMessages.map(helpMessageMarkup).join('')+(helpPending?'<div class="help-message from-guide"><span class="help-sender">คู่มือจัดเวร</span><div class="help-bubble help-typing" role="status" aria-label="คู่มือกำลังพิมพ์"><span aria-hidden="true"></span><span aria-hidden="true"></span><span aria-hidden="true"></span><small>กำลังพิมพ์…</small></div></div>':'');
 const asked=new Set(helpMessages.filter(m=>m.side==='user').map(m=>m.text));
 questions.innerHTML=[...HELP_TOPICS].sort((a,b)=>Number(asked.has(a.question))-Number(asked.has(b.question))).map(topic=>'<button class="help-question" data-help-topic="'+topic.id+'" onclick="askHelp(\''+topic.id+'\')" '+(helpPending?'disabled':'')+'>'+esc(topic.question)+'<span aria-hidden="true">↗</span></button>').join('');
 log.scrollTop=log.scrollHeight;
}
function askHelp(id){
 const topic=HELP_TOPICS.find(t=>t.id===id);
 if(!topic||helpPending||!$('modal').open||!$('modal').classList.contains('help-chat-modal'))return;
 helpMessages.push({side:'user',text:topic.question});helpPending=topic;
 renderHelpChat();
 helpReplyTimer=setTimeout(()=>{
  helpReplyTimer=null;
  if(!helpPending)return;
  const answered=helpPending,restoreFocus=document.activeElement===document.body;
  helpMessages.push({side:'guide',text:answered.answer});helpPending=null;
  if($('modal').open&&$('modal').classList.contains('help-chat-modal')){
   renderHelpChat();
   if(restoreFocus)$('helpQuestions').querySelector('[data-help-topic="'+answered.id+'"]')?.focus({preventScroll:true});
  }
 },950);
}
function resetHelpChat(){stopHelpReply();helpMessages=[];helpModal()}
$('modal').addEventListener('close',()=>{if(!$('modal').open)stopHelpReply()});
