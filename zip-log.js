import {family} from './store.js';
import {getDays, isDemo, parentAllowed, clearParentAccess} from './zip-records.js';

const params = new URLSearchParams(location.search);
const role = params.get('role') === 'child' ? 'child' : 'parent';
const back = document.getElementById('backToRole');
back.href = role + '.html' + (isDemo ? '?mode=demo' : '');
back.setAttribute('aria-label', role === 'child' ? 'こども画面にもどる' : '保護者ホームへ戻る');
const list = document.getElementById('logList');
const initialDate = /^#\d{4}-\d{2}-\d{2}$/.test(location.hash) ? location.hash.slice(1) : '';
const openDates = new Set(initialDate ? [initialDate] : []);
let rendering = 0;
let level = 3;
const levelButtons = document.querySelectorAll('#levelPicker [data-level]');
const parentPrefsKey='tetemaru.demo.parent-prefs';
const demoPrefsKey=role==='parent' ? parentPrefsKey : 'tetemaru.demo.child-prefs';
const familyPrefs=role==='parent'?'preferences':'childPrefs';
function demoPreferences(key=demoPrefsKey) {
  try { return JSON.parse(localStorage.getItem(key)) || {}; }
  catch { return {}; }
}

function showLevel() {
  for (const button of levelButtons) {
    const selected = Number(button.dataset.level) === level;
    button.classList.toggle('active', selected);
    button.setAttribute('aria-pressed', String(selected));
  }
  applyKanjiLevel(level);
}
for (const button of levelButtons) {
  button.addEventListener('click', async () => {
    const next=Number(button.dataset.level);
    try {
      if (isDemo) localStorage.setItem(demoPrefsKey,JSON.stringify({...demoPreferences(),kanjiLevel:next}));
      else {
        const state=await family(f=>{
          if (role==='parent' && !parentAllowed(f)) return false;
          f[familyPrefs]={...f[familyPrefs],kanjiLevel:next};
        });
        if (role==='parent' && !parentAllowed(state)) {await render(); return;}
      }
      level=next;
      showLevel();
    } catch {
      list.replaceChildren(element('p','log-empty','かんじレベルを保存できませんでした。もう一度画面を開いてください。'));
    }
  });
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

const iconPaths = {
  算数:'M4 4h16v16H4z M8 8h8 M8 12h8 M8 16h4',
  国語:'M4 19V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v14 M4 19a2 2 0 0 0 2 2h14 M8 7h8 M8 11h8',
  英語:'M3 12h18 M12 3a9 9 0 1 0 .001 0z M12 3a14 14 0 0 1 0 18 M12 3a14 14 0 0 0 0 18',
  理科:'M9 2v6l-5 9a2 2 0 0 0 2 3h12a2 2 0 0 0 2-3l-5-9V2 M9 2h6',
  社会:'M12 3a9 9 0 1 0 .001 0z M3 10h18 M5 15h14 M9 3a16 16 0 0 0 0 18 M15 3a16 16 0 0 1 0 18'
};

function annotated(text) {
  // Escape family-entered text before the ZIP's trusted ruby markup is added.
  const span = element('span','',String(text));
  span.innerHTML = annotateFurigana(span.innerHTML);
  return span;
}

function detail(container, title, value) {
  if (!value) return;
  const row = element('div','log-session-sub');
  const label = element('b');
  label.append(annotated(title));
  row.append(label,document.createTextNode('　'+value));
  container.append(row);
}

function sessionRow(session) {
  const row = element('div','log-session');
  const icon = element('span','log-icon');
  const path = Object.hasOwn(iconPaths,session.subject) ? iconPaths[session.subject] : iconPaths['国語'];
  icon.innerHTML = '<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="'+path+'"/></svg>';
  icon.style.color = SUBJECT_COLORS[session.subject] || '#916273';
  const content = element('div','log-session-text');
  const title = element('span','log-session-title');
  title.append(annotated(session.subject+' ／ '+session.material));
  content.append(title);
  detail(content,'気づいたこと',session.insight);
  if (session.done!==session.insight || !isDemo) detail(content,'できたこと',session.done);
  for (const question of session.questions || []) {
    detail(content,'質問',question.text);
    for (const hint of question.hints || []) detail(content,'ヒント',hint);
  }
  detail(content,'次にやりたいこと',session.next);
  detail(content,'目標',session.goal);
  let duration=minLabel(Math.max(0,Number(session.ms)||0)/60000);
  if (Number.isFinite(session.startedAt) && Number.isFinite(session.endedAt)) {
    const clock = new Intl.DateTimeFormat('ja-JP',{hour:'2-digit',minute:'2-digit'});
    duration += '（'+clock.format(session.startedAt)+'〜'+clock.format(session.endedAt)+'）';
  }
  detail(content,'学習時間',duration);
  row.append(icon,content);
  return row;
}

function dayCard(day, latest) {
  const card = element('section','card card-flush');
  card.id = 'day-'+day.date;
  const head = element('button','log-head');
  head.type='button';
  const text = element('span','log-head-text');
  const date = element('span','log-date',day.date.replaceAll('-','/')+' ('+day.label+')');
  if (day.date===latest) date.append(element('span','log-date-today','さいしん'));
  const meta=element('span','log-meta');
  meta.append(annotated('教材'),document.createTextNode(' '+day.sessions.length+'件'));
  const breaks=day.breaks || [];
  if (breaks.length || (day.sessions.length && day.sessions.every(s=>Array.isArray(s.breaks)))) {
    meta.append(document.createTextNode('・'),annotated('休憩'),document.createTextNode(' '+breaks.length+'回'));
  }
  text.append(date,meta);
  const right=element('span','log-head-right');
  const total=day.sessions.reduce((sum,s)=>sum+s.ms,0);
  right.append(element('span','log-total',minLabel(total/60000)));
  right.insertAdjacentHTML('beforeend','<svg class="chevron" aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 6 15 12 9 18"/></svg>');
  head.append(text,right);
  const bar=element('div','log-bar');
  const bySubject=new Map();
  for (const s of day.sessions) bySubject.set(s.subject,(bySubject.get(s.subject)||0)+s.ms);
  for (const [subject,time] of bySubject) {
    if (!time || !total) continue;
    const segment=element('div');
    segment.style.background=SUBJECT_COLORS[subject] || '#916273';
    segment.style.width=(100*time/total)+'%';
    bar.append(segment);
  }
  const panel=element('div','accordion-panel');
  panel.id='records-'+day.date;
  head.setAttribute('aria-controls',panel.id);
  const body=element('div','log-body');
  for (const s of day.sessions) body.append(sessionRow(s));
  if (breaks.length) {
    const block=element('div','log-breaks');
    const clock=new Intl.DateTimeFormat('ja-JP',{hour:'2-digit',minute:'2-digit'});
    for (const rest of breaks) {
      const from=rest.startedAt,to=rest.endedAt;
      let start=rest.start,end=rest.end,minutes=rest.minutes;
      if (Number.isFinite(from) && Number.isFinite(to) && to>=from) {
        start=clock.format(from);end=clock.format(to);minutes=(to-from)/60000;
      }
      if (!start || !end || !Number.isFinite(minutes)) continue;
      const row=element('div','log-break');
      const name=element('span','log-break-name');
      name.append(annotated('休憩'));
      if(rest.reason) name.append(document.createTextNode('　'+rest.reason));
      row.append(name,element('span','log-break-time',start+'〜'+end+' ('+minLabel(minutes)+')'));
      block.append(row);
    }
    body.append(block);
  }
  if (!day.sessions.length) body.append(element('p','log-empty','この日の記録はまだありません。'));
  panel.append(body);
  function toggle(open) {
    card.classList.toggle('is-open',open);
    head.setAttribute('aria-expanded',String(open));
    panel.hidden=!open;
    panel.style.maxHeight=open?'none':'0';
    if (open) openDates.add(day.date); else openDates.delete(day.date);
  }
  head.addEventListener('click',()=>toggle(!openDates.has(day.date)));
  card.append(head,bar,panel);
  toggle(openDates.has(day.date));
  return card;
}

const filter=document.getElementById('materialFilter');
const filterRow=document.getElementById('filterRow');
let material='', days=[], focusFilter=params.get('view')==='materials';
function drawCards() {
  const subset=material?days.map(day=>{
    const sessions=day.sessions.filter(s=>s.material===material);
    return {...day,sessions,breaks:sessions.flatMap(s=>s.breaks||[])};
  }):days;
  const visible=subset.filter(d=>d.sessions.length || (!material && d.date===initialDate));
  const latest=subset.filter(d=>d.sessions.length).at(-1)?.date;
  if (visible.length) list.replaceChildren(...visible.slice().reverse().map(d=>dayCard(d,latest)));
  else {
    const empty=element('div','card');
    empty.append(element('p','log-empty','まだ学習記録はありません。'));
    const link=element('a','more-link',role==='parent'?'保護者ホームへ戻る':'おべんきょうの画面へ');
    link.href=back.href;
    empty.append(link);list.replaceChildren(empty);
  }
  showLevel();
}
filter.addEventListener('change',()=>{
  material=filter.value;
  drawCards();
});

async function render() {
  const request=++rendering;
  try {
    let history=[];
    if (!isDemo) {
      const f=await family();
      if (request!==rendering) return;
      if (role==='parent' && !parentAllowed(f)) {
        location.replace('./parent.html?next=log'+location.hash);
        return;
      }
      if (role==='child') clearParentAccess();
      history=f.history;
      level=Number(f[familyPrefs]?.kanjiLevel ?? f.preferences?.kanjiLevel)||3;
    }
    else level=Number(demoPreferences().kanjiLevel ?? demoPreferences(parentPrefsKey).kanjiLevel)||3;
    if (isDemo) document.getElementById('pageTitle').innerHTML=annotateFurigana('発表用デモの学習記録');
    else document.getElementById('pageTitle').innerHTML=annotateFurigana('学習記録');
    days=getDays(history);
    const names=[...new Set(days.flatMap(d=>d.sessions.map(s=>s.material)).filter(Boolean))];
    filter.replaceChildren(new Option('すべての教材',''),...names.map(n=>new Option(n,n)));
    filterRow.hidden=names.length===0;
    material=names.includes(material)?material:'';
    filter.value=material;
    drawCards();
    if(focusFilter && names.length){filter.focus();focusFilter=false}
    else if (initialDate) document.getElementById('day-'+initialDate)?.scrollIntoView({block:'nearest'});
  } catch {
    if (request===rendering) list.replaceChildren(element('p','log-empty','記録を読み込めませんでした。もう一度画面を開いてください。'));
  }
}

function conceal(){++rendering; days=[]; filter.replaceChildren(); filterRow.hidden=true; list.replaceChildren()}
window.addEventListener('pagehide',conceal);
window.addEventListener('pageshow',e=>{if(e.persisted) render()});
document.addEventListener('visibilitychange',()=>{
  if(document.hidden)conceal();
  else render();
});
render();
