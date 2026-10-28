const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),c=require('../js/core');
const seed=JSON.parse(vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../js/data.js'),'utf8')+';JSON.stringify(SEED)'));
function fresh(month='2026-11'){const s=c.clone(seed);s.selected=month;s.months={[month]:c.freshMonth(month)};return s}
const put=(s,month,id,d,code,locked=true)=>s.months[month].cells[c.key(id,d)]={code,block:'',locked};
// Of all 125 mixed sequences, only the 27 N/M/A triples hit the card streak limit.
for(const first of c.CODES)for(const second of c.CODES)for(const third of c.CODES){
 const s=fresh(),m=s.months[s.selected],p=s.people[1];put(s,s.selected,p.id,1,first);put(s,s.selected,p.id,2,second);put(s,s.selected,p.id,3,third);
 const limited=[first,second,third].every(code=>c.CARD_CODES.includes(code));assert.equal(c.consecutiveConflict(s,s.selected,m,p,3),limited);assert.equal(c.audit(s,s.selected).issues.some(i=>i.type==='consecutive'&&i.p===p.id&&i.d===3),limited);if(!limited)continue;
 delete m.cells[c.key(p.id,3)];const before=JSON.stringify(s);const rejected=c.manualRange(s,s.selected,p.id,3,3,third);assert.equal(rejected.ok,false);assert.equal(JSON.stringify(s),before);
}
for(const gap of ['', 'OFF', 'VAC', 'R', 'X']){
 const s=fresh(),m=s.months[s.selected],p=s.people[1];put(s,s.selected,p.id,1,'N');m.cells[c.key(p.id,2)]={code:c.CODES.includes(gap)?gap:'',block:['OFF','VAC'].includes(gap)?gap:'',locked:false};put(s,s.selected,p.id,3,'M');assert(!c.consecutiveConflict(s,s.selected,m,p,3));
}
// Detect a third day inserted between two existing duties, and reject a whole drag.
let s=fresh(),month=s.selected;put(s,month,'2',1,'N');put(s,month,'2',3,'M');let before=JSON.stringify(s);
assert(!c.manualRange(s,month,'2',2,2,'M').ok);assert(c.manualRange(s,month,'2',2,2,'R').ok,'KIOS separates two card days');assert.equal(JSON.stringify(s),before);
s=fresh();before=JSON.stringify(s);let r=c.manualRange(s,month,'2',2,4,'M');assert.equal(r.ok,false);assert(r.message.includes('ติดกันเกิน 2 วัน'));assert.equal(JSON.stringify(s),before);
assert(c.manualRange(s,month,'2',2,3,'M').ok);
assert(!c.manualRange(fresh(),month,'9',2,6,'X').ok,'separate rest rule prohibits adjacent early duties');assert(!c.manualRange(fresh(),month,'2',2,6,'R').ok);
// Read both dates of adjacent months; an adjacent excluded row is treated as blank.
for(const side of [-1,1])for(const split of [1,2]){
 s=fresh();const adjacent=c.monthOffset(month,side);s.months[adjacent]=c.freshMonth(adjacent);
 if(side<0){for(let i=0;i<split;i++)put(s,adjacent,'2',c.daysIn(adjacent)-i,'M');for(let d=1;d<=3-split;d++)put(s,month,'2',d,'M');}
 else{for(let d=1;d<=split;d++)put(s,adjacent,'2',d,'M');for(let i=0;i<3-split;i++)put(s,month,'2',c.daysIn(month)-i,'M');}
 const editedDay=side<0?3-split:c.daysIn(month);delete s.months[month].cells[c.key('2',editedDay)];before=JSON.stringify(s);assert(!c.manualRange(s,month,'2',editedDay,editedDay,'M').ok);assert.equal(JSON.stringify(s),before);put(s,month,'2',editedDay,'M');
 assert(c.audit(s,month).issues.some(i=>i.type==='consecutive'));before=JSON.stringify(s);r=c.solve(s,month,{distribution:true});assert.equal(r.reason,'fixed');assert(r.message.includes('ติดกันเกิน 2 วัน'));assert.equal(JSON.stringify(s),before);
 s.months[adjacent].excludedStaffIds=['2'];assert(!c.audit(s,month).issues.some(i=>i.type==='consecutive'));
}
// Locked violations are explained; unlocked work can be rebuilt automatically.
s=fresh();for(const [d,code]of [[2,'M'],[3,'N'],[4,'A']])put(s,month,'2',d,code);r=c.solve(s,month);assert.equal(r.reason,'fixed');
for(const cell of Object.values(s.months[month].cells))cell.locked=false;
r=c.solve(s,month,{distribution:true,calendar:true,ms:3000});assert(r.ok,r.message);assert(c.audit({...s,months:{[month]:r.month}},month).complete);
for(const month of ['2026-10','2026-11','2028-02']){
 s=fresh(month);for(const d of [2,4,6,9,11,13,16,18,20])s.months[month].days[d].need.X=1;
 r=c.solve(s,month,{distribution:true,calendar:true,ms:3000});assert(r.ok,r.message);const next={...s,months:{[month]:r.month}};assert(c.audit(next,month).complete);
 for(const p of s.people)for(let d=1;d<=c.daysIn(month)-2;d++)assert(![d,d+1,d+2].every(day=>c.CARD_CODES.includes(c.cell(r.month,p.id,day).code)));
 s.months[month].categoryQuotas={'2':{card:c.daysIn(month)}};r=c.solve(s,month,{distribution:true});assert.equal(r.reason,'quota');assert(r.message.includes('กติกาห้องบัตรไม่เกิน 2 วันติดกัน'));
}
console.log('PASS: 27 card triples among 125 mixtures, early/empty/leave breaks, atomic dragging, both sides of month boundaries, exclusions, locked rejection, automatic rebuilding and true quota limits');
