// node_modules/motion-utils/dist/es/format-error-message.mjs
function e(e, t) {
	return t ? `${e}. For more information and steps for solving, visit https://motion.dev/troubleshooting/${t}` : e;
}
// node_modules/motion-utils/dist/es/errors.mjs
var t = () => {};
typeof process < "u" && process.env.NODE_ENV !== "production" && (t = (t, n, r) => {
	if (!t) throw Error(e(n, r));
});
// node_modules/motion-utils/dist/es/global-config.mjs
var n = {};
// node_modules/motion-utils/dist/es/memo.mjs
/*#__NO_SIDE_EFFECTS__*/
function r(e) {
	let t;
	return () => (t === void 0 && (t = e()), t);
}
// node_modules/motion-utils/dist/es/noop.mjs
var i = /* @__NO_SIDE_EFFECTS__ */ (e) => e, a = /* @__NO_SIDE_EFFECTS__ */ (e) => e * 1e3, o = /* @__NO_SIDE_EFFECTS__ */ (e) => e / 1e3, s = /* @__NO_SIDE_EFFECTS__ */ (e) => Array.isArray(e) && typeof e[0] == "number", c = {
	delta: 0,
	timestamp: 0,
	isProcessing: !1
}, l;
function u() {
	l = void 0;
}
var d = {
	now: () => (l === void 0 && d.set(c.isProcessing || n.useManualTiming ? c.timestamp : performance.now()), l),
	set: (e) => {
		l = e, queueMicrotask(u);
	}
}, f = (e, t, n = 10) => {
	let r = "", i = Math.max(Math.round(t / n), 2);
	for (let t = 0; t < i; t++) r += Math.round(e(t / (i - 1)) * 1e4) / 1e4 + ", ";
	return `linear(${r.substring(0, r.length - 2)})`;
};
// node_modules/motion-dom/dist/es/animation/keyframes/get-final.mjs
function p(e, { repeat: t, repeatType: n = "loop" }, r, i = 1) {
	let a, o, s = 0;
	for (let t = 0; t < e.length; t++) {
		let n = e[t];
		n !== null && (s++ || (a = n), o = n);
	}
	let c = i < 0 || t && n !== "loop" && t % 2 == 1 ? 0 : s - 1;
	return !c || r === void 0 ? c ? o : a : r;
}
// node_modules/motion-dom/dist/es/animation/utils/notify-inspector.mjs
function m(e, t) {
	return {
		kind: e,
		animation: t,
		timestamp: d.now(),
		frameTimestamp: c.timestamp,
		frameIsProcessing: c.isProcessing
	};
}
function h(e, t, n) {
	let r = globalThis.__MOTION_INSPECT__;
	if (r) try {
		r({
			...m("animation-start", e),
			options: n ? {
				...t,
				...n
			} : t
		});
	} catch {}
}
// node_modules/motion-dom/dist/es/animation/utils/WithPromise.mjs
var g = class {
	constructor() {
		this.isResolved = !1;
	}
	get finished() {
		return this._finished ||= this.isResolved ? Promise.resolve() : new Promise((e) => {
			this._resolve = e;
		}), this._finished;
	}
	updateFinished() {
		this._finished = this._resolve = void 0, this.isResolved = !1;
	}
	notifyFinished() {
		this.isResolved = !0, this._resolve?.();
	}
	then(e, t) {
		return this.finished.then(e, t);
	}
};
// node_modules/motion-dom/dist/es/animation/keyframes/utils/fill-wildcards.mjs
function _(e) {
	for (let t = 1; t < e.length; t++) e[t] ?? (e[t] = e[t - 1]);
}
// node_modules/motion-dom/dist/es/render/dom/is-css-var.mjs
var v = (e) => e.startsWith("--");
// node_modules/motion-dom/dist/es/render/dom/style-set.mjs
function y(e, t, n) {
	v(t) ? e.style.setProperty(t, n) : e.style[t] = n;
}
// node_modules/motion-dom/dist/es/utils/supports/flags.mjs
var b = {};
// node_modules/motion-dom/dist/es/utils/supports/memo.mjs
function x(e, t) {
	let n = /* @__PURE__ */ r(e);
	return () => b[t] ?? n();
}
// node_modules/motion-dom/dist/es/utils/supports/scroll-timeline.mjs
var S = /* @__PURE__ */ x(() => window.ScrollTimeline !== void 0, "scrollTimeline"), C = /*@__PURE__*/ x(() => {
	try {
		document.createElement("div").animate({ opacity: 0 }, { easing: "linear(0, 1)" });
	} catch {
		return !1;
	}
	return !0;
}, "linearEasing"), w = ([e, t, n, r]) => `cubic-bezier(${e}, ${t}, ${n}, ${r})`, T = {
	linear: "linear",
	ease: "ease",
	easeIn: "ease-in",
	easeOut: "ease-out",
	easeInOut: "ease-in-out",
	circIn: /*@__PURE__*/ w([
		0,
		.65,
		.55,
		1
	]),
	circOut: /*@__PURE__*/ w([
		.55,
		0,
		1,
		.45
	]),
	backIn: /*@__PURE__*/ w([
		.31,
		.01,
		.66,
		-.59
	]),
	backOut: /*@__PURE__*/ w([
		.33,
		1.53,
		.69,
		.99
	])
};
// node_modules/motion-dom/dist/es/animation/waapi/easing/map-easing.mjs
function E(e, t) {
	if (e) return typeof e == "function" ? C() ? f(e, t) : "ease-out" : /* @__PURE__ */ s(e) ? w(e) : Array.isArray(e) ? e.map((e) => E(e, t) || T.easeOut) : T[e];
}
// node_modules/motion-dom/dist/es/animation/waapi/start-waapi-animation.mjs
function D(e, t, n, { delay: r = 0, duration: i = 300, repeat: a = 0, repeatType: o = "loop", ease: s = "easeOut", times: c } = {}, l = void 0) {
	let u = { [t]: n };
	c && (u.offset = c);
	let d = E(s, i);
	Array.isArray(d) && (u.easing = d);
	let f = {
		delay: r,
		duration: i,
		easing: Array.isArray(d) ? "linear" : d,
		fill: "both",
		iterations: a + 1,
		direction: o === "reverse" ? "alternate" : "normal"
	};
	return l && (f.pseudoElement = l), e.animate(u, f);
}
// node_modules/motion-dom/dist/es/animation/generators/utils/is-generator.mjs
function O(e) {
	return typeof e == "function" && "applyToOptions" in e;
}
// node_modules/motion-dom/dist/es/animation/waapi/utils/apply-generator.mjs
function k({ type: e, ...t }) {
	return O(e) && C() ? e.applyToOptions(t) : (t.duration ??= 300, t.ease ??= "easeOut", t);
}
// node_modules/motion-dom/dist/es/animation/NativeAnimation.mjs
var A = class extends g {
	constructor(e) {
		if (super(), this.finishedTime = null, this.isStopped = !1, this.manualStartTime = null, !e) return;
		let { element: n, name: r, keyframes: i, pseudoElement: a, allowFlatten: o = !1, finalKeyframe: s, onComplete: c } = e;
		this.isPseudoElement = !!a, this.allowFlatten = o, this.options = e, typeof process < "u" && process.env.NODE_ENV !== "production" && t(typeof e.type != "string", "Mini animate() doesn't support \"type\" as a string.", "mini-spring");
		let l = k(e);
		this.animation = D(n, r, i, l, a), l.autoplay === !1 && this.animation.pause(), this.animation.onfinish = this.onFinish = () => {
			if (this.animation.onfinish = null, this.finishedTime = this.time, !a) {
				let e = p(i, this.options, s, this.speed);
				this.updateMotionValue?.(e), y(n, r, e), this.animation.cancel();
			}
			c?.(), this.notifyFinished();
		}, h(this, e, l);
	}
	play() {
		this.isStopped || (this.manualStartTime = null, this.animation.onfinish = this.onFinish, this.animation.play(), this.state === "finished" && this.updateFinished());
	}
	pause() {
		this.animation.pause();
	}
	complete() {
		this.isStopped || (this.animation.onfinish = this.onFinish), this.animation.finish?.();
	}
	cancel() {
		this.animation.onfinish = null;
		try {
			this.animation.cancel();
		} catch {}
	}
	stop() {
		this.isStopped || (this.isStopped = !0, this.state !== "idle" && this.finishedTime === null && (this.updateMotionValue ? this.updateMotionValue() : this.commitStyles(), this.isPseudoElement || this.cancel()));
	}
	commitStyles() {
		let e = this.options?.element;
		!this.isPseudoElement && e?.isConnected && this.animation.commitStyles?.();
	}
	get duration() {
		let e = this.animation.effect?.getComputedTiming?.().duration || 0;
		return /* @__PURE__ */ o(Number(e));
	}
	get iterationDuration() {
		let { delay: e = 0 } = this.options || {};
		return this.duration + /* @__PURE__ */ o(e);
	}
	get time() {
		return /* @__PURE__ */ o(Number(this.animation.currentTime) || 0);
	}
	set time(e) {
		let t = this.finishedTime !== null;
		this.manualStartTime = null, this.finishedTime = null, this.animation.currentTime = /* @__PURE__ */ a(e), t && (this.animation.pause(), this.updateFinished());
	}
	get speed() {
		return this.animation.playbackRate;
	}
	set speed(e) {
		e < 0 && (this.finishedTime = null), this.animation.playbackRate = e;
	}
	get state() {
		return this.finishedTime === null ? this.animation.playState : "finished";
	}
	get startTime() {
		return this.manualStartTime ?? Number(this.animation.startTime);
	}
	set startTime(e) {
		this.manualStartTime = this.animation.startTime = e;
	}
	attachTimeline({ timeline: e, onAttach: t, observe: n }) {
		return this.allowFlatten && this.animation.effect?.updateTiming({ easing: "linear" }), this.animation.onfinish = this.onFinish = null, e && S() ? (this.animation.timeline = e, t?.(this.animation), i) : n(this);
	}
}, j = class {
	constructor(e) {
		this.stop = () => {
			for (let e of this.animations) e.stop();
		}, this.animations = e.filter(Boolean);
	}
	get finished() {
		return Promise.all(this.animations.map((e) => e.finished));
	}
	getAll(e) {
		return this.animations[0][e];
	}
	attachTimeline(e) {
		let t = this.animations.map((t) => t.attachTimeline(e));
		return () => {
			t.forEach((e, t) => {
				e && e(), this.animations[t].stop();
			});
		};
	}
	get time() {
		return this.getAll("time");
	}
	set time(e) {
		for (let t of this.animations) t.time = e;
	}
	get speed() {
		return this.getAll("speed");
	}
	set speed(e) {
		for (let t of this.animations) t.speed = e;
	}
	get state() {
		return this.getAll("state");
	}
	get startTime() {
		return this.getAll("startTime");
	}
	get duration() {
		return M(this.animations, "duration");
	}
	get iterationDuration() {
		return M(this.animations, "iterationDuration");
	}
	play() {
		for (let e of this.animations) e.play();
	}
	pause() {
		for (let e of this.animations) e.pause();
	}
	cancel() {
		for (let e of this.animations) e.cancel();
	}
	complete() {
		for (let e of this.animations) e.complete();
	}
};
function M(e, t) {
	let n = 0;
	for (let r = 0; r < e.length; r++) {
		let i = e[r][t];
		i !== null && i > n && (n = i);
	}
	return n;
}
// node_modules/motion-dom/dist/es/animation/GroupAnimationWithThen.mjs
var N = class extends j {
	then(e, t) {
		return this.finished.finally(e).then(() => {});
	}
}, P = /* @__PURE__ */ new WeakMap(), F = (e, t = "") => `${e}:${t}`;
function I(e) {
	let t = P.get(e);
	return t || (t = /* @__PURE__ */ new Map(), P.set(e, t)), t;
}
// node_modules/motion-dom/dist/es/animation/utils/resolve-transition.mjs
function L(e, t) {
	if (e?.inherit && t) {
		let { inherit: n, ...r } = e;
		return {
			...t,
			...r
		};
	}
	return e;
}
// node_modules/motion-dom/dist/es/animation/utils/get-value-transition.mjs
function R(e, t) {
	let n = e?.[t] ?? e?.default ?? e;
	return n === e ? n : L(n, e);
}
// node_modules/motion-dom/dist/es/animation/waapi/utils/px-values.mjs
var z = /* @__PURE__ */ new Set(/* @__PURE__ */ "borderWidth.borderTopWidth.borderRightWidth.borderBottomWidth.borderLeftWidth.borderRadius.borderTopLeftRadius.borderTopRightRadius.borderBottomRightRadius.borderBottomLeftRadius.width.maxWidth.height.maxHeight.top.right.bottom.left.inset.insetBlock.insetBlockStart.insetBlockEnd.insetInline.insetInlineStart.insetInlineEnd.padding.paddingTop.paddingRight.paddingBottom.paddingLeft.paddingBlock.paddingBlockStart.paddingBlockEnd.paddingInline.paddingInlineStart.paddingInlineEnd.margin.marginTop.marginRight.marginBottom.marginLeft.marginBlock.marginBlockStart.marginBlockEnd.marginInline.marginInlineStart.marginInlineEnd.fontSize.backgroundPositionX.backgroundPositionY".split("."));
// node_modules/motion-dom/dist/es/animation/keyframes/utils/apply-px-defaults.mjs
function B(e, t) {
	for (let n = 0; n < e.length; n++) typeof e[n] == "number" && z.has(t) && (e[n] = e[n] + "px");
}
// node_modules/motion-dom/dist/es/scope/active.mjs
var V = {};
// node_modules/motion-dom/dist/es/utils/resolve-elements.mjs
function H(e, t, n) {
	if (e == null) return [];
	if (e instanceof EventTarget) return [e];
	if (typeof e == "string") {
		let r = t ? t.current : V.current?.root || document, i = n?.[e] ?? r.querySelectorAll(e);
		return i ? Array.from(i) : [];
	}
	return Array.from(e).filter((e) => e != null);
}
// node_modules/motion-dom/dist/es/render/dom/style-computed.mjs
function U(e, t) {
	let n = window.getComputedStyle(e);
	return v(t) ? n.getPropertyValue(t) : n[t];
}
// node_modules/framer-motion/dist/es/animation/animators/waapi/animate-elements.mjs
function W(e, t, n, r) {
	let i = [];
	return G(i, e, t, n, r), K(i);
}
function G(e, n, r, i, o) {
	if (n == null) return;
	let s = H(n, o), c = s.length;
	typeof process < "u" && process.env.NODE_ENV !== "production" && t(!!c, "No valid elements provided.", "no-valid-elements");
	for (let t = 0; t < c; t++) {
		let n = s[t], o = { ...i };
		typeof o.delay == "function" && (o.delay = o.delay(t, c));
		for (let t in r) {
			let i = r[t];
			Array.isArray(i) || (i = [i]);
			let s = { ...R(o, t) };
			s.duration &&= /* @__PURE__ */ a(s.duration), s.delay &&= /* @__PURE__ */ a(s.delay);
			let c = I(n), l = F(t, s.pseudoElement || ""), u = c.get(l);
			u && u.stop(), e.push({
				map: c,
				key: l,
				unresolvedKeyframes: i,
				options: {
					...s,
					element: n,
					name: t,
					allowFlatten: !o.type && !o.ease
				}
			});
		}
	}
}
function K(e) {
	for (let t = 0; t < e.length; t++) {
		let { unresolvedKeyframes: n, options: r } = e[t], { element: i, name: a, pseudoElement: o } = r;
		!o && n[0] === null && (n[0] = U(i, a)), _(n), B(n, a), !o && n.length < 2 && n.unshift(U(i, a)), r.keyframes = n;
	}
	let t = [];
	for (let n = 0; n < e.length; n++) {
		let { map: r, key: i, options: a } = e[n], o = new A(a);
		r.set(i, o), o.finished.finally(() => r.delete(i)), t.push(o);
	}
	return t;
}
var q = /*@__PURE__*/ ((e) => {
	function t(t, n, r) {
		return new N(W(t, n, r, e));
	}
	return t;
})(), J = {
	xmlns: "http://www.w3.org/2000/svg",
	width: 24,
	height: 24,
	viewBox: "0 0 24 24",
	fill: "none",
	stroke: "currentColor",
	"stroke-width": 2,
	"stroke-linecap": "round",
	"stroke-linejoin": "round"
}, Y = ([e, t, n]) => {
	let r = document.createElementNS("http://www.w3.org/2000/svg", e);
	return Object.keys(t).forEach((e) => {
		r.setAttribute(e, String(t[e]));
	}), n?.length && n.forEach((e) => {
		let t = Y(e);
		r.appendChild(t);
	}), r;
}, X = (e, t = {}) => Y([
	"svg",
	{
		...J,
		...t
	},
	e
]), Z = {
	"message-circle": [["path", { d: "M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719" }]],
	pause: [["rect", {
		x: "14",
		y: "3",
		width: "5",
		height: "18",
		rx: "1"
	}], ["rect", {
		x: "5",
		y: "3",
		width: "5",
		height: "18",
		rx: "1"
	}]],
	play: [["path", { d: "M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z" }]],
	send: [["path", { d: "M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z" }], ["path", { d: "m21.854 2.147-10.94 10.939" }]],
	lightbulb: [
		["path", { d: "M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" }],
		["path", { d: "M9 18h6" }],
		["path", { d: "M10 22h4" }]
	]
};
function Q(e, t, n) {
	for (let t of e.querySelectorAll("[data-icon]")) {
		let e = Z[t.dataset.icon];
		e && t.replaceChildren(X(e, {
			width: "18",
			height: "18",
			"stroke-width": "2",
			"aria-hidden": "true"
		}));
	}
	if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
	n && q(e, { transform: ["translateY(8px)", "none"] }, {
		duration: .18,
		ease: "easeOut"
	});
	let r = e.querySelector("[data-reply]"), i = r ? t + ":" + r.textContent : "";
	!n && r && i !== e.dataset.lastReply && q(r, { transform: ["translateY(5px)", "none"] }, {
		duration: .22,
		ease: "easeOut"
	}), e.dataset.lastReply = i;
}
export { Q as decorateSheet };
