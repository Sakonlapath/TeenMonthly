const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),c=require('../js/core');
const seed=JSON.parse(vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../js/data.js'),'utf8')+';JSON.stringify(SEED)'));
function fresh(month='2026-10'){
 const s=c.clone(seed);s.selected=month;s.months={[month]:c.freshMonth(month)};
 for(const d of [2,5,6,7,8,9,12,13,14])s.months[month].days[d].need.X=1;
 return s;
}
function arranged(s){
 const before=JSON.stringify(s),r=c.solve(s,s.selected,{distribution:true,ms:5000,nodes:180000});
 assert(r.ok,s.selected+' '+JSON.stringify(s.months[s.selected].quotas)+' '+r.message);assert.equal(JSON.stringify(s),before);s=c.clone(s);s.months[s.selected]=r.month;
 assert(c.audit(s,s.selected).complete);const ts=c.totals(s,s.selected),main=ts.filter(t=>['1','2','3','4'].includes(t.id));
 for(const id of ['5','6','7','9'])assert(ts.find(t=>t.id===id).total<=Math.min(...main.map(t=>t.total)));
 return s;
}
// Reallocate a previously filled month, without treating existing automatic cells as locks.
for(const month of ['2026-10','2026-11']){
 const first=arranged(fresh(month));
 for(const [id,goal]of [['1',10],['2',10],['3',12],['5',18],['8',18],['9',3]]){
  const s=c.clone(first);s.months[month].quotas={[id]:goal};s.months[month].categoryQuotas={};
  const next=arranged(s);assert.equal(c.totals(next,month).find(t=>t.id===id).total,goal);
 }
 // Several explicit totals, followed by another edit, must all be preserved.
 let s=c.clone(first);s.months[month].quotas={'1':14,'2':15,'3':15,'4':15,'5':12,'6':12,'7':12,'8':month==='2026-10'?15:12,'9':1};
 s=arranged(s);s.months[month].quotas['1']++;s.months[month].quotas['8']--;s=arranged(s);
 for(const [id,goal]of Object.entries(s.months[month].quotas))assert.equal(c.totals(s,month).find(t=>t.id===id).total,goal);
}
// An academic's requested total raises every main worker's lower bound, rather than
// allocating too much to another academic and discovering the conflict at the end.
let s=fresh();s.months[s.selected].quotas={'5':18};s=arranged(s);
assert(c.totals(s,s.selected).slice(0,4).every(t=>t.total>=18));
// A card-only goal of 22 exceeds the N/M/A streak limit; early duties are separate.
s=fresh();s.months[s.selected].categoryQuotas={'5':{card:22}};const overlong=c.solve(s,s.selected,{distribution:true});assert.equal(overlong.reason,'quota');assert(overlong.message.includes('ห้องบัตรไม่เกิน 2 วันติดกัน'));
// Rapeephan is a secondary main worker, not an academic subject to the ceiling.
s=fresh();s.pairExclusions=[];s.months[s.selected].excludedStaffIds=['5','6','7','9'];
for(const [d,day]of Object.entries(s.months[s.selected].days))day.need={N:0,M:+d<=12?1:0,A:0,R:0,X:0};
s=arrangedSecondary(s);
function arrangedSecondary(s){
 const r=c.solve(s,s.selected,{distribution:true});assert(r.ok,r.message);
 const next={...s,months:{[s.selected]:r.month}},ts=c.totals(next,s.selected),secondary=ts.find(t=>t.id==='8');
 assert(c.audit(next,s.selected).complete);
 assert.equal(ts.reduce((sum,t)=>sum+t.total,0),12);
 assert(secondary.total<=2,'secondary staff receive fewer shifts before the main group');
 assert(ts.slice(0,4).every(t=>c.totalPay(next,t)>c.totalPay(next,secondary)),'Rapeephan has the lowest income');
 assert(ts.slice(1,4).every(t=>t.total>=secondary.total),'scarce card shifts favor core staff before Rapeephan');
 return next;
}
// Impossible typed totals get a specific explanation without changing any cells.
for(const quotas of [{'1':0,'9':3},{'1':5,'5':6},{'9':10},{'5':23}]){
 s=fresh();s.months[s.selected].quotas=quotas;const before=JSON.stringify(s),r=c.solve(s,s.selected,{distribution:true,ms:1000,nodes:10000});
 assert.equal(r.ok,false);assert.equal(r.reason,'quota');assert(!r.message.includes('ไม่ทันเวลา'));assert.equal(JSON.stringify(s),before);
}
// The audit also flags manual violations of the same total rule.
s=fresh();s.months[s.selected].cells['5|1']={code:'M',block:'',locked:false};
assert(c.audit(s,s.selected,{distribution:true}).issues.some(i=>i.p==='5'&&i.text.includes('มากกว่าตัวหลัก')));
console.log('PASS: edited totals after scheduling, multiple exact targets, academic ceilings, main-first extras, secondary Rapeephan and immediate conflict explanations');
