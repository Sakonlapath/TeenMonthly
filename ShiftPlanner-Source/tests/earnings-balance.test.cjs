const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),c=require('../js/core');
const seed=JSON.parse(vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../js/data.js'),'utf8')+';JSON.stringify(SEED)'));
function fresh(month='2026-11',red=false){const s=c.clone(seed);s.selected=month;s.months={[month]:c.freshMonth(month)};if(red)for(const d of [2,5,6,7,8,9,12,13,14])s.months[month].days[d].need.X=1;return s}
function arrange(s){
 const before=JSON.stringify(s),r=c.solve(s,s.selected,{distribution:true,calendar:true});assert(r.ok,r.message);assert.equal(JSON.stringify(s),before);
 const next=c.clone(s);next.months[s.selected]=r.month;assert(c.audit(next,next.selected).complete,'pay balancing must preserve every hard constraint');
 return{state:next,ts:c.totals(next,next.selected)};
}
const spread=values=>Math.max(...values)-Math.min(...values);
// Income for supplemental academics targets 500–700 below the mean of 2–4.
for(const month of ['2026-10','2026-11','2027-02'])for(const red of [false,true]){
 const {state,ts}=arrange(fresh(month,red)),core=ts.slice(1,4),academics=ts.slice(4,7),card=t=>c.categoryTotals(t).card;
 const mean=core.reduce((sum,t)=>sum+c.totalPay(state,t),0)/core.length;
 for(const t of academics){const gap=mean-c.totalPay(state,t);assert(gap>=450&&gap<=750,'income gap stays near 500–700 despite whole shifts: '+gap)}
 assert(Math.min(...core.map(card))>Math.max(...academics.map(card)));
 assert(card(ts[7])>Math.max(...academics.map(card)));
 assert(spread(academics.map(t=>t.total))<=1);
 assert.equal(ts[8].total,red?1:0);
 assert.deepEqual(arrange(state).ts,ts);
}
// Editable rates change the number needed, instead of fixing academics at two.
let s=fresh();s.payRates['5']={card:1300,dawn:80};let result=arrange(s);
assert(c.categoryTotals(result.ts[4]).card<c.categoryTotals(result.ts[5]).card);
assert.equal(c.totalPay(result.state,result.ts[4]),c.categoryTotals(result.ts[4]).card*1300+c.categoryTotals(result.ts[4]).dawn*80);
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
console.log('PASS: primary-first workloads including medical records, near-equal academic counts, main workloads, repeat scheduling, custom/zero rates, exact goals, leave, locks and membership');
