/* Data rules shared by the offline library, cloud connection and tests. */
const CodeCatalog = (() => {
 'use strict';
 const MAX_BYTES=4500000, MAX_RECORDS=10000;
 function records(value){
  if(!Array.isArray(value)||value.length>MAX_RECORDS)throw Error('รายการต้องไม่เกิน 10,000 รหัส');
  const seen=new Set();
  const result=value.map(row=>{
   if(!row||typeof row!=='object')throw Error('รูปแบบรายการไม่ถูกต้อง');
   const r={};
   for(const name of ['code','disease','conditions','procedures','note']){
    const v=row[name]??'';
    if(typeof v!=='string'||v.length>(name==='code'?32:name==='disease'?500:8000)||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v))throw Error('ข้อมูลในช่อง '+name+' ไม่ถูกต้องหรือยาวเกินกำหนด');
    r[name]=v.trim();
   }
   r.code=r.code.toUpperCase().replace(/\s/g,'');
   if(!/^[A-Z][0-9]+(?:\.[0-9]+)?$/.test(r.code))throw Error('รหัสต้องเป็น A–Z ตามด้วยตัวเลข เช่น A00 หรือ A00.1');
   if(!r.disease)throw Error('กรุณาระบุชื่อโรค');
   if(seen.has(r.code))throw Error('รหัส '+r.code+' ซ้ำกัน');
   seen.add(r.code);
   return r;
  });
  if(new TextEncoder().encode(JSON.stringify(result)).length>MAX_BYTES)throw Error('คลังรหัสใหญ่เกิน 4.5 MB กรุณาลดขนาดข้อมูล');
  return sort(result);
 }
 function sort(rows){return [...rows].sort((a,b)=>a.code.localeCompare(b.code,'en',{numeric:true})||a.code.localeCompare(b.code))}
 function filter(rows,category='',query='',kind=[]){
  const terms=query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const kinds=Array.isArray(kind)?kind:kind==='both'?['conditions','procedures']:kind?[kind]:[];
  return sort(rows.filter(r=>(!category||r.code[0]===category)&&kinds.every(k=>!!r[k])&&terms.every(t=>[r.code,r.disease,r.conditions,r.procedures,r.note].join(' ').toLocaleLowerCase().includes(t))));
 }
 function upsert(rows,input,oldCode=null){
  const r=records([input])[0];
  if(oldCode&&!rows.some(x=>x.code===oldCode))throw Error('ไม่พบรหัสที่กำลังแก้ไข กรุณาเปิดรายการใหม่');
  if(rows.some(x=>x.code===r.code&&x.code!==oldCode))throw Error('มีรหัส '+r.code+' แล้ว กรุณาแก้รายการเดิม');
  return records([...rows.filter(x=>x.code!==oldCode),r]);
 }
 function merge(rows,incoming){
  const next=new Map(rows.map(r=>[r.code,r]));
  for(const r of records(incoming)){
   if(next.has(r.code)&&JSON.stringify(next.get(r.code))!==JSON.stringify(r))throw Error('รหัส '+r.code+' มีรายละเอียดต่างกัน กรุณาแก้หรือลบรายการเดิมก่อนนำเข้า');
   next.set(r.code,r);
  }
  return records([...next.values()]);
 }
 function backup(rows){return {format:'shiftplanner-code-library',version:1,exportedAt:new Date().toISOString(),records:records(rows)}}
 function parseBackup(value){if(value?.format!=='shiftplanner-code-library'||value.version!==1)throw Error('กรุณาใช้ไฟล์สำรอง JSON ของคลังโค้ดรหัส');return records(value.records)}
 function document(value){
  if(!value||value.version!==1||!Number.isSafeInteger(value.revision)||value.revision<0||typeof value.dirty!=='boolean')throw Error('ข้อมูลคลังรหัสเสียหาย');
  return {version:1,revision:value.revision,dirty:value.dirty,records:records(value.records)};
 }
 function config(url,key){
  url=url.trim().replace(/\/$/,'');key=key.trim();
  if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url))throw Error('กรุณาใส่ Project URL รูปแบบ https://ชื่อโปรเจกต์.supabase.co');
  let publicKey=/^sb_publishable_[A-Za-z0-9_-]+$/.test(key);
  if(!publicKey&&key.split('.').length===3){try{const payload=JSON.parse(atob(key.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));publicKey=payload.role==='anon'}catch{}}
  if(!publicKey)throw Error('ใช้ Publishable key หรือ anon key เท่านั้น ห้ามใช้ secret / service_role');
  return {url,key};
 }
 function xlsx(rows){
  rows=records(rows);
  const headers=['หมวด','รหัส','ชื่อโรค','เงื่อนไข','หัตถการ','Note'];
  const all=[headers,...rows.map(r=>[r.code[0],r.code,r.disease,r.conditions,r.procedures,r.note])];
  const main='http://schemas.openxmlformats.org/spreadsheetml/2006/main',rel='http://schemas.openxmlformats.org/package/2006/relationships';
  const sheet='<worksheet xmlns="'+main+'"><dimension ref="A1:F'+all.length+'"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols><col min="1" max="1" width="9" customWidth="1"/><col min="2" max="2" width="16" customWidth="1"/><col min="3" max="6" width="45" customWidth="1"/></cols><sheetData>'+all.map((row,i)=>'<row r="'+(i+1)+'">'+row.map((v,c)=>'<c r="'+String.fromCharCode(65+c)+(i+1)+'" s="'+(i?0:1)+'" t="inlineStr"><is><t xml:space="preserve">'+xmlEscape(v)+'</t></is></c>').join('')+'</row>').join('')+'</sheetData><autoFilter ref="A1:F'+all.length+'"/></worksheet>';
  const types='application/vnd.openxmlformats-officedocument.spreadsheetml.';
  return zipStored({
   '[Content_Types].xml':'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="'+types+'sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="'+types+'worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="'+types+'styles+xml"/></Types>',
   '_rels/.rels':'<Relationships xmlns="'+rel+'"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
   'xl/workbook.xml':'<workbook xmlns="'+main+'" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="โค้ดรหัส" sheetId="1" r:id="rId1"/></sheets></workbook>',
   'xl/_rels/workbook.xml.rels':'<Relationships xmlns="'+rel+'"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
   'xl/worksheets/sheet1.xml':sheet,
   'xl/styles.xml':'<styleSheet xmlns="'+main+'"><fonts count="2"><font><sz val="12"/><name val="Tahoma"/></font><font><b/><sz val="12"/><name val="Tahoma"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>'
  });
 }
 return {records,filter,upsert,merge,backup,parseBackup,document,config,xlsx,MAX_BYTES};
})();
