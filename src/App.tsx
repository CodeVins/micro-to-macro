import { useEffect, useLayoutEffect, useState } from "react";
import Stage from "./Stage";
import Hud from "./Hud";
import { START_E } from "./engine/objects.js";
import { S_TOT, VH_PER_S, yForE } from "./engine/scroll.js";

const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export default function App() {
  const [labelsRoot, setLabelsRoot] = useState<HTMLDivElement | null>(null);
  const [mount, setMount] = useState(false);
  const [ready, setReady] = useState(false);

  /* 스페이서 높이가 잡힌 뒤 사람 위치로 스크롤 */
  useLayoutEffect(() => {
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
    window.scrollTo(0, yForE(START_E));
  }, []);

  /* 로딩 화면이 먼저 그려지도록 두 프레임 뒤에 무거운 장면을 만든다 */
  useEffect(() => {
    let a = requestAnimationFrame(() => { a = requestAnimationFrame(() => setMount(true)); });
    return () => cancelAnimationFrame(a);
  }, []);

  return (
    <>
      <div className="stage">{mount && labelsRoot && <Stage labelsRoot={labelsRoot} reduced={reduced} onReady={() => setReady(true)} />}</div>
      <div className="labels" ref={setLabelsRoot} aria-hidden="true" />
      <Hud reduced={reduced} />
      <div className={"loading" + (ready ? " done" : "")} aria-hidden={ready}>
        <div className="loading-bar" />
        <p>62자리의 크기를 준비하고 있습니다</p>
      </div>
      <div className="spacer" style={{ height: S_TOT * VH_PER_S + "svh" }} />
    </>
  );
}
