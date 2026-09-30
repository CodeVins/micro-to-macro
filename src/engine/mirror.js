import { OBJECTS, E_MAX, START_E } from "./objects.js";
import { sup, num } from "./notation.js";

const HUMAN = Math.pow(10, START_E);

/* 큰 수를 한국어 단위로 (만·억·조·경), 그보다 크면 10의 거듭제곱. 1만 미만은 그대로 */
function big(x) {
  if (x >= 1e20) return "10" + sup(Math.round(Math.log10(x)));
  for (const [v, u] of [[1e16, "경"], [1e12, "조"], [1e8, "억"], [1e4, "만"]]) if (x >= v) return Math.round(x / v).toLocaleString("ko-KR") + u;
  return x < 10 ? x.toFixed(1).replace(/.0$/, "") : num(x);
}
export function times(x) {
  return big(x) + "배";
}

/* "지금 보이는 크기를 사람 키로 맞추면, 같은 비율로 변한 사람은 얼마나 되나"
   현재 크기 X를 1.7 m로 바꾸는 배율을 사람에게도 적용: 사람 → 1.7² / X */
export function mirror(e) {
  if (Math.abs(e - START_E) < 1.2) return null;
  const grow = e < START_E;
  const he = 2 * START_E - e; // log10(1.7² / 10^e)
  let what;
  if (he > E_MAX + 0.3) what = "관측 가능한 우주의 " + times(Math.pow(10, he - E_MAX));
  else {
    /* 대상에 빗대어 말한다. 보통은 바로 아래 크기의 대상을 기준으로 "태양의 약 4배".
       그 배수가 20배를 넘으면 바로 위 대상 기준("수소 원자의 약 37분의 1")과 비교해 배수가 작은 쪽을 고른다 */
    let below = null, above = null;
    for (const o of OBJECTS) { if (o.exp <= he + 0.06) below = o; else if (!above) above = o; }
    const rb = below ? Math.pow(10, he - below.exp) : Infinity;
    if (rb < 1.15) what = below.name + " 크기";
    else {
      const ra = above ? Math.pow(10, above.exp - he) : Infinity;
      if (ra < 1.3) what = above.name + " 크기";
      else if (rb <= 20 || rb <= ra) what = below.name + "의 약 " + times(rb);
      else what = above.name + "의 약 " + big(Math.round(ra)) + "분의 1";
    }
  }
  return {
    lead: grow ? "이 크기를 당신 키로 키우면, 같은 비율로 커진 당신은" : "이 크기를 당신 키로 줄이면, 같은 비율로 줄어든 당신은",
    what,
  };
}

export { HUMAN };
