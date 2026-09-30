// main.html에서 옮겨 온 코드 (원본 로직 유지)
/* eslint-disable */
import * as THREE from "three";
function rng(seed){ return function(){ seed|=0; seed=seed+0x6D2B79F5|0; var t=Math.imul(seed^seed>>>15,1|seed); t=t+Math.imul(t^t>>>7,61|t)^t; return((t^t>>>14)>>>0)/4294967296; }; }
var R = rng(20260929);
function gauss(){ var u=0; while(!u) u=R(); return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*R()); }
function clamp(x,a,b){ return Math.max(a,Math.min(b,x)); }
function smooth(x){ x=clamp(x,0,1); return x*x*(3-2*x); }
var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function canvasTex(w,h,draw){
  var c=document.createElement('canvas'); c.width=w; c.height=h;
  var g=c.getContext('2d'); draw(g,w,h);
  var t=new THREE.CanvasTexture(c); t.anisotropy=4; return t;
}
var GLOW = canvasTex(128,128,function(g,w,h){
  var grd=g.createRadialGradient(w/2,h/2,0,w/2,h/2,w/2);
  grd.addColorStop(0,'rgba(255,255,255,1)'); grd.addColorStop(.25,'rgba(255,255,255,.55)');
  grd.addColorStop(.6,'rgba(255,255,255,.12)'); grd.addColorStop(1,'rgba(255,255,255,0)');
  g.fillStyle=grd; g.fillRect(0,0,w,h);
});
function glow(color,size,opacity){
  var s=new THREE.Sprite(new THREE.SpriteMaterial({map:GLOW,color:color,transparent:true,opacity:opacity==null?1:opacity,depthWrite:false,blending:THREE.AdditiveBlending}));
  s.scale.set(size,size,1); return s;
}
function makePoints(pos,col,size,opacity){
  var g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  var useVC = Array.isArray(col);
  if(useVC) g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));
  var m=new THREE.PointsMaterial({size:size,map:GLOW,transparent:true,opacity:opacity==null?1:opacity,depthWrite:false,
    blending:THREE.AdditiveBlending,vertexColors:useVC,color:useVC?0xffffff:col,sizeAttenuation:true});
  var p=new THREE.Points(g,m); p.userData.baseSize=size; return p;
}
function std(color,o){ return new THREE.MeshStandardMaterial(Object.assign({color:color,roughness:.6,metalness:.05},o||{})); }
function cylBetween(a,b,r,mat){
  var d=new THREE.Vector3().subVectors(b,a), len=d.length();
  var m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,len,8),mat);
  m.position.copy(a).addScaledVector(d,.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());
  return m;
}
function fibDirs(n){
  var out=[], ga=Math.PI*(3-Math.sqrt(5));
  for(var i=0;i<n;i++){ var y=1-(i+.5)/n*2, r=Math.sqrt(1-y*y), th=i*ga; out.push(new THREE.Vector3(Math.cos(th)*r,y,Math.sin(th)*r)); }
  return out;
}
function noise3(x,y,z){
  return Math.sin(x*5.1+1.3)*Math.sin(y*4.3+2.1)*Math.sin(z*3.7+.7)
       + .5*Math.sin(x*11.3+y*7.1+.4)*Math.sin(z*9.7+y*3.3)
       + .25*Math.sin(x*23.1+z*17.3)*Math.sin(y*21.7+1.9);
}
function displace(geo,fn){
  var p=geo.attributes.position, v=new THREE.Vector3();
  for(var i=0;i<p.count;i++){ v.fromBufferAttribute(p,i); fn(v); p.setXYZ(i,v.x,v.y,v.z); }
  geo.computeVertexNormals(); return geo;
}

/* ---------- 3D 대상 만들기 (각 대상은 지름 약 1 단위로 정규화) ---------- */
var B = {};

B.planck = function(){
  var g=new THREE.Group(), geo=new THREE.SphereGeometry(1,20,14);
  var mat=std(0xb48cff,{emissive:0x4a1f96,roughness:.2,transparent:true,opacity:.35,depthWrite:false});
  var bubbles=[];
  for(var i=0;i<80;i++){
    var m=new THREE.Mesh(geo,mat), d;
    do{ d=new THREE.Vector3(R()*2-1,R()*2-1,R()*2-1); }while(d.length()>1);
    m.position.copy(d.multiplyScalar(.42));
    m.userData.s=.03+R()*.1; m.userData.ph=R()*6.28; m.userData.sp=1+R()*2.5;
    m.scale.setScalar(m.userData.s); g.add(m); bubbles.push(m);
  }
  g.add(glow(0x9c6bff,1.2,.35));
  g.userData.tick=function(t){ bubbles.forEach(function(b){ b.scale.setScalar(b.userData.s*(.55+.45*Math.sin(t*b.userData.sp+b.userData.ph))); }); g.rotation.y=t*.08; };
  return g;
};

B.quark = function(){
  var g=new THREE.Group();
  g.add(glow(0xff5f86,1.1,.8));
  g.add(new THREE.Mesh(new THREE.SphereGeometry(.12,32,20),new THREE.MeshBasicMaterial({color:0xfff1f4})));
  var ring=new THREE.Mesh(new THREE.TorusGeometry(.32,.006,8,96),new THREE.MeshBasicMaterial({color:0xff9fb6,transparent:true,opacity:.7}));
  var ring2=ring.clone(); ring2.rotation.x=Math.PI/2.4;
  g.add(ring,ring2);
  g.userData.tick=function(t){ ring.rotation.set(t*.6,t*.4,0); ring2.rotation.set(Math.PI/2.4+t*.3,0,t*.5); };
  return g;
};

B.proton = function(){
  var g=new THREE.Group();
  g.add(new THREE.Mesh(new THREE.SphereGeometry(.5,48,32),std(0xffd9a8,{transparent:true,opacity:.13,depthWrite:false,emissive:0x442200})));
  var cols=[0xff4d5e,0x3fe08a,0x4d8bff], q=[];
  for(var i=0;i<3;i++){
    var a=i/3*Math.PI*2, p=new THREE.Vector3(Math.cos(a)*.21,Math.sin(a)*.21,(i-1)*.05);
    var m=new THREE.Mesh(new THREE.SphereGeometry(.12,32,20),std(cols[i],{emissive:cols[i],emissiveIntensity:.45,roughness:.3}));
    m.position.copy(p); g.add(m); q.push(p);
  }
  var gm=std(0xffd54d,{emissive:0xffb300,emissiveIntensity:.8});
  for(var k=0;k<3;k++){
    var a0=q[k], b0=q[(k+1)%3], pts=[], dir=new THREE.Vector3().subVectors(b0,a0), n=new THREE.Vector3(0,0,1).cross(dir).normalize();
    for(var s=0;s<=24;s++){ var t=s/24; pts.push(a0.clone().lerp(b0,t).addScaledVector(n,Math.sin(t*Math.PI*6)*.035).setZ(a0.z+(b0.z-a0.z)*t+Math.cos(t*Math.PI*6)*.035)); }
    g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),80,.01,6),gm));
  }
  g.userData.tick=function(t){ g.rotation.set(Math.sin(t*.3)*.3,t*.35,t*.15); };
  return g;
};

B.nucleus = function(){
  var g=new THREE.Group(), geo=new THREE.SphereGeometry(.15,32,20);
  var pm=std(0xff6b5b,{roughness:.35}), nm=std(0x9aa6b8,{roughness:.35});
  var dirs=fibDirs(10);
  dirs.forEach(function(d,i){ var m=new THREE.Mesh(geo,i%2?pm:nm); m.position.copy(d).multiplyScalar(.24); g.add(m); });
  var a=new THREE.Mesh(geo,pm); a.position.set(.04,.05,.06); var b=new THREE.Mesh(geo,nm); b.position.set(-.05,-.04,-.05); g.add(a,b);
  g.userData.tick=function(t){ g.rotation.set(t*.2,t*.3,0); };
  return g;
};

B.atom = function(){
  var g=new THREE.Group(), pos=[], th=.094;
  for(var i=0;i<5000;i++){
    var r=-(Math.log(R()+1e-9)+Math.log(R()+1e-9)+Math.log(R()+1e-9))*th;
    var d=new THREE.Vector3(gauss(),gauss(),gauss()).normalize().multiplyScalar(r);
    pos.push(d.x,d.y,d.z);
  }
  var cloud=makePoints(pos,0x7fe3ff,.022,.75);
  g.add(cloud);
  g.add(glow(0xffa24d,.07,1));
  g.userData.tick=function(t){ cloud.rotation.y=t*.15; };
  return g;
};

B.dna = function(){
  var g=new THREE.Group(), N=26, H=2.0, pitch=1.7, rad=.42;
  var s1=[], s2=[], bb=std(0x9ec3ff,{roughness:.35,emissive:0x16305a});
  var baseCols=[[0x5aa9ff,0xffb35a],[0x6fe0a0,0xff7ba6]];
  for(var i=0;i<N;i++){
    var y=-H/2+i*H/(N-1), a=y/pitch*Math.PI*2;
    var p1=new THREE.Vector3(Math.cos(a)*rad,y,Math.sin(a)*rad);
    var p2=new THREE.Vector3(Math.cos(a+2.3)*rad,y,Math.sin(a+2.3)*rad);
    s1.push(p1); s2.push(p2);
    var pair=baseCols[Math.floor(R()*2)], flip=R()<.5, mid=p1.clone().lerp(p2,.5);
    g.add(cylBetween(p1,mid,.03,std(flip?pair[0]:pair[1],{roughness:.4})));
    g.add(cylBetween(mid,p2,.03,std(flip?pair[1]:pair[0],{roughness:.4})));
  }
  [s1,s2].forEach(function(s){ g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(s),200,.055,10),bb)); });
  g.rotation.z=.35;
  g.userData.tick=function(t){ g.rotation.y=t*.35; };
  return g;
};

B.virus = function(){
  var g=new THREE.Group();
  var core=new THREE.Mesh(displace(new THREE.IcosahedronGeometry(.33,3),function(v){ v.multiplyScalar(1+.04*noise3(v.x*3,v.y*3,v.z*3)); }),std(0x6aa88a,{roughness:.7}));
  g.add(core);
  var sg=new THREE.CylinderGeometry(.012,.018,.12,6), tg=new THREE.SphereGeometry(.035,12,8);
  var sm=std(0xd6e8a0,{roughness:.5}), tm=std(0xf2a65a,{roughness:.4,emissive:0x3a1a00});
  var up=new THREE.Vector3(0,1,0);
  fibDirs(60).forEach(function(d){
    var s=new THREE.Mesh(sg,sm); s.position.copy(d).multiplyScalar(.39); s.quaternion.setFromUnitVectors(up,d); g.add(s);
    var tip=new THREE.Mesh(tg,tm); tip.position.copy(d).multiplyScalar(.46); g.add(tip);
  });
  g.userData.tick=function(t){ g.rotation.set(t*.12,t*.25,0); };
  return g;
};

B.bacteria = function(){
  var g=new THREE.Group(), pts=[], rr=.19, half=.31, i;
  for(i=0;i<=14;i++){ var a=-Math.PI/2+i/14*Math.PI/2; pts.push(new THREE.Vector2(Math.max(0.0001,Math.cos(a)*rr),-half+Math.sin(a)*rr)); }
  for(i=0;i<=14;i++){ var b=i/14*Math.PI/2; pts.push(new THREE.Vector2(Math.max(0.0001,Math.cos(b)*rr),half+Math.sin(b)*rr)); }
  var body=new THREE.Mesh(new THREE.LatheGeometry(pts,48),std(0x9fd46a,{roughness:.45,emissive:0x1b2f08}));
  g.add(body);
  var fm=std(0xe4f2c8,{roughness:.6});
  for(var f=0;f<4;f++){
    var ph=f*1.6, dx=(f-1.5)*.05, c=[];
    for(var k=0;k<=22;k++){ c.push(new THREE.Vector3(Math.sin(k*.8+ph)*.04+dx*k*.25, -.47-k*.028, Math.cos(k*.8+ph)*.04+(f%2?.02:-.02)*k)); }
    g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(c),80,.006,5),fm));
  }
  var holder=new THREE.Group(); holder.add(g); g.rotation.z=1.2;
  holder.userData.tick=function(t){ g.rotation.y=t*.4; holder.rotation.z=Math.sin(t*.5)*.08; };
  return holder;
};

B.rbc = function(){
  var g=new THREE.Group(), pts=[], n=40, i, c0=.207161, c2=2.002558, c4=-1.122762;
  function y(r){ return .5*Math.sqrt(Math.max(0,1-r*r))*(c0+c2*r*r+c4*r*r*r*r)*.5; }
  for(i=0;i<=n;i++){ var r=Math.sin(i/n*Math.PI/2); pts.push(new THREE.Vector2(Math.max(.0001,r*.5), y(r))); }
  for(i=n-1;i>=0;i--){ var r2=Math.sin(i/n*Math.PI/2); pts.push(new THREE.Vector2(Math.max(.0001,r2*.5), -y(r2))); }
  var cell=new THREE.Mesh(new THREE.LatheGeometry(pts,64),std(0xc0262f,{roughness:.38,emissive:0x2a0004}));
  g.add(cell); cell.rotation.x=1.05;
  g.userData.tick=function(t){ cell.rotation.z=t*.25; cell.rotation.x=1.05+Math.sin(t*.4)*.2; };
  return g;
};

B.hair = function(){
  var g=new THREE.Group(), inner=new THREE.Group(), mat=std(0x5a3a26,{roughness:.55});
  var L=2.2, seg=12;
  for(var i=0;i<seg;i++){
    var m=new THREE.Mesh(new THREE.CylinderGeometry(.5,.53,L/seg*1.08,48,1,true),mat);
    m.position.y=-L/2+(i+.5)*L/seg; m.rotation.y=i*.7; inner.add(m);
  }
  var capTop=new THREE.Mesh(new THREE.CircleGeometry(.5,48),std(0x3d2618)); capTop.rotation.x=-Math.PI/2; capTop.position.y=L/2+.01; inner.add(capTop);
  inner.rotation.z=.95; inner.rotation.x=.3; g.add(inner);
  g.userData.tick=function(t){ inner.rotation.y=t*.2; };
  return g;
};

B.sand = function(){
  var geo=displace(new THREE.IcosahedronGeometry(.5,4),function(v){
    var k=1+.13*noise3(v.x*2,v.y*2,v.z*2); v.multiplyScalar(k); v.y*=.8; v.z*=.9;
  });
  var m=new THREE.Mesh(geo,std(0xd8b27a,{roughness:.92,flatShading:true}));
  var g=new THREE.Group(); g.add(m);
  g.userData.tick=function(t){ m.rotation.set(t*.15,t*.22,0); };
  return g;
};

B.ant = function(){
  var g=new THREE.Group(), inner=new THREE.Group(), m=std(0x3a1e12,{roughness:.35,metalness:.1});
  function ell(x,sx,sy,sz){ var e=new THREE.Mesh(new THREE.SphereGeometry(1,24,16),m); e.position.x=x; e.scale.set(sx,sy,sz); inner.add(e); }
  ell(.38,.09,.08,.08); ell(.18,.14,.065,.065); ell(.04,.035,.035,.035); ell(-.2,.2,.13,.13);
  [-1,1].forEach(function(s){
    [.26,.18,.1].forEach(function(x0,i){
      var dx=(i-1)*.1, a=new THREE.Vector3(x0,-.02,.05*s), k=new THREE.Vector3(x0+dx,.07,.2*s), f=new THREE.Vector3(x0+dx*1.8,-.17,.3*s);
      inner.add(cylBetween(a,k,.012,m), cylBetween(k,f,.009,m));
    });
    var h=new THREE.Vector3(.44,.05,.03*s), a1=new THREE.Vector3(.5,.16,.08*s), a2=new THREE.Vector3(.6,.08,.15*s);
    inner.add(cylBetween(h,a1,.008,m), cylBetween(a1,a2,.007,m));
  });
  inner.rotation.y=-.5; g.add(inner);
  g.userData.tick=function(t){ inner.rotation.y=-.5+Math.sin(t*.4)*.3; };
  return g;
};

B.cat = function(){
  var g=new THREE.Group(), inner=new THREE.Group(), fur=std(0x8d8782,{roughness:.8}), dark=std(0x4a4542,{roughness:.8});
  var body=new THREE.Mesh(new THREE.SphereGeometry(1,32,20),fur); body.scale.set(.34,.14,.14); inner.add(body);
  var head=new THREE.Mesh(new THREE.SphereGeometry(.13,32,20),fur); head.position.set(.4,.13,0); inner.add(head);
  [-1,1].forEach(function(s){
    var ear=new THREE.Mesh(new THREE.ConeGeometry(.045,.09,12),dark); ear.position.set(.41,.27,.07*s); ear.rotation.x=-.25*s; inner.add(ear);
    [.22,-.22].forEach(function(x){ var l=new THREE.Mesh(new THREE.CylinderGeometry(.035,.03,.26,12),fur); l.position.set(x,-.2,.07*s); inner.add(l); });
  });
  var tail=new THREE.CatmullRomCurve3([new THREE.Vector3(-.32,.03,0),new THREE.Vector3(-.46,.05,0),new THREE.Vector3(-.54,.2,.03),new THREE.Vector3(-.5,.33,.05)]);
  inner.add(new THREE.Mesh(new THREE.TubeGeometry(tail,40,.028,8),dark));
  inner.rotation.y=-.45; g.add(inner);
  g.userData.tick=function(t){ inner.rotation.y=-.45+Math.sin(t*.35)*.35; };
  return g;
};

B.eiffel = function(){
  var g=new THREE.Group(), steel=std(0xa9825a,{roughness:.6,metalness:.3});
  var lm=new THREE.LineBasicMaterial({color:0xc9a57a,transparent:true,opacity:.8});
  function hw(t){ return .21*Math.pow(1-t,2.3)+.012; }
  var corners=[[1,1],[1,-1],[-1,-1],[-1,1]], seg=[];
  corners.forEach(function(c){
    var pts=[]; for(var i=0;i<=30;i++){ var t=i/30; pts.push(new THREE.Vector3(c[0]*hw(t),t-.5,c[1]*hw(t))); }
    g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),60,.007,5),steel));
  });
  var levels=[]; for(var L=0;L<=16;L++) levels.push(Math.pow(L/16,1.3)*.97);
  for(var j=0;j<levels.length-1;j++){
    var t0=levels[j], t1=levels[j+1], h0=hw(t0), h1=hw(t1);
    for(var k=0;k<4;k++){
      var a=corners[k], b=corners[(k+1)%4];
      seg.push(a[0]*h0,t0-.5,a[1]*h0, b[0]*h1,t1-.5,b[1]*h1);
      seg.push(b[0]*h0,t0-.5,b[1]*h0, a[0]*h1,t1-.5,a[1]*h1);
      seg.push(a[0]*h1,t1-.5,a[1]*h1, b[0]*h1,t1-.5,b[1]*h1);
    }
  }
  var lg=new THREE.BufferGeometry(); lg.setAttribute('position',new THREE.Float32BufferAttribute(seg,3));
  g.add(new THREE.LineSegments(lg,lm));
  [.18,.36,.9].forEach(function(t,i){ var w=hw(t)*2+.03; var p=new THREE.Mesh(new THREE.BoxGeometry(w,.012+(i==2?.02:0),w),steel); p.position.y=t-.5; g.add(p); });
  var ant=new THREE.Mesh(new THREE.CylinderGeometry(.004,.006,.06,6),steel); ant.position.y=.5; g.add(ant);
  g.userData.tick=function(t){ g.rotation.y=t*.15; };
  return g;
};

B.human = function(){
  var g=new THREE.Group(), skin=std(0xd9d2c7,{roughness:.5}), dark=std(0x5c6b80,{roughness:.6});
  function add(geo,mat,x,y,z,rz){ var m=new THREE.Mesh(geo,mat); m.position.set(x,y,z||0); if(rz) m.rotation.z=rz; g.add(m); return m; }
  add(new THREE.SphereGeometry(.075,32,20),skin,0,.415);
  add(new THREE.CylinderGeometry(.03,.034,.06,16),skin,0,.335);
  add(new THREE.CylinderGeometry(.11,.085,.34,24),dark,0,.14);
  add(new THREE.SphereGeometry(.09,24,16),dark,0,-.03).scale.set(1,.55,.75);
  [-1,1].forEach(function(s){
    add(new THREE.CylinderGeometry(.036,.03,.46,16),dark,.052*s,-.27);
    add(new THREE.SphereGeometry(.036,16,10),skin,.052*s,-.5).scale.set(1,.5,1.6);
    add(new THREE.CylinderGeometry(.03,.024,.4,16),skin,.145*s,.1,0,.08*s);
    add(new THREE.SphereGeometry(.04,16,12),dark,.12*s,.29);
  });
  g.userData.tick=function(t){ g.rotation.y=Math.sin(t*.35)*.6; };
  return g;
};

B.whale = function(){
  var g=new THREE.Group(), inner=new THREE.Group(), mat=std(0x4b6a8c,{roughness:.5}), belly=std(0x9fb3c6,{roughness:.6});
  var body=new THREE.Mesh(new THREE.SphereGeometry(.5,64,32),mat); body.scale.set(1,.15,.18); inner.add(body);
  var under=new THREE.Mesh(new THREE.SphereGeometry(.5,48,24),belly); under.scale.set(.8,.1,.14); under.position.set(.08,-.035,0); inner.add(under);
  [-1,1].forEach(function(s){
    var f=new THREE.Mesh(new THREE.SphereGeometry(.5,24,12),mat); f.scale.set(.08,.012,.13); f.position.set(-.53,0,.07*s); f.rotation.y=.5*s; inner.add(f);
    var p=new THREE.Mesh(new THREE.SphereGeometry(.5,24,12),mat); p.scale.set(.1,.01,.035); p.position.set(.22,-.055,.1*s); p.rotation.y=-.6*s; p.rotation.x=.3*s; inner.add(p);
  });
  inner.rotation.y=-.5; g.add(inner);
  g.userData.tick=function(t){ inner.rotation.z=Math.sin(t*.8)*.05; inner.position.y=Math.sin(t*.8)*.02; };
  return g;
};

B.everest = function(){
  var geo=new THREE.ConeGeometry(.7,.62,72,18);
  geo=geo.toNonIndexed();
  displace(geo,function(v){
    var h=(v.y+.31)/.62, th=Math.atan2(v.z,v.x);
    var k=1+(.22*noise3(v.x*2.2,v.y*2,v.z*2.2)+.1*Math.sin(th*7))*(1-h*.6);
    v.x*=k; v.z*=k; v.y+= .03*noise3(v.x*5,1,v.z*5)*(1-h);
  });
  var p=geo.attributes.position, col=[], c=new THREE.Color();
  for(var i=0;i<p.count;i++){
    var h=(p.getY(i)+.31)/.62;
    if(h>.58+.08*Math.sin(p.getX(i)*30)) c.set(0xf4f6fa); else c.set(0x6b5f55).lerp(new THREE.Color(0x3b3632),R()*.5);
    col.push(c.r,c.g,c.b);
  }
  geo.setAttribute('color',new THREE.Float32BufferAttribute(col,3));
  var m=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({vertexColors:true,flatShading:true,roughness:.9}));
  var g=new THREE.Group(); g.add(m); m.rotation.x=.25; m.scale.setScalar(1/.62);
  g.userData.tick=function(t){ m.rotation.y=t*.1; };
  return g;
};

function planet(tex,extra){
  var g=new THREE.Group();
  var m=new THREE.Mesh(new THREE.SphereGeometry(.5,64,40),new THREE.MeshStandardMaterial(Object.assign({map:tex,roughness:.9,metalness:0},extra||{})));
  g.add(m); m.rotation.z=.2;
  g.userData.tick=function(t){ m.rotation.y=t*.12; };
  g.userData.surface=m; return g;
}

B.moon = function(){
  var tex=canvasTex(1024,512,function(g,w,h){
    g.fillStyle='#9a9895'; g.fillRect(0,0,w,h);
    for(var i=0;i<14;i++){ g.fillStyle='rgba(60,60,64,.35)'; g.beginPath(); g.ellipse(R()*w,h*.25+R()*h*.5,40+R()*110,30+R()*70,R()*3,0,7); g.fill(); }
    for(var j=0;j<4000;j++){ var v=120+R()*60|0; g.fillStyle='rgba('+v+','+v+','+v+',.35)'; g.fillRect(R()*w,R()*h,2,2); }
    for(var k=0;k<180;k++){ var x=R()*w, y=R()*h, r=2+Math.pow(R(),3)*26;
      g.fillStyle='rgba(55,55,58,.45)'; g.beginPath(); g.arc(x,y,r,0,7); g.fill();
      g.strokeStyle='rgba(220,220,215,.35)'; g.lineWidth=Math.max(1,r*.18); g.beginPath(); g.arc(x-r*.12,y-r*.12,r,3.4,5.6); g.stroke(); }
  });
  return planet(tex);
};

B.earth = function(){
  var tex=canvasTex(1024,512,function(g,w,h){
    var grd=g.createLinearGradient(0,0,0,h); grd.addColorStop(0,'#1b3f73'); grd.addColorStop(.5,'#1f5a99'); grd.addColorStop(1,'#1b3f73');
    g.fillStyle=grd; g.fillRect(0,0,w,h);
    for(var c=0;c<9;c++){
      var cx=R()*w, cy=h*.2+R()*h*.6, n=30+R()*50|0;
      for(var i=0;i<n;i++){ var x=cx+gauss()*55, y=cy+gauss()*45, lat=Math.abs(y/h-.5);
        g.fillStyle=lat<.12&&R()<.6?'#c2a26a':(R()<.5?'#3f7a3a':'#2f6431'); g.beginPath(); g.ellipse(x,y,12+R()*28,8+R()*20,R()*3,0,7); g.fill(); }
    }
    g.fillStyle='#eef3f7'; g.fillRect(0,0,w,h*.05); g.fillRect(0,h*.95,w,h*.05);
  });
  var g=planet(tex,{roughness:.7});
  var ctex=canvasTex(1024,512,function(gc,w,h){
    gc.clearRect(0,0,w,h);
    for(var i=0;i<260;i++){ gc.fillStyle='rgba(255,255,255,'+(.08+R()*.18)+')'; gc.beginPath(); gc.ellipse(R()*w,R()*h,20+R()*90,5+R()*14,gauss()*.2,0,7); gc.fill(); }
  });
  var clouds=new THREE.Mesh(new THREE.SphereGeometry(.508,64,40),new THREE.MeshStandardMaterial({map:ctex,transparent:true,depthWrite:false,roughness:1}));
  g.add(clouds); g.add(glow(0x6fb0ff,1.28,.45));
  var base=g.userData.tick;
  g.userData.tick=function(t){ base(t); clouds.rotation.y=t*.16; };
  return g;
};

B.jupiter = function(){
  var pal=['#e8d8bf','#c9a47c','#b07b52','#e3cdaa','#9c6a45','#f0e3cc','#c79968'];
  var tex=canvasTex(1024,512,function(g,w,h){
    var band=0;
    for(var y=0;y<h;y++){ if(y%(10+(y*7%23))===0) band=Math.floor(R()*pal.length); g.fillStyle=pal[band]; g.fillRect(0,y,w,1); }
    for(var i=0;i<900;i++){ var yy=R()*h; g.fillStyle='rgba(255,245,230,'+(R()*.12)+')'; g.beginPath(); g.ellipse(R()*w,yy,10+R()*40,1+R()*3,0,0,7); g.fill(); }
    g.fillStyle='#b8543a'; g.beginPath(); g.ellipse(w*.66,h*.64,46,22,0,0,7); g.fill();
    g.fillStyle='rgba(240,200,170,.5)'; g.beginPath(); g.ellipse(w*.66,h*.64,30,12,0,0,7); g.fill();
  });
  var g=planet(tex); g.userData.surface.rotation.z=.05;
  return g;
};

B.sun = function(){
  var tex=canvasTex(512,256,function(g,w,h){
    g.fillStyle='#ffab3d'; g.fillRect(0,0,w,h);
    for(var i=0;i<5000;i++){ g.fillStyle=R()<.5?'rgba(255,230,140,.25)':'rgba(220,90,20,.2)'; g.beginPath(); g.arc(R()*w,R()*h,1+R()*3,0,7); g.fill(); }
  });
  var g=new THREE.Group();
  var m=new THREE.Mesh(new THREE.SphereGeometry(.5,64,40),new THREE.MeshBasicMaterial({map:tex}));
  g.add(m, glow(0xffd08a,1.35,.9), glow(0xff8a2a,2.0,.55));
  g.userData.tick=function(t){ m.rotation.y=t*.05; };
  return g;
};

B.solar = function(){
  var g=new THREE.Group(), AU=[.39,.72,1,1.52,5.2,9.54,19.2,30.1];
  var cols=[0xb7b1a8,0xe8c98a,0x5b8fd6,0xd46a45,0xd9b48a,0xe6d3a2,0x9ed9e0,0x5a7fe0];
  var sizes=[.004,.006,.006,.005,.018,.015,.011,.011];
  var lm=new THREE.LineBasicMaterial({color:0xcfd8ff,transparent:true,opacity:.28});
  var planets=[];
  AU.forEach(function(au,i){
    var r=au/30.1*.5, pts=[];
    for(var k=0;k<=128;k++){ var a=k/128*Math.PI*2; pts.push(new THREE.Vector3(Math.cos(a)*r,0,Math.sin(a)*r)); }
    g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),lm));
    var p=new THREE.Mesh(new THREE.SphereGeometry(sizes[i],16,10),new THREE.MeshBasicMaterial({color:cols[i]}));
    p.userData={r:r,w:1.2/Math.pow(au,1.5),a0:R()*6.28}; g.add(p); planets.push(p);
    if(i>=4) p.add(glow(cols[i],sizes[i]*5,.5));
  });
  g.add(glow(0xffc36a,.06,1));
  g.rotation.x=.5;
  g.userData.tick=function(t){ planets.forEach(function(p){ var a=p.userData.a0+t*p.userData.w*.35; p.position.set(Math.cos(a)*p.userData.r,0,Math.sin(a)*p.userData.r); }); };
  g.userData.tick(0);
  return g;
};

B.oort = function(){
  var g=new THREE.Group(), pos=[];
  for(var i=0;i<4000;i++){ var d=new THREE.Vector3(gauss(),gauss(),gauss()).normalize(), r=.28+Math.pow(R(),.6)*.22; pos.push(d.x*r,d.y*r*.92,d.z*r); }
  var pts=makePoints(pos,0xc8dcff,.012,.55); g.add(pts);
  g.add(glow(0xffc36a,.02,1));
  g.userData.tick=function(t){ pts.rotation.y=t*.04; };
  return g;
};

function galaxyPoints(n,radius,arms,twist,core,arm,size){
  var pos=[], col=[], cIn=new THREE.Color(core), cOut=new THREE.Color(arm), tmp=new THREE.Color();
  for(var i=0;i<n;i++){
    var x,y,z;
    if(R()<.2){ var r0=Math.abs(gauss())*radius*.12, t0=R()*6.283; x=Math.cos(t0)*r0*1.6; z=Math.sin(t0)*r0; y=gauss()*radius*.05; tmp.copy(cIn); }
    else{
      var r=Math.pow(R(),.75)*radius, a=Math.floor(R()*arms), th=a*Math.PI*2/arms+r/radius*twist+gauss()*.3*(1-r/radius*.4);
      x=Math.cos(th)*r+gauss()*radius*.02; z=Math.sin(th)*r+gauss()*radius*.02; y=gauss()*radius*.015;
      tmp.copy(cIn).lerp(cOut,Math.min(1,r/radius*1.5));
      if(R()<.04) tmp.set(0xff7fa8);
    }
    pos.push(x,y,z); col.push(tmp.r,tmp.g,tmp.b);
  }
  return makePoints(pos,col,size,.9);
}

B.milky = function(){
  var g=new THREE.Group(), gal=galaxyPoints(16000,.5,2,4.4,0xffdca0,0x8fb8ff,.02);
  g.add(gal, glow(0xffd9a0,.25,.8));
  g.rotation.x=1.05; g.rotation.z=.2;
  g.userData.tick=function(t){ gal.rotation.y=t*.05; };
  return g;
};

B.localgroup = function(){
  var g=new THREE.Group();
  var mw=galaxyPoints(4500,.085,2,4.4,0xffdca0,0x8fb8ff,.012); mw.position.set(-.18,-.02,.03); mw.rotation.set(1.1,0,.3);
  var m31=galaxyPoints(6500,.12,2,4,0xffe6b8,0xa8c4ff,.012); m31.position.set(.15,.05,-.04); m31.rotation.set(1.35,.3,-.5);
  var m33=galaxyPoints(1800,.04,2,3,0xfff0d0,0x9fd0ff,.01); m33.position.set(.27,-.1,.06); m33.rotation.set(.6,0,.2);
  g.add(mw,m31,m33, glow(0xffdca0,.06,.7));
  var gl2=glow(0xffe6b8,.08,.7); gl2.position.copy(m31.position); g.add(gl2);
  var pos=[];
  for(var i=0;i<70;i++){ var c=R()<.5?mw.position:m31.position; pos.push(c.x+gauss()*.09,c.y+gauss()*.07,c.z+gauss()*.08); }
  for(var j=0;j<25;j++){ var d=new THREE.Vector3(gauss(),gauss(),gauss()).normalize().multiplyScalar(.3+R()*.2); pos.push(d.x,d.y,d.z); }
  g.add(makePoints(pos,0xdfe6ff,.02,.8));
  g.userData.tick=function(t){ g.rotation.y=Math.sin(t*.1)*.4; };
  return g;
};

B.universe = function(){
  var g=new THREE.Group(), nodes=[], pos=[], col=[], c1=new THREE.Color(0x9d7bff), c2=new THREE.Color(0xffb27a), c3=new THREE.Color(0x8fd0ff), tmp=new THREE.Color();
  while(nodes.length<70){ var v=new THREE.Vector3(R()*2-1,R()*2-1,R()*2-1); if(v.length()<1) nodes.push(v.multiplyScalar(.46)); }
  function pushPt(p){ var k=R(); tmp.copy(c1).lerp(k<.5?c3:c2,R()); pos.push(p.x,p.y,p.z); col.push(tmp.r,tmp.g,tmp.b); }
  var done={};
  nodes.forEach(function(a,i){
    var near=nodes.map(function(b,j){ return {j:j,d:a.distanceTo(b)}; }).filter(function(o){ return o.j!==i; }).sort(function(x,y){ return x.d-y.d; }).slice(0,3);
    near.forEach(function(o){
      var key=Math.min(i,o.j)+'-'+Math.max(i,o.j); if(done[key]) return; done[key]=1;
      var b=nodes[o.j];
      for(var k=0;k<110;k++){ var p=a.clone().lerp(b,R()); p.x+=gauss()*.009; p.y+=gauss()*.009; p.z+=gauss()*.009; pushPt(p); }
    });
    for(var k=0;k<110;k++) pushPt(new THREE.Vector3(a.x+gauss()*.016,a.y+gauss()*.016,a.z+gauss()*.016));
  });
  var web=makePoints(pos,col,.012,.75); g.add(web);
  g.add(new THREE.Mesh(new THREE.SphereGeometry(.52,48,32),new THREE.MeshBasicMaterial({color:0xff9a66,transparent:true,opacity:.07,side:THREE.BackSide,depthWrite:false})));
  g.userData.tick=function(t){ web.rotation.y=t*.03; };
  return g;
};

B.water = function(){
  var g=new THREE.Group(), inner=new THREE.Group();
  inner.add(new THREE.Mesh(new THREE.SphereGeometry(.26,40,28),std(0xe8433f,{roughness:.35})));
  var hm=std(0xf2f4f8,{roughness:.3}), ang=104.5*Math.PI/180;
  [-1,1].forEach(function(s){ var a=-Math.PI/2+s*ang/2, h=new THREE.Mesh(new THREE.SphereGeometry(.17,32,20),hm); h.position.set(Math.cos(a)*.3,Math.sin(a)*.3,0); inner.add(h); });
  g.add(inner);
  g.userData.tick=function(t){ inner.rotation.y=t*.4; inner.rotation.x=Math.sin(t*.3)*.3; };
  return g;
};

B.phage = function(){
  var g=new THREE.Group(), inner=new THREE.Group(), shell=std(0xb9d4e8,{roughness:.35,flatShading:true,emissive:0x0d2030}), leg=std(0xd6e6f2,{roughness:.4});
  var head=new THREE.Mesh(new THREE.IcosahedronGeometry(.14,0),shell); head.scale.set(1,1.35,1); head.position.y=.3; inner.add(head);
  var collar=new THREE.Mesh(new THREE.CylinderGeometry(.05,.05,.03,12),shell); collar.position.y=.1; inner.add(collar);
  var tail=new THREE.Mesh(new THREE.CylinderGeometry(.035,.035,.32,16),std(0x8fa9c0,{roughness:.4})); tail.position.y=-.07; inner.add(tail);
  for(var k=0;k<8;k++){ var rg=new THREE.Mesh(new THREE.TorusGeometry(.04,.008,6,16),leg); rg.rotation.x=Math.PI/2; rg.position.y=-.2+k*.037; inner.add(rg); }
  var base=new THREE.Mesh(new THREE.CylinderGeometry(.07,.07,.025,6),shell); base.position.y=-.24; inner.add(base);
  for(var i=0;i<6;i++){ var a=i/6*Math.PI*2, c=Math.cos(a), sn=Math.sin(a);
    var hip=new THREE.Vector3(c*.06,-.24,sn*.06), knee=new THREE.Vector3(c*.22,-.17,sn*.22), foot=new THREE.Vector3(c*.3,-.44,sn*.3);
    inner.add(cylBetween(hip,knee,.008,leg), cylBetween(knee,foot,.007,leg)); }
  g.add(inner);
  g.userData.tick=function(t){ inner.rotation.y=t*.3; };
  return g;
};

B.flea = function(){
  var g=new THREE.Group(), inner=new THREE.Group(), m=std(0x6b3a1c,{roughness:.3,metalness:.1});
  var body=new THREE.Mesh(new THREE.SphereGeometry(1,32,20),m); body.scale.set(.33,.24,.12); body.position.y=.05; inner.add(body);
  var head=new THREE.Mesh(new THREE.SphereGeometry(1,24,16),m); head.scale.set(.1,.09,.07); head.position.set(.33,0,0); inner.add(head);
  [-1,1].forEach(function(s){
    [[[.2,-.1],[.28,-.22],[.32,-.36]],[[.05,-.12],[.09,-.24],[.03,-.36]]].forEach(function(L){
      var a=new THREE.Vector3(L[0][0],L[0][1],.06*s), b=new THREE.Vector3(L[1][0],L[1][1],.13*s), c=new THREE.Vector3(L[2][0],L[2][1],.14*s);
      inner.add(cylBetween(a,b,.014,m), cylBetween(b,c,.01,m)); });
    var hip=new THREE.Vector3(-.15,-.08,.08*s), knee=new THREE.Vector3(-.38,-.16,.12*s), foot=new THREE.Vector3(-.2,-.36,.14*s);
    inner.add(cylBetween(hip,knee,.035,m), cylBetween(knee,foot,.018,m));
  });
  inner.rotation.y=-.4; g.add(inner);
  g.userData.tick=function(t){ inner.rotation.y=-.4+Math.sin(t*.5)*.35; };
  return g;
};

B.mouse = function(){
  var g=new THREE.Group(), inner=new THREE.Group(), fur=std(0x8a7f76,{roughness:.85}), pink=std(0xe7a9a4,{roughness:.6}), black=std(0x111111,{roughness:.2});
  function ell(mat,x,y,z,sx,sy,sz){ var e=new THREE.Mesh(new THREE.SphereGeometry(1,28,18),mat); e.position.set(x,y,z); e.scale.set(sx,sy,sz); inner.add(e); return e; }
  ell(fur,0,.15,0,.3,.15,.15); ell(fur,.3,.17,0,.15,.11,.11); ell(pink,.45,.15,0,.025,.025,.025);
  [-1,1].forEach(function(s){ ell(pink,.25,.3,.08*s,.06,.07,.015).rotation.y=.4*s; ell(black,.39,.21,.06*s,.018,.018,.018);
    ell(pink,.18,.015,.08*s,.05,.015,.03); ell(pink,-.18,.015,.08*s,.06,.015,.035); });
  var tail=new THREE.CatmullRomCurve3([new THREE.Vector3(-.28,.12,0),new THREE.Vector3(-.5,.05,.03),new THREE.Vector3(-.75,.03,-.03),new THREE.Vector3(-.98,.08,.02)]);
  inner.add(new THREE.Mesh(new THREE.TubeGeometry(tail,50,.013,8),pink));
  inner.rotation.y=-.35; g.add(inner);
  g.userData.tick=function(t){ inner.rotation.y=-.35+Math.sin(t*.4)*.3; };
  return g;
};

B.car = function(){
  var g=new THREE.Group(), inner=new THREE.Group();
  function prof(pts,depth,mat,bevel){ var sh=new THREE.Shape(); pts.forEach(function(p,i){ if(i) sh.lineTo(p[0],p[1]); else sh.moveTo(p[0],p[1]); });
    var geo=new THREE.ExtrudeGeometry(sh,{depth:depth,bevelEnabled:!!bevel,bevelThickness:.02,bevelSize:.02,bevelSegments:3}); geo.translate(0,0,-depth/2); var m=new THREE.Mesh(geo,mat); inner.add(m); return m; }
  prof([[-.5,.1],[-.5,.22],[-.44,.27],[-.3,.29],[-.18,.42],[.12,.43],[.26,.3],[.46,.27],[.5,.2],[.5,.1]],.36,std(0x2d5ea8,{roughness:.3,metalness:.5}),true);
  prof([[-.28,.3],[-.17,.4],[.11,.41],[.23,.3]],.41,std(0x1a2230,{roughness:.1,metalness:.8}));
  var tire=std(0x1b1b1f,{roughness:.8}), hub=std(0xb8bcc4,{metalness:.8,roughness:.3});
  [[-.3,1],[-.3,-1],[.3,1],[.3,-1]].forEach(function(w){
    var t=new THREE.Mesh(new THREE.CylinderGeometry(.085,.085,.07,24),tire); t.rotation.x=Math.PI/2; t.position.set(w[0],.085,.19*w[1]); inner.add(t);
    var h=new THREE.Mesh(new THREE.CylinderGeometry(.045,.045,.075,16),hub); h.rotation.x=Math.PI/2; h.position.copy(t.position); inner.add(h); });
  [1,-1].forEach(function(s){
    var f=new THREE.Mesh(new THREE.BoxGeometry(.02,.03,.07),std(0xfff2c0,{emissive:0xffe08a,emissiveIntensity:.8})); f.position.set(.51,.21,.12*s); inner.add(f);
    var r=new THREE.Mesh(new THREE.BoxGeometry(.02,.03,.08),std(0xff3030,{emissive:0xff2020,emissiveIntensity:.8})); r.position.set(-.51,.22,.12*s); inner.add(r); });
  inner.rotation.y=-.45; g.add(inner);
  g.userData.tick=function(t){ inner.rotation.y=-.45+Math.sin(t*.3)*.3; };
  return g;
};

B.bus = function(){
  var g=new THREE.Group(), inner=new THREE.Group();
  function box(w,h,d,x,y,z,mat){ var m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat); m.position.set(x,y,z); inner.add(m); return m; }
  var blue=std(0x2a6fd6,{roughness:.4,metalness:.2}), glass=std(0x162030,{roughness:.1,metalness:.8}), white=std(0xf2f4f7,{roughness:.5});
  box(1,.25,.23,0,.165,0,blue); box(1.004,.03,.232,0,.075,0,white); box(.86,.085,.234,-.03,.215,0,glass);
  box(.012,.14,.2,.5,.19,0,glass); box(.94,.02,.2,0,.3,0,white);
  box(.07,.16,.236,.4,.14,0,glass); box(.07,.16,.236,.02,.14,0,glass);
  var tire=std(0x1b1b1f,{roughness:.8});
  [[-.33,1],[-.33,-1],[.33,1],[.33,-1]].forEach(function(w){ var t=new THREE.Mesh(new THREE.CylinderGeometry(.055,.055,.05,20),tire); t.rotation.x=Math.PI/2; t.position.set(w[0],.055,.11*w[1]); inner.add(t); });
  inner.rotation.y=-.45; g.add(inner);
  g.userData.tick=function(t){ inner.rotation.y=-.45+Math.sin(t*.3)*.3; };
  return g;
};

B.lotte = function(){
  var g=new THREE.Group(), pts=[];
  for(var i=0;i<=40;i++){ var t=i/40; pts.push(new THREE.Vector2(.085*Math.pow(1-t,.85)+.008,t-.5)); }
  var m=new THREE.Mesh(new THREE.LatheGeometry(pts,8),std(0xa9bccb,{roughness:.2,metalness:.7,emissive:0x0a1420}));
  m.rotation.y=Math.PI/8; g.add(m);
  var top=glow(0xffffff,.05,.9); top.position.y=.5; g.add(top);
  g.userData.tick=function(t){ m.rotation.y=Math.PI/8+t*.1; };
  return g;
};

B.earthmoon = function(){
  var g=new THREE.Group();
  var e=new THREE.Mesh(new THREE.SphereGeometry(.0166,24,16),std(0x3d7bd9,{emissive:0x0a2244})); e.position.x=-.5;
  var mo=new THREE.Mesh(new THREE.SphereGeometry(.0045,16,12),std(0xbbbbbb,{emissive:0x333333})); mo.position.x=.5;
  var ge=glow(0x6fb0ff,.09,.8); ge.position.x=-.5; var gm=glow(0xdddddd,.04,.6); gm.position.x=.5;
  var lg=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-.48,0,0),new THREE.Vector3(.494,0,0)]);
  var line=new THREE.Line(lg,new THREE.LineDashedMaterial({color:0xcfd8ff,dashSize:.02,gapSize:.015,transparent:true,opacity:.6})); line.computeLineDistances();
  g.add(e,mo,ge,gm,line);
  return g;
};

/* 별 표면: 끓어오르는 대류 무늬(fbm 노이즈) + 가장자리 어두워짐(주연 감광). 1보다 밝게 내보내 블룸이 잡힌다. */
var STAR_TIME = { value: 0 };
var STAR_VS = "varying vec3 vPos; varying vec3 vN; varying vec3 vV;\n"+
  "void main(){ vPos=position; vN=normalize(normalMatrix*normal); vec4 mv=modelViewMatrix*vec4(position,1.); vV=-mv.xyz; gl_Position=projectionMatrix*mv; }";
var STAR_FS = "uniform vec3 c1; uniform vec3 c2; uniform float time; uniform float opacity; uniform float scale; uniform float boost;\n"+
  "varying vec3 vPos; varying vec3 vN; varying vec3 vV;\n"+
  "float hash(vec3 p){ p=fract(p*0.3183099+.1); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }\n"+
  "float noise(vec3 x){ vec3 i=floor(x), f=fract(x); f=f*f*(3.-2.*f);\n"+
  "  return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),\n"+
  "             mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z); }\n"+
  "float fbm(vec3 p){ float a=.5, s=0.; for(int i=0;i<5;i++){ s+=a*noise(p); p=p*2.03+vec3(1.7,9.2,3.1); a*=.5; } return s; }\n"+
  "void main(){\n"+
  "  vec3 p=normalize(vPos)*scale;\n"+
  "  float n=fbm(p+vec3(0.,time*.06,time*.03));\n"+
  "  float ridge=1.-abs(noise(p*2.2-time*.08)*2.-1.);\n"+
  "  float g=mix(n,ridge,.4);\n"+
  "  float mu=max(dot(normalize(vN),normalize(vV)),0.);\n"+
  "  float limb=pow(mu,.5);\n"+
  "  vec3 col=mix(c2,c1,smoothstep(.32,.72,g))*(.45+.8*limb)*boost;\n"+
  "  col+=c1*pow(1.-mu,3.)*.35;\n"+
  "  gl_FragColor=vec4(col,opacity);\n"+
  "}";
function starSphere(c1,c2,cells){
  var a=new THREE.Color(c1), mx=Math.max(a.r,a.g,a.b);
  /* 흰 별은 조금만, 붉은 별은 더 밝게: 가장 밝은 채널이 약 1.35가 되도록 */
  var u={ c1:{value:a}, c2:{value:new THREE.Color(c2)}, time:STAR_TIME, opacity:{value:1},
          scale:{value:cells<500?2.4:6.5}, boost:{value:1.35/mx} };
  var m=new THREE.ShaderMaterial({ uniforms:u, vertexShader:STAR_VS, fragmentShader:STAR_FS, transparent:true });
  /* 페이드 루프가 material.opacity를 쓰므로 유니폼과 연결 */
  Object.defineProperty(m,"opacity",{ get:function(){ return u.opacity.value; }, set:function(v){ u.opacity.value=v; } });
  return m;
}
B.kapteyn = function(){
  var g=new THREE.Group(), m=new THREE.Mesh(new THREE.SphereGeometry(.5,64,40),starSphere('#ff6a3a','#ff3a1a',4000));
  g.add(m, glow(0xff9a6a,1.15,.7), glow(0xff5a2a,1.8,.45));
  g.userData.tick=function(t){ m.rotation.y=t*.05; };
  return g;
};

B.earthorbit = function(){
  var g=new THREE.Group(), pts=[];
  for(var k=0;k<=160;k++){ var a=k/160*Math.PI*2; pts.push(new THREE.Vector3(Math.cos(a)*.5,0,Math.sin(a)*.5)); }
  g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color:0x9fc6ff,transparent:true,opacity:.55})));
  g.add(new THREE.Mesh(new THREE.SphereGeometry(.0024,16,12),new THREE.MeshBasicMaterial({color:0xffe0a0})), glow(0xffd08a,.06,1));
  var earth=new THREE.Group(); earth.add(new THREE.Mesh(new THREE.SphereGeometry(.006,12,8),new THREE.MeshBasicMaterial({color:0x5b8fd6})), glow(0x6fb0ff,.035,.9)); g.add(earth);
  g.rotation.x=.5;
  g.userData.tick=function(t){ var a=t*.15; earth.position.set(Math.cos(a)*.5,0,Math.sin(a)*.5); };
  g.userData.tick(0);
  return g;
};

B.betelgeuse = function(){
  var g=new THREE.Group();
  var geo=displace(new THREE.SphereGeometry(.5,64,40),function(v){ v.multiplyScalar(1+.035*noise3(v.x*3,v.y*3,v.z*3)); });
  var m=new THREE.Mesh(geo,starSphere('#ff7a3a','#c8301a',120)); g.add(m, glow(0xff6a2a,1.6,.55), glow(0xff3a1a,2.4,.28));
  [[.5/3.55,'지구'],[.5*1.52/3.55,'화성']].forEach(function(o){
    var pts=[]; for(var k=0;k<=120;k++){ var a=k/120*Math.PI*2; pts.push(new THREE.Vector3(Math.cos(a)*o[0],Math.sin(a)*o[0],.52)); }
    var ln=new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineDashedMaterial({color:0xffffff,dashSize:.012,gapSize:.01,transparent:true,opacity:.75,depthTest:false}));
    ln.computeLineDistances(); ln.renderOrder=5; g.add(ln);
  });
  var sun=glow(0xfff0c0,.03,1); sun.position.z=.53; sun.material.depthTest=false; sun.renderOrder=6; g.add(sun);
  g.userData.tick=function(t){ m.rotation.y=t*.03; };
  return g;
};

B.proxima = function(){
  var g=new THREE.Group();
  var a=glow(0xffe0a0,.05,1); a.position.x=-.5; var b=glow(0xff6a4a,.035,1); b.position.x=.5;
  var lg=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-.48,0,0),new THREE.Vector3(.485,0,0)]);
  var line=new THREE.Line(lg,new THREE.LineDashedMaterial({color:0xcfd8ff,dashSize:.02,gapSize:.015,transparent:true,opacity:.55})); line.computeLineDistances();
  var pos=[]; for(var i=0;i<400;i++){ var d=new THREE.Vector3(gauss(),gauss()*.4,gauss()).normalize().multiplyScalar(.12+R()*.4); pos.push(d.x-.5,d.y,d.z); }
  g.add(a,b,line,makePoints(pos,0xc8dcff,.006,.25));
  return g;
};

B.andromeda = function(){
  var g=new THREE.Group();
  var mw=galaxyPoints(3000,.02,2,4.4,0xffdca0,0x8fb8ff,.004); mw.position.x=-.5; mw.rotation.set(1.1,0,.3);
  var m31=galaxyPoints(5000,.044,2,4,0xffe6b8,0xa8c4ff,.004); m31.position.x=.5; m31.rotation.set(1.35,.3,-.5);
  var lg=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-.47,0,0),new THREE.Vector3(.45,0,0)]);
  var line=new THREE.Line(lg,new THREE.LineDashedMaterial({color:0xcfd8ff,dashSize:.02,gapSize:.015,transparent:true,opacity:.5})); line.computeLineDistances();
  g.add(mw,m31,line);
  return g;
};

B.laniakea = function(){
  var g=new THREE.Group(), pos=[], col=[], ca=new THREE.Color(0x7fb2ff), cb=new THREE.Color(0xfff0d0), tmp=new THREE.Color(), core=new THREE.Vector3(.04,0,0);
  for(var s=0;s<48;s++){
    var st; do{ st=new THREE.Vector3(R()*2-1,(R()*2-1)*.55,R()*2-1); }while(st.length()>1); st.multiplyScalar(.5);
    var ctrl=st.clone().lerp(core,.5).add(new THREE.Vector3(gauss()*.12,gauss()*.08,gauss()*.12));
    var curve=new THREE.QuadraticBezierCurve3(st,ctrl,core);
    for(var k=0;k<90;k++){ var t=R(), p=curve.getPoint(t); p.x+=gauss()*.01; p.y+=gauss()*.01; p.z+=gauss()*.01;
      tmp.copy(ca).lerp(cb,t); pos.push(p.x,p.y,p.z); col.push(tmp.r,tmp.g,tmp.b); }
  }
  var pts=makePoints(pos,col,.011,.8); g.add(pts, glow(0xfff0d0,.12,.6));
  var you=glow(0xff7aa0,.035,1); you.position.set(-.36,.05,.18); g.add(you);
  g.userData.tick=function(t){ g.rotation.y=t*.03; };
  return g;
};

/* ---------- 추가 대상 모델 ---------- */
function molecule(atoms,bondDist){
  var g=new THREE.Group(), mats={}, bm=std(0xcfd6de,{roughness:.4}), P=[];
  atoms.forEach(function(a){ var m=mats[a[3]]||(mats[a[3]]=std(a[3],{roughness:.35})); var s=new THREE.Mesh(new THREE.SphereGeometry(a[4],24,16),m); s.position.set(a[0],a[1],a[2]); g.add(s); P.push(s.position); });
  for(var i=0;i<P.length;i++) for(var j=i+1;j<P.length;j++) if(P[i].distanceTo(P[j])<bondDist) g.add(cylBetween(P[i],P[j],.022,bm));
  return g;
}
function blob(r,detail,amp,freq,mat){ return new THREE.Mesh(displace(new THREE.IcosahedronGeometry(r,detail),function(v){ v.multiplyScalar(1+amp*noise3(v.x*freq,v.y*freq,v.z*freq)); }),mat); }
function capsuleGeo(len,rad){
  var pts=[], half=len/2-rad, i;
  for(i=0;i<=14;i++){ var a=-Math.PI/2+i/14*Math.PI/2; pts.push(new THREE.Vector2(Math.max(1e-4,Math.cos(a)*rad),-half+Math.sin(a)*rad)); }
  for(i=0;i<=14;i++){ var b=i/14*Math.PI/2; pts.push(new THREE.Vector2(Math.max(1e-4,Math.cos(b)*rad),half+Math.sin(b)*rad)); }
  return new THREE.LatheGeometry(pts,40);
}
function spin(g,inner,speed,axis){ g.userData.tick=function(t){ inner.rotation[axis||'y']=t*speed; }; return g; }
function wrap(inner,speed){ var g=new THREE.Group(); g.add(inner); return spin(g,inner,speed); }
function textSprite(txt,col){
  var tex=canvasTex(256,96,function(g,w,h){ g.font='600 52px '+'"IBM Plex Sans KR","Apple SD Gothic Neo",sans-serif'; g.fillStyle=col||'#ffffff'; g.textAlign='center'; g.textBaseline='middle'; g.fillText(txt,w/2,h/2); });
  var s=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,transparent:true,depthWrite:false})); s.scale.set(.24,.09,1); return s;
}
function cloud(n,fn,size,op){ var pos=[],col=[],c=new THREE.Color(); for(var i=0;i<n;i++){ var r=fn(c); pos.push(r[0],r[1],r[2]); col.push(c.r,c.g,c.b); } return makePoints(pos,col,size,op); }

B.unucleus = function(){
  var inner=new THREE.Group(), geo=new THREE.SphereGeometry(.068,16,12), pm=std(0xff6b5b,{roughness:.35}), nm=std(0x9aa6b8,{roughness:.35}), pts=[];
  while(pts.length<150){ var v=new THREE.Vector3(R()*2-1,R()*2-1,R()*2-1).multiplyScalar(.42); if(v.length()<.42 && pts.every(function(p){ return p.distanceTo(v)>.1; })) pts.push(v); if(pts.length<150 && R()<.0005) break; }
  pts.forEach(function(p,i){ var m=new THREE.Mesh(geo,i%5<2?pm:nm); m.position.copy(p); inner.add(m); });
  return wrap(inner,.2);
};

B.glucose = function(){
  var C=0x4a4a4a, O=0xe8433f, H=0xf2f4f8, a=[];
  for(var k=0;k<6;k++){ var an=k/6*Math.PI*2, x=Math.cos(an)*.2, y=Math.sin(an)*.2, z=(k%2?1:-1)*.04;
    a.push([x,y,z,k===0?O:C,k===0?.075:.07]);
    if(k>0 && k<5){ var ox=Math.cos(an)*.38, oy=Math.sin(an)*.38, oz=(k%2?-1:1)*.1; a.push([ox,oy,oz,O,.075]); a.push([Math.cos(an)*.47,Math.sin(an)*.47,oz+.03,H,.045]); }
    if(k===5){ a.push([Math.cos(an)*.37,Math.sin(an)*.37,.08,C,.07]); a.push([Math.cos(an)*.52,Math.sin(an)*.47,.15,O,.075]); a.push([Math.cos(an)*.6,Math.sin(an)*.55,.2,H,.045]); }
  }
  var m=molecule(a,.215); m.rotation.x=.6; return wrap(m,.4);
};

B.hemoglobin = function(){
  var inner=new THREE.Group(), cols=[0xd9534f,0xe9828a,0xc0392b,0xf0a3a8];
  [[.13,.12,.1],[-.13,.12,-.1],[.13,-.12,-.1],[-.13,-.12,.1]].forEach(function(p,i){
    var b=blob(.22,3,.12,4,std(cols[i],{roughness:.6})); b.position.set(p[0],p[1],p[2]); inner.add(b);
    var d=new THREE.Vector3(p[0],p[1],p[2]).normalize(), heme=new THREE.Mesh(new THREE.CylinderGeometry(.05,.05,.015,16),std(0x5a1a10));
    heme.position.copy(d).multiplyScalar(.36); heme.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d); inner.add(heme);
    var fe=glow(0xffa24d,.06,1); fe.position.copy(d).multiplyScalar(.38); inner.add(fe);
  });
  return wrap(inner,.25);
};

B.ribosome = function(){
  var inner=new THREE.Group();
  var big=blob(.3,3,.12,3.5,std(0x5b8fd6,{roughness:.6})); big.position.y=-.06; inner.add(big);
  var small=blob(.2,3,.14,4,std(0xf2c14e,{roughness:.6})); small.scale.set(1.1,.65,1); small.position.y=.24; inner.add(small);
  var mrna=new THREE.CatmullRomCurve3([new THREE.Vector3(-.6,.2,.12),new THREE.Vector3(-.3,.16,.18),new THREE.Vector3(0,.2,.2),new THREE.Vector3(.3,.15,.17),new THREE.Vector3(.6,.22,.1)]);
  inner.add(new THREE.Mesh(new THREE.TubeGeometry(mrna,60,.015,6),std(0xff6b8a,{emissive:0x401020})));
  var prot=[]; for(var k=0;k<=16;k++) prot.push(new THREE.Vector3(Math.sin(k*.9)*.08+.1,-.3-k*.012,Math.cos(k*.9)*.08));
  inner.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(prot),60,.018,6),std(0x7fe3a8)));
  return wrap(inner,.25);
};

B.corona = function(){
  var inner=new THREE.Group(), up=new THREE.Vector3(0,1,0);
  inner.add(blob(.3,3,.04,6,std(0xb8b8c0,{roughness:.7})));
  var sg=new THREE.CylinderGeometry(.01,.012,.1,6), hg=new THREE.SphereGeometry(1,12,8), sm=std(0xc9c9cf), hm=std(0xd9463e,{roughness:.5});
  fibDirs(56).forEach(function(d){
    var s=new THREE.Mesh(sg,sm); s.position.copy(d).multiplyScalar(.35); s.quaternion.setFromUnitVectors(up,d); inner.add(s);
    var h=new THREE.Mesh(hg,hm); h.scale.set(.045,.028,.045); h.position.copy(d).multiplyScalar(.43); h.quaternion.setFromUnitVectors(up,d); inner.add(h);
  });
  fibDirs(40).forEach(function(d){ var y=new THREE.Mesh(new THREE.SphereGeometry(.014,8,6),std(0xf2c14e)); y.position.copy(d).multiplyScalar(.3); y.position.applyAxisAngle(up,.3); inner.add(y); });
  return wrap(inner,.2);
};

B.mito = function(){
  var inner=new THREE.Group();
  inner.add(new THREE.Mesh(capsuleGeo(1,.24),std(0xff9a6a,{transparent:true,opacity:.4,depthWrite:false,roughness:.4})));
  var core=new THREE.Mesh(capsuleGeo(.9,.2),std(0xffb88a,{transparent:true,opacity:.55,depthWrite:false})); inner.add(core);
  for(var i=0;i<9;i++){ var c=new THREE.Mesh(new THREE.BoxGeometry(.3,.022,.26),std(0xffd49a,{roughness:.5})); c.position.y=-.34+i*.085; c.rotation.z=(i%2?.25:-.25); c.position.x=(i%2?.04:-.04); inner.add(c); }
  inner.rotation.z=Math.PI/2*.85;
  var g=new THREE.Group(); g.add(inner); g.userData.tick=function(t){ inner.rotation.y=t*.3; }; return g;
};

B.egg = function(){
  var inner=new THREE.Group();
  inner.add(new THREE.Mesh(new THREE.SphereGeometry(.42,48,32),std(0xf3e6c8,{roughness:.9})));
  inner.add(new THREE.Mesh(new THREE.SphereGeometry(.49,48,32),std(0xe8f0ff,{transparent:true,opacity:.22,depthWrite:false,roughness:.2})));
  var n=new THREE.Mesh(new THREE.SphereGeometry(.1,24,16),std(0xd4b27a)); n.position.set(.12,.1,.3); inner.add(n);
  var cg=new THREE.SphereGeometry(.05,12,8), cm=std(0xf5dfc0,{roughness:.8});
  fibDirs(60).forEach(function(d){ var c=new THREE.Mesh(cg,cm); c.position.copy(d).multiplyScalar(.55+R()*.03); inner.add(c); });
  return wrap(inner,.15);
};

B.paramecium = function(){
  var inner=new THREE.Group();
  var geo=displace(new THREE.SphereGeometry(1,48,24),function(v){ v.x*=.5; v.y*=.17; v.z*=.15; v.y+=.05*Math.sin(v.x*5); });
  inner.add(new THREE.Mesh(geo,std(0xa8d8c8,{transparent:true,opacity:.8,roughness:.4})));
  var og=new THREE.Mesh(new THREE.SphereGeometry(1,16,10),std(0x4f7f70)); og.scale.set(.12,.04,.02); og.position.set(.05,-.01,.14); inner.add(og);
  [-.25,.25].forEach(function(x){ var v=new THREE.Mesh(new THREE.SphereGeometry(.04,12,8),std(0xe8fff8,{transparent:true,opacity:.7})); v.position.set(x,.05,.05); inner.add(v); });
  var seg=[], p=geo.attributes.position, nrm=geo.attributes.normal;
  for(var i=0;i<p.count;i+=3){ var x=p.getX(i),y=p.getY(i),z=p.getZ(i); seg.push(x,y,z,x+nrm.getX(i)*.035,y+nrm.getY(i)*.035,z+nrm.getZ(i)*.035); }
  var lg=new THREE.BufferGeometry(); lg.setAttribute('position',new THREE.Float32BufferAttribute(seg,3));
  inner.add(new THREE.LineSegments(lg,new THREE.LineBasicMaterial({color:0xdff5ec,transparent:true,opacity:.5})));
  inner.rotation.y=-.4;
  var g=new THREE.Group(); g.add(inner); g.userData.tick=function(t){ inner.rotation.x=t*.3; inner.position.y=Math.sin(t)*.02; }; return g;
};

B.rice = function(){
  var inner=new THREE.Group();
  var r=new THREE.Mesh(new THREE.SphereGeometry(1,40,24),std(0xf6f2e6,{roughness:.35})); r.scale.set(.5,.2,.16); inner.add(r);
  var n=new THREE.Mesh(new THREE.SphereGeometry(.05,12,8),std(0xe0d2b0)); n.position.set(.46,-.07,0); inner.add(n);
  inner.rotation.z=.15; return wrap(inner,.2);
};

B.coin = function(){
  var face=canvasTex(512,512,function(g,w,h){
    var gr=g.createRadialGradient(w*.4,h*.35,20,w/2,h/2,w/2); gr.addColorStop(0,'#f2f2f0'); gr.addColorStop(1,'#9fa3a8'); g.fillStyle=gr; g.fillRect(0,0,w,h);
    g.strokeStyle='rgba(80,80,90,.55)'; g.lineWidth=8; g.beginPath(); g.arc(w/2,h/2,w*.46,0,7); g.stroke();
    for(var i=0;i<72;i++){ var a=i/72*Math.PI*2; g.fillStyle='rgba(90,90,100,.5)'; g.beginPath(); g.arc(w/2+Math.cos(a)*w*.42,h/2+Math.sin(a)*h*.42,3,0,7); g.fill(); }
    g.fillStyle='rgba(70,72,80,.75)'; g.font='700 150px "Bricolage Grotesque",sans-serif'; g.textAlign='center'; g.textBaseline='middle'; g.fillText('500',w/2,h/2+8);
  });
  var side=canvasTex(512,16,function(g,w,h){ for(var x=0;x<w;x+=4){ g.fillStyle=x%8?'#8a8e94':'#c9ccd0'; g.fillRect(x,0,4,h); } });
  side.wrapS=THREE.RepeatWrapping; side.repeat.x=6;
  var sm=std(0xffffff,{map:side,metalness:.3,roughness:.35}), fm=std(0xffffff,{map:face,metalness:.3,roughness:.35});
  var c=new THREE.Mesh(new THREE.CylinderGeometry(.5,.5,.075,72),[sm,fm,fm]); c.rotation.x=Math.PI/2;
  var inner=new THREE.Group(); inner.add(c); inner.rotation.y=-.5;
  var g=new THREE.Group(); g.add(inner); g.userData.tick=function(t){ inner.rotation.y=-.5+Math.sin(t*.4)*.5; }; return g;
};

B.phone = function(){
  var scr=canvasTex(256,540,function(g,w,h){
    g.fillStyle=vgrad0(g,h,['#2b3a67','#6a4c93','#c06c84']); g.fillRect(0,0,w,h);
    g.fillStyle='#fff'; g.font='600 54px "Bricolage Grotesque",sans-serif'; g.textAlign='center'; g.fillText('10:24',w/2,110);
    var cols=['#ff6b6b','#ffd93d','#6bcb77','#4d96ff','#b983ff','#ff9f45','#2ec4b6','#f15bb5'];
    for(var r=0;r<4;r++) for(var c=0;c<4;c++){ g.fillStyle=cols[(r*4+c)%8]; rr(g,26+c*54,170+r*62,40,40,10); }
    g.fillStyle='rgba(255,255,255,.25)'; rr(g,16,h-80,w-32,62,20);
    for(var d=0;d<4;d++){ g.fillStyle=cols[d*2]; rr(g,30+d*54,h-70,40,40,10); }
  });
  var inner=new THREE.Group();
  inner.add(new THREE.Mesh(new THREE.BoxGeometry(.48,1,.05),std(0x2a2d33,{metalness:.4,roughness:.3})));
  var s=new THREE.Mesh(new THREE.PlaneGeometry(.44,.94),new THREE.MeshBasicMaterial({map:scr})); s.position.z=.026; inner.add(s);
  inner.rotation.y=-.35; inner.rotation.x=-.05;
  var g=new THREE.Group(); g.add(inner); g.userData.tick=function(t){ inner.rotation.y=-.35+Math.sin(t*.4)*.4; }; return g;
};
function vgrad0(g,h,cols){ var gr=g.createLinearGradient(0,0,0,h); cols.forEach(function(c,i){ gr.addColorStop(i/(cols.length-1),c); }); return gr; }
function rr(g,x,y,w,h,r){ g.beginPath(); g.moveTo(x+r,y); g.arcTo(x+w,y,x+w,y+h,r); g.arcTo(x+w,y+h,x,y+h,r); g.arcTo(x,y+h,x,y,r); g.arcTo(x,y,x+w,y,r); g.closePath(); g.fill(); }

B.soccer = function(){
  var tex=canvasTex(1050,680,function(g,w,h){
    for(var i=0;i<14;i++){ g.fillStyle=i%2?'#28552a':'#2f6131'; g.fillRect(i*w/14,0,w/14+1,h); }
    var s=w/105; g.strokeStyle='rgba(255,255,255,.95)'; g.lineWidth=4;
    g.strokeRect(2,2,w-4,h-4); g.beginPath(); g.moveTo(w/2,0); g.lineTo(w/2,h); g.stroke();
    g.beginPath(); g.arc(w/2,h/2,9.15*s,0,7); g.stroke();
    [0,1].forEach(function(side){ var x0=side?w-16.5*s:0, x1=side?w-5.5*s:0;
      g.strokeRect(x0,h/2-20.16*s,16.5*s,40.32*s); g.strokeRect(x1,h/2-9.16*s,5.5*s,18.32*s);
      g.beginPath(); g.arc(side?w-11*s:11*s,h/2,9.15*s,side?Math.PI*.7:-Math.PI*.3,side?Math.PI*1.3:Math.PI*.3); g.stroke(); });
  });
  var inner=new THREE.Group();
  var f=new THREE.Mesh(new THREE.PlaneGeometry(1,.648),new THREE.MeshStandardMaterial({map:tex,roughness:.9,side:THREE.DoubleSide})); inner.add(f);
  var wm=new THREE.LineBasicMaterial({color:0xffffff});
  [-1,1].forEach(function(s){ var x=s*.5, pts=[[x,-.035,0],[x,-.035,.023],[x,.035,.023],[x,.035,0]].map(function(p){ return new THREE.Vector3(p[0],p[1],p[2]); }); inner.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),wm)); });
  inner.rotation.x=-Math.PI/2+.55;
  var g=new THREE.Group(); g.add(inner); g.userData.tick=function(t){ inner.rotation.z=Math.sin(t*.2)*.15; }; return g;
};

B.hallasan = function(){
  var pts=[new THREE.Vector2(1e-4,.93),new THREE.Vector2(.09,.93),new THREE.Vector2(.12,1),new THREE.Vector2(.2,.97)];
  for(var i=1;i<=30;i++){ var t=i/30; pts.push(new THREE.Vector2(.2+t*1.8,.97*Math.pow(1-t,1.7))); }
  var geo=new THREE.LatheGeometry(pts,96).toNonIndexed();
  displace(geo,function(v){ var r=Math.sqrt(v.x*v.x+v.z*v.z); if(r>.25){ var k=1+.05*noise3(v.x*3,1,v.z*3); v.x*=k; v.z*=k; v.y+=.025*noise3(v.x*6,v.y,v.z*6)*(1-v.y); } });
  var p=geo.attributes.position, col=[], c=new THREE.Color();
  for(var j=0;j<p.count;j++){ var y=p.getY(j); if(y>.85) c.set(0x8a7a66); else if(y>.55) c.set(0x6a7a4a).lerp(new THREE.Color(0x8a7a66),(y-.55)/.3); else c.set(0x2f5a32).lerp(new THREE.Color(0x3f6f3a),R()); col.push(c.r,c.g,c.b); }
  geo.setAttribute('color',new THREE.Float32BufferAttribute(col,3));
  var inner=new THREE.Group(); inner.add(new THREE.Mesh(geo,new THREE.MeshStandardMaterial({vertexColors:true,flatShading:true,roughness:.9})));
  var lake=new THREE.Mesh(new THREE.CircleGeometry(.085,32),std(0x3a7fb8,{roughness:.1,metalness:.3})); lake.rotation.x=-Math.PI/2; lake.position.y=.936; inner.add(lake);
  return wrap(inner,.06);
};

B.seoul = function(){
  var sh=new THREE.Shape(), N=90;
  for(var i=0;i<=N;i++){ var a=i/N*Math.PI*2, r=.5*(1+.1*Math.sin(3*a+.5)+.07*Math.cos(5*a)+.04*Math.sin(9*a)), x=Math.cos(a)*r, y=Math.sin(a)*r*.72; if(i) sh.lineTo(x,y); else sh.moveTo(x,y); }
  var inner=new THREE.Group();
  inner.add(new THREE.Mesh(new THREE.ExtrudeGeometry(sh,{depth:.02,bevelEnabled:false}),std(0x5d6a72,{roughness:.9})));
  var river=[]; for(var k=0;k<=20;k++){ var x=-.62+k*.062; river.push(new THREE.Vector3(x,-.03+.07*Math.sin(x*4.2),.021)); }
  var rv=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(river),80,.022,6),std(0x4a8fd0,{roughness:.15,emissive:0x0a2a4a})); rv.scale.z=.3; inner.add(rv);
  [[-.05,.26,.09],[.02,.02,.04],[-.1,-.28,.06],[.28,.25,.05]].forEach(function(m){ var c=new THREE.Mesh(new THREE.ConeGeometry(.07,m[2],16),std(0x3f6f3a,{roughness:.9})); c.rotation.x=Math.PI/2; c.position.set(m[0],m[1],.02+m[2]/2); inner.add(c); });
  var pos=[]; for(var d=0;d<1400;d++){ var a2=R()*Math.PI*2, r2=Math.sqrt(R())*.46; pos.push(Math.cos(a2)*r2,Math.sin(a2)*r2*.7,.025); }
  inner.add(makePoints(pos,0xffd79a,.012,.7));
  inner.rotation.x=-Math.PI/2+.6;
  var g=new THREE.Group(); g.add(inner); g.userData.tick=function(t){ inner.rotation.z=Math.sin(t*.2)*.2; }; return g;
};

B.seoulbusan = function(){
  var g=new THREE.Group(), a=new THREE.Vector3(-.19,.46,0), b=new THREE.Vector3(.19,-.46,0);
  var ga=glow(0xffd79a,.07,1); ga.position.copy(a); var gb=glow(0xffd79a,.06,1); gb.position.copy(b);
  var line=new THREE.Line(new THREE.BufferGeometry().setFromPoints([a,b]),new THREE.LineDashedMaterial({color:0xffffff,dashSize:.025,gapSize:.018,transparent:true,opacity:.75})); line.computeLineDistances();
  var ta=textSprite('서울'); ta.position.set(a.x-.16,a.y+.02,0); var tb=textSprite('부산'); tb.position.set(b.x+.16,b.y-.02,0);
  g.add(ga,gb,line,ta,tb);
  return g;
};

function craterTex(base,dark,light,n){
  return canvasTex(1024,512,function(g,w,h){
    g.fillStyle=base; g.fillRect(0,0,w,h);
    for(var j=0;j<4000;j++){ g.fillStyle='rgba(0,0,0,'+(R()*.12).toFixed(2)+')'; g.fillRect(R()*w,R()*h,2,2); }
    for(var k=0;k<n;k++){ var x=R()*w, y=R()*h, r=2+Math.pow(R(),3)*24; g.fillStyle=dark; g.beginPath(); g.arc(x,y,r,0,7); g.fill(); g.strokeStyle=light; g.lineWidth=Math.max(1,r*.18); g.beginPath(); g.arc(x-r*.12,y-r*.12,r,3.4,5.6); g.stroke(); }
  });
}
B.mercury = function(){ return planet(craterTex('#8c8174','rgba(50,45,40,.45)','rgba(210,200,185,.35)',260)); };
B.mars = function(){
  return planet(canvasTex(1024,512,function(g,w,h){
    g.fillStyle='#c1623a'; g.fillRect(0,0,w,h);
    for(var i=0;i<60;i++){ g.fillStyle='rgba(90,40,25,'+(.1+R()*.25).toFixed(2)+')'; g.beginPath(); g.ellipse(R()*w,h*.25+R()*h*.5,30+R()*120,10+R()*40,R()*3,0,7); g.fill(); }
    g.fillStyle='rgba(120,60,35,.5)'; g.fillRect(0,h*.52,w,6);
    g.fillStyle='#f4f0ec'; g.fillRect(0,0,w,h*.05); g.fillRect(0,h*.96,w,h*.04);
  }));
};
B.neptune = function(){
  return planet(canvasTex(1024,512,function(g,w,h){
    for(var y=0;y<h;y+=4){ var v=Math.sin(y*.05)*12+Math.sin(y*.013)*18; g.fillStyle='rgb('+(50+v|0)+','+(90+v|0)+','+(210+v|0)+')'; g.fillRect(0,y,w,4); }
    g.fillStyle='rgba(20,30,90,.7)'; g.beginPath(); g.ellipse(w*.3,h*.62,50,24,0,0,7); g.fill();
    for(var i=0;i<60;i++){ g.fillStyle='rgba(230,240,255,.25)'; g.beginPath(); g.ellipse(R()*w,h*.2+R()*h*.6,20+R()*50,2,0,0,7); g.fill(); }
  }));
};
B.saturn = function(){
  var pal=['#e8d6a8','#d8c090','#c9aa78','#efe0bc','#bfa070'];
  var g=planet(canvasTex(1024,512,function(c,w,h){ var band=0; for(var y=0;y<h;y++){ if(y%14===0) band=R()*pal.length|0; c.fillStyle=pal[band]; c.fillRect(0,y,w,1); } }));
  var rings=new THREE.Group();
  [[.62,.7,0xa89a80,.35],[.7,.88,0xe0cfaa,.85],[.88,.91,0x000000,0],[.91,1.13,0xcdbb95,.7]].forEach(function(r){
    if(!r[3]) return; rings.add(new THREE.Mesh(new THREE.RingGeometry(r[0],r[1],128),new THREE.MeshBasicMaterial({color:r[2],transparent:true,opacity:r[3],side:THREE.DoubleSide,depthWrite:false})));
  });
  rings.rotation.x=-Math.PI/2+.42; rings.rotation.y=.2; g.add(rings);
  return g;
};
function starBody(c1,c2,g1,g2,s1,s2){ var g=new THREE.Group(), m=new THREE.Mesh(new THREE.SphereGeometry(.5,64,40),starSphere(c1,c2,3000)); g.add(m,glow(g1,s1,.75),glow(g2,s2,.4)); g.userData.tick=function(t){ m.rotation.y=t*.05; }; return g; }
B.sirius = function(){ return starBody('#e6eeff','#a8c4ff',0xcfe0ff,0x8fb4ff,1.3,2.2); };
B.aldebaran = function(){ return starBody('#ffa04a','#e0602a',0xffb070,0xff7a3a,1.3,2.0); };
B.rigel = function(){ return starBody('#d8e6ff','#8fb4ff',0xbfd6ff,0x7fa8ff,1.5,2.6); };

B.orion = function(){
  var lobes=[]; for(var i=0;i<14;i++) lobes.push([gauss()*.16,gauss()*.12,gauss()*.08,.05+R()*.12,R()]);
  var pink=new THREE.Color(0xff7ab0), teal=new THREE.Color(0x6fe0d0), gold=new THREE.Color(0xffc27a);
  var g=new THREE.Group();
  g.add(cloud(10000,function(c){ var L=lobes[R()*lobes.length|0]; c.copy(pink).lerp(L[4]<.5?teal:gold,R()*.8); return [L[0]+gauss()*L[3],L[1]+gauss()*L[3]*.8,L[2]+gauss()*L[3]*.6]; },.014,.55));
  [[0,0],[.02,.015],[-.015,.01],[.01,-.018]].forEach(function(p){ var s=glow(0xe6f0ff,.05,1); s.position.set(p[0],p[1],.05); g.add(s); });
  g.userData.tick=function(t){ g.rotation.y=Math.sin(t*.1)*.3; };
  return g;
};
B.omegacen = function(){
  var g=new THREE.Group();
  g.add(cloud(9000,function(c){ c.set(0xffe8c0).lerp(new THREE.Color(0xbfd6ff),R()*.4); var u=Math.max(.02,R()), r=Math.min(.5,.07/Math.sqrt(Math.pow(u,-2/3)-1+1e-6)); var d=new THREE.Vector3(gauss(),gauss(),gauss()).normalize().multiplyScalar(r); return [d.x,d.y,d.z]; },.01,.7));
  g.add(glow(0xffe8c0,.25,.6));
  return g;
};
B.lmc = function(){
  var g=new THREE.Group(), inner=new THREE.Group();
  inner.add(cloud(3000,function(c){ c.set(0xffe2b0); return [gauss()*.17,gauss()*.03,gauss()*.05]; },.012,.8));
  inner.add(cloud(5500,function(c){ c.set(0xa8c4ff).lerp(new THREE.Color(0xffe2b0),R()*.5); var a=R()*6.28, r=Math.pow(R(),.7)*.45; return [Math.cos(a)*r+.05,gauss()*.02,Math.sin(a)*r*.85]; },.011,.7));
  inner.add(cloud(700,function(c){ c.set(0xff6aa8); return [.2+gauss()*.03,gauss()*.015,.1+gauss()*.03]; },.014,.9));
  inner.rotation.set(1.0,0,.3); g.add(inner);
  g.userData.tick=function(t){ inner.rotation.y=t*.04; };
  return g;
};
B.andromedagal = function(){
  var g=new THREE.Group(), gal=galaxyPoints(16000,.5,2,4,0xffe6b8,0xa8c4ff,.016);
  gal.rotation.set(1.35,0,-.6); g.add(gal, glow(0xffe6b8,.28,.8));
  g.userData.tick=function(t){ gal.rotation.y=t*.03; };
  return g;
};
B.sloan = function(){
  var curve=new THREE.CatmullRomCurve3([[-.5,.02,0],[-.35,.08,.05],[-.2,-.02,-.03],[-.05,.06,.04],[.1,-.04,0],[.25,.05,-.05],[.4,-.01,.03],[.5,.04,0]].map(function(p){ return new THREE.Vector3(p[0],p[1],p[2]); }));
  var g=new THREE.Group();
  g.add(cloud(12000,function(c){ var p=curve.getPoint(R()); c.set(0xbfd6ff).lerp(new THREE.Color(0xffe8c8),R()*.5); return [p.x+gauss()*.02,p.y+gauss()*.035,p.z+gauss()*.04]; },.009,.75));
  g.add(cloud(3000,function(c){ c.set(0x8fa8ff); return [(R()-.5)*1.1,gauss()*.2,gauss()*.2]; },.007,.35));
  g.userData.tick=function(t){ g.rotation.y=Math.sin(t*.1)*.25; };
  return g;
};

export { STAR_TIME, B, R, rng, gauss, clamp, smooth, reduced, makePoints, canvasTex, glow, std, cylBetween, textSprite, displace };
