/* Read-only monthly statistics shared by the charts and their visible number labels. */
const ShiftStats=(()=>{
 function build(s,month){
  const n=daysIn(month),m=s.months[month],needs=calendarDemand(s,month).needs;
  const people=monthPeople(s,month).map(p=>{
   const row={id:p.id,name:p.name,plainName:p.plainName||p.name,role:p.role,photo:p.photo||'',rates:{card:payRate(s,p.id,'card'),dawn:payRate(s,p.id,'dawn')},total:0,hours:0,pay:0,OFF:0,VAC:0,regular:0,holiday:0,locked:0,freeDays:0,longestRun:0,days:[],byCode:Object.fromEntries(CODES.map(c=>[c,{count:0,hours:0,pay:0}]))};
   let run=0,cents=0;
   for(let d=1;d<=n;d++){
    const cellValue=cell(m,p.id,d),code=CODES.includes(cellValue.code)?cellValue.code:'',block=cellValue.block||'',holiday=!!m.days[d].holiday||[0,6].includes(weekday(month,d));let pay=0,hours=0;
    if(code){hours=META[code].hours;pay=Math.round(row.rates[SHIFT_GROUP_BY_CODE[code]]*100);row.total++;row.hours+=hours;cents+=pay;row.byCode[code].count++;row.byCode[code].hours+=hours;row.byCode[code].pay+=pay;row[holiday?'holiday':'regular']++;if(cellValue.locked)row.locked++;run++;row.longestRun=Math.max(row.longestRun,run)}else run=0;
    if(block==='OFF')row.OFF++;if(block==='VAC')row.VAC++;if(!code&&!['OFF','VAC'].includes(block))row.freeDays++;
    row.days.push({day:d,code,block,holiday,locked:!!cellValue.locked,hours,pay:pay/100});
   }
   row.pay=cents/100;for(const c of CODES)row.byCode[c].pay/=100;return row;
  });
  const team={id:'',name:'ทั้งทีม',total:0,hours:0,pay:0,OFF:0,VAC:0,regular:0,holiday:0,locked:0,freeDays:0,average:0,byCode:Object.fromEntries(CODES.map(c=>[c,{count:0,hours:0,pay:0}]))};
  for(const p of people){for(const k of ['total','hours','OFF','VAC','regular','holiday','locked','freeDays'])team[k]+=p[k];team.pay+=Math.round(p.pay*100);for(const c of CODES){team.byCode[c].count+=p.byCode[c].count;team.byCode[c].hours+=p.byCode[c].hours;team.byCode[c].pay+=Math.round(p.byCode[c].pay*100)}}
  team.pay/=100;for(const c of CODES)team.byCode[c].pay/=100;team.average=people.length?team.total/people.length:0;
  const daily=Array.from({length:n},(_,i)=>{
   const day=i+1,byCode=Object.fromEntries(CODES.map(c=>[c,people.filter(p=>p.days[i].code===c).length])),required=CODES.reduce((sum,c)=>sum+needs[day][c],0),covered=CODES.reduce((sum,c)=>sum+Math.min(needs[day][c],byCode[c]),0),total=CODES.reduce((sum,c)=>sum+byCode[c],0);
   return {day,holiday:!!m.days[day].holiday||[0,6].includes(weekday(month,day)),byCode,total,required,covered,unfilled:required-covered,extra:total-covered};
  });
  const required=daily.reduce((sum,d)=>sum+d.required,0),covered=daily.reduce((sum,d)=>sum+d.covered,0);
  return {month,daysIn:n,people,team,daily,required,covered,unfilled:required-covered,extra:daily.reduce((sum,d)=>sum+d.extra,0),coverage:required?covered/required*100:0};
 }
 return {build,scope:(model,id)=>model.people.find(p=>p.id===id)||model.team};
})();

const ShiftSummary=(()=>{
 let selected='',metric='count',issueCount=null,tip=null,tipAnchor=null;
 const types={N:{label:'ดึก',color:'#a694ca'},M:{label:'เช้า',color:'#76b697'},A:{label:'บ่าย',color:'#e3ad60'},R:{label:'หน้าตู้KIOS',color:'#66acbe'},X:{label:'ออกรพ.สต.',color:'#df887b'}};
 const metrics={count:{label:'จำนวนเวร',unit:'เวร'},hours:{label:'ชั่วโมง',unit:'ชม.'},pay:{label:'ค่าเวร',unit:'บาท'}};
 const number=n=>n.toLocaleString('th-TH',{maximumFractionDigits:2}),arg=v=>esc(JSON.stringify(v));
 const icon=(name,size=22)=>'<svg width="'+size+'" height="'+size+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+({bow:'<path d="M10 9C0 0 0 23 10 15h4c10 8 10-15 0-6Z"/><circle cx="12" cy="12" r="3"/>',person:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',calendar:'<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 11h18m-12 4h6"/>',clock:'<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',coin:'<circle cx="12" cy="12" r="9"/><path d="M15 7H10a2.5 2.5 0 0 0 0 5h4a2.5 2.5 0 0 1 0 5H9M12 5v14"/>',rest:'<path d="M4 11h16v9M4 20V7m0 8h16M7 7h4v4H7Z"/>',bars:'<path d="M4 4v16h17M8 15v-4m5 4V7m5 8v-6"/>'}[name]||'')+'</svg>';
 function avatar(p){const safe=/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(p.photo||'');return '<span class="sum-avatar">'+(safe?'<img src="'+esc(p.photo)+'" width="44" height="44" alt="">':icon('person',24))+'</span>'}
 function legend(){return '<div class="sum-color-key">'+CODES.map(c=>'<span><i style="background:'+types[c].color+'"></i>'+types[c].label+'</span>').join('')+'</div>'}
 function metricCard(kind,label,value,unit,detail){return '<article class="sum-metric sum-metric-'+kind+'"><div class="sum-metric-label">'+icon(kind)+'<span>'+label+'</span></div><div class="sum-metric-number">'+value+' <small>'+unit+'</small></div><p>'+detail+'</p></article>'}
 function ring(row){
  const circumference=2*Math.PI*67;let offset=0;
  const circles=CODES.map(c=>{const length=row.total?row.byCode[c].count/row.total*circumference:0,svg=length?'<circle cx="100" cy="100" r="67" fill="none" stroke="'+types[c].color+'" stroke-width="22" stroke-dasharray="'+length+' '+(circumference-length)+'" stroke-dashoffset="'+(-offset)+'" transform="rotate(-90 100 100)"><title>'+types[c].label+' '+row.byCode[c].count+' เวร</title></circle>':'';offset+=length;return svg}).join('');
  return '<section class="sum-chart sum-ring-panel" aria-labelledby="sumRingTitle"><div class="sum-chart-heading"><div><h2 id="sumRingTitle">สัดส่วนประเภทเวร</h2><p>'+esc(selected?row.plainName:'ทั้งทีม')+'</p></div><span class="sum-mini-tag">5 ประเภท</span></div><div class="sum-ring-layout"><svg class="sum-ring" viewBox="0 0 200 200" role="img" aria-label="'+esc('สัดส่วนประเภทเวร '+row.name+' รวม '+row.total+' เวร')+'"><circle cx="100" cy="100" r="67" fill="none" stroke="#f5eaf0" stroke-width="22"/>'+circles+'<text x="100" y="99" text-anchor="middle" class="sum-ring-total">'+row.total+'</text><text x="100" y="120" text-anchor="middle" class="sum-ring-unit">เวรทั้งหมด</text></svg><ul class="sum-ring-legend">'+CODES.map(c=>'<li><span><i style="background:'+types[c].color+'"></i>'+types[c].label+'</span><b>'+row.byCode[c].count+' <small>เวร</small></b><em>'+number(row.total?row.byCode[c].count/row.total*100:0)+'%</em></li>').join('')+'</ul></div>'+(!row.total?'<p class="sum-empty-note">ยังไม่มีเวรในเดือนนี้</p>':'')+'</section>';
 }
 function bars(model){
  const value=p=>CODES.reduce((sum,c)=>sum+p.byCode[c][metric],0),max=Math.max(1,...model.people.map(value));
  return '<section class="sum-chart sum-bars-panel" aria-labelledby="sumBarsTitle"><div class="sum-chart-heading"><div><h2 id="sumBarsTitle">เปรียบเทียบบุคลากร</h2><p>ทั้งทีม '+model.people.length+' คน</p></div><div class="sum-metric-switch" role="group" aria-label="ตัวชี้วัดกราฟแท่ง">'+Object.entries(metrics).map(([key,m])=>'<button id="sumMetric-'+key+'" type="button" aria-pressed="'+(key===metric)+'" onclick="ShiftSummary.metric('+arg(key)+')">'+m.label+'</button>').join('')+'</div></div>'+legend()+'<div class="sum-bar-list">'+model.people.map(p=>'<button class="sum-bar-row'+(p.id===selected?' selected':'')+'" type="button" aria-pressed="'+(p.id===selected)+'" onclick="ShiftSummary.person('+arg(p.id)+')" aria-label="'+esc('ดูสถิติ '+p.name+' '+metrics[metric].label+' '+number(value(p))+' '+metrics[metric].unit)+'"><span class="sum-bar-name">'+esc(p.plainName)+'<small>'+esc(p.role)+'</small></span><span class="sum-bar-track" aria-hidden="true">'+CODES.map(c=>'<i style="width:'+(p.byCode[c][metric]/max*100)+'%;background:'+types[c].color+'" title="'+types[c].label+' '+number(p.byCode[c][metric])+' '+metrics[metric].unit+'"></i>').join('')+'</span><span class="sum-bar-value">'+number(value(p))+'<small>'+metrics[metric].unit+'</small></span></button>').join('')+(!model.people.length?'<p class="sum-empty-note">ยังไม่ได้เลือกบุคลากรลงตารางเดือนนี้</p>':'')+'</div></section>';
 }
 function daily(model,row){
  if(selected)return '<section class="sum-chart sum-person-days"><div class="sum-chart-heading"><div><h2>เวรรายวันของ '+esc(row.plainName)+'</h2><p>'+esc(monthLabel(model.month))+'</p></div><button class="sum-link" onclick="view(\'schedule\')">ดูตารางเวร</button></div><div class="sum-day-grid">'+row.days.map(d=>'<div class="sum-day-cell'+(d.holiday?' holiday':'')+'" title="'+esc('วันที่ '+d.day+' · '+(d.code?types[d.code].label:d.block||'ไม่มีเวร')+(d.locked?' · ล็อกไว้':''))+'"><span>'+d.day+'</span><b style="'+(d.code?'background:'+types[d.code].color+'25;color:#613c50':'')+'">'+(d.code?types[d.code].label:d.block==='VAC'?'Vac':d.block||'—')+'</b></div>').join('')+'</div><div class="sum-person-facts"><span>วันธรรมดา <b>'+row.regular+'</b> เวร</span><span>วันหยุด <b>'+row.holiday+'</b> เวร</span><span>วันว่าง (ไม่รวม OFF/Vac) <b>'+row.freeDays+'</b> วัน</span><span>ลงเวรต่อเนื่องสูงสุด <b>'+row.longestRun+'</b> วัน</span><span>ล็อกไว้ <b>'+row.locked+'</b> เวร</span></div></section>';
  const max=Math.max(1,...model.daily.map(d=>Math.max(d.total,d.required))),peak=model.daily.reduce((best,d)=>d.total>best.total?d:best,{day:0,total:0});
  return '<section class="sum-chart sum-daily-panel"><div class="sum-chart-heading"><div><h2>เวรในแต่ละวัน</h2><p>'+esc(monthLabel(model.month))+'</p></div><span class="sum-mini-tag">'+(peak.total?'สูงสุด '+peak.total+' เวร · วันที่ '+peak.day:'ยังไม่มีเวร')+'</span></div><div class="sum-daily-scroll"><div class="sum-daily-bars" role="img" aria-label="'+esc('จำนวนเวรรายวัน '+monthLabel(model.month))+'">'+model.daily.map(d=>'<div class="sum-daily-column'+(d.holiday?' holiday':'')+'" title="'+esc('วันที่ '+d.day+' · ลงแล้ว '+d.total+' เวร · ขาด '+d.unfilled+' · เกิน '+d.extra)+'"><b>'+d.total+'</b><div class="sum-daily-track">'+CODES.map(c=>'<i style="height:'+(d.byCode[c]/max*100)+'%;background:'+types[c].color+'"></i>').join('')+'<span class="sum-required-line" style="bottom:'+(d.required/max*100)+'%"></span></div><span>'+d.day+'</span></div>').join('')+'</div></div><div class="sum-daily-caption"><span>เส้นประ = จำนวนที่ต้องการ</span><span>วันที่พื้นชมพู = วันหยุด</span></div></section>';
 }
 function render(report){
  if(Array.isArray(report?.issues))issueCount=report.issues.length;
  const host=$('summaryDashboard'),charts=$('summaryCharts');if(!host||!charts)return;
  hideTip();const barScroll=charts.querySelector('.sum-bar-list')?.scrollTop||0;
  const model=ShiftStats.build(state,state.selected);if(!model.people.some(p=>p.id===selected))selected='';const row=ShiftStats.scope(model,selected),card=row.byCode.N.count+row.byCode.M.count+row.byCode.A.count,dawn=row.byCode.R.count+row.byCode.X.count;
  host.innerHTML='<div class="sum-notebook"><header class="sum-heading"><div class="sum-heading-title"><span class="sum-bow">'+icon('bow',32)+'</span><div><h1>สรุปเดือนของทีม</h1><p>'+model.people.length+' คนในตาราง · '+model.daysIn+' วัน</p></div></div><div class="sum-month-nav"><button type="button" onclick="changeMonth(-1)" aria-label="สรุปเดือนก่อนหน้า">‹</button><label><span class="sum-sr-only">เดือนที่ต้องการสรุป</span><input id="summaryMonthPicker" type="month" value="'+state.selected+'" onchange="selectMonth(this.value)"></label><button type="button" onclick="changeMonth(1)" aria-label="สรุปเดือนถัดไป">›</button></div></header><div class="sum-toolbar"><div class="sum-scope"><button type="button" class="sum-team-button'+(!selected?' active':'')+'" aria-pressed="'+(!selected)+'" onclick="ShiftSummary.person(\'\')">ทั้งทีม</button><label><span class="sum-sr-only">เลือกดูสถิติรายคน</span><select id="summaryPersonSelect" onchange="ShiftSummary.person(this.value)"><option value="">เลือกดูรายคน</option>'+model.people.map(p=>'<option value="'+esc(p.id)+'" '+(p.id===selected?'selected':'')+'>'+esc(p.name)+'</option>').join('')+'</select></label></div><div class="sum-toolbar-actions"><span class="sum-month-label">'+esc(monthLabel(state.selected))+'</span><button type="button" class="sum-audit-button'+(issueCount===0?' clear':'')+'" onclick="issuesModal()">ตรวจตาราง'+(issueCount===null?'':' · '+issueCount+' รายการ')+'</button></div></div>'+
   (selected?'<div class="sum-person-heading">'+avatar(row)+'<div><h2>'+esc(row.name)+'</h2><p>'+esc(row.role)+'</p></div><div class="sum-person-rates"><span>ห้องบัตร <b>'+number(row.rates.card)+'</b> บาท / เวร</span><span>รุ่งอรุณ <b>'+number(row.rates.dawn)+'</b> บาท / เวร</span></div></div>':'')+
   '<div class="sum-metrics">'+metricCard('calendar','ลงเวรแล้ว',number(row.total),'เวร','ห้องบัตร '+card+' · รุ่งอรุณ '+dawn)+metricCard('coin','ค่าเวรรวม',number(row.pay),'บาท',selected?'ตามเรทของคนนี้':'รวมค่าตอบแทน '+model.people.length+' คน')+metricCard('clock','ชั่วโมงทำงาน',number(row.hours),'ชม.','วันธรรมดา '+row.regular+' · วันหยุด '+row.holiday+' เวร')+metricCard('rest','OFF / Vac',row.OFF+' <span class="sum-metric-divider">/</span> '+row.VAC,'วัน',selected?'วันว่างไม่รวม OFF/Vac '+row.freeDays+' วัน':'รวมวันหยุดและวันลาของทุกคน')+'</div></div>';
  charts.innerHTML='<div class="sum-notebook">'+
   (!selected?'<section class="sum-coverage" aria-label="ความคืบหน้าตาราง"><div><b>เติมตารางแล้ว '+model.covered+' / '+model.required+' ช่อง</b><span>ยังขาด '+model.unfilled+' ช่อง'+(model.extra?' · ลงเกินจำนวนที่ต้องการ '+model.extra+' เวร':'')+'</span></div><div class="sum-coverage-track" role="progressbar" aria-label="ช่องเวรที่ลงครบตามจำนวนที่ต้องการ" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'+Math.round(model.coverage)+'"><i style="width:'+model.coverage+'%"></i></div><strong>'+number(model.coverage)+'%</strong></section>':'')+
   (!selected?'<div class="sum-team-facts"><span>เฉลี่ย <b>'+number(model.team.average)+'</b> เวร / คน</span><span>ลงเวรแล้ว <b>'+model.people.filter(p=>p.total>0).length+' / '+model.people.length+'</b> คน</span><span>ค่าเวรเฉลี่ย <b>'+number(model.people.length?model.team.pay/model.people.length:0)+'</b> บาท / คน</span><span>ล็อกไว้ <b>'+model.team.locked+'</b> เวร</span></div>':'')+
   '<div class="sum-chart-grid">'+bars(model)+ring(row)+'</div>'+daily(model,row)+
   '<section class="sum-type-breakdown"><div class="sum-chart-heading"><h2>สรุปแยกตามประเภทเวร</h2><span>'+esc(selected?row.plainName:'ทั้งทีม')+'</span></div><div class="sum-type-grid">'+CODES.map(c=>'<article style="--sum-type:'+types[c].color+'"><h3><i></i>'+types[c].label+'</h3><b>'+row.byCode[c].count+' <small>เวร</small></b><span>'+number(row.byCode[c].hours)+' ชั่วโมง</span><strong>'+number(row.byCode[c].pay)+' <small>บาท</small></strong></article>').join('')+'</div></section></div>';
  const list=charts.querySelector('.sum-bar-list');if(list)list.scrollTop=barScroll;
  decorateTips();
 }
 function decorateTips(){
  const section=$('summaryView');if(!section)return;
  section.querySelectorAll('[title]').forEach(el=>{const text=el.getAttribute('title');if(text)el.setAttribute('data-summary-tip',text);el.removeAttribute('title')});
  section.querySelectorAll('svg title').forEach(el=>{el.parentElement.setAttribute('data-summary-tip',el.textContent);el.remove()});
 }
 function hideTip(){
  if(tipAnchor){const ids=(tipAnchor.getAttribute('aria-describedby')||'').split(/\s+/).filter(id=>id&&id!=='summaryTooltip');if(ids.length)tipAnchor.setAttribute('aria-describedby',ids.join(' '));else tipAnchor.removeAttribute('aria-describedby');tipAnchor=null}
  if(tip){tip.hidden=true;tip.textContent=''}
 }
 function placeTip(x,y){
  if(!tip||tip.hidden)return;const box=tip.getBoundingClientRect();
  tip.style.left=Math.max(10,Math.min(x+14,window.innerWidth-box.width-10))+'px';
  tip.style.top=Math.max(10,y+16+box.height>window.innerHeight-10?y-box.height-12:y+16)+'px';
 }
 function showTip(anchor,x,y){
  const text=anchor?.getAttribute('data-summary-tip');if(!text){hideTip();return}
  hideTip();
  if(!tip){tip=document.createElement('div');tip.id='summaryTooltip';tip.className='sum-tooltip';tip.setAttribute('role','tooltip');document.body.appendChild(tip)}
  tip.textContent=text;tip.hidden=false;tipAnchor=anchor;
  const ids=(anchor.getAttribute('aria-describedby')||'').split(/\s+/).filter(Boolean);anchor.setAttribute('aria-describedby',[...new Set([...ids,'summaryTooltip'])].join(' '));placeTip(x,y);
 }
 function setupTips(){
  const target=e=>{const el=e.target?.closest?.('[data-summary-tip]');return el&&$('summaryView').contains(el)?el:null};
  document.addEventListener('pointerover',e=>{if(e.pointerType==='touch')return;const anchor=target(e);if(anchor&&anchor!==tipAnchor)showTip(anchor,e.clientX,e.clientY)});
  document.addEventListener('pointermove',e=>{if(e.pointerType==='touch')return;const anchor=target(e);if(anchor){if(anchor!==tipAnchor)showTip(anchor,e.clientX,e.clientY);else placeTip(e.clientX,e.clientY)}});
  document.addEventListener('pointerout',e=>{if(tipAnchor&&tipAnchor.contains(e.target)&&!tipAnchor.contains(e.relatedTarget)&&!tipAnchor.contains(document.activeElement))hideTip()});
  document.addEventListener('focusin',e=>{const anchor=target(e);if(anchor){const box=anchor.getBoundingClientRect();showTip(anchor,box.left,box.bottom)}});
  document.addEventListener('focusout',e=>{if(tipAnchor?.contains(e.target))hideTip()});
  document.addEventListener('keydown',e=>{if(e.key==='Escape')hideTip()});
  document.addEventListener('click',hideTip);
  document.addEventListener('scroll',()=>{if(tipAnchor?.contains(document.activeElement)){const box=tipAnchor.getBoundingClientRect();if(box.bottom<0||box.top>window.innerHeight)hideTip();else placeTip(box.left,box.bottom)}else hideTip()},true);
  window.addEventListener('resize',hideTip);
 }
 function person(id){selected=String(id);render();$('summaryPersonSelect')?.focus?.({preventScroll:true})}
 function setMetric(value){if(!metrics[value])return;metric=value;render();$('sumMetric-'+metric)?.focus?.({preventScroll:true})}
 if(typeof document!=='undefined')document.addEventListener('DOMContentLoaded',()=>{render();setupTips()});
 return {render,person,metric:setMetric};
})();
