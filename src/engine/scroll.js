import { OBJECTS, E_MIN, E_MAX } from "./objects.js";
import { clamp } from "./builders.js";

/* 스크롤 ↔ 규모 (위로 올리면 커지고, 내리면 작아짐)
   대상 사이마다 스크롤 거리를 따로 배정: 너무 가까운 쌍도 비교할 시간을 주고, 보통의 빈 구간은 압축한다.
   단, 10자리 넘게 비어 있는 공백(쿼크와 플랑크 길이 사이)은 오히려 길게 줘서 "아무것도 없음"을 체감하게 한다. */
export const SEG = [0];
for (let i = 1; i < OBJECTS.length; i++) {
  const gap = OBJECTS[i].exp - OBJECTS[i - 1].exp;
  SEG.push(SEG[i - 1] + (gap > 10 ? 6 : clamp(gap, 0.8, 2.6)));
}
export const S_TOT = SEG[SEG.length - 1];
/* 스크롤 1단위당 뷰포트 높이 비율 */
export const VH_PER_S = 42;

export function sOfE(e) {
  if (e <= E_MIN) return 0;
  for (let i = 1; i < OBJECTS.length; i++)
    if (e <= OBJECTS[i].exp)
      return SEG[i - 1] + ((e - OBJECTS[i - 1].exp) / (OBJECTS[i].exp - OBJECTS[i - 1].exp)) * (SEG[i] - SEG[i - 1]);
  return S_TOT;
}
export function eOfS(s) {
  s = clamp(s, 0, S_TOT);
  for (let i = 1; i < OBJECTS.length; i++)
    if (s <= SEG[i])
      return OBJECTS[i - 1].exp + ((s - SEG[i - 1]) / (SEG[i] - SEG[i - 1])) * (OBJECTS[i].exp - OBJECTS[i - 1].exp);
  return E_MAX;
}
export function maxScroll() {
  return Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
}
export function sFromScroll() {
  return S_TOT * (1 - window.scrollY / maxScroll());
}
export function yForE(e) {
  return (1 - sOfE(e) / S_TOT) * maxScroll();
}
/* 눈금 위 위치(0 = 위/큼, 1 = 아래/작음) */
export function pOf(e) {
  return 1 - sOfE(e) / S_TOT;
}
