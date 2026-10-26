const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),c=require('../js/core');
const s=JSON.parse(vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../js/data.js'),'utf8')+';JSON.stringify(SEED)'));
const month='2026-11';s.selected=month;s.months[month]=c.freshMonth(month);
const m=s.months[month];m.quotas=Object.fromEntries([9,15,15,15,5,5,6,8].map((v,i)=>[String(i+1),v]));
const absences={'1':{OFF:[21,22],VAC:[23,24]},'3':{OFF:[14,15],VAC:[13]},'4':{OFF:[2,3,4,5,12]},'5':{OFF:[1]},'7':{OFF:[1,21,22,23,24],VAC:[25]},'8':{OFF:[23],VAC:[24,25]}};
for(const[id,blocks]of Object.entries(absences))for(const[block,days]of Object.entries(blocks))for(const d of days)m.cells[c.key(id,d)]={code:'',block,locked:false};
const before=JSON.stringify(s);let r=c.solve(s,month,{ms:10000});assert(r.ok,r.message);assert.equal(JSON.stringify(s),before);
s.months[month]=r.month;
assert.deepEqual(c.totals(s,month).map(t=>t.total),[9,15,15,15,5,5,6,8]);assert(c.audit(s,month).complete);
assert.equal(Object.values(r.month.days).reduce((a,d)=>a+Object.values(d.need).reduce((a,b)=>a+b,0),0),78);
for(const[k,cell]of Object.entries(m.cells))assert.equal(r.month.cells[k].block,cell.block);
// A later increased target uses the original open slots, not the reduced result.
s.months[month].quotas['1']=10;r=c.solve(s,month,{ms:10000});assert(r.ok,r.message);s.months[month]=r.month;assert.equal(c.totals(s,month).reduce((a,t)=>a+t.total,0),79);assert(c.audit(s,month).complete);
// Zero is a deliberate target, not auto. An impossible target never mutates data.
s.months[month].quotas=Object.fromEntries(s.people.map(p=>[p.id,0]));r=c.solve(s,month);assert(r.ok,r.message);s.months[month]=r.month;assert.equal(c.totals(s,month).reduce((a,t)=>a+t.total,0),0);
console.log('PASS: screenshot scenario 78 total, daily totals match, OFF/VAC preserved, repeat increase to 79 and zero targets');
