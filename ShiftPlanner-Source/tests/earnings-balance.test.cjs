const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),c=require('../js/core');
const seed=JSON.parse(vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../js/data.js'),'utf8')+';JSON.stringify(SEED)'));
function fresh(month='2026-11',red=false){const s=c.clone(seed);s.selected=month;s.months={[month]:c.freshMonth(month)};if(red)for(const d of [2,5,6,7,8,9,12,13,14])s.months[month].days[d].need.X=1;return s}
function arrange(s){
 const before=JSON.stringify(s),r=c.solve(s,s.selected,{distribution:true,calendar:true});assert(r.ok,r.message);assert.equal(JSON.stringify(s),before);
 const next=c.clone(s);next.months[s.selected]=r.month;assert(c.audit(next,next.selected).complete,'pay balancing must preserve every hard constraint');
 return{state:next,ts:c.totals(next,next.selected)};
}
const spread=values=>Math.max(...values)-Math.min(...values);
// Main 2–4 > medical records > academics > Rapeephan in income. Workloads
// are highest for 2–4, low for academics, and similar for records/Rapeephan.
for(const month of ['2026-10','2026-11','2027-02'])for(const red of [false,true]){
 const s=fresh(month,red),{state,ts}=arrange(s),paid=ts.slice(0,8),academics=ts.slice(4,7),core=ts.slice(1,4);
 const pay=t=>c.totalPay(state,t),stat=ts[0],secondary=ts[7];
 assert(Math.min(...core.map(pay))>pay(stat),'every core worker earns most');
 assert(pay(stat)>Math.max(...academics.map(pay)),'medical records earns second');
 assert(Math.min(...academics.map(pay))>pay(secondary),'academics earn above Rapeephan');
 assert(Math.min(...academics.map(pay))-pay(secondary)<=650,'Rapeephan remains close to academics');
 assert(Math.abs(stat.total-secondary.total)<=2,'Rapeephan works a similar number of shifts to medical records');
 assert(Math.min(...core.map(t=>t.total))>Math.max(...ts.filter(t=>!['2','3','4'].includes(t.id)).map(t=>t.total)));
 assert(spread(paid.map(pay))<=1300,'avoid large gaps while preserving the income order');
 assert(spread(academics.map(t=>t.total))<=1,'same-rate academics have near-equal total workloads');
 assert(spread(academics.map(t=>c.categoryTotals(t).card))<=1);
 assert(Math.min(...core.map(t=>t.total))>Math.max(...academics.map(t=>t.total)));
 assert(Math.min(...core.map(t=>c.categoryTotals(t).card))>Math.max(...academics.map(t=>c.categoryTotals(t).card)));
 assert.equal(ts[8].total,red?1:0,'X-only staff are not given other work to force pay equality');
 const again=arrange(state);assert.deepEqual(again.ts,ts,'repeated automatic scheduling keeps the same fair totals');
}
// Use editable rates rather than fixed staff IDs or an assumed salary ratio.
let s=fresh();s.payRates['5']={card:1300,dawn:80};let result=arrange(s);
assert(c.categoryTotals(result.ts[4]).card<c.categoryTotals(result.ts[5]).card);
assert(spread(result.ts.slice(0,8).map(t=>c.totalPay(result.state,t)))<=2600);
// Leave and locks override pay parity without causing infeasibility.
s=fresh();for(let d=1;d<=20;d++)s.months[s.selected].cells['3|'+d]={code:'',block:d%2?'OFF':'VAC',locked:false};
s.months[s.selected].cells['1|1']={code:'M',block:'',locked:true};result=arrange(s);
for(const[k,value]of Object.entries(s.months[s.selected].cells))assert.deepEqual(result.state.months[s.selected].cells[k],value);
assert(result.ts[2].total<result.ts[1].total);
// Explicit targets remain exact even when they deliberately make income unequal.
s=fresh();s.months[s.selected].categoryQuotas={'5':{card:8},'1':{dawn:3}};result=arrange(s);
assert.equal(c.categoryTotals(result.ts[4]).card,8);assert.equal(c.categoryTotals(result.ts[0]).dawn,3);
s=result.state;s.months[s.selected].quotas={'2':12};result=arrange(s);assert.equal(result.ts[1].total,12);assert.equal(c.categoryTotals(result.ts[4]).card,8);
// A zero rate and an excluded person never cause division by zero or extra duties.
s=fresh();s.payRates['5']={card:0,dawn:0};s.months[s.selected].excludedStaffIds=['8'];result=arrange(s);
assert.equal(result.ts[7].total,0);assert(result.ts.every(t=>Number.isFinite(c.totalPay(result.state,t))));
console.log('PASS: rate-based income balance, near-equal academic counts, main workloads, repeat scheduling, custom/zero rates, exact goals, leave, locks and membership');
