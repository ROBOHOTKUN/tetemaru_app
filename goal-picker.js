// きょうの もくひょう: なにを はまるいチップ、なんぷん はスライダーで選ぶUI。
// 値は今までどおり <select id="subject"> と <select id="goal"> が持ち、チップはその見た目と操作だけを受け持つ。
// select の値や disabled を変えたあとは、返り値の sync() を呼ぶとチップに反映される。

const ICONS = {
  '算数': '<path d="M12 5v14M5 12h14"/>',
  '国語': '<text x="12" y="17" text-anchor="middle" font-size="15" font-weight="800" fill="currentColor" stroke="none">あ</text>',
  '英語': '<text x="12" y="17" text-anchor="middle" font-size="14" font-weight="800" fill="currentColor" stroke="none">A</text>',
  '理科': '<path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4a2 2 0 0 0 1.8-3l-5-9V3"/><path d="M7.5 15h9"/>',
  '社会': '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  'そのほか': '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
};
const icon = value => `<svg class="goal-chip-icon" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[value] || ICONS['そのほか']}</svg>`;

function chipGroup(select, {label, className, withIcon}) {
  const group = document.createElement('div');
  group.className = 'goal-pick ' + className;
  group.setAttribute('role', 'radiogroup');
  group.setAttribute('aria-label', label);
  group.innerHTML = `<span class="goal-pick-label" aria-hidden="true">${label}</span><div class="goal-chips"></div>`;
  const list = group.lastElementChild;
  for (const option of select.options) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'goal-chip';
    chip.dataset.value = option.value;
    chip.dataset.subject = withIcon ? option.value : '';
    chip.setAttribute('role', 'radio');
    chip.innerHTML = (withIcon ? icon(option.value) : '') + `<span>${option.text}</span>`;
    chip.addEventListener('click', () => {
      if (select.disabled || select.value === option.value) return;
      select.value = option.value;
      select.dispatchEvent(new Event('change', {bubbles: true}));
      chip.classList.remove('is-picked');
      void chip.offsetWidth;                 // 選んだチップを毎回ぽよんとさせる
      chip.classList.add('is-picked');
    });
    list.append(chip);
  }
  // 矢印キーで選び直せるようにする(radiogroup の決まりごと)
  group.addEventListener('keydown', e => {
    const keys = {ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1};
    if (!keys[e.key] || select.disabled) return;
    e.preventDefault();
    const chips = [...list.children];
    const i = chips.findIndex(c => c.dataset.value === select.value);
    const next = chips[(i + keys[e.key] + chips.length) % chips.length];
    next.click();
    next.focus();
  });
  return {group, list, select};
}

// なんぷん: select の選択肢を左から順に並べたスライダー(5ぷんきざみ)
function minuteSlider(select) {
  const group = document.createElement('div');
  group.className = 'goal-pick goal-pick-minutes';
  const last = select.options.length - 1;
  const minutesOf = i => parseInt(select.options[i].text, 10);
  const lo = minutesOf(0), hi = minutesOf(last);
  const ticks = [5, 15, 30, 45, 60].filter(m => m >= lo && m <= hi)
    .map(m => `<span style="left:${(m - lo) / (hi - lo) * 100}%">${m}</span>`).join('');
  group.innerHTML = `<div class="goal-pick-head"><span class="goal-pick-label">なんぷん</span><span class="goal-minutes-value"></span></div>
    <input type="range" class="goal-minutes" min="0" max="${last}" step="1" aria-label="なんぷん やるか">
    <div class="goal-minute-ticks" aria-hidden="true">${ticks}</div>`;
  const slider = group.querySelector('input'), value = group.querySelector('.goal-minutes-value');
  function show(i) {
    const text = select.options[i]?.text || '';
    value.textContent = text;
    slider.setAttribute('aria-valuetext', text);
    slider.style.setProperty('--fill', (i / last * 100) + '%');
  }
  slider.addEventListener('input', () => {
    select.selectedIndex = Number(slider.value);
    show(select.selectedIndex);
    document.getElementById('goalSummary')?.dispatchEvent(new Event('goal-preview'));
  });
  // 指をはなしたときに保存する(動かしているあいだは表示だけ)
  slider.addEventListener('change', () => select.dispatchEvent(new Event('change', {bubbles: true})));
  return {group, sync() { slider.value = String(Math.max(0, select.selectedIndex)); slider.disabled = select.disabled; show(Number(slider.value)); }};
}

export function mountGoalPicker(subjectSelect, goalSelect, container) {
  const groups = [chipGroup(subjectSelect, {label: 'なにを', className: 'goal-pick-subject', withIcon: true})];
  const minutes = minuteSlider(goalSelect);
  container.replaceChildren(groups[0].group, minutes.group);
  const summary = document.getElementById('goalSummary');
  summary?.addEventListener('goal-preview', () => sync());
  function sync() {
    minutes.sync();
    for (const {list, select} of groups) {
      for (const chip of list.children) {
        const on = chip.dataset.value === select.value;
        chip.setAttribute('aria-checked', String(on));
        chip.tabIndex = on ? 0 : -1;
        chip.disabled = select.disabled;
      }
    }
    if (summary) {
      summary.textContent = `${subjectSelect.selectedOptions[0]?.text || ''} を ${goalSelect.selectedOptions[0]?.text || ''}`;
    }
  }
  subjectSelect.addEventListener('change', () => requestAnimationFrame(sync));
  goalSelect.addEventListener('change', () => requestAnimationFrame(sync));
  sync();
  return sync;
}
