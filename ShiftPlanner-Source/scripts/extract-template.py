"""Read the supplied right-hand schedule without rewriting the source workbook."""
import sys,json,re
from zipfile import ZipFile
from xml.etree import ElementTree as E
from pathlib import Path
z=ZipFile(sys.argv[1]);ns={'s':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
strings=[''.join(t.text or '' for t in x.findall('.//s:t',ns)) for x in E.fromstring(z.read('xl/sharedStrings.xml'))]
root=E.fromstring(z.read('xl/worksheets/sheet15.xml'))
def colnum(s):
 n=0
 for c in s:n=n*26+ord(c)-64
 return n
def colname(n):
 s=''
 while n:n,r=divmod(n-1,26);s=chr(65+r)+s
 return s
def ref(s):
 return re.sub(r'([A-Z]+)(\d+)',lambda m:colname(colnum(m[1])-38)+m[2],s)
rows=[];cells={}
for row in root.findall('s:sheetData/s:row',ns):
 rn=int(row.get('r'))
 if rn>29:continue
 rows.append({k:v for k,v in row.attrib.items() if k in ['r','ht','customHeight','s','customFormat']})
 for c in row:
  cn=colnum(re.match('[A-Z]+',c.get('r'))[0])
  if not 39<=cn<=76:continue
  v=c.find('s:v',ns);val=v.text if v is not None else None
  if c.get('t')=='s' and val is not None:val=strings[int(val)]
  elif val is not None:
   try:val=float(val);val=int(val) if val.is_integer() else val
   except ValueError:pass
  cells[ref(c.get('r'))]={'s':int(c.get('s','0')),'v':val}
merges=[]
for merge in root.findall('s:mergeCells/s:mergeCell',ns):
 a,b=merge.get('ref').split(':');ca=colnum(re.match('[A-Z]+',a)[0]);cb=colnum(re.match('[A-Z]+',b)[0]);ra=int(re.search('\d+',a)[0]);rb=int(re.search('\d+',b)[0])
 if 39<=ca<=cb<=76 and rb<=29 and not(10<=ra<=18):merges.append(ref(merge.get('ref')))
cols=[]
for col in root.findall('s:cols/s:col',ns):
 lo=max(39,int(col.get('min')));hi=min(76,int(col.get('max')))
 if lo<=hi:cols.append({**col.attrib,'min':str(lo-38),'max':str(hi-38)})
styles=z.read('xl/styles.xml').decode();styleRoot=E.fromstring(styles);xfs=styleRoot.find('s:cellXfs',ns)
def variant(index,**attrs):
 x=xfs[index];a={**x.attrib,**{k:str(v) for k,v in attrs.items()}};children=''.join('<'+y.tag.split('}')[-1]+''.join(' '+k+'="'+v+'"' for k,v in y.attrib.items())+'/>' for y in x)
 return '<xf'+''.join(' '+k+'="'+v+'"' for k,v in a.items())+'>'+children+'</xf>'
extra=[variant(146,fontId=1),variant(42,fillId=8,applyFill=1),variant(218,borderId=4),variant(197,fillId=2,applyFill=1),variant(152,fillId=2,applyFill=1)]
styleIds=dict(zip(['money','off','vac','rHoliday','xHoliday'],range(len(xfs),len(xfs)+len(extra))))
styles=re.sub(r'<cellXfs count="\d+">','<cellXfs count="'+str(len(xfs)+len(extra))+'">',styles).replace('</cellXfs>',''.join(extra)+'</cellXfs>')
data={'cells':cells,'rows':rows,'cols':cols,'merges':merges,'styles':styles,'styleIds':styleIds,'theme':z.read('xl/theme/theme1.xml').decode()}
out=Path(__file__).resolve().parents[1]/'js/export-template.js'
out.write_text('/* Template: supplied workbook, ต.ค.69, AM1:BX29. */\nconst EXPORT_TEMPLATE='+json.dumps(data,ensure_ascii=False,separators=(',',':'))+';\nif(typeof module!=="undefined")module.exports=EXPORT_TEMPLATE;\n',encoding='utf-8')
print('Extracted right-hand layout,',len(cells),'cells;',len(merges),'merges.')
