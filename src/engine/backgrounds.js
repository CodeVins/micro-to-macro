// main.html에서 옮겨 온 코드 (원본 로직 유지)
/* eslint-disable */
import * as THREE from "three";
import { rng, gauss, smooth, clamp } from "./builders.js";

/* 배경색 / 강조색 키프레임 */
export function lerpKeys(keys,e){
  if(e<=keys[0][0]) return new THREE.Color(keys[0][1]);
  for(var i=1;i<keys.length;i++){ if(e<=keys[i][0]){ var t=(e-keys[i-1][0])/(keys[i][0]-keys[i-1][0]); return new THREE.Color(keys[i-1][1]).lerp(new THREE.Color(keys[i][1]),smooth(t)); } }
  return new THREE.Color(keys[keys.length-1][1]);
}
export var BG=[[-35,0x120726],[-16,0x0d0b24],[-9,0x071a22],[-4,0x0b1719],[0,0x0e1422],[5,0x0a1024],[9,0x05060d],[20,0x03030a],[27,0x000000]];
export var DUST=[[-35,0xc79bff],[-14,0xffb38a],[-8,0x8fe6ff],[-3,0xe8d9b8],[0,0xc9d6ea],[7,0xffffff],[27,0xb8c8ff]];
export var ACC=[[-35,0xc79bff],[-12,0xffa27a],[0,0xf1ece4],[12,0x9cc8ff],[27,0xb9a8ff]];

/* ---------- 배경 장면 (규모 구간마다 다른 2D 배경을 그리고, 줌과 함께 교차 전환) ---------- */
var FONT='"IBM Plex Sans KR","Apple SD Gothic Neo","Malgun Gothic",sans-serif';
export var CW=1600, CH=1100;
function glowDot(g,x,y,col,r,a){
  var grd=g.createRadialGradient(x,y,0,x,y,r); grd.addColorStop(0,col); grd.addColorStop(1,'rgba(0,0,0,0)');
  g.globalAlpha=a==null?1:a; g.fillStyle=grd; g.fillRect(x-r,y-r,r*2,r*2); g.globalAlpha=1;
}
function vgrad(g,y0,y1,stops){ var gr=g.createLinearGradient(0,y0,0,y1); stops.forEach(function(s){ gr.addColorStop(s[0],s[1]); }); return gr; }
function stars(g,w,h,r,n,maxA){
  for(var i=0;i<n;i++){ var a=Math.pow(r(),2)*maxA; g.fillStyle='rgba(255,255,255,'+a.toFixed(3)+')'; var s=r()<.03?2.2:1.1; g.fillRect(r()*w,r()*h,s,s); }
}

function paintQuantum(g,w,h){
  var r=rng(3); g.fillStyle='#0b0520'; g.fillRect(0,0,w,h);
  var cols=['rgba(150,90,255,.28)','rgba(90,120,255,.22)','rgba(230,90,200,.2)'];
  for(var i=0;i<14;i++) glowDot(g,r()*w,r()*h,cols[i%3],150+r()*320);
  g.strokeStyle='rgba(190,160,255,.06)'; g.lineWidth=1.5;
  for(var k=0;k<34;k++){ g.beginPath(); var y0=r()*h, amp=10+r()*50, f=.004+r()*.01, ph=r()*6;
    for(var x=0;x<=w;x+=8){ var y=y0+Math.sin(x*f+ph)*amp; if(x===0) g.moveTo(x,y); else g.lineTo(x,y); } g.stroke(); }
}
function paintCell(g,w,h){
  var r=rng(5), grd=g.createRadialGradient(w/2,h/2,50,w/2,h/2,w*.7);
  grd.addColorStop(0,'#0e3a40'); grd.addColorStop(1,'#03110f'); g.fillStyle=grd; g.fillRect(0,0,w,h);
  for(var m=0;m<6;m++){
    var x0=-100, y0=r()*h, cx1=w*.3, cy1=r()*h, cx2=w*.7, cy2=r()*h, y3=r()*h;
    [['rgba(150,230,210,.12)',16],['rgba(3,20,20,.5)',6]].forEach(function(st){ g.strokeStyle=st[0]; g.lineWidth=st[1]; g.beginPath(); g.moveTo(x0,y0); g.bezierCurveTo(cx1,cy1,cx2,cy2,w+100,y3); g.stroke(); });
  }
  var cols=['120,220,200','230,120,180','240,200,120','130,170,255'];
  for(var i=0;i<260;i++){ var c=cols[i%4], x=r()*w, y=r()*h, rr=4+Math.pow(r(),2)*34; glowDot(g,x,y,'rgba('+c+','+(.08+r()*.18).toFixed(2)+')',rr*1.8); }
  for(var j=0;j<1500;j++){ g.fillStyle='rgba(200,255,240,'+(r()*.18).toFixed(2)+')'; g.fillRect(r()*w,r()*h,1.5,1.5); }
}
function paintScope(g,w,h){
  var r=rng(9); g.fillStyle='#020506'; g.fillRect(0,0,w,h);
  var R0=h*.47, grd=g.createRadialGradient(w/2,h/2,0,w/2,h/2,R0);
  grd.addColorStop(0,'#24474f'); grd.addColorStop(.75,'#10282d'); grd.addColorStop(1,'#050d0e');
  g.save(); g.beginPath(); g.arc(w/2,h/2,R0,0,7); g.clip(); g.fillStyle=grd; g.fillRect(0,0,w,h);
  for(var i=0;i<46;i++){ var x=w/2+(r()-.5)*R0*2, y=h/2+(r()-.5)*R0*2, rr=18+r()*80;
    g.fillStyle='rgba(170,220,225,'+(r()*.05).toFixed(3)+')'; g.strokeStyle='rgba(170,220,225,'+(.05+r()*.12).toFixed(2)+')'; g.lineWidth=2;
    g.beginPath(); g.ellipse(x,y,rr,rr*(.7+r()*.3),r()*3,0,7); g.fill(); g.stroke(); }
  g.restore();
  g.strokeStyle='rgba(0,0,0,.9)'; g.lineWidth=60; g.shadowColor='#000'; g.shadowBlur=60; g.beginPath(); g.arc(w/2,h/2,R0+28,0,7); g.stroke(); g.shadowBlur=0;
}
function paintPavement(g,w,h){
  var r=rng(13), gy=h*.62;
  g.fillStyle=vgrad(g,0,gy,[[0,'#16131a'],[1,'#3b322c']]); g.fillRect(0,0,w,gy);
  for(var i=0;i<46;i++) glowDot(g,r()*w,r()*gy*.95,r()<.75?'rgba(255,205,140,.22)':'rgba(140,210,255,.18)',30+r()*110);
  var y=gy, rh=7, row=0;
  while(y<h){
    var bw=rh*2.3, off=(row%2)*bw/2;
    for(var x=-bw+off;x<w;x+=bw){
      var v=100+r()*38|0; g.fillStyle='rgb('+(v+14)+','+(v+2)+','+(v-6)+')'; g.fillRect(x,y,bw,rh);
      for(var s=0;s<rh*1.5;s++){ g.fillStyle='rgba('+(r()<.5?'40,30,26':'200,190,180')+','+(r()*.25).toFixed(2)+')'; g.fillRect(x+r()*bw,y+r()*rh,1+rh*.02,1+rh*.02); }
    }
    g.fillStyle='rgba(22,17,15,.85)'; g.fillRect(0,y,w,Math.max(1,rh*.07));
    for(var x2=-bw+off;x2<w;x2+=bw) g.fillRect(x2,y,Math.max(1,rh*.07),rh);
    y+=rh; rh*=1.16; row++;
  }
  g.fillStyle=vgrad(g,gy-6,gy+50,[[0,'rgba(59,50,44,1)'],[1,'rgba(59,50,44,0)']]); g.fillRect(0,gy-6,w,56);
}
function paintStreet(g,w,h){
  var r=rng(21), gy=h*.66;
  g.fillStyle=vgrad(g,0,gy,[[0,'#161c3a'],[.45,'#3f3f6e'],[.78,'#b8747a'],[1,'#f0a878']]); g.fillRect(0,0,w,gy);
  var hy=gy-150, tx=w*.52, ty=hy-20;
  g.fillStyle='#2b2d4c'; g.beginPath(); g.moveTo(w*.3,gy); g.lineTo(w*.3,hy+80); g.quadraticCurveTo(w*.52,hy-110,w*.76,hy+60); g.lineTo(w*.76,gy); g.fill();
  g.fillStyle='#23253f'; g.fillRect(tx-5,ty-130,10,132); g.beginPath(); g.ellipse(tx,ty-134,22,9,0,0,7); g.fill(); g.fillRect(tx-13,ty-152,26,16); g.fillRect(tx-2,ty-222,4,72);
  for(var d=0;d<7;d++) glowDot(g,tx-16+d*5.3,ty-136,'rgba(255,220,160,.9)',4);
  glowDot(g,tx,ty-222,'rgba(255,90,90,.95)',12);
  for(var i=0;i<18;i++){
    var bw=70+r()*70, bh=140+r()*170, x=r()*w, y=gy-40-bh;
    if(Math.abs(x+bw/2-tx)<110) continue;
    g.fillStyle='#34365a'; g.fillRect(x,y,bw,bh+40);
    for(var wy=y+26;wy<gy-44;wy+=15) for(var wx=x+6;wx<x+bw-8;wx+=12) if(r()<.35){ g.fillStyle='rgba(255,215,154,'+(.3+r()*.5).toFixed(2)+')'; g.fillRect(wx,wy,5,6); }
    if(r()<.6){ g.fillStyle='rgba(225,225,255,.45)'; g.font='600 15px '+FONT; g.fillText((101+i)+'동',x+6,y+18); }
  }
  var shops=[['편의점','#1f6fd1'],['분식','#d8452f'],['세탁소','#2c9a6b'],['카페','#6b4a2e'],['약국','#2a8a3c'],['부동산','#b8862c'],['치킨','#e0782a']], si=0;
  function villa(x,bw,bh){
    var y=gy-bh, tone=['#584b5c','#66564f','#4f4a5a','#6a5b60'][r()*4|0];
    g.fillStyle=tone; g.fillRect(x,y,bw,bh); g.fillStyle='rgba(0,0,0,.25)'; g.fillRect(x,y,bw,10);
    for(var fy=y+30;fy<gy-120;fy+=74){
      [x+bw*.18,x+bw*.58].forEach(function(wx){
        var lit=r()<.45; g.fillStyle=lit?'#ffcf86':'#262738'; g.fillRect(wx,fy,bw*.26,36);
        if(lit) glowDot(g,wx+bw*.13,fy+18,'rgba(255,200,120,.25)',50);
        g.fillStyle='rgba(30,28,36,.8)'; for(var b=0;b<5;b++) g.fillRect(wx+b*bw*.26/5,fy,2,36);
      });
    }
    var sh=shops[si++%shops.length];
    g.fillStyle='#fff1c8'; g.globalAlpha=.9; g.fillRect(x+10,gy-64,bw-20,60); g.globalAlpha=1;
    glowDot(g,x+bw/2,gy-30,'rgba(255,230,170,.35)',bw*.7);
    g.fillStyle=sh[1]; g.fillRect(x+6,gy-100,bw-12,32);
    g.fillStyle='#fff'; g.font='600 21px '+FONT; g.textAlign='center'; g.fillText(sh[0],x+bw/2,gy-77); g.textAlign='left';
  }
  var x=-30; while(x<w*.34){ var bw=190+r()*60; villa(x,bw,300+r()*130); x+=bw+6; }
  x=w*.66; while(x<w){ var bw2=190+r()*60; villa(x,bw2,300+r()*130); x+=bw2+6; }
  var poles=[w*.08,w*.38,w*.62,w*.93];
  poles.forEach(function(px){ g.fillStyle='#1b1a22'; g.fillRect(px-7,gy-470,14,480); g.fillRect(px-42,gy-440,84,6); g.fillRect(px-32,gy-402,64,5); g.fillRect(px-12,gy-385,24,34); });
  g.strokeStyle='rgba(18,17,26,.9)'; g.lineWidth=1.6;
  for(var p=0;p<poles.length-1;p++) for(var k=0;k<6;k++){
    var y1=gy-440+k*7, y2=gy-438+k*6, sag=25+r()*60;
    g.beginPath(); g.moveTo(poles[p]+(k-3)*12,y1); g.quadraticCurveTo((poles[p]+poles[p+1])/2,y1+sag,poles[p+1]+(k-3)*12,y2); g.stroke();
  }
  [poles[1],poles[2]].forEach(function(px,i){ var lx=px+(i?-46:46); g.fillStyle='#1b1a22'; g.fillRect(Math.min(px,lx),gy-336,46,4); glowDot(g,lx,gy-326,'rgba(255,220,160,.5)',110); });
  g.fillStyle='#5d5a62'; g.fillRect(0,gy,w,70);
  g.strokeStyle='rgba(0,0,0,.25)'; g.lineWidth=1.2;
  for(var ry=0;ry<2;ry++){ g.beginPath(); g.moveTo(0,gy+ry*35); g.lineTo(w,gy+ry*35); g.stroke(); for(var bx=(ry%2)*18;bx<w;bx+=36){ g.beginPath(); g.moveTo(bx,gy+ry*35); g.lineTo(bx,gy+ry*35+35); g.stroke(); } }
  g.fillStyle='#8a8790'; g.fillRect(0,gy+70,w,10);
  g.fillStyle=vgrad(g,gy+80,h,[[0,'#2f2e36'],[1,'#17161b']]); g.fillRect(0,gy+80,w,h-gy-80);
  g.fillStyle='rgba(235,235,240,.7)'; for(var cx=w*.18;cx<w*.82;cx+=74) g.fillRect(cx,gy+130,40,130);
  g.fillStyle='rgba(240,200,60,.7)'; g.fillRect(0,gy+300,w,5);
}
function paintRiver(g,w,h){
  var r=rng(34), hb=h*.5, gy=h*.7;
  g.fillStyle=vgrad(g,0,hb,[[0,'#050818'],[.7,'#141a3c'],[1,'#2d2653']]); g.fillRect(0,0,w,hb);
  stars(g,w,hb*.7,r,160,.5);
  var tx=w*.17; g.fillStyle='#101327'; g.beginPath(); g.moveTo(w*.02,hb); g.quadraticCurveTo(tx,hb-150,w*.34,hb); g.fill();
  g.fillRect(tx-4,hb-190,8,110); g.beginPath(); g.ellipse(tx,hb-192,16,7,0,0,7); g.fill(); g.fillRect(tx-2,hb-250,4,58);
  glowDot(g,tx,hb-250,'rgba(255,90,90,.9)',10); for(var d=0;d<5;d++) glowDot(g,tx-10+d*5,hb-192,'rgba(255,220,160,.9)',4);
  var lights=[];
  for(var x=0;x<w;){ var bw=24+r()*56, bh=30+Math.pow(r(),1.6)*170; if(x>w*.6&&x<w*.7) bh*=.6;
    g.fillStyle=r()<.5?'#0c0f22':'#11142b'; g.fillRect(x,hb-bh,bw,bh);
    for(var wy=hb-bh+6;wy<hb-4;wy+=8) for(var wx=x+3;wx<x+bw-3;wx+=6) if(r()<.3){ var c=r()<.75?'255,214,150':'170,210,255'; g.fillStyle='rgba('+c+','+(.3+r()*.6).toFixed(2)+')'; g.fillRect(wx,wy,2.5,3); if(r()<.08) lights.push([wx,c]); }
    x+=bw+r()*4; }
  var sx=w*.65; g.fillStyle='#0f1229'; g.beginPath(); g.moveTo(sx-34,hb); g.lineTo(sx-6,hb-340); g.lineTo(sx+6,hb-340); g.lineTo(sx+34,hb); g.fill();
  g.strokeStyle='rgba(158,197,255,.55)'; g.lineWidth=2; g.beginPath(); g.moveTo(sx,hb); g.lineTo(sx,hb-340); g.stroke();
  glowDot(g,sx,hb-346,'rgba(255,90,90,.9)',12); lights.push([sx,'158,197,255']);
  g.fillStyle=vgrad(g,hb,gy,[[0,'#0b1430'],[1,'#060a1c']]); g.fillRect(0,hb,w,gy-hb);
  lights.forEach(function(L){ var len=40+r()*140, grd=g.createLinearGradient(0,hb,0,hb+len); grd.addColorStop(0,'rgba('+L[1]+',.35)'); grd.addColorStop(1,'rgba('+L[1]+',0)'); g.fillStyle=grd; g.fillRect(L[0]-1.5,hb+2,3+r()*3,len); });
  var by=hb+44; g.fillStyle='#161a33'; g.fillRect(0,by,w,9);
  for(var px=40;px<w;px+=190){ g.fillRect(px-7,by+9,14,50); }
  var bc=['255,122,182','122,217,255','255,224,122'];
  for(var lx=0;lx<w;lx+=16){ var c2=bc[(lx/16|0)%3]; glowDot(g,lx,by+3,'rgba('+c2+',.9)',6); g.fillStyle='rgba('+c2+',.12)'; g.fillRect(lx-1,by+60,2,40+r()*50); }
  g.fillStyle=vgrad(g,gy,h,[[0,'#16241b'],[1,'#080e0a']]); g.fillRect(0,gy,w,h-gy);
  g.fillStyle='#2a2d36'; g.fillRect(0,gy+70,w,56);
  for(var lp2=120;lp2<w;lp2+=330){ g.fillStyle='#0d0f14'; g.fillRect(lp2-3,gy-10,6,84); glowDot(g,lp2,gy-12,'rgba(255,225,170,.55)',70); }
}
function paintClouds(g,w,h){
  var r=rng(55), gy=h*.68;
  g.fillStyle=vgrad(g,0,gy+40,[[0,'#0a1636'],[.5,'#2a3f78'],[.86,'#c98a7a'],[1,'#f2b98a']]); g.fillRect(0,0,w,gy+40);
  stars(g,w,h*.3,r,120,.35);
  [['#5a5f8e',gy-30,190],['#6f6f9c',gy-5,120],['#8986ad',gy+15,70]].forEach(function(L){
    var pts=[[-20,L[1]]], x=-20;
    while(x<w+40){ x+=18+r()*40; pts.push([x,L[1]-Math.pow(r(),1.4)*L[2]]); }
    g.fillStyle=L[0]; g.beginPath(); g.moveTo(-20,gy+80); pts.forEach(function(p){ g.lineTo(p[0],p[1]); }); g.lineTo(w+40,gy+80); g.fill();
    g.strokeStyle='rgba(240,238,248,.55)'; g.lineWidth=2; g.beginPath(); pts.forEach(function(p,i){ if(i) g.lineTo(p[0],p[1]); else g.moveTo(p[0],p[1]); }); g.stroke();
  });
  g.fillStyle=vgrad(g,gy,h,[[0,'#8e8fb5'],[1,'#4a4d78']]); g.fillRect(0,gy+20,w,h-gy-20);
  for(var i=0;i<420;i++){ var y=gy-10+Math.pow(r(),1.3)*(h-gy), top=y<gy+60;
    g.fillStyle=top?'rgba(245,214,200,'+(.08+r()*.18).toFixed(2)+')':'rgba(200,200,230,'+(.05+r()*.12).toFixed(2)+')';
    g.beginPath(); g.ellipse(r()*w,y,40+r()*130,14+r()*40,0,0,7); g.fill(); }
}
function paintOrbit(g,w,h){
  var r=rng(71); g.fillStyle='#02030a'; g.fillRect(0,0,w,h); stars(g,w,h,r,1400,.8);
  var cx=w*.5, cy=h*1.6, R0=h*1.05;
  for(var i=10;i>0;i--){ g.strokeStyle='rgba(95,168,255,'+(.05*(11-i)/10).toFixed(3)+')'; g.lineWidth=i*5; g.beginPath(); g.arc(cx,cy,R0+i*2,0,7); g.stroke(); }
  var grd=g.createRadialGradient(cx,cy-R0*.6,R0*.2,cx,cy,R0); grd.addColorStop(0,'#081326'); grd.addColorStop(1,'#0d2344');
  g.fillStyle=grd; g.beginPath(); g.arc(cx,cy,R0,0,7); g.fill();
  for(var k=0;k<900;k++){ var a=-Math.PI/2+(r()-.5)*1.3, d=R0-8-Math.pow(r(),.6)*220; g.fillStyle='rgba(255,200,120,'+(r()*.5).toFixed(2)+')'; g.fillRect(cx+Math.cos(a)*d,cy+Math.sin(a)*d,1.6,1.6); }
  g.strokeStyle='rgba(140,200,255,.9)'; g.lineWidth=2; g.beginPath(); g.arc(cx,cy,R0,Math.PI*1.1,Math.PI*1.9); g.stroke();
  glowDot(g,w*.12,cy-R0*.83,'rgba(255,220,170,.5)',160);
}
function paintStars(g,w,h){
  var r=rng(88); g.fillStyle='#010208'; g.fillRect(0,0,w,h); stars(g,w,h,r,2600,.9);
  for(var i=0;i<14;i++) glowDot(g,w*i/13,h*(.82-.62*i/13)+(r()-.5)*80,['rgba(120,90,200,.08)','rgba(80,140,220,.07)','rgba(220,120,120,.05)'][i%3],180+r()*140);
  for(var k=0;k<5000;k++){ var t=r(), off=gauss()*70; g.fillStyle='rgba(230,230,255,'+(r()*.25).toFixed(2)+')'; g.fillRect(w*t+off*.6,h*(.82-.62*t)+off,1,1); }
}
function paintDeep(g,w,h){
  var r=rng(99); g.fillStyle='#000'; g.fillRect(0,0,w,h); stars(g,w,h,r,500,.5);
  for(var i=0;i<360;i++){ var c=r()<.6?'255,215,170':'170,200,255', s=1.5+Math.pow(r(),3)*9;
    g.fillStyle='rgba('+c+','+(.15+r()*.35).toFixed(2)+')'; g.beginPath(); g.ellipse(r()*w,r()*h,s,s*(.3+r()*.7),r()*3,0,7); g.fill(); }
}

/* ground: 배경 속 땅의 높이(비율). null이면 땅 없이 화면 중앙에 맞춤. dust: 흐르는 입자 세기 */
export var CHAPTERS=[
  {id:'quantum', from:-40,  to:-11.5, anchor:-14, ground:null, dust:1,   paint:paintQuantum},
  {id:'cell',    from:-11.5,to:-7.8,  anchor:-9,  ground:null, dust:.8,  paint:paintCell},
  {id:'scope',   from:-7.8, to:-3.8,  anchor:-5.5,ground:null, dust:.5,  paint:paintScope},
  {id:'pavement',from:-3.8, to:-1.35,  anchor:-2.6,ground:.62,  dust:.3,  paint:paintPavement},
  {id:'street',  from:-1.35,to:1.25,   anchor:.2,  ground:.66,  dust:.12, paint:paintStreet},
  {id:'river',   from:1.25, to:3.05,   anchor:2.2,   ground:.7,   dust:.12, paint:paintRiver},
  {id:'clouds',  from:3.05,  to:5.3,   anchor:4,   ground:.68,  dust:.25, paint:paintClouds},
  {id:'orbit',   from:5.3,  to:6.9,   anchor:6.2, ground:null, dust:.7,  paint:paintOrbit},
  {id:'stars',   from:6.9,  to:18,    anchor:12,  ground:null, dust:1,   paint:paintStars},
  {id:'deep',    from:18,   to:40,    anchor:23,  ground:null, dust:1,   paint:paintDeep}
];
