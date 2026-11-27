import {family,dateAt,newId,verifyParentPin} from './store.js';
import {clearParentAccess,demoTimerKey} from './zip-records.js';
import {topics,demoLogKey,demoStateKey,readDemo,completedDemoSessions} from './demo-topics.js';
import {mountChildUI} from './child-ui.js';
import {decorateSheet} from './vendor/interaction.js';
import {waveAffinity} from './affinity.js';
import {autoUnlock} from './autofill.js';
import {mountGoalPicker} from './goal-picker.js';

const $=id=>document.getElementById(id);
const demo=new URLSearchParams(location.search).get('mode')==='demo';
const demoPrefs='tetemaru.demo.child-prefs';
const subjects=[['算数','さんすう'],['国語','こくご'],['英語','えいご'],['理科','りか'],['社会','しゃかい'],['そのほか','そのほか']];
// 5〜60ぷん(5ぷんきざみ)。前から使っている値(5分だけ・10分だけ など)はそのまま残す
const goals=[['5分だけ','5ふん',5],['10分だけ','10ぷん',10],['15分','15ふん',15],['20分','20ぷん',20],['25分','25ふん',25],['30分','30ぷん',30],
 ['35分','35ふん',35],['40分','40ぷん',40],['45分','45ふん',45],['50分','50ぷん',50],['55分','55ふん',55],['60分','60ぷん',60]];
const goalMinutes=new Map(goals.map(([key,,minutes])=>[key,minutes]));
const text=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icon=name=>'<span data-icon="'+name+'" aria-hidden="true"></span>';
const closeButton='<button type="button" class="flow-secondary" data-close>もどる</button>';
const dialog=$('flow'),body=$('flowContent'),overlay=$('lockOverlay');
let profile,prefs,ui,channel,busy=false,pendingRefresh=false;
let lastAffinity=null;
let syncGoal=()=>{};

async function ensureAffinityStart(){
 if(!profile.childPrefs?.affinityStartDay&&(demo||profile.paired)){
  await load(v=>{
   if(!demo&&!v.paired)return false;
   const child=v.childPrefs??={};
   child.affinityStartDay??=dateAt();
  });
 }
}

function updateAffinity(){
 const child=profile.childPrefs||{},today=dateAt();
 const seed=Number(child.affinity??15);
 const studyDays=profile.history.map(row=>row.affinityDay).filter(Boolean);
 const value=waveAffinity(Number.isFinite(seed)?seed:15,child.affinityStartDay||today,studyDays,today);
 if(lastAffinity===value)return;
 const gained=lastAffinity!==null&&value>lastAffinity;
 ui.renderAffinity(value,lastAffinity!==null);
 if(gained&&studyDays.includes(today))ui.celebrateStudy();
 lastAffinity=value;
}

function loadedDemo(){
 const active=readDemo(demoTimerKey),quiz=readDemo(demoStateKey);
 return {name:'ゆい',nick:'ゆい',paired:true,active:active.id?active:null,quiz:quiz.id?quiz:null,
  history:completedDemoSessions(),childPrefs:readDemo(demoPrefs),preferences:readDemo('tetemaru.demo.parent-prefs')};
}

// Serialize demo read/modify/write across tabs when browser locks are available.
// The family store already runs its changes inside an IndexedDB transaction.
async function load(change){
 if(!demo){profile=await family(change);if(change)channel?.postMessage('refresh');return}
 const update=()=>{
  const value=loadedDemo();
  if(change){
   // Commit completed records before removing a run. Retrying a partially
   // failed save uses the same run ID and cannot append the record twice.
   const fields={history:demoLogKey,active:demoTimerKey,quiz:demoStateKey,childPrefs:demoPrefs};
   const before=Object.fromEntries(Object.keys(fields).map(k=>[k,JSON.stringify(value[k])]));
   if(change(value)!==false){
    for(const [k,key] of Object.entries(fields)){
     const next=JSON.stringify(value[k]);
     if(next===before[k])continue;
     if(value[k]===null)localStorage.removeItem(key);else localStorage.setItem(key,next);
    }
   }
  }
  profile=value;
 };
 if(change&&navigator.locks)await navigator.locks.request('tetemaru.demo.study',update);else update();
}
function transact(fn){
 return async(...args)=>{
  if(busy)return;
  busy=true;
  try{await fn(...args)}catch{
   const msg='ほぞんできなかったよ。もういちど ためしてね。';
   if(dialog.open&&$('sheetError'))$('sheetError').textContent=msg;else ui?.setSpeech(msg,{voice:false,keep:true});
  }finally{busy=false;if(pendingRefresh)await refresh()}
 };
}
function openSheet(name,title,html){
 const opening=!dialog.open;
 body.dataset.sheet=name;
 body.innerHTML='<h2 id="sheetTitle" tabindex="-1">'+text(title)+'</h2>'+html+'<p id="sheetError" role="alert"></p>';
 if(opening)dialog.showModal();
 const focus=body.querySelector('input')||body.querySelector('[data-reply]')||$('sheetTitle');
 focus.focus({preventScroll:true});dialog.scrollTop=0;
 decorateSheet(body,name,opening);
}
function closeSheet(){if(dialog.open)dialog.close()}
function formSubmit(fn){
 body.querySelector('form').onsubmit=e=>{
  e.preventDefault();
  const form=e.currentTarget;
  transact(()=>fn(new FormData(form)))();
 };
}
function preferredGoal(subject){
 const saved=prefs.goalsBySubject?.[subject];
 return goalMinutes.has(saved)?saved:(subject==='英語'?'20分':'10分だけ');
}
// 勉強モードは「なんぷん」を 5ふんに よせてから はじめ、FAST_SPEED 倍で すすめて 5ふんで 自動で おわる
const FAST_GOAL='5分だけ',FAST_SECONDS=7,FAST_SPEED=5*60/FAST_SECONDS; // 5ふんを 7びょうで
let fastFinishing=null;
// パスワードで おわる シートを ひらいているあいだは タイマーを 止める(hold.at の時点で 固定)
let hold=null;
function elapsed(run,now=Date.now()){
 if(hold&&hold.id===run.id)now=Math.min(now,hold.at);
 return (run.ms||0)+(run.status==='active'&&Number.isFinite(run.since)?Math.max(0,now-run.since)*(run.fast?FAST_SPEED:1):0);
}
function progress(){
 const run=profile?.active;
 if(!run)return;
 const seconds=Math.floor(elapsed(run)/1000);
 $('timer').textContent=[Math.floor(seconds/60),seconds%60].map(n=>String(n).padStart(2,'0')).join(':');
 const minutes=goalMinutes.get(run.goal);
 $('lockProgressFill').parentElement.hidden=!minutes;
 if(minutes)$('lockProgressFill').style.width=Math.min(100,seconds/(minutes*60)*100)+'%';
 if(run.fast&&minutes&&seconds>=minutes*60&&!fastFinishing)fastFinishing=transact(()=>finishFast(run.id))().finally(()=>{fastFinishing=null});
}
// 勉強が おわったら、画面いっぱいの ほめる がめんに きりかえる
const praiseLines=['ててまるも うれしいよ。','つぎも いっしょに がんばろうね。','すごい しゅうちゅう りょく だったね！','きょうの きみは キラキラ してるよ。'];
function showPraise(run){
 const over=$('praiseOverlay');
 const kana=new Map(subjects).get(run.subject)||run.subject||'';
 const sec=Math.round((run.ms||0)/1000);
 $('praiseSubject').textContent=kana;$('praiseSubject').hidden=!kana;
 const [num,unit]=sec>=60?[Math.floor(sec/60),'ふん']:[sec,'びょう'];
 $('praiseMinutes').textContent=num;over.querySelector('.praise-time small').textContent=unit;
 $('praiseTitle').textContent=(profile.nick?profile.nick+'、':'')+'よく がんばったね！';
 $('praiseMsg').textContent=praiseLines[Math.floor(Math.random()*praiseLines.length)];
 over.hidden=false;
 for(const selector of ['main','.tabbar','.child-topbar'])document.querySelector(selector).inert=true;
 setTimeout(()=>$('praisePal').playMotion?.('happy'),700);
 setTimeout(()=>{if(!over.hidden)$('praisePal').playMotion?.('happy')},2600);
 $('praiseClose').focus({preventScroll:true});
 ui.setSpeech($('praiseTitle').textContent+' '+$('praiseMsg').textContent);
}
function closePraise(){
 $('praiseOverlay').hidden=true;
 paint();ui.setSpeech('がんばった じかんを きろく したよ。',{voice:false});
}
async function finishFast(id){
 let done=null;
 await load(v=>{
  const run=v.active;if(run?.id!==id)return false;
  const now=Date.now();stopTime(run,now);run.ms=Math.min(run.ms,(goalMinutes.get(run.goal)||5)*60000);
  run.status='completed';run.endedAt=now;
  if(run.ms>=60000)run.affinityDay=dateAt(new Date(now));
  if(!v.history.some(s=>s.id===id))v.history.push(run);
  v.active=null;done={...run};
 });
 paint();if(done)showPraise(done);
}
function paint(){
 updateAffinity();
 const run=profile.active,locked=Boolean(run);
 overlay.classList.toggle('hidden',!locked);
 if(!locked){overlay.classList.remove('is-resting');$('lockPal').dataset.resting='false'}
 for(const selector of ['main','.tabbar','.child-topbar'])document.querySelector(selector).inert=locked;
 const ready=profile.paired&&profile.name&&profile.nick;
 $('subject').disabled=$('goal').disabled=!ready||locked;
 $('startBtn').disabled=false;$('quizBtn').disabled=!ready||locked;
 $('startLabel').textContent='勉強モード（タイマー）';
 $('nameBadge').hidden=demo||!ready;
 if(ready){$('nameBadgeText').textContent=profile.nick;$('nameBadgeInitial').textContent=[...profile.nick][0]||'?'}
 const count=profile.history.filter(s=>s.date===dateAt()).length;
 const tile=document.querySelector('.sat-tr');
 tile.querySelector('.sat-value').textContent=count+'かい';
 tile.setAttribute('aria-label','きょうの がくしゅう '+count+'かい');
 if(locked){
  $('subject').value=run.subject;
  if(goalMinutes.has(run.goal))$('goal').value=run.goal;
  $('lockGoalLabel').textContent=[run.subject,run.goal].filter(Boolean).join(' ／ ');
  const paused=run.status==='paused';
  document.querySelector('.lock-title').textContent=paused?'きゅうけいちゅう':'勉強モード';
  document.querySelector('.lock-sub').textContent=paused?'ててまるも すやすや ひとやすみ。':'べんきょうした じかんを はかっています。';
  $('pauseLabel').textContent=paused?'べんきょうに もどる':'きゅうけい する';
  overlay.classList.toggle('is-resting',paused);
  $('lockPal').dataset.resting=String(paused);
  progress();
 }
 ui.setGreeting(profile.nick+'、きょうは なにを やってみる？');
 syncGoal();
}
// よびかたは専用のシート(child.html の #nameSheet)で変える
const suffixes=['ちゃん','くん','さん'];
const splitName=n=>{const s=suffixes.find(x=>n.endsWith(x)&&n.length>x.length);return s?[n.slice(0,-s.length),s]:[n,'']};
function nameSync(){
 const nick=$('nameInput').value.trim(),[,suffix]=splitName(nick);
 $('namePreview').textContent=nick||'……';
 for(const chip of document.querySelectorAll('.name-chip'))chip.setAttribute('aria-pressed',String(Boolean(nick)&&chip.dataset.suffix===suffix));
 $('nameError').textContent='';
}
function nickname(){
 const sheet=$('nameSheet');
 if(profile.active||!sheet.hidden)return;
 $('nameInput').value=profile.nick||'';nameSync();
 sheet.hidden=false;
 requestAnimationFrame(()=>{sheet.classList.add('open');$('nameInput').focus({preventScroll:true})});
}
function closeName(){
 const sheet=$('nameSheet');
 sheet.classList.remove('open');
 setTimeout(()=>{sheet.hidden=true},220);
 $('nameBadge').focus({preventScroll:true});
}
function setupName(){
 $('nameBadge').onclick=nickname;
 $('nameInput').oninput=nameSync;
 for(const chip of document.querySelectorAll('.name-chip'))chip.onclick=()=>{
  const [base]=splitName($('nameInput').value.trim());
  if(!base){$('nameError').textContent='さきに なまえを いれてね。';$('nameInput').focus();return}
  $('nameInput').value=base+chip.dataset.suffix;nameSync();
 };
 $('nameSheet').querySelectorAll('[data-close]').forEach(el=>el.onclick=closeName);
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('nameSheet').hidden)closeName()});
 $('nameForm').onsubmit=transact(async e=>{
  e.preventDefault();
  const nick=$('nameInput').value.trim();
  if(!nick){$('nameError').textContent='なまえを いれてね。';$('nameInput').focus();return}
  await load(v=>{if(v.paired&&v.name)v.nick=nick});
  closeName();paint();
  ui?.setSpeech(nick+'、よろしくね！');
 });
}
function startRecord(kind,subject,goal,material=''){
 const now=Date.now();
 return {id:newId(),kind,date:dateAt(),startedAt:now,since:now,subject,goal,material,status:'active',ms:0,
  breaks:[],questions:[],done:'',insight:'',next:''};
}
function stopTime(run,now){
 run.ms=elapsed(run,now);
 if(run.status==='paused'){
  const rest=run.breaks?.at(-1);if(rest&&!rest.endedAt)rest.endedAt=now;
 }
 run.since=null;
}
async function start(){
 await load();
 if(profile.active){paint();return}
 await syncGoal.slideTo?.(FAST_GOAL);
 await load(v=>{
  if(v.active||!v.paired||!v.nick||(!demo&&!v.pin))return false;
  if(v.quiz?.started){
   v.quiz.ms=quizElapsed(v.quiz);v.quiz.started=false;v.quiz.paused=false;
   const br=v.quiz.breaks?.at(-1);if(br&&!br.endedAt)br.endedAt=Date.now();
  }
  v.active={...startRecord('timer',$('subject').value,FAST_GOAL),fast:true};
 });
 closeSheet();paint();
}
async function pauseTimer(){
 const id=profile.active?.id;
 await load(v=>{
  const run=v.active;if(!id||run?.id!==id)return false;
  const now=Date.now(),paused=run.status==='paused';
  stopTime(run,now);
  if(paused){run.status='active';run.since=now}
  else{run.status='paused';(run.breaks??=[]).push({startedAt:now,endedAt:null})}
 });
 paint();
}
async function unlock(){
 await load();const id=profile.active?.id;
 if(!id){closeSheet();paint();return}
 const field=demo?'':' inputmode="numeric" pattern="[0-9]{4}" maxlength="4"';
 const help='<p>おうちのひとの パスワードが じどうで はいるよ。</p>';
 openSheet('unlock','タイマーを おわる',help+'<form><label>パスワード<input type="password" name="code" autocomplete="off" required'+field+'></label><button type="submit" class="flow-primary">解除して記録する</button>'+closeButton+'</form>');
 if(!hold){
  hold={id,at:Date.now()};
  // 記録せずに とじたら、止めていた あいだの 分だけ はじまりを ずらして 続きから はかる
  dialog.addEventListener('close',async()=>{
   const held=hold;if(!held)return;
   const gap=Date.now()-held.at;
   try{await load(v=>{const run=v.active;if(run?.id!==held.id||run.status!=='active'||!Number.isFinite(run.since))return false;run.since+=gap})}
   finally{if(hold===held)hold=null}
  },{once:true});
 }
 formSubmit(async data=>{
  const code=String(data.get('code')??'');
  if(!code.length)return;
  await load();const pin=profile.pin;
  if(profile.active?.id!==id){closeSheet();paint();return}
  if(!demo&&(!pin||!await verifyParentPin(code,pin))){
   $('sheetError').textContent='パスワードを確認してください。';return;
  }
  let done=null;
  await load(v=>{
   const run=v.active;if(run?.id!==id||(!demo&&v.pin!==pin))return false;
   const now=Date.now();stopTime(run,now);run.status='completed';run.endedAt=now;
   if(run.ms>=60000)run.affinityDay=dateAt(new Date(now));
   if(!v.history.some(s=>s.id===id))v.history.push(run);
   v.active=null;done={...run};
  });
  if(profile.active?.id!==id)hold=null;
  if(profile.active?.id===id){$('sheetError').textContent='パスワードが変更されました。もう一度入力してください。';return}
  closeSheet();paint();if(done)showPraise(done);
 });
 autoUnlock(body.querySelector('form'));
}
function quizElapsed(q){
 return (q.ms||0)+(q.started&&!q.paused?Math.max(0,Date.now()-q.since):0);
}
function quizButton(key,label,primary=false,iconName=''){
 return '<button type="button" class="flow-'+(primary?'primary':'secondary')+'" data-demo="'+key+'">'+(iconName?icon(iconName):'')+text(label)+'</button>';
}
function replyBubble(message){
 return '<div class="chat-reply" data-reply tabindex="-1" role="status"><img src="./friend-front.png" alt="ててまる" width="40" height="40"><p>'+text(message)+'</p></div>';
}
async function pickTopic(){
 await load();if(profile.active){closeSheet();paint();return}
 if(!profile.paired||!profile.nick)return;
 const subject=$('subject').value;
 const existing=profile.quiz;
 const topic=topics.find(t=>t.id===existing?.topicId);
 const resume=existing&&existing.step!=='done'&&topic?.subject===subject?quizButton('continue','「'+topic.title+'」のつづき',true):'';
 const choices=topics.filter(t=>t.subject===subject).map(t=>'<button type="button" class="flow-secondary" data-topic="'+text(t.id)+'">'+text(t.title)+'</button>').join('');
 openSheet('topics','どの もんだいに する？','<p>'+text(subject)+' ／ 問題モード</p>'+resume+choices+closeButton);
}
async function beginTopic(id){
 const topic=topics.find(t=>t.id===id&&t.subject===$('subject').value);
 if(!topic)return;
 await load(v=>{
  if(v.active||!v.paired||!v.nick)return false;
  v.quiz={...startRecord('quiz',topic.subject,'まず1問',topic.title),topicId:id,step:'problem',seenHints:0,hint:0,started:true,paused:false};
 });
 if(profile.active){closeSheet();paint();return}
 if(profile.quiz?.topicId===id)showQuestion();
}
function showQuestion(){
 const q=profile.quiz,topic=topics.find(t=>t.id===q?.topicId);
 if(!topic){closeSheet();return}
 let title=topic.title,html='';
 if(q.paused){
  title='ちょっと ひとやすみ。';html=replyBubble(q.hugged?'ぎゅーっ。あったかいね！':'いっしょに のびを しよう。')+quizButton('hug','ててまるを ハグする')+quizButton('resume','もんだいに もどる',true,'play');
 }else if(q.step==='done'){
  title=profile.nick+'、できたね！';html=replyBubble(topic.explanation)+quizButton('choose','ほかの もんだいを えらぶ',true);
 }else{
  html='<p class="chat-problem">'+text(topic.prompt)+'</p><div class="chat-child"><span>'+text(profile.nick)+'</span><p>'+text(topic.question)+'</p></div>';
  if(q.step==='answer')html+=replyBubble(q.feedback||'こたえを えらんでみよう。')+'<div class="chat-choices">'+topic.options.map((o,i)=>quizButton('option-'+i,o)).join('')+'</div>'+quizButton('ask','ヒントをみる',false,'lightbulb');
  else if(q.step==='hint')html+=replyBubble(topic.hints[q.hint])+quizButton(q.hint?'ask':'hint',q.hint?'まえのヒント':'つぎのヒント',false,'lightbulb')+quizButton('answer','こたえてみる',true,'send');
  else html+=quizButton('ask','ててまるに きいてみる',true,'message-circle')+quizButton('answer','こたえてみる',false,'send');
  html+=quizButton('pause','ちょっと やすむ',false,'pause')+quizButton('choose','もんだいを えらびなおす');
 }
 html+='<div class="chat-footer"><a href="parent.html'+(demo?'?mode=demo':'')+'">保護者の記録を見る</a>'+closeButton+'</div>';
 openSheet('quiz',title,html);
}
async function quizAction(key){
 const id=profile.quiz?.id;
 if(!id)return;
 await load(v=>{
  const q=v.quiz,topic=topics.find(t=>t.id===q?.topicId);
  if(v.active||!topic||q.id!==id)return false;
  const now=Date.now();
  if(['choose','leave'].includes(key)){
   q.ms=quizElapsed(q);q.started=false;q.paused=false;const br=q.breaks?.at(-1);if(br&&!br.endedAt)br.endedAt=now;
  }else if(key==='continue'&&q.step!=='done'){
   if(!q.started||q.paused){q.since=now;q.started=true;q.paused=false;const br=q.breaks?.at(-1);if(br&&!br.endedAt)br.endedAt=now}
  }else if(!q.started)return false;
  else if(key==='pause'&&!q.paused){q.ms=quizElapsed(q);q.paused=true;q.hugged=false;q.breaks.push({startedAt:now,endedAt:null})}
  else if(key==='resume'&&q.paused){q.paused=false;q.since=now;const br=q.breaks.at(-1);if(br)br.endedAt=now}
  else if(key==='hug')q.hugged=true;
  else if(key==='hint'||key==='ask'){q.step='hint';q.hint=key==='hint'?1:0;q.seenHints=Math.max(q.seenHints||0,q.hint+1)}
  else if(key==='answer'){q.step='answer';q.feedback=''}
  else if(key.startsWith('option-')&&q.step==='answer'){
   if(Number(key.slice(7))!==topic.answer)q.feedback='おしい！ もういちど 考えてみよう。';
   else{
    q.ms=quizElapsed(q);q.started=false;q.step='done';
    if(!v.history.some(s=>s.id===q.id))v.history.push({id:q.id,kind:'quiz',date:dateAt(),affinityDay:dateAt(new Date(now)),startedAt:q.startedAt,endedAt:now,
     status:'completed',subject:topic.subject,material:topic.title,goal:'まず1問',ms:q.ms,breaks:q.breaks,
     questions:[{text:topic.question,hints:topic.hints.slice(0,q.seenHints)}],done:topic.options[topic.answer],insight:topic.explanation,next:''});
   }
  }
 });
 if(profile.active||profile.quiz?.id!==id){closeSheet();paint();return}
 if(key==='choose'||key==='leave'){closeSheet();paint();return}
 if(key==='hug')$('mainPal').playMotion?.('hug');
 if(profile.quiz.step==='done')$('mainPal').playMotion?.('happy');
 showQuestion();paint();
}
async function refresh(){
 if(document.hidden)return;
 if(busy){pendingRefresh=true;return}
 pendingRefresh=false;
 const old=profile.active?.id,quizId=profile.quiz?.id;
 await load();
 await ensureAffinityStart();
 if(profile.active?.id!==old||quizId!==profile.quiz?.id)closeSheet();
 paint();
}
async function init(){
 if(demo){
  for(const link of document.querySelectorAll('.child-topbar a,.child-tab')){const url=new URL(link.href);url.searchParams.set('mode','demo');link.href=url.href}
  $('demoLabel').hidden=false;
 }else clearParentAccess();
 await load();
 await ensureAffinityStart();
 if(profile.active&&profile.active.status==='active'&&!Number.isFinite(profile.active.since)){
  // Older foreground-only timers already stored accrued milliseconds. Start the
  // wall clock at migration so time closed under the old app is not added.
  await load(v=>{if(v.active?.status==='active'&&!Number.isFinite(v.active.since))v.active.since=Date.now()});
 }
 prefs={...profile.childPrefs,sleep:profile.preferences?.sleep===false?'off':'on'};
 ui=mountChildUI(prefs,(key,value)=>{load(v=>{(v.childPrefs??={})[key]=value}).catch(()=>{})});
 subjects.forEach(([v,l])=>$('subject').add(new Option(l,v)));
 goals.forEach(([v,l])=>$('goal').add(new Option(l,v)));
 const prior=profile.history.filter(row=>row.kind!=='quiz').at(-1);
 const subject=prefs.subject||prior?.subject||'算数';
 if(!prefs.goalsBySubject){
  prefs.goalsBySubject={};
  const legacyGoal=prefs.goal||(prior?.subject===subject?prior.goal:null);
  if(goalMinutes.has(legacyGoal)&&!(subject==='英語'&&legacyGoal==='10分だけ'))prefs.goalsBySubject[subject]=legacyGoal;
 }
 $('subject').value=profile.active?.subject||subject;
 $('goal').value=preferredGoal($('subject').value);
 syncGoal=mountGoalPicker($('subject'),$('goal'),$('goalPicker'));
 async function saveChoice(explicitGoal){
  const selected=$('subject').value;
  if(!explicitGoal)$('goal').value=preferredGoal(selected);
  const goal=$('goal').value;
  if(explicitGoal)prefs.goalsBySubject[selected]=goal;
  await load(v=>{
   const child=v.childPrefs??={};child.subject=selected;child.goal=goal;
   child.goalsBySubject??={...prefs.goalsBySubject};
   if(explicitGoal)child.goalsBySubject[selected]=goal;
  });
 }
 $('subject').onchange=()=>saveChoice(false);$('goal').onchange=()=>saveChoice(true);
 $('startBtn').onclick=transact(start);$('quizBtn').onclick=transact(pickTopic);
 setupName();
 $('praiseClose').onclick=closePraise;$('pauseBtn').onclick=transact(pauseTimer);$('unlockBtn').onclick=transact(unlock);
 body.onclick=e=>{
  const choice=e.target.closest('[data-topic]'),action=e.target.closest('[data-demo]');
  if(choice)transact(()=>beginTopic(choice.dataset.topic))();
  else if(action)transact(()=>quizAction(action.dataset.demo))();
  else if(e.target.closest('[data-close]')){
   if(body.dataset.sheet==='quiz')transact(()=>quizAction('leave'))();else closeSheet();
  }
 };
 dialog.addEventListener('cancel',e=>{
  if(body.dataset.sheet==='quiz'){e.preventDefault();transact(()=>quizAction('leave'))()}
 });
 paint();
 if(!demo&&profile.paired&&profile.name&&!profile.active&&new URLSearchParams(location.search).get('panel')==='name')nickname();
 if(!profile.active&&profile.quiz?.kind==='quiz'&&profile.quiz.started)showQuestion();
 // はやく すすむ タイマーの 数字が なめらかに かわるよう、毎フレーム更新する
 (function frame(){progress();requestAnimationFrame(frame)})();
 // 画面の描画が止まっている(うらに かくれている など)ときも、おわりの 判定は すすめる
 setInterval(progress,500);
 function refreshAtMidnight(){
  const next=new Date();next.setHours(24,0,0,0);
  setTimeout(()=>{if(!document.hidden)updateAffinity();refreshAtMidnight()},Math.max(1,next.getTime()-Date.now()));
 }
 refreshAtMidnight();
 document.addEventListener('visibilitychange',refresh);
 if(demo)window.addEventListener('storage',refresh);
 else if('BroadcastChannel' in window){
  channel=new BroadcastChannel('tetemaru-study-refresh');
  channel.onmessage=refresh;
  window.addEventListener('pagehide',()=>{channel.close();channel=null},{once:true});
 }
}
window.addEventListener('pageshow',e=>{if(e.persisted){if(!demo)clearParentAccess();location.reload()}});
init().catch(()=>{$('speech').textContent='きろくを ひらけなかったよ。もういちど ひらいてね。';$('childPhone').classList.remove('is-intro')});
