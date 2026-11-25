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

const TAP_LINES = ["わーい!", "くすぐったいよ〜", "えへへ、うれしいな!", "いっしょに あそぼ!"];
let tapIndex = 0;
tetemaru.addEventListener("pal-tap", () => {
  setSpeech(TAP_LINES[tapIndex++ % TAP_LINES.length]);
  bumpAffinity(1);
});

// ---- あたたかさ(下から出るシート) ----
const heat = document.getElementById("heat");
const heatLabel = document.getElementById("heatLabel");
const heatSatValue = document.getElementById("heatSatValue");
const heatSheet = document.getElementById("heatSheet");
const heatSat = document.getElementById("heatSat");
heat.value=prefs.heat || "36"; heatLabel.textContent=heatSatValue.textContent=heat.value+"ど";
heat.addEventListener("input", () => {
  setPref("heat",heat.value);
  heatLabel.textContent = heat.value + "ど";
  heatSatValue.textContent = heat.value + "ど";
});
function openHeatSheet() {
  heatSheet.hidden = false;
  requestAnimationFrame(() => heatSheet.classList.add("open"));
  heat.focus();
}
function closeHeatSheet() {
  heatSheet.classList.remove("open");
  setTimeout(() => { heatSheet.hidden = true; }, 220);
  heatSat.focus();
  setSpeech(Number(heat.value) >= 37 ? "ぽかぽか あったかい!" : "ちょうど いい あたたかさ!");
}
heatSat.addEventListener("click", openHeatSheet);
heatSheet.querySelectorAll("[data-close]").forEach((el) => el.addEventListener("click", closeHeatSheet));
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !heatSheet.hidden) closeHeatSheet(); });

// ---- ぎゅっとする:タップ反応 ----
const hugBtn = document.getElementById("hugBtn");
hugBtn.addEventListener("click", () => {
  tetemaru.playMotion?.("hug");
  setSpeech("あったかいね、ありがとう!");
  bumpAffinity(2);
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

// ---- なかよし度:ハートの水ゆらゆらゲージ ----
// ハートの輪郭は y=3(てっぺん)〜y=20(下のとがり)。水位(baselineY)を直接パスに焼き込むことで、
// SVGのtransform単位のあいまいさに左右されず、%とハートの水位を正確に一致させる。
const AFFINITY_TOP_Y = 3;   // 100%のときの水面
const AFFINITY_BOTTOM_Y = 21.5; // 0%のときの水面(ハートの下端より少し下=完全に空)

function buildWavePath(baselineY, phaseDeg) {
  const amp = 0.7, wavelength = 24, step = 3;
  const pts = [];
  for (let x = -24; x <= 48; x += step) {
    const y = baselineY + amp * Math.sin((2 * Math.PI * x) / wavelength + (phaseDeg * Math.PI) / 180);
    pts.push(`${x},${y.toFixed(2)}`);
  }
  return `M ${pts[0]} L ${pts.slice(1).join(" L ")} L 48,30 L -24,30 Z`;
}

const waveBackEl = document.getElementById("affinityWaveBack");
const waveFrontEl = document.getElementById("affinityWaveFront");
const affinityLevelEl = document.getElementById("affinityLevel");
const affinityPctEl = document.getElementById("affinityPct");
const affinityToastEl = document.getElementById("affinityToast");

function pctToBaselineY(pct) {
  return AFFINITY_TOP_Y + ((AFFINITY_BOTTOM_Y - AFFINITY_TOP_Y) * (100 - pct)) / 100;
}

let currentBaselineY = pctToBaselineY(0);
let waveAnimFrame = null;

function drawWaveAt(baselineY) {
  waveBackEl.setAttribute("d", buildWavePath(baselineY, 0));
  waveFrontEl.setAttribute("d", buildWavePath(baselineY, 180));
}

function animateWaveTo(targetBaselineY) {
  cancelAnimationFrame(waveAnimFrame);
  const startY = currentBaselineY;
  const startTime = performance.now();
  const duration = 700;
  function step(now) {
    const t = Math.min(1, (now - startTime) / duration);
    const eased = 1 - Math.pow(1 - t, 3);
    currentBaselineY = startY + (targetBaselineY - startY) * eased;
    drawWaveAt(currentBaselineY);
    if (t < 1) waveAnimFrame = requestAnimationFrame(step);
  }
  waveAnimFrame = requestAnimationFrame(step);
}

function renderAffinity(pct, animate = true) {
  const targetY = pctToBaselineY(pct);
  if (animate) {
    animateWaveTo(targetY);
  } else {
    currentBaselineY = targetY;
    drawWaveAt(targetY);
  }
  affinityLevelEl.textContent = affinityLevelName(pct);
  affinityPctEl.textContent = pct + "%";
}

let affinityToastTimer = null;
function showAffinityToast(text) {
  affinityToastEl.textContent = text;
  affinityToastEl.classList.add("show");
  clearTimeout(affinityToastTimer);
  affinityToastTimer = setTimeout(() => affinityToastEl.classList.remove("show"), 1600);
}

function affinityLevelName(n){return n>=90?"ずっといっしょ":n>=60?"大親友":n>=30?"なかよし":"はじめまして"}
function bumpAffinity(amount) {
  const before=Number(prefs.affinity ?? 15);
  const after=Math.min(100,before+amount);
  const levelUp=affinityLevelName(before)!==affinityLevelName(after);
  setPref("affinity",after);
  renderAffinity(after);
  if (levelUp) {
    showAffinityToast(`なかよし度アップ!「${affinityLevelName(after)}」になったよ`);
    sayIfOn(`なかよし度があがったよ!いまは${affinityLevelName(after)}だね!`);
  } else {
    showAffinityToast("なかよし度アップ!");
  }
}

renderAffinity(Number(prefs.affinity ?? 15),false);
function reveal(){
 document.querySelector("#childPhone").classList.remove("is-intro");
 document.querySelector("#stage").classList.remove("is-collapsed");
}
tetemaru.addEventListener('pal-reveal',reveal,{once:true});
if(tetemaru.querySelector(".ready"))reveal();else setTimeout(reveal,3500);
return {setSpeech,bumpAffinity,setGreeting(text){greeting=text;setSpeech(text,{voice:false,keep:true})}};
}
