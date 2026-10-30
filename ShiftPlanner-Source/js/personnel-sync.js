/* Revision-checked account directory; never resolve an account race by overwriting. */
class PersonnelSync{
 constructor(options){
  this.o=options;this.profile=options.validate(options.defaults);this.revision=0;this.dirty=false;this.ready=false;this.disposed=false;this.error='';this.blocked=false;this.task=null;this.generation=0;
  const cache=options.cache();
  if(cache){
   if(cache.version!==1||!Number.isSafeInteger(cache.revision)||cache.revision<0||typeof cache.dirty!=='boolean')throw Error('ข้อมูลบุคลากรในเครื่องไม่ถูกต้อง');
   this.profile=options.validate(cache.profile);this.revision=cache.revision;this.dirty=cache.dirty;
  }
 }
 snapshot(){return {version:1,profile:this.profile,revision:this.revision,dirty:this.dirty}}
 persist(){if(this.disposed)return;this.o.persist(this.snapshot());this.o.onChange(this)}
 decode(data){
  if(data===null)return {profile:null,revision:0};
  if(!data||data.version!==1||!Number.isSafeInteger(data.revision)||data.revision<1||typeof data.profileJson!=='string')throw Error('ข้อมูลบุคลากรออนไลน์ไม่ถูกต้อง');
  return {profile:this.o.validate(JSON.parse(data.profileJson)),revision:data.revision};
 }
 conflict(){this.blocked=true;return Error('บุคลากรถูกเปลี่ยนจากอีกเครื่อง กรุณาโหลดข้อมูลล่าสุดก่อนแก้ไขต่อ')}
 async load(discard=false){
  if(this.disposed)return;
  const {data}=await this.o.read();if(this.disposed)return;
  const remote=this.decode(data);
  if(discard){this.dirty=false;this.blocked=false;this.profile=this.o.validate(this.o.defaults)}
  if(this.dirty&&this.revision!==remote.revision)throw this.conflict();
  if(!this.dirty){this.profile=remote.profile||this.profile;this.revision=remote.revision;this.dirty=!remote.profile}
  this.ready=true;this.error='';this.persist();
 }
 edit(profile){
  if(this.disposed||!this.ready||this.blocked)throw Error('กรุณาโหลดบุคลากรออนไลน์ให้สำเร็จก่อนแก้ไข');
  this.profile=this.o.validate(profile);this.dirty=true;this.generation++;this.error='';this.persist();
 }
 async flush(){
  if(this.disposed||!this.dirty||!this.ready)return;
  if(this.blocked)throw this.conflict();
  if(this.task)return this.task;
  this.task=this.send();try{await this.task}finally{this.task=null}
 }
 async send(){
  try{
   const {data,etag}=await this.o.read();if(this.disposed)return;
   const remote=this.decode(data);if(remote.revision!==this.revision)throw this.conflict();
   if(!etag)throw Error('Firebase ไม่ส่งข้อมูลตรวจรุ่น กรุณาลองใหม่');
   const generation=this.generation,profileJson=JSON.stringify(this.profile),revision=this.revision+1;
   await this.o.write({version:1,revision,profileJson},etag);if(this.disposed)return;
   this.revision=revision;if(generation===this.generation)this.dirty=false;this.error='';this.persist();
  }catch(e){if(this.disposed)return;if(e.code==='40001')this.blocked=true;this.error=e.message;this.o.onChange(this);throw e}
 }
 dispose(){this.disposed=true;this.profile=this.o.validate(this.o.defaults)}
}
if(typeof module!=='undefined')module.exports=PersonnelSync;
