import {family,dateAt,newId} from './store.js';
import {clearParentAccess,demoHints,demoQuestion} from './zip-records.js';
import {mountChildUI} from './child-ui.js';

const $=id=>document.getElementById(id);
const demo=new URLSearchParams(location.search).get('mode')==='demo';
if(demo) document.querySelector('.child-topbar a').href='trial.html?mode=demo';
const demoKey='tetemaru.demo.v1',demoPrefs='tetemaru.demo.child-prefs';
const subjects=[['算数','さんすう'],['国語','こくご'],['英語','えいご'],['理科','りか'],['社会','しゃかい'],['そのほか','そのほか']];
const goals=[['10分だけ','10ぷん'],['5分だけ','5ふん'],['まず1問','まず1もん'],['1ページ','1ページ']];
const text=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const button=(id,label,primary=false)=>'<button type="button" id="'+id+'" class="flow-'+(primary?'primary':'secondary')+'">'+label+'</button>';
const closeButton='<button type="button" class="flow-secondary" data-close>もどる</button>';
const submitButton=label=>'<button class="flow-primary" type="submit">'+label+'</button>';
const labelField=(label,key,value='',required=false)=>'<label>'+label+'<textarea name="'+key+'" maxlength="1000" '+(required?'required':'')+'>'+text(value)+'</textarea></label>';
const dialog=$('flow'),sheetBody=$('flowContent'),overlay=$('lockOverlay');
let f,ui,prefs,state,shown='',busy=false,runId='',tickFrom=0,holdTimer=0,tail=Promise.resolve();
function readDemo(key){try{return JSON.parse(localStorage.getItem(key))||{}}catch{return {}}}
function saveDemo(){localStorage.setItem(demoKey,JSON.stringify(state))}
function fail(){ui?.setSpeech('うまく ほぞんできなかったよ。もういちど ためしてね。',{voice:false,keep:true});if(dialog.open){$('sheetError').textContent='ほぞんできませんでした。もういちど ためしてね。'}}
function change(fn){
 const task=tail.then(async()=>{f=await family(fn)});
 tail=task.catch(fail);
 return task;
}
function changeRun(fn){
 const id=runId;
 return change(v=>v.active?.id===id&&id?fn(v.active,v):false);
}
function openSheet(name,title,body){
 shown=name;
 if(!demo&&runId&&['ask','finish'].includes(name)&&f.active?.sheet!==name)changeRun(s=>{s.sheet=name}).catch(()=>{});
 sheetBody.innerHTML='<h2 id="sheetTitle">'+text(title)+'</h2>'+body+'<p id="sheetError" role="alert"></p>';
 if(!dialog.open)dialog.showModal();
}
function closeSheet(){if(dialog.open)dialog.close();shown=''}
function modalSubmit(fn){
 const form=sheetBody.querySelector('form');
 form.onsubmit=async e=>{
  e.preventDefault();if(busy)return;
  const data=Object.fromEntries([...new FormData(form)].map(([k,v])=>[k,String(v).trim()]));
  if([...form.elements].some(el=>el.required&&!el.value.trim())){$('sheetError').textContent='もじを いれてね。';return}
  busy=true;
  try{await fn(data)}catch{fail()}finally{busy=false}
 };
}
function bind(id,fn){$(id).onclick=async()=>{if(busy)return;busy=true;try{await fn()}catch{fail()}finally{busy=false}}}
function greeting(){
 if(demo)return 'ゆい、きょうは わり算を いっしょに やろう！';
 if(!f.paired||!f.name)return 'はじめは、おうちのひとと いっしょに きてね。';
 return f.nick?f.nick+'、きょうも いっしょに がんばろう！':'なんて よんでほしい？';
}
function progress(){
 const run=demo?null:f?.active;
 const ms=demo?(state.ms||0)+(state.started&&!state.paused?Date.now()-state.since:0):
  (run?.ms||0)+(tickFrom?Math.max(0,Date.now()-Math.max(tickFrom,run?.countedUntil||0)):0);
 const seconds=Math.floor(Math.max(0,ms)/1000);
 $('timer').textContent=[Math.floor(seconds/60),seconds%60].map(n=>String(n).padStart(2,'0')).join(':');
 const goal=run?.goal||'10分だけ';
 const minutes=goal==='5分だけ'?5:goal==='10分だけ'?10:0;
 const track=$('lockProgressFill').parentElement;
 track.hidden=!minutes;
 if(minutes)$('lockProgressFill').style.width=Math.min(100,seconds/(minutes*60)*100)+'%';
}
function collectTime(stop=false){
 const start=tickFrom,end=Date.now();
 tickFrom=stop?0:(start?end:0);
 if(!start||end<=start||!runId)return tail;
 return changeRun(run=>{
  if(run.status!=='active')return false;
  run.ms+=Math.max(0,end-Math.max(start,run.countedUntil||0));
  run.countedUntil=Math.max(end,run.countedUntil||0);
 });
}
function paint(){
 const active=demo?state.started&&state.step!=='done':f.active;
 runId=demo?'':f.active?.id||'';
 const paused=demo?state.paused:f.active?.status==='paused';
 if(!demo)tickFrom=active&&!paused&&!document.hidden?(tickFrom||Date.now()):0;
 overlay.classList.toggle('hidden',!active);
 const lock=Boolean(active);
 document.querySelector('main').inert=lock;
 document.querySelector('.tabbar').inert=lock;
 document.querySelector('.child-topbar').inert=lock;
 const ready=demo||f.paired&&f.name&&f.nick;
 $('startBtn').disabled=false;
 $('subject').disabled=!ready||demo||lock;
 $('goal').disabled=!ready||demo||lock;
 $('startLabel').textContent=demo&&state.step&&state.step!=='done'&&!state.started?'もんだいの つづき':ready?'はじめる':f.name?'よびかたを きめる':'いりぐちに もどる';
 $('nicknameBtn').hidden=demo||!ready;
 $('continueBtn').hidden=demo||!ready||!f.history.length;
 if(!$('continueBtn').hidden){
  const plan=f.history.at(-1).next||f.history.at(-1).material;
  $('continueBtn').textContent='このまえの つづきから：'+(plan.length>28?plan.slice(0,28)+'…':plan);
 }
 const count=demo?(state.step==='done'?1:0):f.history.filter(s=>s.date===dateAt()).length;
 const tile=document.querySelector('.sat-tr');
 tile.querySelector('.sat-value').textContent=count+'かい';
 tile.setAttribute('aria-label','きょうの がくしゅう '+count+'かい');
 if(active){
  $('lockGoalLabel').textContent=demo?'さんすう ／ あまりのある わり算':f.active.subject+' ／ '+f.active.material+' ／ '+f.active.goal;
  document.querySelector('.lock-sub').textContent=(!demo&&f.active.plan)?'このまえの つづき：'+f.active.plan:'この画面で ててまると いっしょに おべんきょうしよう';
  document.querySelector('.lock-title').textContent=paused?'ひとやすみ中':'がくしゅうロック中';
  $('askLabel').textContent=demo?'長いすの もんだい':'ててまるに きく';
  $('pauseLabel').textContent=paused?'つづきに もどる':'ひとやすみ';
  progress();
 }
 ui.setGreeting(greeting());
}
function nickname(){
 openSheet('nickname','なんて よんでほしい？','<form><label>よんでほしい なまえ<input name="nick" maxlength="80" required value="'+text(f.nick)+'"></label>'+submitButton('この なまえに する')+closeButton+'</form>');
 modalSubmit(async d=>{await change(v=>{if(!v.name||!v.paired)return false;v.nick=d.nick});closeSheet();paint()});
}
async function begin(material,plan=''){
 const subject=$('subject').value,goal=$('goal').value;
 await change(v=>{
  if(v.active||!v.paired||!v.name||!v.nick)return false;
  v.active={id:newId(),date:dateAt(),startedAt:Date.now(),subject,material,goal,plan,ms:0,status:'active',questions:[],breaks:[],insight:'',draft:'',done:'',next:''};
 });
 closeSheet();paint();ui.bumpAffinity(3);
 if(plan)ui.setSpeech('つづきから はじめよう！');
}
function start(){
 if(demo){if(state.step==='done')state={};state.started=true;state.paused=false;state.since=Date.now();saveDemo();paint();demoProblem();return}
 if(!f.paired||!f.name){location.assign('trial.html');return}
 if(!f.nick){nickname();return}
 const prev=f.history.at(-1);
 openSheet('start','なにを つかう？','<form><p>'+text($('subject').selectedOptions[0].text+' ／ '+$('goal').selectedOptions[0].text)+'</p><label>ドリルや プリント<input name="material" maxlength="80" required placeholder="れい：さんすうドリル" value="'+text(prev?.subject===$('subject').value?prev.material:'')+'"></label>'+submitButton('おべんきょうを はじめる')+closeButton+'</form>');
 modalSubmit(d=>begin(d.material));
}
function hints(run,question){
 const low=f.grade<=2;
 const first={
  '算数':/あまり|わり算/.test(question)?'あまった分は、どこにいくのかな？':'わかっている 数に まるを つけよう。',
  '国語':'たいせつな ことばに 線を ひこう。',
  '理科':'かわった ところを 一つ さがしてみよう。',
  '社会':'地図や 写真に 手がかりは あるかな？',
  '英語':low?'えを みて、しっている ことばを さがそう。':'知っている単語を一つ見つけてみよう。'
 }[run.subject]||'わかる ところを 一つ 見つけてみよう。';
 return [first,low?'えに かいたら、どうなるかな？':'わかることと、知りたいことを分けて書けるかな？',low?'わかったことを おしえて。':'自分の言葉で、ここまでの考えを説明してみよう。'];
}
function questions(){
 const run=f.active;if(!run)return;
 const records=run.questions.map(q=>'<div><strong>'+text(q.text)+'</strong>'+q.hints.map(h=>'<p>'+text(h)+'</p>').join('')+'</div>').join('');
 const last=run.questions.at(-1);
 openSheet('ask','ててまるに きこう',records+(last&&last.hints.length<3?button('nextHint','つぎの ヒント'):'')+
  '<form>'+labelField('ききたいこと','question',run.draft,true)+submitButton('ててまるに きく')+'</form>'+
  labelField('わかったこと','insight',run.insight)+closeButton);
 if($('nextHint'))bind('nextHint',async()=>{await changeRun(s=>{const q=s.questions.at(-1);if(q&&q.hints.length<3)q.hints.push(hints(s,q.text)[q.hints.length])});questions()});
 modalSubmit(async d=>{await changeRun(s=>{s.questions.push({text:d.question,hints:[hints(s,d.question)[0]]});s.draft=''});questions()});
}
async function pause(){
 if(demo){demoUpdate(state.paused?'resume':'pause');return}
 await collectTime(true);
 await changeRun(s=>{if(s.status!=='paused'){s.status='paused';(s.breaks??=[]).push({startedAt:Date.now(),endedAt:null})}});
 paint();
 openSheet('pause','ちょっと ひとやすみ。','<p id="restSpeech" role="status">ゆっくり のびを しよう。</p>'+button('restHug','ぎゅっと する')+button('resumeStudy','つづきに もどる',true));
 bind('restHug',()=>{overlay.querySelector('plush-pal')?.playMotion?.('hug');$('restSpeech').textContent='ぎゅっ。いっしょに やすもう。';ui.bumpAffinity(2)});
 bind('resumeStudy',resume);
}
async function resume(){await changeRun(s=>{s.status='active';const br=s.breaks?.at(-1);if(br&&!br.endedAt)br.endedAt=Date.now()});closeSheet();paint()}
function finish(){
 if(demo){
  if(!state.paused)state.ms=(state.ms||0)+Math.max(0,Date.now()-state.since);
  state.started=false;state.paused=false;saveDemo();closeSheet();paint();return;
 }
 const run=f.active;
 if(!run)return;
 openSheet('finish','きょう、何が できた？','<form>'+labelField('できたこと','done',run.done,true)+labelField('つぎに やりたいこと','next',run.next)+submitButton('きろくして おわる')+closeButton+'</form>');
 modalSubmit(async d=>{
  await collectTime(true);
  await changeRun((s,v)=>{Object.assign(s,d,{status:'completed',endedAt:Date.now()});const br=s.breaks?.at(-1);if(br&&!br.endedAt)br.endedAt=s.endedAt;v.history.push(s);v.active=null});
  closeSheet();paint();$('mainPal').playMotion?.('happy');ui.setSpeech(f.nick+'、よくがんばったね！');ui.bumpAffinity(8);
 });
}
const demoButton=(key,label)=>'<button type="button" class="flow-secondary" data-demo="'+key+'">'+label+'</button>';
function demoProblem(){
 let title='長いすの もんだい',body='<p>23人が長いすにすわります。1脚に4人までなら、みんなですわるには何脚いるかな？</p>';
 if(state.paused){
  title='ちょっと ひとやすみ。';body='<p>'+ (state.hugged?'ぎゅーっ。ゆい、あったかいね！':'ゆい、のびを しよう。')+'</p>'+demoButton('hug','ててまるを ハグする')+demoButton('resume','もんだいに もどる');
 }else if(state.step==='done'){
  title='ゆい、できたね！';body='<p>もう1脚あればいいから、全部で6脚！</p><a class="flow-primary" href="parent.html?mode=demo">保護者の記録を見る</a>'+closeButton;
 }else{
  body+='<p>ゆい「'+text(demoQuestion)+'」</p>';
  if(state.step==='answer')body+='<p>いすは 何脚かな？</p>'+[5,6,7].map(n=>demoButton(n,n+'脚')).join('')+'<p role="status">'+text(state.feedback||'')+'</p>'+demoButton('ask','ヒントをもういちど');
  else if(state.step==='hint')body+='<p role="status">'+text(demoHints[state.hint===1?1:0])+'</p>'+demoButton(state.hint?'ask':'hint',state.hint?'まえのヒント':'つぎのヒント')+demoButton('answer','こたえてみる');
  else body+=demoButton('ask','ててまるに きいてみる');
  body+=demoButton('pause','ちょっと やすむ')+'<a class="flow-secondary" href="parent.html?mode=demo">保護者の記録を見る</a>'+closeButton;
 }
 openSheet('demo',title,body);
}
function demoUpdate(key){
 if(key==='pause'){state.ms=(state.ms||0)+Math.max(0,Date.now()-state.since);state.paused=true;state.hugged=false}
 if(key==='resume'){state.paused=false;state.since=Date.now()}
 if(key==='hug'){state.hugged=true;overlay.querySelector('plush-pal')?.playMotion?.('hug')}
 if(key==='hint'||key==='ask'){state.step='hint';state.hint=key==='hint'?1:0}
 if(key==='answer'){state.step='answer';state.feedback=''}
 if(key==='5'||key==='7')state.feedback=key==='5'?'5脚なら20人。のこりの3人のぶんも考えよう。':'長いすを1脚ずつ、絵にかいてみよう。';
 if(key==='6'){state.step='done';state.started=false;state.paused=false;$('mainPal').playMotion?.('happy')}
 saveDemo();paint();demoProblem();
}
function cancelHold(){clearInterval(holdTimer);holdTimer=0;$('unlockFill').style.width='0%';$('unlockLabel').textContent='ほごしゃは ここを 3びょう おしてください(かいじょ)'}
function hold(e){
 if(holdTimer||overlay.classList.contains('hidden'))return;
 e.preventDefault();const start=performance.now();
 $('unlockLabel').textContent='そのまま おしつづけて…';
 holdTimer=setInterval(()=>{
  const percent=Math.min(100,(performance.now()-start)/30);$('unlockFill').style.width=percent+'%';
  if(percent>=100){cancelHold();finish()}
 },30);
}
async function init(){
 if(demo){state=readDemo(demoKey);prefs=readDemo(demoPrefs);prefs.sleep=readDemo('tetemaru.demo.parent-prefs').sleep===false?'off':'on';$('childLogLink').href='study-log.html?mode=demo&role=child';$('demoLabel').hidden=false;document.querySelector('.child-tab.active').href='child.html?mode=demo'}
 else{clearParentAccess();f=await family();prefs={...f.childPrefs,sleep:f.preferences?.sleep===false?'off':'on'}}
 ui=mountChildUI(prefs,(key,value)=>{
  if(demo)localStorage.setItem(demoPrefs,JSON.stringify(prefs));
  else change(v=>{(v.childPrefs??={})[key]=value}).catch(()=>{});
 });
 subjects.forEach(([v,l])=>$('subject').add(new Option(l,v)));goals.forEach(([v,l])=>$('goal').add(new Option(l,v)));
 const prior=demo?{}:f.active||f.history.at(-1)||{};
 $('subject').value=demo?'算数':(prefs.subject||prior.subject||'算数');
 $('goal').value=demo?'10分だけ':(prefs.goal||prior.goal||'10分だけ');
 for(const key of ['subject','goal'])$(key).onchange=()=>change(v=>{(v.childPrefs??={})[key]=$(key).value});
 bind('startBtn',start);bind('nicknameBtn',nickname);
 bind('continueBtn',()=>{const prev=f.history.at(-1);$('subject').value=prev.subject;$('goal').value=prev.goal;return begin(prev.material,prev.next)});
 bind('askBtn',()=>{if(demo)demoProblem();else questions()});
 bind('pauseBtn',()=>!demo&&f.active?.status==='paused'?resume():pause());
 $('unlockBtn').onpointerdown=hold;
 for(const e of ['pointerup','pointercancel','pointerleave','blur'])$('unlockBtn').addEventListener(e,cancelHold);
 $('unlockBtn').onkeydown=e=>{if(!e.repeat&&['Enter',' '].includes(e.key))hold(e)};
 $('unlockBtn').onkeyup=cancelHold;
 sheetBody.onclick=e=>{if(e.target.closest('[data-close]'))closeSheet();const b=e.target.closest('[data-demo]');if(b)demoUpdate(b.dataset.demo)};
 dialog.addEventListener('close',()=>{
  if(dialog.open)return;
  shown='';
  if(!demo&&runId)changeRun(s=>{if(!s.sheet)return false;s.sheet=''}).catch(()=>{});
 });
 sheetBody.oninput=e=>{
  if(demo)return;
  const key={question:'draft',insight:'insight',done:'done',next:'next'}[e.target.name];
  if(key){const value=e.target.value;changeRun(s=>{s[key]=value}).catch(()=>{})}
 };
 paint();
 if(!demo&&f.active?.status==='paused')await pause();
 else if(!demo&&f.active?.sheet==='ask')questions();
 else if(!demo&&f.active?.sheet==='finish')finish();
 else if(!demo&&!f.active&&f.paired&&f.name&&new URLSearchParams(location.search).get('panel')==='name'){
  history.replaceState(null,'','child.html');nickname();
 }
 if(demo&&state.started)demoProblem();
 setInterval(()=>{if(!overlay.classList.contains('hidden'))progress()},500);
 if(!demo){
  setInterval(()=>{if(!document.hidden)collectTime()},3000);
  document.addEventListener('visibilitychange',async()=>{
   if(document.hidden){cancelHold();await collectTime(true)}else{await change(()=>false);paint();if(!f.active&&['ask','finish','pause'].includes(shown))closeSheet()}
  });
  window.addEventListener('pagehide',()=>collectTime(true));
 }
}
window.addEventListener('pageshow',event=>{
 if(event.persisted){
  if(!demo)clearParentAccess();
  tickFrom=0;
  location.reload();
 }
});
init().catch(()=>{$('speech').textContent='おうちの きろくを ひらけなかったよ。もういちど ひらいてね。';document.querySelector('#childPhone').classList.remove('is-intro')});
