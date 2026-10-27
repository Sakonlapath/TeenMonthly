const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),c=require('../js/core');
const seed=JSON.parse(vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../js/data.js'),'utf8')+';JSON.stringify(SEED)'));
function fresh(month){const s=c.clone(seed);s.selected=month;s.months={[month]:c.freshMonth(month)};return s}
// Public holidays replace a weekday's two-shift pattern. A holiday on a weekend
// does not add another four shifts; personal OFF/VAC never reduce monthly demand.
for(const [month,regular,holidays,card]of [['2026-10',22,9,80],['2026-11',21,9,78],['2027-02',20,8,72],['2028-02',21,8,74]]){
 const s=fresh(month);let d=c.calendarDemand(s,month);assert.deepEqual([d.regularDays,d.holidayDays,d.card],[regular,holidays,card]);
 const weekday=Object.keys(s.months[month].days).find(day=>![0,6].includes(c.weekday(month,day))),weekend=Object.keys(s.months[month].days).find(day=>[0,6].includes(c.weekday(month,day)));
 s.months[month].days[weekday].holiday=true;s.months[month].days[weekend].holiday=true;
 s.months[month].cells['1|'+weekday]={code:'',block:'VAC',locked:false};
 d=c.calendarDemand(s,month);assert.deepEqual([d.regularDays,d.holidayDays,d.card],[regular-1,holidays+1,card+2]);
 assert.deepEqual([d.needs[weekday].N,d.needs[weekday].M,d.needs[weekday].A],[1,2,1]);
 s.months[month].days[weekday].holiday=false;assert.equal(c.calendarDemand(s,month).card,card);
}
// Reproduce 122 requested versus an old 99-slot cache: seven weekday public
// holidays add 14 card shifts, and nine manually entered outreach dates add 9.
let s=fresh('2026-11'),month=s.selected,m=s.months[month];
m.autoCapacity=Object.fromEntries(Object.entries(m.days).map(([day,item])=>[day,c.clone(item.need)]));
for(const day of [2,3,4,5,6,9,10])m.days[day].holiday=true;
for(const day of [2,3,4,5,6,9,10,11,12])m.cells['9|'+day]={code:'X',block:'',locked:true};
m.cells['1|21']={code:'',block:'OFF',locked:false};m.cells['3|15']={code:'',block:'VAC',locked:false};
const original=JSON.stringify(s),demand=c.calendarDemand(s,month);assert.deepEqual([demand.card,demand.R,demand.X,demand.total],[92,21,9,122]);
const first=c.solve(s,month,{calendar:true,distribution:true,ms:3000});assert(first.ok,first.message);assert.equal(JSON.stringify(s),original);
assert.equal(first.month.autoCapacity,undefined);assert.equal(first.month.calendarRules,true);
const arranged={...s,months:{[month]:first.month}},ts=c.totals(arranged,month);
assert.equal(ts.reduce((sum,t)=>sum+c.categoryTotals(t).card,0),92);assert.equal(ts.reduce((sum,t)=>sum+t.total,0),122);assert(c.audit(arranged,month).complete);
m.categoryQuotas=Object.fromEntries(ts.map(t=>[t.id,c.categoryTotals(t)]));
const legacy=c.solve(s,month,{calendar:false,distribution:true});assert.equal(legacy.ok,false);assert(legacy.message.includes('99'));
const revised=c.solve(s,month,{calendar:true,distribution:true,ms:3000});assert(revised.ok,revised.message);
for(const t of c.totals({...s,months:{[month]:revised.month}},month))assert.deepEqual(c.categoryTotals(t),m.categoryQuotas[t.id]);
for(const [key,cell]of Object.entries(m.cells))assert.deepEqual(revised.month.cells[key],cell);
// Calendar mode never shrinks daily coverage to a lower set of entered totals.
s=fresh(month);s.months[month].quotas=Object.fromEntries(s.people.map(p=>[p.id,0]));let r=c.solve(s,month,{calendar:true,distribution:true});assert.equal(r.ok,false);assert(r.message.includes('วันธรรมดา 21 × 2 + วันหยุด 9 × 4'));assert(r.message.includes('ห้องบัตร 78'));assert(r.message.includes('รุ่งอรุณ 21'));
// Migration preserves cells, dates, targets and outreach settings, and is idempotent.
s=JSON.parse(original);s.months[month].categoryQuotas={'1':{card:10,dawn:3}};const cells=JSON.stringify(s.months[month].cells);
assert.equal(c.normalizeCalendarDemand(s,month),true);assert.equal(c.normalizeCalendarDemand(s,month),false);assert.equal(JSON.stringify(s.months[month].cells),cells);assert.deepEqual(s.months[month].categoryQuotas,{'1':{card:10,dawn:3}});assert.equal(c.calendarDemand(s,month).total,122);
console.log('PASS: calendar formula, special/weekend deduplication, leap year, 122-vs-99 regression, separate early counts, strict coverage, preserved locks/absence and migration');
