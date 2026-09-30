import { useEffect, useRef } from "react";
import { OBJECTS, START_E } from "./engine/objects.js";
import { plainLength } from "./engine/notation.js";
import { lerpKeys, ACC } from "./engine/backgrounds.js";
import { sOfE, pOf, yForE } from "./engine/scroll.js";
import { smooth } from "./engine/builders.js";
import { mirror } from "./engine/mirror.js";
import { live } from "./engine/state.js";
import { BEATS } from "./content";

type Obj = { id: string; exp: number; name: string; desc: string; big?: string; cmp?: string };
const OBJS = OBJECTS as Obj[];
const HUMAN = OBJS.find((o) => o.id === "human")!;
const S_START = sOfE(START_E);
const BEAT_S = BEATS.map((b) => sOfE(b.e));

/* 스크롤 좌표 s에서 문장이 얼마나 보일지 (중심에서 ±0.45 안쪽이 선명) */
function beatAlpha(s: number, s0: number) {
  const d = Math.abs(s - s0);
  return smooth((0.75 - d) / 0.3);
}

export default function Hud({ reduced }: { reduced: boolean }) {
  const r = {
    exp: useRef<HTMLElement>(null),
    plain: useRef<HTMLDivElement>(null),
    mirror: useRef<HTMLDivElement>(null),
    mirrorLead: useRef<HTMLSpanElement>(null),
    mirrorWhat: useRef<HTMLElement>(null),
    what: useRef<HTMLDivElement>(null),
    name: useRef<HTMLHeadingElement>(null),
    desc: useRef<HTMLParagraphElement>(null),
    cmp: useRef<HTMLDivElement>(null),
    cmpPair: useRef<HTMLDivElement>(null),
    cmpBig: useRef<HTMLDivElement>(null),
    cmpText: useRef<HTMLParagraphElement>(null),
    intro: useRef<HTMLDivElement>(null),
    now: useRef<HTMLDivElement>(null),
    announce: useRef<HTMLDivElement>(null),
  };
  const beatRefs = useRef<(HTMLDivElement | null)[]>([]);
  const tickRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    let raf = 0;
    let lastExp: number | null = null, lastPlain = "", lastKey = "", lastAcc = "", lastPair = -1, lastCmpA = "";
    let lastMirror = "", lastIntro = "", announceTimer = 0;
    const beatLast = BEATS.map(() => "");
    const root = document.documentElement;

    const loop = () => {
      raf = requestAnimationFrame(loop);
      if (!live.ready) return;
      const e = live.e, s = live.s;

      const ex = Math.round(e);
      if (ex !== lastExp) { r.exp.current!.textContent = (ex < 0 ? "−" : "") + Math.abs(ex); lastExp = ex; }
      const pl = plainLength(Math.pow(10, e));
      if (pl !== lastPlain) { r.plain.current!.innerHTML = "약 <b>" + pl + "</b>"; lastPlain = pl; }

      const m = mirror(e);
      const mk = m ? m.lead + m.what : "";
      if (mk !== lastMirror) {
        if (m) { r.mirrorLead.current!.textContent = m.lead; r.mirrorWhat.current!.textContent = m.what; }
        r.mirror.current!.classList.toggle("on", !!m);
        lastMirror = mk;
      }

      let best = OBJS[0], bd = 1e9;
      for (const o of OBJS) { const d = Math.abs(o.exp - e); if (d < bd) { bd = d; best = o; } }
      if (best.id !== lastKey) {
        r.name.current!.textContent = best.name;
        r.desc.current!.textContent = best.desc;
        lastKey = best.id;
        const w = r.what.current!;
        w.classList.remove("in"); void w.offsetWidth; w.classList.add("in");
        tickRefs.current.forEach((t, i) => t?.classList.toggle("active", OBJS[i] === best));
        /* 스크린리더: 스크롤이 잠시 멈췄을 때만 현재 대상을 한 번 알린다 */
        clearTimeout(announceTimer);
        announceTimer = window.setTimeout(() => {
          r.announce.current!.textContent = best.name + ", " + plainLength(Math.pow(10, best.exp)) + ". " + best.desc;
        }, 900);
      }

      /* 가운데 큰 문장: 보이는 동안은 이웃 비교 카드를 가린다 */
      let beatMax = 0;
      BEATS.forEach((_, i) => {
        const a = beatAlpha(s, BEAT_S[i]);
        beatMax = Math.max(beatMax, a);
        const v = a.toFixed(2);
        if (v !== beatLast[i]) {
          const el = beatRefs.current[i]!;
          el.style.opacity = v;
          el.style.transform = reduced ? "none" : "translateY(" + ((1 - a) * 14).toFixed(1) + "px)";
          el.style.visibility = a > 0.01 ? "visible" : "hidden";
          beatLast[i] = v;
        }
      });
      const introA = smooth((0.55 - Math.abs(s - S_START)) / 0.35);
      const iv = introA.toFixed(2);
      if (iv !== lastIntro) {
        const el = r.intro.current!;
        el.style.opacity = iv;
        el.style.visibility = introA > 0.01 ? "visible" : "hidden";
        lastIntro = iv;
      }

      /* 두 대상 사이를 지나는 동안 크기 비교 */
      let ca = 0;
      for (let i = 1; i < OBJS.length; i++) {
        const A = OBJS[i - 1], Bo = OBJS[i];
        if (e >= A.exp && e <= Bo.exp) {
          const t = (e - A.exp) / (Bo.exp - A.exp);
          ca = smooth((t - 0.05) / 0.2) * smooth((0.95 - t) / 0.2);
          if (lastPair !== i) {
            r.cmpPair.current!.innerHTML = "<b>" + A.name + "</b> " + plainLength(Math.pow(10, A.exp)) + " → <b>" + Bo.name + "</b> " + plainLength(Math.pow(10, Bo.exp));
            r.cmpBig.current!.textContent = Bo.big ?? "";
            r.cmpText.current!.textContent = Bo.cmp ?? "";
            lastPair = i;
          }
          break;
        }
      }
      ca *= (1 - beatMax) * (1 - introA);
      const cs = ca.toFixed(2);
      if (cs !== lastCmpA) { r.cmp.current!.style.opacity = cs; lastCmpA = cs; }

      r.now.current!.style.top = (pOf(e) * 100) + "%";
      const acc = "#" + lerpKeys(ACC, e).getHexString();
      if (acc !== lastAcc) { root.style.setProperty("--scale-color", acc); lastAcc = acc; }
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); clearTimeout(announceTimer); };
  }, [reduced]);

  const jump = (e: number) => window.scrollTo({ top: yForE(e), behavior: reduced ? "auto" : "smooth" });

  return (
    <>
      <header className="brand">
        <h1>크기의 사다리</h1>
        <p>플랑크 길이에서 관측 가능한 우주까지, 62자리</p>
      </header>

      <div className="intro" ref={r.intro}>
        <p className="intro-kicker">당신의 키</p>
        <p className="intro-size">1.7 m</p>
        <p className="intro-body">여기서 출발합니다. 위로 올리면 우주 끝까지, 아래로 내리면 원자 속을 지나 더 작아질 수 없는 곳까지 갑니다.</p>
      </div>

      <section className="readout" aria-hidden="true">
        <div className="power"><span>10</span><sup ref={r.exp}>0</sup><span className="unit">m</span></div>
        <div className="plain" ref={r.plain}>약 <b>1.7 m</b></div>
        <div className="mirror" ref={r.mirror}>
          <span ref={r.mirrorLead} />
          <b ref={r.mirrorWhat} />
        </div>
        <div className="what" ref={r.what}>
          <h2 ref={r.name}>사람</h2>
          <p ref={r.desc} />
        </div>
      </section>

      <div className="compare" ref={r.cmp} aria-hidden="true">
        <div className="pair" ref={r.cmpPair} />
        <div className="big" ref={r.cmpBig} />
        <p ref={r.cmpText} />
      </div>

      {BEATS.map((b, i) => (
        <div className={"beat beat-" + b.id} key={b.id} ref={(el) => { beatRefs.current[i] = el; }} aria-hidden="true">
          <h2>{b.title}</h2>
          <p>{b.body}</p>
        </div>
      ))}

      <nav className="ruler" aria-label="규모 눈금">
        <span className="end top">크게</span>
        <span className="end bottom">작게</span>
        {OBJS.map((o, i) => (
          <button
            key={o.id}
            type="button"
            className={"tick" + (o === HUMAN ? " you" : "")}
            style={{ top: pOf(o.exp) * 100 + "%" }}
            aria-label={o.name + " 보기"}
            ref={(el) => { tickRefs.current[i] = el; }}
            onClick={() => jump(o.exp)}
          >
            <span>{o === HUMAN ? "당신" : o.name}</span>
          </button>
        ))}
        <div className="now" ref={r.now} />
      </nav>

      <div className="sr-only" aria-live="polite" ref={r.announce} />
      <p className="credit">행성 지도 <a href="https://www.solarsystemscope.com/textures/" target="_blank" rel="noreferrer">Solar System Scope</a>, CC BY 4.0</p>
    </>
  );
}
