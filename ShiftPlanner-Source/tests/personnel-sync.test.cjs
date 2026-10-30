const assert=require('node:assert/strict'),Sync=require('../js/personnel-sync');
const clone=v=>JSON.parse(JSON.stringify(v));
async function main(){
 let remote=null,etag=0,blocked=false;
 const valid=p=>{if(!p||typeof p.name!=='string')throw Error('invalid profile');return clone(p)};
 function client(cache=null){
  let stored=cache;return new Sync({defaults:{name:'eight'},validate:valid,cache:()=>stored,persist:v=>{stored=clone(v)},read:async()=>({data:clone(remote),etag:String(etag)}),write:async(body,match)=>{if(blocked)throw Object.assign(Error('offline'),{retryable:true});if(match!==String(etag))throw Error('conflict');remote=clone(body);etag++},onChange(){}});
 }
 const a=client();await a.load();await a.flush();assert.equal(remote.revision,1);
 const b=client();await b.load();assert.equal(b.profile.name,'eight','a second device loads the account directory');
 a.edit({name:'photo and rates'});await a.flush();await b.load();assert.equal(b.profile.name,'photo and rates');
 const stale=client();await stale.load();a.edit({name:'newer'});await a.flush();stale.edit({name:'stale'});
 await assert.rejects(()=>stale.flush(),/เปลี่ยน/);assert.equal(JSON.parse(remote.profileJson).name,'newer','stale device cannot overwrite newer staff');
 blocked=true;a.edit({name:'offline edit'});await assert.rejects(()=>a.flush(),/offline/);assert(a.dirty);blocked=false;await a.flush();assert.equal(JSON.parse(remote.profileJson).name,'offline edit');
 let resolve;const late=new Sync({defaults:{name:'default'},validate:valid,cache:()=>null,persist(){throw Error('disposed account must not persist')},read:()=>new Promise(r=>resolve=r),write(){throw Error('disposed account must not write')},onChange(){}});
 const pending=late.load();late.dispose();resolve({data:remote,etag:'1'});await pending;assert.equal(late.profile.name,'default','late response after logout stays hidden');
 console.log('PASS personnel sync: two devices, conditional revisions, offline recovery and logout race');
}
main().catch(e=>{console.error(e);process.exitCode=1});
