const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const ctx=vm.createContext({console});
for(const file of ['core','data','help-chat'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/'+file+'.js'),'utf8'),ctx);
const run=code=>vm.runInContext(code,ctx);
function parse(text,month='2026-11'){ctx.input=text;ctx.month=month;return JSON.parse(run('JSON.stringify(parseOutreachDays(input,month))'))}
for(const text of ['3, 5-6','6,3,5-6,3','๓, ๕–๖','วันที่ 3 และ 5 ถึง 6','ออก รพ.สต. 3, 5-6 พฤศจิกา','3,5-6 พฤศจิกายน พ.ศ.2569','3,5-6 พ.ย. 2026'])assert.deepEqual(parse(text),[3,5,6],text);
assert.deepEqual(parse('29 ก.พ. 2571','2028-02'),[29]);assert.deepEqual(parse('31 ธันวา','2026-12'),[31]);
for(const text of ['','0','31','32','5-3','3--5','3.5','3/5','abc 3','2026-11-03','3 ธันวา','3 พ.ย. 2570','3 พ.ย. ธ.ค.','<img src=x onerror=alert(1)>','1'.repeat(301)])assert.throws(()=>parse(text),undefined,text);
assert.throws(()=>parse('29','2027-02'));assert.throws(()=>parse('30','2028-02'));assert.throws(()=>parse('1','2026-13'));

run('var s=clone(SEED);s.months["2026-11"]=freshMonth("2026-11");var m=s.months["2026-11"];m.days[10].need.X=2;m.cells["1|5"]={code:"A",block:"",locked:true};m.excludedStaffIds=["9"];m.categoryQuotas={"2":{outreach:0}};m.autoCapacity=Object.fromEntries(Object.entries(m.days).map(([d,day])=>[d,clone(day.need)]));m.autoCapacity[3].X=2;var before=JSON.stringify(s);var updated=outreachMonthWithDays(s,"2026-11",[3,5,6])');
assert.equal(run('JSON.stringify(s)'),run('before'));
assert.equal(run('updated.days[3].need.X'),2);assert.equal(run('updated.autoCapacity[3].X'),2);
assert.equal(run('updated.days[5].need.X'),1);assert.equal(run('updated.autoCapacity[5].X'),1);
assert.equal(run('updated.days[6].need.X'),1);assert.equal(run('updated.days[10].need.X'),2);
assert.equal(run('JSON.stringify(updated.cells)'),run('JSON.stringify(m.cells)'));
assert.equal(run('JSON.stringify(updated.categoryQuotas)'),run('JSON.stringify(m.categoryQuotas)'));
assert.equal(run('JSON.stringify(updated.excludedStaffIds)'),run('JSON.stringify(m.excludedStaffIds)'));
for(let d=1;d<=30;d++)for(const code of ['N','M','A','R'])assert.equal(run('updated.days['+d+'].need.'+code),run('m.days['+d+'].need.'+code));
assert.throws(()=>run('outreachMonthWithDays(s,"2026-11",[3,31])'));assert.equal(run('JSON.stringify(s)'),run('before'));
run('var next=outreachMonthWithDays(s,"2027-02",[1,28])');assert.equal(run('next.days[28].need.X'),1);assert.equal(run('s.months["2027-02"]'),undefined);
// The blue R action opens dates without changing X or assigning a person.
run('m.autoCapacity[1].R=2;var dawnBefore=JSON.stringify(s);var dawn=shiftMonthWithDays(s,"2026-11",[1,7],"R")');
assert.equal(run('dawn.days[1].need.R'),2);assert.equal(run('dawn.autoCapacity[1].R'),2);assert.equal(run('dawn.days[7].need.R'),1);
assert.equal(run('JSON.stringify(dawn.cells)'),run('JSON.stringify(m.cells)'));assert.equal(run('JSON.stringify(s)'),run('dawnBefore'));
for(let d=1;d<=30;d++)assert.equal(run('dawn.days['+d+'].need.X'),run('m.days['+d+'].need.X'));
assert.throws(()=>run('shiftMonthWithDays(s,"2026-11",[1],"N")'));
// OFF/VAC applies to one included person, clears their selected shifts, and is atomic.
run('var leaveBefore=JSON.stringify(s);var off=leaveMonthWithDays(s,"2026-11","1",[3,5,6],"OFF");var vac=leaveMonthWithDays(s,"2026-11","2",[13,14],"VAC")');
assert.equal(run('JSON.stringify(off.cells["1|5"])'),'{"code":"","block":"OFF","locked":false}');
assert.equal(run('off.cells["1|3"].block'),'OFF');assert.equal(run('off.cells["1|6"].block'),'OFF');
assert.equal(run('vac.cells["2|13"].block'),'VAC');assert.equal(run('vac.cells["2|14"].block'),'VAC');
assert.equal(run('JSON.stringify(vac.cells["1|5"])'),run('JSON.stringify(m.cells["1|5"])'));
assert.equal(run('JSON.stringify(off.days)'),run('JSON.stringify(m.days)'));assert.equal(run('JSON.stringify(s)'),run('leaveBefore'));
for(const code of ['OFF','VAC']){
 assert.throws(()=>run('leaveMonthWithDays(s,"2026-11","1",[3,31],"'+code+'")'));
 assert.throws(()=>run('leaveMonthWithDays(s,"2026-11","9",[3],"'+code+'")'));
 assert.throws(()=>run('leaveMonthWithDays(s,"2026-11","missing",[3],"'+code+'")'));
}
assert.equal(run('JSON.stringify(s)'),run('leaveBefore'));
run('var futureLeave=leaveMonthWithDays(s,"2028-02","3",[29],"VAC")');assert.equal(run('futureLeave.cells["3|29"].block'),'VAC');assert.equal(run('s.months["2028-02"]'),undefined);
console.log('PASS: date lists/ranges, Thai numerals/months/years, invalid dates, cached capacity, retained shifts/targets and atomic month creation');
// Cancel an opened date and every matching shift, including locks and omitted staff.
run('var cancelState=clone(s);var cm=cancelState.months["2026-11"];cm.days[3].need.X=2;cm.days[5].need.X=1;cm.days[6].need.X=1;cm.autoCapacity[3].X=3;cm.cells["2|3"]={code:"X",block:"",locked:true};cm.cells["9|3"]={code:"X",block:"",locked:true};cm.cells["3|5"]={code:"X",block:"OFF",locked:true};cm.cells["4|6"]={code:"R",block:"",locked:true};cm.cells["5|10"]={code:"X",block:"",locked:true};var cancelBefore=JSON.stringify(cancelState);var canceled=cancelMonthDays(cancelState,"2026-11",[3,5,6],"X")');
assert.equal(run('JSON.stringify(cancelState)'),run('cancelBefore'));
for(const d of [3,5,6]){assert.equal(run('canceled.days['+d+'].need.X'),0);assert.equal(run('canceled.autoCapacity['+d+'].X'),0)}
assert.equal(run('canceled.cells["2|3"]'),undefined);assert.equal(run('canceled.cells["9|3"]'),undefined);
assert.equal(run('JSON.stringify(canceled.cells["3|5"])'),'{"code":"","block":"OFF","locked":false}');
assert.equal(run('JSON.stringify(canceled.cells["1|5"])'),run('JSON.stringify(cm.cells["1|5"])'));
assert.equal(run('canceled.cells["4|6"].code'),'R');assert.equal(run('canceled.cells["5|10"].code'),'X');
assert.equal(run('JSON.stringify(canceled.categoryQuotas)'),run('JSON.stringify(cm.categoryQuotas)'));
for(let d=1;d<=30;d++)for(const code of ['N','M','A','R'])assert.equal(run('canceled.days['+d+'].need.'+code),run('cm.days['+d+'].need.'+code));
run('var canceledAgain=cancelMonthDays({...cancelState,months:{"2026-11":canceled}},"2026-11",[3,5,6],"X")');assert.equal(run('JSON.stringify(canceledAgain)'),run('JSON.stringify(canceled)'));
// Blue cancellation never removes red shifts on the same date or changes other dates.
run('cm.cells["6|6"]={code:"X",block:"",locked:true};var blueCanceled=cancelMonthDays(cancelState,"2026-11",[6],"R")');
assert.equal(run('blueCanceled.days[6].need.R'),0);assert.equal(run('blueCanceled.autoCapacity[6].R'),0);
assert.equal(run('blueCanceled.cells["4|6"]'),undefined);assert.equal(run('blueCanceled.cells["6|6"].code'),'X');assert.equal(run('blueCanceled.days[6].need.X'),1);
// Cancel only the requested absence; preserve shifts, other absence types and people.
run('cm.cells["1|7"]={code:"A",block:"OFF",locked:true};cm.cells["1|8"]={code:"",block:"VAC",locked:false};cm.cells["2|7"]={code:"",block:"OFF",locked:false};var offCanceled=cancelMonthDays(cancelState,"2026-11",[7,8],"OFF","1")');
assert.equal(run('JSON.stringify(offCanceled.cells["1|7"])'),'{"code":"A","block":"","locked":true}');assert.equal(run('offCanceled.cells["1|8"].block'),'VAC');assert.equal(run('offCanceled.cells["2|7"].block'),'OFF');
run('var vacCanceled=cancelMonthDays(cancelState,"2026-11",[8],"VAC","1")');assert.equal(run('vacCanceled.cells["1|8"]'),undefined);
assert.equal(run('cancelMonthDays(cancelState,"2027-06",[1],"X")'),null);assert.equal(run('cancelState.months["2027-06"]'),undefined);
for(const args of ['"2026-11",[3,31],"X"','"2026-11",[3],"N"','"2026-11",[3],"OFF","missing"','"2026-13",[3],"R"'])assert.throws(()=>run('cancelMonthDays(cancelState,'+args+')'));
// A later automatic run must use the canceled capacity instead of restoring X.
run('var capacityState=clone(SEED);capacityState.selected="2026-11";capacityState.months={"2026-11":freshMonth("2026-11")};capacityState.months["2026-11"].autoCapacity=Object.fromEntries(Object.entries(capacityState.months["2026-11"].days).map(([d,day])=>[d,clone(day.need)]));capacityState.months["2026-11"].days[3].need.X=1;capacityState.months["2026-11"].autoCapacity[3].X=2;capacityState.months["2026-11"]=cancelMonthDays(capacityState,"2026-11",[3],"X");var cancelSolved=solve(capacityState,"2026-11",{distribution:true})');
assert.equal(run('cancelSolved.ok'),true);assert.equal(run('cancelSolved.month.days[3].need.X'),0);assert.equal(run('Object.values(cancelSolved.month.cells).some(c=>c.code==="X")'),false);
console.log('PASS: cancellation removes selected needs/cache/locks, retains unrelated data, is idempotent and atomic, clears only the chosen absence and survives automatic scheduling');
