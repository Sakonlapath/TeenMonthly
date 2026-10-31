/* Monthly documents contain no photos or credentials. Settlement snapshots pin history. */
const PlannerModel=(()=>{
 const c=typeof module!=='undefined'?require('./core'):{CODES,clone,daysIn,monthPeople,payRate,totals,totalPay,categoryTargets,quotaTargets};
 const copy=c.clone,validKey=k=>typeof k==='string'&&/^(19\d{2}|20\d{2}|21\d{2}|2200)-(0[1-9]|1[0-2])$/.test(k);
 const canonical=v=>v&&typeof v==='object'?(Array.isArray(v)?v.map(canonical):Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])]))):v;
 const digest=v=>JSON.stringify(canonical(v));
 function person(p){return {...copy(p),photo:''}}
 function rateMap(raw,ids){
  if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('เรทเงินประจำเดือนไม่ถูกต้อง');
  for(const [id,r]of Object.entries(raw))if(!ids.has(id)||!r||['card','dawn'].some(k=>typeof r[k]!=='number'||!Number.isFinite(r[k])||r[k]<0||r[k]>10000||Math.abs(r[k]*100-Math.round(r[k]*100))>1e-7))throw Error('เรทเงินประจำเดือนไม่ถูกต้อง');
 }
 function validate(raw){
  const data=copy(raw);if(!data||data.version!==1||!validKey(data.key))throw Error('เดือนของตารางไม่ถูกต้อง');
  if(!Array.isArray(data.people)||data.people.length<4||data.people.length>40)throw Error('รายชื่อประจำเดือนไม่ถูกต้อง');
  const ids=new Set();
  for(const p of data.people){if(!p||typeof p.id!=='string'||!p.id||p.id.length>100||ids.has(p.id)||typeof p.name!=='string'||!p.name.trim()||p.name.length>160||typeof p.role!=='string'||p.role.length>160||typeof p.active!=='boolean'||!Array.isArray(p.allowed)||p.allowed.some(v=>!c.CODES.includes(v))||!['',...c.CODES,'OFF','VAC'].includes(p.prev)||!['',...c.CODES,'OFF','VAC'].includes(p.next))throw Error('รายชื่อประจำเดือนไม่ถูกต้อง');ids.add(p.id);p.photo=''}
  rateMap(data.rates,ids);if(data.people.some(p=>!data.rates[p.id]))throw Error('เรทเงินประจำเดือนไม่ครบ');
  const m=data.month,n=c.daysIn(data.key);if(!m||typeof m!=='object'||!m.days||!m.cells||Array.isArray(m.cells))throw Error('ตารางประจำเดือนไม่ถูกต้อง');
  for(let d=1;d<=n;d++){const day=m.days[d];if(!day||typeof day.holiday!=='boolean'||typeof day.note!=='string'||!day.need||c.CODES.some(code=>!Number.isInteger(day.need[code])||day.need[code]<0||day.need[code]>data.people.length))throw Error('วันในตารางไม่ถูกต้อง')}
  for(const [key,v]of Object.entries(m.cells)){const [id,d,...rest]=key.split('|');if(rest.length||!ids.has(id)||!Number.isInteger(+d)||+d<1||+d>n||!v||!['',...c.CODES].includes(v.code)||!['','OFF','VAC'].includes(v.block)||typeof v.locked!=='boolean')throw Error('ข้อมูลช่องเวรไม่ถูกต้อง')}
  for(const field of ['excludedStaffIds','autoFillStaffIds'])if(m[field]!==undefined&&(!Array.isArray(m[field])||new Set(m[field]).size!==m[field].length||m[field].some(id=>!ids.has(id))))throw Error('รายชื่อประจำเดือนไม่ถูกต้อง');
  function roster(list){if(!Array.isArray(list)||list.length>40||new Set(list.map(p=>p.id)).size!==list.length||list.some(p=>!ids.has(p.id)||typeof p.name!=='string'||!p.name||typeof p.role!=='string'||typeof p.active!=='boolean'||!Array.isArray(p.allowed)||p.allowed.some(v=>!c.CODES.includes(v))))throw Error('รายชื่อที่ปิดยอดไม่ถูกต้อง');for(const p of list)p.photo=''}
  if(m.rosterSnapshot)roster(m.rosterSnapshot);if(m.rateSnapshot)rateMap(m.rateSnapshot,ids);
  if(m.settlement){const v=m.settlement;if(v.version!==1||!['review','confirmed','paid'].includes(v.status)||!Number.isFinite(v.closedAt)||v.closedAt<=0||!Number.isSafeInteger(v.totalCents)||v.totalCents<0||!Number.isFinite(v.hours)||v.hours<0||!Number.isInteger(v.count)||v.count<0)throw Error('ข้อมูลปิดยอดไม่ถูกต้อง');roster(v.people);rateMap(v.rates,ids);if(v.people.some(p=>!v.rates[p.id]))throw Error('เรทปิดยอดไม่ครบ');for(const field of ['confirmedAt','paidAt'])if(v[field]!==null&&(!Number.isFinite(v[field])||v[field]<v.closedAt))throw Error('วันที่ปิดยอดไม่ถูกต้อง');if(v.status!=='review'&&!v.confirmedAt||v.status==='paid'&&!v.paidAt)throw Error('สถานะปิดยอดไม่ถูกต้อง')}
  const test={version:1,selected:data.key,people:data.people,payRates:data.rates,quotas:{},months:{[data.key]:m}};c.categoryTargets(test,data.key);c.quotaTargets(test,data.key);
  if(JSON.stringify(data).length>1400000)throw Error('ตารางเดือนนี้ใหญ่เกินขนาดที่รองรับ');return data;
 }
 function capture(s,key){
  const month=copy(s.months[key]),people=s.people.map(person),rates={};
  if(!month.quotas)month.quotas=copy(s.quotas||{});
  if(!month.rosterSnapshot)month.rosterSnapshot=s.people.filter(p=>!p.removedFrom||key<p.removedFrom).map(person);
  for(const p of people)rates[p.id]={card:c.payRate(s,p.id,'card',key),dawn:c.payRate(s,p.id,'dawn',key)};
  return validate({version:1,key,month,people,rates});
 }
 function apply(s,raw){
  const data=validate(raw);for(const p of data.people)if(!s.people.some(v=>v.id===p.id)){if(s.people.length>=40)throw Error('รายชื่อที่เก็บประวัติเกิน 40 คน กรุณาสำรองข้อมูลก่อน');s.people.push(person(p));s.payRates[p.id]=copy(data.rates[p.id])}
  s.months[data.key]=copy(data.month);return s;
 }
 function close(raw,now=Date.now()){
  const data=validate(raw);if(data.month.settlement)throw Error('เดือนนี้ปิดยอดแล้ว');
  const s={selected:data.key,people:data.people,payRates:data.rates,months:{[data.key]:data.month}},people=c.monthPeople(s,data.key).map(person),tt=c.totals(s,data.key),rates=Object.fromEntries(people.map(p=>[p.id,copy(data.rates[p.id])]));
  data.month.settlement={version:1,status:'review',closedAt:now,confirmedAt:null,paidAt:null,people,rates,totalCents:tt.reduce((sum,t)=>sum+Math.round(c.totalPay(s,t,data.key)*100),0),hours:tt.reduce((sum,t)=>sum+t.hours,0),count:tt.reduce((sum,t)=>sum+t.total,0)};
  return validate(data);
 }
 function status(raw,next,now=Date.now()){
  const data=validate(raw),v=data.month.settlement;if(!v)throw Error('กรุณาปิดยอดก่อน');
  if(next==='confirmed'&&v.status==='review'){v.status=next;v.confirmedAt=now}
  else if(next==='paid'&&v.status==='confirmed'){v.status=next;v.paidAt=now}
  else throw Error('กรุณายืนยันยอดก่อนระบุว่าได้รับเงินแล้ว');return validate(data);
 }
 function reopen(raw){const data=validate(raw),v=data.month.settlement;if(!v)throw Error('เดือนนี้ยังไม่ปิดยอด');data.month.rateSnapshot=copy(v.rates);data.month.rosterSnapshot=copy(v.people);delete data.month.settlement;return validate(data)}
 function restore(raw){const data=validate(raw);if(!data.month.settlement)data.month.rateSnapshot=copy(data.rates);return data}
 const monthDigest=data=>digest(data.month);
 return {validate,capture,apply,close,status,reopen,restore,digest,monthDigest,validKey};
})();
if(typeof module!=='undefined')module.exports=PlannerModel;
