import './motion.js';
import {family,initial,dateAt,pinHash,newId} from './store.js';
import {demo,demoAction} from './demo.js';
const app=document.querySelector('#app');
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const btn=(l,a)=>'<button type="button" data-act="'+a+'">'+esc(l)+'</button>';
const link=(l,r)=>'<button type="button" class="secondary" data-go="'+r+'">'+esc(l)+'</button>';
const friend='<plush-pal data-motion="idle"></plush-pal>';
const ui={esc,btn,link,friend};
let f=initial(), route='', unlocked='', busy=false, tick=performance.now(), tracked='', tail=Promise.resolve();
const queue=fn=>{const result=tail.then(fn);tail=result.catch(report);return result};
function report(){const el=document.querySelector('#error');el.textContent='記録を保存・表示できませんでした。ブラウザの保存設定や空き容量を確認して、もう一度お試しください。'}
const panel=(title,body,kid=false)=>'<section class="panel '+(kid?'kidpanel':'')+'">'+(kid?friend:'')+'<h1>'+title+'</h1>'+body+'</section>';
const actions=(...items)=>'<div class="actions">'+items.join('')+'</div>';
const input=(label,id,val='',opts='')=>'<label>'+label+'<input name="'+id+'" value="'+esc(val)+'" maxlength="80" '+opts+'></label>';
const area=(label,id,val='',required=false)=>'<label>'+label+'<textarea maxlength="1000" name="'+id+'" '+(required?'required':'')+'>'+esc(val)+'</textarea></label>';
const select=(label,id,values,current)=>'<label>'+label+'<select name="'+id+'">'+values.map(([v,t])=>'<option value="'+esc(v)+'" '+(v==current?'selected':'')+'>'+esc(t)+'</option>').join('')+'</select></label>';
const form=(id,body,label)=>'<form data-form="'+id+'">'+body+'<span class="msg" role="alert"></span><div><button>'+label+'</button></div></form>';
const grades=Array.from({length:6},(_,i)=>[i+1,'小学'+(i+1)+'年生']);
const firstSubject='算数';
const mins=ms=>ms<60000?'1分未満':Math.floor(ms/60000)+'分';
const last=()=>f.history.at(-1);
function historyByDay(records){
 const days=new Map();
 for(const s of [...records].reverse()){
  if(!days.has(s.date))days.set(s.date,[]);
  days.get(s.date).push(s);
 }
 return [...days].sort(([a],[b])=>b.localeCompare(a)).map(([date,sessions])=>
  '<section class="history-day"><h2>'+esc(date)+'</h2>'+sessions.map(s=>
   '<details class="record"><summary>'+esc(s.subject)+' ／ '+esc(s.material)+'</summary>'+
   '<h3>自分で気づいたこと</h3><p>'+esc(s.insight||'記入なし')+'</p>'+
   '<h3>できたこと</h3><p>'+esc(s.done)+'</p><h3>質問とヒント</h3>'+
   (s.questions.length?s.questions.map(q=>'<p>'+esc(q.text)+'</p>'+q.hints.map(h=>'<blockquote>'+esc(h)+'</blockquote>').join('')).join(''):'<p>質問はありません。</p>')+
   '<h3>つぎに取り組むこと</h3><p>'+esc(s.next||'記入なし')+'</p><p class="muted">めあて　'+esc(s.goal)+' ／ 学習時間 '+mins(s.ms)+'</p></details>'
  ).join('')+'</section>'
 ).join('');
}
function parentView(){
 if(f.pin&&unlocked!==f.pin)return panel('保護者用の暗証番号',form('unlock',input('暗証番号（数字4桁）','code','','inputmode="numeric" type="password" pattern="[0-9]{4}" required'),'ひらく'));
 if(!f.paired)return panel('ててまるを迎えよう','<p>この画面でペアリングを体験できます。実物の機器や通信許可は不要です。</p>'+actions(btn('ててまるを探す','pair')));
 if(!f.name)return panel('ペアリングが完了しました','<p>学習記録で使うお子さんの名前と学年を登録してください。</p>'+form('register',input('お子さんの名前','name','','required')+select('学年','grade',grades,1),'登録して入口に戻る'));
 if(route==='parent-reset')return panel('家庭の記録をすべて消しますか？','<p>このブラウザの名前・学年・呼び名・ペアリング・暗証番号・途中の宿題・すべての学習記録が消えます。元には戻せません。</p>'+actions(link('消さずに戻る','parent-settings'),btn('家庭のデータを消す','erase')));
 if(route==='parent-settings')return panel('家庭の設定','<p>名前や学習記録は、このブラウザに保存されます。</p>'+form('profile',input('学習記録で使う名前','name',f.name,'required')+select('学年','grade',grades,f.grade),'変更を保存')+'<h2>保護者用の暗証番号</h2>'+form('pin',input('新しい数字4桁（空欄で解除）','code','','type="password" inputmode="numeric" pattern="[0-9]{4}"'),'暗証番号を保存')+'<h2>ててまるのペアリング</h2><p>Web上の模擬ペアリングが完了しています。</p>'+actions(btn('再接続する','reconnect'),link('家庭データを初期化','parent-reset'),link('記録に戻る','parent')));
 const rows=historyByDay(f.history);
 return panel(esc(f.name)+'さんの学習記録',rows||'<p>まだ学習記録はありません。入口の「お子さん」から、最初の宿題を始められます。</p>')+actions(link('家庭の設定','parent-settings'),link('入口へ戻る','home'));
}
function hints(s){
 const low=Number(f.grade)<=2;
 const question=s.questions.at(-1)?.text||'';
 if(s.subject==='英語'){
  return low?['えを みて、しっている ことばを さがそう。','その ことばを、こえに だして みよう。','どの えに あうか、ゆびで さして みよう。']:
   ['知っている単語を一つ見つけてみよう。','絵や前後の文から、だれが何をしているか考えよう。','主語を自分に変えて、短い英文を作れるかな？'];
 }
 const base=s.subject==='算数'?(question.includes('あまり')||question.includes('わり算')?'あまった分は、もんだいの中でどうなるかな？':'わかっている 数に まるを つけてみよう。'):s.subject==='国語'?'大切だと おもう ことばに 線を ひこう。':s.subject==='理科'?'かわった ところを 一つ さがしてみよう。':s.subject==='社会'?'地図や 写真で 手がかりを さがそう。':'わかる ところを 一つ 見つけてみよう。';
 return [base,low?'えに かくと、どうなるかな？':'わかっていることと、知りたいことを分けて書けるかな？',low?'いま わかったことを、おしえて。':'紙に書いたことを見ながら、自分の言葉で説明してみよう。'];
}
function childView(){
 const kid=(t,b)=>panel(t,b,true),s=f.active;
 if(!f.paired||!f.name)return kid('こんにちは、ててまるだよ。','<p>はじめは、おうちのひとと いっしょに きてね。</p>'+actions(link('いりぐちに もどる','home')));
 if(!f.nick||route==='child-name')return kid('なんて よんでほしい？',form('nick',input('よんでほしい なまえ','nick',f.nick,'autocomplete="off" required'),'この なまえに する'));
 if(s){
  if(s.status==='paused')return kid('ちょっと ひとやすみ。','<p class="rest-message" role="status">ゆっくり のびを しよう。</p>'+actions(btn('ぎゅっと する','rest-hug'),btn('つづきに もどる','resume')));
  if(route==='child-finish')return kid('きょう、何が できた？',form('finish',area('できたこと','done',s.done,true)+area('つぎに やりたいこと','next',s.next),'きろくして おわる')+actions(link('べんきょうに もどる','child')));
  return kid(esc(f.nick)+'、いっしょに 考えよう。','<p class="note">'+esc(s.subject)+' ／ '+esc(s.material)+'<br>めあて　'+esc(s.goal)+(s.plan?'<br>このまえ きめたこと　'+esc(s.plan):'')+'</p>'+form('ask',area('ききたいこと','question',s.draft,true),'ててまるに きく')+s.questions.map((q,i)=>'<div class="record"><b>'+esc(q.text)+'</b>'+q.hints.map(h=>'<blockquote>'+esc(h)+'</blockquote>').join('')+(i===s.questions.length-1&&q.hints.length<3?btn('つぎの ヒント','hint'):'')+'</div>').join('')+area('わかったこと','insight',s.insight)+actions(btn('ひとやすみ','pause'),link('べんきょうを おわる','child-finish'),link('よびかたを かえる','child-name')));
 }
 if(route==='child-done')return kid(esc(f.nick)+'、おつかれさま！','<p>きょうの「できた！」を のこしたよ。</p>'+actions(link('いりぐちに もどる','home'),link('つぎの おべんきょう','child')));
 const prev=last();return kid(esc(f.nick)+'、なにを しよう？',(prev?'<p class="note">このまえの つづき　'+esc(prev.next||prev.material)+'</p>'+actions(btn('つづきから はじめる','continue-study')):'')+form('start','<subject-book><input type=hidden name=subject value="'+esc(prev?.subject||firstSubject)+'"></subject-book>'+input('つかう ドリルや プリント','material',prev?.material,'required placeholder="れい：さんすうドリル"')+select('きょうの めあて','goal',['まず1問','5分だけ','10分だけ','1ページ'].map(x=>[x,x]),prev?.goal),'おべんきょうを はじめる')+actions(link('よびかたを かえる','child-name')));
}
function guide(){return panel('つかいかた','<h2>おうちで使うとき</h2><p>保護者の方がててまるを迎えて、名前と学年を登録します。入口に戻って、お子さんに端末を渡してください。</p><h2>宿題をするとき</h2><p>紙の教材を開いて、今日はどこまで取り組むか決めましょう。質問や気づきは保護者の学習記録に残ります。</p><h2>記録の保存場所</h2><p>家庭の記録は、この端末のこのブラウザに保存します。ブラウザのデータを削除すると消えます。発表用デモは別の記録を使います。</p>'+actions(link('入口へ戻る','home')))}
function render(){
 const d=route.startsWith('demo'),p=route.startsWith('parent'),child=route.startsWith('child');
 app.dataset.mode=d?'demo':'family';
 app.dataset.role=p?'parent':child?'child':d?'demo':'guide';
 const body=p?parentView():child?childView():d?demo(route,ui):guide();
 app.innerHTML='<div class="inner"><nav class="crumb"><a href="./trial.html">いりぐち</a><span aria-hidden="true">/</span><span>'+ (p?'保護者の方':child?'お子さん':d?'発表用デモ':'つかいかた')+'</span></nav>'+body+'</div>';
 const next=child&&route!=='child-name'&&f.active?.status==='active'&&!document.hidden?f.active.id:'';
 if(next!==tracked){tracked=next;tick=performance.now()}
}
function flushTime(){
 const id=tracked,now=performance.now();
 const end=Math.round(performance.timeOrigin+now);
 const start=Math.max(end-9000,Math.round(performance.timeOrigin+tick));
 tick=now;
 if(id&&end>start)queue(async()=>{f=await family(v=>{
   const s=v.active;
   if(s?.id!==id||s.status!=='active')return false;
   const covered=s.countedUntil>end+9000?0:(s.countedUntil||0);
   s.ms+=Math.max(0,end-Math.max(start,covered));
   s.countedUntil=Math.max(end,covered);
 });if(tracked===id&&(f.active?.id!==id||f.active.status!=='active')){tracked='';render()}});
}
function go(r){
 if(r==='home'){flushTime();tracked='';tail.then(()=>location.assign('./trial.html'));return}
 if(location.hash.slice(1)!==r){location.hash=r;return}
 loadRoute();
}
let routeRevision=0;
async function loadRoute(){
 const revision=++routeRevision;
 flushTime();tracked='';await tail;
 if(revision!==routeRevision)return;
 route=location.hash.slice(1)||'home';
 if(!route.startsWith('parent'))unlocked='';
 if(route==='home'){location.replace('./trial.html');return}
 if(route.startsWith('parent')||route.startsWith('child')){
  await queue(async()=>{const latest=await family();if(revision===routeRevision)f=latest});
  if(revision!==routeRevision)return;
 }
 document.querySelector('#error').textContent='';
 render();window.scrollTo(0,0);app.focus({preventScroll:true});
}
function update(fn){return queue(async()=>{f=await family(fn)})}
async function parentChange(change){
 let allowed=false;
 await update(value=>{
  allowed=route.startsWith('parent')&&(!value.pin||value.pin===unlocked);
  if(allowed)change(value);
 });
 if(!allowed){unlocked='';render()}
 return allowed;
}
function activeChange(fn){
 const id=f.active?.id;return update(v=>{if(id&&v.active?.id===id)fn(v.active,v)});
}
async function handle(a){
 if(a.startsWith('demo-')){await demoAction(a,go);return}
 if(['erase','reconnect','pair'].includes(a)){
  if(!route.startsWith('parent')||f.pin&&unlocked!==f.pin)return;
  if(a==='pair'&&await parentChange(v=>{v.paired=true}))go('parent');
  if(a==='reconnect'&&await parentChange(v=>{v.paired=true})){render();app.querySelector('.panel').insertAdjacentHTML('afterbegin','<p class="status" role="status">ペアリングが完了しました</p>')}
  if(a==='erase'&&route==='parent-reset'&&await parentChange(v=>Object.assign(v,initial()))){unlocked='';go('home')}return;
 }
 if(a==='rest-hug'&&f.active?.status==='paused'){
  app.querySelector('plush-pal')?.playMotion?.('hug');
  app.querySelector('.rest-message').textContent='ぎゅっ。ここで いっしょに やすもう。';
  return;
 }
 if(a==='continue-study'){
  await update(v=>{
   const previous=v.history.at(-1);
   if(!v.active&&previous)v.active=newStudy({subject:previous.subject,material:previous.material,goal:previous.goal,plan:previous.next||''});
  });go('child');return;
 }
 flushTime();await tail;
 if(a==='pause'||a==='resume')await activeChange(s=>{s.status=a==='pause'?'paused':'active'});
 if(a==='hint')await activeChange(s=>{const q=s.questions.at(-1);if(q&&q.hints.length<3)q.hints.push(hints(s)[q.hints.length])});
 render();
}
function newStudy(fields){
 return {id:newId(),date:dateAt(),...fields,ms:0,status:'active',questions:[],insight:'',draft:'',done:'',next:''};
}
async function submit(formEl){
 const data=Object.fromEntries([...new FormData(formEl)].map(([k,v])=>[k,String(v).trim()])),kind=formEl.dataset.form;
 if([...formEl.elements].some(el=>el.required&&!el.value.trim())){formEl.querySelector('.msg').textContent='文字を 入れてね。';return}
 if(kind==='unlock'){const [salt,expected]=f.pin.split('.');if(await pinHash(data.code,salt)!==expected){formEl.querySelector('.msg').textContent='暗証番号を確認してください。';return}unlocked=f.pin;render();return}
 if(['register','profile','pin'].includes(kind)&&(!route.startsWith('parent')||f.pin&&f.pin!==unlocked))return;
 if(kind==='register'||kind==='profile'){if(await parentChange(v=>{v.name=data.name;v.grade=Number(data.grade)}))go(kind==='register'?'home':'parent');return}
 if(kind==='pin'){const salt=newId(),hash=data.code?salt+'.'+await pinHash(data.code,salt):'';if(await parentChange(v=>{v.pin=hash})){unlocked=hash;go('parent')}return}
 if(kind==='nick')await update(v=>{v.nick=data.nick});
 if(kind==='start')await update(v=>{if(!v.active)v.active=newStudy(data)});
 if(kind==='ask')await activeChange(s=>{s.questions.push({text:data.question,hints:[]});s.questions.at(-1).hints.push(hints(s)[0]);s.draft=''});
 if(kind==='finish'){flushTime();await activeChange((s,v)=>{Object.assign(s,data,{status:'completed'});v.history.push(s);v.active=null});go('child-done');return}
 go('child');
}
document.addEventListener('click',async e=>{
 const homeLink=e.target.closest('a[href="./trial.html"]');
 if(homeLink&&!e.ctrlKey&&!e.metaKey&&!e.shiftKey&&!e.altKey&&e.button===0){
  e.preventDefault();go('home');return;
 }
 const b=e.target.closest('button');if(!b||busy)return;
 if(b.dataset.go){go(b.dataset.go);return}
 if(!b.dataset.act)return;
 busy=true;try{await handle(b.dataset.act)}catch{report()}finally{busy=false}
});
document.addEventListener('submit',async e=>{e.preventDefault();if(busy)return;busy=true;try{await submit(e.target)}catch{report()}finally{busy=false}});
document.addEventListener('input',e=>{const key={insight:'insight',question:'draft',done:'done',next:'next'}[e.target.name];if(key&&route.startsWith('child')&&f.active){const value=e.target.value;activeChange(s=>{s[key]=value})}});
document.addEventListener('visibilitychange',()=>{if(document.hidden){flushTime();tracked=''}else if(route.startsWith('child')&&route!=='child-name'&&f.active?.status==='active'){tracked=f.active.id;tick=performance.now()}});
window.addEventListener('pagehide',flushTime);window.addEventListener('hashchange',()=>loadRoute().catch(report));setInterval(flushTime,3000);
window.addEventListener('pageshow',e=>{if(e.persisted){unlocked='';tracked='';loadRoute().catch(report)}});
if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});
loadRoute().catch(report);
