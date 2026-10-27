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
