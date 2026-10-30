/* Account directory. Keep full display names for the scheduler and exported documents. */
const PersonnelModel=(()=>{
 const copy=v=>JSON.parse(JSON.stringify(v)),coreIds=['1','2','3','4','5','6','7','8'];
 function splitName(name){
  name=String(name||'').trim().replace(/\s+/g,' ');
  const match=name.match(/^(น\.\s*ส\.|นางสาว|นาย|นาง|ดร\.)\s*/);
  return {prefix:match?(match[1].startsWith('น.')?'นางสาว':match[1]):'',plainName:match?name.slice(match[0].length):name};
 }
 function person(raw){
  const parts=typeof raw.plainName==='string'?{prefix:raw.prefix,plainName:raw.plainName}:splitName(raw.name);
  const prefix=String(parts.prefix||'').trim().replace(/^น\.\s*ส\.$/,'นางสาว'),plainName=String(parts.plainName||'').trim().replace(/\s+/g,' ');
  if(typeof raw.id!=='string'||!/^([1-9]\d*|staff-[a-zA-Z0-9-]+)$/.test(raw.id)||raw.id.length>80||!plainName||plainName.length>100||prefix.length>30||typeof raw.role!=='string'||raw.role.length>100||typeof raw.active!=='boolean'||!Array.isArray(raw.allowed)||!raw.allowed.length||raw.allowed.some(c=>!['N','M','A','R','X'].includes(c)))throw Error('ข้อมูลบุคลากรไม่ถูกต้อง');
  const photo=raw.photo||'',removedFrom=raw.removedFrom||'';
  if(typeof photo!=='string'||photo.length>120000||(photo&&!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(photo)))throw Error('รูปบุคลากรไม่ถูกต้องหรือใหญ่เกินไป');
  if(removedFrom&&!/^\d{4}-(0[1-9]|1[0-2])$/.test(removedFrom)||coreIds.includes(raw.id)&&removedFrom)throw Error('ต้องเก็บบุคลากรหลักทั้ง 8 คน');
  return {id:raw.id,prefix,plainName,name:prefix+plainName,role:raw.role.trim(),active:raw.active,allowed:[...new Set(raw.id==='9'?['X']:raw.allowed)],prev:'',next:'',photo,removedFrom};
 }
 function validate(raw){
  if(!raw||raw.version!==1||!Array.isArray(raw.people)||raw.people.length<8||raw.people.length>40||!raw.payRates)throw Error('ข้อมูลต้องมีบุคลากรหลัก 8 คน และรวมไม่เกิน 40 คน');
  const people=raw.people.map(person),ids=new Set(people.map(p=>p.id));
  if(ids.size!==people.length||coreIds.some(id=>!ids.has(id)))throw Error('ต้องเก็บบุคลากรหลักทั้ง 8 คน และรหัสคนต้องไม่ซ้ำ');
  const payRates={};
  for(const p of people){
   const rate=raw.payRates[p.id];
   if(!rate||['card','dawn'].some(k=>typeof rate[k]!=='number'||!Number.isFinite(rate[k])||rate[k]<0||rate[k]>10000||Math.abs(rate[k]*100-Math.round(rate[k]*100))>1e-7))throw Error('เรทเงินต้องอยู่ระหว่าง 0–10,000 บาท ทศนิยมไม่เกิน 2 ตำแหน่ง');
   payRates[p.id]={card:rate.card,dawn:rate.dawn};
  }
  people.sort((a,b)=>(coreIds.indexOf(a.id)<0?99:coreIds.indexOf(a.id))-(coreIds.indexOf(b.id)<0?99:coreIds.indexOf(b.id)));
  const result={version:1,people,payRates};if(JSON.stringify(result).length>4500000)throw Error('รูปและข้อมูลบุคลากรรวมใหญ่เกินไป กรุณาลดขนาดรูป');return result;
 }
 function defaults(seed,username=''){
  const people=seed.people.filter(p=>coreIds.includes(p.id)||username==='teen'&&p.id==='9').map(person),payRates={};
  for(const p of people){const r=seed.payRates[p.id];payRates[p.id]={card:typeof r==='number'?r:r?.card||0,dawn:/^(จพ\.?เวช|เจ้าพนักงานเวช)/.test(p.role)?60:/^(นวก\.?|นักวิชาการ)/.test(p.role)?80:/^พนักงาน/.test(p.role)?50:0}}
  return validate({version:1,people,payRates});
 }
 function fromState(s,username=''){
  const base=defaults(s,username);return validate(base);
 }
 function apply(s,raw){
  const profile=validate(raw),ids=new Set(profile.people.map(p=>p.id));
  // Keep metadata needed by old cells/targets, but never schedule removed legacy entries again.
  const retained=s.people.filter(p=>!ids.has(p.id)&&(s.quotas?.[p.id]!==undefined||s.mainStaffIds?.includes(p.id)||s.pairExclusions?.some(pair=>pair.includes(p.id))||Object.values(s.months).some(m=>Object.keys(m.cells).some(k=>k.startsWith(p.id+'|'))||m.excludedStaffIds?.includes(p.id)||m.quotas?.[p.id]!==undefined||m.categoryQuotas?.[p.id])));
  s.people=[...copy(profile.people),...retained.map(p=>({...copy(p),removedFrom:p.removedFrom||'1900-01'}))];
  s.payRates={...Object.fromEntries(retained.map(p=>[p.id,s.payRates[p.id]])),...copy(profile.payRates)};
  return s;
 }
 return {coreIds,splitName,person,validate,defaults,fromState,apply};
})();
if(typeof module!=='undefined')module.exports=PersonnelModel;
