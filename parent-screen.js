import { family, initial, verifyParentPin, dateAt } from './store.js';
import { autoUnlock } from './autofill.js';
import { isDemo, getDays, parentAllowed, allowParent, clearParentAccess, resetDemo, demoTimerKey } from './zip-records.js';
import {topics, demoStateKey, readDemo} from './demo-topics.js';

const $ = id => document.getElementById(id);
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ruby = text => annotateFurigana(escape(text));
const mode = isDemo ? '?mode=demo' : '';
const logLink = 'study-log.html?role=parent' + (isDemo ? '&mode=demo' : '');
const demoPrefsKey = 'tetemaru.demo.parent-prefs';
const chevron = '<svg class="chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>';
let record, dashboard, days, selected, level, busy=false;

function demoPrefs(){
  try { return JSON.parse(localStorage.getItem(demoPrefsKey)) || {}; }
  catch { return {}; }
}
function prefs(){return isDemo ? demoPrefs() : record.preferences || {};}
function activeDemoGoal(){
  const timer=readDemo(demoTimerKey);
  if(timer.status==='active'||timer.status==='paused')return timer;
  const state=readDemo(demoStateKey);
  const topic=state?.started && topics.find(t=>t.id===state.topicId);
  return topic?{subject:topic.subject,goal:state.goal}:null;
}
function message(text) {
  const messageBox=$('parentDialog').open ? $('sheetMessage') : $('parentMessage');
  messageBox.textContent=text;
  messageBox.hidden=!text;
}
function years(current=1){
  return [1,2,3,4,5,6].map(n=>`<option value="${n}" ${Number(current)===n?'selected':''}>小学${n}年</option>`).join('');
}
function profileFields(name='',grade=1){
  return `<label>お子さんの名前<input name="name" maxlength="60" value="${escape(name)}" required></label>
  <label>学年<select name="grade">${years(grade)}</select></label>`;
}
function pinField(label,required){
  return `<label>${label}<input name="code" type="password" inputmode="numeric" autocomplete="off" pattern="[0-9]{4}" minlength="4" maxlength="4" ${required?'required':''}></label>`;
}
function form(kind,fields,submit){
  return `<form data-parent-form="${kind}" class="flow-content">${fields}<button class="flow-primary" type="submit">${submit}</button></form>`;
}
function action(id,label){
  return `<button class="flow-secondary" type="button" data-parent-action="${id}">${label}</button>`;
}
function gate(title,content){
  $('parentGate').className='content';
  $('parentGate').hidden=false;
  $('parentGate').innerHTML=`<section class="card flow-content"><h2 class="section-title">${title}</h2>${content}
    <a class="more-link" href="trial.html">保護者⇄こども 切り替え</a></section>`;
}
function clearScreen(){
  dashboard?.remove();
  dashboard=null;
  if($('parentDialog').open) $('parentDialog').close();
  $('sheetContent').replaceChildren();
  $('parentGate').replaceChildren();
  $('parentSub').textContent='保護者の画面';
  $('parentMessage').textContent='';
  $('parentMessage').hidden=true;
  record=undefined;
}
function gateKind(value){
  return parentAllowed(value)?'dashboard':'unlock';
}
async function enter(){
  clearScreen();
  $('toChild').href='child.html'+mode;
  document.querySelector('.status-text').textContent=isDemo?'発表用デモ':'家庭用';
  if(!isDemo){
    record=await family();
    const stage=gateKind(record);
    if(stage==='unlock'){
      gate('保護者用の暗証番号',form('unlock',pinField('暗証番号（数字4桁）',true),'ひらく'));
      autoUnlock($('parentGate').querySelector('form'));
      return;
    }
    const params=new URLSearchParams(location.search);
    if(params.get('return')==='log'||params.get('next')==='log'){
      location.replace(logLink + (/^#\d{4}-\d{2}-\d{2}$/.test(location.hash)?location.hash:''));
      return;
    }
  }
  showDashboard();
  const url=new URL(location.href);
  const panel=url.searchParams.get('panel');
  if((!isDemo && panel==='settings') || (isDemo && panel==='demo-reset')){
    url.searchParams.delete('panel');
    history.replaceState(null,'',url);
    if(isDemo)$('demoReset').click();
    else settings();
  }
}

async function changeFamily(change) {
  let accepted=false;
  record=await family(value=>{
    if(!parentAllowed(value)) return false;
    accepted=true;
    return change(value);
  });
  if(!accepted){await enter();message('もう一度、暗証番号を入力してください。');}
  return accepted;
}
function savePreference(key,value){
  if(isDemo){
    localStorage.setItem(demoPrefsKey,JSON.stringify({...demoPrefs(),[key]:value}));
    return Promise.resolve(true);
  }
  return changeFamily(f=>{f.preferences={...f.preferences,[key]:value};});
}
const duration = session => Math.max(0,Number(session.ms)||0)/60000;
function total(sessions){ return sessions.reduce((sum,s)=>sum+duration(s),0); }
function minuteText(minutes){return minutes>0 && minutes<1?'1分未満':Math.round(minutes)+'分';}
function restMinutes(b){
  if(Number.isFinite(b.startedAt) && Number.isFinite(b.endedAt))return Math.max(0,b.endedAt-b.startedAt)/60000;
  if(Number.isFinite(b.minutes))return Math.max(0,b.minutes);
  if(/^\d{1,2}:\d{2}$/.test(b.start) && /^\d{1,2}:\d{2}$/.test(b.end))return Math.max(0,timeToMin(b.end)-timeToMin(b.start));
  return 0;
}
function bySubject(sessions){
  const result=new Map();
  for(const row of sessions){
    const name=row.subject||'その他';
    result.set(name,(result.get(name)||0)+duration(row));
  }
  return result;
}
const color = subject => Object.hasOwn(SUBJECT_COLORS,subject)?SUBJECT_COLORS[subject]:'var(--rest)';
function setLevel(){
  for(const button of $('levelPicker').querySelectorAll('button')){
    const active=Number(button.dataset.level)===level;
    button.classList.toggle('active',active);
    button.setAttribute('aria-pressed',String(active));
  }
  applyKanjiLevel(level);
}
function showDashboard(selectedDate){
  $('parentGate').className='';
  $('parentGate').hidden=true;
  dashboard=document.createElement('div');
  dashboard.append($('parentDashboard').content.cloneNode(true));
  $('parentDashboard').after(dashboard);
  // These labels come from the untouched dashboard template each time.
  dashboard.querySelectorAll('.kanji-text').forEach(el=>{el.innerHTML=ruby(el.textContent);});
  $('toChild').href='child.html'+mode;
  $('logTab').href=logLink;
  dashboard.querySelector('.tab.active').href='parent.html'+mode;
  $('returnMenu').href='trial.html'+mode;
  $('returnMenu').onclick=()=>{if(!isDemo)clearParentAccess();};
  $('parentSub').textContent=isDemo?'ゆいさん・小学3年生の学習記録':record.name+'さん・小学'+record.grade+'年生の学習記録';
  $('settingsButton').hidden=isDemo;
  $('demoReset').hidden=!isDemo;
  days=getDays(isDemo?[]:record.history,{weekOnly:true});
  const selectedIndex=days.findIndex(day=>day.date===selectedDate);
  selected=selectedIndex<0?days.length-1:selectedIndex;
  const today=days.at(-1);
  const stats=dashboard.querySelectorAll('.stat-value');
  stats[0].textContent=minuteText(total(today.sessions));
  stats[1].textContent=today.sessions.length+'回';
  const active=isDemo?activeDemoGoal():record.active;
  const latest=today.sessions.at(-1);
  const goal=active||latest;
  dashboard.querySelector('.goal-value').innerHTML=ruby(goal?[goal.subject,goal.goal].filter(Boolean).join(' ／ '):'まだありません');
  const badge=dashboard.querySelector('.goal-row .badge');
  badge.querySelector('.kanji-text').innerHTML=ruby(active?.status==='paused'?'休憩中':active?'取り組み中':latest?'学習を終了':'');
  badge.querySelector('svg').style.display=active?'none':'';
  function updateBadge(){
    badge.hidden=!goal||!$('notif').checked;
    badge.style.display=badge.hidden?'none':'';
  }
  for(const name of ['sleep','notif']){
    $(name).checked=prefs()[name]!==false;
    $(name).onchange=async()=>{
      try{
        if(await savePreference(name,$(name).checked) && name==='notif')updateBadge();
      }catch{message('設定を保存できませんでした。');}
    };
  }
  updateBadge();
  $('weekTotal').textContent=minuteText(days.reduce((sum,d)=>sum+total(d.sessions),0));
  const subjects=[...new Set(days.flatMap(d=>d.sessions.map(s=>s.subject)))];
  $('legend').innerHTML=subjects.map(name=>`<span class="legend-item"><span class="dot" style="background:${color(name)}"></span>${ruby(name)}</span>`).join('');
  level=Number(prefs().kanjiLevel)||3;
  $('levelPicker').onclick=async e=>{
    const button=e.target.closest('[data-level]');
    if(!button)return;
    try{ if(await savePreference('kanjiLevel',Number(button.dataset.level))){level=Number(button.dataset.level);setLevel();} }
    catch{message('設定を保存できませんでした。');}
  };
  $('settingsButton').onclick=settings;
  $('demoReset').onclick=()=>sheet('デモを最初に戻しますか？','<p>デモで選んだ教科と今回の学習記録を消して、選択画面に戻ります。</p>'+action('demo-reset','デモをリセットする'));
  renderDay();
}
function renderDay(){
  const day=days[selected], max=Math.max(1,...days.map(d=>total(d.sessions)));
  $('bars').innerHTML=days.map((d,i)=>{
    const m=total(d.sessions);
    const segments=[...bySubject(d.sessions)].map(([subject,minutes])=>`<span class="bar-seg" style="height:${m?minutes/m*100:0}%;background:${color(subject)}"></span>`).join('');
    return `<button type="button" class="bar-btn" data-day="${i}" aria-label="${escape(d.date)} ${minuteText(m)}" aria-pressed="${selected===i}"><span class="bar-value">${minuteText(m)}</span><span class="bar-stack" style="height:${m/max*100}%">${segments}</span></button>`;
  }).join('');
  $('bars').onclick=e=>{const button=e.target.closest('[data-day]');if(button){selected=Number(button.dataset.day);renderDay();$('bars').children[selected].focus({preventScroll:true});}};
  $('barLabels').innerHTML=days.map((d,i)=>`<span class="${i===selected?'selected':''}">${escape(d.label)}</span>`).join('');
  $('detailDate').textContent=day.date.slice(5).replace('-','/')+'（'+day.weekday.replace('曜日','')+'）';
  $('detailTotal').textContent=minuteText(total(day.sessions));
  const detail=[...bySubject(day.sessions)].map(([subject,m])=>`<div class="detail-row"><span class="dot" style="background:${color(subject)}"></span><span class="detail-name">${ruby(subject)}</span><span class="detail-min">${minuteText(m)}</span></div>`);
  if(day.breaks.length){
    const rest=day.breaks.reduce((sum,b)=>sum+restMinutes(b),0);
    detail.push(`<div class="detail-row"><span class="dot" style="background:var(--rest)"></span><span class="detail-name">${ruby('休憩')}</span><span class="detail-min">${minuteText(rest)}（${day.breaks.length}回）</span></div>`);
  }
  if(!detail.length)detail.push('<p class="setting-note">この日の学習記録はまだありません。</p>');
  detail.push(`<a class="more-link pressable" href="${logLink}#${escape(day.date)}">この日の${ruby('詳細')}を見る ${chevron}</a>`);
  $('detailRows').innerHTML=detail.join('');
  renderQuestions(day);
  setLevel();
}
function renderQuestions(day){
  const list=$('questionList');
  list.previousElementSibling.innerHTML=ruby(day.date===dateAt()?'今日の質問・振り返り':day.date.slice(5).replace('-','/')+'の質問・振り返り');
  list.replaceChildren();
  for(const s of day.sessions){
    if(!s.questions?.length && !s.insight && !s.done && !s.next)continue;
    const quiz=s.kind==='quiz'||(isDemo&&!s.kind);
    const qs=s.questions?.length?s.questions:[null];
    for(const [i,q] of qs.entries()){
      const wrap=document.createElement('div');
      wrap.className='card card-flush';
      const hints=(q?.hints||[]).map(h=>`<div class="qa-answer"><img width="26" height="26" src="./friend-front.png" alt=""><span>${ruby(h)}</span></div>`).join('');
      const insight=s.insight||s.done;
      const key=s.id+'/'+i;
      let reviewed=isDemo?Boolean(prefs().reviewed?.[key]):Boolean((q||s).reviewed);
      wrap.innerHTML=`<button type="button" class="list-item list-item-plain" aria-expanded="false"><span class="list-icon" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg></span><span class="list-text"><span class="list-title">${ruby(q?.text||s.material||s.subject)}</span><span class="list-sub"><span class="tag ${reviewed?'':'tag-new'}">${reviewed?'見返し済み':'未確認'}</span>${ruby(s.subject)} ／ ${ruby(s.material)} ／ ${minuteText(duration(s))}</span></span>${chevron}</button>
      <div hidden><div class="qa-body"><div class="qa-question">${quiz?'こたえの説明':'自分で気づいたこと'}</div><p>${ruby(insight||'記入なし')}</p>${hints}${s.done && s.done!==insight?'<p>'+(quiz?'えらんだこたえ　':'できたこと　')+ruby(s.done)+'</p>':''}${s.next?'<p>次に取り組むこと　'+ruby(s.next)+'</p>':''}</div></div>`;
      const button=wrap.firstElementChild, body=wrap.lastElementChild;
      button.onclick=async()=>{
        body.hidden=!body.hidden;
        wrap.classList.toggle('is-open',!body.hidden);
        button.setAttribute('aria-expanded',String(!body.hidden));
        if(body.hidden||reviewed)return;
        try{
          if(isDemo)await savePreference('reviewed',{...prefs().reviewed,[key]:true});
          else {
            if(!await changeFamily(f=>{
              const saved=f.history.find(row=>row.id===s.id);
              const target=q?saved?.questions?.[i]:saved;
              if(target)target.reviewed=true;
            }))return;
            (q||s).reviewed=true;
          }
          reviewed=true;
          const tag=button.querySelector('.tag');
          tag.textContent='見返し済み';tag.classList.remove('tag-new');
        }catch{message('見返した状態を保存できませんでした。');}
      };
      list.append(wrap);
    }
  }
  if(!list.children.length)list.innerHTML='<p class="card setting-note">この日の質問・振り返りはありません。</p>';
}
function sheet(title,body){
  $('sheetContent').innerHTML='<h2 class="section-title" id="sheetTitle">'+escape(title)+'</h2>'+body;
  $('sheetMessage').textContent='';
  if(!$('parentDialog').open)$('parentDialog').showModal();
  else $('sheetContent').querySelector('input,button')?.focus();
}
function settings(){
  sheet('家庭の設定',form('profile',profileFields(record.name,record.grade),'名前と学年を保存')+
    '<p>プロフィールと学習記録はこのブラウザに保存されています。</p>'+
    action('reconnect','ててまるを再接続')+action('reset','家庭データの初期化'));
}
async function run(task){
  if(busy)return;
  busy=true;
  try{await task();}
  catch{message('記録を開くか、保存できませんでした。ブラウザの保存設定をご確認ください。');}
  finally{busy=false;}
}
document.addEventListener('submit',e=>{
  const kind=e.target.dataset.parentForm;
  if(!kind)return;
  e.preventDefault();
  const data=new FormData(e.target);
  run(async()=>{
    if(isDemo)return;
    if(kind==='unlock'){
      const latest=await family();
      if(latest.pin && !await verifyParentPin(data.get('code'),latest.pin)){
        message('暗証番号を確認してください。');return;
      }
      allowParent(latest);await enter();return;
    }
    const name=data.get('name').trim(),grade=Number(data.get('grade'));
    if(!name||!(grade>=1 && grade<=6)){message('名前と学年を入力してください。');return;}
    if(!await changeFamily(f=>{f.name=name;f.grade=grade;}))return;
    await enter();message('名前と学年を保存しました。');
  });
});
document.addEventListener('click',e=>{
  const what=e.target.closest('[data-parent-action]')?.dataset.parentAction;
  if(!what)return;
  run(async()=>{
    if(isDemo){if(what==='demo-reset'){resetDemo();location.assign('child.html?mode=demo');}return;}
    if(what==='reset'){
      sheet('家庭の記録をすべて消しますか？','<p>このブラウザの名前・学年・呼び名・暗証番号・ペアリング・途中の宿題・学習記録・家庭用設定を消します。元には戻せません。</p>'+action('cancel-reset','消さずに戻る')+action('erase','家庭のデータを消す'));
    }else if(what==='cancel-reset'){settings();}
    else if(what==='erase'){
      if(await changeFamily(f=>{for(const key of Object.keys(f))delete f[key];Object.assign(f,initial());})){clearParentAccess();location.assign('trial.html');}
    }else if(what==='reconnect'){
      if(await changeFamily(f=>{f.paired=true;}))message('ペアリングが完了しました。');
    }
  });
});
$('dismissParentSheet').onclick=()=>$('parentDialog').close();
$('toChild').onclick=()=>{if(!isDemo)clearParentAccess();};
const headerTitle=document.querySelector('.header-title.kanji-text');
headerTitle.innerHTML=ruby(headerTitle.textContent);
applyKanjiLevel(3);

async function refreshVisible(){
  if(document.hidden)return;
  if(!isDemo){
    const latest=await family();
    if(!record || gateKind(latest)!==gateKind(record) || (dashboard && !parentAllowed(latest))){
      await enter();return;
    }
    if(!dashboard){record=latest;return;}
    if(JSON.stringify(record)===JSON.stringify(latest) && days.at(-1).date===dateAt())return;
    const form=$('parentDialog').querySelector('[data-parent-form="profile"]');
    if(form){
      if(form.elements.name.value===record.name)form.elements.name.value=latest.name;
      if(Number(form.elements.grade.value)===Number(record.grade))form.elements.grade.value=latest.grade;
    }
    record=latest;
  }
  if(!dashboard)return;
  const selectedDate=selected===days.length-1?null:days[selected].date;
  dashboard.remove();
  showDashboard(selectedDate);
}
document.addEventListener('visibilitychange',()=>{if(!document.hidden)run(refreshVisible);});
window.addEventListener('pagehide',clearScreen);
window.addEventListener('pageshow',e=>{if(e.persisted)run(enter);});
run(enter);
