// Load browser scripts together: isolated engine tests cannot catch duplicate globals.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
function boot(saved=null,standalone=false){
const elements=new Map();
const element=id=>{if(!elements.has(id)){const classes=new Set();elements.set(id,{innerHTML:'',value:'',textContent:'',classList:{toggle(name,on){if(on===undefined)on=!classes.has(name);if(on)classes.add(name);else classes.delete(name)},add(name){classes.add(name)},remove(name){classes.delete(name)},contains:name=>classes.has(name)},setAttribute(){},addEventListener(){},querySelectorAll(){return[]},querySelector(){return null},showModal(){this.open=true},close(){this.open=false}})}return elements.get(id)};
let stored=saved?JSON.stringify(saved):null;
const timers=new Map();let timerId=0;
const ctx=vm.createContext({console,TextEncoder,document:{getElementById:element,querySelectorAll:()=>[],addEventListener(){}},localStorage:{getItem:()=>stored,setItem(key,value){stored=value}},setTimeout(callback){timers.set(++timerId,callback);return timerId},clearTimeout(id){timers.delete(id)},cancelAnimationFrame(){}});
const run=x=>vm.runInContext(x,ctx);
ctx.window={addEventListener(){}};
if(standalone){const html=fs.readFileSync(path.join(__dirname,'../ShiftPlanner-Standalone.html'),'utf8');for(const match of html.matchAll(/<script>([\s\S]*?)<\/script>/g))run(match[1])}
else for(const file of ['core','data','export-template','exports','app','help-chat','editor'])run(fs.readFileSync(path.join(__dirname,'../js/'+file+'.js'),'utf8'));
return{ctx,run,element,stored:()=>stored,flushTimers(){for(const[id,callback]of [...timers]){timers.delete(id);callback()}}};
}
const {ctx,run,element}=boot();
assert.equal(run('Object.keys(activeMonth().cells).length'),0);
assert(!element('sourceNote').textContent.includes('ต.ค.69'));
assert(element('scheduleTable').innerHTML.includes('cell-btn'));assert(element('summaryTable').innerHTML.includes('รวมเงิน'));
run('selectMonth("2026-11");onQuotaChange("9","0");onQuotaChange("3","4")');
assert.equal(run('JSON.stringify(activeMonth().quotas)'),'{"3":4,"9":0}');
assert(!element('summaryTable').innerHTML.includes('เป้ารวม 4 เวร'));
run('onQuotaChange("3","1.5")');assert.equal(run('activeMonth().quotas["3"]'),4);
run('onQuotaInput({value:"15"},"3")');assert.equal(element('categoryTotal-card').textContent,0,'typing a goal cannot change the assigned count');
run('onQuotaChange("2","15");onQuotaChange("3","15");onQuotaChange("4","15");onQuotaChange("1","9");onQuotaChange("5","5");onQuotaChange("6","5");onQuotaChange("7","6");onQuotaChange("8","8")');
assert(element('categoryTotals').innerHTML.includes('id="calendarTotal" aria-live="polite">99</strong>'));assert(!element('categoryTotals').innerHTML.includes('quotaTotal'));
const index=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');assert.equal((index.match(/id="autoBtn"/g)||[]).length,1);assert(index.indexOf('id="autoBtn"')>index.indexOf('id="scheduleView"'));
assert(element('scheduleTable').innerHTML.includes('data-quota-id="3"'));
assert(!element('scheduleTable').innerHTML.includes('<tfoot>'));
assert(element('scheduleTable').innerHTML.endsWith('</tbody>'));
assert(element('categoryTotals').innerHTML.includes('เวรทั้งหมด'));assert(element('categoryTotals').innerHTML.includes('ลงแล้ว'));
assert(element('categoryTotals').innerHTML.includes('รายการที่ต้องตรวจ'));assert(element('categoryTotals').innerHTML.includes('onclick="issuesModal()"'));
assert(!index.includes('id="cards"'));assert(!index.includes('id="status"'));
assert(!index.includes('MY HAPPY SHIFT'));assert(!index.includes('เติมสีให้ตาราง'));assert(!index.includes('onclick="downloadExcel()"'));assert(!index.includes('onclick="downloadCSV()"'));
assert.equal((index.match(/id="documentsBtn"/g)||[]).length,1);assert(index.includes('id="documentsBtn">สร้างเอกสาร</button>'));
run('var mismatch=solve(state,state.selected);if(mismatch.ok||!mismatch.message.includes("ตามปฏิทิน")&&!mismatch.message.includes("ไม่ตรงกับ"))throw Error("calendar targets must be checked");activeMonth().quotas={};var solved=solve(state,state.selected,{distribution:true,ms:10000});if(!solved.ok)throw Error(solved.message);state.months[state.selected]=solved.month;render()');
assert.equal(run('totals(state,state.selected).reduce((sum,p)=>sum+p.total,0)'),99);
const totalsStrip=element('categoryTotals').innerHTML;
assert.equal(element('totalsMonth').textContent,run('monthLabel(state.selected)'));
for(const category of ['card','dawn']){
 const target=run('totals(state,state.selected).reduce((sum,t)=>sum+categoryTotals(t).'+category+',0)');
 assert(totalsStrip.includes('id="categoryTotal-'+category+'" aria-label="ผลรวม '+run('SHIFT_GROUPS.find(g=>g.id==="'+category+'").label')+'" aria-live="polite">'+target+'</strong>'));
}
run('activeMonth().cells={}');
run('staffModal()');assert(element('modalBody').innerHTML.includes('p-rate'));assert(!element('modalBody').innerHTML.includes('p-prev'));
const staff=run('JSON.parse(JSON.stringify(state.people))');
let badRate=false;
ctx.document.querySelectorAll=selector=>selector!=='.staff-item'?[]:staff.map(p=>({dataset:{id:p.id},querySelector:selector=>({'.p-name':{value:p.name},'.p-role':{value:p.role},'.p-included':{checked:true},'.p-rate-card':{value:badRate?'oops':'700',focus(){}},'.p-rate-dawn':{value:'100',focus(){}}}[selector])}));
run('saveStaff()');assert.equal(run('payRate(state,"1")'),700);assert.equal(run('payRate(state,"1","dawn")'),100);assert.equal(run('payRate(state,"1","outreach")'),100);assert.equal(run('state.people.length'),9);
badRate=true;run('saveStaff()');assert.equal(run('payRate(state,"1")'),700);
run('exportDetailsModal()');assert(element('modalBody').innerHTML.includes('exportOrder'));
run('state.months[state.selected].cells["8|2"]={code:"R",block:"",locked:true};cellModal(0,2);choice="R";saveCell()');
assert.equal(run('cell(activeMonth(),"1",2).code'),'');
run('validateBackup(state)');
console.log('PASS: combined browser script startup, render, individual targets, invalid input, settings and modal pair enforcement');
const legacy=require('./fixtures/legacy-october.json');
for(const standalone of [false,true]){
 const old=JSON.parse(JSON.stringify(legacy));old.months['2026-11']=JSON.parse(run('JSON.stringify(freshMonth("2026-11"))'));
 const migrated=boot(old,standalone);
 assert.equal(migrated.run('state.people.length'),9);assert.equal(migrated.run('state.people[8].name'),'นายปรเมศวร์ ศิริเสาร์');assert.equal(JSON.parse(migrated.stored()).people.length,9);
 assert.equal(migrated.run('Object.keys(state.months["2026-10"].cells).length'),0);
 assert.equal(Object.keys(JSON.parse(migrated.stored()).months['2026-10'].cells).length,0);
 assert.deepEqual(JSON.parse(migrated.run('JSON.stringify(state.months["2026-11"])')),{...old.months['2026-11'],calendarRules:true});
 migrated.run('undo()');assert.equal(migrated.run('Object.keys(state.months["2026-10"].cells).length'),129);
 const edited=JSON.parse(JSON.stringify(legacy));edited.months['2026-10'].cells['1|1']={code:'',block:'VAC',locked:false};
 const kept=boot(edited,standalone);
 assert.deepEqual(JSON.parse(kept.run('JSON.stringify(state.months["2026-10"].cells)')),edited.months['2026-10'].cells);assert.equal(kept.run('state.months["2026-10"].calendarRules'),true);
 const fresh=boot(null,standalone);assert.equal(fresh.run('Object.keys(activeMonth().cells).length'),0);
 assert.equal((fresh.element('scheduleTable').innerHTML.match(/data-quota-category=/g)||[]).length,27);
 assert.equal((fresh.element('summaryTable').innerHTML.match(/data-quota-category=/g)||[]).length,27);
 assert.equal(fresh.run('state.people[8].role'),'นวก.คอมพิวเตอร์ชำนาญการ');assert.equal(fresh.run('payRate(state,"9")'),0);
 for(const kind of ['card','dawn'])assert(fresh.element('scheduleTable').innerHTML.includes('total-head total-'+kind));
 fresh.run('onQuotaChange("1","2","card");onQuotaChange("1","4","dawn")');
 assert.equal(fresh.run('JSON.stringify(activeMonth().categoryQuotas["1"])'),'{"card":2,"dawn":4}');
 // Old backups display one combined target, and editing replaces both old fields.
 fresh.run('activeMonth().categoryQuotas["1"]={card:2,dawn:3,outreach:1};validateBackup(state);render()');
 assert.equal(fresh.run('categoryTargets(state,state.selected)["1"].dawn'),4);
 assert(!fresh.element('scheduleTable').innerHTML.includes('total-head total-outreach'));
 assert(fresh.element('scheduleTable').innerHTML.includes('total-head total-total">รวม</th>'));
 fresh.run('onQuotaChange("1","5","dawn")');
 assert.equal(fresh.run('JSON.stringify(activeMonth().categoryQuotas["1"])'),'{"card":2,"dawn":5}');
 fresh.run('undo()');assert.equal(fresh.run('categoryTargets(state,state.selected)["1"].dawn'),4);
 fresh.run('onQuotaChange("1","4","dawn")');
 fresh.run('activeMonth().cells["1|1"]={code:"M",block:"",locked:false};activeMonth().cells["1|2"]={code:"R",block:"",locked:false};activeMonth().cells["1|3"]={code:"X",block:"",locked:false};render()');
 for(const table of ['scheduleTable','summaryTable']){
  const html=fresh.element(table).innerHTML,editors=[...html.matchAll(/<div class="total-editor">(.*?)<\/div>/g)];
  assert.equal(editors.length,27);
  for(const [,editor]of editors){assert(editor.startsWith('<input type="number"'));assert(!editor.includes('<b>'));assert(!editor.includes('<span>/</span>'));assert(!editor.includes('placeholder='))}
  assert.equal((html.match(/class="quota-input group-quota-input"/g)||[]).length,0);
  assert(!html.includes('class="equal"'));
  assert.equal((html.match(/data-person-total=/g)||[]).length,9);
  assert(html.includes('data-quota-id="1" data-quota-category="total" value="6" data-person-total="1"'));
  assert(!html.includes('data-quota-category="outreach"'));
  assert(!html.includes('จัดแล้ว / เป้า'));assert(!html.includes('quota-warning'));
 }
 assert.equal(fresh.run('targetSum(state,state.selected)'),6);
 fresh.run('onQuotaInput({value:"5"},"1","dawn")');assert(!fresh.element('categoryTotals').innerHTML.includes('quotaTotal'));
 assert.equal(fresh.element('categoryTotal-card').textContent,1);assert.equal(fresh.element('categoryTotal-dawn').textContent,2);
 fresh.run('onQuotaChange("1","30","card")');assert.equal(fresh.run('activeMonth().categoryQuotas["1"].card'),2);
 fresh.run('onQuotaChange("1","0","dawn");validateBackup(state)');assert.equal(fresh.run('activeMonth().categoryQuotas["1"].dawn'),0);
 fresh.run('undo()');assert.equal(fresh.run('activeMonth().categoryQuotas["1"].dawn'),4);
 fresh.run('onQuotaChange("1","","card")');assert.equal(fresh.run('activeMonth().categoryQuotas["1"].card'),undefined);
 fresh.run('onQuotaChange("2","1","card");onQuotaChange("2","1","dawn");onQuotaChange("3","2","card");onQuotaChange("3","1","dawn");validateBackup(state)');
 assert.equal(fresh.run('JSON.stringify(group(state).map(id=>activeMonth().categoryQuotas[id]))'),'[{"card":1,"dawn":1},{"card":2,"dawn":1},null]');
 // Both categories are independent, and only the edited person's totals change.
 const inputs=['schedule','summary'].flatMap(()=>['1','2','3','4','5'].flatMap(id=>['card','dawn'].map(category=>({dataset:{quotaId:id,quotaCategory:category},value:'original'}))));
 const totalOutputs=['schedule','summary'].flatMap(()=>['1','2','3','4','5'].map(id=>({dataset:{personTotal:id},value:''})));
 fresh.ctx.document.querySelectorAll=selector=>selector==='[data-quota-id]'?inputs:selector==='[data-person-total]'?totalOutputs:[];
 fresh.run('onQuotaInput({value:"4"},"4","dawn")');
 for(const input of inputs)assert.equal(input.value,input.dataset.quotaId==='4'&&input.dataset.quotaCategory==='dawn'?'4':'original');
 assert.equal(fresh.run('activeMonth().categoryQuotas["2"].dawn'),1);
 assert(!fresh.element('scheduleTable').innerHTML.includes('quota-status'));
 assert.equal(fresh.element('categoryTotal-card').textContent,1);assert.equal(fresh.element('categoryTotal-dawn').textContent,2);
 for(const output of totalOutputs)assert.equal(output.value,output.dataset.personTotal==='4'?4:output.dataset.personTotal==='2'?2:output.dataset.personTotal==='3'?3:output.dataset.personTotal==='1'?5:0);
 fresh.run('onQuotaInput({value:"3"},"2","card")');
 for(const input of inputs)if(input.dataset.quotaCategory==='card')assert.equal(input.value,input.dataset.quotaId==='2'?'3':'original');
 fresh.run('onQuotaChange("4","4","dawn")');
 assert.equal(fresh.run('JSON.stringify(group(state).map(id=>activeMonth().categoryQuotas[id].dawn))'),'[1,1,4]');
 const sharedBefore=fresh.run('JSON.stringify(state)'),historyBefore=fresh.run('history.length');
 fresh.run('onQuotaChange("2","32","card")');
 assert.equal(fresh.run('JSON.stringify(state)'),sharedBefore);assert.equal(fresh.run('history.length'),historyBefore);
 // An edit must not affect another person's goals, even when they differ.
 fresh.run('activeMonth().categoryQuotas["4"].dawn=29');
 fresh.run('onQuotaChange("2","5","card")');assert.equal(fresh.run('activeMonth().categoryQuotas["2"].card'),5);assert.equal(fresh.run('activeMonth().categoryQuotas["3"].card'),2);assert.equal(fresh.run('activeMonth().categoryQuotas["4"].dawn'),29);
 fresh.run('activeMonth().categoryQuotas["4"].dawn=4;onQuotaChange("3","","dawn")');
 assert.equal(fresh.run('JSON.stringify(group(state).map(id=>activeMonth().categoryQuotas[id].dawn))'),'[1,null,4]');
 fresh.run('undo();validateBackup(state)');
 assert.equal(fresh.run('JSON.stringify(group(state).map(id=>activeMonth().categoryQuotas[id].dawn))'),'[1,1,4]');
 const beforeHelp=fresh.run('JSON.stringify(state)');
 fresh.run('helpModal();startOutreachChat()');
 assert(fresh.element('helpControls').innerHTML.includes('type="month"'));assert(fresh.element('helpMessages').innerHTML.includes('เดือนอะไรคะ'));
 fresh.element('helpMonth').value='2026-13';fresh.run('chooseOutreachMonth()');assert.equal(fresh.run('outreachChat.step'),'month');
 fresh.element('helpMonth').value='2026-11';fresh.run('chooseOutreachMonth()');assert.equal(fresh.run('outreachChat.step'),'days');
 assert(fresh.element('helpMessages').innerHTML.includes('วันที่เท่าไหร่บ้างคะ'));assert(fresh.element('helpControls').innerHTML.includes('helpDays'));
 const messageCount=fresh.run('helpMessages.length');fresh.run('closeModal();helpModal()');assert.equal(fresh.run('helpMessages.length'),messageCount);
 fresh.run('staffModal()');fresh.element('helpDays').value='3,5-6';fresh.run('submitOutreachDays()');
 assert(!fresh.element('modal').classList.contains('help-chat-modal'));assert.equal(fresh.run('JSON.stringify(state)'),beforeHelp);
 fresh.run('helpModal()');fresh.element('helpDays').value='3,31';const chatHistory=fresh.run('history.length');fresh.run('submitOutreachDays()');
 assert.equal(fresh.run('JSON.stringify(state)'),beforeHelp);assert.equal(fresh.run('history.length'),chatHistory);assert.equal(fresh.run('outreachChat.step'),'days');
 fresh.element('helpDays').value='<img src=x onerror=alert(1)>';fresh.run('submitOutreachDays()');assert(fresh.element('helpMessages').innerHTML.includes('&lt;img'));
 fresh.element('helpDays').value='ออก รพ.สต. ๓, ๕-๖ พฤศจิกา';fresh.run('submitOutreachDays();validateBackup(state)');
 assert.equal(fresh.run('state.selected'),'2026-11');assert.equal(fresh.run('JSON.stringify([3,5,6].map(d=>activeMonth().days[d].need.X))'),'[1,1,1]');
 assert.equal(fresh.run('activeMonth().days[4].need.X'),0);assert.equal(fresh.run('Object.keys(activeMonth().cells).length'),0);
 assert.equal(fresh.run('history.length'),chatHistory+1);assert.equal((fresh.element('scheduleTable').innerHTML.match(/class="outreach-day"/g)||[]).length,3);
 assert.equal(JSON.parse(fresh.stored()).months['2026-11'].days[5].need.X,1);
 const applied=fresh.run('JSON.stringify(state)');fresh.run('submitOutreachDays()');assert.equal(fresh.run('JSON.stringify(state)'),applied);
 fresh.run('startOutreachChat()');fresh.element('helpMonth').value='2026-11';fresh.run('chooseOutreachMonth()');fresh.element('helpDays').value='3,5-6';fresh.run('submitOutreachDays()');
 assert.equal(fresh.run('history.length'),chatHistory+1);
 fresh.run('closeModal();undo();resetHelpChat()');assert.equal(fresh.run('helpMessages.length'),1);
 assert.equal(fresh.run('JSON.stringify(state)'),beforeHelp);
 // All four action buttons work in source and standalone, including person selection.
 const actionChat=boot(null,standalone);
 actionChat.run('helpModal()');assert.equal(actionChat.run('helpMessages[0].text'),'สวัสดีค่ะ วันนี้มีอะไรให้ช่วยคะ');
 for(const action of ['outreach','dawn','off','vac'])assert(actionChat.element('helpControls').innerHTML.includes('data-chat-action="'+action+'"'));
 actionChat.run('startChatAction("dawn")');actionChat.element('helpMonth').value='2026-11';actionChat.run('chooseOutreachMonth()');
 assert.equal(actionChat.run('outreachChat.step'),'days');actionChat.element('helpDays').value='1,7';actionChat.run('submitOutreachDays()');
 assert.equal(actionChat.run('activeMonth().days[1].need.R'),1);assert.equal(actionChat.run('activeMonth().days[7].need.R'),1);assert.equal(actionChat.run('activeMonth().days[1].need.X'),0);
 actionChat.run('closeModal();undo();selectMonth("2026-11");activeMonth().excludedStaffIds=["8"];activeMonth().cells["3|14"]={code:"M",block:"",locked:true};resetHelpChat();startChatAction("off")');
 const beforeOff=actionChat.run('JSON.stringify(state)'),offHistory=actionChat.run('history.length');
 assert.equal(actionChat.run('outreachChat.step'),'person');assert(!actionChat.element('helpControls').innerHTML.includes('id="helpMonth"'));assert(actionChat.element('helpMessages').innerHTML.includes('ให้ใครคะ'));
 assert(actionChat.element('helpControls').innerHTML.includes('value="8"'));
 actionChat.element('helpPerson').value='missing';actionChat.run('chooseChatPerson()');assert.equal(actionChat.run('outreachChat.step'),'person');
 actionChat.element('helpPerson').value='8';actionChat.run('chooseChatPerson()');assert.equal(actionChat.run('outreachChat.step'),'month');assert(actionChat.element('helpMessages').innerHTML.includes('เดือนอะไรคะ'));
 actionChat.element('helpMonth').value='2026-11';actionChat.run('chooseOutreachMonth()');assert.equal(actionChat.run('outreachChat.step'),'month');assert.equal(actionChat.run('JSON.stringify(state)'),beforeOff);
 assert(actionChat.element('helpMessages').innerHTML.includes('ไม่ได้ลงตาราง'));actionChat.run('changeChatPerson()');
 actionChat.element('helpPerson').value='3';actionChat.run('chooseChatPerson();changeChatPerson()');assert.equal(actionChat.run('outreachChat.step'),'person');
 actionChat.element('helpPerson').value='3';actionChat.run('chooseChatPerson()');assert.equal(actionChat.run('outreachChat.step'),'month');
 actionChat.element('helpMonth').value='2026-11';actionChat.run('chooseOutreachMonth()');assert.equal(actionChat.run('outreachChat.step'),'days');
 actionChat.run('changeOutreachMonth()');assert.equal(actionChat.run('outreachChat.pid'),'3');actionChat.element('helpMonth').value='2026-11';actionChat.run('chooseOutreachMonth()');
 actionChat.element('helpDays').value='14-15';actionChat.run('submitOutreachDays();validateBackup(state)');
 assert.equal(actionChat.run('cell(activeMonth(),"3",14).block'),'OFF');assert.equal(actionChat.run('cell(activeMonth(),"3",15).block'),'OFF');assert.equal(actionChat.run('cell(activeMonth(),"3",14).code'),'');assert.equal(actionChat.run('cell(activeMonth(),"3",14).locked'),false);
 assert.equal(actionChat.run('cell(activeMonth(),"2",14).block'),'');assert.equal(actionChat.run('history.length'),offHistory+1);
 assert.equal(JSON.parse(actionChat.stored()).months['2026-11'].cells['3|14'].block,'OFF');
 actionChat.run('closeModal();undo()');assert.equal(actionChat.run('JSON.stringify(state)'),beforeOff);
 actionChat.run('resetHelpChat();startChatAction("vac")');assert.equal(actionChat.run('outreachChat.step'),'person');
 assert(actionChat.element('helpControls').innerHTML.includes('value="8"'));actionChat.element('helpPerson').value='8';actionChat.run('chooseChatPerson()');assert.equal(actionChat.run('outreachChat.step'),'month');
 actionChat.element('helpMonth').value='2027-02';actionChat.run('chooseOutreachMonth()');assert.equal(actionChat.run('outreachChat.step'),'days');
 actionChat.element('helpDays').value='29';actionChat.run('submitOutreachDays()');assert.equal(actionChat.run('state.months["2027-02"]'),undefined);assert.equal(actionChat.run('JSON.stringify(state)'),beforeOff);
 actionChat.element('helpDays').value='27-28';actionChat.run('submitOutreachDays();validateBackup(state)');
 assert.equal(actionChat.run('state.selected'),'2027-02');assert.equal(actionChat.run('cell(activeMonth(),"8",27).block'),'VAC');assert.equal(actionChat.run('cell(activeMonth(),"8",28).block'),'VAC');
 actionChat.run('closeModal();undo();resetHelpChat()');assert.equal(actionChat.run('JSON.stringify(state)'),beforeOff);assert.equal(actionChat.run('helpMessages[0].text'),'สวัสดีค่ะ วันนี้มีอะไรให้ช่วยคะ');
 actionChat.run('activeMonth().excludedStaffIds=state.people.map(p=>p.id);startChatAction("off")');actionChat.element('helpPerson').value='1';actionChat.run('chooseChatPerson()');
 actionChat.element('helpMonth').value='2026-11';actionChat.run('chooseOutreachMonth()');assert.equal(actionChat.run('outreachChat.step'),'month');assert(actionChat.element('helpMessages').innerHTML.includes('ไม่ได้ลงตาราง'));
 // Monthly selection and the three rates must survive saving and reloading.
 const scoped=boot(null,standalone);
 scoped.run('selectMonth("2026-11");activeMonth().cells["9|1"]={code:"R",block:"",locked:true};activeMonth().cells["1|1"]={code:"M",block:"",locked:false};activeMonth().cells["1|2"]={code:"R",block:"",locked:false};activeMonth().cells["1|3"]={code:"X",block:"",locked:false};staffModal()');
 assert(scoped.element('modalBody').innerHTML.includes('ลงตารางเดือนนี้'));assert(scoped.element('modalBody').innerHTML.includes('เรทรุ่งอรุณ'));
 const roster=scoped.run('JSON.parse(JSON.stringify(state.people))');
 scoped.ctx.document.querySelectorAll=selector=>selector!=='.staff-item'?[]:roster.map(p=>({dataset:{id:p.id},querySelector:selector=>({'.p-name':{value:p.name},'.p-role':{value:p.role},'.p-included':{checked:!['3','9'].includes(p.id)},'.p-rate-card':{value:'500',focus(){}},'.p-rate-dawn':{value:'100',focus(){}}}[selector])}));
 scoped.run('saveStaff();validateBackup(state)');
 assert.equal(scoped.run('JSON.stringify(activeMonth().excludedStaffIds)'),'["3","9"]');
 assert(!scoped.element('scheduleTable').innerHTML.includes('data-quota-id="9"'));assert(!scoped.element('summaryTable').innerHTML.includes(roster[8].name));
 assert(scoped.element('summaryTable').innerHTML.includes('700 ฿'));
 assert.equal(scoped.run('cell(activeMonth(),"9",1).code'),'R');assert.equal(scoped.run('totals(state,state.selected)[8].total'),0);
 scoped.run('paintFocus={i:1,d:1};focusPaint(2,1)');assert.equal(scoped.run('paintFocus.i'),3);
 const reloaded=boot(JSON.parse(scoped.stored()),standalone);
 assert.equal(reloaded.run('JSON.stringify(activeMonth().excludedStaffIds)'),'["3","9"]');assert.equal(reloaded.run('payRate(state,"1","dawn")'),100);
 reloaded.run('activeMonth().categoryQuotas={"9":{card:2,dawn:1}};onQuotaChange("1","5","card")');
 assert.equal(reloaded.run('JSON.stringify(activeMonth().categoryQuotas["9"])'),'{"card":2,"dawn":1}');
 reloaded.run('selectMonth("2026-12")');assert.equal(reloaded.run('monthPeople(state,state.selected).length'),9);
 reloaded.run('selectMonth("2026-11");activeMonth().excludedStaffIds=[];changed()');
 assert(reloaded.element('scheduleTable').innerHTML.includes('data-quota-id="9"'));assert.equal(reloaded.run('cell(activeMonth(),"9",1).code'),'R');
 reloaded.run('activeMonth().excludedStaffIds=["3"];activeMonth().quotas={"2":1,"3":2,"4":1};render();activeMonth().excludedStaffIds=[];render()');
 assert(reloaded.run('audit(state,state.selected).issues.some(i=>i.type==="quota")'));
 scoped.run('undo()');assert.equal(scoped.run('monthPeople(state,state.selected).length'),9);assert.equal(scoped.run('payRate(state,"1","dawn")'),60);
 assert.throws(()=>scoped.run('var bad=clone(state);bad.months[bad.selected].excludedStaffIds=["unknown"];validateBackup(bad)'));
 assert.throws(()=>scoped.run('var bad=clone(state);bad.payRates["1"]={card:500,dawn:-1,outreach:75};validateBackup(bad)'));
 assert.throws(()=>scoped.run('var bad=clone(state);bad.payRates["1"]={card:500,dawn:100.123,outreach:75};validateBackup(bad)'));
}
console.log('PASS: source and standalone start blank, migrate only untouched October sample, preserve other months and edits, support undo');
console.log('PASS: outreach chat month/date flow, invalid and escaped input, automatic date markers, persistence, no-op resubmission and one-step undo');
for(const standalone of [false,true]){
 const live=boot(null,standalone);
 live.run(`selectMonth('2026-11');
 for(const [day,value] of [[1,'N'],[2,'M'],[4,'A'],[6,'R'],[8,'X'],[9,'OFF'],[10,'VAC']]){
  const next=manualRange(state,state.selected,'1',day,day,value);if(!next.ok)throw Error(next.message);state.months[state.selected]=next.month;
 }changed()`);
 const info=category=>JSON.parse(live.run('JSON.stringify(categoryCountInfo(state,state.selected,"1","'+category+'"))'));
 assert.equal(info('card').value,3);assert.equal(info('dawn').value,2);
 assert.equal(info('card').status,'auto');assert.equal(info('dawn').hint,'');
 assert.equal(live.run('personCategoryTotal(state,state.selected,"1")'),5);
 assert.equal(live.run('activeMonth().categoryQuotas'),undefined,'live counts are not saved as goals');
 assert.equal(live.run('PAINT_TOOLS.find(t=>t[0]==="R")[1]'),'หน้าตู้KIOS');
 assert.equal(live.run('META.R.name'),'หน้าตู้KIOS');
 assert(live.run('CHAT_ACTIONS.find(a=>a.id==="dawn").label').includes('หน้าตู้KIOS'));
 for(const table of ['scheduleTable','summaryTable']){
  const html=live.element(table).innerHTML;
  assert(/data-quota-id="1" data-quota-category="card" value="3"/.test(html));
  assert(/data-quota-id="1" data-quota-category="dawn" value="2"/.test(html));
 }
 live.run('state.months[state.selected]=manualRange(state,state.selected,"1",1,1,"").month;changed()');
 assert.equal(info('card').value,2);assert.equal(live.run('personCategoryTotal(state,state.selected,"1")'),4);
 live.run('onQuotaChange("1","5","card");onQuotaChange("1","3","dawn")');
 assert.equal(info('card').value,5);assert.equal(info('card').hint,'ขาด 3');
 assert.equal(info('dawn').hint,'ขาด 1');assert.equal(live.run('personCategoryTotal(state,state.selected,"1")'),8);
 const hints=['card','dawn'].map(category=>({dataset:{quotaStatus:'1',category},textContent:''}));
 live.ctx.document.querySelectorAll=selector=>selector==='[data-quota-status]'?hints:[];
 live.run('onQuotaInput({value:"1"},"1","card")');
 assert(hints.every(h=>h.textContent===''),'no missing/excess/complete status is rendered');assert(!live.element('scheduleTable').innerHTML.includes('quota-status'));
 assert.equal(info('card').target,5,'input preview is not a saved goal');
 live.run('onQuotaChange("1","1","card")');assert.equal(info('card').hint,'เกิน 1');
 const unchanged=live.run('JSON.stringify(state)');
 assert.equal(live.run('solve(state,state.selected).reason'),'fixed','locked shifts above the target must be rejected');
 assert.equal(live.run('JSON.stringify(state)'),unchanged);
 live.run('onQuotaChange("1","","card")');
 assert.equal(info('card').target,undefined);assert.equal(info('card').value,2);assert.equal(info('card').hint,'');
 live.run('onQuotaChange("1","","dawn");validateBackup(state)');
 assert.equal(info('dawn').value,2);assert.equal(live.run('activeMonth().categoryQuotas["1"]'),undefined);
 live.run('undo()');assert.equal(info('dawn').target,3);
 const restored=boot(JSON.parse(live.stored()),standalone);
 assert.equal(restored.run('categoryCountInfo(state,state.selected,"1","card").value'),2);
 assert.equal(restored.run('categoryCountInfo(state,state.selected,"1","dawn").hint'),'ขาด 1');
 assert.throws(()=>live.run('var bad=clone(state);activeMonth();bad.months[bad.selected].autoFillStaffIds=["unknown"];validateBackup(bad)'));
 // A person with manually placed shifts can ask the solver to fill to a goal.
 const fill=boot(null,standalone);
 fill.run(`selectMonth('2026-11');state.pairExclusions=[];for(const day of [7,15])activeMonth().days[day].need.X=1;
 for(const [day,value] of [[1,'N'],[2,'OFF'],[3,'VAC']])state.months[state.selected]=manualRange(state,state.selected,'1',day,day,value).month;
 onQuotaChange('1','5','card');onQuotaChange('1','3','dawn');
 var filled=solve(state,state.selected,{distribution:true,ms:10000});if(!filled.ok)throw Error(filled.message);checkpoint();state.months[state.selected]=filled.month;changed()`);
 assert.equal(fill.run('audit(state,state.selected).complete'),true);
 assert.equal(fill.run('categoryCountInfo(state,state.selected,"1","card").hint'),'ครบ');
 assert.equal(fill.run('categoryCountInfo(state,state.selected,"1","dawn").hint'),'ครบ');
 assert.equal(fill.run('cell(activeMonth(),"1",1).code'),'N');assert.equal(fill.run('cell(activeMonth(),"1",1).locked'),true);
 assert.equal(fill.run('cell(activeMonth(),"1",2).block'),'OFF');assert.equal(fill.run('cell(activeMonth(),"1",3).block'),'VAC');
 assert.equal(fill.run('totals(state,state.selected)[0].total'),8);
 fill.run('undo()');assert.equal(fill.run('categoryCountInfo(state,state.selected,"1","dawn").hint'),'ขาด 3');
 // Solving with blank goals must leave the fields in live-count mode afterwards.
 fill.run('state.months[state.selected]=freshMonth(state.selected);normalizeCalendarState(state);var automatic=solve(state,state.selected,{distribution:true});if(!automatic.ok)throw Error(automatic.message);state.months[state.selected]=automatic.month;changed()');
 assert.equal(fill.run('Object.keys(activeMonth().categoryQuotas).length'),0);
 assert.equal(fill.run('Object.keys(activeMonth().quotas).length'),0);
 assert.equal(fill.run('categoryCountInfo(state,state.selected,"1","dawn").status'),'auto');
 const dawnBefore=fill.run('categoryCountInfo(state,state.selected,"1","dawn").value');
 fill.run('var manualDay=Object.keys(activeMonth().days).find(d=>!cell(activeMonth(),"1",d).code);activeMonth().cells["1|"+manualDay]={code:"X",block:"",locked:true};changed()');
 assert.equal(fill.run('categoryCountInfo(state,state.selected,"1","dawn").value'),dawnBefore+1);
}
console.log('PASS: live per-category counts, combined dawn, editable targets, live deficit/excess, clearing, persistence, undo, KIOS labels and filling around locked shifts');
for(const standalone of [false,true]){
 const oldSettings=JSON.parse(run('JSON.stringify(SEED)'));oldSettings.people.find(p=>p.id==='9').allowed=['N','M','A','R','X'];
 const restricted=boot(oldSettings,standalone);
 assert.equal(restricted.run('JSON.stringify(state.people.find(p=>p.id==="9").allowed)'),'["X"]');
 assert.deepEqual(JSON.parse(restricted.stored()).people.find(p=>p.id==='9').allowed,['X']);
 restricted.run('selectMonth("2026-11");cellModal(8,5)');
 const options=restricted.element('modalBody').innerHTML;
 for(const value of ['N','M','A','R','OFF','VAC'])assert(!options.includes('data-choice="'+value+'"'));
 assert(options.includes('data-choice="X"'));assert(options.includes('data-choice=""'));
 const before=restricted.run('JSON.stringify(state)');
 restricted.run('choice="R";saveCell()');assert.equal(restricted.run('JSON.stringify(state)'),before);
 restricted.run('choice="X";saveCell()');assert.equal(restricted.run('cell(activeMonth(),"9",5).code'),'X');
 const beforeQuota=restricted.run('JSON.stringify(state)');restricted.run('onQuotaChange("9","1","card")');
 assert.equal(restricted.run('JSON.stringify(state)'),beforeQuota);
 for(const action of ['off','vac']){
  restricted.run('resetHelpChat();startChatAction("'+action+'")');
  assert(!restricted.element('helpControls').innerHTML.includes('value="9"'));
  restricted.element('helpPerson').value='9';restricted.run('chooseChatPerson()');
  assert.equal(restricted.run('outreachChat.step'),'person');
  assert(restricted.element('helpMessages').innerHTML.includes('ร สีแดง'));
  assert.throws(()=>restricted.run('leaveMonthWithDays(state,state.selected,"9",[5],"'+(action==='off'?'OFF':'VAC')+'")'));
 }
 restricted.run('editing={importState:clone(state)};editing.importState.people.find(p=>p.id==="9").allowed=[...CODES];confirmImport()');
 assert.equal(restricted.run('JSON.stringify(state.people.find(p=>p.id==="9").allowed)'),'["X"]');
}
console.log('PASS: X-only person 9 in source/standalone, legacy settings/import, cell menu, rejected bypasses, card goals and OFF/VAC chat');
for(const standalone of [false,true]){
 const cancel=boot(null,standalone);
 cancel.run('selectMonth("2026-11");state.months[state.selected]=shiftMonthWithDays(state,state.selected,[3,5,6],"X");activeMonth().autoCapacity=Object.fromEntries(Object.entries(activeMonth().days).map(([d,day])=>[d,clone(day.need)]));activeMonth().autoCapacity[3].X=2;activeMonth().cells={"1|3":{code:"X",block:"",locked:true},"2|5":{code:"X",block:"",locked:false},"9|6":{code:"X",block:"",locked:true},"4|5":{code:"R",block:"",locked:true}};changed();helpModal()');
 const before=cancel.run('JSON.stringify(state)'),history=cancel.run('history.length');
 assert(cancel.element('helpControls').innerHTML.includes('data-chat-operation="remove"'));
 cancel.run('setChatOperation("remove");startChatAction("outreach")');
 assert.equal(cancel.run('outreachChat.step'),'month');cancel.element('helpMonth').value='2026-11';cancel.run('chooseOutreachMonth()');
 assert(cancel.element('helpControls').innerHTML.includes('ยกเลิกวันที่เลือก'));assert(cancel.element('helpControls').innerHTML.includes('รวมช่องที่ล็อกไว้'));
 cancel.element('helpDays').value='3,31';cancel.run('submitOutreachDays()');assert.equal(cancel.run('JSON.stringify(state)'),before);assert.equal(cancel.run('history.length'),history);
 cancel.element('helpDays').value='3,5-6';cancel.run('submitOutreachDays()');
 for(const d of [3,5,6]){assert.equal(cancel.run('activeMonth().days['+d+'].need.X'),0);assert.equal(cancel.run('activeMonth().autoCapacity?.['+d+']?.X'),undefined)}
 assert.equal(cancel.run('Object.values(activeMonth().cells).some(c=>c.code==="X")'),false);assert.equal(cancel.run('cell(activeMonth(),"4",5).code'),'R');
 assert.equal((cancel.element('scheduleTable').innerHTML.match(/class="outreach-day"/g)||[]).length,0);
 assert.equal(cancel.run('history.length'),history+1);assert.equal(JSON.parse(cancel.stored()).months['2026-11'].days[3].need.X,0);
 assert(cancel.element('helpMessages').innerHTML.includes('ยกเลิกวันออก รพ.สต.'));cancel.run('submitOutreachDays()');assert.equal(cancel.run('history.length'),history+1);
 cancel.run('setChatOperation("remove");startChatAction("outreach")');cancel.element('helpMonth').value='2026-11';cancel.run('chooseOutreachMonth()');cancel.element('helpDays').value='3,5-6';cancel.run('submitOutreachDays()');
 assert(cancel.element('helpMessages').innerHTML.includes('ไม่มีรายการ'));assert.equal(cancel.run('history.length'),history+1);
 cancel.run('undo()');assert.equal(cancel.run('JSON.stringify(state)'),before);
 cancel.run('setChatOperation("remove");startChatAction("dawn");cancelChatEntry()');
 assert.equal(cancel.run('outreachChat.step'),'idle');assert.equal(cancel.run('JSON.stringify(state)'),before);assert.equal(cancel.run('history.length'),history);
 cancel.run('activeMonth().cells["4|2"]={code:"R",block:"",locked:true};activeMonth().cells["9|2"]={code:"X",block:"",locked:true};activeMonth().days[2].need.X=1;changed();startChatAction("dawn")');
 cancel.element('helpMonth').value='2026-11';cancel.run('chooseOutreachMonth()');cancel.element('helpDays').value='2';cancel.run('submitOutreachDays()');
 assert.equal(cancel.run('activeMonth().days[2].need.R'),0);assert.equal(cancel.run('activeMonth().autoCapacity?.[2]?.R'),undefined);
 assert.equal(cancel.run('cell(activeMonth(),"4",2).code'),'');assert.equal(cancel.run('cell(activeMonth(),"9",2).code'),'X');
 cancel.run('activeMonth().cells["3|10"]={code:"",block:"OFF",locked:false};activeMonth().cells["3|11"]={code:"",block:"VAC",locked:false};activeMonth().cells["2|10"]={code:"",block:"OFF",locked:false};changed();startChatAction("off")');
 assert.equal(cancel.run('outreachChat.step'),'person');cancel.element('helpPerson').value='3';cancel.run('chooseChatPerson()');
 assert(cancel.element('helpMessages').innerHTML.includes('ยกเลิก OFF เดือนอะไรคะ'));
 cancel.element('helpMonth').value='2026-11';cancel.run('chooseOutreachMonth()');cancel.element('helpDays').value='10-11';cancel.run('submitOutreachDays()');
 assert.equal(cancel.run('cell(activeMonth(),"3",10).block'),'');assert.equal(cancel.run('cell(activeMonth(),"3",11).block'),'VAC');assert.equal(cancel.run('cell(activeMonth(),"2",10).block'),'OFF');
 cancel.run('startChatAction("vac")');cancel.element('helpPerson').value='3';cancel.run('chooseChatPerson()');cancel.element('helpMonth').value='2026-11';cancel.run('chooseOutreachMonth()');cancel.element('helpDays').value='11';cancel.run('submitOutreachDays()');assert.equal(cancel.run('cell(activeMonth(),"3",11).block'),'');
 const noMonthBefore=cancel.run('JSON.stringify(state)'),noMonthHistory=cancel.run('history.length');
 cancel.run('startChatAction("outreach")');cancel.element('helpMonth').value='2027-06';cancel.run('chooseOutreachMonth()');cancel.element('helpDays').value='1';cancel.run('submitOutreachDays()');
 assert.equal(cancel.run('JSON.stringify(state)'),noMonthBefore);assert.equal(cancel.run('history.length'),noMonthHistory);
 const reloaded=boot(JSON.parse(cancel.stored()),standalone);assert.equal(reloaded.run('activeMonth().days[2].need.R'),0);assert.equal(reloaded.run('cell(activeMonth(),"3",11).block'),'');
}
console.log('PASS: add/cancel modes, date ranges, individual absence cancellation, cached capacity/locked cells, invalid/no-op/missing-month handling, pending-form cancel, persistence and one-step undo in source/standalone');
for(const standalone of [false,true]){
 const rates=boot(null,standalone),defaults=[60,50,50,50,80,80,80,50,80];
 assert.deepEqual(JSON.parse(rates.run('JSON.stringify(state.people.map(p=>payRate(state,p.id,"dawn")))')),defaults);
 rates.run('staffModal()');const form=rates.element('modalBody').innerHTML;
 assert.equal((form.match(/class="p-rate-dawn"/g)||[]).length,9);assert.equal((form.match(/class="p-rate-card p-rate"/g)||[]).length,9);
 assert(!form.includes('p-rate-outreach'));assert(!rates.element('summaryTable').innerHTML.includes('<th>เรทรุ่งอรุณ (รพ.สต.)</th>'));
 const people=JSON.parse(rates.run('JSON.stringify(state.people)')),savedRates=JSON.parse(rates.run('JSON.stringify(state.payRates)'));
 rates.ctx.document.querySelectorAll=selector=>selector!=='.staff-item'?[]:people.map(p=>({dataset:{id:p.id},querySelector:selector=>({'.p-name':{value:p.name},'.p-role':{value:p.role},'.p-included':{checked:true},'.p-rate-card':{value:String(savedRates[p.id].card),focus(){}},'.p-rate-dawn':{value:p.id==='1'?'75.50':String(savedRates[p.id].dawn),focus(){}}}[selector])}));
 rates.run('saveStaff();activeMonth().cells={"1|2":{code:"R",block:"",locked:false},"1|3":{code:"X",block:"",locked:false}};changed();var rateModel=exportModel(state,state.selected)');
 assert.equal(rates.run('JSON.stringify(state.payRates["1"])'),'{"card":520,"dawn":75.5}');
 assert.equal(rates.run('payRate(state,"1","outreach")'),75.5);assert.equal(rates.run('totalPay(state,totals(state,state.selected)[0])'),151);
 assert.equal(rates.run('rateModel.cells.AL10.v'),151);assert.equal(rates.run('rateModel.cells.AL10.f'),'ROUND(AI10*AM10+AJ10*AN10,2)');
 const reloaded=boot(JSON.parse(rates.stored()),standalone);assert.equal(reloaded.run('payRate(state,"1","dawn")'),75.5);
 reloaded.run('editing={importState:clone(state)};for(const p of editing.importState.people)editing.importState.payRates[p.id]={card:payRate(state,p.id),dawn:payRate(state,p.id),outreach:payRate(state,p.id)};editing.importState.payRates["1"]={card:520,dawn:65,outreach:90};validateBackup(editing.importState);confirmImport()');
 assert.equal(reloaded.run('JSON.stringify(state.payRates["1"])'),'{"card":520,"dawn":65}');
 assert.equal(reloaded.run('payRate(state,"1","outreach")'),65);assert.equal(reloaded.run('payRate(state,"2","dawn")'),50);assert.equal(reloaded.run('payRate(state,"9","dawn")'),80);
 reloaded.run('undo()');assert.equal(reloaded.run('payRate(state,"1","dawn")'),75.5);
}
console.log('PASS: role-based dawn defaults, exactly two rate fields, unified red/blue pay, editable cents, Excel parity, persistence, old-form import and undo in source/standalone');
for(const standalone of [false,true]){
 const total=boot(null,standalone);
 total.run('selectMonth("2026-11");activeMonth().cells={"1|1":{code:"M",block:"",locked:false},"1|2":{code:"R",block:"",locked:false},"1|3":{code:"X",block:"",locked:false}};onQuotaChange("1","2","card");onQuotaChange("1","3","dawn")');
 const inputs=['schedule','summary'].map(()=>({dataset:{quotaId:'1',quotaCategory:'total',personTotal:'1'},value:'5'})),statuses=inputs.map(()=>({dataset:{quotaStatus:'1',category:'total'},textContent:''}));
 total.ctx.document.querySelectorAll=selector=>selector==='[data-quota-id]'||selector==='[data-person-total]'?inputs:selector==='[data-quota-status]'?statuses:[];
 total.ctx.totalInput=inputs[0];inputs[0].value='8';total.run('onQuotaInput(totalInput,"1","total")');
 assert.equal(inputs[0].value,'8');assert.equal(String(inputs[1].value),'8');assert(!total.element('categoryTotals').innerHTML.includes('quotaTotal'));assert(statuses.every(status=>status.textContent===''));
 assert.equal(total.run('activeMonth().quotas["1"]'),undefined,'preview cannot commit a goal');
 inputs[0].value='';total.run('onQuotaInput(totalInput,"1","total")');assert.equal(inputs[0].value,'');assert.equal(String(inputs[1].value),'5');
 total.run('onQuotaChange("1","8","total")');assert.equal(total.run('activeMonth().categoryQuotas["1"]'),undefined);assert.equal(total.run('activeMonth().quotas["1"]'),8);
 assert.equal(total.run('categoryCountInfo(state,state.selected,"1","total").hint'),'ขาด 5');
 const before=total.run('JSON.stringify(state)'),history=total.run('history.length');for(const invalid of ['31','-1','1.5'])total.run('onQuotaChange("1","'+invalid+'","total")');assert.equal(total.run('JSON.stringify(state)'),before);assert.equal(total.run('history.length'),history);
 total.run('onQuotaChange("1","","total")');assert.equal(total.run('categoryCountInfo(state,state.selected,"1","total").value'),3);assert.equal(total.run('categoryCountInfo(state,state.selected,"1","total").status'),'auto');
 total.run('undo()');assert.equal(total.run('activeMonth().quotas["1"]'),8);total.run('undo()');assert.equal(total.run('JSON.stringify(activeMonth().categoryQuotas["1"])'),'{"card":2,"dawn":3}');
}
console.log('PASS: editable total fields, synchronized previews and hints, clearable input, replace-category semantics, range validation and undo in source/standalone');
for(const standalone of [false,true]){
 const dawn=boot(null,standalone);
 assert.equal(dawn.run('dawnShareInfo(state,state.selected).count'),8,'red-only worker is excluded when no red dates are open');
 dawn.run('for(const d of [2,5,6,7,8,9,12,13,14])activeMonth().days[d].need.X=1;changed();dawnPlanModal()');
 assert(dawn.element('categoryTotals').innerHTML.includes('เปิด 31 เวร · เฉลี่ย 3–4 / คน'));
 assert.equal(dawn.element('modalTitle').textContent,'สัดส่วนเวรรุ่งอรุณ');assert(dawn.element('modalBody').innerHTML.includes('31 ÷ 9'));
 assert(dawn.element('modalBody').innerHTML.includes('หน้าตู้KIOS 22 + รพ.สต. 9'));
 assert.equal((dawn.element('modalBody').innerHTML.match(/<tr><td>/g)||[]).length,9);
 assert.equal(dawn.run('var share=dawnShareInfo(state,state.selected).plan;Object.values(share.preferredR).reduce((a,b)=>a+b,0)+Object.values(share.preferredX).reduce((a,b)=>a+b,0)'),31);
 dawn.run('closeModal();state.people[0].name="<img onerror=alert(1)>";dawnPlanModal()');assert(dawn.element('modalBody').innerHTML.includes('&lt;img onerror=alert(1)&gt;'));
 dawn.run('closeModal();activeMonth().excludedStaffIds=state.people.map(p=>p.id);changed();dawnPlanModal()');assert(!dawn.element('modalBody').innerHTML.includes('÷ 0'));
}
console.log('PASS: combined early demand, per-person recommendations, eligible divisor, escaped names and empty roster in source/standalone');
for(const standalone of [false,true]){
 const calendar=boot(null,standalone);calendar.run('selectMonth("2026-11")');
 assert(calendar.element('categoryTotals').innerHTML.includes('id="calendarTotal" aria-live="polite">99</strong>'));
 assert(calendar.element('categoryTotals').innerHTML.includes('<span>ลงแล้ว</span>'));assert(!calendar.element('scheduleTable').innerHTML.includes('quota-status'));assert(!calendar.element('summaryTable').innerHTML.includes('quota-status'));
 calendar.run('dayModal(2)');assert(calendar.element('modalBody').innerHTML.includes('readonly aria-readonly="true"'));
 calendar.run('for(const code of CODES)$("need"+code).value=activeMonth().days[2].need[code];$("dayHoliday").checked=true;$("dayNote").value="วันหยุดพิเศษ";holidayPreset(2);saveDay()');
 assert.equal(calendar.run('calendarDemand(state,state.selected).card'),80);assert.equal(calendar.run('activeMonth().days[2].need.M'),2);
 assert(calendar.element('categoryTotals').innerHTML.includes('ห้องบัตร 80 + รุ่งอรุณ 21'));
 calendar.run('calendarDemandModal()');assert(calendar.element('modalBody').innerHTML.includes('ห้องบัตรทั้งหมด 80'));assert(calendar.element('modalBody').innerHTML.includes('รุ่งอรุณทั้งหมด'));
 const reloaded=boot(JSON.parse(calendar.stored()),standalone);assert.equal(reloaded.run('calendarDemand(state,state.selected).card'),80);
 calendar.run('closeModal();undo()');assert.equal(calendar.run('calendarDemand(state,state.selected).card'),78);
 calendar.run('cellModal(8,2);choice="X";$("lockCell").checked=false;saveCell()');assert.equal(calendar.run('activeMonth().days[2].need.X'),1,'manual outreach opens its date even when the person can be reassigned');
 assert.equal(calendar.run('calendarDemand(state,state.selected).card'),78);assert.equal(calendar.run('calendarDemand(state,state.selected).dawn'),22);
 calendar.run('activeMonth().cells["1|3"]={code:"",block:"OFF",locked:false};activeMonth().cells["3|4"]={code:"",block:"VAC",locked:false};changed()');assert.equal(calendar.run('calendarDemand(state,state.selected).card'),78);
 calendar.run('onQuotaInput({value:"20"},"1","card")');assert.equal(calendar.element('categoryTotal-card').textContent,0,'typed targets do not inflate the assigned box');
 calendar.run('checkpoint();for(const[d,day]of Object.entries(activeMonth().days))day.need.X=+d<=14?1:0;changed()');
 assert(calendar.element('categoryTotals').innerHTML.includes('id="calendarTotal" aria-live="polite">113</strong>'),'78 card + 21 KIOS + 14 outreach = 113 total shifts');
 assert(calendar.element('categoryTotals').innerHTML.includes('ห้องบัตร 78 + รุ่งอรุณ 35'));
 calendar.run('calendarDemandModal()');assert(calendar.element('modalBody').innerHTML.includes('เวรทั้งหมด 113 เวร'));assert(calendar.element('modalBody').innerHTML.includes('หน้าตู้KIOS 21 + รพ.สต. 14'));
 const combinedReload=boot(JSON.parse(calendar.stored()),standalone);assert(combinedReload.element('categoryTotals').innerHTML.includes('id="calendarTotal" aria-live="polite">113</strong>'));
 calendar.run('closeModal();undo()');assert(calendar.element('categoryTotals').innerHTML.includes('id="calendarTotal" aria-live="polite">100</strong>'));
}
console.log('PASS: calendar header, assigned-only green box, removed statuses, special-holiday update/undo/persistence, manual outreach and unchanged demand for personal leave');
(async()=>{
 for(const standalone of [false,true]){
  const reset=boot(null,standalone);
  const clickAuto=async(options='')=>{reset.run('var pendingReset=autoSchedule('+options+')');reset.flushTimers();await reset.run('pendingReset')};
  reset.run('selectMonth("2026-11");for(let d=1;d<=14;d++)activeMonth().days[d].need.X=1;activeMonth().cells={"9|2":{code:"X",block:"",locked:true},"3|3":{code:"",block:"OFF",locked:false},"4|4":{code:"",block:"VAC",locked:false}};for(const p of state.people)setTotalTarget(state,p.id,"0");changed()');
  const zeroState=reset.run('JSON.stringify(state)'),days=reset.run('JSON.stringify(activeMonth().days)'),otherMonth=reset.run('JSON.stringify(state.months["2026-10"])');
  await clickAuto();assert.equal(reset.run('JSON.stringify(state)'),zeroState);assert(reset.element('modalFoot').innerHTML.includes('ล้างเป้ารายคน แล้วจัดใหม่'));
  assert(reset.element('modalBody').innerHTML.includes('เลข 0 ที่กรอกเป็นเป้า'));
  const history=reset.run('history.length');await clickAuto('{resetTargets:true}');
  assert.equal(reset.run('scheduleAudit().complete'),true);assert.equal(reset.run('totals(state,state.selected).reduce((sum,t)=>sum+t.total,0)'),113);
  assert.equal(reset.run('JSON.stringify(activeMonth().quotas)'),'{}');assert.equal(reset.run('JSON.stringify(activeMonth().categoryQuotas)'),'{}');
  assert.equal(reset.run('JSON.stringify(activeMonth().days)'),days);assert.equal(reset.run('JSON.stringify(state.months["2026-10"])'),otherMonth);
  assert.equal(reset.run('cell(activeMonth(),"9",2).locked'),true);assert.equal(reset.run('cell(activeMonth(),"3",3).block'),'OFF');assert.equal(reset.run('cell(activeMonth(),"4",4).block'),'VAC');
  assert.equal(reset.run('history.length'),history+1);reset.run('undo()');assert.equal(reset.run('JSON.stringify(state)'),zeroState,'clear targets and replan is one undoable operation');
  const dirty={dataset:{quotaId:'1',quotaCategory:'total',quotaEdited:'true'},value:'0'};reset.ctx.document.querySelectorAll=selector=>selector==='[data-quota-id]'?[dirty]:[];
  reset.run('clearModal()');assert(reset.element('modalBody').innerHTML.includes('id="keepTargets"'));assert(!reset.element('modalBody').innerHTML.includes('checked'));
  reset.run('clearMonth(false)');assert.equal(dirty.dataset.quotaEdited,'false');assert.equal(reset.run('JSON.stringify(activeMonth().quotas)'),'{}');assert.equal(reset.run('cell(activeMonth(),"9",2).code'),'');
  assert.equal(reset.run('cell(activeMonth(),"3",3).block'),'OFF');assert.equal(reset.run('cell(activeMonth(),"4",4).block'),'VAC');assert.equal(reset.run('JSON.stringify(activeMonth().days)'),days);
  const reloaded=boot(JSON.parse(reset.stored()),standalone);assert.equal(reloaded.run('JSON.stringify(activeMonth().quotas)'),'{}');
  await clickAuto();assert.equal(reset.run('scheduleAudit().complete'),true);assert.equal(reset.run('totals(state,state.selected).reduce((sum,t)=>sum+t.total,0)'),113);
  // Clearing everything also resets category/legacy targets, but preserves other
  // months, holidays and opened dawn dates. Keeping targets remains an explicit option.
  reset.ctx.document.querySelectorAll=()=>[];
  reset.run('for(const p of state.people)for(const g of SHIFT_GROUPS)setCategoryTarget(state,p.id,g.id,"0");state.quotas={"1":0};delete activeMonth().quotas;activeMonth().days[2].holiday=true;changed()');
  const categories=reset.run('JSON.stringify(activeMonth().categoryQuotas)'),beforeClear=reset.run('JSON.stringify(state)');
  reset.run('clearMonth(true,true)');assert.equal(reset.run('JSON.stringify(activeMonth().categoryQuotas)'),categories);reset.run('undo()');assert.equal(reset.run('JSON.stringify(state)'),beforeClear);
  reset.run('clearMonth(true)');assert.equal(reset.run('Object.keys(activeMonth().cells).length'),0);assert.equal(reset.run('JSON.stringify(activeMonth().quotas)'),'{}');assert.equal(reset.run('JSON.stringify(activeMonth().categoryQuotas)'),'{}');assert.equal(reset.run('JSON.stringify(state.quotas)'),'{"1":0}');assert.equal(reset.run('activeMonth().days[2].holiday'),true);
  await clickAuto();assert.equal(reset.run('scheduleAudit().complete'),true);assert.equal(reset.run('totals(state,state.selected).reduce((sum,t)=>sum+t.total,0)'),115);
  reset.run('setTotalTarget(state,"6","0");changed()');await clickAuto();assert.equal(reset.run('totals(state,state.selected)[5].total'),0,'an individual zero remains an exact target during normal scheduling');
  reset.run('for(const p of state.people)if(p.id!=="9")activeMonth().cells[p.id+"|1"]={code:"",block:"OFF",locked:false};changed()');
  const impossible=reset.run('JSON.stringify(state)'),beforeHistory=reset.run('history.length');await clickAuto('{resetTargets:true}');assert.equal(reset.run('JSON.stringify(state)'),impossible,'failure while resetting targets is atomic');assert.equal(reset.run('history.length'),beforeHistory);
 }
 console.log('PASS: clear zero targets and replan 113 shifts, optional target retention, legacy shadowing, pending input, preserved days/leave/locks, persistence, one-step undo, explicit zero and atomic failure in source/standalone');
 for(const standalone of [false,true]){
  const distributed=boot(null,standalone);
  distributed.run('selectMonth("2026-10");var pendingDistribution=autoSchedule()');distributed.flushTimers();await distributed.run('pendingDistribution');
  assert.equal(distributed.run('scheduleAudit().complete'),true);
  assert.equal(distributed.run('totals(state,state.selected).every(t=>t.X===0)'),true);
  distributed.run('closeModal();for(const d of [2,5,6,7,8,9,12,13,14])activeMonth().days[d].need.X=1;changed();pendingDistribution=autoSchedule()');
  distributed.flushTimers();await distributed.run('pendingDistribution');
  assert.equal(distributed.run('scheduleAudit().complete'),true);
  assert.equal(distributed.run('totals(state,state.selected).every(t=>t.X>=1)'),true);
  assert.equal(distributed.run('totals(state,state.selected).filter(t=>t.id!=="9").every(t=>t.R===2||t.R===3)'),true);
  assert.equal(distributed.run('totals(state,state.selected).find(t=>t.id==="9").R'),0);
  assert.equal(distributed.run('var earnings=totals(state,state.selected).slice(0,8).map(t=>totalPay(state,t));Math.min(...earnings.slice(1,4))>earnings[0]&&earnings[0]>Math.max(...earnings.slice(4,7))&&Math.min(...earnings.slice(4,7))>earnings[7]'),true,'the real button follows the income order');
  assert.equal(distributed.run('var academicLoads=totals(state,state.selected).slice(4,7).map(t=>t.total);Math.max(...academicLoads)-Math.min(...academicLoads)<=1'),true);
  assert(distributed.element('fairnessDetail').innerHTML.includes('ตัวหลัก 2–4 สูงสุด → เวชสถิติ → นวก. → รพีพรรณ'));
  assert(distributed.element('fairnessDetail').innerHTML.includes('22 เวร ÷ 8 คน = คนละ 2–3 เวร'));
  assert.equal(JSON.parse(distributed.stored()).months['2026-10'].distributionRules,true);
  const reloaded=boot(JSON.parse(distributed.stored()),standalone);assert.equal(reloaded.run('scheduleAudit().complete'),true);
  distributed.run('var previousLayout=JSON.stringify(totals(state,state.selected));var previousCodes=state.people.map(p=>Array.from({length:daysIn(state.selected)},(_,d)=>cell(activeMonth(),p.id,d+1).code).join(",")).join("|");pendingDistribution=autoSchedule()');distributed.flushTimers();await distributed.run('pendingDistribution');
  assert.equal(distributed.run('scheduleAudit().complete'),true);
  assert.equal(distributed.run('JSON.stringify(totals(state,state.selected))===previousLayout'),true,'repeat button keeps pay and per-code totals');
  assert.equal(distributed.run('state.people.map(p=>Array.from({length:daysIn(state.selected)},(_,d)=>cell(activeMonth(),p.id,d+1).code).join(",")).join("|")!==previousCodes'),true,'repeat button produces a different layout');
  distributed.run('for(let d=1;d<=20;d++)activeMonth().cells["3|"+d]={code:"",block:d%2?"OFF":"VAC",locked:false};changed();pendingDistribution=autoSchedule()');distributed.flushTimers();await distributed.run('pendingDistribution');
  assert.equal(distributed.run('scheduleAudit().complete'),true);
  assert.equal(distributed.run('JSON.stringify(totals(state,state.selected).filter(t=>["2","3","4"].includes(t.id)).map(t=>t.R))'),'[3,3,3]');
  assert.equal(distributed.run('var cardLoads=totals(state,state.selected).map(t=>categoryTotals(t).card);cardLoads[2]<cardLoads[1]&&cardLoads[2]<cardLoads[3]'),true);
  assert.throws(()=>reloaded.run('var bad=clone(state);bad.months[bad.selected].distributionRules="yes";validateBackup(bad)'));
 }
 console.log('PASS: actual automatic scheduling button enforces both distributions in source/standalone, handles scarce slots, persists rules and shows quotient');
 for(const standalone of [false,true]){
  const revised=boot(null,standalone);
  const clickAuto=async()=>{revised.run('var pendingRevision=autoSchedule()');revised.flushTimers();await revised.run('pendingRevision')};
  revised.run('selectMonth("2026-10");for(const d of [2,5,6,7,8,9,12,13,14])activeMonth().days[d].need.X=1;changed()');await clickAuto();assert.equal(revised.run('scheduleAudit().complete'),true);
  let pending=[{dataset:{quotaId:'9',quotaCategory:'dawn',quotaEdited:'true'},value:'3'}];
  revised.ctx.document.querySelectorAll=selector=>selector==='[data-quota-id]'?pending:[];revised.ctx.editedQuota=pending[0];
  revised.run('onQuotaInput(editedQuota,"9","dawn")');assert.equal(revised.run('activeMonth().categoryQuotas["9"]'),undefined,'still typing, before blur/change');
  await clickAuto();assert.equal(revised.run('cell(activeMonth(),"9",1).code==="R"'),false);assert.equal(revised.run('totals(state,state.selected).find(t=>t.id==="9").X'),3);assert.equal(revised.run('scheduleAudit().complete'),true);
  pending=[{dataset:{quotaId:'1',quotaCategory:'card',quotaEdited:'true'},value:'3'}];await clickAuto();
  assert.equal(revised.run('categoryTotals(totals(state,state.selected)[0]).card'),3);assert.equal(revised.run('totals(state,state.selected).find(t=>t.id==="9").X'),3);
  assert.equal(revised.run('totals(state,state.selected).reduce((sum,t)=>sum+categoryTotals(t).card,0)'),80);
  pending=[{dataset:{quotaId:'9',quotaCategory:'dawn',quotaEdited:'true'},value:'2'},{dataset:{quotaId:'1',quotaCategory:'card',quotaEdited:'true'},value:'5'}];await clickAuto();
  assert.equal(revised.run('categoryTotals(totals(state,state.selected)[0]).card'),5);assert.equal(revised.run('totals(state,state.selected).find(t=>t.id==="9").X'),2);assert.equal(revised.run('scheduleAudit().complete'),true);
  pending=[{dataset:{quotaId:'9',quotaCategory:'dawn',quotaEdited:'true'},value:''}];await clickAuto();assert.equal(revised.run('activeMonth().categoryQuotas["9"]'),undefined);assert.equal(revised.run('totals(state,state.selected).find(t=>t.id==="9").X'),1);
  // The editable total replaces per-category goals and is read before blur as well.
  pending=[{dataset:{quotaId:'1',quotaCategory:'total',quotaEdited:'true'},value:'10'}];await clickAuto();
  assert.equal(revised.run('totals(state,state.selected)[0].total'),10);assert.equal(revised.run('activeMonth().quotas["1"]'),10);assert.equal(revised.run('activeMonth().categoryQuotas["1"]'),undefined);assert.equal(revised.run('categoryCountInfo(state,state.selected,"1","total").hint'),'ครบ');
  pending=[{dataset:{quotaId:'1',quotaCategory:'total',quotaEdited:'true'},value:'0'},{dataset:{quotaId:'9',quotaCategory:'total',quotaEdited:'true'},value:'3'}];await clickAuto();
  assert.equal(revised.run('totals(state,state.selected)[0].total'),10,'conflicting goals cannot replace the existing schedule');assert(revised.element('modalBody').innerHTML.includes('นวก. ไม่เกินตัวหลักทุกคน'));
  pending=[{dataset:{quotaId:'1',quotaCategory:'total',quotaEdited:'true'},value:''}];await clickAuto();
  assert.equal(revised.run('activeMonth().quotas["1"]'),undefined);assert(revised.run('totals(state,state.selected)[0].total')>0);assert.equal(revised.run('totals(state,state.selected)[8].X'),3);assert.equal(revised.run('scheduleAudit().complete'),true);
  const totalReloaded=boot(JSON.parse(revised.stored()),standalone);assert.equal(totalReloaded.run('activeMonth().quotas["9"]'),3);assert.equal(totalReloaded.run('categoryCountInfo(state,state.selected,"9","total").value'),3);
  pending=[{dataset:{quotaId:'9',quotaCategory:'dawn',quotaEdited:'true'},value:'2'}];await clickAuto();assert.equal(revised.run('activeMonth().quotas["9"]'),undefined);assert.equal(revised.run('totals(state,state.selected)[8].X'),2);
  const stable=revised.run('JSON.stringify(state)'),history=revised.run('history.length');pending=[{dataset:{quotaId:'1',quotaCategory:'dawn',quotaEdited:'true'},value:'3.5'}];await clickAuto();
  assert.equal(revised.run('JSON.stringify(state)'),stable);assert.equal(revised.run('history.length'),history);assert.equal(revised.element('modalTitle').textContent,'ตรวจเป้าจำนวนเวรก่อนจัด');
  pending=[];revised.run('closeModal();for(let d=1;d<=29;d++)activeMonth().cells["3|"+d]={code:"",block:"OFF",locked:false};onQuotaChange("3","3","dawn")');
  const impossible=revised.run('JSON.stringify(state)');await clickAuto();assert(revised.element('modalBody').innerHTML.includes('สูงสุด 1'));assert.equal(revised.run('JSON.stringify(state)'),impossible);
 }
 console.log('PASS: real second/third scheduling after uncommitted typed quotas, exact card/dawn targets, changed automatic shares, clearing and atomic invalid/impossible handling in source/standalone');
 for(const standalone of [false,true]){
  const calendar=boot(null,standalone);
  calendar.run('selectMonth("2026-11");for(const d of [2,3,4,5,6,9,10])activeMonth().days[d].holiday=true;for(const d of [2,4,6,10,12,16,18,20,24])activeMonth().cells["9|"+d]={code:"X",block:"",locked:true};activeMonth().cells["1|21"]={code:"",block:"OFF",locked:false};changed();var reference=solve(state,state.selected,{distribution:true,calendar:true});if(!reference.ok)throw Error(reference.message);var desired=totals({...state,months:{[state.selected]:reference.month}},state.selected).map(t=>({id:t.id,...categoryTotals(t)}))');
  const pending=JSON.parse(calendar.run('JSON.stringify(desired)')).flatMap(p=>['card','dawn'].map(category=>({dataset:{quotaId:p.id,quotaCategory:category,quotaEdited:'true'},value:String(p[category])})));
  calendar.ctx.document.querySelectorAll=selector=>selector==='[data-quota-id]'?pending:[];
  calendar.run('var pendingCalendar=autoSchedule()');calendar.flushTimers();await calendar.run('pendingCalendar');
  assert.equal(calendar.run('scheduleAudit().complete'),true);assert.equal(calendar.run('totals(state,state.selected).reduce((sum,t)=>sum+t.total,0)'),122);
  assert(calendar.element('categoryTotals').innerHTML.includes('id="calendarTotal" aria-live="polite">122</strong>'));
  assert.equal(calendar.run('totals(state,state.selected).reduce((sum,t)=>sum+categoryTotals(t).card,0)'),92);assert.equal(calendar.run('totals(state,state.selected).reduce((sum,t)=>sum+categoryTotals(t).dawn,0)'),30);
  assert.equal(calendar.run('cell(activeMonth(),"1",21).block'),'OFF');assert.equal(calendar.run('activeMonth().autoCapacity'),undefined);
 }
 console.log('PASS: real automatic button accepts 122 category targets from special holidays plus manual outreach in source/standalone');
 for(const standalone of [false,true]){
  const dawn=boot(null,standalone);
  dawn.run('selectMonth("2026-11");activeMonth().cells={"2|6":{code:"R",block:"",locked:true}};changed();cellModal(1,7);choice="X";$("lockCell").checked=true');
  const before=dawn.run('JSON.stringify(state)'),history=dawn.run('history.length');
  dawn.run('saveCell()');assert.equal(dawn.run('JSON.stringify(state)'),before);assert.equal(dawn.run('history.length'),history);assert(dawn.element('toast').textContent.includes('รุ่งอรุณติดกัน'));
  dawn.run('closeModal();activeMonth().cells["2|7"]={code:"X",block:"",locked:true};changed();issuesModal()');assert(dawn.element('modalBody').innerHTML.includes('รุ่งอรุณติดกัน'));
  const saved=dawn.run('JSON.stringify(state)');dawn.run('closeModal();var pendingDawn=autoSchedule()');dawn.flushTimers();await dawn.run('pendingDawn');
  assert.equal(dawn.run('JSON.stringify(state)'),saved);assert(dawn.element('modalBody').innerHTML.includes('รุ่งอรุณติดกัน'));
 }
 console.log('PASS: mixed-color dawn rejected in cell editor and saved conflicts reported without overwriting locked data in source/standalone');
 for(const standalone of [false,true]){
  const consecutive=boot(null,standalone);
  consecutive.run('selectMonth("2026-11");activeMonth().cells={"2|1":{code:"N",block:"",locked:true},"2|2":{code:"N",block:"",locked:true}};changed();cellModal(1,3);choice="A";$("lockCell").checked=true');
  const before=consecutive.run('JSON.stringify(state)'),history=consecutive.run('history.length');
  consecutive.run('saveCell()');assert.equal(consecutive.run('JSON.stringify(state)'),before);assert.equal(consecutive.run('history.length'),history);assert(consecutive.element('toast').textContent.includes('ติดกันเกิน 2 วัน'));
  consecutive.run('closeModal();activeMonth().cells["2|3"]={code:"A",block:"",locked:true};changed();issuesModal()');assert(consecutive.element('modalBody').innerHTML.includes('ติดกันเกิน 2 วัน'));
  const saved=consecutive.run('JSON.stringify(state)');consecutive.run('closeModal();var pendingConsecutive=autoSchedule()');consecutive.flushTimers();await consecutive.run('pendingConsecutive');
  assert.equal(consecutive.run('JSON.stringify(state)'),saved);assert(consecutive.element('modalBody').innerHTML.includes('เวรห้องบัตรที่ล็อกไว้ติดกันเกิน 2 วัน'));
  consecutive.run('closeModal();cellModal(1,2);choice="OFF";saveCell()');assert.equal(consecutive.run('cell(activeMonth(),"2",2).block'),'OFF');assert(!consecutive.run('scheduleAudit().issues.some(i=>i.type==="consecutive")'));
 }
 console.log('PASS: third mixed duty rejected atomically in cell editor, stored violations shown, locked automatic failure preserves data, OFF breaks the run in source/standalone');
})().catch(error=>{console.error(error);process.exitCode=1});
