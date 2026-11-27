import {clearParentAccess,isDemo} from './zip-records.js';

clearParentAccess();
if(isDemo) {
  document.querySelector('.entry-prompt').textContent='発表用デモで使う画面をえらんでね';
  for(const a of document.querySelectorAll('.entry-choices a')) a.search='?mode=demo';
}
window.addEventListener('pageshow',clearParentAccess);
