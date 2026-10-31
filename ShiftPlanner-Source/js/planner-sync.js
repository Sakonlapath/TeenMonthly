const PlannerSyncModel=typeof module!=='undefined'?require('./planner-model'):PlannerModel;
/* Each month has its own CAS revision and a bounded, atomic revision history. */
class PlannerSync{
 constructor(options){
  this.o=options;this.docs={};this.ready=false;this.disposed=false;this.tasks=new Map();this.migrated=0;
  const cache=options.cache();if(cache){if(cache.version!==1||!cache.docs||typeof cache.docs!=='object')throw Error('แคชตารางไม่ถูกต้อง');for(const[key,v]of Object.entries(cache.docs)){const data=PlannerSyncModel.validate(v.data);if(key!==data.key||!Number.isSafeInteger(v.revision)||v.revision<0||typeof v.dirty!=='boolean'||v.base!==null&&typeof v.base!=='string')throw Error('แคชตารางไม่ถูกต้อง');this.docs[key]={...v,data,history:this.history(v.history,key),generation:0,blocked:false,error:''}}}
 }
 history(entries,key){
  if(!Array.isArray(entries)||entries.length>20)throw Error('ประวัติตารางไม่ถูกต้อง');const ids=new Set();
  return entries.map(v=>{if(!v||typeof v.id!=='string'||v.id.length>100||!v.id||ids.has(v.id)||!Number.isFinite(v.at)||v.at<=0||typeof v.label!=='string'||v.label.length>160)throw Error('ประวัติตารางไม่ถูกต้อง');ids.add(v.id);const data=PlannerSyncModel.validate(v.data);if(data.key!==key)throw Error('เดือนในประวัติไม่ตรงกัน');return {...v,data}});
 }
 mergeHistory(...lists){const map=new Map();for(const list of lists)for(const v of list)map.set(v.id,v);const result=[...map.values()].sort((a,b)=>a.at-b.at||a.id.localeCompare(b.id)).slice(-20);while(result.length>1&&JSON.stringify(result).length>2500000)result.shift();return result}
 backup(data,label){return {id:'v-'+(globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+'-'+Math.random().toString(36).slice(2)),at:Date.now(),label:String(label||'แก้ไขตาราง').slice(0,160),data:JSON.parse(JSON.stringify(data))}}
 decode(raw,key){
  if(raw===null||raw===undefined)return null;
  if(!raw||raw.version!==1||!Number.isSafeInteger(raw.revision)||raw.revision<1||typeof raw.dataJson!=='string'||typeof raw.historyJson!=='string')throw Error('รูปแบบตารางออนไลน์ไม่ถูกต้อง');
  const data=PlannerSyncModel.validate(JSON.parse(raw.dataJson));if(data.key!==key)throw Error('เดือนของตารางออนไลน์ไม่ตรงกัน');return {data,history:this.history(JSON.parse(raw.historyJson),key),revision:raw.revision,base:PlannerSyncModel.monthDigest(data),dirty:false,generation:0,blocked:false,error:''};
 }
 snapshot(){return {version:1,docs:Object.fromEntries(Object.entries(this.docs).map(([key,v])=>[key,{data:v.data,history:v.dirty?v.history:v.history.slice(-3),revision:v.revision,base:v.base,dirty:v.dirty}]))}}
 persist(type,month){if(this.disposed)return;this.o.persist(this.snapshot());this.o.onChange({type,month})}
 conflict(doc){doc.blocked=true;doc.error='ตารางเดือนนี้ถูกเปลี่ยนจากอีกเครื่อง กรุณาเลือกฉบับที่ต้องการก่อนส่งต่อ';return Object.assign(Error(doc.error),{conflict:true})}
 meaningful(data){const m=data.month;return !!(Object.keys(m.cells).length||m.settlement||m.rateSnapshot||m.excludedStaffIds?.length||Object.keys(m.quotas||{}).length||Object.keys(m.categoryQuotas||{}).length||Object.entries(m.days).some(([day,d])=>{const weekday=new Date(data.key+'-'+String(day).padStart(2,'0')+'T12:00:00Z').getUTCDay(),workday=weekday>0&&weekday<6,expected={N:1,M:workday?0:2,A:1,R:workday?1:0,X:0};return d.holiday||d.note||Object.keys(expected).some(code=>d.need[code]!==expected[code])})||m.exportMeta?.orderNumber||m.exportMeta?.issuedDate)}
 async load(local={}){
  const started=Object.fromEntries(Object.entries(this.docs).map(([key,doc])=>[key,doc.revision]));
  const raw=await this.o.readAll();if(this.disposed)return;
  if(raw!==null&&(typeof raw!=='object'||Array.isArray(raw)))throw Error('รายการเดือนออนไลน์ไม่ถูกต้อง');
  const next={},keys=new Set([...Object.keys(raw||{}),...Object.keys(this.docs),...Object.keys(local)]);
  for(const key of keys){if(!PlannerSyncModel.validKey(key))throw Error('รายการเดือนออนไลน์ไม่ถูกต้อง');const remote=this.decode(raw?.[key],key),cached=this.docs[key],legacy=local[key]&&PlannerSyncModel.validate(local[key]);
   if(cached&&(remote&&remote.revision<cached.revision||!remote&&cached.revision>(started[key]||0))){next[key]=cached;continue}
   if(cached?.dirty){const doc={...cached,history:this.mergeHistory(remote?.history||[],cached.history)};if((remote?.base??null)!==cached.base&&remote?.base!==PlannerSyncModel.monthDigest(cached.data))this.conflict(doc);else{doc.revision=remote?.revision||0;doc.base=remote?.base??null}next[key]=doc}
   else if(remote){next[key]=remote;if(!cached&&legacy&&this.meaningful(legacy)&&PlannerSyncModel.monthDigest(legacy)!==remote.base){next[key].history=this.mergeHistory(remote.history,[this.backup(legacy,'ตารางเดิมจากเครื่องนี้ก่อนซิงก์')]);next[key].dirty=true;this.migrated++}}
   else if(cached?.revision){next[key]={...cached};this.conflict(next[key])}
   else if(cached||legacy){const data=cached?.data||legacy;next[key]={data,history:cached?.history||[],revision:0,base:null,dirty:true,generation:0,blocked:false,error:''}}
  }
  const previous=this.docs;this.docs=next;this.ready=true;try{this.persist('loaded')}catch(e){this.docs=previous;this.ready=false;throw e}
 }
 edit(raw,label='แก้ไขตาราง'){
  if(this.disposed||!this.ready)throw Error('กรุณาโหลดตารางออนไลน์ให้สำเร็จก่อนแก้ไข');const data=PlannerSyncModel.validate(raw),key=data.key,old=this.docs[key];
  if(old?.blocked)throw this.conflict(old);if(old&&PlannerSyncModel.monthDigest(old.data)===PlannerSyncModel.monthDigest(data))return false;
  const doc=old?{...old,history:this.mergeHistory(old.history,[this.backup(old.data,label)])}:{revision:0,base:null,history:[],generation:0};
  doc.data=data;doc.dirty=true;doc.blocked=false;doc.error='';doc.generation++;this.docs[key]=doc;this.persist('edited',key);return true;
 }
 async flush(key){
  if(this.disposed||!this.ready)return;let error;
  for(const month of key?[key]:Object.keys(this.docs).sort()){const doc=this.docs[month];if(!doc?.dirty)continue;try{await this.flushOne(month)}catch(e){error=error||e}}
  if(error)throw error;
 }
 async flushOne(key){
  if(this.tasks.has(key))return this.tasks.get(key);const task=this.send(key);this.tasks.set(key,task);try{await task}finally{this.tasks.delete(key)}
 }
 async send(key){
  let doc=this.docs[key];if(doc.blocked)throw this.conflict(doc);
  try{
   const {data:raw,etag}=await this.o.read(key);if(this.disposed)return;doc=this.docs[key];const remote=this.decode(raw,key);
   if((remote?.base??null)!==doc.base&&remote?.base!==PlannerSyncModel.monthDigest(doc.data))throw this.conflict(doc);
   if(!etag)throw Error('Firebase ไม่ส่งข้อมูลตรวจรุ่น กรุณาลองใหม่');
   const generation=doc.generation,sent=JSON.parse(JSON.stringify(doc.data)),history=this.mergeHistory(remote?.history||[],doc.history),revision=(remote?.revision||0)+1;
   await this.o.write(key,{version:1,revision,dataJson:JSON.stringify(sent),historyJson:JSON.stringify(history),updatedAt:{'.sv':'timestamp'}},etag);if(this.disposed)return;
   doc=this.docs[key];doc.revision=revision;doc.base=PlannerSyncModel.monthDigest(sent);doc.history=this.mergeHistory(history,doc.history);if(doc.generation===generation)doc.dirty=false;doc.error='';this.persist('saved',key);
  }catch(e){if(this.disposed)return;doc=this.docs[key];if(e.code==='40001')this.conflict(doc);doc.error=e.conflict||e.code==='40001'?doc.error:e.message;this.o.onChange({type:'error',month:key});throw e.code==='40001'?Object.assign(Error(doc.error),{conflict:true}):e}
 }
 restore(key,id){const doc=this.docs[key],entry=doc?.history.find(v=>v.id===id);if(!entry)throw Error('ไม่พบรุ่นสำรอง');return this.edit(PlannerSyncModel.restore(entry.data),'ก่อนกู้คืนรุ่นสำรอง')}
 async resolve(key,choice){
  const old=this.docs[key];if(!old)throw Error('ไม่พบตาราง');const {data}=await this.o.read(key);if(this.disposed)return;const remote=this.decode(data,key);if(!remote)throw Error('ไม่พบตารางออนไลน์ กรุณาสำรอง JSON ก่อนติดต่อผู้พัฒนา');
  const history=this.mergeHistory(remote.history,old.history,[this.backup(choice==='remote'?old.data:remote.data,choice==='remote'?'ฉบับในเครื่องก่อนโหลดออนไลน์':'ฉบับออนไลน์ก่อนใช้ข้อมูลในเครื่อง')]);
  this.docs[key]={...(choice==='remote'?remote:old),history,revision:remote.revision,base:remote.base,dirty:true,blocked:false,error:'',generation:(old.generation||0)+1};this.persist('loaded',key);
 }
 dispose(){this.disposed=true;this.docs={};this.ready=false}
}
if(typeof module!=='undefined')module.exports=PlannerSync;
