import {clearParentAccess,isDemo} from './zip-records.js';

clearParentAccess();
if(isDemo) {
  document.querySelector('.entry-prompt').textContent='発表用デモで使う画面をえらんでね';
  for(const a of document.querySelectorAll('.entry-choices a')) a.search='?mode=demo';
  const exit=document.querySelector('.mode-link');
  exit.href='trial.html';
  exit.textContent='おうちの入口に戻る';
}
window.addEventListener('pageshow',clearParentAccess);
