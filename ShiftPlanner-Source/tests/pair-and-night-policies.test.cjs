const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),c=require('../js/core');
const seed=JSON.parse(vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../js/data.js'),'utf8')+';JSON.stringify(SEED)'));
function fresh(){const s=c.clone(seed);s.selected='2026-11';s.months={[s.selected]:c.freshMonth(s.selected)};return s}
function put(s,id,d,code){s.months[s.selected].cells[c.key(id,d)]={code,block:'',locked:true}}
for(const first of c.CODES)for(const second of c.CODES){
 const s=fresh();put(s,'1',7,first);
 const clash=first===second||['R','X'].includes(first)&&['R','X'].includes(second),before=JSON.stringify(s),r=c.manualRange(s,s.selected,'8',7,7,second);
 assert.equal(r.ok,!clash,first+'/'+second);assert.equal(JSON.stringify(s),before);
 put(s,'8',7,second);assert.equal(c.audit(s,s.selected).issues.some(i=>i.type==='exclusion'),clash);
}
// A shared day in different shifts is valid even with both cells locked.
let s=fresh();put(s,'1',7,'N');put(s,'8',7,'M');let r=c.solve(s,s.selected,{distribution:true,calendar:true});assert(r.ok,r.message);assert(c.audit({...s,months:{[s.selected]:r.month}},s.selected).complete);
s=fresh();put(s,'1',7,'M');put(s,'8',7,'M');r=c.solve(s,s.selected,{distribution:true});assert.equal(r.reason,'fixed');assert(r.message.includes('ห้ามอยู่กะเดียวกัน'));
// Previous whole-day pair limits must not reject a combined total above 30.
s=fresh();s.months[s.selected].quotas={'1':20,'8':12};r=c.solve(s,s.selected,{distribution:true});assert(r.ok,r.message);let next={...s,months:{[s.selected]:r.month}},totals=c.totals(next,s.selected);assert.equal(totals.find(t=>t.id==='1').total,20);assert.equal(totals.find(t=>t.id==='8').total,12);assert(c.audit(next,s.selected).complete);
for(const p of seed.people){
 s=fresh();for(const d of [2,7])assert.equal(c.manualRange(s,s.selected,p.id,d,d,'N').ok,p.id!=='9');
 s.months[s.selected].days[2].holiday=true;assert.equal(c.eligibleOnDay(p,s.selected,2,'N'),p.id!=='9');
}
s=fresh();s.people[0].allowed=['M','A','R','X'];assert(!c.manualRange(s,s.selected,'1',2,2,'N').ok);s.people[0].allowed.push('N');s.people[0].active=false;assert(!c.manualRange(s,s.selected,'1',2,2,'N').ok);
// The older image still satisfies pair/night policies, but now violates the combined streak limit.
s=fresh();const examples={'1':[[1,'M'],[6,'N'],[13,'R'],[14,'N'],[15,'M'],[16,'R']],'2':[[8,'N'],[9,'R'],[10,'N']],'6':[[21,'M'],[22,'M'],[23,'R']],'8':[[1,'A'],[3,'N'],[14,'M'],[16,'A']]};for(const[id,days]of Object.entries(examples))for(const[d,code]of days)put(s,id,d,code);
assert(!c.audit(s,s.selected).issues.some(i=>['exclusion','eligibility'].includes(i.type)));assert(c.audit(s,s.selected).issues.some(i=>i.type==='consecutive'));
console.log('PASS: all 25 pair combinations, same-time early grouping, different locked shifts, pair totals above month length, every eligible night staff member and supplied-image examples');
