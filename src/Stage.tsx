import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { EffectComposer, Bloom, ChromaticAberration, Noise, Vignette } from "@react-three/postprocessing";
import { BlendFunction, ChromaticAberrationEffect } from "postprocessing";
import { createWorld } from "./engine/world.js";
import { eOfS, sFromScroll } from "./engine/scroll.js";
import { live } from "./engine/state.js";

const BASE_FOV = 45;

function Driver({ labelsRoot, reduced, onReady, ca }: {
  labelsRoot: HTMLElement; reduced: boolean; onReady: () => void; ca: React.RefObject<ChromaticAberrationEffect | null>;
}) {
  const { scene, camera, gl } = useThree();
  const world = useMemo(
    () => createWorld({ scene, camera: camera as THREE.PerspectiveCamera, gl, labelsRoot, reduced }),
    [scene, camera, gl, labelsRoot, reduced]
  );
  const mouse = useRef({ x: 0, y: 0 });
  const s = useRef(sFromScroll());
  const lastE = useRef(eOfS(s.current));
  const t0 = useRef(performance.now());
  const readyFired = useRef(false);
  const avoid = useRef<DOMRect | null>(null);
  const avoidAt = useRef(0);

  useEffect(() => {
    const move = (ev: PointerEvent) => {
      mouse.current.x = (ev.clientX / window.innerWidth) * 2 - 1;
      mouse.current.y = (ev.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener("pointermove", move);
    return () => window.removeEventListener("pointermove", move);
  }, []);

  useFrame((state, delta) => {
    const dt = Math.min(0.05, delta);
    const target = sFromScroll();
    if (live.snap) { s.current = target; lastE.current = eOfS(target); live.speed = 0; live.snap = false; }
    s.current += (target - s.current) * (1 - Math.exp(-dt * (reduced ? 40 : 6)));
    if (Math.abs(target - s.current) < 1e-4) s.current = target;
    const e = eOfS(s.current);

    /* 규모가 바뀌는 속도: 빨리 지나갈수록 시야가 넓어지고 색이 번진다 (속도감) */
    const v = dt > 0 ? (e - lastE.current) / dt : 0;
    lastE.current = e;
    live.speed += (v - live.speed) * (1 - Math.exp(-dt * 5));
    const rush = reduced ? 0 : Math.min(1, Math.abs(live.speed) / 6);
    const fov = BASE_FOV + rush * 14;

    const { width: W, height: H } = state.size;
    /* 왼쪽 아래 HUD 영역은 가끔만 잰다 (설명 길이에 따라 높이가 바뀜) */
    if (state.clock.elapsedTime - avoidAt.current > 0.5) {
      avoidAt.current = state.clock.elapsedTime;
      avoid.current = document.querySelector(".readout")?.getBoundingClientRect() ?? null;
    }
    world.update({ e, t: (performance.now() - t0.current) / 1000, W, H, mouse: mouse.current, fov, avoid: avoid.current });
    live.e = e;
    live.s = s.current;

    if (ca.current) ca.current.offset.set(0.0004 + rush * 0.006, 0.0002 + rush * 0.003);
    if (!readyFired.current) { readyFired.current = true; live.ready = true; onReady(); }
  });
  return null;
}

export default function Stage({ labelsRoot, reduced, onReady }: { labelsRoot: HTMLElement; reduced: boolean; onReady: () => void }) {
  const ca = useRef<ChromaticAberrationEffect | null>(null);
  return (
    <Canvas
      className="scene"
      flat
      dpr={[1, 1.75]}
      gl={{ antialias: false, powerPreference: "high-performance", alpha: false }}
      camera={{ fov: BASE_FOV, near: 0.001, far: 500, position: [0, 0, 3.2] }}
      onCreated={({ gl }) => { gl.outputColorSpace = THREE.LinearSRGBColorSpace; }}
      fallback={<div className="fail">이 브라우저에서 WebGL을 사용할 수 없어 3D 장면을 표시할 수 없습니다.<br />최신 Chrome, Safari, Edge에서 열어 주세요.</div>}
      aria-hidden="true"
    >
      <Driver labelsRoot={labelsRoot} reduced={reduced} onReady={onReady} ca={ca} />
      <EffectComposer multisampling={4}>
        <Bloom mipmapBlur intensity={1.0} luminanceThreshold={0.98} luminanceSmoothing={0.15} radius={0.72} />
        <ChromaticAberration ref={ca} offset={new THREE.Vector2(0.0004, 0.0002)} radialModulation modulationOffset={0.35} />
        <Vignette offset={0.28} darkness={0.72} />
        <Noise premultiply blendFunction={BlendFunction.SCREEN} opacity={0.12} />
      </EffectComposer>
    </Canvas>
  );
}
