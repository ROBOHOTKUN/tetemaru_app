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
