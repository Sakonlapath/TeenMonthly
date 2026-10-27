const assert=require('node:assert/strict'),c=require('../js/core');
const s={selected:'2026-11',people:Array.from({length:8},(_,i)=>({id:String(i+1),name:'Person '+(i+1),active:true,allowed:['R','X']})),months:{'2026-11':c.freshMonth('2026-11')}};
for(let d=1;d<=30;d++)s.months[s.selected].days[d].need={N:0,M:0,A:0,R:d<=22?1:0,X:0};
assert.deepEqual(Object.values(c.dawnTargets(s,s.selected)),[3,3,3,3,3,3,2,2]);
let r=c.solve(s,s.selected);assert(r.ok,r.message);s.months[s.selected]=r.month;
assert.deepEqual(c.totals(s,s.selected).map(t=>t.R),[3,3,3,3,3,3,2,2]);
// Exercise legacy total-only targets separately from the new category targets.
delete s.months[s.selected].categoryQuotas;
assert.deepEqual(c.quotaTargets(s,s.selected,{'3':4}),{'2':4,'3':4,'4':4});
for(const bad of [{'1':-1},{'2':1.5},{'1':31},{'2':3,'3':4}])assert.throws(()=>c.quotaTargets(s,s.selected,bad));
let custom=c.clone(s);custom.months[s.selected].quotas={'1':0,'2':4,'3':4,'4':4,'5':4,'6':2,'7':2,'8':2};
r=c.solve(custom,s.selected);assert(r.ok,r.message);custom.months[s.selected]=r.month;
assert.deepEqual(c.totals(custom,s.selected).map(t=>t.total),[0,4,4,4,4,2,2,2]);
let manual=c.clone(s);manual.months[s.selected].cells['1|1']={code:'R',block:'',locked:true};manual.months[s.selected].quotas={'1':5};
let before=JSON.stringify(manual);assert.equal(c.solve(manual,s.selected).reason,'fixed');assert.equal(JSON.stringify(manual),before);
assert(c.audit(manual,s.selected).issues.some(i=>i.type==='quota'));
let pair=c.clone(s);pair.months[s.selected]=c.freshMonth(s.selected);pair.months[s.selected].cells['8|2']={code:'X',block:'',locked:true};
before=JSON.stringify(pair);assert.equal(c.manualRange(pair,s.selected,'1',1,3,'R').ok,false);assert.equal(JSON.stringify(pair),before);
console.log('PASS: exact R remainder, shared target, invalid targets, custom targets with R relaxation, frozen incomplete row, atomic pair exclusion');
