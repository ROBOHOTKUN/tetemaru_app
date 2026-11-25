// This local trial uses its own records. The family app keeps its IndexedDB store.
const prefix = 'tetemaru.ui-trial.';
const readTrial = key => localStorage.getItem(prefix + key);
const writeTrial = (key,value) => localStorage.setItem(prefix + key,value);
const today = new Date();
function dayKey(d) {
  return [d.getFullYear(), String(d.getMonth()+1).padStart(2,'0'), String(d.getDate()).padStart(2,'0')].join('-');
}
function offsetDay(d, offset) {
  const result = new Date(d); result.setDate(result.getDate()+offset); return result;
}
const subjects = Object.keys(SUBJECT_COLORS);
function selectedSubject() {
  const name = readTrial('subject');
  return subjects.includes(name) ? name : subjects[0];
}
function readRun(key) {
  try {
    const r = JSON.parse(readTrial(key));
    return r && subjects.includes(r.subject) && Number.isFinite(r.start) ? r : null;
  } catch { return null; }
}
function beginRun() {
  const run = readRun('active') || {start:Date.now(), subject:selectedSubject()};
  writeTrial('active', JSON.stringify(run));
  return run;
}
function finishRun(run) {
  if (readRun('active')?.start !== run.start) return;
  writeTrial('session.'+run.start, JSON.stringify({...run,end:Date.now()}));
  localStorage.removeItem(prefix+'active'); return true;
}
const clockLabel = date => date.toTimeString().slice(0,5);
function loadTrialWeek() {
  const anchorKey = readTrial('anchor') || dayKey(today);
  writeTrial('anchor', anchorKey);
  const anchor = new Date(anchorKey+'T12:00:00');
  const dates = new Map();
  WEEK_DETAIL.forEach((day,i) => dates.set(day.date,dayKey(offsetDay(anchor,i-6))));
  QUESTIONS.forEach(q => q.date = dates.get(q.date));
  const fixtures = new Map(WEEK_DETAIL.map(day=>[dates.get(day.date),day]));
  const days = Array.from({length:7},(_,i)=>{
    const date=offsetDay(today,i-6), key=dayKey(date), label='日月火水木金土'[date.getDay()];
    const fixture=fixtures.get(key);
    return {date:key,label,weekday:label+'曜日',sessions:fixture?.sessions || [],breaks:fixture?.breaks || []};
  });
  for (const key of Object.keys(localStorage).filter(k=>k.startsWith(prefix+'session.')).sort()) {
    const r=readRun(key.slice(prefix.length));
    if (!r || !Number.isFinite(r.end) || r.end<r.start) continue;
    const start=new Date(r.start), day=days.find(d=>d.date===dayKey(start));
    day?.sessions.push({subject:r.subject,material:'この試作での学習',pages:'',start:clockLabel(start),end:clockLabel(new Date(r.end)),seconds:Math.floor((r.end-r.start)/1000)});
  }
  WEEK_DETAIL.splice(0,WEEK_DETAIL.length,...days);
}
loadTrialWeek();

window.addEventListener('pageshow', event => {
  if (event.persisted) location.reload();
});
window.addEventListener('storage', event => {
  if (event.key?.startsWith(prefix+'session.') || event.key===prefix+'active') location.reload();
});