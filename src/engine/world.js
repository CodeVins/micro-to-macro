import * as THREE from "three";
import { B, R, clamp, smooth, makePoints, STAR_TIME } from "./builders.js";
import { OBJECTS } from "./objects.js";
import { plainLength } from "./notation.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { lerpKeys, DUST, CHAPTERS } from "./backgrounds.js";
import { createSky } from "./sky.js";
import "./earth.js"; // 지구 위 대상 빌더를 B에 덮어쓴다

/* 실제 행성 지도 (Solar System Scope, CC BY 4.0) */
const TEX = {
  moon: "tex/2k_moon.jpg",
  mercury: "tex/2k_mercury.jpg",
  mars: "tex/2k_mars.jpg",
  jupiter: "tex/2k_jupiter.jpg",
  saturn: "tex/2k_saturn.jpg",
  neptune: "tex/2k_neptune.jpg",
  earth: "tex/2k_earth_daymap.jpg",
};

const BG_DIST = 300; // 배경 판을 카메라 앞 이 거리에 붙인다

/* 장면을 만들고, 매 프레임 호출할 update()를 돌려준다.
   카메라는 거대한 좌표를 지나가지 않는다: 현재 규모 e를 1단위로 두고 대상마다 10^(exp-e)로 다시 스케일한다. */
export function createWorld({ scene, camera, gl, labelsRoot, reduced }) {
  /* r155+ 조명은 물리 단위라, 예전(r128) 밝기를 맞추려면 π를 곱한다.
     반사가 살도록 방 환경맵을 깔고, 그만큼 주변광을 줄였다. */
  scene.add(new THREE.AmbientLight(0xffffff, 0.2 * Math.PI));
  const pmrem = new THREE.PMREMGenerator(gl);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.38;
  pmrem.dispose();
  const key = new THREE.DirectionalLight(0xffffff, 1.05 * Math.PI);
  key.position.set(-2.5, 2.2, 4);
  scene.add(key, key.target);
  const rim = new THREE.DirectionalLight(0x9cc8ff, 0.35 * Math.PI);
  rim.position.set(3, -1, -2);
  scene.add(rim);
  scene.add(camera); // 배경 판이 카메라의 자식이라 장면에 넣어야 그려진다

  /* ---------- 대상 ---------- */
  OBJECTS.forEach((o) => {
    const g = B[o.id]();
    o.group = g;
    o.mats = [];
    g.traverse((ch) => {
      if (!ch.material) return;
      (Array.isArray(ch.material) ? ch.material : [ch.material]).forEach((m) => {
        if (o.mats.some((x) => x.m === m)) return;
        m.transparent = true;
        if (m.isMeshStandardMaterial) clampLit(m);
        o.mats.push({ m, base: m.opacity, pts: ch.isPoints, size: ch.userData.baseSize || m.size });
      });
    });
    g.updateMatrixWorld(true);
    const box = new THREE.Box3(), tmpB = new THREE.Box3();
    let any = false;
    g.traverse((ch) => {
      if (!(ch.isMesh || ch.isPoints || ch.isLine)) return;
      ch.geometry.computeBoundingBox();
      tmpB.copy(ch.geometry.boundingBox).applyMatrix4(ch.matrixWorld);
      if (any) box.union(tmpB);
      else { box.copy(tmpB); any = true; }
    });
    o.w = box.max.x - box.min.x;
    o.cx = (box.max.x + box.min.x) / 2;
    o.minY = box.min.y;
    o.maxY = box.max.y;
    o.Hm = (box.max.y - box.min.y) * Math.pow(10, o.exp);
    g.visible = false;
    scene.add(g);
    if (SHADOW.has(o.id)) addShadow(o, box);
  });
  applyRealTextures(gl);

  /* 모든 대상을 실제 크기(m) 기준으로 왼쪽→오른쪽 한 줄에 배치. 간격은 오른쪽(큰) 대상 폭의 30% */
  OBJECTS.forEach((o, i) => {
    o.W = o.w * Math.pow(10, o.exp);
    o.c = i === 0 ? o.W / 2 : OBJECTS[i - 1].c + OBJECTS[i - 1].W / 2 + o.W * 0.3 + o.W / 2;
  });
  const camX = (e) => geoLerp(e, (o) => o.c);
  /* 카메라가 바라볼 높이: 현재 대상 높이의 절반 (대상은 모두 바닥선 y=0에 서 있음) */
  const focusY = (e) => geoLerp(e, (o) => o.Hm / 2);

  /* ---------- 대상 아래 이름표 ---------- */
  OBJECTS.forEach((o) => {
    const l = document.createElement("div");
    l.className = "label";
    l.innerHTML = o.name + "<small>" + plainLength(Math.pow(10, o.exp)) + "</small>";
    labelsRoot.appendChild(l);
    o.label = l;
    o.labelOn = false;
  });

  /* ---------- 스케일이 바뀌는 동안 계속 흐르는 먼지 (10배마다 자기닮음으로 반복) ---------- */
  const dust = [0, 1].map((k) => {
    const pos = [];
    for (let i = 0; i < 900; i++) {
      const r = Math.pow(10, R() * 2.4 - 0.9), a = R() * 6.283;
      pos.push(Math.cos(a) * r, Math.sin(a) * r * 0.75, (R() - 0.75) * r * 0.6);
    }
    const p = makePoints(pos, 0xffffff, 0.03, 0.5);
    p.userData.k = k;
    scene.add(p);
    return p;
  });

  /* ---------- 배경: 하늘·땅·우주를 잇는 셰이더 (sky.js) ---------- */
  const sky = createSky({ camera });
  /* HUD 가독성을 위해 위·아래를 살짝 어둡게 (배경과 대상 사이에 깐다) */
  const scrim = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ map: scrimTexture(), transparent: true, depthTest: false, depthWrite: false, toneMapped: false })
  );
  scrim.renderOrder = -50;
  scrim.frustumCulled = false;
  camera.add(scrim);


  const lp = new THREE.Vector3();
  const cam = { x: 0, y: 0 };

  /* 매 프레임: e = 현재 규모, t = 경과 시간(초), mouse = [-1,1] 포인터, avoid = 이름표를 숨길 화면 영역(HUD) */
  function update({ e, t, W, H, mouse, fov, avoid }) {
    if (!reduced) STAR_TIME.value = t;
    const asp = W / H;
    const dist = 3.2 * Math.max(1, 1.15 / asp);
    const lookX = asp > 1.2 ? -0.55 : 0, lookY = asp < 0.9 ? -0.45 : -0.1;

    const X = camX(e), unit = Math.pow(10, e), fy = focusY(e) / unit;
    cam.x += (mouse.x - cam.x) * 0.04;
    cam.y += (mouse.y - cam.y) * 0.04;
    if (camera.fov !== fov) { camera.fov = fov; camera.updateProjectionMatrix(); }
    camera.position.set(lookX + cam.x * 0.25, fy + 0.3 + lookY - cam.y * 0.18, dist);
    camera.lookAt(lookX, fy + lookY, 0);
    camera.updateMatrixWorld();
    const pxPerUnit = H / (2 * dist * Math.tan((camera.fov * Math.PI) / 360));

    OBJECTS.forEach((o) => {
      const rel = o.exp - e;
      let a = 1;
      if (rel > 1.3) a = 1 - (rel - 1.3) / 0.6;
      if (rel < -2.3) a = 1 - (-2.3 - rel) / 0.7;
      a = smooth(a);
      const g = o.group;
      g.visible = a > 0.004;
      if (!g.visible) { hideLabel(o); return; }
      const s = Math.pow(10, rel), cxw = (o.c - X) / unit;
      g.scale.setScalar(s);
      g.position.set(cxw - o.cx * s, -o.minY * s, 0);
      o.mats.forEach((x) => { x.m.opacity = x.base * a; if (x.pts) x.m.size = x.size * s; });
      if (g.userData.tick && !reduced) g.userData.tick(t);
      const hpx = Math.max(o.maxY - o.minY, o.w * 0.5) * s * pxPerUnit;
      if (hpx > 16 && a > 0.3 && rel < 0.9) {
        lp.set(cxw, 0, 0).project(camera);
        const sx = ((lp.x + 1) / 2) * W, sy = ((1 - lp.y) / 2) * H + 10;
        const underHud = avoid && sx > avoid.left - 40 && sx < avoid.right + 40 && sy > avoid.top - 30;
        if (sx > -100 && sx < W + 100 && sy < H + 40 && !underHud) {
          o.label.style.transform = "translate(" + sx.toFixed(1) + "px," + sy.toFixed(1) + "px) translateX(-50%)";
          o.label.style.opacity = (Math.min(1, (hpx - 16) / 24) * a).toFixed(2);
          o.labelOn = true;
        } else hideLabel(o);
      } else hideLabel(o);
    });

    const wpp = (2 * BG_DIST * Math.tan((camera.fov * Math.PI) / 360)) / H; // 픽셀당 월드 길이
    sky.update({ e, t, W, H, X, cam, scene });
    let dustMul = 0;
    CHAPTERS.forEach((c) => { dustMul += smooth((e - c.from + 0.3) / 0.6) * smooth((c.to - e + 0.3) / 0.6) * c.dust; });
    scrim.position.set(0, 0, -BG_DIST + 1);
    scrim.scale.set(W * wpp * 1.02, H * wpp * 1.02, 1);

    const dc = lerpKeys(DUST, e);
    dust.forEach((p) => {
      const ph = (((e + p.userData.k * 0.5) % 1) + 1) % 1, s = Math.pow(10, -ph);
      p.position.set(0, fy, 0);
      p.scale.setScalar(s);
      p.material.size = 0.09 * s;
      p.material.opacity = 0.45 * Math.sin(Math.PI * ph) * Math.min(1, dustMul);
      p.material.color.copy(dc);
    });
  }

  return { update };
}

/* 조명 받은 표면은 예전(r128)처럼 1에서 잘라, 블룸은 스스로 빛나는 것(별, 태양, 발광 입자)에만 걸리게 한다 */
function clampLit(m) {
  m.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace("#include <dithering_fragment>", "gl_FragColor.rgb = min(gl_FragColor.rgb, vec3(1.0));\n#include <dithering_fragment>");
  };
}

/* 땅에 서 있는 대상 아래 부드러운 접지 그림자 */
const SHADOW = new Set(["phone", "cat", "human", "car", "bus", "whale", "pyramid", "eiffel", "lotte", "burj", "goldengate", "mariana", "mouse", "flea", "rice", "sand", "coin"]);
let shadowTex = null;
function addShadow(o, box) {
  if (!shadowTex) {
    const c = document.createElement("canvas"); c.width = c.height = 128;
    const g = c.getContext("2d"), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, "rgba(0,0,0,.75)"); gr.addColorStop(0.5, "rgba(0,0,0,.35)"); gr.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    shadowTex = new THREE.CanvasTexture(c);
  }
  const mat = new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, toneMapped: false });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
  m.rotation.x = -Math.PI / 2;
  m.scale.set(o.w * 1.3, Math.max(box.max.z - box.min.z, o.w * 0.25) * 1.6, 1);
  m.position.set(o.cx, o.minY + 0.0005 * o.w, (box.max.z + box.min.z) / 2);
  m.renderOrder = -800;
  o.group.add(m);
  o.mats.push({ m: mat, base: 0.6, pts: false });
}

function hideLabel(o) {
  if (o.labelOn) { o.label.style.opacity = 0; o.labelOn = false; }
}

/* 이웃한 두 대상 사이를 로그 규모에 따라 기하 보간 */
function geoLerp(e, f) {
  if (e <= OBJECTS[0].exp) return f(OBJECTS[0]);
  for (let i = 1; i < OBJECTS.length; i++) {
    const a = OBJECTS[i - 1], b = OBJECTS[i];
    if (e <= b.exp) return f(a) * Math.pow(f(b) / f(a), (e - a.exp) / (b.exp - a.exp));
  }
  return f(OBJECTS[OBJECTS.length - 1]);
}

function scrimTexture() {
  const c = document.createElement("canvas");
  c.width = 4; c.height = 256;
  const g = c.getContext("2d");
  const gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, "rgba(4,5,12,.55)");
  gr.addColorStop(0.26, "rgba(4,5,12,0)");
  gr.addColorStop(0.5, "rgba(4,5,12,0)");
  gr.addColorStop(1, "rgba(4,5,12,.78)");
  g.fillStyle = gr;
  g.fillRect(0, 0, 4, 256);
  return new THREE.CanvasTexture(c);
}

/* 캔버스로 그린 행성 표면을 실제 지도로 교체 (불러오기 전까지는 기존 그림 유지) */
function applyRealTextures(gl) {
  const loader = new THREE.TextureLoader();
  const aniso = gl.capabilities.getMaxAnisotropy();
  const load = (url, fn) => loader.load(url, (t) => { t.anisotropy = Math.min(8, aniso); fn(t); });
  OBJECTS.forEach((o) => {
    const surf = o.group.userData.surface;
    if (surf && TEX[o.id]) load(TEX[o.id], (t) => { surf.material.map = t; surf.material.needsUpdate = true; });
  });
  const earth = OBJECTS.find((o) => o.id === "earth").group;
  earth.children.forEach((ch) => {
    // 구름 구체: 흰색 + 구름 지도를 알파로
    if (ch.isMesh && ch !== earth.userData.surface && ch.geometry.parameters?.radius > 0.5)
      load("tex/2k_earth_clouds.jpg", (t) => {
        ch.material.map = null; ch.material.alphaMap = t; ch.material.color.set(0xffffff); ch.material.needsUpdate = true;
      });
  });
  earth.userData.surface.material.roughness = 0.75;
  earth.userData.surface.material.metalness = 0.05;

  const saturn = OBJECTS.find((o) => o.id === "saturn").group;
  const rings = saturn.children.find((ch) => ch.isGroup);
  if (rings) {
    load("tex/2k_saturn_ring_alpha.png", (t) => {
      const inner = 0.62, outer = 1.13;
      const geo = new THREE.RingGeometry(inner, outer, 160, 1);
      const p = geo.attributes.position, uv = geo.attributes.uv, v = new THREE.Vector3();
      for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); uv.setXY(i, (v.length() - inner) / (outer - inner), 0.5); }
      const old = rings.children.map((m) => m.material);
      rings.clear();
      const mat = new THREE.MeshBasicMaterial({ map: t, transparent: true, side: THREE.DoubleSide, depthWrite: false });
      rings.add(new THREE.Mesh(geo, mat));
      // 페이드 목록의 옛 고리 재질을 새 재질로 바꿔 끼운다
      const o = OBJECTS.find((x) => x.id === "saturn");
      o.mats = o.mats.filter((x) => !old.includes(x.m));
      o.mats.push({ m: mat, base: 1, pts: false });
    });
  }

  const sun = OBJECTS.find((o) => o.id === "sun").group;
  const sunMesh = sun.children.find((ch) => ch.isMesh);
  load("tex/2k_sun.jpg", (t) => {
    sunMesh.material.map = t;
    sunMesh.material.color.setRGB(1.7, 1.45, 1.2); // 1보다 밝게: 블룸이 잡도록
    sunMesh.material.needsUpdate = true;
  });
}
