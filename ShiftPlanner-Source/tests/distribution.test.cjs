const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),c=require('../js/core');
const seed=JSON.parse(vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../js/data.js'),'utf8')+';JSON.stringify(SEED)'));
function fresh(month='2026-10'){const s=c.clone(seed);s.selected=month;s.months={[month]:c.freshMonth(month)};return s}
function redDays(s,days){for(const d of days)s.months[s.selected].days[d].need.X=1;return s}
const dates=[2,5,6,7,8,9,12,13,14];
let s=fresh(),plan=c.distributionPlan(s,s.selected);
assert.equal(plan.weekdays,22);assert.equal(plan.totalR,22);assert.equal(plan.rIds.length,8);
assert.equal(plan.rMin,2);assert.equal(plan.rMax,3);assert.equal(plan.remainder,6);
assert.equal(plan.rIds.includes('9'),false);assert.equal(plan.xIds.length,9);
assert.equal(c.dawnTargets(s,s.selected)['9'],undefined);
for(const count of [0,1,3,8]){
 s=redDays(fresh(),dates.slice(0,count));const before=JSON.stringify(s),result=c.solve(s,s.selected,{distribution:true});
 assert(result.ok,result.message);assert.equal(JSON.stringify(s),before);
 const arranged={...s,months:{[s.selected]:result.month}},ts=c.totals(arranged,s.selected);
 assert(c.audit(arranged,s.selected).complete);
 assert.deepEqual(ts.filter(t=>t.X>0).map(t=>t.id),seed.people.slice(0,count).map(p=>p.id),'scarce red shifts go to main staff before others');
}
for(const month of ['2026-10','2026-11','2027-02']){
 s=redDays(fresh(month),dates);const m=s.months[month];
 m.cells['2|20']={code:'',block:'OFF',locked:false};m.cells['3|21']={code:'',block:'VAC',locked:false};
 m.cells['9|2']={code:'X',block:'',locked:true};
 const before=JSON.stringify(s),result=c.solve(s,month,{distribution:true});assert(result.ok,month+': '+result.message);
 assert.equal(JSON.stringify(s),before);assert.equal(result.month.distributionRules,true);
 const arranged={...s,months:{[month]:result.month}},ts=c.totals(arranged,month),p=c.distributionPlan(arranged,month);
 assert(c.audit(arranged,month).complete);assert.equal(ts.find(t=>t.id==='9').R,0);
 for(const id of p.xIds)assert.equal(ts.find(t=>t.id===id).X,1,'one red shift each');
 for(const id of p.rIds){const t=ts.find(t=>t.id===id);assert(t.R===p.rMin||t.R===p.rMax)}
 assert.equal(ts.filter(t=>p.rIds.includes(t.id)&&t.R===p.rMax).length,p.remainder||p.rIds.length);
 for(const[k,v]of Object.entries(m.cells))assert.deepEqual(result.month.cells[k],v);
 const missing=c.clone(arranged);for(const[k,v]of Object.entries(missing.months[month].cells))if(k.startsWith('9|')&&v.code==='X')v.code='';
 assert(c.audit(missing,month).issues.some(i=>i.type==='distribution'&&i.p==='9'));
 const rerun=c.solve(arranged,month);assert(rerun.ok,rerun.message);assert(c.audit({...arranged,months:{[month]:rerun.month}},month).complete);
}
// Membership and eligibility determine the divisors, never the raw roster size.
s=redDays(fresh(),dates.slice(0,8));s.months[s.selected].excludedStaffIds=['8'];
plan=c.distributionPlan(s,s.selected);assert.equal(plan.rIds.length,7);assert.equal(plan.xIds.length,8);
let result=c.solve(s,s.selected,{distribution:true});assert(result.ok,result.message);
assert.equal(c.totals({...s,months:{[s.selected]:result.month}},s.selected).find(t=>t.id==='8').total,0);
// A zero personal target leaves the available shifts for other staff.
s=redDays(fresh(),dates);s.months[s.selected].categoryQuotas={'1':{card:0,dawn:0}};
result=c.solve(s,s.selected,{distribution:true});assert(result.ok,result.message);assert.equal(c.totals({...s,months:{[s.selected]:result.month}},s.selected)[0].total,0);
// Locks are preserved even above the previous blue ceiling; unavailable staff are skipped.
s=redDays(fresh(),dates);for(const d of [1,2,5,6])s.months[s.selected].cells['1|'+d]={code:'R',block:'',locked:true};
result=c.solve(s,s.selected,{distribution:true});assert(result.ok,result.message);assert(c.totals({...s,months:{[s.selected]:result.month}},s.selected)[0].R>=4);
s=redDays(fresh(),dates);for(const d of dates)s.months[s.selected].cells['1|'+d]={code:'',block:'OFF',locked:false};
const before=JSON.stringify(s);result=c.solve(s,s.selected,{distribution:true});assert(result.ok,result.message);assert.equal(JSON.stringify(s),before);assert.equal(c.totals({...s,months:{[s.selected]:result.month}},s.selected)[0].X,0);
// Flexible card demand still keeps every selected red/blue shift open.
s=redDays(fresh(),dates);s.months[s.selected].categoryQuotas=Object.fromEntries(s.people.map(p=>[p.id,{card:0,dawn:p.id==='9'?1:['7','8'].includes(p.id)?3:4}]));
result=c.solve(s,s.selected,{distribution:true});assert(result.ok,result.message);
assert.equal(c.totals({...s,months:{[s.selected]:result.month}},s.selected).reduce((sum,t)=>sum+t.R+t.X,0),31);
assert(c.audit({...s,months:{[s.selected]:result.month}},s.selected).complete);
// Extensive OFF/VAC reduces card work, while blue dawn distribution stays normal.
s=redDays(fresh(),dates);for(let d=1;d<=20;d++)s.months[s.selected].cells['3|'+d]={code:'',block:d%2?'OFF':'VAC',locked:false};
plan=c.distributionPlan(s,s.selected);assert.deepEqual(['2','3','4'].map(id=>plan.preferredR[id]),[3,3,3]);
result=c.solve(s,s.selected,{distribution:true});assert(result.ok,result.message);
let ts=c.totals({...s,months:{[s.selected]:result.month}},s.selected),mainGroup=ts.filter(t=>['2','3','4'].includes(t.id));
assert.deepEqual(mainGroup.map(t=>t.R),[3,3,3]);assert(c.categoryTotals(mainGroup[1]).card<c.categoryTotals(mainGroup[0]).card);assert(c.categoryTotals(mainGroup[1]).card<c.categoryTotals(mainGroup[2]).card);assert(new Set(mainGroup.map(t=>t.total)).size>1);
for(const d of Array.from({length:20},(_,i)=>i+1))assert.equal(c.cell(result.month,'3',d).block,d%2?'OFF':'VAC');
assert(c.audit({...s,months:{[s.selected]:result.month}},s.selected).complete);
// Unequal personal dawn targets remain supported.
s=redDays(fresh(),dates);const goals=[4,5,2,5,4,4,3,3,1];s.months[s.selected].categoryQuotas=Object.fromEntries(s.people.map((p,i)=>[p.id,{card:0,dawn:goals[i]}]));
result=c.solve(s,s.selected,{distribution:true});assert(result.ok,result.message);
ts=c.totals({...s,months:{[s.selected]:result.month}},s.selected);assert.deepEqual(ts.map(t=>t.R+t.X),goals);assert(c.audit({...s,months:{[s.selected]:result.month}},s.selected).complete);
// Card goals for 2–4 are also independent and can differ in a complete schedule.
s=fresh();for(const[d,day]of Object.entries(s.months[s.selected].days))day.need={N:0,M:+d<=10?1:0,A:0,R:0,X:0};
const cardGoals=[1,3,2,4,0,0,0,0,0];s.months[s.selected].categoryQuotas=Object.fromEntries(s.people.map((p,i)=>[p.id,{card:cardGoals[i],dawn:0}]));
result=c.solve(s,s.selected,{distribution:true});assert(result.ok,result.message);
ts=c.totals({...s,months:{[s.selected]:result.month}},s.selected);assert.deepEqual(ts.map(t=>c.categoryTotals(t).card),cardGoals);assert(c.audit({...s,months:{[s.selected]:result.month}},s.selected).complete);
// A genuine shortage of available people on a day still cannot be bypassed.
s=redDays(fresh(),dates);for(const p of s.people.filter(p=>p.id!=='9'))s.months[s.selected].cells[p.id+'|1']={code:'',block:'OFF',locked:false};
result=c.solve(s,s.selected,{distribution:true});assert.equal(result.reason,'capacity');
// Scarce blue shifts also go to main staff without forcing equal dawn totals.
s=fresh();for(const day of Object.values(s.months[s.selected].days))day.need={N:0,M:0,A:0,R:0,X:0};s.months[s.selected].days[1].need.R=1;s.months[s.selected].days[2].need.R=1;
result=c.solve(s,s.selected,{distribution:true});assert(result.ok,result.message);
ts=c.totals({...s,months:{[s.selected]:result.month}},s.selected);assert.deepEqual(ts.filter(t=>t.R).map(t=>t.id),['1','2']);assert(c.audit({...s,months:{[s.selected]:result.month}},s.selected).complete);
// Matching leaves an unavailable main member out before considering other staff.
s=fresh();for(const day of Object.values(s.months[s.selected].days))day.need={N:0,M:0,A:0,R:0,X:0};s.months[s.selected].days[2].need.X=1;s.months[s.selected].days[3].need.X=1;
for(const id of ['1','2'])s.months[s.selected].cells[id+'|3']={code:'',block:'OFF',locked:false};s.months[s.selected].cells['3|2']={code:'',block:'VAC',locked:false};
assert.deepEqual(c.distributionPlan(s,s.selected).xRequired,['1','3']);
result=c.solve(s,s.selected,{distribution:true});assert(result.ok,result.message);
ts=c.totals({...s,months:{[s.selected]:result.month}},s.selected);assert.deepEqual(ts.filter(t=>t.X).map(t=>t.id),['1','3']);
console.log('PASS: main-first shortage priority, quotient/remainder, Oct/Nov/Feb, only-X staff, membership, repeat scheduling, locks, leave redistribution, independent dawn goals and genuine shortages');
