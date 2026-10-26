from zipfile import ZipFile
from xml.etree import ElementTree as E
import json
from pathlib import Path
z=ZipFile(r'C:\Users\Asus\Downloads\1. ตารางเวรห้องบัตร งบ 69.xlsx')
ns={'s':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
strings=[''.join(x.itertext()) for x in E.fromstring(z.read('xl/sharedStrings.xml'))]
wb=E.fromstring(z.read('xl/workbook.xml'))
print(z.namelist())
print(z.read('xl/workbook.xml').decode())
for f in ['xl/worksheets/sheet15.xml']:
 if f not in z.namelist():continue
 sh=E.fromstring(z.read(f));print('\nSHEET',f)
 for row in sh.findall('s:sheetData/s:row',ns):
  items=[]
  for c in row:
   v=c.find('s:v',ns);form=c.find('s:f',ns)
   if v is not None:
    val=strings[int(v.text)] if c.get('t')=='s' else (v.text or '')
    items.append(c.get('r')+'['+str(c.get('s'))+']='+val+(' FORMULA:'+str(form.text) if form is not None else ''))
  if items:print(' | '.join(items))
 print('MERGES', [c.attrib for c in sh.findall('s:mergeCells/s:mergeCell',ns)])
