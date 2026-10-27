/* Shift planner constraint engine. Pure functions shared by UI and checks. */
const CODES=['N','M','A','R','X'];
const META={N:{label:'ด',name:'ดึก',time:'00:00–08:00',hours:8},M:{label:'ช',name:'เช้า',time:'08:00–16:00',hours:8},A:{label:'บ',name:'บ่าย',time:'16:00–00:00',hours:8},R:{label:'ร',name:'หน้าตู้KIOS',time:'06:30–08:30',hours:2},X:{label:'ร',name:'ออกรพ.สต.',time:'06:30–08:30',hours:2}};
const DEFAULT_PAY_RATES={'1':520,'2':330,'3':330,'4':330,'5':650,'6':650,'7':650,'8':390,'9':0};
const DEFAULT_PAIR_EXCLUSIONS=[['1','8']];
const MAIN_STAFF_IDS=['1','2','3','4'];
const CARD_CODES=['N','M','A'];
const SHIFT_GROUPS=[{id:'card',label:'ห้องบัตร',codes:CARD_CODES},{id:'dawn',label:'รุ่งอรุณ',codes:['R','X']}];
const PAY_GROUPS=SHIFT_GROUPS;
const SHIFT_GROUP_BY_CODE=Object.fromEntries(SHIFT_GROUPS.flatMap(g=>g.codes.map(code=>[code,g.id])));
const clone=x=>JSON.parse(JSON.stringify(x));
const key=(p,d)=>p+'|'+d;
function isExcludedPair(a,b,excl){return!!excl&&excl.some(([x,y])=>(a===x&&b===y)||(a===y&&b===x))}
function sameShift(a,b){return!!a&&!!b&&(a===b||['R','X'].includes(a)&&['R','X'].includes(b))}
function pairConflict(a,b,codeA,codeB,excl){return isExcludedPair(a,b,excl)&&sameShift(codeA,codeB)}
function daysIn(month){let [y,m]=month.split('-').map(Number);return new Date(y,m,0).getDate()}
function weekday(month,d){let[y,m]=month.split('-').map(Number);return new Date(y,m-1,d).getDay()}
function monthOffset(month,off){let[y,m]=month.split('-').map(Number),dt=new Date(y,m-1+off,1);return dt.getFullYear()+'-'+String(dt.getMonth()+1).padStart(2,'0')}
function freshMonth(month){let days={};for(let d=1;d<=daysIn(month);d++){let wk=weekday(month,d)>0&&weekday(month,d)<6;days[d]={holiday:false,note:'',need:{N:1,M:wk?0:2,A:1,R:wk?1:0,X:0}}}return{cells:{},days}}
function calendarDemand(state,month){
 const m=state.months[month],people=monthPeople(state,month),needs={};let holidayDays=0,R=0,X=0;
 for(let d=1;d<=daysIn(month);d++){
  const holiday=m.days[d].holiday||[0,6].includes(weekday(month,d)),stored=m.autoCapacity?.[d]||m.days[d].need;
  const early=code=>Math.max(stored[code]??0,people.filter(p=>{const c=cell(m,p.id,d);return c.locked&&c.code===code}).length);
  needs[d]={N:1,M:holiday?2:0,A:1,R:early('R'),X:early('X')};if(holiday)holidayDays++;R+=needs[d].R;X+=needs[d].X;
 }
 const regularDays=daysIn(month)-holidayDays,card=regularDays*2+holidayDays*4;
 return{needs,regularDays,holidayDays,card,R,X,dawn:R+X,total:card+R+X};
}
function normalizeCalendarDemand(state,month){
 const m=state.months[month],demand=calendarDemand(state,month);let changed=m.calendarRules!==true||!!m.autoCapacity;
 for(const [d,need]of Object.entries(demand.needs)){if(CODES.some(code=>m.days[d].need[code]!==need[code]))changed=true;m.days[d].need=need}
 m.calendarRules=true;delete m.autoCapacity;return changed;
}
function cell(m,p,d){return m.cells[key(p,d)]||{code:'',block:'',locked:false}}
function manualPeople(m){return new Set(Object.entries(m.cells).filter(([,c])=>c.code&&c.locked).map(([k])=>k.split('|')[0]))}
function monthPeople(state,month){const excluded=new Set(state.months[month].excludedStaffIds||[]);return state.people.filter(p=>!excluded.has(p.id))}
function group(state,month){const included=month?new Set(monthPeople(state,month).map(p=>p.id)):null;return state.people.slice(1,4).filter(p=>!included||included.has(p.id)).map(p=>p.id)}
function canUseSymbol(p,value){return value===''||p.id!=='9'||value==='X'}
function eligibleOnDay(p,month,d,code){return p.active&&canUseSymbol(p,code)&&p.allowed.includes(code)}
function restConflict(previous,next){return previous==='A'&&['N','R','X'].includes(next)}
function restDescription(next){return next==='N'?'บ่ายต่อดึก':next==='R'?'บ่ายต่อหน้าตู้KIOS':'บ่ายต่อเวร รพ.สต.'}
function dutyCode(state,month,m,p,d,lockedOnly=false,n=daysIn(month)){
 if(d>=1&&d<=n){const c=cell(m,p.id,d);return!lockedOnly||c.locked?c.code:''}
 const side=d<1?-1:1,adjacentMonth=monthOffset(month,side),adjacent=state.months[adjacentMonth];
 if(adjacent)return(adjacent.excludedStaffIds||[]).includes(p.id)?'':cell(adjacent,p.id,d<1?daysIn(adjacentMonth)+d:d-n).code;
 return d===0||d===n+1?boundary(state,month,p,side):'';
}
function consecutiveConflict(state,month,m,p,d,code=cell(m,p.id,d).code,lockedOnly=false,n=daysIn(month)){
 if(!CARD_CODES.includes(code))return false;
 const work=offset=>CARD_CODES.includes(dutyCode(state,month,m,p,d+offset,lockedOnly,n)),previous=work(-1),next=work(1);
 return previous&&(next||work(-2))||next&&work(2);
}
function consecutiveViolations(state,month,m,p,lo=1,hi=daysIn(month)){
 const n=daysIn(month),result=[];for(let end=lo;end<=hi+2;end++)if([end-2,end-1,end].every(d=>CARD_CODES.includes(dutyCode(state,month,m,p,d,false,n))))result.push(Math.max(1,Math.min(n,end)));
 return[...new Set(result)];
}
function maxAssignable(state,month,m,p,codes){
 const n=daysIn(month),previous=dutyCode(state,month,m,p,0),run=CARD_CODES.includes(previous)?(CARD_CODES.includes(dutyCode(state,month,m,p,-1))?2:1):0,excl=state.pairExclusions??DEFAULT_PAIR_EXCLUSIONS,people=monthPeople(state,month);
 let states=[{code:previous,run,value:0}];
 for(let d=1;d<=n;d++){
  const current=cell(m,p.id,d),fixed=current.locked?current.code:'',paired=code=>people.some(other=>other.id!==p.id&&cell(m,other.id,d).locked&&pairConflict(p.id,other.id,code,cell(m,other.id,d).code,excl));
  const choices=fixed?[fixed]:current.block?['']:['',...codes.filter(code=>m.days[d].need[code]>0&&eligibleOnDay(p,month,d,code)&&!paired(code))],next=new Map();
  for(const prev of states)for(const code of choices){const work=CARD_CODES.includes(code),run=work?prev.run+1:0;if(run>2||restConflict(prev.code,code))continue;const value=prev.value+(codes.includes(code)?1:0),key=code+'|'+run;if(!next.has(key)||next.get(key).value<value)next.set(key,{code,run,value})}
  states=[...next.values()];if(!states.length)return 0;
 }
 const next=dutyCode(state,month,m,p,n+1),afterNext=dutyCode(state,month,m,p,n+2),nextRun=CARD_CODES.includes(next)?(CARD_CODES.includes(afterNext)?2:1):0;
 return Math.max(0,...states.filter(s=>!restConflict(s.code,next)&&s.run+nextRun<=2).map(s=>s.value));
}
function categoryTotals(t){return{card:t.N+t.M+t.A,dawn:t.R+t.X}}
function categoryTargets(state,month,raw=state.months[month].categoryQuotas||{}){
 const result={},ids=new Set(state.people.map(p=>p.id)),n=daysIn(month);
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('เป้าหมายแยกประเภทไม่ถูกต้อง');
 for(const[id,values]of Object.entries(raw)){
  if(!ids.has(id)||!values||typeof values!=='object'||Array.isArray(values))throw Error('เป้าหมายแยกประเภทไม่ถูกต้อง');
  const targets={};for(const[category,v]of Object.entries(values)){
   if(!SHIFT_GROUPS.some(g=>g.id===category)&&category!=='outreach')throw Error('ประเภทเป้าหมายไม่ถูกต้อง');
   if(v===''||v===null||v===undefined)continue;
   if(!Number.isInteger(Number(v))||Number(v)<0||Number(v)>n)throw Error('เป้าหมายเวรต้องเป็นจำนวนเต็ม 0–'+n);
   const merged=category==='outreach'?'dawn':category;
   targets[merged]=(targets[merged]??0)+Number(v);
  }
  if(Object.values(targets).reduce((a,b)=>a+b,0)>n)throw Error('เป้าหมายห้องบัตรและรุ่งอรุณรวมกันต้องไม่เกิน '+n+' เวรต่อคน');
  if(Object.keys(targets).length&&!(state.months[month].excludedStaffIds||[]).includes(id))result[id]=targets;
 }
 return result;
}
function quotaTargets(state,month,raw=state.months[month].quotas||state.quotas||{}){
 const targets={},ids=new Set(state.people.map(p=>p.id)),n=daysIn(month),categories=categoryTargets(state,month);
 for(const[id,v]of Object.entries(raw)){if(v===''||v===null||v===undefined)continue;if(!ids.has(id)||!Number.isInteger(Number(v))||Number(v)<0||Number(v)>n)throw Error('เป้าหมายเวรต้องเป็นจำนวนเต็ม 0–'+n);targets[id]=Number(v)}
 for(const[id,values]of Object.entries(categories))if(SHIFT_GROUPS.every(g=>values[g.id]!==undefined))targets[id]=Object.values(values).reduce((a,b)=>a+b,0);
 for(const id of state.months[month].excludedStaffIds||[])delete targets[id];
 return targets;
}
function defaultDawnRate(person){
 const role=String(typeof person==='string'?person:person?.role||'').replace(/\s/g,'');
 if(/^(?:จพ\.?เวช|เจ้าพนักงานเวช)/.test(role))return 60;
 if(/^(?:นวก\.?|นักวิชาการ)/.test(role))return 80;
 if(/^พนักงาน/.test(role))return 50;
 return 0;
}
function payRate(state,id,category='card'){
 const rate=state.payRates?.[id],card=typeof rate==='number'?rate:(rate?.card??DEFAULT_PAY_RATES[id]??0);
 if(category==='card')return card;
 const fallback=defaultDawnRate(state.people.find(p=>p.id===id));
 if(!rate||typeof rate==='number')return fallback;
 // Old forms copied the card rate into both early-shift fields by default.
 if(rate.outreach!==undefined&&rate.dawn===card)return rate.outreach===card?fallback:rate.outreach;
 return rate.dawn??rate.outreach??fallback;
}
function normalizePayRates(state){
 let changed=false;state.payRates=state.payRates||{};
 for(const p of state.people){const next={card:payRate(state,p.id,'card'),dawn:payRate(state,p.id,'dawn')};if(JSON.stringify(state.payRates[p.id])!==JSON.stringify(next)){state.payRates[p.id]=next;changed=true}}
 return changed;
}
function totalPay(state,t){return PAY_GROUPS.reduce((sum,g)=>sum+g.codes.reduce((count,code)=>count+t[code],0)*Math.round(payRate(state,t.id,g.id)*100),0)/100}
function distributionPlan(state,month,options={}){
 const m=state.months[month],n=daysIn(month),people=monthPeople(state,month).filter(p=>p.active),roster=code=>people.filter(p=>canUseSymbol(p,code)&&p.allowed.includes(code)).map(p=>p.id);
 const rIds=roster('R'),xIds=roster('X'),need=(d,code)=>m.autoCapacity?.[d]?.[code]??m.days[d].need[code],total=code=>Object.keys(m.days).reduce((sum,d)=>sum+need(d,code),0);
 const totalR=total('R'),totalX=total('X'),rMin=rIds.length?Math.floor(totalR/rIds.length):0,rMax=rIds.length?Math.ceil(totalR/rIds.length):0,main=new Set(state.mainStaffIds||MAIN_STAFF_IDS),excl=state.pairExclusions??DEFAULT_PAIR_EXCLUSIONS;
 let goals={},quotas={};try{goals=categoryTargets(state,month);quotas=quotaTargets(state,month)}catch(e){}
 const lockedCounts=codes=>Object.fromEntries(people.map(p=>[p.id,Object.entries(m.cells).filter(([k,c])=>k.startsWith(p.id+'|')&&c.locked&&codes.includes(c.code)).length]));
 const lockedR=lockedCounts(['R']),lockedX=lockedCounts(['X']),lockedCard=lockedCounts(['N','M','A']);
 const daysFor=(p,code)=>Object.keys(m.days).map(Number).filter(d=>{
  const c=cell(m,p.id,d),prev=d===1?boundary(state,month,p,-1):cell(m,p.id,d-1),previous=typeof prev==='string'?prev:prev.locked?prev.code:'';
  return need(d,code)>0&&eligibleOnDay(p,month,d,code)&&!c.block&&(!c.locked||c.code===code)&&!restConflict(previous,code)&&!consecutiveConflict(state,month,m,p,d,code,true,n)&&!people.some(other=>other.id!==p.id&&cell(m,other.id,d).locked&&pairConflict(p.id,other.id,code,cell(m,other.id,d).code,excl));
 });
 const available=Object.fromEntries(people.map(p=>[p.id,Object.fromEntries(CODES.map(code=>[code,daysFor(p,code)]))]));
 const capacityMonth={...m,days:Object.fromEntries(Object.entries(m.days).map(([d,day])=>[d,{...day,need:Object.fromEntries(CODES.map(code=>[code,need(d,code)]))}]))};
 const workCapacity=Object.fromEntries(people.map(p=>[p.id,maxAssignable(state,month,capacityMonth,p,CODES)]));
 const cardCapacity=Object.fromEntries(people.map(p=>[p.id,maxAssignable(state,month,capacityMonth,p,['N','M','A'])]));
 const earlyCapacity=Object.fromEntries(people.map(p=>[p.id,maxAssignable(state,month,capacityMonth,p,['R','X'])]));
 const preferredTotal={},upper={};
 for(const p of people){const id=p.id;preferredTotal[id]=quotas[id]??Math.max(lockedCard[id],goals[id]?.card??0)+Math.max(lockedR[id]+lockedX[id],goals[id]?.dawn??0);upper[id]=Math.min(quotas[id]??n,workCapacity[id],(goals[id]?.card??cardCapacity[id])+(goals[id]?.dawn??earlyCapacity[id]));}
 for(const p of people)if(!p.allowed.some(code=>['N','M','A','R'].includes(code)&&canUseSymbol(p,code))&&quotas[p.id]===undefined&&goals[p.id]?.dawn===undefined)upper[p.id]=Math.min(upper[p.id],Math.max(lockedR[p.id]+lockedX[p.id],Math.ceil(totalX/Math.max(1,xIds.length))));
 const mains=people.filter(p=>main.has(p.id)),academics=people.filter(p=>!main.has(p.id)&&/^นวก\./.test(p.role||''));
 if(mains.length){const floor=Math.max(0,...academics.map(p=>preferredTotal[p.id])),ceiling=Math.min(...mains.map(p=>upper[p.id]));for(const p of mains)preferredTotal[p.id]=Math.max(preferredTotal[p.id],floor);for(const p of academics)upper[p.id]=Math.min(upper[p.id],ceiling)}
 const totalSlots=Object.keys(m.days).reduce((sum,d)=>sum+CODES.reduce((a,code)=>a+need(d,code),0),0);
 // Plan total workloads before splitting early shifts. In particular, a small
 // card goal for a main worker may require more early shifts to keep academics below them.
 let planned=Object.values(preferredTotal).reduce((a,b)=>a+b,0),relaxedEarly=false;
 while(planned<totalSlots){
  const candidates=people.filter(p=>preferredTotal[p.id]<upper[p.id]&&(!academics.includes(p)||mains.every(other=>preferredTotal[p.id]<preferredTotal[other.id])));
  if(!candidates.length){
   if(relaxedEarly)break;relaxedEarly=true;
   for(const p of people)if(!cardCapacity[p.id]&&quotas[p.id]===undefined&&goals[p.id]?.dawn===undefined)upper[p.id]=Math.min(workCapacity[p.id],academics.includes(p)&&mains.length?Math.min(...mains.map(main=>upper[main.id])):n);
   continue;
  }
  candidates.sort((a,b)=>(preferredTotal[a.id]+(main.has(a.id)?-.25:a.id==='8'?0:1.5))-(preferredTotal[b.id]+(main.has(b.id)?-.25:b.id==='8'?0:1.5))||people.indexOf(a)-people.indexOf(b));
  preferredTotal[candidates[0].id]++;planned++;
 }
 const minimumEarly=Object.fromEntries(people.map(p=>[p.id,cardCapacity[p.id]>0?Math.max(0,preferredTotal[p.id]-(goals[p.id]?.card??cardCapacity[p.id])):!rIds.includes(p.id)&&preferredTotal[p.id]>Math.ceil(totalX/Math.max(1,xIds.length))?preferredTotal[p.id]:0]));
 const academicCeiling=Math.min(...people.filter(p=>main.has(p.id)).map(p=>Math.min(quotas[p.id]??n,workCapacity[p.id])));
 const exact={},budget={},rCapacity={},preferredR={...lockedR},preferredX={...lockedX};
 for(const p of people){
  const work=workCapacity[p.id],early=earlyCapacity[p.id],card=goals[p.id]?.card??lockedCard[p.id];
  const onlyEarly=!p.allowed.some(code=>['N','M','A'].includes(code)&&canUseSymbol(p,code));
  exact[p.id]=goals[p.id]?.dawn??(onlyEarly?quotas[p.id]:undefined);
  const totalCeiling=!main.has(p.id)&&/^นวก\./.test(p.role||'')?Math.min(quotas[p.id]??n,academicCeiling):quotas[p.id]??n;
  budget[p.id]=Math.max(0,Math.min(exact[p.id]??n,totalCeiling-card,work-card,early,options.relaxedWorkload||totalSlots===totalR+totalX?n:preferredTotal[p.id]-card));
  rCapacity[p.id]=Math.max(0,Math.min(available[p.id].R.length,budget[p.id]-lockedX[p.id]));
 }
 // Allocate counts jointly: typed goals dominate fair shares and one-red-each preferences.
 // Date nodes also avoid reserving the same red slot for two different people.
 const graph=[],node=()=>{graph.push([]);return graph.length-1},source=node(),sink=node(),personNodes={},codeNodes={},tracked=[],goalPriority=(n+1)*(totalR+totalX+1)*10000;
 function edge(from,to,capacity,cost){const forward={to,rev:graph[to].length,capacity,initial:capacity,cost},backward={to:from,rev:graph[from].length,capacity:0,initial:0,cost:-cost};graph[from].push(forward);graph[to].push(backward);return forward}
 for(const p of people){
  const id=p.id;personNodes[id]=node();const remaining=Math.max(0,budget[id]-lockedR[id]-lockedX[id]);
  for(let i=0;i<remaining;i++)edge(personNodes[id],sink,1,exact[id]!==undefined?-goalPriority:i+lockedR[id]+lockedX[id]<minimumEarly[id]?-goalPriority/2:0);
  for(const code of ['R','X']){
   codeNodes[id+'|'+code]=node();const locked=code==='R'?lockedR[id]:lockedX[id],capacity=Math.max(0,available[id][code].length-locked);
   for(let i=0;i<capacity;i++){
    const count=locked+i,cost=code==='R'?count*100+(main.has(id)?-2:0):(count===0?(main.has(id)?-10000:-1000):count*100)+(main.has(id)?-2:0);
    tracked.push({id,code,edge:edge(codeNodes[id+'|'+code],personNodes[id],1,cost)});
   }
  }
 }
 let requested=0;
 for(const d of Object.keys(m.days).map(Number))for(const code of ['R','X']){
  const locked=people.filter(p=>cell(m,p.id,d).locked&&cell(m,p.id,d).code===code).length,remaining=Math.max(0,need(d,code)-locked);if(!remaining)continue;
  const slot=node();edge(source,slot,remaining,0);requested+=remaining;
  for(const p of people)if(available[p.id][code].includes(d)&&!(cell(m,p.id,d).locked&&cell(m,p.id,d).code))edge(slot,codeNodes[p.id+'|'+code],1,0);
 }
 let flow=0;
 while(flow<requested){
  const distance=Array(graph.length).fill(Infinity),previousNode=[],previousEdge=[],queued=Array(graph.length).fill(false),queue=[source];distance[source]=0;queued[source]=true;
  for(let head=0;head<queue.length;head++){
   const from=queue[head];queued[from]=false;
   for(let i=0;i<graph[from].length;i++){const e=graph[from][i];if(e.capacity>0&&distance[e.to]>distance[from]+e.cost){distance[e.to]=distance[from]+e.cost;previousNode[e.to]=from;previousEdge[e.to]=i;if(!queued[e.to]){queue.push(e.to);queued[e.to]=true}}}
  }
  if(!Number.isFinite(distance[sink]))break;
  let amount=requested-flow;for(let at=sink;at!==source;at=previousNode[at])amount=Math.min(amount,graph[previousNode[at]][previousEdge[at]].capacity);
  for(let at=sink;at!==source;at=previousNode[at]){const e=graph[previousNode[at]][previousEdge[at]];e.capacity-=amount;graph[at][e.rev].capacity+=amount}flow+=amount;
 }
 for(const entry of tracked)(entry.code==='R'?preferredR:preferredX)[entry.id]+=entry.edge.initial-entry.edge.capacity;
 let error='';for(const p of people)if(exact[p.id]!==undefined&&preferredR[p.id]+preferredX[p.id]!==exact[p.id]){error=p.name+' ตั้งเป้ารุ่งอรุณ '+exact[p.id]+' เวร แต่วันที่เปิดและข้อจำกัดปัจจุบันรองรับไม่พอ กรุณาปรับเป้าหรือวันเปิดเวร';break}
 if(!error&&flow<requested)error='จำนวนเวรรุ่งอรุณที่เปิดไว้มากกว่าที่เป้ารายคนและวันว่างรองรับ กรุณาเพิ่มเป้ารุ่งอรุณของคนที่ว่าง หรือปรับวันเปิดเวร';
 if(error&&!options.relaxedWorkload)return distributionPlan(state,month,{relaxedWorkload:true});
 return{rIds,xIds,totalR,totalX,rMin,rMax,preferredR,preferredX,preferredTotal,rCapacity,xRequired:xIds.filter(id=>preferredX[id]>0),mainIds:[...main],error,remainder:rIds.length?totalR%rIds.length:0,weekdays:Array.from({length:n},(_,i)=>i+1).filter(d=>![0,6].includes(weekday(month,d))).length};
}
function dawnTargets(state,month){const plan=distributionPlan(state,month);return Object.fromEntries(plan.rIds.map(id=>[id,plan.preferredR[id]]))}
function boundary(state,month,p,side){let adjacent=state.months[monthOffset(month,side)],n=side<0?daysIn(monthOffset(month,-1)):1;let actual=adjacent&&!(adjacent.excludedStaffIds||[]).includes(p.id)?cell(adjacent,p.id,n).code:'';let configured=state.months[month].boundaries?.[p.id]?.[side<0?'prev':'next'];return adjacent?actual:(configured??p[side<0?'prev':'next']??'')}
function totals(state,month){let m=state.months[month],included=new Set(monthPeople(state,month).map(p=>p.id));return state.people.map(p=>{let t={id:p.id,total:0,hours:0,OFF:0,VAC:0,N:0,M:0,A:0,R:0,X:0};if(included.has(p.id))for(let d=1;d<=daysIn(month);d++){let c=cell(m,p.id,d);if(CODES.includes(c.code)){t[c.code]++;t.total++;t.hours+=META[c.code].hours}if(c.block)t[c.block]++}return t})}
function workloadPolicy(state,month){
 const people=monthPeople(state,month).filter(p=>p.active),main=new Set(state.mainStaffIds||MAIN_STAFF_IDS);
 return{main:people.filter(p=>main.has(p.id)),academic:people.filter(p=>!main.has(p.id)&&/^นวก\./.test(p.role||''))};
}
function repairTotals(state,month,base,plan,targets,goals,excl,required={}){
 const m=clone(state.months[month]);m.days=clone(base.days);
 const check=clone(state);check.pairExclusions=excl;check.quotas={};check.months[month]=clone(m);check.months[month].quotas={};check.months[month].categoryQuotas={};check.months[month].distributionRules=false;
 if(!audit(check,month,{distribution:false}).complete)return null;
 const people=monthPeople(state,month),policy=workloadPolicy(state,month),n=daysIn(month),ts=Object.fromEntries(totals({...state,months:{...state.months,[month]:m}},month).map(t=>[t.id,t]));
 let randomSeed=2166136261;for(const char of month+JSON.stringify(targets)+JSON.stringify(goals)){randomSeed^=char.charCodeAt(0);randomSeed=Math.imul(randomSeed,16777619)}
 const random=()=>{randomSeed^=randomSeed<<13;randomSeed^=randomSeed>>>17;randomSeed^=randomSeed<<5;return(randomSeed>>>0)/4294967296};
 function penalty(){let score=0;for(const p of people){const t=ts[p.id];score+=Math.max(0,(required[p.id]??0)-t.total)**2;if(targets[p.id]!==undefined)score+=(t.total-targets[p.id])**2;const cat=categoryTotals(t);for(const g of SHIFT_GROUPS)if(goals[p.id]?.[g.id]!==undefined)score+=(cat[g.id]-goals[p.id][g.id])**2;}for(const p of policy.academic)for(const main of policy.main)score+=Math.max(0,ts[p.id].total-ts[main.id].total)**2;for(const id of plan.xRequired)if(ts[id].X<1)score++;return score}
 function change(id,from,to){const t=ts[id];if(from){t[from]--;t.total--}if(to){t[to]++;t.total++}}
 function swap(a,b,d){const ca=cell(m,a,d),cb=cell(m,b,d);m.cells[key(a,d)]={...ca,code:cb.code};m.cells[key(b,d)]={...cb,code:ca.code};change(a,ca.code,cb.code);change(b,cb.code,ca.code)}
 function valid(p,d){const code=cell(m,p.id,d).code;if(code&&(!eligibleOnDay(p,month,d,code)||cell(m,p.id,d).block))return false;const prev=d===1?boundary(state,month,p,-1):cell(m,p.id,d-1).code,next=d===n?boundary(state,month,p,1):cell(m,p.id,d+1).code;return!restConflict(prev,code)&&!restConflict(code,next)&&!consecutiveConflict(state,month,m,p,d,code,false,n)&&(!code||!people.some(other=>other.id!==p.id&&pairConflict(p.id,other.id,code,cell(m,other.id,d).code,excl)))}
 // A one-unit quota edit often needs only one reassignment. Reuse the valid
 // calendar first, before constructing a new month with the full date search.
 let current=penalty(),stalled=0,lastMove='',repairStart=Date.now();
 for(let pass=0;current&&pass<n*people.length&&Date.now()-repairStart<700;pass++){
  let best=null,bestScore=current,neutral=[],neutralCount=0;
  for(let d=1;d<=n;d++)for(let a=0;a<people.length;a++)for(let b=a+1;b<people.length;b++){
   const p=people[a],q=people[b],ca=cell(m,p.id,d),cb=cell(m,q.id,d);if(ca.locked||cb.locked||ca.code===cb.code||ca.block||cb.block)continue;
   const ka=key(p.id,d),kb=key(q.id,d),oldA=m.cells[ka],oldB=m.cells[kb];swap(p.id,q.id,d);
   if(valid(p,d)&&valid(q,d)){const score=penalty();if(score<bestScore){bestScore=score;best={a:p.id,b:q.id,d}}else if(score===current&&p.id+'|'+q.id+'|'+d!==lastMove){neutralCount++;if(random()<1/neutralCount)neutral=[{a:p.id,b:q.id,d}]}}
   swap(p.id,q.id,d);if(oldA===undefined)delete m.cells[ka];else m.cells[ka]=oldA;if(oldB===undefined)delete m.cells[kb];else m.cells[kb]=oldB;
  }
  if(!best){if(!neutral.length||++stalled>40)break;best=neutral[0]}else stalled=0;
  lastMove=best.a+'|'+best.b+'|'+best.d;swap(best.a,best.b,best.d);current=bestScore;
 }
 if(current)return null;
 m.categoryQuotas={...(m.categoryQuotas||{}),...clone(goals)};m.distributionRules=true;
 const result=clone(state);result.pairExclusions=excl;result.months[month]=m;
 return audit(result,month).complete?m:null;
}
function audit(state,month,options={}){let m=state.months[month],n=daysIn(month),people=monthPeople(state,month),included=new Set(people.map(p=>p.id)),issues=[],ts=totals(state,month);const add=(type,text,p,d)=>issues.push({type,text,p,d});
for(let d=1;d<=n;d++){for(let code of CODES){let got=people.filter(p=>cell(m,p.id,d).code===code).length,need=m.days[d].need[code];if(got!==need)add('coverage','วันที่ '+d+' · '+META[code].name+' '+got+'/'+need+' คน',null,d)}}
for(let p of people){for(let d=1;d<=n;d++){let c=cell(m,p.id,d);if(c.block&&!canUseSymbol(p,c.block))add('eligibility',p.name+' วันที่ '+d+' · รับได้เฉพาะ รพ.สต. (ร สีแดง) หรือช่องว่าง',p.id,d);if(c.code&&c.block)add('blocked',p.name+' วันที่ '+d+' · มีเวรชน '+c.block,p.id,d);if(c.code&&!eligibleOnDay(p,month,d,c.code))add('eligibility',p.name+' วันที่ '+d+' · ไม่รับเวรประเภทนี้',p.id,d);let prev=d===1?boundary(state,month,p,-1):cell(m,p.id,d-1).code;if(restConflict(prev,c.code))add('rest',p.name+' วันที่ '+d+' · '+restDescription(c.code),p.id,d)}
for(const d of consecutiveViolations(state,month,m,p))add('consecutive',p.name+' วันที่ '+d+' · มีเวรติดกันเกิน 2 วัน (นับเฉพาะ ด ช บ รวมกัน ไม่รวมรุ่งอรุณ และตรวจข้ามเดือน)',p.id,d);
const next=boundary(state,month,p,1);if(restConflict(cell(m,p.id,n).code,next))add('rest',p.name+' วันสุดท้าย · '+restDescription(next)+'เดือนถัดไป',p.id,n)}
let excl=options.pairExclusions!==undefined?options.pairExclusions:(state.pairExclusions!==undefined?state.pairExclusions:DEFAULT_PAIR_EXCLUSIONS);
if(excl&&excl.length){for(let d=1;d<=n;d++){for(let[x,y]of excl){if(!included.has(x)||!included.has(y))continue;let cX=cell(m,x,d),cY=cell(m,y,d);if(pairConflict(x,y,cX.code,cY.code,excl)){let pX=state.people.find(p=>p.id===x),pY=state.people.find(p=>p.id===y);add('exclusion','วันที่ '+d+' · '+(pX?pX.name:x)+' กับ '+(pY?pY.name:y)+' มีกะเดียวกันในวันเดียวกัน (สองคนนี้ต้องอยู่คนละกะ)',x,d)}}}}
let targets;try{targets=quotaTargets(state,month,options.quotas||m.quotas||state.quotas||{})}catch(e){add('quota',e.message);targets={}}
if(targets){for(let p of state.people){let tgt=targets[p.id];if(tgt!==undefined&&tgt!==''&&Number.isInteger(Number(tgt))){let actual=ts.find(t=>t.id===p.id)?.total??0;if(actual!==Number(tgt)){add('quota',p.name+' มี '+actual+' เวร (เป้าหมาย '+tgt+' เวร)',p.id)}}}}
try{for(const[id,values]of Object.entries(categoryTargets(state,month))){const actual=categoryTotals(ts.find(t=>t.id===id)),p=state.people.find(p=>p.id===id);for(const g of SHIFT_GROUPS)if(values[g.id]!==undefined&&actual[g.id]!==values[g.id])add('quota',p.name+' · '+g.label+' '+actual[g.id]+'/'+values[g.id]+' เวร',id)}}catch(e){add('quota',e.message)}
const distribution=options.distribution??m.distributionRules??false;
const counts=group(state,month).map(id=>{const t=ts.find(t=>t.id===id);return distribution?categoryTotals(t).card:t.total});
if(distribution){
 const plan=distributionPlan(state,month);
 if(plan.error)add('quota',plan.error);
 const policy=workloadPolicy(state,month),minimum=Math.min(...policy.main.map(p=>ts.find(t=>t.id===p.id).total));
 for(const p of policy.academic){const actual=ts.find(t=>t.id===p.id).total;if(actual>minimum)add('distribution',p.name+' · เวรรวม '+actual+' มากกว่าตัวหลักที่ได้น้อยที่สุด ('+minimum+' เวร)',p.id)}
 for(const id of plan.xRequired){const t=ts.find(t=>t.id===id),p=people.find(p=>p.id===id);if(t.X<1)add('distribution',p.name+' · รพ.สต. ให้ตัวหลักก่อนเมื่อเวรไม่พอ (ขาด 1 เวร)',id)}
}
return{issues,totals:ts,complete:!issues.length,groupCounts:counts}
}
function solve(state,month,opts={}){
 const calendar=opts.calendar??state.months[month].calendarRules??false;
 if(calendar){state=clone(state);normalizeCalendarDemand(state,month)}
 const original=state.months[month], n=daysIn(month), people=monthPeople(state,month), included=new Set(people.map(p=>p.id)),distribution=opts.distribution??original.distributionRules??false;
 const excl=opts.pairExclusions!==undefined?opts.pairExclusions:(state.pairExclusions!==undefined?state.pairExclusions:DEFAULT_PAIR_EXCLUSIONS);
 const mainIds=opts.mainStaffIds||state.mainStaffIds||MAIN_STAFF_IDS;
 let targets,categoryGoals;try{targets=quotaTargets(state,month,opts.quotas||original.quotas||state.quotas||{});categoryGoals=categoryTargets(state,month)}catch(e){return{ok:false,reason:'quota',message:e.message}}
 if((categoryGoals['9']?.card??0)>0)return{ok:false,reason:'quota',message:'นายปรเมศวร์รับได้เฉพาะ รพ.สต. (ร สีแดง) กรุณาตั้งเป้าห้องบัตรเป็น 0'};
 const base=clone(original), demand=[],lockedCounts={},counts={};people.forEach(p=>{counts[p.id]=0;lockedCounts[p.id]=0});
 for(let [k,c] of Object.entries(base.cells)){if(!included.has(k.split('|')[0]))continue;if(!c.locked)c.code='';if(!c.code&&!c.block&&!c.locked)delete base.cells[k]}
 const allTargets=people.every(p=>targets[p.id]!==undefined),requestedTotal=Object.values(targets).reduce((a,b)=>a+b,0);
 if(original.autoCapacity)for(let d=1;d<=n;d++)base.days[d].need=clone(original.autoCapacity[d]||base.days[d].need);
 const totalDemand=Object.values(base.days).reduce((s,x)=>s+CODES.reduce((a,c)=>a+x.need[c],0),0);
 if(!people.length&&totalDemand>0)return{ok:false,reason:'capacity',message:'ยังไม่ได้เลือกบุคลากรลงตารางเดือนนี้ กรุณาเลือกที่เมนูบุคลากร'};
 const flexible=!calendar&&allTargets&&requestedTotal<totalDemand;
 if(calendar){
  const demand=calendarDemand(state,month),description='เดือนนี้มีวันธรรมดา '+demand.regularDays+' × 2 + วันหยุด '+demand.holidayDays+' × 4 = ห้องบัตร '+demand.card+' เวร และรุ่งอรุณ '+demand.dawn+' เวร (หน้าตู้KIOS '+demand.R+' + รพ.สต. '+demand.X+') รวม '+demand.total+' เวร';
  for(const g of SHIFT_GROUPS){const requested=people.reduce((sum,p)=>sum+(categoryGoals[p.id]?.[g.id]??0),0),capacity=demand[g.id],everyone=people.every(p=>categoryGoals[p.id]?.[g.id]!==undefined);if(requested>capacity||everyone&&requested!==capacity)return{ok:false,reason:'quota',message:description+'\nยอด'+g.label+'ที่กรอก '+requested+' เวรไม่ตรงกับ '+capacity+' เวรตามปฏิทิน กรุณาปรับยอด หรือล้างตัวเลขของบางคนเพื่อให้ระบบกระจายส่วนที่เหลือ โดยไม่ต้องตั้งจำนวนห้องบัตรทีละวัน'};}
  if(allTargets&&requestedTotal!==totalDemand)return{ok:false,reason:'quota',message:description+'\nยอดรวมที่กรอก '+requestedTotal+' เวรไม่ตรงกับ '+totalDemand+' เวร กรุณาปรับยอด หรือล้างตัวเลขของบางคนเพื่อให้ระบบคำนวณส่วนที่เหลือ'};
 }
 if(allTargets&&requestedTotal>totalDemand)return{ok:false,reason:'capacity',message:'จำนวนที่กรอกรวม '+requestedTotal+' เวร มากกว่าช่องเวรที่เปิดรับรายวัน '+totalDemand+' เวร กรุณาเพิ่มจำนวนที่หัววันที่หรือลดจำนวนเวรที่กรอก'};
 for(const g of SHIFT_GROUPS){const requested=people.reduce((sum,p)=>sum+(categoryGoals[p.id]?.[g.id]||0),0),capacity=Object.values(base.days).reduce((sum,day)=>sum+g.codes.reduce((a,c)=>a+day.need[c],0),0);if(requested>capacity)return{ok:false,reason:'capacity',message:g.label+' ตั้งเป้ารวม '+requested+' เวร แต่เปิดรับไว้ '+capacity+' เวร กรุณาปรับเป้าหรือจำนวนเวรที่หัววันที่'}}
 const fixedIssues=[];
 for(let d=1;d<=n;d++){
  for(let p of people){let c=cell(base,p.id,d);if(c.block&&!canUseSymbol(p,c.block))fixedIssues.push(p.name+' วันที่ '+d+' รับได้เฉพาะ รพ.สต. (ร สีแดง) หรือช่องว่าง กรุณาล้าง '+c.block);if(!c.code)continue;counts[p.id]++;lockedCounts[p.id]++;if(!canUseSymbol(p,c.code))fixedIssues.push(p.name+' วันที่ '+d+' รับได้เฉพาะ รพ.สต. (ร สีแดง) กรุณาล้างหรือแก้เวรที่ล็อกไว้');else if(c.block||!eligibleOnDay(p,month,d,c.code))fixedIssues.push(p.name+' วันที่ '+d+' เวรล็อกชนวันหยุด/สิทธิ์รับเวร');let prev=d===1?boundary(state,month,p,-1):cell(base,p.id,d-1).code;if(restConflict(prev,c.code))fixedIssues.push(p.name+' วันที่ '+d+' เวรล็อก'+restDescription(c.code));const next=boundary(state,month,p,1);if(d===n&&restConflict(c.code,next))fixedIssues.push(p.name+' วันสุดท้าย '+restDescription(next)+'ข้ามเดือน')}
  if(excl&&excl.length){for(let[x,y]of excl){if(!included.has(x)||!included.has(y))continue;let cX=cell(base,x,d),cY=cell(base,y,d);if(pairConflict(x,y,cX.code,cY.code,excl)){let pX=people.find(p=>p.id===x),pY=people.find(p=>p.id===y);fixedIssues.push('วันที่ '+d+' เวรล็อกของ '+(pX?pX.name:x)+' ชนกับ '+(pY?pY.name:y)+' (สองคนนี้ห้ามอยู่กะเดียวกัน)')}}}
  for(let code of CODES){let got=people.filter(p=>cell(base,p.id,d).code===code).length,need=base.days[d].need[code];if(got>need)fixedIssues.push('วันที่ '+d+' เวร '+META[code].name+' ที่ล็อกไว้เกินจำนวน');for(let i=got;i<need;i++)demand.push({d,code})}
 }
 for(let[pid,tgt]of Object.entries(targets)){if(counts[pid]>tgt){let p=people.find(x=>x.id===pid);fixedIssues.push((p?p.name:pid)+' มีเวรล็อกไว้ ('+counts[pid]+' เวร) เกินเป้าหมาย ('+tgt+' เวร)')}}
 const baseCategories=Object.fromEntries(totals({...state,months:{...state.months,[month]:base}},month).map(t=>[t.id,categoryTotals(t)]));
 for(const p of people)for(const g of SHIFT_GROUPS){const target=categoryGoals[p.id]?.[g.id],actual=baseCategories[p.id][g.id];if(target!==undefined&&actual>target)fixedIssues.push(p.name+' · '+g.label+' ล็อกไว้ '+actual+' เวร มากกว่าเป้า '+target+' เวร กรุณาเพิ่มเป้าหรือปลดล็อกเวรบางช่อง')}
 for(const p of people)for(const d of consecutiveViolations(state,month,base,p))fixedIssues.push(p.name+' วันที่ '+d+' · เวรห้องบัตรที่ล็อกไว้ติดกันเกิน 2 วัน นับ ด ช บ รวมกันและข้ามเดือน กรุณาปลดล็อกหรือแก้บางช่อง');
 if(fixedIssues.length)return{ok:false,message:fixedIssues.slice(0,5).join('\n'),reason:'fixed'};
 function capacityFor(p,codes){return maxAssignable(state,month,base,p,codes)}
 for(const p of people){
  for(const category of SHIFT_GROUPS){const target=categoryGoals[p.id]?.[category.id];if(target===undefined)continue;const maximum=capacityFor(p,category.codes);if(target>maximum)return{ok:false,reason:'quota',message:p.name+' ตั้งเป้า'+category.label+' '+target+' เวร แต่วันเปิดเวร วันลา เวรล็อก และกติกาห้องบัตรไม่เกิน 2 วันติดกัน รองรับได้สูงสุด '+maximum+' เวร กรุณาปรับเป้าหรือวันเปิดเวร'};}
  if(targets[p.id]!==undefined){const maximum=capacityFor(p,CODES);if(targets[p.id]>maximum)return{ok:false,reason:'quota',message:p.name+' ตั้งเป้ารวม '+targets[p.id]+' เวร แต่ลงได้สูงสุด '+maximum+' วันตามกติกาห้องบัตรไม่เกิน 2 วันติดกัน กรุณาปรับเป้าหรือวันลา'};}
 }
 const policy=workloadPolicy(state,month);
 const maximum=Object.fromEntries(people.map(p=>[p.id,Math.min(targets[p.id]??n,capacityFor(p,CODES),(categoryGoals[p.id]?.card??capacityFor(p,['N','M','A']))+(categoryGoals[p.id]?.dawn??capacityFor(p,['R','X'])))]));
 const minimum=Object.fromEntries(people.map(p=>[p.id,targets[p.id]??Math.max(counts[p.id],(categoryGoals[p.id]?.card??baseCategories[p.id].card)+(categoryGoals[p.id]?.dawn??baseCategories[p.id].dawn))]));
 if(distribution&&policy.main.length){
  const ceiling=Math.min(...policy.main.map(p=>maximum[p.id]));
  for(const p of policy.academic){if(minimum[p.id]>ceiling)return{ok:false,reason:'quota',message:p.name+' ต้องมีเวรรวมอย่างน้อย '+minimum[p.id]+' เวร แต่ตัวหลักที่ได้น้อยที่สุดรับได้ '+ceiling+' เวร จึงขัดกับกติกา นวก. ไม่เกินตัวหลักทุกคน กรุณาปรับเป้าหรือวันลา'};maximum[p.id]=Math.min(maximum[p.id],ceiling)}
  const academicMinimum=Math.max(0,...policy.academic.map(p=>minimum[p.id]));
  for(const p of policy.main)minimum[p.id]=Math.max(minimum[p.id],academicMinimum);
  if(Object.values(minimum).reduce((a,b)=>a+b,0)>totalDemand)return{ok:false,reason:'quota',message:'ยอดที่กรอกต้องใช้เวรรวมอย่างน้อย '+Object.values(minimum).reduce((a,b)=>a+b,0)+' เวร เพื่อให้ นวก. ไม่เกินตัวหลักทุกคน แต่เปิดไว้ '+totalDemand+' เวร กรุณาลดยอดที่กรอกหรือเพิ่มวันเปิดเวร'};
 }
 const plan=distributionPlan({...state,months:{...state.months,[month]:base}},month);

 const blueIds=new Set(plan.rIds),redIds=new Set(plan.xRequired),mainSet=new Set(mainIds),baseBlue=Object.fromEntries(people.map(p=>[p.id,Array.from({length:n},(_,i)=>cell(base,p.id,i+1).code).filter(code=>code==='R').length])),baseRed=Object.fromEntries(people.map(p=>[p.id,Array.from({length:n},(_,i)=>cell(base,p.id,i+1).code).filter(code=>code==='X').length]));
 for(let d=1;d<=n;d++){let required=demand.filter(s=>s.d===d).length;let available=people.filter(p=>!cell(base,p.id,d).block&&!cell(base,p.id,d).code&&p.allowed.some(c=>eligibleOnDay(p,month,d,c)&&base.days[d].need[c]>0)).length;if(!flexible&&required>available)return{ok:false,reason:'capacity',message:'วันที่ '+d+' ต้องเพิ่มอีก '+required+' คน แต่มีคนว่าง '+available+' คน (OFF / VAC / เวรล็อกในวันนี้ / สิทธิ์รับเวร) กรุณาปรับวันหยุดหรือกำลังคน'};}
 for(let slot of demand){let poss=people.filter(p=>eligibleOnDay(p,month,slot.d,slot.code)&&!cell(base,p.id,slot.d).block&&!cell(base,p.id,slot.d).code);if(!flexible&&!poss.length)return{ok:false,message:'วันที่ '+slot.d+' เวร '+META[slot.code].name+' ไม่มีคนที่ว่างและรับเวรนี้ได้',reason:'capacity'}}
 if(!flexible&&distribution){
  // A relaxed matching proves aggregate shortages before the date search. Each
  // person/day has capacity one; person totals are capped.
  const graph=[],node=()=>{graph.push([]);return graph.length-1},source=node(),sink=node(),personNodes={},dayNodes={};
  const edge=(a,b,cap)=>{graph[a].push({to:b,rev:graph[b].length,cap});graph[b].push({to:a,rev:graph[a].length-1,cap:0})};
  for(const p of people){personNodes[p.id]=node();edge(personNodes[p.id],sink,Math.max(0,maximum[p.id]-counts[p.id]));}
  for(const slot of demand){const slotNode=node();edge(source,slotNode,1);for(const p of people){const current=cell(base,p.id,slot.d),category=SHIFT_GROUP_BY_CODE[slot.code],prev=slot.d===1?boundary(state,month,p,-1):cell(base,p.id,slot.d-1).code,next=slot.d===n?boundary(state,month,p,1):cell(base,p.id,slot.d+1).code;if(current.code||current.block||!eligibleOnDay(p,month,slot.d,slot.code)||restConflict(prev,slot.code)||restConflict(slot.code,next)||consecutiveConflict(state,month,base,p,slot.d,slot.code,false,n)||(categoryGoals[p.id]?.[category]??n)<=baseCategories[p.id][category]||people.some(other=>other.id!==p.id&&pairConflict(p.id,other.id,slot.code,cell(base,other.id,slot.d).code,excl)))continue;const k=key(p.id,slot.d);if(dayNodes[k]===undefined){dayNodes[k]=node();edge(dayNodes[k],personNodes[p.id],1)}edge(slotNode,dayNodes[k],1)}}
  let covered=0;while(true){const previous=Array(graph.length).fill(null),queue=[source];previous[source]=[-1,-1];for(let h=0;h<queue.length&&previous[sink]===null;h++)for(let i=0;i<graph[queue[h]].length;i++){const e=graph[queue[h]][i];if(e.cap>0&&previous[e.to]===null){previous[e.to]=[queue[h],i];queue.push(e.to)}}if(previous[sink]===null)break;for(let at=sink;at!==source;){const [from,i]=previous[at],e=graph[from][i];e.cap--;graph[at][e.rev].cap++;at=from}covered++;}
  if(covered<demand.length)return{ok:false,reason:'quota',message:'เป้ารวม สิทธิ์รับเวร วันลา และกติกา นวก. ไม่เกินตัวหลักทุกคน รองรับได้สูงสุด '+(covered+Object.values(counts).reduce((a,b)=>a+b,0))+' จาก '+totalDemand+' เวร ขาดอย่างน้อย '+(demand.length-covered)+' เวร กรุณาปรับยอดรวมของตัวหลักหรือจำนวนเวรที่เปิด'};
 }
 if(distribution&&plan.error)return{ok:false,reason:'quota',message:plan.error};
 if(distribution){
  for(const id of plan.xRequired)minimum[id]=Math.max(minimum[id],(categoryGoals[id]?.card??baseCategories[id].card)+Math.max(categoryGoals[id]?.dawn??baseCategories[id].dawn,1));
  if(policy.main.length){const floor=Math.max(0,...policy.academic.map(p=>minimum[p.id]));for(const p of policy.main)minimum[p.id]=Math.max(minimum[p.id],floor)}
  const required=Object.values(minimum).reduce((a,b)=>a+b,0);
  if(required>totalDemand)return{ok:false,reason:'quota',message:'ยอดที่กรอก รวมกติกา นวก. ไม่เกินตัวหลักทุกคน และ รพ.สต. อย่างน้อยคนละ 1 ต้องใช้อย่างน้อย '+required+' เวร แต่เปิดไว้ '+totalDemand+' เวร กรุณาลดยอดที่กรอกหรือเพิ่มวันเปิดเวร'};
 }
 if(distribution&&!flexible&&(Object.keys(targets).length||Object.keys(categoryGoals).length)){
  const repaired=repairTotals(state,month,base,plan,targets,categoryGoals,excl,minimum);if(repaired)return{ok:true,month:repaired,nodes:0,reallocated:true};
  // Goals may be entered before the first schedule. Start from a valid calendar
  // with the same locks/leave, then adjust counts instead of searching from zero.
  if(opts.seed!==false){const seed=clone(state);seed.quotas={};seed.months[month].quotas={};seed.months[month].categoryQuotas={};const initial=solve(seed,month,{...opts,quotas:{},seed:false,ms:Math.min(600,(opts.ms||5000)*.2),nodes:20000});if(initial.ok){const seeded=clone(state);seeded.months[month].cells=initial.month.cells;const adjusted=repairTotals(seeded,month,base,plan,targets,categoryGoals,excl,minimum);if(adjusted)return{ok:true,month:adjusted,nodes:initial.nodes,reallocated:true}}}
 }
 const preferredR=plan.preferredR,baseR=baseBlue,preferChronological=Object.keys(categoryGoals).length<3;
 let nodes=0,timedOut=false;const start=Date.now(),limit=opts.ms||5000, nodeLimit=opts.nodes||180000;
 for(const strictR of [true,false]){timedOut=false;const chronological=preferChronological;
  let m=clone(base),cnt={...counts},remaining=demand.map((s,i)=>({...s,i}));
  const rCnt={...baseR},xCnt={...baseRed},catCnt=clone(baseCategories),exact={...targets},codeCnt=Object.fromEntries(people.map(p=>[p.id,Object.fromEntries(CODES.map(code=>[code,0]))]));
  for(const p of people)for(let d=1;d<=n;d++){const code=cell(base,p.id,d).code;if(code)codeCnt[p.id][code]++}
  const partners=Object.fromEntries(people.map(p=>[p.id,people.filter(other=>other.id!==p.id&&isExcludedPair(p.id,other.id,excl)).map(other=>other.id)]));
  if(Object.entries(exact).reduce((sum,[id,t])=>sum+t-counts[id],0)>remaining.length)continue;
  if(!flexible&&people.every(p=>exact[p.id]!==undefined)&&Object.values(exact).reduce((a,b)=>a+b,0)!==totalDemand)continue;
  if(strictR&&people.some(p=>baseR[p.id]>(preferredR[p.id]||0)||(exact[p.id]!==undefined&&exact[p.id]<(preferredR[p.id]||0))))continue;
  if(strictR&&people.some(p=>categoryGoals[p.id]?.dawn!==undefined&&categoryGoals[p.id].dawn<(preferredR[p.id]||0)))continue;
  function eligible(p,s){
   let c=cell(m,p.id,s.d);
   if(!eligibleOnDay(p,month,s.d,s.code)||c.block||c.code)return false;
   const category=SHIFT_GROUP_BY_CODE[s.code];if(categoryGoals[p.id]?.[category]!==undefined&&catCnt[p.id][category]>=categoryGoals[p.id][category])return false;
   if(targets[p.id]!==undefined&&cnt[p.id]>=targets[p.id])return false;
   if(distribution&&cnt[p.id]>=maximum[p.id])return false;
   if(strictR&&s.code==='R'&&rCnt[p.id]>=(preferredR[p.id]||0))return false;
   if(distribution&&strictR&&s.code==='X'&&xCnt[p.id]>=(plan.preferredX[p.id]||0))return false;
   if(partners[p.id].some(id=>sameShift(s.code,cell(m,id,s.d).code)))return false;
   let prev=s.d===1?boundary(state,month,p,-1):cell(m,p.id,s.d-1).code,next=s.d===n?boundary(state,month,p,1):cell(m,p.id,s.d+1).code;
   return !restConflict(prev,s.code)&&!restConflict(s.code,next)&&!consecutiveConflict(state,month,m,p,s.d,s.code,false,n)
  }
  function quotaFlow(left,category){
   const slots=category?left.filter(s=>SHIFT_GROUP_BY_CODE[s.code]===category):left;
   const required=people.map(p=>({p,gap:Math.max(0,category?(categoryGoals[p.id]?.[category]??0)-catCnt[p.id][category]:(distribution?minimum[p.id]:targets[p.id]??0)-cnt[p.id])})).filter(x=>x.gap>0),total=required.reduce((sum,x)=>sum+x.gap,0);
   if(!total)return true;if(total>slots.length)return false;
   const graph=[],node=()=>{graph.push([]);return graph.length-1},source=node(),sink=node(),slotNodes=slots.map(()=>node());
   const edge=(a,b,cap)=>{graph[a].push({to:b,rev:graph[b].length,cap});graph[b].push({to:a,rev:graph[a].length-1,cap:0})};
   slotNodes.forEach(v=>edge(v,sink,1));
   for(const {p,gap}of required){const person=node(),dates={};edge(source,person,gap);for(let i=0;i<slots.length;i++)if(eligible(p,slots[i])){const d=slots[i].d;if(dates[d]===undefined){dates[d]=node();edge(person,dates[d],1)}edge(dates[d],slotNodes[i],1)}}
   let flow=0;
   while(flow<total){
    const level=Array(graph.length).fill(-1),queue=[source];level[source]=0;for(let h=0;h<queue.length;h++)for(const e of graph[queue[h]])if(e.cap>0&&level[e.to]<0){level[e.to]=level[queue[h]]+1;queue.push(e.to)}
    if(level[sink]<0)return false;
    const next=Array(graph.length).fill(0);function send(v,amount){if(v===sink)return amount;for(;next[v]<graph[v].length;next[v]++){const e=graph[v][next[v]];if(e.cap>0&&level[e.to]===level[v]+1){const sent=send(e.to,Math.min(amount,e.cap));if(sent){e.cap-=sent;graph[e.to][e.rev].cap+=sent;return sent}}}return 0}
    let sent;while((sent=send(source,total-flow)))flow+=sent;
   }
   return true;
  }
  const failedDays=new Set(),dailyDemand=Object.fromEntries(Array.from({length:n},(_,i)=>[i+1,demand.filter(s=>s.d===i+1).length]));
  function dfs(left){
   const day=left[0]?.d,memo=distribution&&chronological&&day&&left.filter(s=>s.d===day).length===dailyDemand[day]?day+'|'+people.map(p=>cnt[p.id]+','+rCnt[p.id]+','+xCnt[p.id]+','+(dutyCode(state,month,m,p,day-1)==='A'?1:0)+','+(CARD_CODES.includes(dutyCode(state,month,m,p,day-1))?(CARD_CODES.includes(dutyCode(state,month,m,p,day-2))?2:1):0)).join('|'):null;
   if(memo&&failedDays.has(memo))return false;
   const result=search(left);if(memo&&!result&&!timedOut)failedDays.add(memo);return result;
  }
  function search(left){
   if(++nodes>(strictR?nodeLimit*.7:nodeLimit)||Date.now()-start>(strictR?limit*.7:limit)){timedOut=true;return false}
   const categoriesComplete=()=>people.every(p=>SHIFT_GROUPS.every(g=>categoryGoals[p.id]?.[g.id]===undefined||catCnt[p.id][g.id]===categoryGoals[p.id][g.id]));
   const distributionComplete=()=>!distribution||(plan.xRequired.every(id=>xCnt[id]>=1)&&Object.values(rCnt).reduce((a,b)=>a+b,0)===plan.totalR&&Object.values(xCnt).reduce((a,b)=>a+b,0)===plan.totalX);
   const workloadComplete=()=>!distribution||policy.academic.every(p=>policy.main.every(main=>cnt[p.id]<=cnt[main.id]));
   if(flexible&&people.every(p=>cnt[p.id]===targets[p.id]))return categoriesComplete()&&distributionComplete()&&workloadComplete()&&(!strictR||people.every(p=>rCnt[p.id]===(preferredR[p.id]||0)));
   if(flexible&&Object.entries(exact).reduce((sum,[id,t])=>sum+t-cnt[id],0)>left.length)return false;
   if(!left.length){
    for(let[pid,tgt]of Object.entries(targets)){if(cnt[pid]!==tgt)return false}
    return categoriesComplete()&&distributionComplete()&&workloadComplete();
   }
   if(distribution)for(const p of people){
    const rGap=strictR&&blueIds.has(p.id)?Math.max(0,(preferredR[p.id]||0)-rCnt[p.id]):0,xGap=strictR?Math.max(0,(plan.preferredX[p.id]||0)-xCnt[p.id]):redIds.has(p.id)?Math.max(0,1-xCnt[p.id]):0;
    if((exact[p.id]??n)-cnt[p.id]<rGap+xGap||(categoryGoals[p.id]?.dawn??n)-catCnt[p.id].dawn<rGap+xGap)return false;
    if((rGap&&rGap>new Set(left.filter(s=>s.code==='R'&&eligible(p,s)).map(s=>s.d)).size)||(xGap&&xGap>new Set(left.filter(s=>s.code==='X'&&eligible(p,s)).map(s=>s.d)).size))return false;
   }
   for(let[pid,tgt]of Object.entries(targets)){let p=people.find(x=>x.id===pid),gap=tgt-cnt[pid];if(gap<0||gap>new Set(left.filter(s=>eligible(p,s)).map(s=>s.d)).size)return false}
   if(distribution&&policy.main.length){const required=Math.max(0,...policy.academic.map(p=>Math.max(cnt[p.id],minimum[p.id])));for(const p of policy.main){const gap=Math.max(required,minimum[p.id])-cnt[p.id];if(gap>0&&gap>new Set(left.filter(s=>eligible(p,s)).map(s=>s.d)).size)return false}}
   if(distribution&&people.reduce((sum,p)=>sum+Math.max(0,minimum[p.id]-cnt[p.id]),0)>left.length)return false;
   for(const p of people)for(const category of SHIFT_GROUPS){const target=categoryGoals[p.id]?.[category.id];if(target===undefined)continue;const gap=target-catCnt[p.id][category.id];if(gap<0||gap>new Set(left.filter(s=>SHIFT_GROUP_BY_CODE[s.code]===category.id&&eligible(p,s)).map(s=>s.d)).size)return false}
   const firstDay=left[0]?.d;
   if(firstDay&&(chronological?left.filter(s=>s.d===firstDay).length===dailyDemand[firstDay]:left.length%8===0)){
    const daysLeft=new Set(left.map(s=>s.d)).size,academicFloor=distribution?Math.max(0,...policy.academic.map(p=>Math.max(cnt[p.id],minimum[p.id]))):0;
    let future;
    for(const p of people){const target=Math.max(distribution?minimum[p.id]:targets[p.id]??0,distribution&&mainSet.has(p.id)?academicFloor:0);if(target-cnt[p.id]<Math.max(2,daysLeft*.55))continue;
     if(!future){future={...m,days:Object.fromEntries(Object.entries(m.days).map(([d,day])=>[d,{...day,need:Object.fromEntries(CODES.map(code=>[code,0]))}])),cells:Object.fromEntries(Object.entries(m.cells).map(([k,c])=>[k,c.code?{...c,locked:true}:c]))};for(const slot of left)future.days[slot.d].need[slot.code]++}
     if(maxAssignable({...state,pairExclusions:excl},month,future,p,CODES)<target)return false;
    }
   }
   if((Object.keys(targets).length>=3||Object.keys(categoryGoals).length>=3)&&firstDay&&(chronological?left.filter(s=>s.d===firstDay).length===dailyDemand[firstDay]:left.length%8===0)&&(!quotaFlow(left)||!quotaFlow(left,'card')||!quotaFlow(left,'dawn')))return false;
   let pick=0,candidates=null;
   for(let i=0;i<left.length;i++){
    const list=people.filter(p=>eligible(p,left[i]));
    if(!list.length){if(flexible&&(!distribution||!['R','X'].includes(left[i].code)))continue;return false}
    const load=d=>people.filter(p=>cell(m,p.id,d).code).length;
    const priority=slot=>distribution?(chronological?slot.d:({X:0,R:100,N:200,M:200,A:200}[slot.code])):((SHIFT_GROUP_BY_CODE[slot.code]==='dawn'?0:100)+load(slot.d)*10);
    if(candidates===null||((flexible||distribution)?priority(left[i])<priority(left[pick])||(priority(left[i])===priority(left[pick])&&list.length<candidates.length):list.length<candidates.length)){pick=i;candidates=list;if(!flexible&&!distribution&&list.length===1)break}
   }
   if(candidates===null)return false;
   let s=left[pick],rest=left.filter((_,i)=>i!==pick);
   let isR=s.code==='R',isX=s.code==='X';
   let scores=new Map(candidates.map(p=>{
    let same=codeCnt[p.id][s.code];
    const category=SHIFT_GROUP_BY_CODE[s.code],pTarget=categoryGoals[p.id]?.[category]??targets[p.id],categoryTarget=categoryGoals[p.id]?.[category]!==undefined;
    let deficit=pTarget!==undefined?(pTarget-(categoryTarget?catCnt[p.id][category]:cnt[p.id]))/Math.max(1,pTarget):0;
    const tie=((s.d*17+people.indexOf(p)*13+Number(month.slice(-2)))%23)/23;
    let score=(category==='card'?catCnt[p.id].card:cnt[p.id])-.7*deficit+.15*same+tie*.65;
    if(distribution&&category==='card'){
     // Extra card shifts go to the main group, then Rapeephan, before academics.
     const preferred=plan.preferredTotal[p.id]??0;
     score=(preferred?100*cnt[p.id]/preferred:1000+cnt[p.id])+(mainSet.has(p.id)?-1:p.id==='8'?0:1.5)+.15*same-4*deficit+tie*.2;
     if(mainSet.has(p.id)&&cnt[p.id]<Math.max(0,...policy.academic.map(other=>Math.max(cnt[other.id],minimum[other.id]))))score-=1000;
    }
    if(isR){
     score=100*(rCnt[p.id]-(preferredR[p.id]||0))+score;
     if(distribution&&!strictR&&plan.totalR<plan.rIds.length&&mainSet.has(p.id))score-=500;
    }
    if(distribution&&isX)score+=100*xCnt[p.id]+(xCnt[p.id]===0?-1000:0)+(plan.totalX<plan.xIds.length&&mainSet.has(p.id)?-500:0);
    return[p.id,score];
   }));
   candidates.sort((a,b)=>scores.get(a.id)-scores.get(b.id));
   for(let p of candidates){let k=key(p.id,s.d),old=m.cells[k];m.cells[k]={code:s.code,block:'',locked:false};cnt[p.id]++;codeCnt[p.id][s.code]++;catCnt[p.id][SHIFT_GROUP_BY_CODE[s.code]]++;if(isR)rCnt[p.id]++;if(isX)xCnt[p.id]++;
    if(dfs(rest))return true;
    cnt[p.id]--;codeCnt[p.id][s.code]--;catCnt[p.id][SHIFT_GROUP_BY_CODE[s.code]]--;if(isR)rCnt[p.id]--;if(isX)xCnt[p.id]--;if(old)m.cells[k]=old;else delete m.cells[k];if(timedOut)return false
   }return flexible&&!timedOut&&(!distribution||!['R','X'].includes(s.code))?dfs(rest):false;
  }
  if(dfs(remaining)){
   if(flexible){m.autoCapacity=Object.fromEntries(Object.entries(base.days).map(([d,day])=>[d,clone(day.need)]));for(let d=1;d<=n;d++)for(const code of CODES)m.days[d].need[code]=people.filter(p=>cell(m,p.id,d).code===code).length}
   const test=clone(state);test.months[month]=m;
   if(excl!==undefined)test.pairExclusions=excl;
   // Keep only explicit goals. Untargeted fields display live counts in the UI.
   m.quotas={...(original.quotas||{})};
   m.categoryQuotas={...(original.categoryQuotas||{}),...clone(categoryGoals)};
   if(distribution)m.distributionRules=true;
   const a=audit(test,month);
   if(a.complete)return{ok:true,month:m,nodes,dawnBalanced:strictR};
   return{ok:false,message:'ผลจัดเวรยังไม่ผ่านการตรวจ: '+(a.issues[0]?.text||'กรุณาตรวจการตั้งค่า')};
  }
 }
 return{ok:false,reason:timedOut?'timeout':'infeasible',message:timedOut?'ยังหาคำตอบไม่ทันเวลาที่กำหนด ลองจัดอีกครั้ง หรือปลดล็อกบางช่อง / ตรวจวัน OFF และ VAC':'ไม่พบตารางที่ตรงทุกเงื่อนไข ตรวจจำนวนคน วันลา เวรที่ล็อก เป้ารายคน สิทธิ์รับเวร และกติกาห้องบัตรไม่เกิน 2 วันติดกัน',nodes};
}
// Validate a whole painted range before committing anything to the live state.
function manualRange(state,month,id,start,end,value){
 const p=state.people.find(p=>p.id===id),n=daysIn(month);
 if(!p||!Number.isInteger(start)||!Number.isInteger(end)||Math.min(start,end)<1||Math.max(start,end)>n||!['',...CODES,'OFF','VAC'].includes(value))return{ok:false,message:'เลือกคน วันที่ และชนิดเวรให้ถูกต้อง'};
 if(!monthPeople(state,month).some(person=>person.id===id))return{ok:false,message:'บุคลากรคนนี้ไม่ได้ลงตารางเดือนนี้'};
 if(!canUseSymbol(p,value))return{ok:false,message:p.name+' รับได้เฉพาะ รพ.สต. (ร สีแดง) หรือช่องว่าง · ยังไม่ได้แก้ไขทุกช่องที่เลือก'};
 const code=CODES.includes(value)?value:'',block=['OFF','VAC'].includes(value)?value:'';
 if(code&&(!p.active||!p.allowed.includes(code)))return{ok:false,message:p.name+' ไม่ได้เปิดรับเวรประเภทนี้ · ยังไม่ได้แก้ไขทุกช่องที่เลือก'};
 const m=clone(state.months[month]),lo=Math.min(start,end),hi=Math.max(start,end);let changed=0;
 if(code)for(let d=lo;d<=hi;d++)if(!eligibleOnDay(p,month,d,code))return{ok:false,message:'วันที่ '+d+' ไม่ได้เปิดรับเวรประเภทนี้ · ยังไม่ได้แก้ไขทุกช่องที่เลือก'};
 if(code){for(let d=lo;d<=hi;d++){const other=monthPeople(state,month).find(other=>pairConflict(p.id,other.id,code,cell(m,other.id,d).code,state.pairExclusions??DEFAULT_PAIR_EXCLUSIONS));if(other)return{ok:false,message:'วันที่ '+d+' '+p.name+' ห้ามอยู่กะเดียวกับ '+other.name+' · ยังไม่ได้แก้ไขทุกช่องที่เลือก'}}}
 for(let d=lo;d<=hi;d++){
  const old=cell(m,id,d),next={code,block,locked:!!code};
  if(old.code!==code||old.block!==block||old.locked!==next.locked){m.cells[key(id,d)]=next;changed++}
 }
 for(let d=lo;d<=Math.min(n,hi+1);d++){
  const prev=d===1?boundary(state,month,p,-1):cell(m,id,d-1).code;
  if(restConflict(prev,cell(m,id,d).code))return{ok:false,message:'วันที่ '+d+' '+restDescription(cell(m,id,d).code)+' · ยังไม่ได้แก้ไขทุกช่องที่เลือก'};
 }
 if(hi===n&&restConflict(cell(m,id,n).code,boundary(state,month,p,1)))return{ok:false,message:restDescription(boundary(state,month,p,1))+'ข้ามเดือน · ยังไม่ได้แก้ไขทุกช่องที่เลือก'};
 const consecutive=consecutiveViolations(state,month,m,p,lo,hi);if(consecutive.length)return{ok:false,message:p.name+' วันที่ '+consecutive[0]+' · ห้ามลงห้องบัตรติดกันเกิน 2 วัน นับ ด ช บ รวมกัน รุ่งอรุณไม่นับ และตรวจข้ามเดือน · ยังไม่ได้แก้ไขทุกช่องที่เลือก'};
 if(m.calendarRules&&['R','X'].includes(code))for(let d=lo;d<=hi;d++)m.days[d].need[code]=Math.max(m.days[d].need[code],monthPeople(state,month).filter(person=>cell(m,person.id,d).code===code).length);
 return{ok:true,month:m,changed};
}
if(typeof module!=='undefined')module.exports={CODES,META,DEFAULT_PAY_RATES,DEFAULT_PAIR_EXCLUSIONS,MAIN_STAFF_IDS,CARD_CODES,SHIFT_GROUPS,PAY_GROUPS,clone,key,isExcludedPair,sameShift,pairConflict,daysIn,weekday,monthOffset,freshMonth,calendarDemand,normalizeCalendarDemand,cell,manualPeople,monthPeople,group,canUseSymbol,eligibleOnDay,restConflict,restDescription,dutyCode,consecutiveConflict,maxAssignable,categoryTotals,categoryTargets,quotaTargets,defaultDawnRate,payRate,normalizePayRates,totalPay,distributionPlan,dawnTargets,boundary,totals,audit,solve,manualRange};
