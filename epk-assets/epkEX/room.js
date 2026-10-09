// Blahsum EPK · EX — "Xerox Room": the 3D stage from one photo, printed like a punk flyer.
// Everything outside the canvas (nav, peek drawer, info page, lightbox) works without WebGL.
// three.js is imported only when the 3D room actually starts.
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const root = document.documentElement, body = document.body;
const app = $('#app'), info = $('#info'), peek = $('#peek'), peekBody = $('#peekBody'), spotsEl = $('#spots'), stickEl = $('#stickers');
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const A = 'epk-assets/epkEX/';
const smooth = () => (RM ? 'auto' : 'smooth');

// ---------------------------------------------------------------- content model
const MEMBERS = {
  singer: { name: 'Vocals', role: 'Garbo — frontman', note: 'Blahsum started as Garbo alone, writing lyrics and cutting together beats in his Chinatown home studio, then releasing the Moon Tapes every full moon.', li: ['garbo'] },
  drums: { name: 'Drums', role: 'Zach M — Garbo’s brother', note: 'Holding down the drums.', li: ['zachm'] },
  sax: { name: 'Saxophone', role: 'Dan Erbland', note: 'On the saxophone.', li: ['dan'] },
  bass: { name: 'Bass', role: 'Alex Torke', note: 'On the bass.', li: ['alex'] },
  guitar: { name: 'Guitars', role: 'Zach Schepis & Nate McManus', note: 'Zach Schepis on lead guitar & harmonica; Nate McManus on rhythm guitar & trumpet.', li: ['schepis', 'nate'] },
};
// photo-space anchors: [u, v (0 = bottom), depth value, depth channel]
const SPOTS = [
  { id: 'win-l', label: 'Bio', open: 'bio', r: -3, a: [0.2754, 0.70, 0.0811, 0] },
  { id: 'win-c', label: 'Watch', open: 'watch', r: 2, a: [0.6377, 0.738, 0.0295, 0] },
  { id: 'win-r', label: 'Booking', open: 'booking', r: -2, a: [0.9258, 0.741, 0.0135, 0] },
  { id: 'spk', label: 'Listen', open: 'listen', r: 3, a: [0.0752, 0.1846, 0.7943, 2] },
  { id: 'box', label: 'Photos', open: 'photos', r: -4, a: [0.4199, 0.7363, 0.0683, 0] },
  { id: 'singer', label: 'Vocals', member: 'singer', a: [0.4443, 0.585, 0.5117, 2] },
  { id: 'drums', label: 'Drums', member: 'drums', a: [0.293, 0.7051, 0.0617, 0] },
  { id: 'sax', label: 'Sax', member: 'sax', a: [0.459, 0.6777, 0.3506, 1] },
  { id: 'bass', label: 'Bass', member: 'bass', a: [0.2832, 0.541, 0.1043, 0] },
  { id: 'gtr-l', label: 'Guitar', member: 'guitar', a: [0.1172, 0.5898, 0.3244, 1] },
  { id: 'gtr-r', label: 'Guitar', member: 'guitar', a: [0.8398, 0.5898, 0.2563, 1] },
];
const SECTION_SPOT = { bio: 'win-l', watch: 'win-c', booking: 'win-r', listen: 'spk', photos: 'box' };
const STICKERS = [
  ['BLAHSUM', 'box'], ['Post-Americana', 'inv'], ['Brooklyn NY', 'round'], ['moon tapes', 'mark'], ['no two shows the same', 'tape'],
  ['★ live ★', 'star'], ['psychedelic rap jam', 'box'], ['Live at Rockaway Beach', 'tape'], ['BLAH!', 'mark'], ['Post-Americana live', 'round'],
];

// ---------------------------------------------------------------- views: room <-> info
let stage = null, glOn = false, inRoom = true, lastFocus = null;
function lazyThumbs(scope) { $$('img[data-src]', scope).forEach(i => { i.src = i.dataset.src; i.removeAttribute('data-src'); }); }
function goInfo(id) {
  closePeek(true);
  const el = (id && id !== 'info' && $('#' + id)) || info;
  lazyThumbs(info);
  el.scrollIntoView({ behavior: smooth(), block: 'start' });
  const h = el === info ? info : (el.querySelector('h2') || el);
  h.focus?.({ preventScroll: true });
}
function goRoom() {
  closePeek(true);
  app.scrollIntoView({ behavior: smooth(), block: 'start' });
  if (location.hash) history.replaceState(null, '', location.pathname + location.search);
}
const viewIO = new IntersectionObserver(([e]) => {
  inRoom = e.intersectionRatio > 0.45;
  body.classList.toggle('in-room', inRoom); body.classList.toggle('in-info', !inRoom);
  $('#modeRoom').setAttribute('aria-pressed', String(inRoom)); $('#modeInfo').setAttribute('aria-pressed', String(!inRoom));
  if (!inRoom) closePeek(true);
  stage?.visible(e.isIntersecting);
}, { threshold: [0, 0.45, 0.46, 1] });
viewIO.observe(app);

// ---------------------------------------------------------------- peek drawer (quick read without leaving the room)
function memberCard(key) {
  const m = MEMBERS[key], c = $('#member');
  $('[data-m-name]', c).textContent = m.name; $('[data-m-role]', c).textContent = m.role; $('[data-m-note]', c).textContent = m.note;
  $$('.lineup li').forEach(li => li.classList.toggle('hl', m.li.includes(li.dataset.m)));
  return c;
}
function openPeek(key, opts = {}) {
  if (!glOn || !inRoom) { goInfo(key === 'member' ? 'bio' : key); return; }
  const src = key === 'member' ? memberCard(opts.member) : $('#' + key);
  if (!src) return;
  const clone = src.cloneNode(true);
  clone.removeAttribute('id'); clone.removeAttribute('aria-labelledby');
  $$('[id]', clone).forEach(e => e.removeAttribute('id'));
  lazyThumbs(clone);
  peekBody.replaceChildren(clone);
  const h = $('h2', clone); if (h) { h.tabIndex = -1; peek.setAttribute('aria-label', h.textContent + ' — quick read'); }
  $('#peekPage').dataset.go = key === 'member' ? 'bio' : key;
  peek.classList.add('open'); body.classList.add('peek-open'); peek.scrollTop = 0;
  $$('.dock [data-open]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.open === key)));
  lastFocus = opts.from || document.activeElement;
  stage?.focus(opts.spot || SECTION_SPOT[key]);
  requestAnimationFrame(() => (h || peek).focus({ preventScroll: true }));
}
function closePeek(silent) {
  if (!peek.classList.contains('open')) return false;
  peek.classList.remove('open'); body.classList.remove('peek-open');
  $$('.dock [data-open]').forEach(b => b.setAttribute('aria-pressed', 'false'));
  stage?.focus(null);
  if (!silent) lastFocus?.focus?.({ preventScroll: true });
  return true;
}

// ---------------------------------------------------------------- one delegated click handler for everything
document.addEventListener('click', e => {
  const t = e.target;
  const yt = t.closest('[data-yt]');
  if (yt) {
    const f = document.createElement('iframe');
    f.src = `https://www.youtube-nocookie.com/embed/${yt.dataset.yt}?autoplay=1&rel=0`;
    f.title = yt.getAttribute('aria-label').replace(/^Play /, '');
    f.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen'; f.allowFullscreen = true;
    yt.replaceWith(f); return;
  }
  const sp = t.closest('.sp-play');
  if (sp) {
    const f = document.createElement('iframe');
    f.src = 'https://open.spotify.com/embed/album/2tPVzNhSrSD9UI7L6cBmHL?utm_source=generator&theme=0';
    f.title = 'Live at Rockaway Beach on Spotify';
    f.allow = 'autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture';
    sp.closest('.cover').replaceChildren(f); return;
  }
  const ph = t.closest('.photos [data-i]');
  if (ph) { show(+ph.dataset.i); lb.showModal(); return; }
  const o = t.closest('[data-open]');
  if (o) { e.preventDefault(); stage?.sfx(o.dataset.open === 'listen' ? 'listen' : 'tick'); openPeek(o.dataset.open, { from: o }); return; }
  const g = t.closest('[data-go]');
  if (g) { e.preventDefault(); goInfo(g.dataset.go); return; }
  if (t.closest('[data-room]')) { e.preventDefault(); goRoom(); return; }
  if (t.closest('[data-close-peek]')) { closePeek(); return; }
  const a = t.closest('.index a, .skip');
  if (a) { e.preventDefault(); goInfo(a.getAttribute('href').slice(1)); }
});
addEventListener('keydown', e => {
  if (e.key !== 'Escape' || lb.open) return;
  if (closePeek()) return;
  if (inRoom) { e.preventDefault(); goInfo('info'); }
});
$$('#info h2').forEach(h => h.tabIndex = -1);

// ---------------------------------------------------------------- lightbox
const lb = $('#lb'), lbImg = $('img', lb), lbFull = $('[data-full]', lb);
const shots = $$('#gallery button');
let cur = 0;
function show(i) { cur = (i + shots.length) % shots.length; const b = shots[cur]; lbImg.src = b.dataset.large; lbImg.alt = b.querySelector('img').alt; lbFull.href = b.dataset.full; }
lb.addEventListener('click', e => { if (e.target === lb || e.target.closest('[data-close]')) lb.close(); const s = e.target.closest('[data-step]'); if (s) show(cur + +s.dataset.step); });
lb.addEventListener('keydown', e => { if (e.key === 'ArrowRight') show(cur + 1); if (e.key === 'ArrowLeft') show(cur - 1); });

// ---------------------------------------------------------------- hotspot buttons
const spotBtns = SPOTS.map(s => {
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'spot' + (s.member ? ' member' : ''); b.dataset.spot = s.id;
  if (s.r) b.style.setProperty('--r', s.r + 'deg');
  b.innerHTML = `<i aria-hidden="true"></i><b>${s.label}</b>`;
  b.setAttribute('aria-label', s.member ? `${s.label} — who's playing` : `Open ${s.label}`);
  b.tabIndex = -1;
  b.addEventListener('click', () => {
    if (s.member) { stage?.sfx(s.member, s.id); openPeek('member', { from: b, spot: s.id, member: s.member }); }
    else { stage?.sfx(s.open === 'listen' ? 'listen' : 'tick', s.id); openPeek(s.open, { from: b, spot: s.id }); }
  });
  spotsEl.appendChild(b);
  return b;
});

// ---------------------------------------------------------------- tiny synth (off until you turn it on)
let ac = null, soundOn = false;
function synth(kind) {
  if (!soundOn) return;
  ac ||= new (window.AudioContext || window.webkitAudioContext)();
  if (ac.state === 'suspended') ac.resume();
  const a = ac, t = a.currentTime + .01, out = a.createGain(); out.gain.value = .45; out.connect(a.destination);
  const env = (node, peak, atk, dec) => { const g = a.createGain(); g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + atk); g.gain.exponentialRampToValueAtTime(.0001, t + atk + dec); node.connect(g); g.connect(out); return g; };
  const osc = (type, f, f2, dur) => { const o = a.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur); o.start(t); o.stop(t + dur + .05); return o; };
  const noise = dur => { const b = a.createBuffer(1, Math.ceil(a.sampleRate * dur), a.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; const s = a.createBufferSource(); s.buffer = b; s.start(t); return s; };
  const filt = (node, type, f, q = 1) => { const fl = a.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q; node.connect(fl); return fl; };
  const kick = () => env(osc('sine', 160, 42, .32), 1, .004, .32);
  switch (kind) {
    case 'slap': env(filt(noise(.14), 'bandpass', 1700, .8), .9, .002, .12); env(osc('sine', 220, 70, .1), .5, .002, .1); break;
    case 'drums': kick(); env(filt(noise(.08), 'highpass', 7000), .35, .001, .06); break;
    case 'bass': env(filt(osc('sawtooth', 55, 0, .6), 'lowpass', 420, 4), .8, .01, .55); break;
    case 'guitar': { const ws = a.createWaveShaper(), c = new Float32Array(256); for (let i = 0; i < 256; i++) { const x = i / 128 - 1; c[i] = Math.tanh(x * 6); } ws.curve = c; [82.4, 123.5, 164.8].forEach(f => osc('sawtooth', f, 0, .9).connect(ws)); env(filt(ws, 'lowpass', 2600), .35, .005, .85); break; }
    case 'sax': { const o = osc('sawtooth', 233, 0, .7), l = a.createOscillator(), lg = a.createGain(); l.frequency.value = 5.5; lg.gain.value = 5; l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(t + .8); env(filt(o, 'bandpass', 950, 2.2), .9, .04, .6); break; }
    case 'singer': { const o = osc('sawtooth', 147, 175, .5); env(filt(o, 'bandpass', 730, 6), .9, .03, .45); env(filt(o, 'bandpass', 1150, 7), .6, .03, .45); break; }
    case 'listen': kick(); env(filt(osc('sawtooth', 55, 0, .5), 'lowpass', 380, 3), .7, .01, .45); break;
    default: env(osc('square', 1400, 900, .03), .12, .001, .03);
  }
}

// ---------------------------------------------------------------- boot / fallback
function hasWebGL() { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; } }
function fallback(reason) {
  root.classList.add('no-gl'); root.classList.remove('gl'); body.classList.remove('gl-on'); glOn = false;
  const p = $('#app .poster');
  if (p && !p.src) { p.srcset = `${A}scene/scene-full-960.webp 960w, ${A}scene/scene-full-1600.webp 1600w`; p.sizes = '100vw'; p.src = `${A}scene/scene-full-960.webp`; }
  $('#hint').textContent = 'Scroll for the full press kit';
  if (reason) console.info('[epkEX] static page:', reason);
}
const CAN_GL = hasWebGL();
if (CAN_GL) root.classList.add('can-gl');
function start() {
  root.classList.remove('no-gl'); root.classList.add('gl');
  boot().catch(err => { console.warn('[epkEX] room failed, showing the static page', err); fallback(); });
}
if (!CAN_GL) fallback('WebGL unavailable');
else if (RM) fallback('prefers-reduced-motion — tap "Enter the 3D room" to opt in');
else start();
$('#enterRoom').addEventListener('click', () => { $('#enterRoom').hidden = true; start(); });

async function boot() {
  const bar = $('.loader i');
  const setP = p => bar.style.setProperty('--p', Math.round(p * 100) + '%');
  setP(.06);
  const THREE = await import('three');
  setP(.3);
  const canvas = $('#gl');
  const small = Math.min(innerWidth, innerHeight) < 700 || /2g|3g/.test(navigator.connection?.effectiveType || '');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', alpha: false });
  renderer.setClearColor(0x000000, 1);
  const PX = Math.min(devicePixelRatio, small ? 1.5 : 1.75);
  renderer.setPixelRatio(PX);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, .05, 60);

  // ---- textures (960 on phones, 1800 on desktop)
  const res = small ? 960 : 1800;
  const loader = new THREE.TextureLoader();
  let done = 0;
  const load = (url, color = true) => new Promise((ok, bad) => loader.load(url, t => {
    t.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
    setP(.3 + (++done / 4) * .65); ok(t);
  }, undefined, bad));
  const [tBack, tMid, tFront, tDepth] = await Promise.all([
    load(`${A}scene/scene-back-${res}.webp`), load(`${A}scene/scene-mid-${res}.webp`), load(`${A}scene/scene-front-${res}.webp`),
    load(`${A}depth-pack.webp`, false)]);
  tDepth.generateMipmaps = false; tDepth.minFilter = THREE.LinearFilter;
  // CPU copy of the wall/floor depth so stickers can land on the surface you tapped
  const DN = 128, dctx = Object.assign(document.createElement('canvas'), { width: DN, height: DN }).getContext('2d', { willReadFrequently: true });
  dctx.drawImage(tDepth.image, 0, 0, DN, DN);
  const dpx = dctx.getImageData(0, 0, DN, DN).data;
  const wallD = (u, v) => dpx[(Math.min(DN - 1, Math.max(0, Math.floor((1 - v) * DN))) * DN + Math.min(DN - 1, Math.max(0, Math.floor(u * DN)))) * 4] / 255;

  // ---- relief layers with a xerox / halftone print shader
  const TAN = Math.tan(THREE.MathUtils.degToRad(25));
  const ZFAR = 12, ZNEAR = 4.4;
  const depthAt = d => 1 / THREE.MathUtils.lerp(1 / ZFAR, 1 / ZNEAR, d);
  const unproject = (u, v, d) => { const Z = depthAt(d); return new THREE.Vector3((u - .5) * 2 * TAN * Z, (v - .5) * 2 * TAN * Z, -Z); };
  const waves = [0, 0, 0].map(() => new THREE.Vector4(0, 0, 0, 0));   // (x, y, age, strength)
  const common = {
    uDepth: { value: tDepth }, uTan: { value: TAN }, uInvFar: { value: 1 / ZFAR }, uInvNear: { value: 1 / ZNEAR },
    uTime: { value: 0 }, uReveal: { value: 0 }, uHalf: { value: 1 }, uCell: { value: (small ? 3.4 : 4.2) * PX }, uScan: { value: 0 },
    uRes: { value: new THREE.Vector2(1, 1) }, uPx: { value: PX }, uWaves: { value: waves },
  };
  const vert = /* glsl */`
    uniform sampler2D uDepth; uniform float uTan, uInvFar, uInvNear, uChan, uReveal;
    varying vec2 vUv;
    void main(){
      vUv = uv;
      vec3 dd = texture2D(uDepth, uv).rgb;
      float d = uChan < .5 ? dd.r : (uChan < 1.5 ? dd.g : dd.b);
      d = mix(dd.r, d, uReveal);
      float Z = 1. / mix(uInvFar, uInvNear, d);
      vec3 p = vec3((uv.x - .5) * 2. * uTan * Z, (uv.y - .5) * 2. * uTan * Z, -Z);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.);
    }`;
  const frag = /* glsl */`
    uniform sampler2D uMap; uniform float uEdge, uTime, uHalf, uCell, uScan, uChan, uPx; uniform vec2 uRes; uniform vec4 uWaves[3];
    varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main(){
      vec4 c = texture2D(uMap, vUv);
      if (c.a < .04) discard;
      vec3 cb = texture2D(uMap, vUv, 1.2).rgb;           // slightly blurred copy feeds the dots (less moire)
      vec2 fc = gl_FragCoord.xy;
      float L = dot(mix(c.rgb, cb, uHalf * .8), vec3(.2126, .7152, .0722));
      float g = pow(smoothstep(.0, .88, pow(L, 1. / 2.2)), .8);
      // shockwaves (sticker slaps, amp hits): an inverted ring of fat dots
      float wv = 0.;
      for (int i = 0; i < 3; i++) {
        vec4 W = uWaves[i];
        if (W.w > 0.) { float d = length(fc - W.xy); float r = W.z * 1100. * uPx; wv += W.w * exp(-pow((d - r) / (46. * uPx), 2.)) * (1. - clamp(W.z / 1.1, 0., 1.)); }
      }
      wv = clamp(wv, 0., 1.);
      float cell = uCell * (1. + wv * 1.6);
      vec2 q = mat2(.7071, -.7071, .7071, .7071) * fc / cell;
      vec2 f = fract(q) - .5;
      float rad = sqrt(clamp(1. - g, 0., 1.)) * .74;
      float aa = 1.4 / cell;
      float ht = smoothstep(rad - aa, rad + aa, length(f));
      ht = mix(ht, step(.5, g), smoothstep(.85, 1., abs(g - .5) * 2.) * .5);   // crush the extremes like a cheap copier
      float x = mix(g, ht, uHalf);
      x = mix(x, 1. - x, wv * .85);
      x += (hash(fc + floor(uTime * 12.) * 7.31) - .5) * .09 * uHalf;
      // photocopier scan reveal
      float sx = fc.x / uRes.x, s = uScan * 1.2 - .1;
      float seen = step(sx, s);
      float e = smoothstep(0., uEdge, vUv.x) * smoothstep(0., uEdge, 1. - vUv.x) * smoothstep(0., uEdge * .5, vUv.y) * smoothstep(0., uEdge * .7, 1. - vUv.y);
      x *= e;
      float a = c.a;
      if (uChan < .5) x = mix(.93, x, seen); else a *= seen;
      x += exp(-pow((sx - s) * 38., 2.)) * .9 * step(uScan, .999);
      x = clamp(x, 0., 1.);
      gl_FragColor = vec4(vec3(pow(x, 2.2)), a);
      #include <colorspace_fragment>
    }`;
  const mkLayer = (map, chan, segs, order) => {
    const m = new THREE.ShaderMaterial({
      uniforms: { ...common, uMap: { value: map }, uChan: { value: chan }, uEdge: { value: .085 } },
      vertexShader: vert, fragmentShader: frag, transparent: chan > 0, depthWrite: false, depthTest: false,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1, segs, segs), m);
    mesh.frustumCulled = false; mesh.renderOrder = order; scene.add(mesh); return mesh;
  };
  const segs = small ? 96 : 128;
  mkLayer(tBack, 0, segs, 0); mkLayer(tMid, 1, segs, 1); mkLayer(tFront, 2, segs, 2);

  // ---- flyers wheat-pasted onto the windows (normal + inverted for hover)
  await Promise.all([document.fonts.load('900 64px "Big Shoulders Display"'), document.fonts.load('500 20px "Plex Mono"')]).catch(() => {});
  const WINS = [
    { u0: .0986, u1: .2734, v0: 1 - .342, v1: 1 - .0098, spring: .27, d: .0811, word: 'THE STORY', sub: 'BIO →', strip: true, spot: 'win-l', open: 'bio' },
    { u0: .5615, u1: .7140, v0: 1 - .2561, v1: 1 - .1406, spring: .66, d: .0295, word: 'WATCH', sub: 'VIDEOS', spot: 'win-c', open: 'watch' },
    { u0: .8535, u1: .9971, v0: 1 - .2517, v1: 1 - .1377, spring: .66, d: .0135, word: 'BOOK US', sub: 'DM ON IG / FB', spot: 'win-r', open: 'booking' },
  ];
  const archPath = (g, w, h, spring) => { const ry = h * spring; g.beginPath(); g.moveTo(0, h); g.lineTo(0, ry); g.ellipse(w / 2, ry, w / 2, ry, 0, Math.PI, 0); g.lineTo(w, h); g.closePath(); };
  const flyer = (W, wpx, hpx, inv) => {
    const cv = document.createElement('canvas'); cv.width = wpx; cv.height = hpx;
    const g = cv.getContext('2d'), ink = inv ? '#f2f0ea' : '#0b0b0b', paper = inv ? '#0b0b0b' : '#f2f0ea';
    archPath(g, wpx, hpx, W.spring); g.clip();
    if (W.strip) {           // left window keeps its painted "Blahsum and Boojum" — just a paper strip at the bottom
      const sh = hpx * .17, sy = hpx * .8;
      g.save(); g.translate(wpx / 2, sy); g.rotate(-.05);
      g.fillStyle = paper; g.fillRect(-wpx * .46, -sh / 2, wpx * .92, sh);
      g.strokeStyle = ink; g.lineWidth = wpx * .012; g.strokeRect(-wpx * .46, -sh / 2, wpx * .92, sh);
      g.fillStyle = ink; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = `900 ${Math.round(sh * .56)}px "Big Shoulders Display", Impact, sans-serif`; g.fillText(W.word, 0, -sh * .1);
      g.font = `500 ${Math.round(sh * .2)}px "Plex Mono", monospace`; g.fillText(W.sub, 0, sh * .32);
      g.restore();
    } else {
      g.fillStyle = paper; g.fillRect(0, 0, wpx, hpx);
      // halftone corner + border like a photocopied flyer
      g.fillStyle = ink;
      for (let y = 0; y < hpx; y += 9) for (let x = 0; x < wpx; x += 9) { const k = Math.max(0, 1 - Math.hypot(x / wpx, 1 - y / hpx) * 1.6); if (k > .02) { g.beginPath(); g.arc(x + (y / 9 % 2) * 4.5, y, 4.4 * Math.sqrt(k), 0, 7); g.fill(); } }
      g.lineWidth = wpx * .03; g.strokeStyle = ink; archPath(g, wpx, hpx, W.spring); g.stroke();
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.save(); g.translate(wpx / 2, hpx * .52); g.rotate(-.04);
      g.font = `900 100px "Big Shoulders Display", Impact, sans-serif`;
      const fs = Math.min(hpx * .5, wpx * .8 / (g.measureText(W.word).width / 100));
      g.font = `900 ${Math.round(fs)}px "Big Shoulders Display", Impact, sans-serif`;
      g.fillText(W.word, 0, hpx * .02); g.restore();
      g.font = `500 ${Math.round(hpx * .1)}px "Plex Mono", monospace`;
      const tw = g.measureText(W.sub).width + hpx * .08;
      g.fillRect(wpx / 2 - tw / 2, hpx * .79, tw, hpx * .15);
      g.fillStyle = paper; g.fillText(W.sub, wpx / 2, hpx * .865);
    }
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
  };
  const winGroup = new THREE.Group(); scene.add(winGroup);
  WINS.forEach(W => {
    const Z = depthAt(W.d);
    const w = (W.u1 - W.u0) * 2 * TAN * Z, h = (W.v1 - W.v0) * 2 * TAN * Z;
    const cx = ((W.u0 + W.u1) / 2 - .5) * 2 * TAN * Z, cy = ((W.v0 + W.v1) / 2 - .5) * 2 * TAN * Z;
    const wpx = 512, hpx = Math.round(512 * h / w);
    const plane = new THREE.PlaneGeometry(w, h);
    const mA = new THREE.MeshBasicMaterial({ map: flyer(W, wpx, hpx, false), transparent: true, depthWrite: false, depthTest: false, opacity: 0 });
    const mB = new THREE.MeshBasicMaterial({ map: flyer(W, wpx, hpx, true), transparent: true, depthWrite: false, depthTest: false, opacity: 0 });
    const a = new THREE.Mesh(plane, mA), b = new THREE.Mesh(plane, mB);
    const grp = new THREE.Group(); grp.position.set(cx, cy, -Z); grp.add(a, b); a.renderOrder = .5; b.renderOrder = .55;
    winGroup.add(grp);
    Object.assign(W, { grp, mA, mB, w, h, on: false, lit: 0, hover: 0, slap: 1 });
  });

  // ---- paper specks drifting in the air
  const N = small ? 120 : 220, pos = new Float32Array(N * 3), seed = new Float32Array(N);
  for (let i = 0; i < N; i++) { const z = -4 - Math.random() * 6, half = Math.tan(.42) * -z; pos[i * 3] = (Math.random() - .5) * 2 * half; pos[i * 3 + 1] = (Math.random() - .35) * 2 * half; pos[i * 3 + 2] = z; seed[i] = Math.random() * 100; }
  const dustGeo = new THREE.BufferGeometry(); dustGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); dustGeo.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
  const dustMat = new THREE.ShaderMaterial({
    uniforms: { uTime: common.uTime, uPx: common.uPx, uAlpha: { value: 0 } },
    vertexShader: `uniform float uTime,uPx; attribute float seed; varying float vA;
      void main(){ vec3 p = position; float t = uTime*.06 + seed;
        p.x += sin(t*1.3)*.35; p.y += sin(t*.9 + seed)*.25 + mod(uTime*.03 + seed*.1, 1.)*.4; p.z += cos(t)*.2;
        vec4 mv = modelViewMatrix*vec4(p,1.); gl_Position = projectionMatrix*mv;
        gl_PointSize = uPx * (1.6 + fract(seed)*2.) * (6. / -mv.z); vA = .3 + .7*fract(seed*7.); }`,
    fragmentShader: `uniform float uAlpha; varying float vA; void main(){ vec2 c = abs(gl_PointCoord-.5); float a = step(max(c.x,c.y), .42); gl_FragColor = vec4(vec3(1.), a*vA*uAlpha); }`,
    transparent: true, depthWrite: false, depthTest: false,
  });
  const dust = new THREE.Points(dustGeo, dustMat); dust.frustumCulled = false; dust.renderOrder = 3; scene.add(dust);

  SPOTS.forEach(s => { s.p = unproject(s.a[0], s.a[1], s.a[2]); });

  // ---------------------------------------------------------------- camera rig
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const OVER = { yaw: .015, pitch: .04, dist: 8.1, t: V(0, .42, -7.6) };
  const START = { yaw: -.28, pitch: .16, dist: 12.5, t: V(0, 1, -7.6) };
  const home = () => ({ ...OVER, t: OVER.t.clone() });
  const rig = RM ? home() : { ...START, t: START.t.clone() };
  let goal = home();
  const LIM = { yaw: [-.32, .32], pitch: [-.06, .22], dist: [5.8, 11] };
  const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3();
  function poseFor(id) {
    const s = SPOTS.find(x => x.id === id); if (!s) return home();
    const p = s.p, onWall = p.z < -9;
    const t = V(THREE.MathUtils.lerp(OVER.t.x, p.x, onWall ? .55 : .7), THREE.MathUtils.lerp(OVER.t.y, p.y, onWall ? .6 : .7), THREE.MathUtils.lerp(OVER.t.z, p.z, .35));
    return { yaw: THREE.MathUtils.clamp(-p.x * .06, -.22, .22) + (onWall ? 0 : .05), pitch: onWall ? .02 : .08, dist: onWall ? 7.4 : 6.6, t };
  }
  let viewOffset = { x: 0, y: 0 }, viewGoal = { x: 0, y: 0 };
  let paused = false, visible = true, running = false;

  // ---------------------------------------------------------------- input
  let dragging = false, lx = 0, ly = 0, vyaw = 0, vpitch = 0, pinch = 0, lastInput = 0, down = null;
  const ptrs = new Map();
  const userMoved = () => { lastInput = performance.now(); body.classList.remove('show-hint'); };
  canvas.addEventListener('pointerdown', e => {
    ptrs.set(e.pointerId, [e.clientX, e.clientY]);
    if (e.pointerType === 'mouse') canvas.setPointerCapture(e.pointerId);
    down = ptrs.size === 1 ? { x: e.clientX, y: e.clientY, t: performance.now(), moved: 0 } : null;
    dragging = true; lx = e.clientX; ly = e.clientY; vyaw = vpitch = 0; userMoved(); kick();
  });
  canvas.addEventListener('pointermove', e => {
    if (!ptrs.has(e.pointerId)) { hoverAt(e.clientX, e.clientY); return; }
    ptrs.set(e.pointerId, [e.clientX, e.clientY]);
    if (ptrs.size === 2) {
      const [a, b] = [...ptrs.values()]; const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      if (pinch) goal.dist = THREE.MathUtils.clamp(goal.dist * pinch / d, ...LIM.dist); pinch = d; down = null; kick(); return;
    }
    const dx = e.clientX - lx, dy = e.clientY - ly; lx = e.clientX; ly = e.clientY;
    if (down) down.moved += Math.abs(dx) + Math.abs(dy);
    canvas.classList.toggle('drag', !!down && down.moved > 6);
    vyaw = -dx * .0042;
    vpitch = e.pointerType === 'mouse' ? dy * .0032 : 0;      // touch: vertical swipes scroll the page instead
    goal.yaw = THREE.MathUtils.clamp(goal.yaw + vyaw, ...LIM.yaw); goal.pitch = THREE.MathUtils.clamp(goal.pitch + vpitch, ...LIM.pitch);
    userMoved(); kick();
  });
  const up = e => {
    const wasTap = e.type === 'pointerup' && down && down.moved < 8 && performance.now() - down.t < 500 && ptrs.size === 1;
    ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch = 0; if (!ptrs.size) { dragging = false; canvas.classList.remove('drag'); }
    if (e.type === 'pointercancel') { vyaw = vpitch = 0; }
    if (wasTap) tap(e.clientX, e.clientY);
    down = null;
  };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  const keys = new Set();
  addEventListener('keydown', e => {
    if (!inRoom || peek.classList.contains('open') || lb.open || e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.target.closest?.('input,textarea,select,iframe')) return;
    if (/^(KeyW|KeyA|KeyS|KeyD|ArrowLeft|ArrowRight|KeyQ|KeyE)$/.test(e.code)) { keys.add(e.code); userMoved(); kick(); if (e.code.startsWith('Arrow')) e.preventDefault(); }
    if (e.code === 'KeyR') api.reset();
  });
  addEventListener('keyup', e => keys.delete(e.code));
  addEventListener('blur', () => keys.clear());

  // hover: invert a flyer when the pointer is near its sign
  function winAt(x, y) {
    for (const W of WINS) {
      if (!W.on) continue;
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        tmp.set(sx * W.w / 2, sy * W.h / 2, 0).add(W.grp.position).project(camera);
        const px = (tmp.x * .5 + .5) * w, py = (-tmp.y * .5 + .5) * h;
        x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py);
      }
      if (W.strip) y0 = y0 + (y1 - y0) * .65;
      if (x >= x0 && x <= x1 && y >= y0 && y <= y1) return W;
    }
    return null;
  }
  let hoverWin = null;
  function hoverAt(x, y) {
    const W = winAt(x, y);
    if (W !== hoverWin) { hoverWin = W; canvas.style.cursor = W ? 'pointer' : ''; kick(); }
  }
  spotBtns.forEach((b, i) => {
    const W = WINS.find(W => W.spot === SPOTS[i].id); if (!W) return;
    b.addEventListener('pointerenter', () => { hoverWin = W; kick(); });
    b.addEventListener('pointerleave', () => { if (hoverWin === W) hoverWin = null; kick(); });
  });

  // ---------------------------------------------------------------- taps: open a flyer, else slap a sticker
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function surfaceAt(x, y) {
    ndc.set(x / w * 2 - 1, -(y / h) * 2 + 1); ray.setFromCamera(ndc, camera);
    const o = ray.ray.origin, d = ray.ray.direction;
    let prev = null;
    for (let t = .3; t < 30; t += .05) {
      tmp.copy(d).multiplyScalar(t).add(o);
      const Z = -tmp.z; if (Z < .5) continue;
      const u = tmp.x / (2 * TAN * Z) + .5, v = tmp.y / (2 * TAN * Z) + .5;
      if (u < 0 || u > 1 || v < 0 || v > 1) { prev = null; continue; }
      if (Z >= depthAt(wallD(u, v))) return tmp.clone();
      prev = t;
    }
    return null;
  }
  const stickers = []; let stickN = 0;
  function slap(x, y, quiet) {
    const p = surfaceAt(x, y); if (!p) return false;
    const [txt, kind] = STICKERS[stickN++ % STICKERS.length];
    const el = document.createElement('span'); el.className = 'stk';
    const inner = document.createElement('i'); inner.style.setProperty('--r', ((Math.random() - .5) * 26).toFixed(1) + 'deg');
    const face = document.createElement('span'); face.className = kind; face.textContent = txt;
    inner.appendChild(face); el.appendChild(inner); stickEl.appendChild(el);
    stickers.push({ p, el });
    while (stickers.length > 16) stickers.shift().el.remove();
    if (!quiet) { wave(x, y, .8); synth('slap'); }
    kick(); return true;
  }
  function wave(x, y, s = 1) {
    if (RM) return;
    const W = waves.reduce((m, v) => (v.w <= 0 || v.z > m.z ? v : m), waves[0]);
    W.set(x * PX, (h - y) * PX, 0, s);
  }
  function tap(x, y) {
    if (peek.classList.contains('open')) { closePeek(); return; }
    const W = winAt(x, y);
    if (W) { synth('tick'); wave(x, y, .6); openPeek(W.open, { spot: W.spot }); return; }
    slap(x, y);
  }

  // ---------------------------------------------------------------- tools
  const ink = { goal: 1 };
  $('#tZoomIn').addEventListener('click', () => { goal.dist = THREE.MathUtils.clamp(goal.dist - 1, ...LIM.dist); userMoved(); kick(); });
  $('#tZoomOut').addEventListener('click', () => { goal.dist = THREE.MathUtils.clamp(goal.dist + 1, ...LIM.dist); userMoved(); kick(); });
  $('#tReset').addEventListener('click', () => api.reset());
  $('#tInk').addEventListener('click', e => { ink.goal = ink.goal ? 0 : 1; e.currentTarget.setAttribute('aria-pressed', String(!!ink.goal)); e.currentTarget.textContent = ink.goal ? 'Xerox' : 'Photo'; kick(); });
  $('#tSound').addEventListener('click', e => { soundOn = !soundOn; e.currentTarget.setAttribute('aria-pressed', String(soundOn)); e.currentTarget.innerHTML = `Sound<br>${soundOn ? 'on' : 'off'}`; synth('drums'); });
  $('#tClear').addEventListener('click', () => { stickers.splice(0).forEach(s => s.el.remove()); synth('tick'); });

  const api = {
    focus(id) {
      goal = id ? poseFor(id) : home();
      const mobile = innerWidth <= 700;
      viewGoal = id ? (mobile ? { x: 0, y: Math.min(innerHeight * .76, 660) / 2 } : { x: Math.min(500, innerWidth) / 2, y: 0 }) : { x: 0, y: 0 };
      hoverWin = id ? WINS.find(W => W.spot === id) || null : null;
      kick();
    },
    reset() { goal = home(); vyaw = vpitch = 0; userMoved(); kick(); },
    visible(v) { visible = v; if (v) kick(); else keys.clear(); },
    sfx(kind, spotId) {
      synth(kind);
      const s = spotId && SPOTS.find(x => x.id === spotId);
      if (s) { tmp2.copy(s.p).project(camera); wave((tmp2.x * .5 + .5) * w, (-tmp2.y * .5 + .5) * h, kind === 'tick' ? .5 : 1); }
      else if (kind === 'listen') wave(w * .08, h * .8, 1);
    },
  };

  // ---------------------------------------------------------------- frame loop (runs only while the room is on screen)
  let w = 0, h = 0, t0 = performance.now(), introT = RM ? 1 : 0, last = performance.now(), introStart = 0, frames = 0;
  function resize() {
    w = app.clientWidth; h = app.clientHeight;
    renderer.setSize(w, h, false);
    common.uRes.value.set(w * PX, h * PX);
    const aspect = w / h; camera.aspect = aspect;
    const halfW = aspect < .9 ? .25 : .44, halfH = aspect > 1.3 ? .33 : .36;
    camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.max(halfH, halfW / aspect)));
    camera.updateProjectionMatrix(); kick();
  }
  const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  function kick() { if (!running && visible && !document.hidden) { running = true; last = performance.now(); requestAnimationFrame(loop); } }
  function loop(now) {
    if (!visible || document.hidden) { running = false; return; }
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    const time = (now - t0) / 1000;
    common.uTime.value = time;
    if (introT < 1) {
      if (!introStart) introStart = now;
      introT = Math.min(1, (now - introStart) / 3400);
      const k = ease(introT);
      rig.yaw = THREE.MathUtils.lerp(START.yaw, goal.yaw, k); rig.pitch = THREE.MathUtils.lerp(START.pitch, goal.pitch, k);
      rig.dist = THREE.MathUtils.lerp(START.dist, goal.dist, k); rig.t.lerpVectors(START.t, goal.t, k);
      common.uScan.value = Math.min(1, (now - introStart) / 1300);
      common.uReveal.value = THREE.MathUtils.smoothstep(introT, .2, .8);
      if (introT >= 1) onArrive();
    } else {
      common.uScan.value = 1; common.uReveal.value = 1;
      const sp = dt * 2.2;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) goal.yaw = Math.min(LIM.yaw[1], goal.yaw + sp * .45);
      if (keys.has('KeyD') || keys.has('ArrowRight')) goal.yaw = Math.max(LIM.yaw[0], goal.yaw - sp * .45);
      if (keys.has('KeyW')) goal.dist = Math.max(LIM.dist[0], goal.dist - sp * 1.6);
      if (keys.has('KeyS')) goal.dist = Math.min(LIM.dist[1], goal.dist + sp * 1.6);
      if (keys.has('KeyQ')) goal.t.x = Math.max(-2, goal.t.x - sp * .8);
      if (keys.has('KeyE')) goal.t.x = Math.min(2, goal.t.x + sp * .8);
      if (!dragging && (Math.abs(vyaw) > 1e-5 || Math.abs(vpitch) > 1e-5)) {
        goal.yaw = THREE.MathUtils.clamp(goal.yaw + vyaw, ...LIM.yaw); goal.pitch = THREE.MathUtils.clamp(goal.pitch + vpitch, ...LIM.pitch);
        vyaw *= .9; vpitch *= .9;
      }
      const k = 1 - Math.pow(.0016, dt);
      rig.yaw += (goal.yaw - rig.yaw) * k; rig.pitch += (goal.pitch - rig.pitch) * k; rig.dist += (goal.dist - rig.dist) * k; rig.t.lerp(goal.t, k);
    }
    const idle = !RM && introT >= 1 && now - lastInput > 5000 && !peek.classList.contains('open');
    const sway = idle ? Math.min(1, (now - lastInput - 5000) / 3000) : 0;
    const swayAmp = w / h < .9 ? .18 : .09;
    const yaw = rig.yaw + sway * Math.sin(time * .16) * swayAmp, pitch = rig.pitch + sway * Math.sin(time * .11) * .02;
    camera.position.set(rig.t.x + rig.dist * Math.sin(yaw) * Math.cos(pitch), rig.t.y + rig.dist * Math.sin(pitch), rig.t.z + rig.dist * Math.cos(yaw) * Math.cos(pitch));
    camera.position.z = Math.max(camera.position.z, -1.6);
    camera.lookAt(rig.t);
    viewOffset.x += (viewGoal.x - viewOffset.x) * Math.min(1, dt * 6); viewOffset.y += (viewGoal.y - viewOffset.y) * Math.min(1, dt * 6);
    if (Math.abs(viewOffset.x) > .5 || Math.abs(viewOffset.y) > .5) camera.setViewOffset(w, h, viewOffset.x, viewOffset.y, w, h); else camera.clearViewOffset();
    common.uHalf.value += (ink.goal - common.uHalf.value) * Math.min(1, dt * 6);
    waves.forEach(W => { if (W.w > 0) { W.z += dt; if (W.z > 1.1) W.w = 0; } });
    WINS.forEach(W => {
      W.lit += ((W.on ? 1 : 0) - W.lit) * Math.min(1, dt * 7);
      W.hover += ((hoverWin === W ? 1 : 0) - W.hover) * Math.min(1, dt * 10);
      W.slap = Math.min(1, W.slap + dt * 3.2);
      const s = W.on ? 1 + Math.sin(Math.min(1, W.slap) * Math.PI) * .18 * (1 - W.slap) + W.hover * .03 : 1;
      W.grp.scale.setScalar(s); W.grp.rotation.z = (1 - W.slap) * .12;
      W.mA.opacity = W.lit; W.mB.opacity = W.lit * W.hover;
    });
    dustMat.uniforms.uAlpha.value = Math.min(.8, dustMat.uniforms.uAlpha.value + dt * .4) * (RM ? 0 : 1);
    renderer.render(scene, camera); frames++;
    place();
    const busy = introT < 1 || keys.size || dragging || waves.some(W => W.w > 0) || Math.abs(goal.yaw - rig.yaw) + Math.abs(goal.dist - rig.dist) + Math.abs(goal.pitch - rig.pitch) + rig.t.distanceTo(goal.t) > 1e-3
      || Math.abs(viewGoal.x - viewOffset.x) + Math.abs(viewGoal.y - viewOffset.y) > .5 || Math.abs(ink.goal - common.uHalf.value) > .002
      || WINS.some(W => W.slap < 1 || Math.abs((W.on ? 1 : 0) - W.lit) > 1e-3 || Math.abs((hoverWin === W ? 1 : 0) - W.hover) > 1e-3) || Math.abs(vyaw) > 1e-5;
    // grain + specks animate gently while idle; throttle to ~24fps then to save battery/fans
    if (busy || !RM && ink.goal) { if (busy) requestAnimationFrame(loop); else setTimeout(() => requestAnimationFrame(loop), 40); }
    else running = false;
  }
  function place() {
    const vis = introT >= 1;
    SPOTS.forEach((s, i) => {
      tmp.copy(s.p).project(camera);
      const x = (tmp.x * .5 + .5) * w, y = (-tmp.y * .5 + .5) * h;
      const on = vis && tmp.z < 1 && x > 8 && x < w - 60 && y > 64 && y < h - 70;
      const b = spotBtns[i];
      b.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0)`;
      if (b.classList.contains('vis') !== on) { b.classList.toggle('vis', on); b.tabIndex = on ? 0 : -1; }
    });
    for (const s of stickers) {
      tmp.copy(s.p).project(camera);
      const x = (tmp.x * .5 + .5) * w, y = (-tmp.y * .5 + .5) * h;
      const k = THREE.MathUtils.clamp(8.5 / camera.position.distanceTo(s.p), .45, 1.6) * (w < 600 ? .75 : 1);
      s.el.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0) scale(${k.toFixed(3)})`;
      s.el.style.visibility = tmp.z < 1 ? '' : 'hidden';
    }
  }
  function onArrive() {
    WINS.forEach((W, i) => setTimeout(() => { W.on = true; W.slap = RM ? 1 : 0; if (!RM) { tmp.copy(W.grp.position).project(camera); wave((tmp.x * .5 + .5) * w, (-tmp.y * .5 + .5) * h, .45); } kick(); }, RM ? 0 : 120 + i * 220));
    // one demo sticker on the pavement so the "slap a sticker" idea is obvious
    setTimeout(() => { tmp.copy(unproject(.62, .3, wallD(.62, .3))).project(camera); slap((tmp.x * .5 + .5) * w, (-tmp.y * .5 + .5) * h, true); }, RM ? 0 : 1000);
    if (!RM) setTimeout(() => { body.classList.add('show-hint'); setTimeout(() => body.classList.remove('show-hint'), 7000); }, 800);
  }

  addEventListener('resize', resize);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) kick(); });
  resize();
  if (matchMedia('(pointer: coarse)').matches) $('#hint').textContent = 'Swipe sideways to look · tap a sign to read · tap anywhere to slap a sticker · swipe up for the full press kit';
  stage = api; glOn = true;
  body.classList.add('gl-on'); root.classList.add('ready');
  spotBtns.forEach(b => b.tabIndex = -1);
  if (RM) onArrive();
  kick();
  window.__epkEX = { THREE, renderer, camera, rig, api, get goal() { return goal; }, get frames() { return frames; }, get stickers() { return stickers.length; }, slap, tap, winAt, WINS, SPOTS };
}
