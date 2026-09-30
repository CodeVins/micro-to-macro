/* 지구 위 대상들: 사람, 동물, 탈것, 건축물, 지형.
   builders.js의 B를 덮어쓰거나 새로 더한다. 모델 단위 1 = 그 대상의 대표 크기(10^exp m). */
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { B, R, std, glow, makePoints, canvasTex, cylBetween, textSprite } from "./builders.js";

/* ---------- 노이즈 ---------- */
function hash2(x, y) { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); }
function vnoise(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy), b = hash2(ix + 1, iy), c = hash2(ix, iy + 1), d = hash2(ix + 1, iy + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, y, o = 5) { let s = 0, a = 0.5, f = 1; for (let i = 0; i < o; i++) { s += a * vnoise(x * f + i * 7.3, y * f); f *= 2.03; a *= 0.5; } return s; }
function ridged(x, y, o = 5) { let s = 0, a = 0.5, f = 1; for (let i = 0; i < o; i++) { const n = 1 - Math.abs(vnoise(x * f, y * f + i * 3.1) * 2 - 1); s += a * n * n; f *= 2.1; a *= 0.5; } return s; }
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/* ---------- 재질·도형 도우미 ---------- */
const phys = (color, o) => new THREE.MeshPhysicalMaterial(Object.assign({ color, roughness: 0.5, metalness: 0 }, o || {}));
function mesh(geo, mat, x = 0, y = 0, z = 0) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); return m; }
function sway(g, inner, speed, amp) { g.userData.tick = (t) => { inner.rotation.y = amp ? Math.sin(t * speed) * amp : t * speed; }; return g; }
function holder(inner, speed, amp) { const g = new THREE.Group(); g.add(inner); return sway(g, inner, speed, amp); }
const HDR = (hex, k) => new THREE.Color(hex).multiplyScalar(k); // 1보다 밝은 색: 블룸이 잡는다

/* 다각형까지의 부호 있는 거리 (안쪽 +) */
function polyDist(px, pz, poly) {
  let inside = false, md = 1e9;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i], [xj, zj] = poly[j];
    if ((zi > pz) !== (zj > pz) && px < ((xj - xi) * (pz - zi)) / (zj - zi) + xi) inside = !inside;
    const dx = xj - xi, dz = zj - zi, t = Math.max(0, Math.min(1, ((px - xi) * dx + (pz - zi) * dz) / (dx * dx + dz * dz)));
    const ex = xi + t * dx - px, ez = zi + t * dz - pz;
    md = Math.min(md, ex * ex + ez * ez);
  }
  return (inside ? 1 : -1) * Math.sqrt(md);
}

/* 지형 판: xz 평면 격자에 높이와 꼭짓점 색을 입힌다. polys가 있으면 바깥은 바다. */
function relief({ w, d, seg = 160, polys, height, color, sea = [0x0b2440, 0x1f6a8e], base = !polys, edgeFade = false }) {
  const geo = new THREE.PlaneGeometry(w, d, seg, Math.max(2, Math.round((seg * d) / w)));
  geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position, n = p.count, dist = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = p.getX(i), z = p.getZ(i);
    let dd = 1;
    if (polys) { dd = -1e9; for (const poly of polys) dd = Math.max(dd, polyDist(x, z, poly)); }
    dist[i] = dd;
    p.setY(i, dd < 0 ? -0.002 : height(x, z, dd));
  }
  geo.computeVertexNormals();
  /* 바다는 해안에서 멀어질수록 투명해져, 지도가 네모난 판이 아니라 떠 있는 땅처럼 보인다 */
  const nm = geo.attributes.normal, col = [], c = new THREE.Color(), deep = new THREE.Color(sea[0]), shallow = new THREE.Color(sea[1]);
  for (let i = 0; i < n; i++) {
    const x = p.getX(i), z = p.getZ(i), h = p.getY(i);
    let a = 1;
    if (dist[i] < 0) { const k = sstep(-w * 0.045, 0, dist[i]); c.copy(deep).lerp(shallow, k); a = 0.85 * k; }
    else { color(c, h, 1 - nm.getY(i), x, z, dist[i]); if (edgeFade) a = sstep(0, 0.07, h); }
    col.push(c.r, c.g, c.b, a);
  }
  geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 4));
  const g = new THREE.Group();
  g.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0 })));
  if (base) g.add(mesh(new THREE.BoxGeometry(w, 0.008 * Math.min(w, d), d), std(0x1a1d24, { roughness: 0.8 }), 0, -0.004 * Math.min(w, d) - 0.002, 0));
  return g;
}

/* 경도·위도 → 모델 단위 (북쪽이 -z) */
function lonlat(pts, lon0, lat0, unitKm) {
  const kx = Math.cos((lat0 * Math.PI) / 180) * 111.32 / unitKm, kz = 110.9 / unitKm;
  return pts.map(([lo, la]) => [(lo - lon0) * kx, -(la - lat0) * kz]);
}

/* ================= 사람 ================= */
B.human = function () {
  const inner = new THREE.Group();
  const skin = phys(0xc49a80, { roughness: 0.6 });
  const coat = phys(0x8f7a5c, { roughness: 0.85, sheen: 0.25, sheenColor: new THREE.Color(0xd8c8b0) });
  const pants = phys(0x2a3140, { roughness: 0.85 });
  const shoe = phys(0x18181c, { roughness: 0.35, clearcoat: 0.6 });
  const hairM = phys(0x241c18, { roughness: 0.6, sheen: 0.5 });
  const cap = (r, len, mat, x, y, z, rz = 0, rx = 0) => { const m = mesh(new THREE.CapsuleGeometry(r, len, 8, 18), mat, x, y, z); m.rotation.set(rx, 0, rz); inner.add(m); return m; };
  [-1, 1].forEach((s) => {
    cap(0.068, 0.3, pants, 0.092 * s, 0.7, 0);
    cap(0.052, 0.32, pants, 0.098 * s, 0.29, 0);
    cap(0.048, 0.14, shoe, 0.1 * s, 0.05, 0.045, 0, Math.PI / 2);
    cap(0.047, 0.24, coat, 0.215 * s, 1.24, 0, 0.09 * s);
    cap(0.04, 0.17, coat, 0.235 * s, 0.95, 0.02, 0.04 * s, -0.12);
    const hand = mesh(new THREE.SphereGeometry(0.043, 16, 12), skin, 0.24 * s, 0.77, 0.035);
    hand.scale.set(0.7, 1.25, 0.95); inner.add(hand);
  });
  const prof = [[0.001, 0.7], [0.17, 0.71], [0.166, 0.85], [0.155, 0.96], [0.15, 1.04], [0.168, 1.2], [0.182, 1.33], [0.172, 1.41], [0.12, 1.46], [0.05, 1.49], [0.001, 1.49]]
    .map(([r, y]) => new THREE.Vector2(r, y));
  const torso = mesh(new THREE.LatheGeometry(prof, 40), coat); torso.scale.z = 0.62; inner.add(torso);
  const collar = mesh(new THREE.TorusGeometry(0.062, 0.022, 10, 28), coat, 0, 1.46, 0); collar.rotation.x = Math.PI / 2; collar.scale.y = 0.7; inner.add(collar);
  inner.add(mesh(new THREE.CylinderGeometry(0.044, 0.05, 0.1, 18), skin, 0, 1.5, 0));
  const head = mesh(new THREE.SphereGeometry(0.1, 32, 24), skin, 0, 1.62, 0); head.scale.set(0.88, 1.08, 0.96); inner.add(head);
  inner.add(mesh(new THREE.SphereGeometry(0.016, 10, 8), skin, 0, 1.605, 0.093));
  [-1, 1].forEach((s) => { const ear = mesh(new THREE.SphereGeometry(0.02, 10, 8), skin, 0.088 * s, 1.615, 0); ear.scale.set(0.5, 1, 0.8); inner.add(ear); });
  const hair = mesh(new THREE.SphereGeometry(0.106, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.56), hairM, 0, 1.635, -0.008);
  hair.scale.set(0.9, 1.08, 0.98); hair.rotation.x = -0.32; inner.add(hair);
  inner.scale.setScalar(1 / 1.7);
  return holder(inner, 0.35, 0.6);
};

/* ================= 고양이 ================= */
B.cat = function () {
  const inner = new THREE.Group();
  const furTex = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = "#6f675d"; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 12; i++) {
      const y = (i + 0.5) * (h / 12);
      g.fillStyle = "rgba(40,36,32,.35)"; g.beginPath(); g.moveTo(0, y);
      for (let x = 0; x <= w; x += 8) g.lineTo(x, y + Math.sin(x * 0.05 + i) * 4 + Math.sin((x / w) * Math.PI * 2) * 3);
      for (let x = w; x >= 0; x -= 8) g.lineTo(x, y + 3 + 3 * Math.abs(Math.sin((x / w) * Math.PI * 2)) + Math.sin(x * 0.05 + i + 1) * 2);
      g.fill();
    }

    for (let k = 0; k < 900; k++) { g.fillStyle = "rgba(255,245,230," + (R() * 0.08).toFixed(2) + ")"; g.fillRect(R() * w, R() * h, 1, 3); }
  });
  const fur = phys(0xffffff, { map: furTex, roughness: 0.9, sheen: 0.35, sheenRoughness: 0.6, sheenColor: new THREE.Color(0x6a6258) });
  furTex.wrapS = THREE.RepeatWrapping; furTex.offset.x = 0.25;
  const plain = phys(0x6f675d, { roughness: 0.9, sheen: 0.35, sheenRoughness: 0.6, sheenColor: new THREE.Color(0x6a6258) });
  const pale = phys(0xb9b0a2, { roughness: 0.9, sheen: 0.6 });
  const body = mesh(new THREE.CapsuleGeometry(0.085, 0.26, 10, 24), fur, 0, 0.25, 0); body.rotation.z = Math.PI / 2; body.scale.set(0.95, 1, 0.82); inner.add(body);
  const chest = mesh(new THREE.SphereGeometry(0.088, 24, 16), fur, 0.14, 0.27, 0); chest.scale.set(1, 1.02, 0.84); inner.add(chest);
  const hip = mesh(new THREE.SphereGeometry(0.09, 24, 16), fur, -0.14, 0.245, 0); hip.scale.set(1, 1, 0.86); inner.add(hip);
  const head = new THREE.Group(); head.position.set(0.25, 0.36, 0); inner.add(head);
  const skull = mesh(new THREE.SphereGeometry(0.068, 28, 20), plain); skull.scale.set(1, 0.92, 1.08); head.add(skull);
  const muzzle = mesh(new THREE.SphereGeometry(0.032, 18, 12), pale, 0.052, -0.022, 0); muzzle.scale.set(0.9, 0.78, 1.35); head.add(muzzle);
  head.add(mesh(new THREE.SphereGeometry(0.009, 10, 8), phys(0xc98a8a, { roughness: 0.4 }), 0.083, -0.012, 0));
  [-1, 1].forEach((s) => {
    const ear = mesh(new THREE.ConeGeometry(0.028, 0.06, 4, 1), plain, -0.01, 0.068, 0.036 * s); ear.rotation.set(-0.3 * s, Math.PI / 4, -0.15); head.add(ear);
    const eye = mesh(new THREE.SphereGeometry(0.012, 14, 10), new THREE.MeshBasicMaterial({ color: HDR(0xc8df5a, 1.25) }), 0.055, 0.014, 0.03 * s); eye.scale.set(0.6, 1, 1); head.add(eye);
    [0.15, -0.15].forEach((x) => {
      inner.add(mesh(new THREE.CapsuleGeometry(0.024, 0.13, 6, 14), plain, x, 0.105, 0.046 * s));
      const paw = mesh(new THREE.SphereGeometry(0.028, 14, 10), pale, x + 0.01, 0.025, 0.046 * s); paw.scale.set(1.2, 0.7, 1); inner.add(paw);
    });
  });
  const tail = new THREE.Group(); tail.position.set(-0.22, 0.27, 0); inner.add(tail);
  const tc = new THREE.CatmullRomCurve3([[0, 0, 0], [-0.1, 0.03, 0], [-0.17, 0.13, 0.02], [-0.16, 0.24, 0.05]].map((p) => new THREE.Vector3(...p)));
  tail.add(new THREE.Mesh(new THREE.TubeGeometry(tc, 40, 0.019, 10), plain));
  const g = new THREE.Group(); g.add(inner); inner.scale.setScalar(1 / 0.447);
  g.userData.tick = (t) => { tail.rotation.y = Math.sin(t * 1.6) * 0.35; head.rotation.y = Math.sin(t * 0.4) * 0.25; inner.rotation.y = Math.sin(t * 0.2) * 0.5; };
  return g;
};

/* ================= 자동차 ================= */
B.car = function () {
  const inner = new THREE.Group(), W = 1.7;
  const paint = phys(0x8a1a22, { metalness: 0.55, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.06 });
  const glass = phys(0x0b0f16, { metalness: 0.3, roughness: 0.05, clearcoat: 1 });
  const body = new THREE.Shape();
  body.moveTo(2.25, 0.32); body.lineTo(2.36, 0.56); body.quadraticCurveTo(2.36, 0.74, 2.12, 0.82);
  body.quadraticCurveTo(1.6, 0.9, 1.0, 0.97); body.lineTo(-1.85, 1.01); body.quadraticCurveTo(-2.3, 1.0, -2.36, 0.86);
  body.lineTo(-2.38, 0.58); body.quadraticCurveTo(-2.36, 0.34, -2.2, 0.32); body.lineTo(-1.86, 0.32);
  body.absarc(-1.45, 0.32, 0.41, Math.PI, 0, true); body.lineTo(1.04, 0.32); body.absarc(1.45, 0.32, 0.41, Math.PI, 0, true); body.lineTo(2.25, 0.32);
  const bgeo = new THREE.ExtrudeGeometry(body, { depth: W, bevelEnabled: true, bevelThickness: 0.1, bevelSize: 0.07, bevelSegments: 5, curveSegments: 28 });
  bgeo.translate(0, 0, -W / 2); inner.add(new THREE.Mesh(bgeo, paint));
  const cab = new THREE.Shape();
  cab.moveTo(1.05, 0.96); cab.quadraticCurveTo(0.55, 1.28, 0.15, 1.4); cab.lineTo(-0.85, 1.39); cab.quadraticCurveTo(-1.45, 1.3, -1.9, 1.0); cab.lineTo(1.05, 0.96);
  const cgeo = new THREE.ExtrudeGeometry(cab, { depth: W - 0.3, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.05, bevelSegments: 4, curveSegments: 20 });
  cgeo.translate(0, 0, -(W - 0.3) / 2); inner.add(new THREE.Mesh(cgeo, glass));
  const tire = std(0x131316, { roughness: 0.85 }), rim = phys(0xc8ccd2, { metalness: 1, roughness: 0.25 });
  [1.45, -1.45].forEach((x) => [-1, 1].forEach((s) => {
    const wh = new THREE.Group(); wh.position.set(x, 0.36, s * (W / 2 + 0.02)); inner.add(wh);
    const t = mesh(new THREE.TorusGeometry(0.28, 0.1, 14, 36), tire); wh.add(t);
    const r = mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.16, 28), rim); r.rotation.x = Math.PI / 2; wh.add(r);
    for (let k = 0; k < 5; k++) { const sp = mesh(new THREE.BoxGeometry(0.05, 0.4, 0.04), rim, 0, 0, 0.09 * s); sp.rotation.z = (k / 5) * Math.PI * 2; wh.add(sp); }
  }));
  const head = new THREE.MeshBasicMaterial({ color: HDR(0xf2f6ff, 1.6) }), tail = new THREE.MeshBasicMaterial({ color: HDR(0xff2a2a, 1.4) });
  [-1, 1].forEach((s) => inner.add(mesh(new THREE.BoxGeometry(0.1, 0.07, 0.42), head, 2.37, 0.7, s * 0.62)));
  inner.add(mesh(new THREE.BoxGeometry(0.05, 0.035, W - 0.1), tail, -2.43, 0.84, 0));
  inner.scale.setScalar(1 / 4.68);
  return holder(inner, 0.25, 0.5);
};

/* ================= 시내버스 ================= */
B.bus = function () {
  const inner = new THREE.Group();
  const white = phys(0xeef1f4, { roughness: 0.35, clearcoat: 0.8 }), blue = phys(0x1d5fc8, { roughness: 0.35, clearcoat: 0.8 });
  const glass = phys(0x0c1119, { roughness: 0.05, metalness: 0.3, clearcoat: 1 });
  inner.add(mesh(new RoundedBoxGeometry(11, 2.85, 2.5, 5, 0.22), white, 0, 1.775, 0));
  inner.add(mesh(new RoundedBoxGeometry(11.02, 0.85, 2.52, 4, 0.18), blue, 0, 0.9, 0));
  inner.add(mesh(new RoundedBoxGeometry(9.0, 1.2, 2.54, 3, 0.1), glass, -0.55, 2.3, 0));
  inner.add(mesh(new RoundedBoxGeometry(0.2, 1.95, 2.3, 3, 0.08), glass, 5.43, 2.05, 0));
  inner.add(mesh(new RoundedBoxGeometry(3.2, 0.32, 1.9, 3, 0.1), std(0xc5cbd2, { roughness: 0.5 }), 0.5, 3.3, 0));
  inner.add(mesh(new THREE.BoxGeometry(0.06, 0.26, 1.7), new THREE.MeshBasicMaterial({ color: HDR(0xffa23a, 1.5) }), 5.53, 3.0, 0));
  const hl = new THREE.MeshBasicMaterial({ color: HDR(0xf2f6ff, 1.6) });
  [-1, 1].forEach((s) => inner.add(mesh(new THREE.BoxGeometry(0.06, 0.16, 0.35), hl, 5.52, 0.75, s * 0.85)));
  const tire = std(0x131316, { roughness: 0.85 }), hub = phys(0xb9bec6, { metalness: 1, roughness: 0.3 });
  [3.6, -2.9].forEach((x) => [-1, 1].forEach((s) => {
    const t = mesh(new THREE.TorusGeometry(0.36, 0.14, 12, 32), tire, x, 0.5, s * 1.2); inner.add(t);
    const h = mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.1, 24), hub, x, 0.5, s * 1.22); h.rotation.x = Math.PI / 2; inner.add(h);
  }));
  inner.scale.setScalar(1 / 11);
  return holder(inner, 0.22, 0.45);
};

/* ================= 대왕고래 ================= */
B.whale = function () {
  const inner = new THREE.Group();
  const prof = [[0.001, 0.5], [0.022, 0.496], [0.046, 0.484], [0.063, 0.46], [0.075, 0.42], [0.083, 0.35], [0.087, 0.25], [0.086, 0.12], [0.08, 0], [0.07, -0.12],
    [0.056, -0.24], [0.04, -0.33], [0.024, -0.41], [0.013, -0.46], [0.008, -0.49], [0.001, -0.5]].map(([r, y]) => new THREE.Vector2(r, y));
  const geo = new THREE.LatheGeometry(prof, 120);
  geo.rotateZ(-Math.PI / 2); geo.scale(1, 0.82, 1); geo.computeVertexNormals();
  const p = geo.attributes.position, nm = geo.attributes.normal, col = [], c = new THREE.Color();
  const top = new THREE.Color(0x3b5068), belly = new THREE.Color(0xb3c0ca), spot = new THREE.Color(0x7d93a8);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), ny = nm.getY(i);
    c.copy(top).lerp(spot, sstep(0.55, 0.8, fbm(x * 40, z * 40 + p.getY(i) * 40, 3)) * 0.8);
    const b = sstep(-0.15, -0.65, ny);
    c.lerp(belly, b);
    if (b > 0.3 && x > -0.05) { const stripe = Math.abs(((z * 160) % 1 + 1) % 1 - 0.5); if (stripe < 0.18) c.multiplyScalar(0.72); }
    col.push(c.r, c.g, c.b);
  }
  geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  const skin = phys(0xffffff, { vertexColors: true, roughness: 0.4, clearcoat: 0.5, clearcoatRoughness: 0.3 });
  inner.add(new THREE.Mesh(geo, skin));
  const finM = phys(0x3f5570, { roughness: 0.45, clearcoat: 0.4 });
  [-1, 1].forEach((s) => { const f = mesh(new THREE.SphereGeometry(1, 24, 12), finM, 0.2, -0.05, 0.075 * s); f.scale.set(0.085, 0.007, 0.028); f.rotation.set(0.35 * s, 0.5 * s, -0.25); inner.add(f); });
  const fluke = new THREE.Shape();
  fluke.moveTo(0, 0); fluke.quadraticCurveTo(-0.03, 0.06, -0.075, 0.13); fluke.quadraticCurveTo(-0.045, 0.07, -0.02, 0.0);
  fluke.quadraticCurveTo(-0.045, -0.07, -0.075, -0.13); fluke.quadraticCurveTo(-0.03, -0.06, 0, 0);
  const fl = mesh(new THREE.ExtrudeGeometry(fluke, { depth: 0.006, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 2 }), finM, -0.47, 0, 0);
  fl.rotation.x = Math.PI / 2; inner.add(fl);
  const dorsal = mesh(new THREE.ConeGeometry(0.012, 0.03, 12), finM, -0.26, 0.052, 0); dorsal.rotation.z = 0.9; inner.add(dorsal);
  const g = new THREE.Group(); g.add(inner);
  g.userData.tick = (t) => { inner.rotation.y = Math.sin(t * 0.18) * 0.55; inner.rotation.z = Math.sin(t * 0.6) * 0.03; fl.rotation.z = Math.sin(t * 1.2) * 0.25; };
  return g;
};

/* ================= 쿠푸 피라미드 ================= */
B.pyramid = function () {
  const inner = new THREE.Group(), N = 42, base = 1.571;
  const stone = phys(0xb8a07a, { roughness: 0.92 }), stone2 = phys(0xa88f68, { roughness: 0.95 });
  for (let i = 0; i < N; i++) {
    const s = base * (1 - i / N), h = 1 / N;
    inner.add(mesh(new THREE.BoxGeometry(s, h, s), i % 2 ? stone : stone2, 0, (i + 0.5) * h, 0));
  }
  inner.rotation.y = 0.6;
  return holder(inner, 0.12, 0.5);
};

/* ================= 에펠탑 ================= */
B.eiffel = function () {
  const g = new THREE.Group();
  const steel = phys(0x7d5a3c, { metalness: 0.7, roughness: 0.42, emissive: 0x2a1604 });
  const hw = (t) => 0.21 * Math.pow(1 - t, 2.3) + 0.012;
  const corners = [[1, 1], [1, -1], [-1, -1], [-1, 1]];
  corners.forEach((c) => {
    const pts = []; for (let i = 0; i <= 40; i++) { const t = i / 40; pts.push(new THREE.Vector3(c[0] * hw(t), t, c[1] * hw(t))); }
    g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 80, 0.0075, 6), steel));
  });
  const lv = []; for (let L = 0; L <= 18; L++) lv.push(Math.pow(L / 18, 1.25) * 0.96);
  for (let j = 0; j < lv.length - 1; j++) {
    const t0 = lv[j], t1 = lv[j + 1], h0 = hw(t0), h1 = hw(t1);
    for (let k = 0; k < 4; k++) {
      const a = corners[k], b = corners[(k + 1) % 4];
      const A0 = new THREE.Vector3(a[0] * h0, t0, a[1] * h0), B0 = new THREE.Vector3(b[0] * h0, t0, b[1] * h0);
      const A1 = new THREE.Vector3(a[0] * h1, t1, a[1] * h1), B1 = new THREE.Vector3(b[0] * h1, t1, b[1] * h1);
      g.add(cylBetween(A0, B1, 0.0022, steel), cylBetween(B0, A1, 0.0022, steel), cylBetween(A1, B1, 0.003, steel));
    }
  }
  /* 1층 아래 아치 */
  const h1 = hw(0.17);
  for (let k = 0; k < 4; k++) {
    const a = corners[k], b = corners[(k + 1) % 4], pts = [];
    for (let i = 0; i <= 24; i++) {
      const u = i / 24, t = 0.17 * (1 - Math.sin(u * Math.PI) * 0.62);
      const w = hw(t); pts.push(new THREE.Vector3((a[0] + (b[0] - a[0]) * u) * w, t, (a[1] + (b[1] - a[1]) * u) * w));
    }
    g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.005, 6), steel));
  }
  [[0.17, 0.02], [0.35, 0.016], [0.88, 0.014]].forEach(([t, th]) => { const w = hw(t) * 2 + 0.03; g.add(mesh(new THREE.BoxGeometry(w, th, w), steel, 0, t, 0)); });
  void h1;
  g.add(mesh(new THREE.CylinderGeometry(0.004, 0.007, 0.06, 8), steel, 0, 0.99, 0));
  const beacon = glow(0xffd9a0, 0.06, 0.9); beacon.position.y = 1.0; g.add(beacon);
  g.position.y = -0.5;
  const outer = new THREE.Group(); outer.add(g);
  outer.userData.tick = (t) => { g.rotation.y = t * 0.15; beacon.material.opacity = 0.5 + 0.4 * Math.sin(t * 3); };
  return outer;
};

/* ================= 롯데월드타워 ================= */
function loftTower({ H = 1, half, n = 72, m = 64, power = 4, mat }) {
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, s = half(t), y = t * H;
    for (let j = 0; j <= m; j++) {
      const a = (j / m) * Math.PI * 2, c = Math.cos(a), sn = Math.sin(a);
      const r = s / Math.pow(Math.pow(Math.abs(c), power) + Math.pow(Math.abs(sn), power), 1 / power);
      pos.push(c * r, y, sn * r); uv.push(j / m, t);
    }
  }
  for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) { const a = i * (m + 1) + j, b = a + m + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx); geo.computeVertexNormals();
  return new THREE.Mesh(geo, mat);
}
function floorsTex(rows, cols, seamCols) {
  return canvasTex(256, 1024, (g, w, h) => {
    g.fillStyle = "#000"; g.fillRect(0, 0, w, h);
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      if (R() < 0.45) continue;
      const v = 60 + R() * 120 | 0; g.fillStyle = "rgba(255," + (200 + R() * 40 | 0) + "," + (140 + R() * 60 | 0) + "," + (v / 255).toFixed(2) + ")";
      g.fillRect((c / cols) * w + 1, (r / rows) * h + 1, w / cols - 2, h / rows - 2);
    }
    g.fillStyle = "rgba(0,0,0,.9)"; seamCols.forEach((u) => g.fillRect(u * w - 1, 0, 2, h));
  });
}
B.lotte = function () {
  const g = new THREE.Group();
  const tex = floorsTex(123, 48, [0.125, 0.375, 0.625, 0.875]);
  const glass = phys(0x9fb2c6, { metalness: 0.9, roughness: 0.12, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.55 });
  g.add(loftTower({ half: (t) => 0.062 * (1 - t * 0.74) * (1 - 0.06 * Math.sin(t * Math.PI)), H: 0.9, mat: glass, power: 3.2 }));
  const fin = phys(0xc7d3de, { metalness: 1, roughness: 0.2 });
  [0, 1, 2, 3].forEach((k) => { const a = (k / 4) * Math.PI * 2 + Math.PI / 4; const f = mesh(new THREE.BoxGeometry(0.004, 0.1, 0.004), fin, Math.cos(a) * 0.011, 0.95, Math.sin(a) * 0.011); g.add(f); });
  const lantern = glow(0xcfe4ff, 0.05, 0.7); lantern.position.y = 0.96; g.add(lantern);
  g.position.y = 0;
  return holder(g, 0.15);
};

/* ================= 부르즈 할리파 ================= */
B.burj = function () {
  const g = new THREE.Group();
  const tex = floorsTex(163, 24, []);
  const steel = phys(0xbac6d2, { metalness: 0.95, roughness: 0.12, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.4 });
  const tierH = 0.05, core = 0.018;
  g.add(mesh(new THREE.CylinderGeometry(core * 0.7, core * 1.1, 0.8, 6), steel, 0, 0.4, 0));
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2 + Math.PI / 2;
    for (let i = 0; i < 14; i++) {
      const L = 0.06 * (1 - (i * 3 + k) / 44);
      if (L < 0.012) break;
      const y0 = i === 0 ? 0 : 0.12 + (i - 1) * tierH, y1 = 0.12 + i * tierH, h = y1 - y0;
      const wing = new THREE.Group(); wing.rotation.y = -a; wing.position.y = y0 + h / 2; g.add(wing);
      wing.add(mesh(new THREE.BoxGeometry(L, h, 0.024), steel, L / 2, 0, 0));
      wing.add(mesh(new THREE.CylinderGeometry(0.012, 0.012, h, 16), steel, L, 0, 0));
    }
  }
  g.add(mesh(new THREE.CylinderGeometry(0.0015, 0.008, 0.24, 8), steel, 0, 0.88, 0));
  const tip = glow(0xe6f0ff, 0.035, 0.9); tip.position.y = 1.0; g.add(tip);
  return holder(g, 0.18);
};

/* ================= 금문교 ================= */
B.goldengate = function () {
  const g = new THREE.Group();
  const orange = phys(0xc0362c, { roughness: 0.55, metalness: 0.2 });
  const tx = 0.234, top = 0.083, deckY = 0.0245, low = 0.029;
  g.add(mesh(new THREE.BoxGeometry(1, 0.0035, 0.0099), orange, 0, deckY, 0));
  [-tx, tx].forEach((x) => {
    [-1, 1].forEach((s) => g.add(mesh(new THREE.BoxGeometry(0.0045, top, 0.0035), orange, x, top / 2, 0.0056 * s)));
    [0.036, 0.052, 0.066, 0.079].forEach((y) => g.add(mesh(new THREE.BoxGeometry(0.0035, 0.0028, 0.0112), orange, x, y, 0)));
    g.add(mesh(new THREE.BoxGeometry(0.012, 0.006, 0.02), std(0x8a8f96), x, 0.003, 0));
  });
  const cableY = (x) => {
    const ax = Math.abs(x);
    if (ax <= tx) return top - (top - low) * (1 - (ax / tx) ** 2);
    const u = (ax - tx) / (0.5 - tx); return top + (0.03 - top) * u + 0.006 * Math.sin(u * Math.PI);
  };
  const sus = [];
  [-1, 1].forEach((s) => {
    const pts = []; for (let i = 0; i <= 200; i++) { const x = -0.5 + i / 200; pts.push(new THREE.Vector3(x, cableY(x), 0.0056 * s)); }
    g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 400, 0.0009, 5), orange));
    for (let x = -0.49; x <= 0.49; x += 0.008) { const y = cableY(x); if (y > deckY + 0.002) sus.push(x, y, 0.0056 * s, x, deckY, 0.0056 * s); }
  });
  const sg = new THREE.BufferGeometry(); sg.setAttribute("position", new THREE.Float32BufferAttribute(sus, 3));
  g.add(new THREE.LineSegments(sg, new THREE.LineBasicMaterial({ color: 0xd4553f, transparent: true, opacity: 0.7 })));
  [-0.5, 0.5].forEach((x) => g.add(mesh(new THREE.BoxGeometry(0.03, 0.03, 0.03), std(0x9a9ea5), x, 0.015, 0)));
  const water = mesh(new THREE.PlaneGeometry(1.2, 0.2), phys(0x173552, { roughness: 0.08, metalness: 0.3 }), 0, 0.0004, 0);
  water.rotation.x = -Math.PI / 2; g.add(water);
  const lights = []; for (let x = -0.49; x <= 0.49; x += 0.02) lights.push(x, deckY + 0.004, 0);
  g.add(makePoints(lights, 0xffd49a, 0.006, 0.9));
  [-tx, tx].forEach((x) => { const b = glow(0xff4a3a, 0.012, 0.9); b.position.set(x, top + 0.002, 0); g.add(b); });
  return holder(g, 0.1, 0.35);
};

/* ================= 마리아나 해구 (단면 수조) ================= */
B.mariana = function () {
  const g = new THREE.Group(), W = 2, D = 0.4;
  const wgeo = new THREE.BoxGeometry(W, 1, D, 1, 24, 1), wp = wgeo.attributes.position, wc = [], c = new THREE.Color();
  const topC = new THREE.Color(0x3aa0cf), botC = new THREE.Color(0x040b1f);
  for (let i = 0; i < wp.count; i++) { c.copy(botC).lerp(topC, Math.pow(wp.getY(i) + 0.5, 2.2)); wc.push(c.r, c.g, c.b); }
  wgeo.setAttribute("color", new THREE.Float32BufferAttribute(wc, 3));
  const water = mesh(wgeo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.55, depthWrite: false }), 0, 0.5, 0);
  g.add(water);
  const floor = new THREE.Shape();
  const fl = [[-1, 0.46], [-0.7, 0.47], [-0.45, 0.43], [-0.28, 0.33], [-0.12, 0.15], [-0.03, 0.01], [0.03, 0.0], [0.1, 0.12], [0.25, 0.3], [0.45, 0.42], [0.7, 0.45], [1, 0.44]];
  floor.moveTo(-1, 0); fl.forEach(([x, y]) => floor.lineTo(x, y)); floor.lineTo(1, 0); floor.lineTo(-1, 0);
  const fgeo = new THREE.ExtrudeGeometry(floor, { depth: D, bevelEnabled: false }), fpp = fgeo.attributes.position, fcol = [];
  for (let i = 0; i < fpp.count; i++) { const yy = fpp.getY(i); c.set([0x3a3431, 0x4a3f38, 0x2f2c2c, 0x55483d][Math.floor(yy * 30) % 4]).lerp(new THREE.Color(0x1c1f26), 0.25); fcol.push(c.r, c.g, c.b); }
  fgeo.setAttribute("color", new THREE.Float32BufferAttribute(fcol, 3));
  const fg = mesh(fgeo, phys(0xffffff, { vertexColors: true, roughness: 0.95 }), 0, 0, -D / 2);
  g.add(fg);
  /* 에베레스트를 거꾸로 넣은 윤곽: 해구 바닥에서 8,849 / 10,935 = 0.81까지 */
  const ev = [[-0.44, 0], [-0.3, 0.26], [-0.17, 0.5], [-0.06, 0.73], [0, 0.809], [0.05, 0.76], [0.14, 0.58], [0.27, 0.34], [0.46, 0]];
  const es = new THREE.Shape(); es.moveTo(ev[0][0], ev[0][1]); ev.slice(1).forEach(([x, y]) => es.lineTo(x, y));
  const eFill = mesh(new THREE.ShapeGeometry(es), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.14, depthWrite: false }), 0, 0, D / 2 + 0.004);
  g.add(eFill);
  const eLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints(ev.map(([x, y]) => new THREE.Vector3(x, y, D / 2 + 0.006))),
    new THREE.LineDashedMaterial({ color: 0xffffff, dashSize: 0.02, gapSize: 0.014, transparent: true, opacity: 0.9 }));
  eLine.computeLineDistances(); g.add(eLine);
  const surf = mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshBasicMaterial({ color: 0x6fc4e8, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide }), 0, 1, 0);
  surf.rotation.x = -Math.PI / 2;
  g.add(surf);
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(W, 1, D)), new THREE.LineBasicMaterial({ color: 0xcfe8ff, transparent: true, opacity: 0.35 }));
  edges.position.y = 0.5; g.add(edges);
  g.add(mesh(new THREE.BoxGeometry(W + 0.04, 0.03, D + 0.04), std(0x151821), 0, -0.015, 0));
  const lab1 = textSprite("에베레스트"); lab1.position.set(0, 0.42, D / 2 + 0.01); lab1.scale.multiplyScalar(0.9); g.add(lab1);
  const lab2 = textSprite("약 2 km"); lab2.position.set(0.3, 0.905, D / 2 + 0.01); lab2.scale.multiplyScalar(0.8); g.add(lab2);
  return holder(g, 0.12, 0.35);
};

/* ================= 한라산 ================= */
B.hallasan = function () {
  const island = []; for (let i = 0; i < 64; i++) { const a = (i / 64) * Math.PI * 2; const r = 1 + 0.06 * Math.sin(a * 3 + 1) + 0.04 * Math.sin(a * 7); island.push([Math.cos(a) * 1.9 * r, Math.sin(a) * 1.15 * r]); }
  const oreum = []; for (let i = 0; i < 44; i++) { const a = R() * Math.PI * 2, r = 0.35 + R() * 0.55; oreum.push([Math.cos(a) * 1.8 * r, Math.sin(a) * 1.05 * r, 0.02 + R() * 0.05, 0.05 + R() * 0.06]); }
  const H = (x, z, d) => {
    const r = Math.sqrt((x / 1.8) ** 2 + (z / 1.05) ** 2);
    let h = Math.pow(Math.max(0, 1 - r), 1.35) * 0.97;
    const cr = Math.sqrt(x * x + z * z);
    h += 0.04 * Math.exp(-((cr - 0.075) ** 2) / 0.0008) - 0.07 * Math.exp(-(cr * cr) / 0.0025);
    for (const [ox, oz, oh, orad] of oreum) { const dd = (x - ox) ** 2 + (z - oz) ** 2; h += oh * Math.exp(-dd / (orad * orad)); }
    h += 0.012 * fbm(x * 8, z * 8, 4);
    return Math.max(0.004, h * sstep(0, 0.12, d));
  };
  const fields = new THREE.Color(0x55693c), fields2 = new THREE.Color(0x7a7446), forest = new THREE.Color(0x213d28), forest2 = new THREE.Color(0x2f4c30);
  const alpine = new THREE.Color(0x5e6444), rock = new THREE.Color(0x7c7163), shore = new THREE.Color(0x34322f), tmp = new THREE.Color();
  const col = (c, h, slope, x, z) => {
    const n = fbm(x * 12, z * 12, 4);
    c.copy(fields).lerp(fields2, sstep(0.45, 0.7, fbm(x * 30, z * 30, 2)));      // 밭 조각
    c.lerp(tmp.copy(forest).lerp(forest2, n), sstep(0.18 + 0.1 * n, 0.34 + 0.1 * n, h)); // 숲
    c.lerp(alpine, sstep(0.66 + 0.06 * n, 0.8, h));
    c.lerp(rock, sstep(0.86, 0.93, h));
    c.lerp(shore, sstep(0.03, 0.005, h));
    if (slope > 0.45) c.lerp(rock, 0.3);
  };
  const g = relief({ w: 4.4, d: 2.8, seg: 200, polys: [island], height: H, color: col });
  const lake = mesh(new THREE.CircleGeometry(0.05, 32), phys(0x3a7fb8, { roughness: 0.1, metalness: 0.3 }), 0, H(0, 0, 1) + 0.004, 0);
  lake.rotation.x = -Math.PI / 2; g.add(lake);
  return holder(g, 0.05, 0.4);
};

/* ================= 에베레스트 ================= */
B.everest = function () {
  const peaks = [[0, 0, 1, 0.55], [0.34, 0.26, 0.84, 0.35], [-0.42, 0.1, 0.72, 0.35], [0.1, -0.5, 0.62, 0.3], [-0.2, 0.5, 0.55, 0.28]];
  const raw = (x, z) => {
    let h = 0;
    for (const [px, pz, ph, pr] of peaks) { const d = Math.sqrt((x - px) ** 2 + (z - pz) ** 2); h = Math.max(h, ph * Math.pow(Math.max(0, 1 - d / (pr * 2.2)), 1.5)); }
    const mask = Math.pow(Math.max(0, 1 - Math.sqrt(x * x + z * z) / 1.3), 0.8);
    return h * (0.78 + 0.32 * ridged(x * 2.4 + 3, z * 2.4, 5)) + 0.18 * mask * ridged(x * 5, z * 5, 4);
  };
  const peak = raw(0, 0);
  const H = (x, z) => Math.max(0, raw(x, z) / peak);
  const col = (c, h, slope, x, z) => {
    const snowLine = 0.42 + 0.12 * fbm(x * 9, z * 9, 3);
    const rock = new THREE.Color(0x4a4540).lerp(new THREE.Color(0x6e655c), fbm(x * 20, z * 20, 3));
    if (h > snowLine && slope < 0.62) c.set(0xf2f5fa).lerp(new THREE.Color(0xc8d4e6), slope);
    else if (h < 0.18) c.copy(rock).lerp(new THREE.Color(0x8e9aa6), 0.35);
    else c.copy(rock);
  };
  const g = relief({ w: 2.6, d: 2.6, seg: 220, height: H, color: col, base: false, edgeFade: true });
  return holder(g, 0.05, 0.5);
};

/* ================= 서울 ================= */
B.seoul = function () {
  const N = 120, outline = [];
  for (let i = 0; i < N; i++) { const a = (i / N) * Math.PI * 2, r = 0.5 * (1 + 0.1 * Math.sin(3 * a + 0.5) + 0.07 * Math.cos(5 * a) + 0.04 * Math.sin(9 * a)); outline.push([Math.cos(a) * r, -Math.sin(a) * r * 0.72]); }
  const riverZ = (x) => -(-0.03 + 0.07 * Math.sin(x * 4.2));
  const mountains = [[0, -0.3, 0.05, 0.1], [0.05, 0.3, 0.035, 0.08], [-0.28, -0.12, 0.025, 0.07], [0.3, -0.18, 0.025, 0.07], [0.02, 0.02, 0.015, 0.03]];
  const H = (x, z, d) => {
    let h = 0.006;
    for (const [mx, mz, mh, mr] of mountains) h += mh * Math.exp(-((x - mx) ** 2 + (z - mz) ** 2) / (mr * mr)) * (0.7 + 0.6 * fbm(x * 30, z * 30, 3));
    const rd = Math.abs(z - riverZ(x));
    if (rd < 0.028) h = 0.001;
    return h * sstep(0, 0.02, d);
  };
  const col = (c, h, slope, x, z) => {
    if (Math.abs(z - riverZ(x)) < 0.028) { c.set(0x2d6fae); return; }
    if (h > 0.014) c.set(0x2c4a31).lerp(new THREE.Color(0x3d5f3a), fbm(x * 40, z * 40, 2));
    else c.set(0x2a2f38).lerp(new THREE.Color(0x3a3f48), fbm(x * 60, z * 60, 2));
  };
  const g = relief({ w: 1.25, d: 0.95, seg: 220, polys: [outline], height: H, color: col, sea: [0x141a24, 0x1c2430] });
  /* 건물: 강·산을 피해 무작위로, 도심(종로·강남)일수록 높게 */
  const count = 2600, im = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), phys(0xffffff, { roughness: 0.6, metalness: 0.2 }), count);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), pos = new THREE.Vector3(), c = new THREE.Color(), lights = [];
  let n = 0;
  for (let tries = 0; n < count && tries < 40000; tries++) {
    const x = (R() - 0.5) * 1.1, z = (R() - 0.5) * 0.8;
    if (polyDist(x, z, outline) < 0.015 || Math.abs(z - riverZ(x)) < 0.04) continue;
    let mnt = 0; for (const [mx, mz, mh, mr] of mountains) mnt = Math.max(mnt, Math.exp(-((x - mx) ** 2 + (z - mz) ** 2) / (mr * mr)));
    if (mnt > 0.35) continue;
    const core = Math.max(Math.exp(-((x + 0.02) ** 2 + (z + 0.12) ** 2) / 0.02), Math.exp(-((x - 0.14) ** 2 + (z - 0.13) ** 2) / 0.015));
    const hgt = 0.004 + 0.035 * core * R() + 0.006 * R();
    const sz = 0.006 + 0.006 * R();
    pos.set(x, 0.006 + hgt / 2, z); s.set(sz, hgt, sz * (0.7 + R() * 0.6)); q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), (R() - 0.5) * 0.3);
    m4.compose(pos, q, s); im.setMatrixAt(n, m4);
    im.setColorAt(n, c.setHSL(0.6, 0.1, 0.16 + R() * 0.18));
    if (R() < 0.6) lights.push(x, 0.006 + hgt + 0.002, z);
    n++;
  }
  im.count = n; im.instanceMatrix.needsUpdate = true;
  g.add(im);
  g.add(makePoints(lights, 0xffc98a, 0.007, 1));
  const tower = glow(0xfff0c0, 0.03, 1); tower.position.set(-0.03, 0.05, -0.02); g.add(tower); // 남산
  g.rotation.x = 0.95;
  return holder(g, 0.2, 0.15);
};

/* ================= 한반도 (서울-부산 거리) ================= */
const KOREA = [[124.3, 40.0], [124.9, 40.5], [125.9, 40.9], [126.9, 41.8], [128.1, 41.4], [128.3, 42.0], [129.7, 42.4], [130.6, 42.4], [130.1, 41.8], [129.7, 41.0],
  [129.3, 40.8], [128.6, 40.2], [127.6, 39.8], [127.4, 39.2], [128.0, 38.9], [128.4, 38.6], [128.9, 37.9], [129.2, 37.4], [129.4, 36.9], [129.5, 36.0],
  [129.4, 35.5], [129.1, 35.1], [128.6, 34.9], [127.8, 34.6], [127.3, 34.5], [126.5, 34.3], [126.3, 34.8], [126.5, 35.5], [126.6, 36.0], [126.2, 36.7],
  [126.6, 37.1], [126.6, 37.5], [126.1, 37.7], [125.4, 37.7], [124.7, 38.1], [125.2, 38.6], [125.1, 39.2], [125.4, 39.5], [124.7, 39.6]];
const JEJU = [[126.15, 33.3], [126.4, 33.2], [126.9, 33.35], [126.95, 33.5], [126.5, 33.55], [126.2, 33.45]];
B.seoulbusan = function () {
  const L0 = 127.6, T0 = 37.6, U = 325;
  const kr = lonlat(KOREA, L0, T0, U), jj = lonlat(JEJU, L0, T0, U);
  const H = (x, z, d) => {
    const ridge = Math.exp(-((x - 0.3 + z * 0.12) ** 2) / 0.05);
    return (0.006 + (0.02 + 0.05 * ridge) * fbm(x * 5 + 2, z * 5, 5)) * sstep(0, 0.05, d);
  };
  const col = (c, h, slope, x, z, d) => {
    if (h < 0.03) c.set(0x46663e).lerp(new THREE.Color(0x66744a), fbm(x * 12, z * 12, 3) * 0.6);
    else if (h < 0.05) c.set(0x2c4a30);
    else c.set(0x5b554b);
    if (d < 0.008) c.lerp(new THREE.Color(0xa89c7a), 0.5);
  };
  const g = relief({ w: 2.1, d: 3.35, seg: 180, polys: [kr, jj], height: H, color: col });
  const [sx, sz] = lonlat([[126.98, 37.57]], L0, T0, U)[0], [bx, bz] = lonlat([[129.08, 35.18]], L0, T0, U)[0];
  const y = 0.07, A = new THREE.Vector3(sx, y, sz), Bv = new THREE.Vector3(bx, y, bz);
  [A, Bv].forEach((v) => { const d = glow(0xffd79a, 0.12, 1); d.position.copy(v); g.add(d); });
  const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([A, Bv]), new THREE.LineDashedMaterial({ color: 0xffffff, dashSize: 0.05, gapSize: 0.035, transparent: true, opacity: 0.9 }));
  line.computeLineDistances(); g.add(line);
  const ta = textSprite("서울"); ta.position.set(sx - 0.25, y + 0.05, sz); ta.scale.multiplyScalar(1.6); g.add(ta);
  const tb = textSprite("부산"); tb.position.set(bx + 0.25, y + 0.05, bz); tb.scale.multiplyScalar(1.6); g.add(tb);
  g.rotation.x = 0.8;
  return holder(g, 0.15, 0.12);
};

/* ================= 그랜드 캐니언 ================= */
B.grandcanyon = function () {
  const zc = (x) => 0.07 * Math.sin(x * 7.5 + 0.3) + 0.03 * Math.sin(x * 19 + 1.2);
  const wc = (x) => 0.028 + 0.018 * Math.sin(x * 5 + 0.5) ** 2;
  const TOP = 0.05;
  const terr = (f) => { const k = 6, u = f * k, i = Math.floor(u); return (i + sstep(0.72, 1, u - i)) / k; };
  const H = (x, z) => {
    const d = Math.abs(z - zc(x)) + 0.02 * (fbm(x * 30, z * 30, 3) - 0.5);
    const side = 0.02 * Math.max(0, Math.sin(x * 40)) * Math.exp(-((d - 0.05) ** 2) / 0.0015);
    const f = Math.min(1, Math.max(0, (d - 0.004) / (wc(x) + side)));
    const edge = sstep(0.5, 0.49, Math.abs(x)) * sstep(0.2, 0.19, Math.abs(z));
    return TOP * terr(f) * 0.96 + 0.002 + 0.002 * fbm(x * 60, z * 60, 3) * f + 0 * edge;
  };
  const bands = [0xb5553a, 0xd58a52, 0xc9a878, 0x9c4a30, 0xd9a066, 0xa65a3a];
  const col = (c, h, slope, x, z) => {
    if (h < 0.005) { c.set(0x2f6d7a); return; }
    if (h > TOP * 0.93 && slope < 0.3) { c.set(0x8d8a62).lerp(new THREE.Color(0x3f5a34), sstep(0.55, 0.7, fbm(x * 90, z * 90, 3))); return; }
    c.set(bands[Math.floor(h * 260) % bands.length]).lerp(new THREE.Color(0x7a3a26), slope * 0.35);
  };
  const g = relief({ w: 1, d: 0.42, seg: 320, height: H, color: col });
  g.rotation.x = 0.8;
  return holder(g, 0.12, 0.2);
};

/* ================= 오스트레일리아 ================= */
const AUS = [[142.5, -10.7], [143.5, -14.0], [145.3, -15.0], [145.9, -17.0], [146.3, -19.0], [148.8, -20.4], [149.6, -22.4], [150.9, -23.6], [153.1, -25.4], [153.6, -28.6],
  [153.0, -31.4], [152.5, -32.5], [151.3, -33.9], [150.2, -35.8], [150.0, -37.5], [147.9, -37.9], [146.3, -39.1], [144.6, -38.3], [143.5, -38.8], [141.5, -38.4],
  [139.8, -37.3], [139.3, -35.9], [138.1, -35.6], [138.5, -34.5], [137.8, -35.0], [137.0, -35.6], [137.6, -33.9], [136.0, -34.8], [135.2, -34.6], [134.2, -33.0],
  [131.2, -31.5], [128.9, -31.7], [126.0, -32.3], [123.6, -33.9], [120.0, -33.9], [117.9, -35.1], [115.0, -34.3], [115.6, -33.3], [115.7, -31.6], [115.0, -29.5],
  [113.5, -26.5], [113.4, -24.5], [113.7, -22.6], [114.6, -21.8], [116.7, -20.6], [118.8, -20.3], [121.0, -19.5], [122.2, -18.1], [123.6, -17.2], [125.2, -15.2],
  [126.8, -13.9], [128.2, -15.2], [129.6, -14.9], [130.3, -12.9], [131.9, -11.3], [133.5, -11.8], [135.9, -12.2], [136.9, -12.3], [135.9, -13.3], [135.5, -14.9],
  [137.5, -16.3], [139.3, -17.4], [140.8, -17.5], [141.6, -15.2], [141.5, -12.6]];
const TAS = [[144.6, -40.7], [146.5, -41.1], [148.3, -40.9], [148.3, -42.2], [147.0, -43.6], [145.8, -43.4], [145.2, -42.2]];
B.australia = function () {
  const L0 = 133.5, T0 = -26.5, U = 4000;
  const au = lonlat(AUS, L0, T0, U), ts = lonlat(TAS, L0, T0, U);
  const H = (x, z, d) => {
    const range = Math.exp(-((x - 0.43 + z * 0.15) ** 2) / 0.003) * (z > -0.45 ? 1 : 0.4);
    return (0.004 + 0.008 * fbm(x * 8, z * 8, 4) + 0.018 * range * fbm(x * 20, z * 20, 3)) * sstep(0, 0.02, d);
  };
  const red = new THREE.Color(0x94492c), ochre = new THREE.Color(0xa87a4a), green = new THREE.Color(0x3f6639), sand = new THREE.Color(0xb8aa82);
  const col = (c, h, slope, x, z, d) => {
    c.copy(red).lerp(ochre, fbm(x * 10 + 4, z * 10, 4));
    const wet = Math.max(sstep(0.2, 0.45, x - z * 0.3) * sstep(0.12, 0.02, d) * 1.5, sstep(-0.3, -0.42, z) * sstep(0.1, 0.02, d), sstep(0.06, 0.0, d) * 0.5);
    c.lerp(green, Math.min(1, wet));
    if (d < 0.006) c.lerp(sand, 0.6);
  };
  const g = relief({ w: 1.25, d: 1.15, seg: 220, polys: [au, ts], height: H, color: col, sea: [0x0a2342, 0x1d6f93] });
  const reef = [];
  for (let i = 0; i < 700; i++) {
    const t = R(), lo = 145.3 + t * 7.8 + 0.6 + R() * 0.9, la = -14.5 - t * 9.8 + (R() - 0.5) * 0.4;
    const [x, z] = lonlat([[lo, la]], L0, T0, U)[0]; reef.push(x, 0.002, z);
  }
  g.add(makePoints(reef, 0x62f0e0, 0.01, 0.85));
  g.rotation.x = 0.9;
  return holder(g, 0.12, 0.15);
};

/* ================= 쌀알 ================= */
B.rice = function () {
  const inner = new THREE.Group();
  const geo = new THREE.SphereGeometry(1, 64, 40), p = geo.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const taper = 1 - 0.12 * Math.max(0, v.x); // 한쪽 끝이 조금 더 뾰족
    v.set(v.x * 0.5, v.y * 0.2 * taper, v.z * 0.16 * taper);
    v.y += 0.0025 * Math.cos(v.z * 60); // 결을 따라 난 얕은 골
    p.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  const grain = phys(0xe9e2d0, { roughness: 0.32, clearcoat: 0.6, clearcoatRoughness: 0.2, sheen: 0.8, sheenColor: new THREE.Color(0xfff6e0) });
  inner.add(new THREE.Mesh(geo, grain));
  const germ = mesh(new THREE.SphereGeometry(0.03, 16, 12), phys(0xcdbb90, { roughness: 0.6 }), 0.47, -0.06, 0.02); germ.scale.set(0.6, 1, 1.2); inner.add(germ);
  inner.rotation.z = 0.15;
  return holder(inner, 0.25, 0.5);
};
