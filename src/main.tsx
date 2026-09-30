import "./engine/legacy.js";
import "@fontsource-variable/bricolage-grotesque";
import "@fontsource/ibm-plex-sans-kr/300.css";
import "@fontsource/ibm-plex-sans-kr/400.css";
import "@fontsource/ibm-plex-sans-kr/600.css";
import "./styles.css";
import { createRoot } from "react-dom/client";
import App from "./App";

createRoot(document.getElementById("root")!).render(<App />);

if (import.meta.env.DEV) {
  // 스크린샷 점검용: 특정 규모로 즉시 이동
  Promise.all([import("./engine/scroll.js"), import("./engine/state.js")]).then(([{ yForE }, { live }]) => {
    (window as unknown as { __goto: (e: number) => void }).__goto = (e) => { window.scrollTo(0, yForE(e)); live.snap = true; };
  });
}
