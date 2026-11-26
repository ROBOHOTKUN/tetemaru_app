// The interactive controls and heart gauge use the ZIP child screen's behavior.
export function mountChildUI(prefs,savePref){
let greeting="きょうも いっしょに がんばろう!";
function setPref(key,value){prefs[key]=value;savePref(key,value)}
// ---- ててまる(3D)とセリフ ----
const tetemaru = document.getElementById("mainPal");
const speechEl = document.getElementById("speech");
let speechTimer = null;
function setSpeech(text, { voice = true, keep = false } = {}) {
  speechEl.textContent = text;
  speechEl.classList.remove("pop");
  void speechEl.offsetWidth;
  speechEl.classList.add("pop");
  if (voice) sayIfOn(text);
  clearTimeout(speechTimer);
  if (!keep) speechTimer = setTimeout(() => { speechEl.textContent = greeting; }, 4000);
}

// タップの反応(viewer.js が選ぶ)ごとのセリフ
const TAP_LINES = {
  wave: ["やあ!", "おーい!"],
  happy: ["わーい!", "くるっと まわったよ!"],
  bounce: ["ぴょん ぴょん!", "いっしょに あそぼ!"],
  hug: ["ぎゅーっ!", "えへへ、うれしいな!"],
  sway: ["くすぐったいよ〜", "てれちゃうな〜"],
};
tetemaru.addEventListener("pal-tap", (e) => {
  const lines = TAP_LINES[e.detail?.kind] || TAP_LINES.wave;
  setSpeech(lines[Math.floor(Math.random() * lines.length)]);
});

// ---- あたたかさ(下から出るシート) ----
const heat = document.getElementById("heat");
const heatLabel = document.getElementById("heatLabel");
const heatSatValue = document.getElementById("heatSatValue");
const heatSheet = document.getElementById("heatSheet");
const heatSat = document.getElementById("heatSat");
// ててまるの体を温めるヒーター。ぎゅっとしたときに服ごしに温かく感じる範囲で、
// 低温やけどを避けるため 40ど を上限にする(ひとの肌は 33〜34ど、体温は 36〜37ど くらい)。
const heatZone = document.getElementById("heatZone");
const heatNote = document.getElementById("heatNote");
const heatOff = document.getElementById("heatOff");
const HEAT_MIN = 34, HEAT_MAX = 40, HEAT_DEFAULT = 37;
const HEAT_ZONES = [
  [35, "ほんのり", "ぎゅっと すると、ほんのり あったかい。"],
  [37, "ひとはだ", "ぎゅっと すると、ひとはだ くらいの ぬくもり。"],
  [39, "ぽかぽか", "ぎゅっと すると、ぽかぽか あったかい。"],
  [40, "しっかり", "さむい ひに ぴったりの あたたかさ。"],
];
const savedHeat = Number(prefs.heat);
let heatOn = prefs.heatOn !== false && prefs.heatOn !== "off";
heat.value = savedHeat >= HEAT_MIN && savedHeat <= HEAT_MAX ? String(savedHeat) : String(HEAT_DEFAULT);
function renderHeat() {
  const [, zone, note] = HEAT_ZONES.find(([max]) => Number(heat.value) <= max);
  heatLabel.textContent = heatOn ? heat.value + "ど" : "オフ";
  heatSatValue.textContent = heatOn ? heat.value + "ど" : "オフ";
  heatZone.textContent = heatOn ? zone : "おやすみ";
  heatNote.textContent = heatOn ? note : "いまは あたためて いないよ。";
  heat.setAttribute("aria-valuetext", heat.value + "ど " + zone);
  heatOff.setAttribute("aria-pressed", String(!heatOn));
  heatOff.textContent = heatOn ? "あたためを とめる" : "あたためる";
  heatSheet.classList.toggle("is-off", !heatOn);
}
heat.addEventListener("input", () => {
  if (!heatOn) { heatOn = true; setPref("heatOn", true); }
  setPref("heat", heat.value);
  renderHeat();
});
heatOff.addEventListener("click", () => {
  heatOn = !heatOn;
  setPref("heatOn", heatOn);
  renderHeat();
});
renderHeat();
function openHeatSheet() {
  heatSheet.hidden = false;
  requestAnimationFrame(() => heatSheet.classList.add("open"));
  heat.focus();
}
function closeHeatSheet() {
  heatSheet.classList.remove("open");
  setTimeout(() => { heatSheet.hidden = true; }, 220);
  heatSat.focus();
  const t = Number(heat.value);
  setSpeech(!heatOn ? "あたためは おやすみ するね。" : t >= 38 ? "ぽかぽか あったかいよ!" : t <= 35 ? "ほんのり あったかいよ。" : "ひとはだ くらいの あったかさ!");
}
heatSat.addEventListener("click", openHeatSheet);
heatSheet.querySelectorAll("[data-close]").forEach((el) => el.addEventListener("click", closeHeatSheet));
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !heatSheet.hidden) closeHeatSheet(); });

// ---- ぎゅっとする:タップ反応 ----
const hugBtn = document.getElementById("hugBtn");
hugBtn.addEventListener("click", () => {
  tetemaru.playMotion?.("hug");
  setSpeech(heatOn ? "ぎゅーっ! あったかいね、ありがとう!" : "ぎゅーっ! ありがとう!");
});

// ---- 声のON/OFF ----
const voiceToggle = document.getElementById("voiceToggle");
let voiceOn = prefs.voice !== "off";
voiceToggle.setAttribute("aria-pressed",String(voiceOn));
voiceToggle.addEventListener("click", () => {
  voiceOn = !voiceOn; setPref("voice",voiceOn?"on":"off");
  voiceToggle.setAttribute("aria-pressed", String(voiceOn));
  if (voiceOn) sayIfOn("ててまるだよ、よろしくね!");
});

// voice.js の speak() を、声OFFの時は呼ばないようにラップする
function sayIfOn(text) {
  const hour = new Date().getHours();
  if (voiceOn && !(prefs.sleep!=="off" && (hour>=21 || hour<7))) speak(text);
}

const meter = document.getElementById("affinityMeter");
const water = document.getElementById("affinityWaveGroup");
const affinityPctEl = document.getElementById("affinityPct");
const affinityToastEl = document.getElementById("affinityToast");
let displayed = null;

function renderAffinity(pct, animate = true) {
  const score = Math.max(0,Math.min(100,Math.round(pct)));
  if (!Number.isFinite(score) || score===displayed) return;
  const ratio = score/100;
  // Leave room for both crests at the narrow tip when the heart is nearly empty.
  const waterY = score===0 ? 24 : 20 - 17*(.62*Math.sqrt(ratio)+.38*ratio);
  water.classList.toggle('settle',animate && displayed!==null);
  water.style.transform = `translateY(${waterY}px)`;
  affinityPctEl.textContent = score + "%";
  meter.setAttribute('aria-valuenow',String(score));
  meter.setAttribute('aria-valuetext',score+'パーセント、'+affinityLevelName(score));
  displayed=score;
}

let affinityToastTimer = null;
function celebrateStudy() {
  affinityToastEl.textContent = 'いっしょに勉強して、なかよし度アップ！';
  affinityToastEl.classList.add("show");
  clearTimeout(affinityToastTimer);
  affinityToastTimer = setTimeout(() => affinityToastEl.classList.remove("show"), 1600);
}

function affinityLevelName(n){return n>=90?"ずっといっしょ":n>=60?"大親友":n>=30?"なかよし":"はじめまして"}
function reveal(){
 document.querySelector("#childPhone").classList.remove("is-intro");
 document.querySelector("#stage").classList.remove("is-collapsed");
}
tetemaru.addEventListener('pal-reveal',reveal,{once:true});
if(tetemaru.querySelector(".ready"))reveal();else setTimeout(reveal,3500);
return {setSpeech,renderAffinity,celebrateStudy,setGreeting(text){greeting=text;setSpeech(text,{voice:false,keep:true})}};
}
