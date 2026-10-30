// Exercise the actual page scripts and auth adapter; only Firebase HTTP is replaced.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const harness=fs.readFileSync(path.join(__dirname,'startup.test.cjs'),'utf8');
const boot=new Function('require','__dirname',harness.slice(0,harness.indexOf('for(const standalone'))+';return boot;')(require,__dirname);
let remote=null,revision=0;
const reply=(status,data)=>({ok:status>=200&&status<300,status,json:async()=>data,headers:{get:()=>String(revision)}});
function setup(standalone){
 const b=boot(null,standalone);b.ctx.AbortController=AbortController;let expectedUser='';
 b.ctx.fetch=async(url,o)=>{
  if(url.includes('identitytoolkit')){const body=JSON.parse(o.body);expectedUser=body.email.startsWith('teen@')?'teen-user':'other-user';return reply(200,{localId:expectedUser,idToken:'test-token',refreshToken:'test-refresh',email:body.email})}
  if(url.includes('/codeLibraries/'))return reply(200,null);
  assert(url.includes('/personnel/'+expectedUser+'.json'),'personnel requests must use the authenticated UID');
  if(expectedUser==='other-user')return reply(200,o.method==='PUT'?JSON.parse(o.body):null);
  if(o.method==='PUT'){assert.equal(o.headers['if-match'],String(revision));remote=JSON.parse(o.body);revision++;return reply(200,remote)}
  return reply(200,remote);
 };
 b.run('Personnel.init()');
 b.element('personnelName').focus=()=>{};b.element('personnelName').select=()=>{};
 b.fields=()=>b.run(`var p=state.people.find(p=>p.id==='1');$('personnelPrefix').value=p.prefix;$('personnelName').value=p.plainName;$('personnelRole').value=p.role;$('personnelRate-card').value='520';$('personnelRate-dawn').value='60';$('personnelIncluded').checked=true`);
 return b;
}
async function login(b,name='teen'){
 b.element('cloudForm').reportValidity=()=>true;b.element('cloudUsername').value=name;b.element('cloudPassword').value='test-password';
 await b.run('CodeLibrary.login()');for(let n=0;n<20;n++)await Promise.resolve();await b.run('Personnel.flush()');
}
async function main(){
 for(const standalone of [false,true]){
  remote=null;revision=0;const b=setup(standalone);
  assert.equal(b.run('monthPeople(state,state.selected).length'),8);
  assert.equal(b.run('state.people[0].prefix'),'นางสาว');
  b.run('var baselineSolved=solve(state,state.selected,{distribution:true});if(!baselineSolved.ok)throw Error(baselineSolved.message)');
  assert.equal(b.run('audit({...state,months:{[state.selected]:baselineSolved.month}},state.selected).complete'),true,'the actual eight-person roster still schedules correctly');
  b.run('activeMonth().cells={"1|1":{code:"N"},"1|3":{code:"A"},"1|8":{code:"M"},"1|10":{code:"R"},"1|12":{code:"X"},"1|15":{code:"",block:"OFF"}};Personnel.open()');b.fields();
  const beforeEstimate=b.run('JSON.stringify(state)');b.run('Personnel.useSchedule()');
  assert.equal(b.element('personnelCount-card').value,'3');assert.equal(b.element('personnelCount-dawn').value,'2');assert.equal(b.element('personnelPreview').textContent,'1,680');
  b.element('personnelCount-card').value='12';b.element('personnelCount-dawn').value='5';b.run('Personnel.preview()');assert.equal(b.element('personnelPreview').textContent,'6,540');
  b.element('personnelRate-card').value='650';b.run('Personnel.preview()');assert.equal(b.element('personnelPreview').textContent,'8,100','rate changes recalculate the chosen counts');
  b.element('personnelCount-card').value='-1';b.run('Personnel.preview()');assert.equal(b.element('personnelPreview').textContent,'—');
  assert.equal(b.run('JSON.stringify(state)'),beforeEstimate,'calculator never changes shifts, saved rates or account data');b.run('closeModal()');
  await assert.rejects(()=>b.run('CodeLibrary.personnel()'),/เข้าสู่ระบบ/);
  await login(b);assert.equal(b.run('state.people.length'),9);assert.equal(JSON.parse(remote.profileJson).people[8].id,'9');
  b.run('Personnel.open()');b.fields();b.element('personnelName').value='Private core';b.run('Personnel.add()');
  b.element('personnelPrefix').value='นาย';b.element('personnelName').value='Account only';b.element('personnelRole').value='Staff';b.element('personnelRate-card').value='700.25';b.element('personnelRate-dawn').value='90';b.element('personnelIncluded').checked=true;
  b.run('Personnel.save()');await b.run('Personnel.flush()');
  assert.equal(JSON.parse(remote.profileJson).people.length,10);
  const extra=JSON.parse(remote.profileJson).people.find(p=>p.plainName==='Account only');assert(extra);
  assert.equal(JSON.parse(remote.profileJson).payRates[extra.id].card,700.25);
  const second=setup(standalone);await login(second);assert(second.run('state.people.some(p=>p.plainName==="Account only")'));
  await b.run('CodeLibrary.logout()');assert.equal(b.run('monthPeople(state,state.selected).length'),8);assert(!b.run('JSON.stringify(state)').includes('Account only'),'logout removes account staff from the active schedule');
  assert(!b.run('JSON.stringify(state)').includes('Private core'),'core edits are also isolated by account');
  assert.equal(b.run('history.length'),0,'undo cannot reveal another account');
  await login(b,'other');assert.equal(b.run('state.people.length'),8,'a different account never inherits teen staff');
 }
 console.log('PASS actual page scripts: local eight, authenticated teen nine, add/save/two devices, logout privacy and account separation (source + standalone)');
}
main().catch(e=>{console.error(e);process.exitCode=1});
