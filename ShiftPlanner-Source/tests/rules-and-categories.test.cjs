const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),c=require('../js/core');
const seed=JSON.parse(vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../js/data.js'),'utf8')+';JSON.stringify(SEED)'));
const month='2026-11',fresh=()=>({...c.clone(seed),selected:month,months:{[month]:c.freshMonth(month)}});
const put=(s,id,d,code,locked=true,m=month)=>s.months[m].cells[c.key(id,d)]={code,block:'',locked};
for(const p of seed.people){
 const s=fresh();
 assert.equal(c.manualRange(s,month,p.id,2,2,'N').ok,['2','3','4','5'].includes(p.id));
 assert(c.manualRange(s,month,p.id,1,1,'N').ok,'Sunday nights remain available');
 assert(c.manualRange(s,month,p.id,7,7,'N').ok,'Saturday nights remain available');
 s.months[month].days[2].holiday=true;
 assert.equal(c.manualRange(s,month,p.id,2,2,'N').ok,['2','3','4','5'].includes(p.id),'weekday holidays still use weekday night rule');
}
let s=fresh();put(s,'6',2,'N');let before=JSON.stringify(s);
assert(c.audit(s,month).issues.some(i=>i.type==='eligibility'&&i.p==='6'));
assert.equal(c.solve(s,month).reason,'fixed');assert.equal(JSON.stringify(s),before);
s=fresh();before=JSON.stringify(s);assert(!c.manualRange(s,month,'6',1,2,'N').ok);assert.equal(JSON.stringify(s),before,'reject whole drag if one weekday is ineligible');
for(const early of ['N','R','X']){
 s=fresh();put(s,'2',2,'A');before=JSON.stringify(s);assert(!c.manualRange(s,month,'2',3,3,early).ok);assert.equal(JSON.stringify(s),before);
 s=fresh();put(s,'2',3,early);assert(!c.manualRange(s,month,'2',2,2,'A').ok,'validate next day too');
 put(s,'2',2,'A');assert(c.audit(s,month).issues.some(i=>i.type==='rest'));assert.equal(c.solve(s,month).reason,'fixed');
 s=fresh();s.months['2026-10']=c.freshMonth('2026-10');put(s,'2',31,'A',true,'2026-10');
 assert(!c.manualRange(s,month,'2',1,1,early).ok,'previous month boundary');
 put(s,'2',1,early);assert(c.audit(s,month).issues.some(i=>i.type==='rest'&&i.d===1));assert.equal(c.solve(s,month).reason,'fixed');
 s=fresh();s.months['2026-12']=c.freshMonth('2026-12');put(s,'2',1,early,true,'2026-12');
 assert(!c.manualRange(s,month,'2',30,30,'A').ok,'next month boundary');
 put(s,'2',30,'A');assert(c.audit(s,month).issues.some(i=>i.type==='rest'&&i.d===30));assert.equal(c.solve(s,month).reason,'fixed');
}
console.log('PASS: weekday night whitelist, weekend/holiday behavior, atomic painting, both rest directions and adjacent months');
function shortRoster(){const s=fresh();s.people=s.people.slice(0,8);for(const[d,day]of Object.entries(s.months[month].days))day.need=+d<=8?{N:1,M:0,A:1,R:1,X:1}:{N:0,M:0,A:0,R:0,X:0};return s}
s=shortRoster();s.months[month].categoryQuotas=Object.fromEntries(s.people.map(p=>[p.id,{card:2,dawn:1,outreach:1}]));
before=JSON.stringify(s);let result=c.solve(s,month,{ms:10000});assert(result.ok,result.message);assert.equal(JSON.stringify(s),before);
s.months[month]=result.month;assert(c.audit(s,month).complete);
for(const t of c.totals(s,month))assert.deepEqual(c.categoryTotals(t),{card:2,dawn:1,outreach:1});
for(const p of s.people)for(let d=1;d<=30;d++){
 const code=c.cell(result.month,p.id,d).code;
 if(code==='N'&&![0,6].includes(c.weekday(month,d)))assert(['2','3','4','5'].includes(p.id));
 if(d>1)assert(!c.restConflict(c.cell(result.month,p.id,d-1).code,code));
}
result=c.solve(s,month,{ms:10000});assert(result.ok,result.message);assert(c.audit({...s,months:{[month]:result.month}},month).complete);
// The equal-total group can have different distributions across categories.
s=shortRoster();s.months[month].categoryQuotas=Object.fromEntries(s.people.map(p=>[p.id,{card:2,dawn:1,outreach:1}]));
s.months[month].categoryQuotas['2']={card:1,dawn:2,outreach:1};s.months[month].categoryQuotas['3']={card:3,dawn:0,outreach:1};
result=c.solve(s,month,{ms:10000});assert(result.ok,result.message);
for(const t of c.totals({...s,months:{[month]:result.month}},month))assert.deepEqual(c.categoryTotals(t),s.months[month].categoryQuotas[t.id]);
// Rebuild a full month from exact category targets, with the previous answer removed.
s=fresh();result=c.solve(s,month,{ms:10000});assert(result.ok,result.message);s.months[month]=result.month;s.months[month].cells={};
result=c.solve(s,month,{ms:10000});assert(result.ok,result.message);assert(c.audit({...s,months:{[month]:result.month}},month).complete);
// Partial category targets leave other categories to the solver.
s=shortRoster();s.months[month].categoryQuotas={'1':{dawn:0,outreach:1},'2':{card:2}};result=c.solve(s,month,{ms:10000});assert(result.ok,result.message);
assert.equal(c.categoryTotals(c.totals({...s,months:{[month]:result.month}},month)[0]).dawn,0);
assert.equal(c.categoryTotals(c.totals({...s,months:{[month]:result.month}},month)[0]).outreach,1);
// All explicit totals can reduce daily demand, without discarding the original capacity.
s=shortRoster();s.months[month].categoryQuotas=Object.fromEntries(s.people.map(p=>[p.id,{card:1,dawn:0,outreach:0}]));
result=c.solve(s,month,{ms:10000});assert(result.ok,result.message);assert(result.month.autoCapacity);assert.equal(c.totals({...s,months:{[month]:result.month}},month).reduce((sum,t)=>sum+t.total,0),8);
s.months[month]=result.month;s.months[month].categoryQuotas=Object.fromEntries(s.people.map(p=>[p.id,{card:2,dawn:1,outreach:1}]));
result=c.solve(s,month,{ms:10000});assert(result.ok,result.message);assert.equal(c.totals({...s,months:{[month]:result.month}},month).reduce((sum,t)=>sum+t.total,0),32);
s=shortRoster();s.months[month].categoryQuotas={'1':{outreach:9}};before=JSON.stringify(s);assert.equal(c.solve(s,month).reason,'capacity');assert.equal(JSON.stringify(s),before);
s=shortRoster();s.months[month].categoryQuotas={'1':{card:30,dawn:1}};assert.throws(()=>c.categoryTargets(s,month));
s=shortRoster();s.months[month].categoryQuotas={'1':{other:1}};assert.throws(()=>c.categoryTargets(s,month));
s=shortRoster();s.months[month].categoryQuotas={'1':{dawn:0}};put(s,'1',2,'R');assert.equal(c.solve(s,month).reason,'fixed');
s=shortRoster();s.months[month].categoryQuotas=Object.fromEntries(s.people.map(p=>[p.id,{card:0,dawn:0,outreach:0}]));result=c.solve(s,month);assert(result.ok,result.message);assert.equal(Object.keys(result.month.cells).length,0);
console.log('PASS: exact and partial category goals, repeated scheduling, zero/auto distinction, original daily capacity, invalid goals and locked rows');
