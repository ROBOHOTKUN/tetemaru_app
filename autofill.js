// パスワードの入力欄に、暗証番号を1文字ずつ自動で入れて、錠が開く動きのあとに送信する。
// 使い方: autoUnlock(form) … form の中の input[type=password] に入れて form.requestSubmit() する。
import {HOME_PIN} from './store.js';

const lockIcon = `<span class="auto-lock" aria-hidden="true">
  <svg viewBox="0 0 48 48" width="44" height="44">
    <path class="auto-lock-shackle" d="M15 21v-6a9 9 0 0 1 18 0v6" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>
    <rect class="auto-lock-body" x="9" y="21" width="30" height="21" rx="7"/>
    <circle class="auto-lock-hole" cx="24" cy="31" r="3.2"/>
  </svg>
</span>`;

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

export async function autoUnlock(form, code = HOME_PIN) {
  const input = form?.querySelector('input[type="password"]');
  if (!input || form.dataset.autoUnlock) return;
  form.dataset.autoUnlock = 'typing';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const label = input.closest('label') || input;
  label.insertAdjacentHTML('beforebegin', lockIcon);
  const lock = form.querySelector('.auto-lock');
  input.readOnly = true;                       // 自動で入れているあいだは触らせない
  input.value = '';
  input.classList.add('auto-filling');
  await wait(reduced ? 0 : 450);
  for (const digit of code) {
    if (!form.isConnected) return;
    input.value += digit;
    input.dispatchEvent(new Event('input', {bubbles: true}));
    if (!reduced) {
      input.classList.remove('auto-tick');
      void input.offsetWidth;                  // 同じアニメーションを毎回最初から
      input.classList.add('auto-tick');
      await wait(230);
    }
  }
  input.classList.remove('auto-filling');
  input.classList.add('auto-filled');
  lock.classList.add('is-open');
  form.dataset.autoUnlock = 'open';
  await wait(reduced ? 0 : 650);
  if (!form.isConnected) return;
  input.readOnly = false;
  form.requestSubmit();
}
