const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),c=require('../js/core');
const seed=JSON.parse(vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../js/data.js'),'utf8')+';JSON.stringify(SEED)'));
function random(seed){return()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return(seed>>>0)/4294967296}}
function fresh(month){const s=c.clone(seed);s.selected=month;s.months={[month]:c.freshMonth(month)};for(const d of [2,5,6,7,8,9,12,13,14])s.months[month].days[d].need.X=1;return s}
const signature=(s,m)=>s.people.map(p=>Array.from({length:c.daysIn(s.selected)},(_,i)=>c.cell(m,p.id,i+1).code).join(',')).join('|');
function arrange(s,rng,vary=true){const before=JSON.stringify(s),r=c.solve(s,s.selected,{distribution:true,calendar:true,vary,random:rng});assert(r.ok,r.message);assert.equal(JSON.stringify(s),before);const next=c.clone(s);next.months[s.selected]=r.month;assert(c.audit(next,next.selected).complete);return{state:next,result:r,counts:c.totals(next,next.selected)}}
for(const month of ['2026-10','2026-11','2027-02']){
 const s=fresh(month),m=s.months[month];m.cells['2|20']={code:'',block:'OFF',locked:false};m.cells['3|21']={code:'',block:'VAC',locked:false};m.cells['9|2']={code:'X',block:'',locked:true};
 s.months[c.monthOffset(month,-1)]=c.freshMonth(c.monthOffset(month,-1));const prev=c.daysIn(c.monthOffset(month,-1));s.months[c.monthOffset(month,-1)].cells['4|'+prev]={code:'A',block:'',locked:true};
 const baseline=arrange(s,random(1),false),variants=new Set();
 // A cleared calendar can produce multiple layouts without changing any code count/pay.
 for(const seedNumber of [11,22,33,44]){const r=arrange(s,random(seedNumber));variants.add(signature(s,r.result.month));assert.deepEqual(r.counts,baseline.counts);for(const[k,value]of Object.entries(m.cells))assert.deepEqual(r.result.month.cells[k],value)}
 assert.equal(variants.size,4,'different random streams generate different valid calendars');
 // Repeated clicks also work on the quota-repair fast path, where the previous
 // complete schedule was formerly returned unchanged.
 let current=baseline.state,previous=signature(current,current.months[month]);current.months[month].categoryQuotas=Object.fromEntries(baseline.counts.map(t=>[t.id,c.categoryTotals(t)]));
 for(let i=1;i<=4;i++){const r=arrange(current,random(i)),next=signature(current,r.result.month);assert.equal(r.result.reallocated,true);assert.notEqual(next,previous);assert.deepEqual(r.counts,baseline.counts);current=r.state;previous=next;}
}
// A uniquely constrained calendar is allowed to stay unchanged and never unlocks cells.
const s={people:[{id:'a',name:'A',role:'',active:true,allowed:['N'],prev:'',next:''}],selected:'2026-11',months:{'2026-11':c.freshMonth('2026-11')},pairExclusions:[]};
for(const day of Object.values(s.months[s.selected].days))day.need={N:0,M:0,A:0,R:0,X:0};s.months[s.selected].days[1].need.N=1;
for(const locked of [false,true]){s.months[s.selected].cells={'a|1':{code:'N',block:'',locked}};const r=c.solve(s,s.selected,{vary:true,random:random(7)});assert(r.ok,r.message);assert.equal(c.cell(r.month,'a',1).code,'N');assert.equal(c.cell(r.month,'a',1).locked,locked);assert(c.audit({...s,months:{[s.selected]:r.month}},s.selected).complete)}
console.log('PASS: multiple fresh layouts, repeated exact-goal scheduling, identical pay/code counts, locks, leave, month boundaries and unique solutions');
