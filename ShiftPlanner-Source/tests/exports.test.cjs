const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ctx=vm.createContext({TextEncoder,console});
for(const file of ['core','data','export-template','exports'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/'+file+'.js'),'utf8'),ctx);
const run=code=>vm.runInContext(code,ctx);
run(`var s=clone(SEED);s.selected='2026-11';s.months[s.selected]=freshMonth(s.selected);var m=s.months[s.selected];
for(const p of s.people){['N','M','A','R','X'].forEach((code,i)=>m.cells[key(p.id,i+1)]={code,block:'',locked:false});m.cells[key(p.id,6)]={code:'',block:'OFF',locked:false};m.cells[key(p.id,7)]={code:'',block:'VAC',locked:false};m.cells[key(p.id,8)]={code:'',block:'VAC',locked:false}}
m.exportMeta={orderNumber:'123',issuedDate:'2026-10-26'};var model=exportModel(s,s.selected);var parts=xlsxParts(s,s.selected);`);
assert.equal(run('model.cells.AL10.v'),2600);
assert.equal(run('model.cells.AL11.v'),1650);
assert.equal(run('model.cells.AL17.v'),1950);
assert.equal(run('model.cells.AK10.v'),5);
assert.equal(run('model.cells.AJ10.v'),2);
assert.equal(run('model.cells.B18.v'),'');
assert.equal(run('model.cells.AH8.v'),'');
assert.match(run('model.cells.A3.v'),/พฤศจิกายน.*2569/);
assert.match(run('model.cells.B23.v'),/30 พฤศจิกายน 2569/);
assert.match(run('model.cells.B24.v'),/26 ตุลาคม 2569/);
assert.match(run(`parts['xl/worksheets/sheet1.xml']`),/mergeCell ref="J10:K10"/);
assert.match(run(`parts['xl/worksheets/sheet1.xml']`),/<f>AK10\*520<\/f><v>2600<\/v>/);
assert.equal(run('model.cells.A1.v===EXPORT_TEMPLATE.cells.A1.v'),true);
assert.equal(run('model.cells.B27.v===EXPORT_TEMPLATE.cells.B27.v'),true);
const csv=run('csvText(s,s.selected)');
assert(csv.startsWith('\ufeff'));assert.equal(csv.split('\r\n').length,29);
assert(csv.includes('ร(รพ.สต.)'));assert(csv.includes('OFF'));assert(csv.includes('Vac'));
for(const [month,days] of [['2027-02',28],['2028-02',29],['2026-11',30],['2026-12',31]]){
 run(`s.months['${month}']=freshMonth('${month}');var dates=exportModel(s,'${month}');`);
 assert.equal(run(`dates.cells[excelColumn(${days}+3)+'8'].v`),days);
 if(days<31)assert.equal(run(`dates.cells[excelColumn(${days}+4)+'8'].v`),'');
}
run(`s.people[0].name='=1+2'`);assert(run('csvText(s,s.selected)').includes("'=1+2"));
if(process.argv[2])fs.writeFileSync(process.argv[2],run('zipStored(parts)'));
console.log('PASS: template headings, dates 28–31, CSV, XLSX styles/merges/formulas, pay includes all shifts and excludes OFF/VAC');
