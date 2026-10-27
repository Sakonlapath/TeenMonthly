const assert=require('node:assert/strict'),fs=require('node:fs'),c=require('../js/core.js');
const seed=JSON.parse(require('node:vm').runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../js/data.js'),'utf8')+'; JSON.stringify(SEED)'));
assert.deepEqual(seed.months[seed.selected],c.freshMonth(seed.selected));
let result=c.solve(require('./fixtures/legacy-october.json'),seed.selected);assert.equal(result.ok,false);assert.equal(result.reason,'capacity');console.log('Blank startup and original OFF constraints: correctly rejects day 24');
for(let month of ['2026-10','2026-11','2027-02','2028-02']){
let s=c.clone(seed);s.selected=month;s.months[month]=c.freshMonth(month);
s.months[month].cells['2|3']={code:'',block:'VAC',locked:false};s.months[month].cells['3|6']={code:'',block:'OFF',locked:false};
s.months[month].cells['1|2']={code:'R',block:'',locked:true};s.months[month].days[2].need.R=1;
let r=c.solve(s,month,{ms:10000});assert(r.ok,r.message);s.months[month]=r.month;assert(c.audit(s,month).complete);assert.equal(c.cell(r.month,'2',3).block,'VAC');assert.equal(c.cell(r.month,'3',6).block,'OFF');assert.equal(c.cell(r.month,'1',2).code,'R');assert(c.cell(r.month,'1',2).locked);console.log(month,'passed; nodes',r.nodes)}
let locked=c.clone(seed);locked.months[locked.selected]=c.freshMonth(locked.selected);locked.months[locked.selected].cells['1|1']={code:'A',block:'',locked:true};locked.months[locked.selected].cells['1|2']={code:'N',block:'',locked:true};assert.equal(c.solve(locked,locked.selected).reason,'fixed');
let prev=c.clone(seed);prev.months[prev.selected]=c.freshMonth(prev.selected);prev.people[0].prev='A';prev.months[prev.selected].cells['1|1']={code:'N',block:'',locked:true};assert.equal(c.solve(prev,prev.selected).reason,'fixed');
let next=c.clone(seed);next.months[next.selected]=c.freshMonth(next.selected);next.people[0].next='N';next.months[next.selected].cells['1|31']={code:'A',block:'',locked:true};assert.equal(c.solve(next,next.selected).reason,'fixed');
let absent=c.clone(seed);absent.months[absent.selected]=c.freshMonth(absent.selected);absent.people[1].active=false;let a=c.solve(absent,absent.selected);assert(!a.ok||c.totals({...absent,months:{[absent.selected]:a.month}},absent.selected)[1].total===0);
console.log('PASS: locked shifts, OFF/VAC preservation, individual workloads, per-type daily coverage, rest and month boundaries');

// A manually scheduled shift locks that cell; other days remain schedulable.
let manual={selected:'2026-11',people:Array.from({length:5},(_,i)=>({id:String(i+1),name:'Person '+(i+1),active:true,allowed:['R']})),months:{'2026-11':c.freshMonth('2026-11')}};
let mm=manual.months[manual.selected];
for(let d=1;d<=30;d++)mm.days[d].need={N:0,M:0,A:0,R:d<=7?1:0,X:0};
mm.cells['2|1']={code:'R',block:'',locked:true};
mm.cells['2|2']={code:'R',block:'',locked:false};
mm.cells['2|8']={code:'',block:'VAC',locked:false};
const before=JSON.stringify(manual);
let mr=c.solve(manual,manual.selected);assert(mr.ok,mr.message);
assert.equal(JSON.stringify(manual),before,'solve must not mutate input');
assert.deepEqual(c.cell(mr.month,'2',1),c.cell(mm,'2',1));
assert.deepEqual(c.cell(mr.month,'2',8),c.cell(mm,'2',8));
manual.months[manual.selected]=mr.month;
assert(c.audit(manual,manual.selected).complete);
let again=c.solve(manual,manual.selected);assert(again.ok,again.message);
assert.deepEqual(c.cell(again.month,'2',1),c.cell(mm,'2',1));
// Only the person with a lock on a different day can cover day 3.
let blocked=c.clone(manual);
for(let p of blocked.people.filter(p=>p.id!=='2'))blocked.months[blocked.selected].cells[c.key(p.id,3)]={code:'',block:'OFF',locked:false};
const blockedBefore=JSON.stringify(blocked);
const filled=c.solve(blocked,blocked.selected);assert(filled.ok,filled.message);
assert.equal(JSON.stringify(blocked),blockedBefore);
assert.equal(c.cell(filled.month,'2',3).code,'R');
assert.deepEqual(c.cell(filled.month,'2',1),c.cell(mm,'2',1));
assert(c.audit({...blocked,months:{[blocked.selected]:filled.month}},blocked.selected).complete);
// Fully unavailable days still fail without touching the original schedule.
const impossible=c.clone(blocked);impossible.months[impossible.selected].cells['2|3']={code:'',block:'VAC',locked:false};
const impossibleBefore=JSON.stringify(impossible);assert.equal(c.solve(impossible,impossible.selected).reason,'capacity');assert.equal(JSON.stringify(impossible),impossibleBefore);
// Removing a lock also remains supported.
blocked.months[blocked.selected].cells['2|1'].locked=false;
let released=c.solve(blocked,blocked.selected);assert(released.ok,released.message);
assert.equal(c.cell(released.month,'2',3).code,'R');
console.log('PASS: individual locks preserved, blank days filled, OFF/VAC and personal targets, repeat scheduling, genuine unavailability and unlock');

// October regression: all nine people have a manual shift on another day.
// This previously reported day 1 needed 3 people but had 0 available.
const october=c.clone(seed),om='2026-10';october.selected=om;october.months={[om]:c.freshMonth(om)};
const octoberMonth=october.months[om];
for(const day of Object.values(octoberMonth.days))day.need={N:0,M:0,A:0,R:0,X:0};
octoberMonth.days[1].need={N:1,M:0,A:1,R:1,X:0};
for(let i=0;i<october.people.length;i++){
 const code=october.people[i].id==='9'?'X':'R';octoberMonth.days[i+2].need[code]=1;octoberMonth.cells[c.key(october.people[i].id,i+2)]={code,block:'',locked:true};
}
octoberMonth.cells['1|1']={code:'',block:'OFF',locked:false};octoberMonth.cells['6|1']={code:'',block:'VAC',locked:false};
const octoberBefore=JSON.stringify(october),octoberResult=c.solve(october,om);assert(octoberResult.ok,octoberResult.message);
assert.equal(JSON.stringify(october),octoberBefore);
assert(c.audit({...october,months:{[om]:octoberResult.month}},om).complete);
for(const[k,v]of Object.entries(octoberMonth.cells))assert.deepEqual(octoberResult.month.cells[k],v);
assert.equal(october.people.filter(p=>c.cell(octoberResult.month,p.id,1).code).length,3);
console.log('PASS: October day 1 fills all 3 slots when every person has a locked shift elsewhere');

// --- New Features Test Suite ---
// 1. Pair Exclusion Test (พฤกษา '1' ห้ามอยู่กะเดียวกับ รพีพรรณ '8')
let peTest = c.clone(seed);
peTest.selected = '2026-11';
peTest.months['2026-11'] = c.freshMonth('2026-11');
let peResult = c.solve(peTest, '2026-11');
assert(peResult.ok, peResult.message);
for (let d = 1; d <= 30; d++) {
  let c1 = c.cell(peResult.month, '1', d).code;
  let c8 = c.cell(peResult.month, '8', d).code;
  assert(!c.sameShift(c1,c8), 'Day ' + d + ' has both person 1 (' + c1 + ') and person 8 (' + c8 + ') working!');
}
// Locked collision rejection
let peCollision = c.clone(seed);
peCollision.months['2026-10'] = c.freshMonth('2026-10');
peCollision.months['2026-10'].cells['1|3'] = {code: 'M', block: '', locked: true};
peCollision.months['2026-10'].cells['8|3'] = {code: 'M', block: '', locked: true};
assert.equal(c.solve(peCollision, '2026-10').reason, 'fixed');
let audCollision = c.audit(peCollision, '2026-10');
assert(audCollision.issues.some(i => i.type === 'exclusion'), 'audit must report exclusion issue');
console.log('PASS: Pair exclusion (พฤกษา 1 ↔ รพีพรรณ 8) enforced in solve and audit');

// 2. Custom Quota Test
let qTest = c.clone(seed);
qTest.selected = '2026-11';
qTest.months['2026-11'] = c.freshMonth('2026-11');
qTest.months['2026-11'].quotas = {'2': 14}; // target only person 2
let qResult = c.solve(qTest, '2026-11');
assert(qResult.ok, qResult.message);
assert.equal(c.totals({...qTest,months:{'2026-11':qResult.month}},'2026-11')[1].total,14);
assert.equal(qResult.month.quotas['3'],undefined);assert.equal(qResult.month.quotas['4'],undefined);
let qAudit = c.audit({people: seed.people, months: {'2026-11': qResult.month}}, '2026-11', {quotas: {'2': 14}});
assert(qAudit.complete);
assert(!qAudit.issues.some(i=>i.type==='fairness'));
console.log('PASS: Custom personal quota enforced without propagating to people 3 and 4');

// 3. R-shift Priority for Main Staff ('1', '2', '3', '4')
let rCountMap = {};
for (let p of seed.people) rCountMap[p.id] = 0;
for (let d = 1; d <= 30; d++) {
  for (let p of seed.people) {
    let cd = c.cell(peResult.month, p.id, d).code;
    if (cd === 'R' || cd === 'X') rCountMap[p.id]++;
  }
}
let mainR = ['1', '2', '3', '4'].map(id => rCountMap[id]);
let otherR = ['5', '6', '7', '8'].map(id => rCountMap[id]);
let minMainR = Math.min(...mainR);
let maxOtherR = Math.max(...otherR);
assert(minMainR >= maxOtherR, 'Main staff R shifts (' + mainR.join(',') + ') must be >= other staff R shifts (' + otherR.join(',') + ')');
console.log('PASS: Main staff R-shift priority verified (main:', mainR.join(','), 'other:', otherR.join(','), ')');

// 4. Pay Rates Test
const rates = c.DEFAULT_PAY_RATES;
assert.equal(rates['1'], 520);
assert.equal(rates['2'], 330);
assert.equal(rates['3'], 330);
assert.equal(rates['4'], 330);
assert.equal(rates['5'], 650);
assert.equal(rates['6'], 650);
assert.equal(rates['7'], 650);
assert.equal(rates['8'], 390);
console.log('PASS: Pay rates verified for all 8 staff');

