const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..');
const LOCAL='shiftplanner-codes-local-v1';
const row=(code='A01',extra={})=>({code,disease:'ชื่อโรคทดสอบ',conditions:'',procedures:'',note:'',...extra});
const serialized=(records,extra={})=>JSON.stringify({version:1,records,revision:0,dirty:true,...extra});
function boot({storage=new Map(),fetch=async()=>{throw Error('offline')}}={}){
 const elements=new Map(),events={},downloads=[],messages=[];
 const $=id=>{if(!elements.has(id))elements.set(id,{innerHTML:'',textContent:'',value:'',open:false,classList:{toggle(){}},focus(){},reportValidity(){return true}});return elements.get(id)};
 const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const ctx=vm.createContext({console,TextEncoder,atob,AbortSignal,fetch,$,esc,currentView:'codes',
  window:{addEventListener(name,fn){events[name]=fn}},localStorage:{getItem:k=>storage.get(k)??null,setItem(k,v){storage.set(k,v)}},
  toast:x=>messages.push(x),download:(content,name,type)=>downloads.push({content,name,type}),
  modal(title,body,foot){$('modal').open=true;$('modalTitle').textContent=title;$('modalBody').innerHTML=body;$('modalFoot').innerHTML=foot},closeModal(){$('modal').open=false}
 });
 for(const file of ['exports','code-catalog','code-library'])vm.runInContext(fs.readFileSync(path.join(root,'js',file+'.js'),'utf8'),ctx);
 const run=code=>vm.runInContext(code,ctx);
 function form(r){$('codeLetter').value=r.code[0];$('codeNumber').value=r.code.slice(1);$('codeDisease').value=r.disease;for(const k of ['conditions','procedures','note'])$('code-'+k).value=r[k]||''}
 return {run,$,form,storage,ctx,downloads,messages,events};
}
function unzipStored(bytes){
 const data=Buffer.from(bytes),parts={};let p=0;
 while(data.readUInt32LE(p)===0x04034b50){const size=data.readUInt32LE(p+18),n=data.readUInt16LE(p+26),extra=data.readUInt16LE(p+28),start=p+30+n+extra;parts[data.subarray(p+30,p+30+n).toString()]=data.subarray(start,start+size).toString();p=start+size}
 return parts;
}
async function main(){
 const b=boot();const model=b.run('CodeCatalog');
 b.run('CodeLibrary.cloud()');
 assert(b.$('modalBody').innerHTML.includes('value="https://omtcyjoewqtfsreshgfu.supabase.co"'));
 assert(b.$('modalBody').innerHTML.includes('value="sb_publishable_3Ixd4qU4vGBYVRJUqTurSg_vFabVA5B"'));
 const savedConfig=boot({storage:new Map([['shiftplanner-codes-cloud-v1',JSON.stringify({url:'https://saved-project.supabase.co',key:'sb_publishable_saved'})]])});
 savedConfig.run('CodeLibrary.cloud()');assert(savedConfig.$('modalBody').innerHTML.includes('value="https://saved-project.supabase.co"'));
 assert.equal(model.records([row('a00.01')])[0].code,'A00.01');
 for(const code of ['A','AA01','001','A1.','A01<script>','Z-10'])assert.throws(()=>model.records([row(code)]));
 assert.throws(()=>model.records([row('A01'),row('a01')]));
 assert.throws(()=>model.records([row('A01',{disease:''})]));
 assert.throws(()=>model.records([row('A01',{note:'x'.repeat(8001)})]));
 assert.throws(()=>model.records([row('A01',{note:'\u0001'})]));
 assert.deepEqual(Array.from(model.records([row('B10'),row('A10'),row('A2')]),r=>r.code),['A2','A10','B10']);
 const catalog=model.records([row('A01',{conditions:'มีเงื่อนไข',procedures:'ทำหัตถการ'}),row('B02',{note:'Needle <script>alert(1)</script>'})]);
 assert.equal(model.filter(catalog,'','needle').length,1);
 assert.equal(model.filter(catalog,'A','เงื่อนไข หัตถการ','both').length,1);
 assert.equal(model.filter(catalog,'B','','conditions').length,0);
 assert.equal(model.filter(catalog,'','','note').length,1);
 const multiRows=[row('A11',{conditions:'เงื่อนไข'}),row('A12',{procedures:'หัตถการ'}),row('A13',{conditions:'เงื่อนไข',procedures:'หัตถการ'}),row('A14',{conditions:'เงื่อนไข',procedures:'หัตถการ',note:'ติดตาม'}),row('B11',{note:'ติดตาม'})];
 assert.equal(model.filter(multiRows,'','',[]).length,5);
 assert.deepEqual(Array.from(model.filter(multiRows,'','',['conditions','procedures']),r=>r.code),['A13','A14']);
 assert.deepEqual(Array.from(model.filter(multiRows,'','',['conditions','procedures','note']),r=>r.code),['A14']);
 assert.equal(model.filter(multiRows,'B','',['conditions','note']).length,0);
 assert.equal(model.filter(multiRows,'A','ติดตาม',['procedures','note'])[0].code,'A14');
 const multi=boot({storage:new Map([[LOCAL,serialized(multiRows)]])});
 multi.run('CodeLibrary.render();CodeLibrary.kind("conditions",true);CodeLibrary.kind("procedures",true);CodeLibrary.kind("conditions",true)');
 assert.equal(multi.$('codeCount').textContent,'พบ 2 จาก 5 รหัส');
 multi.run('CodeLibrary.category("A")');
 assert(multi.$('codesView').innerHTML.includes('value="conditions" checked'));
 assert(multi.$('codesView').innerHTML.includes('value="procedures" checked'));
 multi.run('CodeLibrary.kind("note",true);CodeLibrary.excel(true)');
 const filteredSheet=unzipStored(multi.downloads.at(-1).content)['xl/worksheets/sheet1.xml'];
 assert(filteredSheet.includes('A14'));assert(!filteredSheet.includes('A13'));
 multi.run('CodeLibrary.kind("conditions",false);CodeLibrary.kind("procedures",false);CodeLibrary.kind("note",false)');
 assert.equal(multi.$('codeCount').textContent,'พบ 4 จาก 5 รหัส · หมวด A');
 multi.run('CodeLibrary.kind("note",true);CodeLibrary.clearSearch()');
 assert.equal(multi.$('codeCount').textContent,'พบ 5 จาก 5 รหัส');
 assert(!multi.$('codesView').innerHTML.includes('name="codeKind" value="note" checked'));
 assert.throws(()=>model.upsert(catalog,row('A01')));
 assert.throws(()=>model.upsert(catalog,row('B02'),'A01'));
 assert.equal(model.upsert(catalog,row('C03'),'A01')[1].code,'C03');
 assert.equal(model.merge(catalog,catalog).length,2);
 assert.throws(()=>model.merge(catalog,[row('A01',{note:'conflict'})]));
 assert.equal(model.parseBackup(JSON.parse(JSON.stringify(model.backup(catalog)))).length,2);
 assert.throws(()=>model.parseBackup({people:[]}));
 const parts=unzipStored(model.xlsx([row('A001',{disease:'โรค <ทดสอบ>',note:'=HYPERLINK("https://example.com")\nบรรทัด 2'})]));
 assert.equal(Object.keys(parts).length,6);
 assert(parts['xl/worksheets/sheet1.xml'].includes('โรค &lt;ทดสอบ&gt;'));
 assert(parts['xl/worksheets/sheet1.xml'].includes('A001'));
 assert(parts['xl/worksheets/sheet1.xml'].includes('=HYPERLINK(&quot;'));
 assert(!parts['xl/worksheets/sheet1.xml'].includes('<f>'),'user text is never an Excel formula');
 assert(parts['xl/worksheets/sheet1.xml'].includes('autoFilter ref="A1:F2"'));
 assert.equal(model.config('https://test.supabase.co/','sb_publishable_test').url,'https://test.supabase.co');
 assert.throws(()=>model.config('https://evil.example','sb_publishable_test'));
 assert.throws(()=>model.config('https://test.supabase.co','sb_secret_bad'));
 const jwt=role=>'e30.'+Buffer.from(JSON.stringify({role})).toString('base64url')+'.signature';
 assert(model.config('https://test.supabase.co',jwt('anon')));
 assert.throws(()=>model.config('https://test.supabase.co',jwt('service_role')));

 b.run('CodeLibrary.render();CodeLibrary.edit()');b.form(row('A001',{note:'<img src=x onerror=alert(1)>',conditions:'เงื่อนไข',procedures:'หัตถการ'}));b.run('CodeLibrary.save("")');
 assert.equal(JSON.parse(b.storage.get(LOCAL)).records[0].code,'A001');
 assert(b.$('codeResults').innerHTML.includes('&lt;img'));
 assert(!b.$('codeResults').innerHTML.includes('<img'));
 b.run('CodeLibrary.edit()');b.form(row('A001'));b.run('CodeLibrary.save("")');
 assert(b.$('codeFormError').textContent.includes('แล้ว'));assert.equal(JSON.parse(b.storage.get(LOCAL)).records.length,1);
 b.form(row('Z09',{disease:'แก้ไขชื่อ',note:'Needle'}));b.run('CodeLibrary.save("A001")');
 assert.equal(JSON.parse(b.storage.get(LOCAL)).records[0].code,'Z09');
 b.run('CodeLibrary.search("needle");CodeLibrary.excel(true)');assert(b.downloads.at(-1).name.endsWith('.xlsx'));
 const reloaded=boot({storage:b.storage});reloaded.run('CodeLibrary.render()');assert(reloaded.$('codeResults').innerHTML.includes('แก้ไขชื่อ'));
 b.run('CodeLibrary.remove("Z09")');assert.equal(JSON.parse(b.storage.get(LOCAL)).records.length,1,'delete prompt is reversible');
 b.run('CodeLibrary.confirmRemove("Z09")');assert.equal(JSON.parse(b.storage.get(LOCAL)).records.length,0);
 const file={size:100,text:async()=>JSON.stringify(model.backup([row('B10')]))};b.ctx.file=file;
 await b.run('CodeLibrary.importFile({files:[file],value:""})');assert.equal(JSON.parse(b.storage.get(LOCAL)).records[0].code,'B10');
 b.ctx.file={size:100,text:async()=>JSON.stringify(model.backup([row('B10',{note:'different'})]))};
 await b.run('CodeLibrary.importFile({files:[file],value:""})');assert.equal(JSON.parse(b.storage.get(LOCAL)).records[0].note,'');
 b.storage.set(LOCAL,serialized([row('C10')]));b.form(row('B11'));b.run('CodeLibrary.save("B10")');
 assert(b.$('codeFormError').textContent.includes('อีกแท็บ'));assert.equal(JSON.parse(b.storage.get(LOCAL)).records[0].code,'C10');
 const corrupt=boot({storage:new Map([[LOCAL,'{broken']])});corrupt.run('CodeLibrary.render();CodeLibrary.edit()');assert(corrupt.$('codeSaveStatus').textContent==='');
 assert(corrupt.$('codesView').innerHTML.includes('เปิดคลังรหัสที่บันทึกไม่ได้'));
 corrupt.run('CodeLibrary.confirmRecover()');assert.equal(corrupt.downloads[0].content,'{broken');assert.equal(JSON.parse(corrupt.storage.get(LOCAL)).records.length,0);
 const quota=boot();quota.ctx.localStorage.setItem=()=>{throw Error('quota exceeded')};
 quota.form(row('Q01',{note:'must survive without storage'}));quota.run('CodeLibrary.save("");CodeLibrary.local();CodeLibrary.backup()');
 assert.equal(JSON.parse(quota.downloads.at(-1).content).records[0].note,'must survive without storage');
 assert(quota.messages.some(m=>m.includes('บันทึกคลังปัจจุบัน')),'switching cannot discard memory-only edits');
 let warned=false;quota.events.beforeunload({preventDefault(){warned=true}});assert(warned);

 // Mock REST endpoints enforce optimistic revisions exactly as the SQL contract.
 const cloud={revision:0,records:[]},calls=[];let fail=false,expire=false;
 async function fetch(url,options){
  const body=options.body?JSON.parse(options.body):null;calls.push({url,options,body});
  if(fail)throw Error('network unavailable');
  const response=(status,data)=>({ok:status>=200&&status<300,status,json:async()=>data});
  if(url.includes('/auth/v1/token'))return response(200,{access_token:'token',refresh_token:'refresh',user:{id:'user1',email:'test@example.com'}});
  if(expire){expire=false;return response(401,{})}
  assert.equal(options.headers.Authorization,'Bearer token');assert.equal(options.headers.apikey,'sb_publishable_test');
  if(url.includes('/rpc/save_code_library')){
   if(body.expected_revision!==cloud.revision)return response(409,{code:'40001'});
   cloud.records=body.entries;cloud.revision++;return response(200,cloud.revision);
  }
  if(url.includes('/rest/v1/code_libraries'))return response(200,cloud.revision?[{revision:cloud.revision,records:cloud.records}]:[]);
  return response(200,null);
 }
 const c=boot({storage:new Map([[LOCAL,serialized([row('A01')])]]),fetch});
 c.run('CodeLibrary.render();CodeLibrary.cloud()');
 c.$('cloudUrl').value='https://test.supabase.co';c.$('cloudKey').value='sb_publishable_test';c.$('cloudEmail').value='test@example.com';c.$('cloudPassword').value='fake-test-password';
 await c.run('CodeLibrary.login()');
 assert(c.$('modalBody').innerHTML.includes('test@example.com'));
 c.run('CodeLibrary.copyLocal()');await c.run('CodeLibrary.push()');
 assert.equal(cloud.revision,1);assert.equal(cloud.records[0].code,'A01');
 const account=[...c.storage.keys()].find(k=>k.startsWith('shiftplanner-codes-account:'));
 assert.equal(JSON.parse(c.storage.get(account)).dirty,false);
 assert(![...c.storage.values()].join('').includes('fake-test-password'));
 assert(![...c.storage.values()].join('').includes('access_token'));
 cloud.records=[row('B02')];cloud.revision=2;
 c.form(row('A01',{note:'offline edits'}));c.run('CodeLibrary.save("A01")');await c.run('CodeLibrary.push()');
 assert.equal(cloud.revision,2);assert.equal(cloud.records[0].code,'B02');
 assert.equal(JSON.parse(c.storage.get(account)).records[0].note,'offline edits');
 assert(c.messages.at(-1).includes('เครื่องอื่น'));
 await c.run('CodeLibrary.pull()');assert.equal(JSON.parse(c.storage.get(account)).records[0].code,'B02');
 assert(JSON.parse(c.downloads.at(-1).content).records.some(r=>r.note==='offline edits'));
 expire=true;await c.run('CodeLibrary.push()');assert(calls.some(r=>r.url.includes('grant_type=refresh_token')));assert.equal(cloud.revision,3);
 fail=true;c.form(row('B02',{note:'offline survives'}));c.run('CodeLibrary.save("B02")');await c.run('CodeLibrary.push()');
 assert.equal(JSON.parse(c.storage.get(account)).dirty,true);assert.equal(cloud.revision,3);
 fail=false;await c.run('CodeLibrary.logout()');c.run('CodeLibrary.local()');assert(c.$('codeResults').innerHTML.includes('A01'));
 const sql=fs.readFileSync(path.join(root,'supabase/code-library.sql'),'utf8');
 assert(sql.includes('enable row level security'));assert(sql.includes('security invoker'));assert(sql.includes("errcode = '40001'"));assert(sql.includes('and revision = expected_revision'));
 console.log('PASS: code catalogue CRUD, validation, search, escaped notes, XLSX text safety, JSON roundtrip/merge, reload, tab conflicts, corrupt recovery, cloud auth, account separation, revision conflicts, backup before pull, refresh and offline failure preservation');
}
main().catch(e=>{console.error(e);process.exitCode=1});
