// Blahsum EPK 5 — "Stage": a small explorable 3D diorama built from one photo.
// UI (panels, dock, lightbox, facades) works without WebGL; three.js is imported lazily.
const $ = (s, r = document) => r.querySelector(s);
const root = document.documentElement, body = document.body;
const info = $('#info'), app = $('#app'), spotsEl = $('#spots');
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const A = 'epk-assets/shared/stage45/scene/';

// ---------------------------------------------------------------- content model
const MEMBERS = {
  singer: { name: 'Vocals', role: 'Garbo — frontman', note: 'Blahsum started as Garbo alone, writing lyrics and cutting together beats in his Chinatown home studio, then releasing the Moon Tapes every full moon.', li: ['garbo'] },
  drums: { name: 'Drums', role: 'Zach M — Garbo’s brother', note: 'Holding down the drums.', li: ['zachm'] },
  sax: { name: 'Saxophone', role: 'Dan Erbland', note: 'On the saxophone.', li: ['dan'] },
  bass: { name: 'Bass', role: 'Alex Torke', note: 'On the bass.', li: ['alex'] },
  guitar: { name: 'Guitars', role: 'Zach Schepis & Nate McManus', note: 'Zach Schepis on lead guitar & harmonica; Nate McManus on rhythm guitar & trumpet.', li: ['schepis', 'nate'] },
};
// photo-space anchors: [u, v (0 = bottom), depth-layer value, depth channel]
const SPOTS = [
  { id: 'win-l', label: 'Bio', open: 'bio', a: [0.2754, 0.86, 0.0811, 0] },
  { id: 'win-c', label: 'Watch', open: 'watch', a: [0.6377, 0.738, 0.0295, 0] },
  { id: 'win-r', label: 'Booking', open: 'booking', a: [0.9258, 0.741, 0.0135, 0] },
  { id: 'spk', label: 'Listen', open: 'listen', a: [0.0752, 0.1846, 0.7943, 2] },
  { id: 'box', label: 'Photos', open: 'photos', a: [0.4199, 0.7363, 0.0683, 0] },
  { id: 'singer', label: 'Vocals', member: 'singer', a: [0.4443, 0.585, 0.5117, 2] },
  { id: 'drums', label: 'Drums', member: 'drums', a: [0.293, 0.7051, 0.0617, 0] },
  { id: 'sax', label: 'Sax', member: 'sax', a: [0.459, 0.6777, 0.3506, 1] },
  { id: 'bass', label: 'Bass', member: 'bass', a: [0.2832, 0.541, 0.1043, 0] },
  { id: 'gtr-l', label: 'Guitar', member: 'guitar', a: [0.1172, 0.5898, 0.3244, 1] },
  { id: 'gtr-r', label: 'Guitar', member: 'guitar', a: [0.8398, 0.5898, 0.2563, 1] },
];
const SECTION_SPOT = { bio: 'win-l', watch: 'win-c', booking: 'win-r', listen: 'spk', photos: 'box' };

// ---------------------------------------------------------------- panels
let stage = null;            // set once WebGL is running
let lastFocus = null;
function lazyThumbs(scope) { scope.querySelectorAll('img[data-src]').forEach(i => { i.src = i.dataset.src; i.removeAttribute('data-src'); }); }
function openPanel(key, opts = {}) {
  if (!body.classList.contains('gl-on')) {           // fallback: plain document
    const el = key === 'member' ? $('#info-bio') : $('#info-' + key);
    lazyThumbs(info); el?.scrollIntoView({ behavior: RM ? 'auto' : 'smooth' });
    return;
  }
  lastFocus = opts.from || document.activeElement;
  info.querySelectorAll('section').forEach(s => s.classList.remove('active'));
  const sec = key === 'member' ? $('#info-member') : $('#info-' + key);
  sec.classList.add('active');
  info.classList.remove('all'); info.classList.add('open', 'panel');
  body.classList.add('panel-open');
  info.scrollTop = 0;
  lazyThumbs(sec);
  document.querySelectorAll('.dock [data-open]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.open === key)));
  stage?.focus(opts.spot || SECTION_SPOT[key]);
  requestAnimationFrame(() => (sec.querySelector('h2') || sec).focus?.({ preventScroll: true }));
}
function openAll() {
  if (!body.classList.contains('gl-on')) { info.scrollIntoView({ behavior: RM ? 'auto' : 'smooth' }); return; }
  lastFocus = document.activeElement;
  info.classList.remove('panel'); info.classList.add('open', 'all');
  body.classList.add('panel-open');
  lazyThumbs(info); info.scrollTop = 0; info.focus({ preventScroll: true });
  stage?.pause(true);
}
function closePanel() {
  if (!info.classList.contains('open')) return;
  info.classList.remove('open', 'all');
  body.classList.remove('panel-open');
  document.querySelectorAll('.dock [data-open]').forEach(b => b.setAttribute('aria-pressed', 'false'));
  stage?.pause(false); stage?.focus(null);
  lastFocus?.focus?.({ preventScroll: true });
}
function showMember(key, from) {
  const m = MEMBERS[key];
  $('#m-name').textContent = m.name; $('#m-role').textContent = m.role; $('#m-note').textContent = m.note;
  document.querySelectorAll('.lineup li').forEach(li => li.classList.toggle('hl', m.li.includes(li.dataset.m)));
  openPanel('member', { from, spot: from?.dataset.spot });
}
info.querySelectorAll('h2').forEach(h => h.tabIndex = -1);
document.addEventListener('click', e => {
  const o = e.target.closest('[data-open]');
  if (o) { e.preventDefault(); openPanel(o.dataset.open, { from: o }); return; }
  if (e.target.closest('#info [data-close]')) closePanel();
  if (e.target.closest('[data-all]')) openAll();
});
$('#skipInfo').addEventListener('click', openAll);
$('.skip').addEventListener('click', e => { if (body.classList.contains('gl-on')) { e.preventDefault(); openAll(); } });
addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#lb').open) closePanel(); });

// ---------------------------------------------------------------- media facades + lightbox
document.querySelectorAll('[data-yt]').forEach(b => b.addEventListener('click', () => {
  const f = document.createElement('iframe');
  f.src = `https://www.youtube-nocookie.com/embed/${b.dataset.yt}?autoplay=1&rel=0`;
  f.title = b.getAttribute('aria-label').replace(/^Play /, '');
  f.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen'; f.allowFullscreen = true;
  b.replaceWith(f);
}));
$('#spPlay').addEventListener('click', () => {
  const f = document.createElement('iframe');
  f.src = 'https://open.spotify.com/embed/album/2tPVzNhSrSD9UI7L6cBmHL?utm_source=generator&theme=0';
  f.title = 'Live at Rockaway Beach on Spotify';
  f.allow = 'autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture';
  $('#cover').replaceChildren(f);
});
const lb = $('#lb'), lbImg = $('img', lb), lbFull = $('[data-full]', lb);
const shots = [...document.querySelectorAll('#gallery button')];
let cur = 0;
const show = i => { cur = (i + shots.length) % shots.length; const b = shots[cur]; lbImg.src = b.dataset.large; lbImg.alt = b.querySelector('img').alt; lbFull.href = b.dataset.full; };
shots.forEach((b, i) => b.addEventListener('click', () => { show(i); lb.showModal(); }));
lb.addEventListener('click', e => { if (e.target === lb || e.target.closest('[data-close]')) lb.close(); const s = e.target.closest('[data-step]'); if (s) show(cur + +s.dataset.step); });
lb.addEventListener('keydown', e => { if (e.key === 'ArrowRight') show(cur + 1); if (e.key === 'ArrowLeft') show(cur - 1); });

// ---------------------------------------------------------------- hotspot buttons
const spotBtns = SPOTS.map(s => {
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'spot' + (s.member ? ' member' : ''); b.dataset.spot = s.id;
  b.innerHTML = `<i aria-hidden="true"></i><b>${s.label}</b>`;
  b.setAttribute('aria-label', s.member ? `${s.label} — who's playing` : `Open ${s.label}`);
  b.addEventListener('click', () => s.member ? showMember(s.member, b) : openPanel(s.open, { from: b, spot: s.id }));
  spotsEl.appendChild(b);
  return b;
});

// ---------------------------------------------------------------- WebGL stage
function hasWebGL() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; }
}
function fallback(reason) {
  root.classList.add('no-gl'); body.classList.remove('gl-on');
  const p = $('#app .poster'); if (p && !p.src) { p.srcset = `${A}scene-full-960.webp 960w, ${A}scene-full-1600.webp 1600w`; p.sizes = '100vw'; p.src = `${A}scene-full-960.webp`; }
  spotsEl.hidden = true;
  info.querySelectorAll('img[data-src]').forEach(i => { i.loading = 'lazy'; i.src = i.dataset.src; i.removeAttribute('data-src'); });
  if (reason) console.info('[epk5] static fallback:', reason);
}
if (!hasWebGL()) fallback('WebGL unavailable');
else boot().catch(err => { console.warn('[epk5] stage failed, using static fallback', err); fallback(); });

async function boot() {
  const bar = $('.loader i');
  const setP = p => bar.style.setProperty('--p', Math.round(p * 100) + '%');
  setP(.08);
  const THREE = await import('three');
  setP(.35);
  const canvas = $('#gl');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: devicePixelRatio < 2, powerPreference: 'high-performance', alpha: false });
  renderer.setClearColor(0x0a0908, 1);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, .05, 60);

  // ---- textures
  const small = Math.min(innerWidth, innerHeight) < 700 || (navigator.connection && /2g|3g/.test(navigator.connection.effectiveType || ''));
  const res = small ? 960 : 1800;
  const loader = new THREE.TextureLoader();
  let done = 0;
  const load = (url, color = true) => new Promise((ok, bad) => loader.load(url, t => {
    t.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    setP(.35 + (++done / 4) * .6); ok(t);
  }, undefined, bad));
  const [tBack, tMid, tFront, tDepth] = await Promise.all([
    load(`${A}scene-back-${res}.webp`), load(`${A}scene-mid-${res}.webp`), load(`${A}scene-front-${res}.webp`),
    load('epk-assets/epk5/depth-pack.webp', false)]);
  tDepth.generateMipmaps = false; tDepth.minFilter = THREE.LinearFilter;

  // ---- geometry: each photo layer becomes a relief, unprojected through the original camera
  const TAN = Math.tan(THREE.MathUtils.degToRad(25));   // assumed half-FOV of the original photo
  const ZFAR = 12, ZNEAR = 4.4;
  const depthAt = d => 1 / THREE.MathUtils.lerp(1 / ZFAR, 1 / ZNEAR, d);
  const unproject = (u, v, d) => { const Z = depthAt(d); return new THREE.Vector3((u - .5) * 2 * TAN * Z, (v - .5) * 2 * TAN * Z, -Z); };
  const common = { uDepth: { value: tDepth }, uTan: { value: TAN }, uInvFar: { value: 1 / ZFAR }, uInvNear: { value: 1 / ZNEAR }, uTime: { value: 0 }, uReveal: { value: RM ? 1 : 0 } };
  const vert = /* glsl */`
    uniform sampler2D uDepth; uniform float uTan, uInvFar, uInvNear, uChan, uReveal;
    varying vec2 vUv; varying float vZ;
    void main(){
      vUv = uv;
      vec3 dd = texture2D(uDepth, uv).rgb;
      float d = uChan < .5 ? dd.r : (uChan < 1.5 ? dd.g : dd.b);
      d = mix(dd.r, d, uReveal);               // layers "inflate" out of the wall during the intro
      float Z = 1. / mix(uInvFar, uInvNear, d);
      vZ = Z;
      vec3 p = vec3((uv.x - .5) * 2. * uTan * Z, (uv.y - .5) * 2. * uTan * Z, -Z);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.);
    }`;
  const frag = /* glsl */`
    uniform sampler2D uMap; uniform float uEdge, uTime, uFade; uniform vec3 uWarm;
    varying vec2 vUv; varying float vZ;
    void main(){
      vec4 c = texture2D(uMap, vUv);
      if (c.a < .04) discard;
      float e = smoothstep(0., uEdge, vUv.x) * smoothstep(0., uEdge, 1. - vUv.x) * smoothstep(0., uEdge * .5, vUv.y) * smoothstep(0., uEdge * .7, 1. - vUv.y);
      vec3 col = c.rgb;
      col *= mix(vec3(1.), uWarm, smoothstep(.25, .95, vUv.y) * .35);  // faint warm spill from the windows
      col *= e;
      gl_FragColor = vec4(col, c.a * uFade);
      #include <colorspace_fragment>
    }`;
  const layers = [];
  const mkLayer = (map, chan, segs, order) => {
    const m = new THREE.ShaderMaterial({
      uniforms: { ...common, uMap: { value: map }, uChan: { value: chan }, uEdge: { value: .085 }, uFade: { value: 1 }, uWarm: { value: new THREE.Color(1.06, .98, .86) } },
      vertexShader: vert, fragmentShader: frag, transparent: chan > 0, depthWrite: false, depthTest: false,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1, segs, segs), m);
    mesh.frustumCulled = false; mesh.renderOrder = order;
    scene.add(mesh); layers.push(m); return mesh;
  };
  mkLayer(tBack, 0, small ? 96 : 128, 0);
  mkLayer(tMid, 1, small ? 96 : 128, 1);
  mkLayer(tFront, 2, small ? 96 : 128, 2);

  // ---- lit windows: warm multiply tint + additive halo + new words painted on the glass
  await document.fonts.load('48px Shrikhand').catch(() => {});
  const WINS = [
    { u0: .0986, u1: .2734, v0: 1 - .342, v1: 1 - .0098, spring: .27, d: .0811, word: 'the story', sub: '', cover: false, spot: 'win-l' },
    { u0: .5615, u1: .7140, v0: 1 - .2561, v1: 1 - .1406, spring: .66, d: .0295, word: 'Watch', sub: 'VIDEOS', cover: true, spot: 'win-c' },
    { u0: .8535, u1: .9971, v0: 1 - .2517, v1: 1 - .1377, spring: .66, d: .0135, word: 'Booking', sub: '& CONTACT', cover: true, spot: 'win-r' },
  ];
  const winGroup = new THREE.Group(); scene.add(winGroup);
  const halo = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); const r = g.createRadialGradient(64, 64, 0, 64, 64, 64); r.addColorStop(0, 'rgba(255,190,100,.85)'); r.addColorStop(.35, 'rgba(255,160,70,.28)'); r.addColorStop(1, 'rgba(255,140,50,0)'); g.fillStyle = r; g.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const archPath = (g, w, h, spring) => { const ry = h * spring; g.beginPath(); g.moveTo(0, h); g.lineTo(0, ry); g.ellipse(w / 2, ry, w / 2, ry, 0, Math.PI, 0); g.lineTo(w, h); g.closePath(); };
  WINS.forEach(W => {
    const Z = depthAt(W.d);
    const w = (W.u1 - W.u0) * 2 * TAN * Z, h = (W.v1 - W.v0) * 2 * TAN * Z;
    const cx = ((W.u0 + W.u1) / 2 - .5) * 2 * TAN * Z, cy = ((W.v0 + W.v1) / 2 - .5) * 2 * TAN * Z;
    // tint (multiply)
    const tc = document.createElement('canvas'); tc.width = 256; tc.height = Math.round(256 * h / w);
    const g = tc.getContext('2d'); archPath(g, tc.width, tc.height, W.spring); g.clip();
    const gr = g.createRadialGradient(tc.width / 2, tc.height * .45, 4, tc.width / 2, tc.height * .45, tc.width * .75);
    gr.addColorStop(0, '#fff3d6'); gr.addColorStop(.6, '#ffcf88'); gr.addColorStop(1, '#f0a24c'); g.fillStyle = gr; g.fillRect(0, 0, tc.width, tc.height);
    const tint = new THREE.CanvasTexture(tc); tint.colorSpace = THREE.SRGBColorSpace;
    const tintMat = new THREE.MeshBasicMaterial({ map: tint, transparent: true, premultipliedAlpha: true, depthWrite: false, depthTest: false, opacity: 0,
      blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.DstColorFactor, blendDst: THREE.OneMinusSrcAlphaFactor });
    // words
    const wc = document.createElement('canvas'); wc.width = 512; wc.height = Math.round(512 * h / w);
    const g2 = wc.getContext('2d'); archPath(g2, wc.width, wc.height, W.spring); g2.clip();
    if (W.cover) { const gg = g2.createRadialGradient(wc.width / 2, wc.height * .45, 10, wc.width / 2, wc.height * .45, wc.width * .7); gg.addColorStop(0, '#f6f4f0'); gg.addColorStop(1, '#d9d7d2'); g2.fillStyle = gg; g2.fillRect(0, 0, wc.width, wc.height); }
    g2.fillStyle = '#2a1c10'; g2.textAlign = 'center'; g2.textBaseline = 'middle';
    g2.save(); g2.translate(wc.width / 2, W.cover ? wc.height * .5 : wc.height * .8); g2.rotate(-.06);
    g2.font = `${W.cover ? Math.round(wc.width * (W.word.length > 6 ? .165 : .22)) : Math.round(wc.width * .14)}px Shrikhand`;
    g2.fillText(W.word, 0, W.sub ? -wc.width * .02 : 0); g2.restore();
    if (W.sub) { g2.font = `700 ${Math.round(wc.width * .065)}px Bricolage, sans-serif`; g2.globalAlpha = .75; g2.fillText(W.sub, wc.width / 2, wc.height * .5 + wc.width * .13); }
    const wordTex = new THREE.CanvasTexture(wc); wordTex.colorSpace = THREE.SRGBColorSpace; wordTex.anisotropy = 4;
    const wordMat = new THREE.MeshBasicMaterial({ map: wordTex, transparent: true, depthWrite: false, depthTest: false, opacity: 0 });
    const haloMat = new THREE.SpriteMaterial({ map: halo, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, transparent: true, opacity: 0 });
    const plane = new THREE.PlaneGeometry(w, h);
    const mW = new THREE.Mesh(plane, wordMat), mT = new THREE.Mesh(plane, tintMat), sH = new THREE.Sprite(haloMat);
    mW.position.set(cx, cy, -Z); mT.position.set(cx, cy, -Z); sH.position.set(cx, cy, -Z + .05);
    sH.scale.set(w * 2.6, w * 2.6, 1);
    mW.renderOrder = .5; mT.renderOrder = .6; sH.renderOrder = .7;
    winGroup.add(mW, mT, sH);
    W.mats = { wordMat, tintMat, haloMat }; W.lit = 0; W.hover = 0;
  });

  // ---- dust motes drifting in the window light
  const N = small ? 140 : 260, pos = new Float32Array(N * 3), seed = new Float32Array(N);
  for (let i = 0; i < N; i++) { const z = -4 - Math.random() * 6, half = Math.tan(.42) * -z; pos[i * 3] = (Math.random() - .5) * 2 * half; pos[i * 3 + 1] = (Math.random() - .35) * 2 * half; pos[i * 3 + 2] = z; seed[i] = Math.random() * 100; }
  const dustGeo = new THREE.BufferGeometry(); dustGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); dustGeo.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
  const dustMat = new THREE.ShaderMaterial({
    uniforms: { uTime: common.uTime, uPx: { value: renderer.getPixelRatio() }, uAlpha: { value: 0 } },
    vertexShader: `uniform float uTime,uPx; attribute float seed; varying float vA;
      void main(){ vec3 p = position; float t = uTime*.06 + seed;
        p.x += sin(t*1.3)*.35; p.y += sin(t*.9 + seed)*.25 + mod(uTime*.03 + seed*.1, 1.)*.4; p.z += cos(t)*.2;
        vec4 mv = modelViewMatrix*vec4(p,1.); gl_Position = projectionMatrix*mv;
        gl_PointSize = uPx * (2.2 + fract(seed)*2.6) * (6. / -mv.z); vA = .35 + .65*fract(seed*7.);
      }`,
    fragmentShader: `uniform float uAlpha; varying float vA; void main(){ vec2 c = gl_PointCoord-.5; float a = smoothstep(.5,.0,length(c)); gl_FragColor = vec4(1.,.82,.55, a*vA*uAlpha); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const dust = new THREE.Points(dustGeo, dustMat); dust.frustumCulled = false; dust.renderOrder = 3; scene.add(dust);

  // ---- hotspot anchors in world space
  SPOTS.forEach(s => { s.p = unproject(s.a[0], s.a[1], s.a[2]); });

  // ---------------------------------------------------------------- camera rig
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const OVER = { yaw: .07, pitch: .04, dist: 8.1, t: V(0, .42, -7.6) };
  const START = { yaw: -.32, pitch: .2, dist: 14, t: V(0, 1.1, -7.6) };
  const rig = RM ? { ...OVER, t: OVER.t.clone() } : { ...START, t: START.t.clone() };
  let goal = { ...OVER, t: OVER.t.clone() };
  const LIM = { yaw: [-.3, .3], pitch: [-.06, .22], dist: [6.2, 11] };
  const tmp = new THREE.Vector3();
  function poseFor(id) {
    const s = SPOTS.find(x => x.id === id); if (!s) return { ...OVER, t: OVER.t.clone() };
    const p = s.p, onWall = p.z < -9;
    const t = V(THREE.MathUtils.lerp(OVER.t.x, p.x, onWall ? .55 : .7), THREE.MathUtils.lerp(OVER.t.y, p.y, onWall ? .6 : .7), THREE.MathUtils.lerp(OVER.t.z, p.z, .35));
    return { yaw: THREE.MathUtils.clamp(-p.x * .06, -.22, .22) + (onWall ? 0 : .05), pitch: onWall ? .02 : .08, dist: onWall ? 7.6 : 6.6, t };
  }
  let viewOffset = { x: 0, y: 0 }, viewGoal = { x: 0, y: 0 };
  const api = {
    focus(id) {
      goal = id ? poseFor(id) : { ...OVER, t: OVER.t.clone() };
      const panelOpen = !!id;
      const mobile = innerWidth <= 700;
      viewGoal = panelOpen ? (mobile ? { x: 0, y: Math.min(innerHeight * .74, 640) / 2 } : { x: Math.min(460, innerWidth) / 2, y: 0 }) : { x: 0, y: 0 };
      WINS.forEach(W => W.hover = W.spot === id ? 1 : 0);
      kick();
    },
    pause(p) { paused = p; if (!p) kick(); },
  };

  // ---- input
  let dragging = false, lx = 0, ly = 0, vyaw = 0, vpitch = 0, pinch = 0, lastInput = 0;
  const ptrs = new Map();
  const userMoved = () => { lastInput = performance.now(); body.classList.remove('show-hint'); };
  canvas.addEventListener('pointerdown', e => { canvas.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, [e.clientX, e.clientY]); dragging = true; lx = e.clientX; ly = e.clientY; vyaw = vpitch = 0; userMoved(); });
  canvas.addEventListener('pointermove', e => {
    if (!ptrs.has(e.pointerId)) { hoverAt(e.clientX, e.clientY); return; }
    ptrs.set(e.pointerId, [e.clientX, e.clientY]);
    if (ptrs.size === 2) {
      const [a, b] = [...ptrs.values()]; const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      if (pinch) goal.dist = THREE.MathUtils.clamp(goal.dist * pinch / d, ...LIM.dist); pinch = d; kick(); return;
    }
    const dx = e.clientX - lx, dy = e.clientY - ly; lx = e.clientX; ly = e.clientY;
    vyaw = -dx * .0042; vpitch = dy * .0032;
    goal.yaw = THREE.MathUtils.clamp(goal.yaw + vyaw, ...LIM.yaw); goal.pitch = THREE.MathUtils.clamp(goal.pitch + vpitch, ...LIM.pitch);
    userMoved(); kick();
  });
  const up = e => { ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch = 0; if (!ptrs.size) dragging = false; };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('wheel', e => { e.preventDefault(); goal.dist = THREE.MathUtils.clamp(goal.dist * (1 + Math.sign(e.deltaY) * Math.min(.12, Math.abs(e.deltaY) * .0012)), ...LIM.dist); userMoved(); kick(); }, { passive: false });
  const keys = new Set();
  addEventListener('keydown', e => {
    if (info.classList.contains('open') || e.target.closest?.('input,textarea')) return;
    if (/^(KeyW|KeyA|KeyS|KeyD|ArrowUp|ArrowDown|ArrowLeft|ArrowRight|KeyQ|KeyE)$/.test(e.code)) { keys.add(e.code); userMoved(); kick(); if (e.code.startsWith('Arrow')) e.preventDefault(); }
  });
  addEventListener('keyup', e => keys.delete(e.code));
  addEventListener('blur', () => keys.clear());

  // window glow on hover over a window region
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function hoverAt(x, y) {
    let best = null;
    WINS.forEach(W => { tmp.copy(W.mats ? winGroup.children[WINS.indexOf(W) * 3].position : tmp).project(camera); });
    spotBtns.forEach((b, i) => { if (!SPOTS[i].id.startsWith('win')) return; const r = b.getBoundingClientRect(); if (Math.hypot(r.left + 11 - x, r.top + 11 - y) < 70) best = SPOTS[i].id; });
    WINS.forEach(W => W.hover = (W.spot === best || info.classList.contains('open') && W.hover === 1 && W.spot === best) ? 1 : (info.classList.contains('panel') ? W.hover : 0));
    if (best) kick();
  }
  spotBtns.forEach((b, i) => {
    const id = SPOTS[i].id; if (!id.startsWith('win')) return;
    b.addEventListener('pointerenter', () => { WINS.find(W => W.spot === id).hover = 1; kick(); });
    b.addEventListener('pointerleave', () => { if (!info.classList.contains('open')) { WINS.find(W => W.spot === id).hover = 0; kick(); } });
  });

  // ---------------------------------------------------------------- frame loop
  let w = 0, h = 0, paused = false, running = false, t0 = performance.now(), introT = RM ? 1 : 0, last = performance.now(), introStart = 0, frames = 0;
  function resize() {
    w = app.clientWidth; h = app.clientHeight;
    renderer.setSize(w, h, false);
    const aspect = w / h; camera.aspect = aspect;
    const halfW = aspect < .9 ? .25 : .44, halfH = .36;
    camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.max(halfH, halfW / aspect)));
    camera.updateProjectionMatrix(); kick();
  }
  const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  function kick() { if (!running && !paused) { running = true; last = performance.now(); requestAnimationFrame(loop); } }
  function loop(now) {
    if (paused) { running = false; return; }
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    const time = (now - t0) / 1000;
    common.uTime.value = time;
    // intro crane shot
    if (introT < 1) {
      if (!introStart) introStart = now;
      introT = Math.min(1, (now - introStart) / 4200);
      const k = ease(introT);
      rig.yaw = THREE.MathUtils.lerp(START.yaw, goal.yaw, k); rig.pitch = THREE.MathUtils.lerp(START.pitch, goal.pitch, k);
      rig.dist = THREE.MathUtils.lerp(START.dist, goal.dist, k); rig.t.lerpVectors(START.t, goal.t, k);
      common.uReveal.value = THREE.MathUtils.smoothstep(introT, .05, .75);
      if (introT >= 1) onArrive();
    } else {
      // keyboard walk
      const sp = dt * 2.2;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) goal.yaw = Math.min(LIM.yaw[1], goal.yaw + sp * .45);
      if (keys.has('KeyD') || keys.has('ArrowRight')) goal.yaw = Math.max(LIM.yaw[0], goal.yaw - sp * .45);
      if (keys.has('KeyW') || keys.has('ArrowUp')) goal.dist = Math.max(LIM.dist[0], goal.dist - sp * 1.6);
      if (keys.has('KeyS') || keys.has('ArrowDown')) goal.dist = Math.min(LIM.dist[1], goal.dist + sp * 1.6);
      if (keys.has('KeyQ')) goal.t.x = Math.max(-2, goal.t.x - sp * .8);
      if (keys.has('KeyE')) goal.t.x = Math.min(2, goal.t.x + sp * .8);
      // inertia after drag
      if (!dragging && (Math.abs(vyaw) > 1e-5 || Math.abs(vpitch) > 1e-5)) {
        goal.yaw = THREE.MathUtils.clamp(goal.yaw + vyaw, ...LIM.yaw); goal.pitch = THREE.MathUtils.clamp(goal.pitch + vpitch, ...LIM.pitch);
        vyaw *= .9; vpitch *= .9;
      }
      const k = 1 - Math.pow(.0016, dt);      // critically-damped-ish follow
      rig.yaw += (goal.yaw - rig.yaw) * k; rig.pitch += (goal.pitch - rig.pitch) * k; rig.dist += (goal.dist - rig.dist) * k; rig.t.lerp(goal.t, k);
    }
    // idle sway when nobody is touching it
    const idle = !RM && introT >= 1 && now - lastInput > 4000 && !info.classList.contains('open');
    const sway = idle ? Math.min(1, (now - lastInput - 4000) / 3000) : 0;
    const swayAmp = w / h < .9 ? .2 : .1;
    const yaw = rig.yaw + sway * Math.sin(time * .16) * swayAmp, pitch = rig.pitch + sway * Math.sin(time * .11) * .025;
    camera.position.set(rig.t.x + rig.dist * Math.sin(yaw) * Math.cos(pitch), rig.t.y + rig.dist * Math.sin(pitch), rig.t.z + rig.dist * Math.cos(yaw) * Math.cos(pitch));
    camera.position.z = Math.max(camera.position.z, -1.6);
    camera.lookAt(rig.t);
    // panel view offset (keeps the focused thing visible beside the drawer)
    viewOffset.x += (viewGoal.x - viewOffset.x) * Math.min(1, dt * 6); viewOffset.y += (viewGoal.y - viewOffset.y) * Math.min(1, dt * 6);
    if (Math.abs(viewOffset.x) > .5 || Math.abs(viewOffset.y) > .5) camera.setViewOffset(w, h, viewOffset.x, viewOffset.y, w, h); else camera.clearViewOffset();
    // windows
    WINS.forEach((W, i) => {
      const target = W.on ? (.78 + W.hover * .22) : 0;
      W.lit += (target - W.lit) * Math.min(1, dt * 5);
      const flick = W.on && W.flickT < 1 ? (W.flickT += dt * 1.4, [.0, .9, .2, 1, .5, 1][Math.min(5, Math.floor(W.flickT * 6))]) : 1;
      const L = W.lit * flick;
      W.mats.tintMat.opacity = L; W.mats.haloMat.opacity = L * (.55 + W.hover * .45); W.mats.wordMat.opacity = W.cover ? Math.min(1, L * 1.25) : L;
    });
    dustMat.uniforms.uAlpha.value = Math.min(1, dustMat.uniforms.uAlpha.value + dt * .5) * (RM ? 0 : 1);
    renderer.render(scene, camera); frames++;
    placeSpots();
    const settling = introT < 1 || keys.size || dragging || Math.abs(goal.yaw - rig.yaw) + Math.abs(goal.dist - rig.dist) + rig.t.distanceTo(goal.t) > 1e-3 || Math.abs(viewGoal.x - viewOffset.x) + Math.abs(viewGoal.y - viewOffset.y) > .5 || WINS.some(W => Math.abs((W.on ? .78 + W.hover * .22 : 0) - W.lit) > 1e-3);
    if (!RM || settling) requestAnimationFrame(loop); else running = false;
  }
  function placeSpots() {
    const vis = introT >= 1;
    SPOTS.forEach((s, i) => {
      tmp.copy(s.p).project(camera);
      const x = (tmp.x * .5 + .5) * w, y = (-tmp.y * .5 + .5) * h;
      const on = vis && tmp.z < 1 && x > 8 && x < w - 8 && y > 70 && y < h - 70;
      const b = spotBtns[i];
      b.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0)`;
      b.classList.toggle('vis', on); b.tabIndex = on ? 0 : -1;
    });
  }
  function onArrive() {
    WINS.forEach((W, i) => setTimeout(() => { W.on = true; W.flickT = RM ? 1 : 0; kick(); }, RM ? 0 : 150 + i * 260));
    if (!RM) setTimeout(() => { body.classList.add('show-hint'); setTimeout(() => body.classList.remove('show-hint'), 6000); }, 900);
  }

  addEventListener('resize', resize);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) kick(); });
  resize();
  stage = api;
  body.classList.add('gl-on'); root.classList.add('ready');
  if (RM) onArrive();
  kick();
  // expose for tests
  window.__epk5 = { THREE, renderer, camera, rig, get goal() { return goal; }, api, get frames() { return frames; } };
}
