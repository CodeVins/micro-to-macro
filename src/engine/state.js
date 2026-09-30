/* 매 프레임 바뀌는 값은 React 상태가 아니라 이 객체에 쓰고, UI는 자기 rAF에서 읽어 DOM에 직접 반영한다. */
export const live = {
  e: 0.23,     // 현재 규모 log10(m)
  s: 0,        // 현재 스크롤 좌표
  speed: 0,    // 규모 변화 속도 (자릿수/초, 부호 포함, 평활)
  ready: false,
  snap: false, // 개발용: 다음 프레임에 스무딩 없이 바로 이동
};
