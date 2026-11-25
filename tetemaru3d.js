// ててまる 3D(Blender でレンダリングした連番 WebP)を canvas で再生する
// 素材: assets/tetemaru/<動き>/0001.webp …(blender/tetemaru_model.py で生成)
//
// 使い方:
//   const t = new TetemaruPlayer(document.querySelector("canvas"), { intro: true });
//   t.onFrame((clip, frame) => { ... });   // コマが進むたび
//   t.onFinish((clip) => { ... });         // idle 以外の動きが終わったとき
//   t.play("happy");                       // 1回再生して待機(idle)に戻る
//
// intro: true のときは、最初に登場の一回転(intro)を再生してから待機に入る。
// 画像を読み込めない環境では、canvas の隣の代わりの線画SVGを見せたまま静かに止まる
// (intro を待っている処理のために、onFinish("intro") だけは呼ぶ)。

const TETEMARU_CLIPS = { intro: 40, idle: 48, happy: 30, hug: 28 };
const TETEMARU_FPS = 24;
const TETEMARU_BASE = "assets/tetemaru/";
const TETEMARU_SIZE = { w: 500, h: 600 };

// 同じ画像を複数の canvas で使い回す(ページ内で1回だけ読み込む)
const tetemaruFrames = {};
function loadTetemaruClip(name) {
  if (!tetemaruFrames[name]) {
    const n = TETEMARU_CLIPS[name];
    tetemaruFrames[name] = Promise.all(
      Array.from({ length: n }, (_, i) => new Promise((resolve, reject) => {
        const img = new Image();
        img.decoding = "async";
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = `${TETEMARU_BASE}${name}/${String(i + 1).padStart(4, "0")}.webp`;
      }))
    );
  }
  return tetemaruFrames[name];
}

class TetemaruPlayer {
  constructor(canvas, { still = false, intro = false } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.clip = "idle";
    this.frame = 0;
    this.frames = {};
    this.still = still || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.listeners = [];
    this.frameListeners = [];
    this.resize();
    window.addEventListener("resize", () => this.resize());

    const withIntro = intro && !this.still;
    const first = withIntro ? ["intro", "idle"] : ["idle"];
    Promise.all(first.map(loadTetemaruClip)).then((loaded) => {
      first.forEach((k, i) => { this.frames[k] = loaded[i]; });
      this.clip = withIntro ? "intro" : "idle";
      this.canvas.classList.add("is-ready");
      this.draw();
      if (!this.still) this.start();
      if (intro && !withIntro) this.emitFinish("intro");
      // 最初の動きを出したあとで残りを読む
      Object.keys(TETEMARU_CLIPS).filter((k) => !first.includes(k)).forEach((k) => {
        loadTetemaruClip(k).then((f) => { this.frames[k] = f; }).catch(() => {});
      });
    }).catch(() => {
      // 画像がなければ代わりの表示のまま。登場を待つ処理は先へ進める
      if (intro) this.emitFinish("intro");
    });
  }

  emitFinish(clip) { this.listeners.forEach((fn) => fn(clip)); }

  resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const rect = this.canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(rect.width * dpr));
    const h = Math.max(1, Math.round(rect.height * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
      this.draw();
    }
  }

  start() {
    let last = performance.now();
    const step = 1000 / TETEMARU_FPS;
    const loop = (now) => {
      if (now - last >= step) {
        last = now - ((now - last) % step);
        this.advance();
      }
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  advance() {
    const frames = this.frames[this.clip];
    if (!frames) return;
    this.frame += 1;
    if (this.frame >= frames.length) {
      this.frame = 0;
      if (this.clip !== "idle") {
        const done = this.clip;
        this.clip = "idle";
        this.emitFinish(done);
      }
    }
    this.draw();
    this.frameListeners.forEach((fn) => fn(this.clip, this.frame));
  }

  onFrame(fn) { this.frameListeners.push(fn); }

  draw() {
    const frames = this.frames[this.clip];
    if (!frames) return;
    const img = frames[this.frame];
    const { width: cw, height: ch } = this.canvas;
    const scale = Math.min(cw / TETEMARU_SIZE.w, ch / TETEMARU_SIZE.h);
    const w = TETEMARU_SIZE.w * scale, h = TETEMARU_SIZE.h * scale;
    this.ctx.clearRect(0, 0, cw, ch);
    this.ctx.drawImage(img, (cw - w) / 2, ch - h, w, h);
  }

  // 動きを1回再生する(読み込みがまだなら何もしない)。戻り値: 再生したかどうか
  play(name) {
    if (this.still || !this.frames[name]) return false;
    this.clip = name;
    this.frame = 0;
    this.draw();
    return true;
  }

  isBusy() { return this.clip !== "idle"; }

  onFinish(fn) { this.listeners.push(fn); }
}
