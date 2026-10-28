const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),c=require('../js/core');
const seed=JSON.parse(vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../js/data.js'),'utf8')+';JSON.stringify(SEED)'));
function arranged(month){const s=c.clone(seed);s.selected=month;s.months={[month]:c.freshMonth(month)};for(const d of [2,5,6,7,8,9,12,13,14])s.months[month].days[d].need.X=1;const result=c.solve(s,month,{distribution:true});assert(result.ok,result.message);s.months[month]=result.month;return s}
function solveAgain(s){const before=JSON.stringify(s),result=c.solve(s,s.selected,{distribution:true,ms:1500,nodes:20000});assert(result.ok,result.message);assert.equal(JSON.stringify(s),before,'recalculation cannot mutate the input');const next={...s,months:{[s.selected]:result.month}};assert(c.audit(next,s.selected).complete);assert(result.nodes<3000,'ordinary changes should not exhaust the search budget');return next}
// Reproduce the exact workflow: schedule first, edit a single field, then reschedule.
for(const month of ['2026-10','2026-11']){
 const first=arranged(month);
 for(const category of ['card','dawn'])for(const person of first.people){
  if(person.id==='9'&&category==='card')continue;
  const edited=c.clone(first);edited.months[month].categoryQuotas[person.id]={[category]:3};const result=solveAgain(edited),t=c.totals(result,month).find(t=>t.id===person.id);
  assert.equal(c.categoryTotals(t)[category],3);
  if(person.id==='9'){assert.equal(t.R,0);assert.equal(t.X,3);assert.equal(c.totals(result,month).filter(t=>t.id!=='9').reduce((sum,t)=>sum+t.X,0),6)}
 }
}
// Multiple edits must retain all manually entered goals while changing auto shares.
let s=arranged('2026-10'),month=s.selected;
s.months[month].categoryQuotas['1']={dawn:3};s=solveAgain(s);
s.months[month].categoryQuotas['2']={card:3};s=solveAgain(s);
s.months[month].categoryQuotas['1'].dawn=6;s=solveAgain(s);
assert.equal(c.categoryTotals(c.totals(s,month)[0]).dawn,6);assert.equal(c.categoryTotals(c.totals(s,month)[1]).card,3);
s.months[month].categoryQuotas['1'].card=8;s=solveAgain(s);
assert.deepEqual(c.categoryTotals(c.totals(s,month)[0]),{card:8,dawn:6});
delete s.months[month].categoryQuotas['1'].dawn;s=solveAgain(s);assert.equal(c.categoryTotals(c.totals(s,month)[0]).card,8);
// Larger dawn changes also recompute the red/blue split instead of keeping old shares.
s=arranged(month);s.months[month].categoryQuotas['1']={dawn:10};s=solveAgain(s);assert.equal(c.categoryTotals(c.totals(s,month)[0]).dawn,10);
// Manual locks and absences remain fixed across a quota change.
s=arranged(month);s.months[month].cells['1|2']={code:'R',block:'',locked:true};s.months[month].cells['3|15']={code:'',block:'OFF',locked:false};s.months[month].cells['4|16']={code:'',block:'VAC',locked:false};s.months[month].categoryQuotas['1']={dawn:3};
s=solveAgain(s);assert.deepEqual(c.cell(s.months[month],'1',2),{code:'R',block:'',locked:true});assert.equal(c.cell(s.months[month],'3',15).block,'OFF');assert.equal(c.cell(s.months[month],'4',16).block,'VAC');
// Impossible requests report their actual limit without a timeout or partial changes.
for(const[id,goal,blocked,max]of [['1',25,0,13],['9',10,0,6],['3',3,29,1]]){
 s=arranged(month);for(let d=1;d<=blocked;d++)s.months[month].cells[id+'|'+d]={code:'',block:'OFF',locked:false};s.months[month].categoryQuotas[id]={dawn:goal};
 const before=JSON.stringify(s),result=c.solve(s,month,{distribution:true});assert.equal(result.ok,false);assert.equal(result.reason,'quota');assert(result.message.includes('สูงสุด '+max));assert.equal(JSON.stringify(s),before);
}
console.log('PASS: 34 post-scheduling edits to 3, sequential independent goals, larger early quota, red-only staff, preserved locks/absence and immediate capacity explanations');
