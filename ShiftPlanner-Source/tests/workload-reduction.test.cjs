const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),c=require('../js/core');
const seed=JSON.parse(vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../js/data.js'),'utf8')+';JSON.stringify(SEED)'));
const month='2026-11',options={calendar:true,distribution:true,ms:1500,nodes:20000};
function fresh(){const s=c.clone(seed);s.selected=month;s.months={[month]:c.freshMonth(month)};s.months[month].categoryQuotas={};for(let d=1;d<=14;d++)s.months[month].days[d].need.X=1;return s}
function recalculate(s){const before=JSON.stringify(s),result=c.solve(s,month,options);assert(result.ok,result.message);assert.equal(JSON.stringify(s),before);const next={...s,months:{[month]:result.month}};assert(c.audit(next,month).complete);assert.equal(c.totals(next,month).reduce((sum,t)=>sum+t.total,0),113);return next}
// Real post-generation local minimum: reducing dawn from 6 to 4 after earlier
// edits requires moving existing red dates before redistributing the surplus.
const rows=[
 '....XN.M..RNRM..RAA.......A.M.',
 '.N.AA.N.N.XA.M...N.A.MRN.RN.MN',
 'AA.N..AA...X.NM.A.R.MM.RNN.NA.',
 'M.N...XNA.A.NXNN..NRMA.A.A.M..',
 'MR.R..M..R..X.A.N...N......M.R',
 '..X.RAM.RN...AM.....A.....R...',
 'X.R..R.MXA.....R.R...NA.A...N.',
 'N.A.N....XNRA..A...N..N.R..A.A',
 '.X.X.X.X......................'
];
let s=fresh();rows.forEach((row,i)=>{assert.equal(row.length,30);[...row].forEach((code,d)=>{if(code!=='.')s.months[month].cells[(i+1)+'|'+(d+1)]={code,block:'',locked:false}})});
assert(c.audit(s,month,{distribution:true}).issues.some(i=>i.type==='consecutive'),'legacy calendar must be rebuilt under the combined work limit');
for(const [i,dawn]of [4,3,3,3,5,4,4,3].entries())s.months[month].categoryQuotas[String(i+1)]={dawn};
s=recalculate(s);assert.equal(c.categoryTotals(c.totals(s,month).find(t=>t.id==='7')).dawn,4);
// Lower each field after a generated calendar, retaining OFF/VAC and a lock.
let original=fresh();for(const [id,off,vac]of [['1',[21,22],[23,24]],['3',[14,15],[13]],['4',[2,3,4,5,12],[]],['5',[1],[]],['7',[1,21,22,23,24],[25]],['8',[23],[24,25]]])for(const [days,block]of [[off,'OFF'],[vac,'VAC']])for(const d of days)original.months[month].cells[id+'|'+d]={code:'',block,locked:false};
original=recalculate(original);const lockedKey=Object.keys(original.months[month].cells).find(k=>k.startsWith('9|')&&original.months[month].cells[k].code);original.months[month].cells[lockedKey].locked=true;
for(const category of ['card','dawn','total'])for(const p of original.people){const t=c.totals(original,month).find(t=>t.id===p.id),value=category==='total'?t.total:c.categoryTotals(t)[category];if(value<3)continue;const edit=c.clone(original),target=value-2;if(category==='total')edit.months[month].quotas[p.id]=target;else edit.months[month].categoryQuotas[p.id]={[category]:target};const next=recalculate(edit),actual=c.totals(next,month).find(t=>t.id===p.id);assert.equal(category==='total'?actual.total:c.categoryTotals(actual)[category],target);for(const [k,cell]of Object.entries(original.months[month].cells))if(cell.block||cell.locked)assert.deepEqual(next.months[month].cells[k],cell)}
// Red-only staff cannot absorb card surplus, even when they have no typed goal.
for(const goals of [[6,12,13,14,5,7,9,10],Array(8).fill(0)]){s=fresh();goals.forEach((card,i)=>s.months[month].categoryQuotas[String(i+1)]={card});const before=JSON.stringify(s),result=c.solve(s,month,options);assert.equal(result.ok,false);assert.equal(result.reason,'quota');assert.match(result.message,/78/);assert.equal(JSON.stringify(s),before)}
console.log('PASS: lowered card/dawn/total targets redistribute 113 shifts, escape a multi-goal local minimum, preserve leave/locks and explain impossible surplus');
