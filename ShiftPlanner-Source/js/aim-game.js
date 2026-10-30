/* A self-contained aim trainer. Scores stay on this browser; no account or network needed. */
globalThis.AimGame=(()=>{
 'use strict';
 const STORE='pruksa-aim-club-v1';
 const levels={easy:{label:'ชิล ๆ',size:68,life:2200},normal:{label:'กำลังดี',size:54,life:1500},hard:{label:'ท้าทาย',size:40,life:1000}};
 const modes={grid:{label:'ยิงเป้าต่อเนื่อง',short:'3 เป้า',description:'คลิกเป้าให้โดน แล้วไปต่อให้ไว'},reflex:{label:'ทดสอบรีเฟล็กซ์',short:'รีเฟล็กซ์',description:'รอเป้าโผล่ แล้วคลิกให้ทันก่อนหาย'}};
 const symbol='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 1v5m0 12v5M1 12h5m12 0h5"/></svg>';
 const heart='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21 3.5 12.5a5.3 5.3 0 0 1 7.5-7.5L12 6l1-1a5.3 5.3 0 0 1 7.5 7.5Z" fill="currentColor"/></svg>';
 let mode='grid',level='normal',seconds=30,phase='ready',previousPhase='',timer,sound=false,audio;
 let hits=0,misses=0,combo=0,maxCombo=0,score=0,reactions=[],targets=[],serial=0;
 let countdownUntil=0,endsAt=0,pausedAt=0,nextSpawnAt=0,feedbackUntil=0,feedback='',lastPosition=null;
 let bests={},storageWarning=false;
 const now=()=>typeof performance!=='undefined'?performance.now():Date.now();
 const key=()=>[mode,level,seconds].join(':');
 try{
  const saved=JSON.parse(localStorage.getItem(STORE)||'{}');
  if(saved&&typeof saved==='object'&&!Array.isArray(saved))for(const [k,v]of Object.entries(saved)){
   if(/^(grid|reflex):(easy|normal|hard):(30|60)$/.test(k)&&Number.isSafeInteger(v)&&v>=0)bests[k]=v;
  }
 }catch{storageWarning=true}
 function stopTimer(){if(timer!==undefined)clearTimeout(timer);timer=undefined}
 function active(){return phase==='playing'||phase==='countdown'||phase==='paused'}
 function accuracy(){return hits+misses?Math.round(hits/(hits+misses)*100):0}
 function average(){return reactions.length?Math.round(reactions.reduce((a,b)=>a+b,0)/reactions.length):null}
 function remaining(t=now()){return phase==='playing'?Math.max(0,(endsAt-t)/1000):phase==='paused'&&previousPhase==='playing'?Math.max(0,(endsAt-pausedAt)/1000):phase==='finished'?0:seconds}
 function render(){
  const host=$('gameView');if(!host)return;
  host.innerHTML=`<div class="aim-club"><header class="aim-heading"><div><span class="aim-eyebrow">A LITTLE BREAK, A LITTLE BETTER</span><h1>พักมือ มาเล็งกัน <span>${symbol}</span></h1><p>สนามเล็ก ๆ ของคนเก่ง เล่นเพลิน ฝึกไวขึ้นทีละนิด</p></div><span class="aim-club-mark">PRUKSA<br><b>AIM CLUB</b></span></header>
   <div class="aim-layout"><aside class="aim-settings"><div class="aim-settings-title">เลือกสนามของเรา <span>01</span></div><div class="aim-mode-options" role="group" aria-label="โหมดเกม">${Object.entries(modes).map(([id,m])=>`<button class="aim-mode" data-aim-setting aria-pressed="${mode===id}" onclick="AimGame.configure('mode','${id}')"><span class="aim-mode-symbol">${id==='grid'?'<i></i><i></i><i></i>':symbol}</span><span><b>${m.label}</b><small>${m.description}</small></span></button>`).join('')}</div>
   <div class="aim-setting-group"><span>ความท้าทาย</span><div class="aim-segments" role="group" aria-label="ความยาก">${Object.entries(levels).map(([id,l])=>`<button data-aim-setting aria-pressed="${level===id}" onclick="AimGame.configure('level','${id}')">${l.label}</button>`).join('')}</div></div>
   <div class="aim-setting-group"><span>เวลาของรอบนี้</span><div class="aim-segments" role="group" aria-label="เวลาต่อรอบ">${[30,60].map(v=>`<button data-aim-setting aria-pressed="${seconds===v}" onclick="AimGame.configure('seconds',${v})">${v} <small>วินาที</small></button>`).join('')}</div></div>
   <div class="aim-personal-best"><span>${symbol} สถิติดีที่สุดของสนามนี้</span><strong id="aimBest">0</strong><small>คะแนน · เก็บไว้ในเครื่องนี้</small></div>
   <button id="aimSound" class="aim-sound" aria-pressed="${sound}" onclick="AimGame.toggleSound()">${sound?'เสียง: เปิด':'เสียง: ปิด'}<span>${sound?'♪':'♫'}</span></button>
   <p class="aim-shortcuts"><kbd>Space</kbd> เริ่ม / พัก / เล่นต่อ<br><kbd>Esc</kbd> พักเกม</p></aside>
   <section class="aim-play-panel" aria-label="สนามฝึกเล็ง"><div class="aim-scoreboard"><div><span>คะแนน</span><strong id="aimScore">0</strong></div><div><span>ความแม่นยำ</span><strong id="aimAccuracy">0<small>%</small></strong></div><div><span>คอมโบ</span><strong id="aimCombo">0<small>×</small></strong></div><div class="aim-clock"><span>เวลาเหลือ</span><strong id="aimTime">${seconds}<small>วิ</small></strong></div></div>
   <div id="aimArena" class="aim-arena" onpointerdown="AimGame.shoot(event)" aria-label="คลิกเป้าสีชมพูในสนาม"><div class="aim-arena-grid" aria-hidden="true"></div><span class="aim-corner aim-corner-tl"></span><span class="aim-corner aim-corner-br"></span><span class="aim-arena-label">${modes[mode].short.toUpperCase()} / ${levels[level].label}</span><div id="aimTargets" class="aim-targets"></div><div id="aimFeedback" class="aim-feedback" aria-hidden="true"></div><div id="aimOverlay" class="aim-overlay"></div></div>
   <footer class="aim-play-footer"><span id="aimHint">คลิกหรือแตะที่เป้า · จุดนอกเป้านับเป็นพลาด</span><div><button id="aimPause" onclick="AimGame.pause()" disabled>พักเกม</button><button id="aimStart" class="aim-primary" onclick="AimGame.start()">เริ่มเล่น ${seconds} วิ ${symbol}</button></div></footer>
   <div class="aim-round-details"><span>โดน <b id="aimHits">0</b> เป้า</span><span>พลาด <b id="aimMisses">0</b> ครั้ง</span><span>เวลาเล็งเฉลี่ย <b id="aimReaction">—</b></span><span id="aimStorageWarning" role="status"></span></div></section></div>
   <p id="aimAnnouncement" class="aim-sr-only" aria-live="polite"></p><p class="aim-footnote">${heart} เล่นนิดเดียวก็เก่งขึ้นได้แล้ว พักสายตาด้วยนะคนเก่ง</p></div>`;
  paintTargets();update();overlay();
 }
 function configure(name,value){
  if(active())return;
  if(name==='mode'&&Object.hasOwn(modes,value))mode=value;
  else if(name==='level'&&Object.hasOwn(levels,value))level=value;
  else if(name==='seconds'&&[30,60].includes(value))seconds=value;
  else return;
  phase='ready';targets=[];hits=misses=combo=maxCombo=score=0;reactions=[];render();
 }
 function start(){
  if(currentView!=='game'||active()||$('modal').open)return;
  stopTimer();hits=misses=combo=maxCombo=score=0;reactions=[];targets=[];lastPosition=null;feedback='';
  phase='countdown';countdownUntil=now()+3000;paintTargets();update();overlay();announce('เตรียมตัว เริ่มใน 3 วินาที');schedule();
 }
 function announce(text){const el=$('aimAnnouncement');if(el)el.textContent=text}
 function schedule(){stopTimer();if(phase==='playing'||phase==='countdown')timer=setTimeout(tick,40)}
 function tick(){
  timer=undefined;if(currentView!=='game')return pause();
  const t=now();
  if(phase==='countdown'){
   if(t>=countdownUntil){phase='playing';endsAt=t+seconds*1000;nextSpawnAt=t;spawn(t);overlay();announce('เริ่มได้เลย')}
   else overlay();
  }
  if(phase==='playing'){
   if(t>=endsAt)return finish();
   if(mode==='reflex'){
    if(targets.length&&t>=targets[0].expires){misses++;combo=0;targets=[];nextSpawnAt=t+gap();feedback='ช้าไปนิด ลองอีกที';feedbackUntil=t+550;paintTargets()}
    if(!targets.length&&t>=nextSpawnAt)spawn(t);
   }
   if(t>=feedbackUntil)feedback='';
   update(t);
  }
  schedule();
 }
 function gap(){return 350+Math.random()*500}
 function size(){return levels[level].size}
 function position(){
  const rect=$('aimArena').getBoundingClientRect(),w=Math.max(180,rect.width),h=Math.max(180,rect.height),margin=size()/2+16;
  let best=null,bestDistance=-1;
  for(let i=0;i<40;i++){
   const point={x:(margin+Math.random()*(w-margin*2))/w*100,y:(margin+24+Math.random()*(h-margin*2-24))/h*100};
   const avoid=[...targets,...(lastPosition?[lastPosition]:[])];
   const distance=avoid.length?Math.min(...avoid.map(p=>Math.hypot((p.x-point.x)*w/100,(p.y-point.y)*h/100))):Infinity;
   if(distance>bestDistance){best=point;bestDistance=distance}
   if(distance>size()*1.55)break;
  }
  return best;
 }
 function spawn(t){
  const count=mode==='grid'?3:1;
  while(targets.length<count){const p=position();targets.push({...p,id:++serial,born:t,expires:t+levels[level].life})}
  paintTargets();
 }
 function paintTargets(){
  const host=$('aimTargets');if(!host)return;
  host.innerHTML=targets.map(t=>`<button class="aim-target" data-aim-id="${t.id}" aria-label="เป้าหมาย ${t.id}" style="left:${t.x}%;top:${t.y}%;--target-size:${size()}px" onclick="if(event.detail===0)AimGame.keyboardHit(${t.id})"><span class="aim-target-life"></span><span class="aim-target-center">${heart}</span></button>`).join('');
 }
 function shoot(event){
  if(phase!=='playing'||currentView!=='game'||event.isPrimary===false||event.button!==undefined&&event.button!==0||$('modal').open)return;
  if(now()>=endsAt)return finish();
  if(event.target?.closest?.('button:not(.aim-target),.aim-overlay'))return;
  event.preventDefault();
  const el=event.target?.closest?.('[data-aim-id]');
  attempt(el?Number(el.dataset.aimId):null);
 }
 function keyboardHit(id){if(phase==='playing'&&currentView==='game'&&!$('modal').open)attempt(id)}
 function attempt(id){
  const t=now();if(t>=endsAt)return finish();
  const target=targets.find(v=>v.id===id);
  if(target&&mode==='reflex'&&t>=target.expires){stopTimer();tick();return}
  if(id!==null&&!target)return; // A removed target cannot score twice.
  if(!target){misses++;combo=0;feedback='อีกนิดเดียว';feedbackUntil=t+400;tone(false);update(t);return}
  const reaction=Math.max(1,Math.round(t-target.born));reactions.push(reaction);hits++;combo++;maxCombo=Math.max(maxCombo,combo);
  const earned=100+Math.min(combo-1,20)*5+(mode==='reflex'?Math.max(0,Math.round((levels[level].life-reaction)/20)):0);
  score+=earned;lastPosition={x:target.x,y:target.y};targets=targets.filter(v=>v.id!==id);
  feedback='+'+earned;feedbackUntil=t+450;tone(true);
  if(mode==='grid')spawn(t);else{nextSpawnAt=t+gap();paintTargets()}
  update(t);
 }
 function update(t=now()){
  const text=(id,value)=>{const el=$(id);if(el)el.textContent=value};
  text('aimScore',score.toLocaleString('en-US'));text('aimAccuracy',accuracy()+'%');text('aimCombo',combo+'×');
  text('aimTime',Math.ceil(remaining(t))+' วิ');text('aimHits',hits);text('aimMisses',misses);text('aimReaction',average()===null?'—':average()+' ms');
  text('aimBest',(bests[key()]||0).toLocaleString('en-US'));text('aimFeedback',feedback);
  text('aimStorageWarning',storageWarning?'ยังบันทึกสถิติในเครื่องไม่ได้':'');
  const arena=$('aimArena');if(arena)arena.dataset.phase=phase;
  const start=$('aimStart'),pauseButton=$('aimPause');
  if(start){start.disabled=phase==='playing'||phase==='countdown';start.textContent=phase==='paused'?'เล่นต่อ':phase==='finished'?'เล่นอีกรอบ':'เริ่มเล่น '+seconds+' วิ';start.setAttribute('onclick',phase==='paused'?'AimGame.resume()':'AimGame.start()')}
  if(pauseButton)pauseButton.disabled=phase!=='playing'&&phase!=='countdown';
  if(typeof document.querySelectorAll==='function')document.querySelectorAll('#gameView [data-aim-setting]').forEach(el=>{el.disabled=active()});
  if(mode==='reflex'&&targets.length){const ring=$('aimTargets')?.querySelector('.aim-target-life');if(ring)ring.style.setProperty('--life',Math.max(0,(targets[0].expires-t)/levels[level].life))}
  text('aimHint',phase==='playing'&&mode==='reflex'&&!targets.length?'รอเป้าโผล่…':phase==='paused'?'พักแล้ว เวลาจะหยุดจนกดเล่นต่อ':'คลิกหรือแตะที่เป้า · จุดนอกเป้านับเป็นพลาด');
 }
 function overlay(){
  const el=$('aimOverlay');if(!el)return;
  el.classList.toggle('hidden',phase==='playing');
  if(phase==='playing'){el.innerHTML='';return}
  if(phase==='countdown'){el.innerHTML='<div class="aim-countdown"><span>หายใจเข้า… เตรียมเล็ง</span><strong>'+Math.max(1,Math.ceil((countdownUntil-now())/1000))+'</strong><small>พร้อมแล้วคนเก่ง</small></div>';return}
  if(phase==='paused'){el.innerHTML=`<div class="aim-overlay-content"><span class="aim-overlay-icon">${symbol}</span><h2>พักไว้ตรงนี้ก่อน</h2><p>เวลาไม่เดิน คอมโบยังอยู่</p><button class="aim-primary" onclick="AimGame.resume()">เล่นต่อ</button><button class="aim-quiet" onclick="AimGame.quit()">กลับไปเลือกสนาม</button></div>`;return}
  if(phase==='finished'){
   el.innerHTML=`<div class="aim-overlay-content aim-result"><span class="aim-result-tag">${score>0&&score===bests[key()]?'สถิติที่ดีที่สุดของสนามนี้':'จบรอบแล้ว คนเก่ง!'}</span><h2>${score.toLocaleString('en-US')} <small>คะแนน</small></h2><div class="aim-result-stats"><span>แม่นยำ<b>${accuracy()}%</b></span><span>เล็งเฉลี่ย<b>${average()===null?'—':average()+' ms'}</b></span><span>คอมโบสูงสุด<b>${maxCombo}×</b></span></div><p>${hits?'อีกสักรอบไหม? ค่อย ๆ เล็งให้แม่นแล้วความไวจะตามมา':'ลองคลิกเป้าสีชมพู แล้วเริ่มสนุกกันอีกรอบ'}</p><button class="aim-primary" onclick="AimGame.start()">เล่นอีกรอบ ${symbol}</button></div>`;return;
  }
  el.innerHTML=`<div class="aim-overlay-content"><span class="aim-overlay-icon">${symbol}</span><span class="aim-ready-tag">YOUR LITTLE TRAINING GROUND</span><h2>เล็งให้โดน ยิ้มให้ด้วย</h2><p>${modes[mode].description}<br>เล่นได้ทั้งเมาส์และหน้าจอสัมผัส</p><button class="aim-primary" onclick="AimGame.start()">เริ่มเล่น ${seconds} วินาที ${symbol}</button><small>นับถอยหลัง 3 วินาที แล้วเริ่มได้เลย</small></div>`;
 }
 function pause(){
  if(phase!=='playing'&&phase!=='countdown')return;
  if(phase==='playing'&&now()>=endsAt)return finish();
  pausedAt=now();previousPhase=phase;phase='paused';stopTimer();feedback='';update();overlay();announce('พักเกมแล้ว');
 }
 function resume(){
  if(phase!=='paused'||currentView!=='game'||document.hidden||$('modal').open)return;
  const elapsed=now()-pausedAt;endsAt+=elapsed;countdownUntil+=elapsed;nextSpawnAt+=elapsed;
  for(const t of targets){t.born+=elapsed;t.expires+=elapsed}
  phase=previousPhase;update();overlay();announce('เล่นต่อ');schedule();
 }
 function finish(){
  if(phase!=='playing')return;
  stopTimer();phase='finished';targets=[];feedback='';
  if(score>(bests[key()]||0)){
   bests[key()]=score;
   try{localStorage.setItem(STORE,JSON.stringify(bests));storageWarning=false}catch{storageWarning=true}
  }
  paintTargets();update();overlay();announce('จบรอบ ได้ '+score+' คะแนน ความแม่นยำ '+accuracy()+' เปอร์เซ็นต์');
 }
 function quit(){if(phase!=='paused')return;stopTimer();phase='ready';targets=[];render()}
 function toggleSound(){sound=!sound;const b=$('aimSound');if(b){b.setAttribute('aria-pressed',String(sound));b.innerHTML=(sound?'เสียง: เปิด':'เสียง: ปิด')+'<span>♪</span>'}if(sound)tone(true)}
 function tone(hit){
  if(!sound)return;
  try{
   const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return;
   if(!audio)audio=new Audio();if(audio.state==='suspended')audio.resume().catch(()=>{});
   const osc=audio.createOscillator(),gain=audio.createGain();osc.type='sine';osc.frequency.value=hit?660:210;
   gain.gain.setValueAtTime(.035,audio.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audio.currentTime+.075);
   osc.connect(gain);gain.connect(audio.destination);osc.start();osc.stop(audio.currentTime+.08);
  }catch{}
 }
 window.addEventListener('blur',pause);
 window.addEventListener('pagehide',pause);
 document.addEventListener('visibilitychange',()=>{if(document.hidden)pause()});
 window.addEventListener('keydown',e=>{
  if(currentView!=='game'||e.defaultPrevented||e.repeat||e.isComposing||e.ctrlKey||e.altKey||e.metaKey||$('modal').open)return;
  if(e.key==='Escape'){e.preventDefault();pause();return}
  if(e.target?.closest?.('input,textarea,select,button,[contenteditable]'))return;
  if(e.code==='Space'||e.key===' '){e.preventDefault();if(phase==='paused')resume();else if(active())pause();else start()}
 });
 return {render,configure,start,pause,resume,quit,shoot,keyboardHit,toggleSound,suspend:pause};
})();
