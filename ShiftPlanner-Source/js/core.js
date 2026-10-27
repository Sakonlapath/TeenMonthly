/* Shift planner constraint engine. Pure functions shared by UI and checks. */
const CODES=['N','M','A','R','X'];
const META={N:{label:'ด',name:'ดึก',time:'00:00–08:00',hours:8},M:{label:'ช',name:'เช้า',time:'08:00–16:00',hours:8},A:{label:'บ',name:'บ่าย',time:'16:00–00:00',hours:8},R:{label:'ร',name:'รุ่งอรุณ · ห้องบัตร',time:'06:30–08:30',hours:2},X:{label:'ร',name:'ออกรพ.สต.',time:'06:30–08:30',hours:2}};
const DEFAULT_PAY_RATES={'1':520,'2':330,'3':330,'4':330,'5':650,'6':650,'7':650,'8':390};
const DEFAULT_PAIR_EXCLUSIONS=[['1','8']];
const MAIN_STAFF_IDS=['1','2','3','4'];
const WEEKDAY_NIGHT_IDS=['2','3','4','5'];
const SHIFT_GROUPS=[{id:'card',label:'รวมห้องบัตร',codes:['N','M','A']},{id:'dawn',label:'รวมเวรรุ่งอรุณห้องบัตร',codes:['R']},{id:'outreach',label:'รวมเวร รพ.สต.',codes:['X']}];
const SHIFT_GROUP_BY_CODE=Object.fromEntries(SHIFT_GROUPS.flatMap(g=>g.codes.map(code=>[code,g.id])));
const clone=x=>JSON.parse(JSON.stringify(x));
const key=(p,d)=>p+'|'+d;
function isExcludedPair(a,b,excl){return!!excl&&excl.some(([x,y])=>(a===x&&b===y)||(a===y&&b===x))}
function daysIn(month){let [y,m]=month.split('-').map(Number);return new Date(y,m,0).getDate()}
function weekday(month,d){let[y,m]=month.split('-').map(Number);return new Date(y,m-1,d).getDay()}
function monthOffset(month,off){let[y,m]=month.split('-').map(Number),dt=new Date(y,m-1+off,1);return dt.getFullYear()+'-'+String(dt.getMonth()+1).padStart(2,'0')}
function freshMonth(month){let days={};for(let d=1;d<=daysIn(month);d++){let wk=weekday(month,d)>0&&weekday(month,d)<6;days[d]={holiday:false,note:'',need:{N:1,M:wk?0:2,A:1,R:wk?1:0,X:0}}}return{cells:{},days}}
function cell(m,p,d){return m.cells[key(p,d)]||{code:'',block:'',locked:false}}
function manualPeople(m){return new Set(Object.entries(m.cells).filter(([,c])=>c.code&&c.locked).map(([k])=>k.split('|')[0]))}
function group(state){return state.people.slice(1,4).map(p=>p.id)}
function eligibleOnDay(p,month,d,code){return p.active&&p.allowed.includes(code)&&(code!=='N'||[0,6].includes(weekday(month,d))||WEEKDAY_NIGHT_IDS.includes(p.id))}
function restConflict(previous,next){return previous==='A'&&['N','R','X'].includes(next)}
function restDescription(next){return next==='N'?'บ่ายต่อดึก':next==='R'?'บ่ายต่อรุ่งอรุณห้องบัตร':'บ่ายต่อเวร รพ.สต.'}
function categoryTotals(t){return{card:t.N+t.M+t.A,dawn:t.R,outreach:t.X}}
function categoryTargets(state,month,raw=state.months[month].categoryQuotas||{}){
 const result={},ids=new Set(state.people.map(p=>p.id)),n=daysIn(month);
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('เป้าหมายแยกประเภทไม่ถูกต้อง');
 for(const[id,values]of Object.entries(raw)){
  if(!ids.has(id)||!values||typeof values!=='object'||Array.isArray(values))throw Error('เป้าหมายแยกประเภทไม่ถูกต้อง');
  const targets={};for(const[category,v]of Object.entries(values)){
   if(!SHIFT_GROUPS.some(g=>g.id===category))throw Error('ประเภทเป้าหมายไม่ถูกต้อง');
   if(v===''||v===null||v===undefined)continue;
   if(!Number.isInteger(Number(v))||Number(v)<0||Number(v)>n)throw Error('เป้าหมายเวรต้องเป็นจำนวนเต็ม 0–'+n);
   targets[category]=Number(v);
  }
  if(Object.values(targets).reduce((a,b)=>a+b,0)>n)throw Error('เป้าหมายทั้ง 3 ประเภทรวมกันต้องไม่เกิน '+n+' เวรต่อคน');
  if(Object.keys(targets).length)result[id]=targets;
 }
 return result;
}
function quotaTargets(state,month,raw=state.months[month].quotas||state.quotas||{}){
 const targets={},ids=new Set(state.people.map(p=>p.id)),n=daysIn(month),categories=categoryTargets(state,month);
 for(const[id,v]of Object.entries(raw)){if(v===''||v===null||v===undefined)continue;if(!ids.has(id)||!Number.isInteger(Number(v))||Number(v)<0||Number(v)>n)throw Error('เป้าหมายเวรต้องเป็นจำนวนเต็ม 0–'+n);targets[id]=Number(v)}
 for(const[id,values]of Object.entries(categories))if(SHIFT_GROUPS.every(g=>values[g.id]!==undefined))targets[id]=Object.values(values).reduce((a,b)=>a+b,0);
 const g=group(state),values=g.filter(id=>targets[id]!==undefined).map(id=>targets[id]);
 if(new Set(values).size>1){if(g.some(id=>SHIFT_GROUPS.every(kind=>categories[id]?.[kind.id]!==undefined)))return targets;throw Error('เป้าหมายคนลำดับ 2–4 ต้องเท่ากัน')}
 if(values.length)g.forEach(id=>targets[id]=values[0]);return targets;
}
function payRate(state,id){return state.payRates?.[id]??DEFAULT_PAY_RATES[id]??0}
function dawnTargets(state,month){
 const roster=state.people.filter(p=>p.active&&p.allowed.includes('R'));
 const main=new Set(state.people.slice(0,4).map(p=>p.id));
 const ordered=[...roster.filter(p=>main.has(p.id)),...roster.filter(p=>!main.has(p.id))];
 const total=Object.values(state.months[month].days).reduce((s,d)=>s+d.need.R,0),base=Math.floor(total/Math.max(1,roster.length)),remainder=total%Math.max(1,roster.length);
 return Object.fromEntries(ordered.map((p,i)=>[p.id,base+(i<remainder?1:0)]));
}
function boundary(state,month,p,side){let adjacent=state.months[monthOffset(month,side)],n=side<0?daysIn(monthOffset(month,-1)):1;let actual=adjacent?cell(adjacent,p.id,n).code:'';let configured=state.months[month].boundaries?.[p.id]?.[side<0?'prev':'next'];return adjacent?actual:(configured??p[side<0?'prev':'next']??'')}
function totals(state,month){let m=state.months[month];return state.people.map(p=>{let t={id:p.id,total:0,hours:0,OFF:0,VAC:0,N:0,M:0,A:0,R:0,X:0};for(let d=1;d<=daysIn(month);d++){let c=cell(m,p.id,d);if(CODES.includes(c.code)){t[c.code]++;t.total++;t.hours+=META[c.code].hours}if(c.block)t[c.block]++}return t})}
function audit(state,month,options={}){let m=state.months[month],n=daysIn(month),issues=[],ts=totals(state,month);const add=(type,text,p,d)=>issues.push({type,text,p,d});
for(let d=1;d<=n;d++){for(let code of CODES){let got=state.people.filter(p=>cell(m,p.id,d).code===code).length,need=m.days[d].need[code];if(got!==need)add('coverage','วันที่ '+d+' · '+META[code].name+' '+got+'/'+need+' คน',null,d)}}
for(let p of state.people){for(let d=1;d<=n;d++){let c=cell(m,p.id,d);if(c.code&&c.block)add('blocked',p.name+' วันที่ '+d+' · มีเวรชน '+c.block,p.id,d);if(c.code&&!eligibleOnDay(p,month,d,c.code))add('eligibility',p.name+' วันที่ '+d+' · ไม่รับเวรประเภทนี้'+(c.code==='N'?' (ดึก จ.–ศ. เฉพาะสุขสันต์ นุ่มนวล เกศสรา ปฏิภาณ)':''),p.id,d);let prev=d===1?boundary(state,month,p,-1):cell(m,p.id,d-1).code;if(restConflict(prev,c.code))add('rest',p.name+' วันที่ '+d+' · '+restDescription(c.code),p.id,d)}
const next=boundary(state,month,p,1);if(restConflict(cell(m,p.id,n).code,next))add('rest',p.name+' วันสุดท้าย · '+restDescription(next)+'เดือนถัดไป',p.id,n)}
let excl=options.pairExclusions!==undefined?options.pairExclusions:(state.pairExclusions!==undefined?state.pairExclusions:DEFAULT_PAIR_EXCLUSIONS);
if(excl&&excl.length){for(let d=1;d<=n;d++){for(let[x,y]of excl){let cX=cell(m,x,d),cY=cell(m,y,d);if(cX.code&&cY.code){let pX=state.people.find(p=>p.id===x),pY=state.people.find(p=>p.id===y);add('exclusion','วันที่ '+d+' · '+(pX?pX.name:x)+' กับ '+(pY?pY.name:y)+' มีเวรวันเดียวกัน (ห้ามขึ้นเวรวันเดียวกัน)',x,d)}}}}
let targets;try{targets=quotaTargets(state,month,options.quotas||m.quotas||state.quotas||{})}catch(e){add('quota',e.message);targets={}}
if(targets){for(let p of state.people){let tgt=targets[p.id];if(tgt!==undefined&&tgt!==''&&Number.isInteger(Number(tgt))){let actual=ts.find(t=>t.id===p.id)?.total??0;if(actual!==Number(tgt)){add('quota',p.name+' มี '+actual+' เวร (เป้าหมาย '+tgt+' เวร)',p.id)}}}}
try{for(const[id,values]of Object.entries(categoryTargets(state,month))){const actual=categoryTotals(ts.find(t=>t.id===id)),p=state.people.find(p=>p.id===id);for(const g of SHIFT_GROUPS)if(values[g.id]!==undefined&&actual[g.id]!==values[g.id])add('quota',p.name+' · '+g.label+' '+actual[g.id]+'/'+values[g.id]+' เวร',id)}}catch(e){add('quota',e.message)}
let g=group(state),counts=g.map(id=>ts.find(t=>t.id===id).total);if(g.length===3&&new Set(counts).size!==1)add('fairness','คนลำดับ 2–4 มีเวร '+counts.join(' / ')+' ครั้ง ต้องเท่ากัน');
if(targets&&new Set(g.filter(id=>targets[id]!==undefined).map(id=>targets[id])).size>1)add('quota','เป้ารวมทั้ง 3 ประเภทของคนลำดับ 2–4 ต้องเท่ากัน');
return{issues,totals:ts,complete:!issues.length,groupCounts:counts}
}
function solve(state,month,opts={}){
 const original=state.months[month], n=daysIn(month), people=state.people, g=group(state), fixedPeople=manualPeople(original);
 if(g.length!==3)return{ok:false,message:'ต้องมีบุคลากรอย่างน้อย 4 คน เพื่อกำหนดกลุ่มลำดับ 2–4'};
 const excl=opts.pairExclusions!==undefined?opts.pairExclusions:(state.pairExclusions!==undefined?state.pairExclusions:DEFAULT_PAIR_EXCLUSIONS);
 const mainIds=opts.mainStaffIds||state.mainStaffIds||MAIN_STAFF_IDS;
 let targets,categoryGoals;try{targets=quotaTargets(state,month,opts.quotas||original.quotas||state.quotas||{});categoryGoals=categoryTargets(state,month)}catch(e){return{ok:false,reason:'quota',message:e.message}}
 if(new Set(g.filter(id=>targets[id]!==undefined).map(id=>targets[id])).size>1)return{ok:false,reason:'quota',message:'เป้ารวมทั้ง 3 ประเภทของคนลำดับ 2–4 ต้องเท่ากัน กรุณาปรับเป้ารายคนก่อนจัดอัตโนมัติ'};
 let gTarget=targets[g[0]];
 const base=clone(original), demand=[],lockedCounts={},counts={};people.forEach(p=>{counts[p.id]=0;lockedCounts[p.id]=0});
 for(let [k,c] of Object.entries(base.cells)){if(!fixedPeople.has(k.split('|')[0])&&!c.locked)c.code='';if(!c.code&&!c.block&&!c.locked)delete base.cells[k]}
 const allTargets=people.every(p=>targets[p.id]!==undefined),requestedTotal=Object.values(targets).reduce((a,b)=>a+b,0);
 if(original.autoCapacity)for(let d=1;d<=n;d++)base.days[d].need=clone(original.autoCapacity[d]||base.days[d].need);
 const totalDemand=Object.values(base.days).reduce((s,x)=>s+CODES.reduce((a,c)=>a+x.need[c],0),0);
 const flexible=allTargets&&requestedTotal<totalDemand;
 if(allTargets&&requestedTotal>totalDemand)return{ok:false,reason:'capacity',message:'จำนวนที่กรอกรวม '+requestedTotal+' เวร มากกว่าช่องเวรที่เปิดรับรายวัน '+totalDemand+' เวร กรุณาเพิ่มจำนวนที่หัววันที่หรือลดจำนวนเวรที่กรอก'};
 for(const g of SHIFT_GROUPS){const requested=people.reduce((sum,p)=>sum+(categoryGoals[p.id]?.[g.id]||0),0),capacity=Object.values(base.days).reduce((sum,day)=>sum+g.codes.reduce((a,c)=>a+day.need[c],0),0);if(requested>capacity)return{ok:false,reason:'capacity',message:g.label+' ตั้งเป้ารวม '+requested+' เวร แต่เปิดรับไว้ '+capacity+' เวร กรุณาปรับเป้าหรือจำนวนเวรที่หัววันที่'}}
 const fixedIssues=[];
 for(let d=1;d<=n;d++){
  for(let p of people){let c=cell(base,p.id,d);if(!c.code)continue;counts[p.id]++;lockedCounts[p.id]++;if(c.block||!eligibleOnDay(p,month,d,c.code))fixedIssues.push(p.name+' วันที่ '+d+' เวรล็อกชนวันหยุด/สิทธิ์รับเวร (ดึก จ.–ศ. เฉพาะสุขสันต์ นุ่มนวล เกศสรา ปฏิภาณ)');let prev=d===1?boundary(state,month,p,-1):cell(base,p.id,d-1).code;if(restConflict(prev,c.code))fixedIssues.push(p.name+' วันที่ '+d+' เวรล็อก'+restDescription(c.code));const next=boundary(state,month,p,1);if(d===n&&restConflict(c.code,next))fixedIssues.push(p.name+' วันสุดท้าย '+restDescription(next)+'ข้ามเดือน')}
  if(excl&&excl.length){for(let[x,y]of excl){let cX=cell(base,x,d),cY=cell(base,y,d);if(cX.code&&cY.code){let pX=people.find(p=>p.id===x),pY=people.find(p=>p.id===y);fixedIssues.push('วันที่ '+d+' เวรล็อกของ '+(pX?pX.name:x)+' ชนกับ '+(pY?pY.name:y)+' (ห้ามขึ้นเวรวันเดียวกัน)')}}}
  for(let code of CODES){let got=people.filter(p=>cell(base,p.id,d).code===code).length,need=base.days[d].need[code];if(got>need)fixedIssues.push('วันที่ '+d+' เวร '+META[code].name+' ที่ล็อกไว้เกินจำนวน');for(let i=got;i<need;i++)demand.push({d,code})}
 }
 for(let[pid,tgt]of Object.entries(targets)){if(counts[pid]>tgt){let p=people.find(x=>x.id===pid);fixedIssues.push((p?p.name:pid)+' มีเวรล็อกไว้ ('+counts[pid]+' เวร) เกินเป้าหมาย ('+tgt+' เวร)')}}
 for(const p of people){if(targets[p.id]!==undefined&&fixedPeople.has(p.id)&&counts[p.id]!==targets[p.id])fixedIssues.push(p.name+' จัดเองไว้ '+counts[p.id]+' เวร แต่ตั้งเป้า '+targets[p.id]+' เวร กรุณาเติมเองหรือปลดล็อกทุกเวรของคนนี้')}
 const baseCategories=Object.fromEntries(totals({...state,months:{...state.months,[month]:base}},month).map(t=>[t.id,categoryTotals(t)]));
 for(const p of people)for(const g of SHIFT_GROUPS){const target=categoryGoals[p.id]?.[g.id],actual=baseCategories[p.id][g.id];if(target!==undefined&&(actual>target||(fixedPeople.has(p.id)&&actual!==target)))fixedIssues.push(p.name+' · '+g.label+' จัดเองไว้ '+actual+' เวร แต่ตั้งเป้า '+target+' เวร กรุณาแก้เวรหรือปลดล็อกทุกเวรของคนนี้')}
 if(fixedIssues.length)return{ok:false,message:fixedIssues.slice(0,5).join('\n'),reason:'fixed'};
 for(let d=1;d<=n;d++){let required=demand.filter(s=>s.d===d).length;let available=people.filter(p=>!fixedPeople.has(p.id)&&!cell(base,p.id,d).block&&!cell(base,p.id,d).code&&p.allowed.some(c=>eligibleOnDay(p,month,d,c)&&base.days[d].need[c]>0)).length;if(!flexible&&required>available)return{ok:false,reason:'capacity',message:'วันที่ '+d+' ต้องเพิ่มอีก '+required+' คน แต่มีคนว่าง '+available+' คน (OFF / VAC / เวรล็อก / คนที่จัดเอง / สิทธิ์รับเวร) กรุณาปรับวันหยุดหรือกำลังคน'};}
 for(let slot of demand){let poss=people.filter(p=>!fixedPeople.has(p.id)&&eligibleOnDay(p,month,slot.d,slot.code)&&!cell(base,p.id,slot.d).block&&!cell(base,p.id,slot.d).code);if(!flexible&&!poss.length)return{ok:false,message:'วันที่ '+slot.d+' เวร '+META[slot.code].name+' ไม่มีคนที่ว่างและรับเวรนี้ได้',reason:'capacity'}}
 const active=people.filter(p=>p.active).length,avg=totalDemand/Math.max(active,1);
 let minQ=Math.max(...g.map(id=>counts[id])),maxQ=Math.min(...g.map(id=>{let p=people.find(x=>x.id===id);return p.active&&!fixedPeople.has(id)?Array.from({length:n},(_,i)=>i+1).filter(d=>!cell(base,id,d).block&&(cell(base,id,d).code||p.allowed.some(c=>eligibleOnDay(p,month,d,c)&&base.days[d].need[c]>0))).length:counts[id]}),Math.floor(totalDemand/3));
 let quotas;
 if(gTarget!==undefined){
  if(gTarget<minQ)return{ok:false,reason:'capacity',message:'เป้าหมายคนลำดับ 2–4 ('+gTarget+' เวร) น้อยกว่าเวรที่ล็อกไว้ ('+minQ+' เวร)'};
  if(gTarget>maxQ)return{ok:false,reason:'capacity',message:'เป้าหมายคนลำดับ 2–4 ('+gTarget+' เวร) เกินจำนวนสูงสุดที่รับได้ ('+maxQ+' เวร)'};
  quotas=[gTarget];
 }else{
  quotas=Array.from({length:Math.max(0,maxQ-minQ+1)},(_,i)=>i+minQ).sort((a,b)=>Math.abs(a-avg)-Math.abs(b-avg));
 }
 const preferenceState=clone(state);preferenceState.months[month]=base;
 const preferredR=dawnTargets(preferenceState,month),baseR=Object.fromEntries(people.map(p=>[p.id,Array.from({length:n},(_,i)=>cell(base,p.id,i+1).code).filter(c=>c==='R').length]));
 let nodes=0,timedOut=false;const start=Date.now(),limit=opts.ms||5000, nodeLimit=opts.nodes||180000;
 for(const strictR of [true,false]){timedOut=false;
 for(let q of quotas){
  let m=clone(base),cnt={...counts},remaining=demand.map((s,i)=>({...s,i})), solved=false;
  const rCnt={...baseR},catCnt=clone(baseCategories),exact={...targets};g.forEach(id=>exact[id]=q);
  if(Object.entries(exact).reduce((sum,[id,t])=>sum+t-counts[id],0)>remaining.length)continue;
  if(!flexible&&people.every(p=>exact[p.id]!==undefined)&&Object.values(exact).reduce((a,b)=>a+b,0)!==totalDemand)continue;
  if(strictR&&people.some(p=>baseR[p.id]>(preferredR[p.id]||0)||(fixedPeople.has(p.id)&&baseR[p.id]<(preferredR[p.id]||0))||(exact[p.id]!==undefined&&exact[p.id]<(preferredR[p.id]||0))))continue;
  if(strictR&&people.some(p=>categoryGoals[p.id]?.dawn!==undefined&&categoryGoals[p.id].dawn!==(preferredR[p.id]||0)))continue;
  function eligible(p,s){
   let c=cell(m,p.id,s.d);
   if(fixedPeople.has(p.id)||!eligibleOnDay(p,month,s.d,s.code)||c.block||c.code)return false;
   const category=SHIFT_GROUP_BY_CODE[s.code];if(categoryGoals[p.id]?.[category]!==undefined&&catCnt[p.id][category]>=categoryGoals[p.id][category])return false;
   if(g.includes(p.id)&&cnt[p.id]>=q)return false;
   if(targets[p.id]!==undefined&&cnt[p.id]>=targets[p.id])return false;
   if(strictR&&s.code==='R'&&rCnt[p.id]>=(preferredR[p.id]||0))return false;
   if(excl&&excl.length){for(let other of people){if(other.id!==p.id&&cell(m,other.id,s.d).code){if(isExcludedPair(p.id,other.id,excl))return false}}}
   let prev=s.d===1?boundary(state,month,p,-1):cell(m,p.id,s.d-1).code,next=s.d===n?boundary(state,month,p,1):cell(m,p.id,s.d+1).code;
   return !restConflict(prev,s.code)&&!restConflict(s.code,next)
  }
  function dfs(left){
   if(++nodes>(strictR?nodeLimit*.35:nodeLimit)||Date.now()-start>(strictR?limit*.35:limit)){timedOut=true;return false}
   const categoriesComplete=()=>people.every(p=>SHIFT_GROUPS.every(g=>categoryGoals[p.id]?.[g.id]===undefined||catCnt[p.id][g.id]===categoryGoals[p.id][g.id]));
   if(flexible&&people.every(p=>cnt[p.id]===targets[p.id]))return categoriesComplete()&&(!strictR||people.every(p=>rCnt[p.id]===(preferredR[p.id]||0)));
   if(flexible&&Object.entries(exact).reduce((sum,[id,t])=>sum+t-cnt[id],0)>left.length)return false;
   if(!left.length){
    if(!g.every(id=>cnt[id]===q))return false;
    for(let[pid,tgt]of Object.entries(targets)){if(cnt[pid]!==tgt)return false}
    return categoriesComplete();
   }
   for(let id of g){let p=people.find(x=>x.id===id),gap=q-cnt[id];if(gap<0||gap>new Set(left.filter(s=>eligible(p,s)).map(s=>s.d)).size)return false}
   for(let[pid,tgt]of Object.entries(targets)){if(!g.includes(pid)){let p=people.find(x=>x.id===pid),gap=tgt-cnt[pid];if(gap<0||gap>new Set(left.filter(s=>eligible(p,s)).map(s=>s.d)).size)return false}}
   for(const p of people)for(const category of SHIFT_GROUPS){const target=categoryGoals[p.id]?.[category.id];if(target===undefined)continue;const gap=target-catCnt[p.id][category.id];if(gap<0||gap>new Set(left.filter(s=>SHIFT_GROUP_BY_CODE[s.code]===category.id&&eligible(p,s)).map(s=>s.d)).size)return false}
   let pick=0,candidates=null;
   for(let i=0;i<left.length;i++){
    const list=people.filter(p=>eligible(p,left[i]));
    if(!list.length){if(flexible)continue;return false}
    const load=d=>people.filter(p=>cell(m,p.id,d).code).length;
    const priority=slot=>(slot.code==='R'?0:100)+load(slot.d)*10;
    if(candidates===null||(flexible?priority(left[i])<priority(left[pick]):list.length<candidates.length)){pick=i;candidates=list;if(!flexible&&list.length===1)break}
   }
   if(candidates===null)return false;
   let s=left[pick],rest=left.filter((_,i)=>i!==pick);
   let isR=s.code==='R';
   let scores=new Map(candidates.map(p=>{
    let same=Object.entries(m.cells).filter(([k,c])=>k.startsWith(p.id+'|')&&c.code===s.code).length;
    let pTarget=g.includes(p.id)?q:targets[p.id];
    let deficit=pTarget!==undefined?(pTarget-cnt[p.id])/Math.max(1,pTarget):0;
    let score=cnt[p.id]-.7*deficit+.15*same+Math.random()*.65;
    if(isR){
     score=100*(rCnt[p.id]-(preferredR[p.id]||0))+score;
    }
    return[p.id,score];
   }));
   candidates.sort((a,b)=>scores.get(a.id)-scores.get(b.id));
   for(let p of candidates){let k=key(p.id,s.d),old=m.cells[k];m.cells[k]={code:s.code,block:'',locked:false};cnt[p.id]++;catCnt[p.id][SHIFT_GROUP_BY_CODE[s.code]]++;if(s.code==='R')rCnt[p.id]++;
    if(dfs(rest))return true;
    cnt[p.id]--;catCnt[p.id][SHIFT_GROUP_BY_CODE[s.code]]--;if(s.code==='R')rCnt[p.id]--;if(old)m.cells[k]=old;else delete m.cells[k];if(timedOut)return false
   }return flexible&&!timedOut?dfs(rest):false;
  }
  if(dfs(remaining)){
   if(flexible){m.autoCapacity=Object.fromEntries(Object.entries(base.days).map(([d,day])=>[d,clone(day.need)]));for(let d=1;d<=n;d++)for(const code of CODES)m.days[d].need[code]=people.filter(p=>cell(m,p.id,d).code===code).length}
   const test=clone(state);test.months[month]=m;
   if(excl!==undefined)test.pairExclusions=excl;
   // Resolve blank (auto) targets to the counts actually assigned, so the total
   // shown in the UI always equals the sum of the per-person target fields.
   m.quotas=Object.fromEntries(people.map(p=>[p.id,targets[p.id]??cnt[p.id]]));
   m.categoryQuotas=clone(catCnt);
   const a=audit(test,month);
   if(a.complete)return{ok:true,month:m,nodes,quota:q,dawnBalanced:strictR};
   return{ok:false,message:'ผลจัดเวรยังไม่ผ่านการตรวจ: '+(a.issues[0]?.text||'กรุณาตรวจการตั้งค่า')};
  }
  if(timedOut)break;
 }
 }
 return{ok:false,reason:timedOut?'timeout':'infeasible',message:timedOut?'ยังหาคำตอบไม่ทันเวลาที่กำหนด ลองจัดอีกครั้ง หรือปลดล็อกบางช่อง / ตรวจวัน OFF และ VAC':'ไม่พบตารางที่ตรงทุกเงื่อนไข ตรวจจำนวนคน วันลา เวรที่ล็อก และสิทธิ์ของคนลำดับ 2–4',nodes};
}
// Validate a whole painted range before committing anything to the live state.
function manualRange(state,month,id,start,end,value){
 const p=state.people.find(p=>p.id===id),n=daysIn(month);
 if(!p||!Number.isInteger(start)||!Number.isInteger(end)||Math.min(start,end)<1||Math.max(start,end)>n||!['',...CODES,'OFF','VAC'].includes(value))return{ok:false,message:'เลือกคน วันที่ และชนิดเวรให้ถูกต้อง'};
 const code=CODES.includes(value)?value:'',block=['OFF','VAC'].includes(value)?value:'';
 if(code&&(!p.active||!p.allowed.includes(code)))return{ok:false,message:p.name+' ไม่ได้เปิดรับเวรประเภทนี้ · ยังไม่ได้แก้ไขทุกช่องที่เลือก'};
 const m=clone(state.months[month]),lo=Math.min(start,end),hi=Math.max(start,end);let changed=0;
 if(code)for(let d=lo;d<=hi;d++)if(!eligibleOnDay(p,month,d,code))return{ok:false,message:'วันที่ '+d+' เวรดึก จ.–ศ. รับได้เฉพาะสุขสันต์ นุ่มนวล เกศสรา และปฏิภาณ · ยังไม่ได้แก้ไขทุกช่องที่เลือก'};
 if(code){for(let d=lo;d<=hi;d++){const other=state.people.find(other=>isExcludedPair(p.id,other.id,state.pairExclusions??DEFAULT_PAIR_EXCLUSIONS)&&cell(m,other.id,d).code);if(other)return{ok:false,message:'วันที่ '+d+' '+p.name+' ห้ามมีเวรวันเดียวกับ '+other.name+' · ยังไม่ได้แก้ไขทุกช่องที่เลือก'}}}
 for(let d=lo;d<=hi;d++){
  const old=cell(m,id,d),next={code,block,locked:!!code};
  if(old.code!==code||old.block!==block||old.locked!==next.locked){m.cells[key(id,d)]=next;changed++}
 }
 for(let d=lo;d<=Math.min(n,hi+1);d++){
  const prev=d===1?boundary(state,month,p,-1):cell(m,id,d-1).code;
  if(restConflict(prev,cell(m,id,d).code))return{ok:false,message:'วันที่ '+d+' '+restDescription(cell(m,id,d).code)+' · ยังไม่ได้แก้ไขทุกช่องที่เลือก'};
 }
 if(hi===n&&restConflict(cell(m,id,n).code,boundary(state,month,p,1)))return{ok:false,message:restDescription(boundary(state,month,p,1))+'ข้ามเดือน · ยังไม่ได้แก้ไขทุกช่องที่เลือก'};
 return{ok:true,month:m,changed};
}
if(typeof module!=='undefined')module.exports={CODES,META,DEFAULT_PAY_RATES,DEFAULT_PAIR_EXCLUSIONS,MAIN_STAFF_IDS,WEEKDAY_NIGHT_IDS,SHIFT_GROUPS,clone,key,isExcludedPair,daysIn,weekday,monthOffset,freshMonth,cell,manualPeople,group,eligibleOnDay,restConflict,restDescription,categoryTotals,categoryTargets,quotaTargets,payRate,dawnTargets,boundary,totals,audit,solve,manualRange};
