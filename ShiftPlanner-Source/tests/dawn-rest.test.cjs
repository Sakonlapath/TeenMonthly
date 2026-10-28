const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),c=require('../js/core');
const seed=JSON.parse(vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../js/data.js'),'utf8')+';JSON.stringify(SEED)'));
const month='2026-11',early=['R','X'];
function fresh(){const s=c.clone(seed);s.selected=month;s.months={[month]:c.freshMonth(month)};return s}
function put(s,id,d,code,m=month,locked=true){s.months[m].cells[c.key(id,d)]={code,block:'',locked};if(code)s.months[m].days[d].need[code]=Math.max(1,s.months[m].days[d].need[code]);}
for(const prev of ['',...c.CODES])for(const next of ['',...c.CODES]){
 const forbidden=prev==='A'&&['N','R','X'].includes(next)||early.includes(prev)&&early.includes(next);
 assert.equal(c.restConflict(prev,next),forbidden,prev+' -> '+next);
}
for(const[previous,next]of [['A','R'],['A','X'],...early.flatMap(a=>early.map(b=>[a,b]))]){
 let s=fresh();put(s,'2',6,previous);let before=JSON.stringify(s),r=c.manualRange(s,month,'2',7,7,next);
 assert(!r.ok,previous+' -> '+next);assert.equal(JSON.stringify(s),before);assert(r.message.includes(early.includes(previous)?'รุ่งอรุณติดกัน':'บ่ายต่อ'));
 s=fresh();put(s,'2',7,next);before=JSON.stringify(s);r=c.manualRange(s,month,'2',6,6,previous);assert(!r.ok,'editing the previous day also checks the next');assert.equal(JSON.stringify(s),before);
 put(s,'2',6,previous);assert(c.audit(s,month).issues.some(i=>i.type==='rest'&&i.p==='2'&&i.d===7));before=JSON.stringify(s);r=c.solve(s,month,{distribution:true,vary:true});assert.equal(r.reason,'fixed');assert.equal(JSON.stringify(s),before);
 // Read actual adjacent months in both directions, including mixed colors.
 for(const side of [-1,1]){
  s=fresh();const adjacent=c.monthOffset(month,side);s.months[adjacent]=c.freshMonth(adjacent);
  const d=side<0?1:c.daysIn(month);if(side<0)put(s,'2',c.daysIn(adjacent),previous,adjacent);else put(s,'2',1,next,adjacent);
  before=JSON.stringify(s);r=c.manualRange(s,month,'2',d,d,side<0?next:previous);assert(!r.ok,'cross-month rest must be enforced');assert.equal(JSON.stringify(s),before);
  put(s,'2',d,side<0?next:previous);assert(c.audit(s,month).issues.some(i=>i.type==='rest'&&i.p==='2'&&i.d===d));assert.equal(c.solve(s,month).reason,'fixed');
  s.months[adjacent].excludedStaffIds=['2'];assert(!c.audit(s,month).issues.some(i=>i.type==='rest'&&i.p==='2'));
 }
}
// A separating day permits dawn again; R -> N remains permitted as requested.
for(const gap of ['', 'OFF', 'VAC', 'N', 'M', 'R']){
 const s=fresh();put(s,'2',5,'R');if(gap)put(s,'2',6,c.CODES.includes(gap)?gap:'');if(['OFF','VAC'].includes(gap))s.months[month].cells['2|6'].block=gap;
 const r=c.manualRange(s,month,'2',7,7,'X');assert.equal(r.ok,gap!=='R');
}
let s=fresh();for(const day of Object.values(s.months[month].days))day.need={N:0,M:0,A:0,R:1,X:1};
assert.equal(c.maxAssignable(s,month,s.months[month],s.people[1],['R','X']),15);
assert.equal(c.maxAssignable(s,month,s.months[month],s.people[8],['X']),15,'X-only staff follow the same rest rule');
// Normal automatic scheduling and subsequent randomization/goal repair all use
// the same guard, including existing unlocked violations.
for(const selected of ['2026-10','2026-11','2028-02']){
 s=c.clone(seed);s.selected=selected;s.months={[selected]:c.freshMonth(selected)};for(const d of [2,5,6,7,8,9,12,13,14])s.months[selected].days[d].need.X=1;
 for(const d of [5,6])s.months[selected].cells['2|'+d]={code:'R',block:'',locked:false};
 for(let run=0;run<3;run++){
  const r=c.solve(s,selected,{distribution:true,calendar:true,vary:true});assert(r.ok,r.message);s.months[selected]=r.month;assert(c.audit(s,selected).complete);
  for(const p of s.people)for(let d=2;d<=c.daysIn(selected);d++)assert(!c.restConflict(c.cell(r.month,p.id,d-1).code,c.cell(r.month,p.id,d).code));
  s.months[selected].categoryQuotas={'1':{dawn:3}};
 }
}
console.log('PASS: afternoon-to-dawn, all four adjacent dawn color pairs, reverse/manual edits, locks, boundaries, exclusions, real capacities, automatic rebuilding, randomization and goal repair');
