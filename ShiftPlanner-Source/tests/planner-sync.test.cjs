const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),c=require('../js/core'),Model=require('../js/planner-model'),Sync=require('../js/planner-sync');
const seed=vm.runInNewContext(fs.readFileSync(require.resolve('../js/data.js'),'utf8')+';JSON.parse(JSON.stringify(SEED))'),copy=c.clone;
async function main(){
 const remote=new Map();let offline=false;
 function client(cache=null){let stored=cache;return new Sync({cache:()=>stored,persist:v=>stored=copy(v),readAll:async()=>Object.fromEntries(remote),read:async key=>({data:copy(remote.get(key)||null),etag:String(remote.get(key)?.revision||0)}),write:async(key,data,etag)=>{if(offline)throw Object.assign(Error('offline'),{retryable:true});if(etag!==String(remote.get(key)?.revision||0))throw Object.assign(Error('CAS conflict'),{code:'40001'});remote.set(key,copy(data))},onChange(){}})}
 let d=Model.capture(seed,seed.selected);const a=client();await a.load({[d.key]:d});await a.flush();assert.equal(remote.get(d.key).revision,1);
 const custom=copy(d);custom.month.days[1].need.R+=1;assert(a.meaningful(custom),'a custom demand-only calendar must be retained during migration');
 const b=client();await b.load({});assert.equal(b.docs[d.key].data.month.cells['1|1'],undefined);
 d.month.cells['1|1']={code:'N',block:'',locked:true};a.edit(d,'ลงเวร');await a.flush();await b.load({});assert.equal(b.docs[d.key].data.month.cells['1|1'].code,'N');assert(a.docs[d.key].history.length);
 const snapshot=a.docs[d.key].history.at(-1);assert.equal(snapshot.data.month.cells['1|1'],undefined,'backup stores the state before editing');
 const next=c.clone(seed);next.selected='2026-11';next.months[next.selected]=c.freshMonth(next.selected);const november=Model.capture(next,next.selected);b.edit(november,'เดือนใหม่');d.month.cells['1|3']={code:'A',block:'',locked:true};a.edit(d,'แก้ตุลาคม');await a.flush();await b.flush();assert(remote.has('2026-11'),'different months save independently');
 await b.load({});const stale=client();await stale.load({});d.month.cells['1|5']={code:'M',block:'',locked:true};a.edit(d,'แก้ล่าสุด');await a.flush();const older=copy(stale.docs[d.key].data);older.month.cells['1|7']={code:'R',block:'',locked:true};stale.edit(older,'เครื่องเก่า');await assert.rejects(()=>stale.flush(),/เปลี่ยน/);assert.equal(JSON.parse(remote.get(d.key).dataJson).month.cells['1|7'],undefined,'stale device never overwrites newer data');
 offline=true;d.month.cells['1|8']={code:'N',block:'',locked:true};a.edit(d,'ออฟไลน์');await assert.rejects(()=>a.flush(),/offline/);assert(a.docs[d.key].dirty);offline=false;await a.flush();assert(!a.docs[d.key].dirty);
 const oldRoot=copy(Object.fromEntries(remote)),readAll=a.o.readAll;let releaseLoad;a.o.readAll=()=>new Promise(r=>releaseLoad=r);const slowLoad=a.load({});d.month.cells['1|9']={code:'R',block:'',locked:true};a.edit(d,'แก้ระหว่างโหลด');await a.flush();releaseLoad(oldRoot);await slowLoad;assert.equal(a.docs[d.key].data.month.cells['1|9']?.code,'R','a slow earlier read cannot roll back an acknowledged save');a.o.readAll=readAll;
 a.restore(d.key,snapshot.id);await a.flush();assert.equal(JSON.parse(remote.get(d.key).dataJson).month.cells['1|1'],undefined,'restore makes a new revision');
 let finish;const delayed=new Sync({cache:()=>null,persist(){throw Error('late persist')},readAll:()=>new Promise(r=>finish=r),onChange(){}});const pending=delayed.load({});delayed.dispose();finish(Object.fromEntries(remote));await pending;assert.equal(Object.keys(delayed.docs).length,0,'late results cannot reveal a logged-out account');
 console.log('PASS planner sync: two devices, monthly conflicts, automatic history, offline retry, restore and logout race');
}
main().catch(e=>{console.error(e);process.exitCode=1});
