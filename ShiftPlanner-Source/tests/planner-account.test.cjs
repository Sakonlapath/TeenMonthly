const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),vm=require('node:vm'),c=require('../js/core'),peopleModel=require('../js/personnel-model');
const harness=fs.readFileSync(path.join(__dirname,'startup.test.cjs'),'utf8'),boot=new Function('require','__dirname',harness.slice(0,harness.indexOf('for(const standalone'))+';return boot;')(require,__dirname);
const seed=vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../js/data.js'),'utf8')+';JSON.parse(JSON.stringify(SEED))');
const reply=(status,data,etag='0')=>({ok:status<300,status,json:async()=>data,headers:{get:()=>etag}});
async function main(){
 for(const standalone of [false,true]){
  const calendars=new Map(),profiles=new Map();
  function client(){
   const b=boot(null,standalone);b.ctx.AbortController=AbortController;b.ctx.confirm=()=>true;
   b.ctx.fetch=async(url,o)=>{
    const u=new URL(url);if(u.hostname.includes('identitytoolkit')){const body=JSON.parse(o.body),username=body.email.split('@')[0];return reply(200,{localId:username+'-uid',idToken:'test-token',refreshToken:'test-refresh',email:body.email})}
    const parts=u.pathname.slice(1).replace(/\.json$/,'').split('/'),[resource,uid,month]=parts;
    if(resource==='codeLibraries')return reply(200,null);
    if(resource==='personnel'){
     if(!profiles.has(uid))profiles.set(uid,{version:1,revision:1,profileJson:JSON.stringify(peopleModel.defaults(seed,uid.startsWith('teen-')?'teen':''))});
     if(o.method==='PUT')profiles.set(uid,JSON.parse(o.body));return reply(200,profiles.get(uid),String(profiles.get(uid).revision));
    }
    assert.equal(resource,'planners');if(!calendars.has(uid))calendars.set(uid,{});const months=calendars.get(uid);
    if(o.method==='PUT'){assert(month);if(o.headers['if-match']!==String(months[month]?.revision||0))return reply(412,{error:'stale'});months[month]=JSON.parse(o.body);return reply(200,months[month],String(months[month].revision))}
    return reply(200,month?months[month]||null:months,month?String(months[month]?.revision||0):'root');
   };
   b.run('Personnel.init();Planner.init()');return b;
  }
  async function login(b,name='teen'){
   b.element('cloudForm').reportValidity=()=>true;b.element('cloudUsername').value=name;b.element('cloudPassword').value='test-password';await b.run('CodeLibrary.login()');
   for(let i=0;i<35;i++)await Promise.resolve();await b.run('Personnel.flush()');await b.run('Planner.flush()');
  }
  const a=client();await login(a);assert(calendars.get('teen-uid')[a.run('state.selected')]);a.run('selectMonth("2026-11")');await a.run('Planner.flush()');const month=a.run('state.selected');
  a.run('var solved=solve(state,state.selected,{calendar:true,distribution:true});if(!solved.ok)throw Error(solved.message);checkpoint();state.months[state.selected]=solved.month;changed()');await a.run('Planner.flush()');
  const count=a.run('totals(state,state.selected).reduce((s,t)=>s+t.total,0)'),pay=a.run('totals(state,state.selected).reduce((s,t)=>s+Math.round(totalPay(state,t)*100),0)/100');assert(count>90);
  const b=client();await login(b);assert.equal(b.run('state.selected'),month,'a new device opens a populated online month');assert.equal(b.run('totals(state,state.selected).reduce((s,t)=>s+t.total,0)'),count,'second device automatically loads the same month');
  a.run('Planner.closeMonth()');
  const profile=JSON.parse(profiles.get('teen-uid').profileJson);profile.payRates['1'].card=530;profiles.get('teen-uid').profileJson=JSON.stringify(profile);profiles.get('teen-uid').revision++;
  await a.run('Planner.confirmClose(state.selected)');assert(!a.run('activeMonth().settlement'),'a changed online rate requires reviewing the updated close preview');assert.equal(a.run('payRate(state,"1")'),530);
  const updatedPay=a.run('totals(state,state.selected).reduce((s,t)=>s+Math.round(totalPay(state,t)*100),0)/100');
  await a.run('Planner.confirmClose(state.selected)');assert.equal(a.run('activeMonth().settlement.status'),'review');
  await a.run('Planner.setStatus("confirmed");');assert.equal(a.run('activeMonth().settlement.status'),'confirmed');await a.run('Planner.setStatus("paid")');assert.equal(a.run('activeMonth().settlement.status'),'paid');
  a.run('activeMonth().cells={};changed()');assert.equal(a.run('totals(state,state.selected).reduce((s,t)=>s+t.total,0)'),count,'generic writes cannot erase a settled month');
  await b.run('Planner.reload()');assert.equal(b.run('activeMonth().settlement.status'),'paid');
  a.run('Personnel.open()');const p=JSON.parse(a.run('JSON.stringify(state.people[0])'));
  for(const[id,value]of Object.entries({personnelPrefix:p.prefix,personnelName:'Renamed later',personnelRole:p.role,'personnelRate-card':'999','personnelRate-dawn':'999'}))a.element(id).value=value;
  a.element('personnelIncluded').checked=true;a.run('Personnel.save()');await a.run('Personnel.flush()');assert.equal(a.run('payRate(state,"1","card",null)'),999);assert.equal(a.run('payRate(state,"1","card")'),530);
  assert.equal(a.run('totals(state,state.selected).reduce((s,t)=>s+Math.round(totalPay(state,t)*100),0)/100'),updatedPay,'closed pay survives a directory rate change');assert(!a.element('summaryTable').innerHTML.includes('Renamed later'),'closed report names remain frozen');
  await a.run('Planner.reopen()');assert(!a.run('activeMonth().settlement'));assert.equal(a.run('payRate(state,"1")'),530);
  const revisions=JSON.parse(calendars.get('teen-uid')[month].historyJson);assert(revisions.length>=4);
  const blank=revisions.find(v=>!Object.keys(v.data.month.cells).length);assert(blank);await a.run('Planner.restore('+JSON.stringify(month)+','+JSON.stringify(blank.id)+')');assert.equal(a.run('Object.keys(activeMonth().cells).length'),0);assert(JSON.parse(calendars.get('teen-uid')[month].historyJson).some(v=>Object.keys(v.data.month.cells).length));
  await b.run('CodeLibrary.logout()');assert(!b.run('CodeLibrary.account()'));assert(!b.element('plannerScheduleStatus').innerHTML.includes('ซิงก์ตารางกับบัญชี teen แล้ว'));
  await login(b,'other');assert.equal(b.run('Object.keys(activeMonth().cells).length'),0);assert(!b.run('activeMonth().settlement'));assert.equal(Object.keys(calendars.get('other-uid')).length,1);
 }
 console.log('PASS planner account: source/standalone two-device load, close/confirm/paid, frozen roster/rates, write protection, history restore and account isolation');
}
main().catch(e=>{console.error(e);process.exitCode=1});
