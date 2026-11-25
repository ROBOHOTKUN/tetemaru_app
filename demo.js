// This key belongs exclusively to the walk-through for the competition.
const DEMO_KEY = 'tetemaru.demo.v1';
export const hints = [
  '5脚には20人がすわれるね。のこりの3人は、どこにすわろうか？',
  'いすをもう1脚おいてみよう。のこりの3人は、みんなすわれるかな？'
];
const answerFeedback = {
  5: '5脚だと20人だね。のこりの3人のぶんも考えてみよう。',
  7: 'いすを1脚ずつならべて、みんながすわったところで数えてみよう。'
};
export const records = [
  {
    subject: '算数', material: 'あまりのあるわり算', daysAgo: 0, minutes: 12,
    question: '23÷4は5あまり3。5脚でいいの？',
    thought: 'わり算は自分でできた。残り3人が座る場所を考えて、もう1脚必要だと気づいた。',
    hint: hints[0], next: '人数がかわっても、絵をかいて考えてみる。'
  },
  {
    subject: '理科', material: 'こん虫のからだ', daysAgo: 1, minutes: 9,
    question: '足はどこから生えているの？',
    thought: '図の足を一本ずつたどると、6本とも胸につながっていると気づいた。',
    hint: '足のつけねを、えんぴつでたどってみよう。', next: 'ほかのこん虫の足も見くらべたい。'
  },
  {
    subject: '算数', material: 'あまりのあるわり算', daysAgo: 3, minutes: 8,
    question: 'あまりは、わる数より大きくてもいい？',
    thought: 'おはじきを配り直して、もう一組作れることを確かめた。',
    hint: 'のこったおはじきで、もう一組つくれるかな？', next: 'あまりが出る文章題をやってみる。'
  }
];

function initialState() {
  return { step: 'problem', hint: 0, paused: false, hugged: false, feedback: '' };
}

let temporaryState;
function saveState(state) {
  try {
    if(state)localStorage.setItem(DEMO_KEY,JSON.stringify(state));
    else localStorage.removeItem(DEMO_KEY);
    temporaryState=undefined;
  } catch {
    temporaryState=state||initialState();
  }
}
function loadState() {
  if(temporaryState)return {...temporaryState};
  try {
    const saved = JSON.parse(localStorage.getItem(DEMO_KEY));
    if (!saved || !['problem','hint','answer','done'].includes(saved.step)) return initialState();
    return {
      step: saved.step,
      hint: saved.hint === 1 ? 1 : 0,
      paused: saved.paused === true,
      hugged: saved.hugged === true,
      feedback: Object.values(answerFeedback).includes(saved.feedback) ? saved.feedback : ''
    };
  } catch {
    return initialState();
  }
}

function dayLabel(daysAgo) {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return new Intl.DateTimeFormat('ja-JP', {month: 'long', day: 'numeric', weekday: 'short'}).format(date);
}

function secondary(label, route) {
  return `<button type="button" class="secondary" data-go="${route}">${label}</button>`;
}

function action(label, name, style = 'secondary') {
  return `<button type="button" class="${style}" data-act="demo-${name}">${label}</button>`;
}

function links(...items) {
  return `<div class="actions">${items.join('')}</div>`;
}

const hugReply = 'ぎゅーっ。ゆい、いっしょにいてくれてうれしいな。';
const demoPal = '<plush-pal data-motion="idle"></plush-pal>';

function childContent(state) {
  if (state.paused) {
    return `<h1>ひとやすみしよう。</h1><p role="status">${state.hugged ? hugReply : 'ゆい、ちょっと のびをしてみよう。'}</p>${links(action('ててまるをハグする', 'hug'), action('もんだいにもどる', 'resume', ''))}`;
  } else if (state.step === 'done') {
    return `<h1>ゆい、できたね！</h1><p>「もう1脚あればいいから、全部で6脚！」</p><p class="note">のこりの3人のことも、ちゃんと考えられたね。</p>${links(secondary('保護者の「今日の質問」を見る', 'demo-record-0'), action('もういちど やってみる', 'again'))}`;
  } else {
    const problem = '<p>23人が長いすにすわります。1脚には4人まですわれます。みんながすわるには、何脚いるかな？</p>';
    let task;
    if (state.step === 'problem') {
      task = `<p class="note">ゆい「23÷4は5あまり3。5脚でいいの？」</p>${links(action('ててまるに きいてみる', 'ask', ''))}`;
    } else if (state.step === 'hint') {
      task = `<p class="note" role="status">${hints[state.hint]}</p>${links(action('こたえてみる', 'answer', ''), state.hint === 0 ? action('つぎのヒント', 'hint') : action('まえのヒント', 'first-hint'))}`;
    } else {
      task = `<h2>いすは 何脚かな？</h2>${links(...[5, 6, 7].map(n => action(n + '脚', 'choose-' + n)))}<p class="note" role="status">${state.feedback || '考えたこたえを えらんでね。'}</p>${links(action('ヒントをもういちど', 'first-hint'))}`;
    }
    return `<h1>長いすのもんだい</h1>${problem}${task}${links(action('ちょっと やすむ', 'pause'))}`;
  }
}

function child(state) {
  const switchRole = links(secondary('保護者の記録を見る', 'demo-parent'), secondary('デモの入口へ', 'demo'));
  return `<section class="panel stack">${demoPal}<p class="note">発表用デモ ／ ゆい・小学3年生</p><div id="demo-conversation" class="stack" tabindex="-1">${childContent(state)}</div></section>${switchRole}`;
}

function parent(route, ui) {
  if (/^demo-record-[012]$/.test(route)) {
    const index = Number(route.slice(-1));
    const row = records[index];
    return `<section class="panel stack"><p class="note">発表用デモ ／ ゆいの記録</p><h1>${index === 0 ? '今日の質問' : dayLabel(row.daysAgo) + 'の質問'}</h1><p>「${row.question}」</p><h2>自分で考えられたこと</h2><p>${row.thought}</p><h2>ててまるのヒント</h2><p>${row.hint}</p><h2>次にやりたいこと</h2><p>${row.next}</p><p class="note">${dayLabel(row.daysAgo)} ／ ${row.subject}「${row.material}」 ／ ${row.minutes}分</p>${links(ui.link('記録一覧へ', 'demo-parent'), secondary('ゆいの体験へ', 'demo-child'))}</section>`;
  }
  const byMaterial = route === 'demo-materials';
  const groups = new Map();
  for (const [index, row] of records.entries()) {
    const key = byMaterial ? row.material : dayLabel(row.daysAgo);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(secondary(byMaterial ? dayLabel(row.daysAgo) + 'の記録' : row.subject + ' ／ ' + row.material, 'demo-record-' + index));
  }
  const list = Array.from(groups, ([title, items]) => `<section><h3>${title}</h3>${links(...items)}</section>`).join('');
  return `<section class="panel stack"><p class="note">発表用デモ ／ 保護者</p><h1>ゆいの学習記録</h1><p>理科の生き物や実験が好きな、小学3年生。</p>${links(ui.link('今日の質問', 'demo-record-0'))}<h2>${byMaterial ? '教材別' : '日別'}の記録</h2>${links(secondary(byMaterial ? '日別に見る' : '教材別に見る', byMaterial ? 'demo-parent' : 'demo-materials'))}${list}</section>${links(secondary('ゆいの体験へ', 'demo-child'), secondary('デモの入口へ', 'demo'))}`;
}

export function demo(route, ui) {
  if (route === 'demo-child') return child(loadState());
  if (route === 'demo-parent' || route === 'demo-materials' || route.startsWith('demo-record-')) return parent(route, ui);
  if (route === 'demo-reset') {
    return `<section class="panel stack"><h1>デモを最初に戻しますか？</h1><p>ゆいの体験を最初の問題に戻します。家庭の学習記録はそのままです。</p>${links(ui.btn('デモをリセットする', 'demo-reset'), secondary('キャンセル', 'demo'))}</section>`;
  }
  return `<section class="panel stack">${ui.friend}<h1>ゆいの宿題を体験</h1><p>生き物や実験が好きな小学3年生のゆい。今日は、あまりのあるわり算に挑戦します。</p>${links(ui.link('お子さんの体験', 'demo-child'), secondary('保護者の体験', 'demo-parent'))}</section>${links(secondary('デモを最初から', 'demo-reset'), secondary('入口へもどる', 'home'))}`;
}

export function demoAction(actionName, go) {
  const state = loadState();
  if (actionName === 'demo-reset' || actionName === 'demo-again') {
    saveState(null);
    go(actionName === 'demo-reset' ? 'demo' : 'demo-child');
    return true;
  }
  switch (actionName) {
    case 'demo-ask':
    case 'demo-first-hint':
      state.step = 'hint'; state.hint = 0; break;
    case 'demo-hint':
      state.step = 'hint'; state.hint = 1; break;
    case 'demo-answer':
      state.step = 'answer'; state.feedback = ''; break;
    case 'demo-choose-5':
      state.feedback = answerFeedback[5]; break;
    case 'demo-choose-7':
      state.feedback = answerFeedback[7]; break;
    case 'demo-choose-6':
      state.step = 'done'; break;
    case 'demo-pause':
      state.paused = true; state.hugged = false; break;
    case 'demo-hug':
      state.hugged = true; break;
    case 'demo-resume':
      state.paused = false; break;
    default:
      return false;
  }
  saveState(state);
  const conversation = document.getElementById('demo-conversation');
  if (!conversation) {
    go('demo-child');
    return true;
  }
  const pal = conversation.parentElement.querySelector('plush-pal');
  if (actionName === 'demo-hug') {
    conversation.querySelector('[role="status"]').textContent = hugReply;
    pal?.playMotion?.('hug');
  } else {
    conversation.innerHTML = childContent(state);
    conversation.focus({preventScroll:true});
    if (actionName === 'demo-choose-6') pal?.playMotion?.('happy');
  }
  return true;
}
