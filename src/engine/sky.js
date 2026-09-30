/* 배경: 규모 e에 따라 끊김 없이 이어지는 하나의 셰이더 세계.
   양자 거품 → 분자 물결 → 현미경 속 세포 → 노을 하늘과 땅 → 구름 바다 → 지구의 곡면 → 별 → 은하.
   땅은 실제 3D 평면이고, 그 위에 10의 거듭제곱 간격 눈금이 규모에 맞춰 나타났다 사라진다. */
import * as THREE from "three";
import { lerpKeys } from "./backgrounds.js";

const BG_DIST = 300;

const COMMON = /* glsl */ `
float h21(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
float n2(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(h21(i),h21(i+vec2(1,0)),f.x), mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x), f.y); }
float fbm(vec2 p){ float s=0., a=.5; for(int i=0;i<5;i++){ s+=a*n2(p); p=p*2.03+vec2(17.1,9.3); a*=.5; } return s; }
float band(float e, float a, float b, float w){ return smoothstep(a-w, a+w, e) * (1. - smoothstep(b-w, b+w, e)); }
`;

const SKY_VS = /* glsl */ `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`;

const SKY_FS = /* glsl */ `
uniform float uE, uTime, uAspect, uHorizon;
uniform vec2 uCam;
uniform vec3 uSkyH, uSkyZ;
varying vec2 vUv;
${COMMON}

/* 10배마다 되풀이되는 무한 줌: 레이어 i는 배율 10^(fract(e)+i-1). e가 커지면(멀어지면) 무늬가 가운데로 줄어든다.
   경계를 넘을 때 레이어 i와 i+1의 배율·씨앗·가중치가 정확히 이어진다. */

float stars(vec2 q, float seed){
  vec2 id=floor(q), g=fract(q)-.5; float r=h21(id+seed*7.13);
  if(r<.72) return 0.;
  vec2 o=vec2(h21(id+seed+3.1), h21(id+seed+7.7))-.5;
  float d=length(g-o*.7), b=pow(h21(id+seed+11.3),3.)*1.6+.15;
  return b*(smoothstep(.07,0.,d) + .22*smoothstep(.22,0.,d));
}
float galaxies(vec2 q, float seed){
  vec2 id=floor(q), g=fract(q)-.5; if(h21(id+seed*3.7)<.6) return 0.;
  vec2 o=vec2(h21(id+seed+1.3), h21(id+seed+5.9))-.5; vec2 d=g-o*.6;
  float a=h21(id+seed+9.1)*6.28; d=mat2(cos(a),-sin(a),sin(a),cos(a))*d; d.y*=2.2+2.*h21(id+seed+2.2);
  return smoothstep(.09,0.,length(d))*(.5+.8*h21(id+seed+4.4));
}
vec2 worley(vec2 q, float t){
  vec2 i=floor(q), f=fract(q); float d1=8., d2=8.;
  for(int y=-1;y<=1;y++) for(int x=-1;x<=1;x++){ vec2 g=vec2(x,y); vec2 o=vec2(h21(i+g), h21(i+g+5.3)); o=.5+.42*sin(t+6.28*o);
    float d=length(g+o-f); if(d<d1){ d2=d1; d1=d; } else if(d<d2) d2=d; }
  return vec2(d1, d2);
}

void main(){
  vec2 uv=vUv; float a=uAspect;
  vec2 c=(uv-.5)*vec2(a,1.) + uCam*.02;          // 화면 중심 기준 좌표 (세로 1)
  float t=uTime, e=uE;
  vec3 col=vec3(0.);

  /* ---- 양자 거품 (e < -11) ---- */
  float wQ=1.-smoothstep(-12.2,-10.8,e);
  if(wQ>.001){
    vec3 q=vec3(.03,.012,.07);
    for(int i=0;i<3;i++){ float k=float(i); float fe=fract(uE); float sc=pow(10., fe+k-1.); float wt=sin(3.14159*clamp((fe+k)/3.,0.,1.)); float seed=floor(uE)-k; vec2 w=worley(c*6.*sc+seed*1.7, t*.7+seed); float edge=smoothstep(.1,0.,w.y-w.x); float core=smoothstep(.25,0.,w.x);
          q += wt*pow(sc,-.35)*(edge*vec3(.36,.2,.75)*.42 + core*vec3(.5,.3,.9)*.12); }
    float spark=0.; for(int i=0;i<3;i++){ float k=float(i); float fe=fract(uE); float sc=pow(10., fe+k-1.); float wt=sin(3.14159*clamp((fe+k)/3.,0.,1.)); float seed=floor(uE)-k; spark+=wt*stars(c*22.*sc, seed+40.)*(.6+.4*sin(t*3.+seed)); }
    q += spark*vec3(.8,.6,1.);
    col += wQ*q;
  }
  /* ---- 분자 물결 (-12 ~ -7.6) ---- */
  float wM=band(e,-11.5,-7.8,.7);
  if(wM>.001){
    vec3 m=vec3(.01,.06,.075);
    for(int i=0;i<3;i++){ float k=float(i); float fe=fract(uE); float sc=pow(10., fe+k-1.); float wt=sin(3.14159*clamp((fe+k)/3.,0.,1.)); float seed=floor(uE)-k; vec2 p=c*3.*sc+seed*3.1; float fl=fbm(p+vec2(t*.05,-t*.03)); float lines=abs(sin(fl*18.+t*.4)); float fil=smoothstep(.1,0.,lines)*smoothstep(.35,.65,fbm(p*.7+9.));
          float blob=smoothstep(.62,.9,fbm(p*.5-t*.02));
          m += wt*(fil*vec3(.25,.75,.8)*.28 + blob*vec3(.5,.35,.9)*.12); }
    col += wM*m;
  }
  /* ---- 현미경 속 (-8 ~ -3.6): 흐린 세포 방울 ---- */
  float wC=band(e,-7.8,-3.8,.6);
  if(wC>.001){
    vec3 m=vec3(.025,.05,.045);
    for(int i=0;i<3;i++){ float k=float(i); float fe=fract(uE); float sc=pow(10., fe+k-1.); float wt=sin(3.14159*clamp((fe+k)/3.,0.,1.)); float seed=floor(uE)-k; vec2 p=c*4.*sc+seed*2.3; vec2 id=floor(p); vec2 g=fract(p)-.5; float r=h21(id+seed);
          if(r>.45){ vec2 o=(vec2(h21(id+1.3),h21(id+7.1))-.5)*.4; float rad=.18+.2*h21(id+2.9); float d=length(g-o);
            float ring=smoothstep(.03,0.,abs(d-rad))*.8 + smoothstep(rad,rad*.2,d)*.18; float hue=h21(id+4.4);
            m += wt*ring*mix(vec3(.35,.7,.55), vec3(.8,.6,.35), hue)*.35; } }
    float scope=smoothstep(.95,.55,length(c*vec2(1.,1.)/max(a*.55,.8)));
    col += wC*m*(.35+.65*scope);
  }
  /* ---- 땅 위: 노을 하늘, 먼 산, 구름 (-4 ~ 5) ---- */
  float wG=band(e,-3.6,5.2,.5);
  if(wG>.001){
    float y=uv.y-uHorizon;
    float up=clamp(y/max(.001,1.-uHorizon),0.,1.);
    vec3 sky=mix(uSkyH, uSkyZ, pow(up,.55));
    vec2 sunP=vec2(-.32*a, uHorizon-.5+.04);
    float sd=length((uv-.5)*vec2(a,1.)-sunP);
    sky += vec3(1.,.62,.38)*(.55*exp(-sd*9.) + .18*exp(-sd*2.2))*smoothstep(3.5,1.,e);
    /* 먼 산 세 겹: 규모가 커질수록 아래로 가라앉는다 (우리가 산보다 커지니까) */
    float sink=smoothstep(1.,3.6,e);
    for(int i=0;i<3;i++){
      float k=float(i); float xs=uv.x*a*(1.6+k*1.3)+k*13.1 - uCam.x*.02*(k+1.);
      float hgt=(.07+.05*k)*(1.-.75*k/2.)*fbm(vec2(xs*1.4, k*5.)) + .01;
      float ridge=uHorizon + hgt*(1.-sink) - sink*.02;
      float m=smoothstep(ridge+.002, ridge-.002, uv.y)*step(uHorizon-.001, uv.y);
      vec3 mc=mix(uSkyH, uSkyZ*.6+vec3(.02,.02,.05), .35+.25*k);
      sky=mix(sky, mc, m*(.55+.15*k)*band(e,-2.5,4.,.8));
    }
    /* 구름 띠: 에베레스트쯤에서 우리가 구름 위로 올라선다 */
    float cl=smoothstep(.45,.75,fbm(vec2(uv.x*a*3.+t*.01, uv.y*14.)))*band(e,2.2,4.6,.5)*smoothstep(.12,0.,abs(y-.02));
    sky=mix(sky, vec3(.95,.82,.8)*mix(uSkyH,vec3(1.),.4), cl*.6);
    col += wG*sky;
  }
  /* ---- 높은 하늘과 지구의 곡면 (4.5 ~ 7) ---- */
  float wO=band(e,4.6,6.7,.35);
  if(wO>.001){
    float R=18./pow(10., (e-4.6)*1.1)+.6;   // 규모가 커질수록 지평선이 휘어진다
    vec2 ctr=vec2(0., uHorizon-.5-R);
    float d=length((uv-.5)*vec2(a,1.)-ctr);
    float land=smoothstep(R+.002,R-.002,d);
    vec2 sp=((uv-.5)*vec2(a,1.)-ctr)/R;
    float cont=smoothstep(.5,.56,fbm(sp*6.+3.)); float clouds=smoothstep(.55,.8,fbm(sp*14.+t*.01));
    vec3 earth=mix(vec3(.04,.12,.28), mix(vec3(.2,.32,.16), vec3(.45,.36,.24), fbm(sp*20.)), cont);
    earth=mix(earth, vec3(.85,.88,.92), clouds*.8);
    float limb=smoothstep(R-.12*R,R,d); earth=mix(earth, vec3(.35,.6,1.), limb*.6);
    float atm=exp(-max(0.,d-R)*28./max(.3,1./R+.3))*step(R,d);
    vec3 o=mix(vec3(.004,.006,.02), earth, land) + vec3(.3,.55,1.)*atm*.55;
    col += wO*o;
  }
  /* ---- 별 (6.3 이상) ---- */
  float wS=smoothstep(4.8,6.8,e);
  if(wS>.001){
    vec3 s=vec3(0.);
    for(int i=0;i<3;i++){ float k=float(i); float fe=fract(uE); float sc=pow(10., fe+k-1.); float wt=sin(3.14159*clamp((fe+k)/3.,0.,1.)); float seed=floor(uE)-k; s += wt*stars(c*28.*sc, seed)*mix(vec3(.75,.85,1.), vec3(1.,.85,.7), h21(vec2(seed))); }
    float mw=exp(-pow((c.y+c.x*.35)*3.2,2.))*smoothstep(.35,.75,fbm(c*3.+7.))*band(e,9.,20.,2.);
    s += mw*vec3(.25,.22,.35)*.5;
    col += wS*s;
  }
  /* ---- 은하들과 거대 구조 (18 이상) ---- */
  float wD=smoothstep(17.,19.5,e);
  if(wD>.001){
    vec3 g=vec3(0.);
    for(int i=0;i<3;i++){ float k=float(i); float fe=fract(uE); float sc=pow(10., fe+k-1.); float wt=sin(3.14159*clamp((fe+k)/3.,0.,1.)); float seed=floor(uE)-k; g += wt*galaxies(c*9.*sc, seed+20.)*mix(vec3(1.,.82,.62), vec3(.62,.75,1.), h21(vec2(seed,3.))); }
    float web=smoothstep(.55,.9,fbm(c*2.2+3.))*smoothstep(22.,25.,e);
    g += web*vec3(.18,.12,.3)*.5;
    col += wD*g;
  }
  gl_FragColor=vec4(col,1.);
}
`;

const GROUND_VS = /* glsl */ `varying vec3 vW; void main(){ vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`;
const GROUND_FS = /* glsl */ `
uniform float uE, uUnit, uX, uTime, uAlpha, uCloud;
uniform vec3 uFog, uGround, uGrid;
varying vec3 vW;
${COMMON}
void main(){
  vec2 m=vec2(vW.x*uUnit + uX, vW.z*uUnit);        // 실제 미터 좌표
  float dist=length(vW-cameraPosition);
  float k=floor(uE), grid=0.;
  for(int i=-2;i<=1;i++){
    float L=k+float(i); float S=pow(10.,L); vec2 g=m/S; vec2 fw=max(fwidth(g),vec2(1e-6));
    vec2 aa=abs(fract(g-.5)-.5)/fw; float line=1.-min(min(aa.x,aa.y),1.);
    float fade=clamp(1.-max(fw.x,fw.y)*3.,0.,1.);
    float major=smoothstep(uE-2.3,uE-.6,L);
    grid=max(grid, line*fade*(.18+.82*major));
  }
  vec3 col=uGround*(.85+.3*fbm(m/pow(10.,k-1.)));
  col+=grid*uGrid;
  /* 구름 바다 */
  if(uCloud>.001){
    vec2 p=m/pow(10.,k+.2);
    float cl=fbm(p+vec2(uTime*.01,0.)); float cl2=fbm(p*3.1-uTime*.02);
    vec3 cc=mix(vec3(.48,.44,.55), vec3(.98,.86,.8), smoothstep(.3,.8,cl*.7+cl2*.4));
    col=mix(col, cc, uCloud*smoothstep(.2,.45,cl+.15));
  }
  float fog=1.-exp(-dist*.028);
  col=mix(col, uFog, fog);
  gl_FragColor=vec4(col, uAlpha);
}
`;

/* 하늘 색 키프레임 [e, 지평선, 천정] */
const SKY_H = [[-4, 0xc98a7c], [-1, 0xe29a80], [1, 0xd9937f], [2.6, 0xb58da0], [3.6, 0x8f98c4], [4.6, 0x5d74ae], [5.4, 0x1c2a58]];
const SKY_Z = [[-4, 0x161a3a], [0, 0x1a1f45], [2.6, 0x161c42], [4, 0x0e1534], [5.4, 0x04060f]];
const GROUND = [[-4, 0x2a2622], [-1.5, 0x23242a], [1.5, 0x1f2427], [3, 0x2a2b33]];
const GRID = [[-4, 0x8a7a66], [0, 0x7f8aa6], [3, 0x9aa6c8]];

export function createSky({ camera }) {
  const skyMat = new THREE.ShaderMaterial({
    vertexShader: SKY_VS, fragmentShader: SKY_FS, depthTest: false, depthWrite: false, toneMapped: false,
    uniforms: { uE: { value: 0 }, uTime: { value: 0 }, uAspect: { value: 1 }, uHorizon: { value: 0.5 }, uCam: { value: new THREE.Vector2() },
      uSkyH: { value: new THREE.Color() }, uSkyZ: { value: new THREE.Color() } },
  });
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), skyMat);
  sky.renderOrder = -1000; sky.frustumCulled = false;
  camera.add(sky);

  const groundMat = new THREE.ShaderMaterial({
    vertexShader: GROUND_VS, fragmentShader: GROUND_FS, transparent: true, depthWrite: false, toneMapped: false,
    uniforms: { uE: { value: 0 }, uUnit: { value: 1 }, uX: { value: 0 }, uTime: { value: 0 }, uAlpha: { value: 1 }, uCloud: { value: 0 },
      uFog: { value: new THREE.Color() }, uGround: { value: new THREE.Color() }, uGrid: { value: new THREE.Color() } },
  });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1600, 900), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.renderOrder = -900; ground.frustumCulled = false;

  const v = new THREE.Vector3(), fwd = new THREE.Vector3();

  function update({ e, t, W, H, X, cam, scene }) {
    if (!ground.parent) scene.add(ground);
    const wpp = (2 * BG_DIST * Math.tan((camera.fov * Math.PI) / 360)) / H;
    sky.position.set(0, 0, -BG_DIST);
    sky.scale.set(W * wpp * 1.02, H * wpp * 1.02, 1);

    /* 지평선의 화면 높이: 카메라 앞 수평 방향의 먼 점을 투영 */
    camera.getWorldDirection(fwd); fwd.y = 0; fwd.normalize();
    v.copy(camera.position).addScaledVector(fwd, 450); v.y = 0; v.project(camera);
    const horizon = Math.min(0.98, Math.max(0.02, (v.y + 1) / 2));

    const hC = lerpKeys(SKY_H, e), zC = lerpKeys(SKY_Z, e);
    const u = skyMat.uniforms;
    u.uE.value = e; u.uTime.value = t; u.uAspect.value = W / H; u.uHorizon.value = horizon; u.uCam.value.set(cam.x, cam.y);
    u.uSkyH.value.copy(hC); u.uSkyZ.value.copy(zC);

    const unit = Math.pow(10, e), k = Math.floor(e), period = Math.pow(10, k + 2);
    ground.position.set(camera.position.x, 0, camera.position.z - 440);
    const g = groundMat.uniforms;
    g.uE.value = e; g.uUnit.value = unit; g.uX.value = ((X % period) + period) % period; g.uTime.value = t;
    g.uAlpha.value = smooth((e + 3.9) / 0.5) * (1 - smooth((e - 4.9) / 0.6));
    g.uCloud.value = smooth((e - 3.0) / 0.5) * (1 - smooth((e - 4.7) / 0.5));
    g.uFog.value.copy(hC); g.uGround.value.copy(lerpKeys(GROUND, e)); g.uGrid.value.copy(lerpKeys(GRID, e)).multiplyScalar(0.55);
    ground.visible = g.uAlpha.value > 0.003;
    return { groundOn: g.uAlpha.value };
  }
  return { update };
}

function smooth(x) { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); }
