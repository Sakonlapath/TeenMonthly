const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..');
const LOCAL='shiftplanner-codes-local-v1';
const row=(code='A01',extra={})=>({code,disease:'ชื่อโรคทดสอบ',conditions:'',procedures:'',note:'',...extra});
const serialized=(records,extra={})=>JSON.stringify({version:1,records,revision:0,dirty:true,...extra});
function boot({storage=new Map(),fetch=async()=>{throw Error('offline')}}={}){
 const elements=new Map(),events={},downloads=[],messages=[],timers=new Map();let timerId=0;
 const $=id=>{if(!elements.has(id))elements.set(id,{innerHTML:'',textContent:'',value:'',open:false,attributes:{},classList:{toggle(){}},setAttribute(name,value){this.attributes[name]=value},focus(){},reportValidity(){return true}});return elements.get(id)};
 const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const ctx=vm.createContext({console,TextEncoder,atob,AbortSignal,fetch,$,esc,currentView:'codes',document:{hidden:false},setTimeout(fn,delay){timers.set(++timerId,{fn,delay});return timerId},clearTimeout(id){timers.delete(id)},
  window:{addEventListener(name,fn){events[name]=fn}},localStorage:{getItem:k=>storage.get(k)??null,setItem(k,v){storage.set(k,v)}},
  toast:x=>messages.push(x),download:(content,name,type)=>downloads.push({content,name,type}),
  modal(title,body,foot){$('modal').open=true;$('modalTitle').textContent=title;$('modalBody').innerHTML=body;$('modalFoot').innerHTML=foot},closeModal(){$('modal').open=false}
 });
 for(const file of ['exports','code-catalog','code-library'])vm.runInContext(fs.readFileSync(path.join(root,'js',file+'.js'),'utf8'),ctx);
 const run=code=>vm.runInContext(code,ctx);
 function form(r){$('codeLetter').value=r.code[0];$('codeNumber').value=r.code.slice(1);$('codeDisease').value=r.disease;for(const k of ['conditions','procedures','note'])$('code-'+k).value=r[k]||''}
 const idFor=(code,occurrence=0)=>JSON.parse(storage.get(storage.get('shiftplanner-codes-active-v1')||LOCAL)).records.filter(r=>r.code===code)[occurrence].id;
 return {run,$,form,storage,ctx,downloads,messages,events,idFor,timers,tickSpeech(){const entry=[...timers].find(([,t])=>t.delay===7000);assert(entry);timers.delete(entry[0]);entry[1].fn()}};
}
function unzipStored(bytes){
 const data=Buffer.from(bytes),parts={};let p=0;
 while(data.readUInt32LE(p)===0x04034b50){const size=data.readUInt32LE(p+18),n=data.readUInt16LE(p+26),extra=data.readUInt16LE(p+28),start=p+30+n+extra;parts[data.subarray(p+30,p+30+n).toString()]=data.subarray(start,start+size).toString();p=start+size}
 return parts;
}
async function main(){
 const b=boot();const model=b.run('CodeCatalog');
 assert(b.$('codesView').innerHTML.includes('สวัสดีคนเก่งของเค้า'));
 assert(!/[♡♥❤]/u.test(b.$('codesView').innerHTML));
 assert(b.$('codesView').innerHTML.includes('<svg'));
 const speech=boot();speech.run('CodeLibrary.render();CodeLibrary.render()');assert.equal(speech.timers.size,1);
 for(const phrase of ['สู้ๆนะไอ้อ้วงง','เค้ารักอ้วนที่สุดในโลกเลยย','มากอดหน่อย','คนเก่งของเค้า','หอมแก้มม.','สวัสดีคนเก่งของเค้า']){speech.tickSpeech();assert.equal(speech.$('kittySpeechText').textContent,phrase)}
 speech.ctx.document.hidden=true;speech.tickSpeech();assert.equal(speech.$('kittySpeechText').textContent,'สวัสดีคนเก่งของเค้า');speech.ctx.document.hidden=false;
 speech.run('CodeLibrary.motion()');assert.equal(speech.timers.size,0);speech.run('CodeLibrary.nextSpeech()');assert.equal(speech.$('kittySpeechText').textContent,'สวัสดีคนเก่งของเค้า');
 speech.run('CodeLibrary.motion()');assert.equal(speech.timers.size,1);
 speech.run('currentView="schedule";CodeLibrary.suspend();CodeLibrary.nextSpeech()');assert.equal(speech.timers.size,0);assert.equal(speech.$('kittySpeechText').textContent,'สวัสดีคนเก่งของเค้า');
 b.run('CodeLibrary.cloud()');
 assert(b.$('modalBody').innerHTML.includes('value="https://omtcyjoewqtfsreshgfu.supabase.co"'));
 assert(b.$('modalBody').innerHTML.includes('value="sb_publishable_3Ixd4qU4vGBYVRJUqTurSg_vFabVA5B"'));
 const savedConfig=boot({storage:new Map([['shiftplanner-codes-cloud-v1',JSON.stringify({url:'https://saved-project.supabase.co',key:'sb_publishable_saved'})]])});
 savedConfig.run('CodeLibrary.cloud()');assert(savedConfig.$('modalBody').innerHTML.includes('value="https://saved-project.supabase.co"'));
 assert.equal(model.records([row('a00.01')])[0].code,'A00.01');
 for(const code of ['A','AA01','001','A1.','A01<script>','Z-10'])assert.throws(()=>model.records([row(code)]));
 const legacyDuplicates=model.records([row('A01'),row('a01')]);
 assert.equal(legacyDuplicates.length,2);assert.notEqual(legacyDuplicates[0].id,legacyDuplicates[1].id);
 assert.equal(JSON.stringify(model.records(legacyDuplicates)),JSON.stringify(legacyDuplicates),'legacy migration is stable');
 const legacyPair=[row('A01',{disease:'รายการแรก'}),row('A01',{disease:'รายการที่สอง'})];
 const migratedPair=model.records(legacyPair),duplicates=boot({storage:new Map([[LOCAL,serialized(legacyPair)]])});
 duplicates.run('CodeLibrary.render()');
 assert(duplicates.$('codeResults').innerHTML.includes("CodeLibrary.edit('"+migratedPair[1].id+"')"));
 duplicates.run('CodeLibrary.confirmRemove('+JSON.stringify(migratedPair[1].id)+')');
 assert.equal(JSON.parse(duplicates.storage.get(LOCAL)).records.length,1);
 assert.equal(JSON.parse(duplicates.storage.get(LOCAL)).records[0].disease,'รายการแรก','deleting a duplicate never deletes its sibling');
 assert.throws(()=>model.records([row('A01',{id:'same'}),row('B02',{id:'same'})]));
 assert.throws(()=>model.records([row('A01',{id:"bad'id"})]));
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
 assert.equal(model.upsert(catalog,row('A01')).length,3);
 assert.equal(model.upsert(catalog,row('B02'),catalog[0].id).filter(r=>r.code==='B02').length,2);
 assert.equal(model.upsert(catalog,row('C03'),catalog[0].id).find(r=>r.id===catalog[0].id).code,'C03');
 assert.throws(()=>model.upsert(catalog,row('C03'),'missing-id'));
 assert.equal(model.merge(catalog,catalog).length,2);
 assert.equal(model.merge(catalog,[row('A01',{note:'separate entry'})]).length,3);
 assert.throws(()=>model.merge(catalog,[row('A01',{id:catalog[0].id,note:'conflict'})]));
 const duplicateBackup=model.parseBackup(JSON.parse(JSON.stringify(model.backup(legacyDuplicates))));
 assert.equal(duplicateBackup.length,2);assert.equal(model.merge(duplicateBackup,duplicateBackup).length,2);
 const duplicateSheet=unzipStored(model.xlsx(duplicateBackup))['xl/worksheets/sheet1.xml'];
 assert.equal((duplicateSheet.match(/>A01<\/t>/g)||[]).length,2,'Excel retains each duplicate-code entry');
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
 assert(b.$('codesView').innerHTML.includes('สวัสดีคนเก่งของเค้า'));
 assert.equal(JSON.parse(b.storage.get(LOCAL)).records[0].code,'A001');
 assert(b.$('codeResults').innerHTML.includes('&lt;img'));
 assert(!b.$('codeResults').innerHTML.includes('<img'));
 const firstId=b.idFor('A001');
 b.run('CodeLibrary.favorite('+JSON.stringify(firstId)+')');assert.equal(JSON.parse(b.storage.get(LOCAL)).records[0].favorite,true);
 assert(b.$('codeFavorites').innerHTML.includes('A001'));
 b.run('CodeLibrary.edit()');b.form(row('A001'));b.run('CodeLibrary.save("")');
 assert.equal(JSON.parse(b.storage.get(LOCAL)).records.length,2);
 const secondId=b.idFor('A001',1);assert.notEqual(firstId,secondId);
 b.run('CodeLibrary.favorites()');assert.equal(b.$('codeCount').textContent,'พบ 1 จาก 2 รหัส');
 b.run('CodeLibrary.excel(true)');const favoriteSheet=unzipStored(b.downloads.at(-1).content)['xl/worksheets/sheet1.xml'];assert(favoriteSheet.includes('autoFilter ref="A1:F2"'));
 b.run('CodeLibrary.clearSearch()');
 b.run('CodeLibrary.edit('+JSON.stringify(secondId)+')');
 assert(b.$('modalBody').innerHTML.includes('value="001"'));
 assert(b.$('modalBody').innerHTML.includes('CodeLibrary.save(\''+secondId+'\')'));
 b.form(row('A001',{note:'edited only second entry'}));b.run('CodeLibrary.save('+JSON.stringify(secondId)+')');
 assert.equal(JSON.parse(b.storage.get(LOCAL)).records.find(r=>r.id===firstId).note,'<img src=x onerror=alert(1)>');
 assert.equal(JSON.parse(b.storage.get(LOCAL)).records.find(r=>r.id===secondId).note,'edited only second entry');
 b.form(row('Z09',{disease:'แก้ไขชื่อ',note:'Needle'}));b.run('CodeLibrary.save('+JSON.stringify(firstId)+')');
 assert.equal(JSON.parse(b.storage.get(LOCAL)).records.find(r=>r.id===firstId).code,'Z09');
 assert.equal(JSON.parse(b.storage.get(LOCAL)).records.find(r=>r.id===firstId).favorite,true,'editing text preserves the favorite');
 b.run('CodeLibrary.detail('+JSON.stringify(firstId)+')');assert(b.$('modalBody').innerHTML.includes('Needle'));
 b.run('CodeLibrary.search("needle");CodeLibrary.excel(true)');assert(b.downloads.at(-1).name.endsWith('.xlsx'));
 const reloaded=boot({storage:b.storage});reloaded.run('CodeLibrary.render()');assert(reloaded.$('codeResults').innerHTML.includes('แก้ไขชื่อ'));
 assert(reloaded.$('codeFavorites').innerHTML.includes('Z09'));
 reloaded.run('CodeLibrary.files()');assert(reloaded.$('modalBody').innerHTML.includes('CodeLibrary.cloud()'));assert(reloaded.$('modalBody').innerHTML.includes('คนละบัญชี'));
 b.run('CodeLibrary.remove('+JSON.stringify(firstId)+')');assert.equal(JSON.parse(b.storage.get(LOCAL)).records.length,2,'delete prompt is reversible');
 b.run('CodeLibrary.confirmRemove('+JSON.stringify(firstId)+')');assert.equal(JSON.parse(b.storage.get(LOCAL)).records.length,1);
 assert.equal(JSON.parse(b.storage.get(LOCAL)).records[0].id,secondId);
 b.run('CodeLibrary.confirmRemove('+JSON.stringify(secondId)+')');assert.equal(JSON.parse(b.storage.get(LOCAL)).records.length,0);
 const file={size:100,text:async()=>JSON.stringify(model.backup([row('B10')]))};b.ctx.file=file;
 await b.run('CodeLibrary.importFile({files:[file],value:""})');assert.equal(JSON.parse(b.storage.get(LOCAL)).records[0].code,'B10');
 const b10Id=b.idFor('B10');
 b.ctx.file={size:100,text:async()=>JSON.stringify(model.backup([row('B10',{id:b10Id,note:'different'})]))};
 await b.run('CodeLibrary.importFile({files:[file],value:""})');assert.equal(JSON.parse(b.storage.get(LOCAL)).records[0].note,'');
 b.ctx.file={size:100,text:async()=>JSON.stringify(model.backup([row('B10',{note:'another entry with the same code'})]))};
 await b.run('CodeLibrary.importFile({files:[file],value:""})');assert.equal(JSON.parse(b.storage.get(LOCAL)).records.length,2);
 await b.run('CodeLibrary.importFile({files:[file],value:""})');assert.equal(JSON.parse(b.storage.get(LOCAL)).records.length,2);
 b.storage.set(LOCAL,serialized([row('C10')]));b.form(row('B11'));b.run('CodeLibrary.save('+JSON.stringify(b10Id)+')');
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
 c.run('CodeLibrary.copyLocal()');c.form(row('A01',{note:'second online entry'}));c.run('CodeLibrary.save("")');await c.run('CodeLibrary.push()');
 assert.equal(cloud.revision,1);assert.equal(cloud.records[0].code,'A01');
 assert.equal(cloud.records.length,2);assert.notEqual(cloud.records[0].id,cloud.records[1].id);
 const account=[...c.storage.keys()].find(k=>k.startsWith('shiftplanner-codes-account:'));
 assert.equal(JSON.parse(c.storage.get(account)).dirty,false);
 assert(![...c.storage.values()].join('').includes('fake-test-password'));
 assert(![...c.storage.values()].join('').includes('access_token'));
 cloud.records=[row('B02')];cloud.revision=2;
 const offlineEditId=c.idFor('A01');
 c.form(row('A01',{note:'offline edits'}));c.run('CodeLibrary.save('+JSON.stringify(offlineEditId)+')');await c.run('CodeLibrary.push()');
 assert.equal(cloud.revision,2);assert.equal(cloud.records[0].code,'B02');
 assert.equal(JSON.parse(c.storage.get(account)).records.find(r=>r.id===offlineEditId).note,'offline edits');
 assert(c.messages.at(-1).includes('เครื่องอื่น'));
 await c.run('CodeLibrary.pull()');assert.equal(JSON.parse(c.storage.get(account)).records[0].code,'B02');
 assert(JSON.parse(c.downloads.at(-1).content).records.some(r=>r.note==='offline edits'));
 expire=true;await c.run('CodeLibrary.push()');assert(calls.some(r=>r.url.includes('grant_type=refresh_token')));assert.equal(cloud.revision,3);
 fail=true;c.form(row('B02',{note:'offline survives'}));c.run('CodeLibrary.save('+JSON.stringify(c.idFor('B02'))+')');await c.run('CodeLibrary.push()');
 assert.equal(JSON.parse(c.storage.get(account)).dirty,true);assert.equal(cloud.revision,3);
 fail=false;await c.run('CodeLibrary.logout()');c.run('CodeLibrary.local()');assert(c.$('codeResults').innerHTML.includes('A01'));
 const sql=fs.readFileSync(path.join(root,'supabase/code-library.sql'),'utf8');
 assert(sql.includes('enable row level security'));assert(sql.includes('security invoker'));assert(sql.includes("errcode = '40001'"));assert(sql.includes('and revision = expected_revision'));
 console.log('PASS: duplicate-code entries, independent editing/deletion, stable legacy migration, duplicate-safe JSON/Excel/cloud roundtrip, filtering, escaped notes, tab conflicts, recovery, cloud auth and offline preservation');
}
main().catch(e=>{console.error(e);process.exitCode=1});
