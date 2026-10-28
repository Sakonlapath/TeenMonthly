const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),c=require('../js/core');
const seed=JSON.parse(vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../js/data.js'),'utf8')+';JSON.stringify(SEED)'));
const month='2026-11',s=c.clone(seed);s.selected=month;s.months={[month]:c.freshMonth(month)};const m=s.months[month];m.excludedStaffIds=['9'];
// The manual reference has eight staff, 78 card shifts and 21 KIOS shifts.
// Absences follow the supplied November scenario; red ink on this reference
// denotes KIOS, not additional outreach demand.
for(const[id,off,vac]of [['1',[21,22],[23,24]],['3',[14,15],[13]],['4',[3,4,5,12],[2]],['5',[1],[]],['7',[1,21,22,23,24],[25]],['8',[23],[24,25]]])for(const[days,block]of [[off,'OFF'],[vac,'VAC']])for(const d of days)m.cells[id+'|'+d]={code:'',block,locked:false};
const desired=[['1',9,3],['2',14,2],['3',14,2],['4',14,3],['5',6,2],['6',6,3],['7',6,3],['8',9,3]];
for(const exact of [false,true]){
 const input=c.clone(s);if(exact)input.months[month].categoryQuotas=Object.fromEntries(desired.map(([id,card,dawn])=>[id,{card,dawn}]));
 const before=JSON.stringify(input),r=c.solve(input,month,{distribution:true,calendar:true,vary:true});assert(r.ok,r.message);assert.equal(JSON.stringify(input),before);
 const next={...input,months:{[month]:r.month}},ts=c.totals(next,month);assert(c.audit(next,month).complete);assert.equal(ts.reduce((a,t)=>a+t.total,0),99);
 for(const p of c.monthPeople(next,month)){let card=0,all=0;for(let d=1;d<=30;d++){const code=c.cell(r.month,p.id,d).code;card=c.CARD_CODES.includes(code)?card+1:0;all=c.CODES.includes(code)?all+1:0;assert(card<=2);assert(all<=3)}}
 for(const[k,cell]of Object.entries(m.cells))assert.deepEqual(r.month.cells[k],cell);
 if(exact)for(const[id,card,dawn]of desired)assert.deepEqual(c.categoryTotals(ts.find(t=>t.id===id)),{card,dawn});
}
console.log('PASS: November manual-reference totals, 99 shifts, exact/automatic shares, preserved leave, card limit 2 and combined limit 3');
