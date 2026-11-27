import {dateAt} from './store.js';
import {topics, exampleDays, completedDemoSessions} from './demo-topics.js';

if(!import.meta.env?.DEV && 'serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(()=>{});

export const isDemo = new URLSearchParams(location.search).get('mode') === 'demo';
export const demoTimerKey = 'tetemaru.demo.timer.v1';
const parentSession = 'tetemaru.family.parent-access';

export function parentAllowed(f) {
  return !f.pin || sessionStorage.getItem(parentSession) === f.pin;
}
export function allowParent(f) {
  if (f.pin) sessionStorage.setItem(parentSession,f.pin);
  else clearParentAccess();
}
export function clearParentAccess() {
  sessionStorage.removeItem(parentSession);
}
export function resetDemo() {
  for (const key of Object.keys(localStorage)) {
    if (key.startsWith('tetemaru.demo.')) localStorage.removeItem(key);
  }
}

function dayAgo(count) {
  const d = new Date();
  d.setDate(d.getDate()-count);
  return dateAt(d);
}
function makeDay(date) {
  const d = new Date(date+'T12:00:00');
  const label = '日月火水木金土'[d.getDay()];
  return {date,label,weekday:label+'曜日',sessions:[],breaks:[]};
}
function demoHistory() {
  const history=exampleDays.map(({id,daysAgo,minutes})=>{
    const r=topics.find(t=>t.id===id);
    return {id:'example-'+id,kind:'quiz',date:dayAgo(daysAgo),subject:r.subject,material:r.title,
      ms:minutes*60000,goal:'まず1問',done:r.options[r.answer],insight:r.explanation,
      questions:[{text:r.question,hints:[r.hints[0]]}]};
  });
  if(typeof WEEK_DETAIL!=='undefined') {
    WEEK_DETAIL.forEach((d,i)=>{
      const date=dayAgo(6-i);
      for(const [j,s] of d.sessions.entries()) {
        history.push({id:'sample-'+i+'-'+j,date,subject:s.subject,material:s.material,
          ms:sessionMinutes(s)*60000,goal:s.pages+'ページ',questions:[],next:'',insight:'',done:'',breaks:j===0?d.breaks:[]});
      }
    });
  }
  return history.concat(completedDemoSessions());
}
export function getDays(history,{weekOnly=false}={}) {
  const days=new Map();
  for (let i=6;i>=0;i--) {
    const d=dayAgo(i);
    days.set(d,makeDay(d));
  }
  for (const session of isDemo ? demoHistory() : history||[]) {
    const date=session.date;
    if (!date || (weekOnly && !days.has(date))) continue;
    if (!days.has(date)) days.set(date,makeDay(date));
    const day=days.get(date);
    day.sessions.push(session);
    if (Array.isArray(session.breaks)) day.breaks.push(...session.breaks);
  }
  return [...days.values()].sort((a,b)=>a.date.localeCompare(b.date));
}
