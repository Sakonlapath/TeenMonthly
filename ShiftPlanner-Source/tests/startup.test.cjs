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
run('selectMonth("2026-11");onQuotaChange("3","4")');
assert.equal(run('JSON.stringify(activeMonth().quotas)'),'{"2":4,"3":4,"4":4}');
assert(element('summaryTable').innerHTML.includes('ขาด 4'));
run('onQuotaChange("3","1.5")');assert.equal(run('activeMonth().quotas["3"]'),4);
run('onQuotaInput({value:"15"},"3")');assert.equal(element('quotaTotal').textContent,45);
run('onQuotaChange("3","15");onQuotaChange("1","9");onQuotaChange("5","5");onQuotaChange("6","5");onQuotaChange("7","6");onQuotaChange("8","8")');
assert(element('cards').innerHTML.includes('id="quotaTotal">78</span>'));
const index=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');assert.equal((index.match(/id="autoBtn"/g)||[]).length,1);assert(index.indexOf('id="autoBtn"')>index.indexOf('id="scheduleView"'));
assert(element('scheduleTable').innerHTML.includes('data-quota-id="3"'));
assert(element('scheduleTable').innerHTML.includes('</tbody><tfoot><tr class="coverage">'));
assert(element('scheduleTable').innerHTML.endsWith('</tfoot>'));
assert(element('cards').innerHTML.includes('รวมเวร (จัดแล้ว / เป้า)'));
run('var solved=solve(state,state.selected,{ms:10000});if(!solved.ok)throw Error(solved.message);state.months[state.selected]=solved.month;render()');
assert.equal(run('totals(state,state.selected).reduce((sum,p)=>sum+p.total,0)'),78);
const dailyCells=[...element('scheduleTable').innerHTML.split('<tfoot>')[1].matchAll(/>(\d+)\/(\d+)<\/td>/g)];
assert.equal(dailyCells.length,30);
for(let d=1;d<=30;d++){
 const got=run('state.people.filter(p=>cell(activeMonth(),p.id,'+d+').code).length');
 assert.equal(dailyCells[d-1][1],String(got));assert.equal(dailyCells[d-1][2],String(got));
}
assert(element('scheduleTable').innerHTML.includes('>2/2</td>'));
assert(element('scheduleTable').innerHTML.includes('>3/3</td>'));
run('activeMonth().cells={}');
run('staffModal()');assert(element('modalBody').innerHTML.includes('p-rate'));assert(!element('modalBody').innerHTML.includes('p-prev'));
const staff=run('JSON.parse(JSON.stringify(state.people))');
let badRate=false;
ctx.document.querySelectorAll=selector=>selector!=='.staff-item'?[]:staff.map(p=>({dataset:{id:p.id},querySelector:selector=>({'.p-name':{value:p.name},'.p-role':{value:p.role},'.p-rate':{value:badRate?'oops':'700',focus(){}}}[selector])}));
run('saveStaff()');assert.equal(run('state.payRates["1"]'),700);assert.equal(run('state.people.length'),8);
badRate=true;run('saveStaff()');assert.equal(run('state.payRates["1"]'),700);
run('exportDetailsModal()');assert(element('modalBody').innerHTML.includes('exportOrder'));
run('state.months[state.selected].cells["8|2"]={code:"R",block:"",locked:true};cellModal(0,2);choice="R";saveCell()');
assert.equal(run('cell(activeMonth(),"1",2).code'),'');
run('validateBackup(state)');
console.log('PASS: combined browser script startup, render, shared targets, invalid input, settings and modal pair enforcement');
const legacy=require('./fixtures/legacy-october.json');
for(const standalone of [false,true]){
 const old=JSON.parse(JSON.stringify(legacy));old.months['2026-11']=JSON.parse(run('JSON.stringify(freshMonth("2026-11"))'));
 const migrated=boot(old,standalone);
 assert.equal(migrated.run('Object.keys(state.months["2026-10"].cells).length'),0);
 assert.equal(Object.keys(JSON.parse(migrated.stored()).months['2026-10'].cells).length,0);
 assert.deepEqual(JSON.parse(migrated.run('JSON.stringify(state.months["2026-11"])')),old.months['2026-11']);
 migrated.run('undo()');assert.equal(migrated.run('Object.keys(state.months["2026-10"].cells).length'),129);
 const edited=JSON.parse(JSON.stringify(legacy));edited.months['2026-10'].cells['1|1']={code:'',block:'VAC',locked:false};
 const kept=boot(edited,standalone);
 assert.deepEqual(JSON.parse(kept.run('JSON.stringify(state.months["2026-10"])')),edited.months['2026-10']);
 const fresh=boot(null,standalone);assert.equal(fresh.run('Object.keys(activeMonth().cells).length'),0);
 const beforeHelp=fresh.run('JSON.stringify(state)');
 fresh.run('helpModal();askHelp("start");askHelp("leave")');
 assert.equal(fresh.run('helpMessages.length'),2);assert.equal(fresh.run('helpPending.id'),'start');
 assert(fresh.element('helpMessages').innerHTML.includes('help-typing'));
 assert(fresh.element('helpQuestions').innerHTML.includes('disabled'));
 fresh.flushTimers();assert.equal(fresh.run('helpMessages.length'),3);assert.equal(fresh.run('helpPending'),null);
 assert(!fresh.element('helpMessages').innerHTML.includes('help-typing'));
 fresh.run('closeModal();helpModal()');assert.equal(fresh.run('helpMessages.length'),3);
 fresh.run('askHelp("backup");staffModal()');
 const staffBody=fresh.element('modalBody').innerHTML;fresh.flushTimers();
 assert.equal(fresh.element('modalBody').innerHTML,staffBody);assert(!fresh.element('modal').classList.contains('help-chat-modal'));
 fresh.run('helpModal()');assert.equal(fresh.run('helpMessages.length'),5);
 fresh.run('askHelp("leave");resetHelpChat()');fresh.flushTimers();assert.equal(fresh.run('helpMessages.length'),1);
 fresh.run('askHelp("targets");closeModal()');fresh.flushTimers();assert.equal(fresh.run('helpPending'),null);
 assert.equal(fresh.run('JSON.stringify(state)'),beforeHelp);
}
console.log('PASS: source and standalone start blank, migrate only untouched October sample, preserve other months and edits, support undo');
console.log('PASS: guided help typing, one pending answer, conversation retention, reset, close and modal-switch cancellation without changing schedule data');
