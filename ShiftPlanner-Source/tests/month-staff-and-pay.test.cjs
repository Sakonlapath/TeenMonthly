const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),c=require('../js/core');
const root=path.join(__dirname,'..');
const seed=JSON.parse(vm.runInNewContext(fs.readFileSync(path.join(root,'js/data.js'),'utf8')+';JSON.stringify(SEED)'));
const month='2026-11';
function fresh(){const s=c.clone(seed);s.selected=month;s.months[month]=c.freshMonth(month);return s}
function clearDemand(m){for(const day of Object.values(m.days))day.need={N:0,M:0,A:0,R:0,X:0}}

// Legacy numeric rates are card rates; early shifts share the role default or one custom rate.
let s=fresh();const t={id:'1',N:1,M:1,A:1,R:2,X:1,total:6};
assert.equal(c.totalPay(s,t),1740);
s.payRates['1']={card:500.25,dawn:120.10,outreach:80.35};
assert.equal(c.totalPay(s,t),1861.05);
assert.equal(c.payRate(s,'1','dawn'),120.10);
s.payRates['1'].dawn=0;assert.equal(c.totalPay(s,t),1500.75);
assert.equal(c.payRate(s,'1','outreach'),0,'red and blue use the same zero rate');
// Defaults follow roles, and every person has one shared dawn rate.
const dawnDefaults=[60,50,50,50,80,80,80,50,80];
s=fresh();assert.deepEqual(s.people.map(p=>c.payRate(s,p.id,'dawn')),dawnDefaults);
assert.deepEqual(s.people.map(p=>c.payRate(s,p.id,'outreach')),dawnDefaults);
for(const[role,rate]of [['จพ.เวชสถิติ',60],['จพ. เวช',60],['เจ้าพนักงานเวชสถิติ',60],['พนักงานธุรการ',50],['นวก.คอมพิวเตอร์ชำนาญการ',80],['นักวิชาการสาธารณสุข',80],['อื่น',0]])assert.equal(c.defaultDawnRate(role),rate);
const monthsBefore=JSON.stringify(s.months),peopleBefore=JSON.stringify(s.people);
assert(c.normalizePayRates(s));assert.deepEqual(Object.keys(s.payRates['1']),['card','dawn']);assert.equal(s.payRates['1'].card,520);assert.equal(s.payRates['9'].dawn,80);
assert.equal(JSON.stringify(s.months),monthsBefore);assert.equal(JSON.stringify(s.people),peopleBefore);assert.equal(c.normalizePayRates(s),false);
for(const[raw,expected]of [[777,60],[{card:520,dawn:520,outreach:520},60],[{card:520,dawn:520,outreach:65},65],[{card:500,dawn:65,outreach:90},65],[{card:500,outreach:77},77],[{card:500,dawn:0,outreach:80},0],[{card:75,dawn:75},75]]){
 s=fresh();s.payRates['1']=raw;const card=c.payRate(s,'1','card');
 assert.equal(c.payRate(s,'1','dawn'),expected);assert.equal(c.payRate(s,'1','outreach'),expected);
 c.normalizePayRates(s);assert.deepEqual(s.payRates['1'],{card,dawn:expected});
}

// Membership is local to one month and does not erase retained cells or targets.
s=fresh();let m=s.months[month];clearDemand(m);m.excludedStaffIds=['3','9'];
m.cells['9|1']={code:'R',block:'',locked:true};m.cells['9|2']={code:'',block:'OFF',locked:false};
m.quotas=Object.fromEntries(s.people.map(p=>[p.id,['2','4'].includes(p.id)?1:0]));m.quotas['9']=15;
m.categoryQuotas={'9':{card:10,dawn:5,outreach:0}};
m.days[1].need.R=1;m.days[2].need.R=1;
s.months['2026-12']=c.freshMonth('2026-12');
assert.deepEqual(c.group(s,month),['2','4']);assert.equal(c.monthPeople(s,month).length,7);
assert.equal(c.monthPeople(s,'2026-12').length,9);assert.equal(c.totals(s,month)[8].total,0);
assert.equal(c.quotaTargets(s,month)['9'],undefined);assert.equal(c.categoryTargets(s,month)['9'],undefined);
assert.equal(c.dawnTargets(s,month)['9'],undefined);assert(!c.manualRange(s,month,'9',3,3,'R').ok);
const before=JSON.stringify(s),solved=c.solve(s,month);assert(solved.ok,solved.message);assert.equal(JSON.stringify(s),before);
assert.deepEqual(solved.month.cells['9|1'],m.cells['9|1']);assert.deepEqual(solved.month.cells['9|2'],m.cells['9|2']);
assert.equal(solved.month.quotas['9'],15);assert.deepEqual(solved.month.categoryQuotas['9'],m.categoryQuotas['9']);
assert(c.audit({...s,months:{...s.months,[month]:solved.month}},month).complete);
assert.deepEqual(c.totals({...s,months:{...s.months,[month]:solved.month}},month).filter(p=>['2','4'].includes(p.id)).map(p=>p.total),[1,1]);
m.excludedStaffIds=[];assert.equal(c.totals(s,month)[8].total,1);assert.equal(c.categoryTargets(s,month)['9'].dawn,5);

// A month can omit every member of the equal-total group, or every person.
s=fresh();m=s.months[month];clearDemand(m);m.excludedStaffIds=s.people.filter(p=>!['1','5'].includes(p.id)).map(p=>p.id);
m.days[1].need.R=1;m.days[2].need.R=1;m.quotas={'1':1,'5':1};
let r=c.solve(s,month);assert(r.ok,r.message);assert.equal(c.audit({...s,months:{[month]:r.month}},month).complete,true);
m.excludedStaffIds=s.people.map(p=>p.id);clearDemand(m);r=c.solve(s,month);assert(r.ok,r.message);
m.days[1].need.R=1;assert.equal(c.solve(s,month).reason,'capacity');

// Retained shifts in an omitted adjacent month must not create a rest conflict.
s=fresh();s.months['2026-10'].excludedStaffIds=['9'];s.months['2026-10'].cells['9|31']={code:'A',block:'',locked:true};
assert(c.manualRange(s,month,'9',1,1,'X').ok);

// Website and export totals share the same rates and selected roster.
s=fresh();m=s.months[month];m.excludedStaffIds=['2','9'];s.payRates['1']={card:500.25,dawn:120.10,outreach:80.35};
['N','M','A','R','R','X'].forEach((code,i)=>m.cells['1|'+(i+1)]={code,block:'',locked:false});
m.cells['2|1']={code:'R',block:'',locked:true};m.cells['9|2']={code:'X',block:'',locked:true};
const ctx=vm.createContext({TextEncoder,console,s});
for(const file of ['core','export-template','exports'])vm.runInContext(fs.readFileSync(path.join(root,'js/'+file+'.js'),'utf8'),ctx);
const run=source=>vm.runInContext(source,ctx);
run('var model=exportModel(s,s.selected);var parts=xlsxParts(s,s.selected)');
assert.equal(run('model.people.length'),7);assert.equal(run('model.cells.B11.v'),s.people[2].name);
assert.equal(run('model.cells.B17.v'),'');assert.equal(run('model.cells.AL10.v'),1861.05);assert.equal(run('model.cells.AL19.v'),1861.05);
assert.equal(run('model.cells.AM10.v'),500.25);assert.equal(run('model.cells.AN10.v'),120.10);assert.equal(run('model.cells.AO10.v'),'');
assert.equal(run('model.cells.AP10.v'),2);assert.equal(run('model.cells.AQ10.v'),1);assert.equal(run('model.cells.AW10.v'),'X');
assert.equal(run('model.cells.AL10.f'),'ROUND(AI10*AM10+AJ10*AN10,2)');
assert.equal(run('model.cells.AP10.f'),'COUNTIF(AR10:BV10,"R")');
assert(run('parts["xl/worksheets/sheet1.xml"]').includes('min="39" max="74" width="10" hidden="1"'));
assert(run('parts["xl/workbook.xml"]').includes('$A$1:$AL$29'));
const csv=run('csvText(s,s.selected)');assert(csv.includes('"1861.05"'));assert(!csv.includes(s.people[1].name));assert(!csv.includes(s.people[8].name));
console.log('PASS: monthly roster, subset equality, empty roster, preserved omitted data, month boundaries, category pay and matching Excel/CSV totals');
