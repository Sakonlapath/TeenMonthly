/* Template-based exports. XLSX uses the original Excel style definitions. */
const THAI_MONTHS=['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
const THAI_DAYS=['อา','จ','อ','พ','พฤ','ศ','ส'];
function excelColumn(n){let s='';while(n){const r=(n-1)%26;s=String.fromCharCode(65+r)+s;n=Math.floor((n-1)/26)}return s}
function exportModel(s,month,csv=false){
 const m=s.months[month],n=daysIn(month),[year,mon]=month.split('-').map(Number),label=THAI_MONTHS[mon-1]+' '+(year+543),data=clone(EXPORT_TEMPLATE.cells),people=monthPeople(s,month),allTotals=totals(s,month),ts=people.map(p=>allTotals.find(t=>t.id===p.id));
 if(people.length>9)throw Error('แบบ Excel ต้นฉบับรองรับ 9 คน กรุณาใช้ CSV สำหรับรายชื่อมากกว่า 9 คน');
 const put=(ref,v,style,formula)=>{data[ref]={s:style??data[ref]?.s??0,v,...(formula?{f:formula}:{})}};
 put('A2','ที่ '+(m.exportMeta?.orderNumber||'        ')+' / '+(year+543));
 put('A3',' เรื่อง ให้เจ้าหน้าที่ปฏิบัติงานนอกเวลาราชการและวันหยุดราชการ งานห้องบัตรและเวชระเบียน ประจำเดือน '+THAI_MONTHS[mon-1]+' พ.ศ. '+(year+543));
 put('B23','ทั้งนี้ ตั้งแต่วันที่ 1 '+label+' - วันที่ '+n+' '+label);
 const issued=m.exportMeta?.issuedDate;
 put('B24',issued?'สั่ง ณ วันที่ '+Number(issued.slice(8))+' '+THAI_MONTHS[Number(issued.slice(5,7))-1]+' '+(Number(issued.slice(0,4))+543):'สั่ง ณ วันที่ ........................................................');
 for(let d=1;d<=31;d++){
  const col=excelColumn(d+3),holiday=d<=n&&(m.days[d].holiday||[0,6].includes(weekday(month,d)));
  put(col+'8',d<=n?d:'',holiday?8:7);put(col+'9',d<=n?THAI_DAYS[weekday(month,d)]:'',holiday?8:7);
 }
 for(let i=0;i<9;i++){
  const p=people[i],row=i+10,t=ts[i];
  put('A'+row,p?i+1:'');put('B'+row,p?.name||'');put('C'+row,p?.role||'');
  for(let d=1;d<=31;d++){
   const c=p&&d<=n?cell(m,p.id,d):{code:'',block:''},holiday=d<=n&&(m.days[d].holiday||[0,6].includes(weekday(month,d)));
   let value=c.code?(csv&&c.code==='X'?'ร(รพ.สต.)':META[c.code].label):c.block==='VAC'?'Vac':c.block==='OFF'?(csv?'OFF':''):'';
   if(c.code&&c.block)value+=' / '+c.block;
   // Match the source: blue R, red X, pink OFF, orange weekends/holidays.
   const styles=EXPORT_TEMPLATE.styleIds,style=c.block==='OFF'?styles.off:c.block==='VAC'?styles.vac:c.code==='R'?(holiday?styles.rHoliday:197):c.code==='X'?(holiday?styles.xHoliday:152):holiday?44:42;
   put(excelColumn(d+3)+row,value,style);
  }
  if(p){
   put('AI'+row,t.N+t.M+t.A,38,'COUNTIF(D'+row+':AH'+row+',"ด")+COUNTIF(D'+row+':AH'+row+',"ช")+COUNTIF(D'+row+':AH'+row+',"บ")');
   put('AJ'+row,t.R+t.X,101,'COUNTIF(D'+row+':AH'+row+',"ร")');
   put('AK'+row,t.total,101,'AI'+row+'+AJ'+row);
   const cardRate=payRate(s,p.id,'card'),dawnRate=payRate(s,p.id,'dawn');
   put('AM'+row,cardRate,0);put('AN'+row,dawnRate,0);put('AO'+row,'',0);
   // Hidden raw codes keep the two identically displayed R shifts separate.
   for(let d=1;d<=31;d++)put(excelColumn(d+43)+row,d<=n?cell(m,p.id,d).code:'',0);
   put('AP'+row,t.R,0,'COUNTIF(AR'+row+':BV'+row+',"R")');
   put('AQ'+row,t.X,0,'COUNTIF(AR'+row+':BV'+row+',"X")');
   const formula='ROUND(AI'+row+'*AM'+row+'+AJ'+row+'*AN'+row+',2)';
   put('AL'+row,totalPay(s,t),EXPORT_TEMPLATE.styleIds.money,formula);
  }else for(const col of ['AI','AJ','AK','AL'])put(col+row,'');
 }
 put('AI19',ts.reduce((sum,t)=>sum+t.N+t.M+t.A,0),147,'SUM(AI10:AI18)');
 put('AJ19',ts.reduce((sum,t)=>sum+t.R+t.X,0),147,'SUM(AJ10:AJ18)');
 put('AK19',ts.reduce((sum,t)=>sum+t.total,0),147,'SUM(AK10:AK18)');
 put('AL19',ts.reduce((sum,t)=>sum+Math.round(totalPay(s,t)*100),0)/100,EXPORT_TEMPLATE.styleIds.money,'SUM(AL10:AL18)');
 return{cells:data,month,n,people};
}
function csvText(s,month){
 // Keep the original 31 day columns, heading rows, notes and signature positions.
 const people=monthPeople(s,month),copy=people.length>9?{...s,people:people.slice(0,9)}:s,model=exportModel(copy,month,true);
 const rows=Array.from({length:29},(_,r)=>Array.from({length:38},(_,c)=>model.cells[excelColumn(c+1)+(r+1)]?.v??''));
 if(people.length>9){
  const all=totals(s,month),ts=people.map(p=>all.find(t=>t.id===p.id));rows.splice(18,0,...people.slice(9).map((p,j)=>{const t=ts[j+9];return[j+10,p.name,p.role,...Array.from({length:31},(_,i)=>{const c=i<daysIn(month)?cell(s.months[month],p.id,i+1):{};return c.code?(c.code==='X'?'ร(รพ.สต.)':META[c.code].label):(c.block||'')}),t.N+t.M+t.A,t.R+t.X,t.total,totalPay(s,t)]}));
  const summary=rows[18+people.length-9];summary[34]=ts.reduce((a,t)=>a+t.N+t.M+t.A,0);summary[35]=ts.reduce((a,t)=>a+t.R+t.X,0);summary[36]=ts.reduce((a,t)=>a+t.total,0);summary[37]=ts.reduce((a,t)=>a+Math.round(totalPay(s,t)*100),0)/100;
 }
 const safe=v=>{let text=String(v??'');if(/^[=+@\-\t\r]/.test(text))text="'"+text;return '"'+text.replace(/"/g,'""')+'"'};
 return '\ufeff'+rows.map(row=>row.map(safe).join(',')).join('\r\n');
}
function xmlEscape(v){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]))}
function xmlAttrs(o){return Object.entries(o).map(([k,v])=>' '+k+'="'+xmlEscape(v)+'"').join('')}
function xlsxParts(s,month){
 const model=exportModel(s,month),main='http://schemas.openxmlformats.org/spreadsheetml/2006/main',rels='http://schemas.openxmlformats.org/package/2006/relationships';
 let sheet='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="'+main+'"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><dimension ref="A1:BV29"/><sheetViews><sheetView workbookViewId="0" showGridLines="0"/></sheetViews><sheetFormatPr defaultRowHeight="15"/><cols>'+EXPORT_TEMPLATE.cols.map(c=>'<col'+xmlAttrs(c)+'/>').join('')+'<col min="39" max="74" width="10" hidden="1" customWidth="1"/></cols><sheetData>';
 for(let r=1;r<=29;r++){
  const attrs=EXPORT_TEMPLATE.rows.find(row=>Number(row.r)===r)||{r};sheet+='<row'+xmlAttrs(attrs)+'>';
  for(let c=1;c<=74;c++){
   const ref=excelColumn(c)+r,v=model.cells[ref];if(!v)continue;
   const a=' r="'+ref+'" s="'+v.s+'"';
   if(v.f)sheet+='<c'+a+'><f>'+xmlEscape(v.f)+'</f><v>'+v.v+'</v></c>';
   else if(typeof v.v==='number')sheet+='<c'+a+'><v>'+v.v+'</v></c>';
   else if(v.v!==null&&v.v!=='')sheet+='<c'+a+' t="inlineStr"><is><t xml:space="preserve">'+xmlEscape(v.v)+'</t></is></c>';
   else sheet+='<c'+a+'/>';
  }sheet+='</row>';
 }
 const merges=[...EXPORT_TEMPLATE.merges];
 // Contiguous vacation cells are merged as on the supplied handwritten layout.
 for(let i=0;i<model.people.length;i++){for(let d=1;d<=model.n;d++){let end=d;const p=model.people[i];if(cell(s.months[month],p.id,d).block!=='VAC'||cell(s.months[month],p.id,d).code)continue;while(end<model.n&&cell(s.months[month],p.id,end+1).block==='VAC'&&!cell(s.months[month],p.id,end+1).code)end++;if(end>d)merges.push(excelColumn(d+3)+(i+10)+':'+excelColumn(end+3)+(i+10));d=end}}
 sheet+='</sheetData><mergeCells count="'+merges.length+'">'+merges.map(ref=>'<mergeCell ref="'+ref+'"/>').join('')+'</mergeCells><printOptions horizontalCentered="1"/><pageMargins left="0.2" right="0.2" top="0.3" bottom="0.3" header="0.1" footer="0.1"/><pageSetup paperSize="8" orientation="landscape" fitToWidth="1" fitToHeight="1"/></worksheet>';
 const type='application/vnd.openxmlformats-officedocument.';
 return {
  '[Content_Types].xml':'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="'+type+'spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="'+type+'spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="'+type+'spreadsheetml.styles+xml"/><Override PartName="/xl/theme/theme1.xml" ContentType="'+type+'theme+xml"/></Types>',
  '_rels/.rels':'<Relationships xmlns="'+rels+'"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
  'xl/workbook.xml':'<workbook xmlns="'+main+'" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="'+month+'" sheetId="1" r:id="rId1"/></sheets><definedNames><definedName name="_xlnm.Print_Area" localSheetId="0">\''+month+'\'!$A$1:$AL$29</definedName></definedNames><calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>',
  'xl/_rels/workbook.xml.rels':'<Relationships xmlns="'+rels+'"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="theme/theme1.xml"/></Relationships>',
  'xl/worksheets/sheet1.xml':sheet,'xl/styles.xml':EXPORT_TEMPLATE.styles,'xl/theme/theme1.xml':EXPORT_TEMPLATE.theme
 };
}
function zipStored(parts){
 const enc=new TextEncoder(),local=[],central=[];let offset=0;
 const crc=bytes=>{let n=0xffffffff;for(const b of bytes){n^=b;for(let i=0;i<8;i++)n=(n>>>1)^((n&1)?0xedb88320:0)}return(n^0xffffffff)>>>0};
 const header=(size)=>{const bytes=new Uint8Array(size);return{bytes,view:new DataView(bytes.buffer)}};
 for(const[name,text]of Object.entries(parts)){
  const filename=enc.encode(name),data=enc.encode(text),sum=crc(data),h=header(30+filename.length),c=header(46+filename.length);
  h.view.setUint32(0,0x04034b50,true);h.view.setUint16(4,20,true);h.view.setUint16(6,0x800,true);h.view.setUint32(14,sum,true);h.view.setUint32(18,data.length,true);h.view.setUint32(22,data.length,true);h.view.setUint16(26,filename.length,true);h.bytes.set(filename,30);local.push(h.bytes,data);
  c.view.setUint32(0,0x02014b50,true);c.view.setUint16(4,20,true);c.view.setUint16(6,20,true);c.view.setUint16(8,0x800,true);c.view.setUint32(16,sum,true);c.view.setUint32(20,data.length,true);c.view.setUint32(24,data.length,true);c.view.setUint16(28,filename.length,true);c.view.setUint32(42,offset,true);c.bytes.set(filename,46);central.push(c.bytes);offset+=h.bytes.length+data.length;
 }
 const end=header(22),count=central.length,centralSize=central.reduce((s,b)=>s+b.length,0);end.view.setUint32(0,0x06054b50,true);end.view.setUint16(8,count,true);end.view.setUint16(10,count,true);end.view.setUint32(12,centralSize,true);end.view.setUint32(16,offset,true);
 const all=[...local,...central,end.bytes],out=new Uint8Array(all.reduce((s,b)=>s+b.length,0));let pos=0;for(const b of all){out.set(b,pos);pos+=b.length}return out;
}
function downloadExcel(){try{download(zipStored(xlsxParts(state,state.selected)),'ShiftPlanner-'+state.selected+'.xlsx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');toast('ส่งออก Excel ตามแบบต้นฉบับแล้ว')}catch(e){toast('ส่งออกไม่ได้: '+e.message)}}
if(typeof module!=='undefined')module.exports={exportModel,csvText,xlsxParts,zipStored};
