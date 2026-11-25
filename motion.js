const subjects = ['算数','国語','理科','社会','英語','そのほか'];
const motifs = ['＋　÷','あ　文','葉　光','山　川','A　a','☆'];
class SubjectBook extends HTMLElement {
 connectedCallback(){
  const field=this.querySelector('input');
  let index=Math.max(0,subjects.indexOf(field.value)), start;
  this.insertAdjacentHTML('beforeend','<div class="bookrow"><button type="button" aria-label="前の教科">‹</button><div class="leaf"><small>きょうか</small><strong aria-live="polite"></strong><i aria-hidden="true"></i></div><button type="button" aria-label="次の教科">›</button></div>');
  const leaf=this.querySelector('.leaf');
  const show=(step=0)=>{
   index=(index+step+subjects.length)%subjects.length;
   field.value=subjects[index];leaf.querySelector('strong').textContent=field.value;
   leaf.querySelector('i').textContent=motifs[index];
   leaf.style.setProperty('--ink',['#ad4843','#704979','#447050','#456e91','#8b4c6e','#846127'][index]);
   if(step&&!matchMedia('(prefers-reduced-motion:reduce)').matches)leaf.animate([{transform:'perspective(550px) rotateY('+step*65+'deg)',opacity:.45},{transform:'perspective(550px) rotateY(0)',opacity:1}],{duration:360,easing:'ease-out'});
  };
  const buttons=this.querySelectorAll('button');buttons[0].onclick=()=>show(-1);buttons[1].onclick=()=>show(1);
  leaf.onpointerdown=e=>{start=e.clientX;leaf.setPointerCapture(e.pointerId)};
  leaf.onpointerup=e=>{if(Math.abs(e.clientX-start)>22)show(e.clientX<start?1:-1)};
  show();
 }
}
customElements.define('subject-book',SubjectBook);
import './viewer.js';
