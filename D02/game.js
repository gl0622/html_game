
"use strict";
(function(){
var NSVG="http://www.w3.org/2000/svg";
var VIEW_W=960,VIEW_H=540,WORLD_W=7200,GOAL_X=6100,GY=470;
var GRAV=2300,MOVE=330,JUMP_V=-800,DJ_V=-720,DASH_SPD=820,DASH_T=.16,DASH_CD=.9,BSPD=640;

var AudioFX=(function(){
 var ctx=null,enabled=true,masterGain=null;
 function ensure(){if(!ctx){ctx=new (window.AudioContext||window.webkitAudioContext)();masterGain=ctx.createGain();masterGain.gain.value=.35;masterGain.connect(ctx.destination);}}
 function tone(freq,type,dur,vol,slide){ensure();if(!enabled)return;var o=ctx.createOscillator(),g=ctx.createGain();o.type=type;o.frequency.value=freq;if(slide){o.frequency.exponentialRampToValueAtTime(freq*slide,ctx.currentTime+dur);}g.gain.value=vol;g.gain.exponentialRampToValueAtTime(.0001,ctx.currentTime+dur);o.connect(g);g.connect(masterGain);o.start();o.stop(ctx.currentTime+dur);}
 function noise(dur,vol,filter){ensure();if(!enabled)return;var buf=ctx.createBuffer(1,ctx.sampleRate*dur,ctx.sampleRate),d=buf.getChannelData(0);for(var i=0;i<d.length;i++)d[i]=Math.random()*2-1;var src=ctx.createBufferSource(),g=ctx.createGain(),f=ctx.createBiquadFilter();src.buffer=buf;f.type=filter||"lowpass";f.frequency.value=2000;f.Q.value=1;g.gain.value=vol;g.gain.exponentialRampToValueAtTime(.0001,ctx.currentTime+dur);src.connect(f);f.connect(g);g.connect(masterGain);src.start();src.stop(ctx.currentTime+dur);}
 return{
  jump:function(){tone(420,"square",.09,.12,.6);tone(280,"sine",.06,.06,1.3);},
  doubleJump:function(){tone(560,"square",.07,.1,.55);tone(380,"sine",.05,.05,1.4);},
  dash:function(){tone(180,"sawtooth",.04,.15,.3);noise(.07,.06,"highpass");},
  shoot:function(){tone(880,"square",.04,.08,.45);tone(1400,"sine",.03,.04,1.8);},
  hit:function(){tone(160,"sawtooth",.1,.18,.25);noise(.08,.1,"bandpass");},
  enemyHit:function(){tone(320,"square",.06,.1,.4);},
  enemyKill:function(){tone(220,"triangle",.12,.15,.5);tone(120,"sine",.08,.08,.4);},
  bossHit:function(){tone(110,"sawtooth",.15,.2,.35);noise(.1,.08,"lowpass");},
  bossDeath:function(){for(var i=0;i<6;i++)setTimeout(function(o){tone(90+o*40,"triangle",.35,.12,.6);},i*60);noise(.8,.12,"lowpass");},
  pickupGem:function(){tone(1040,"sine",.08,.1,1.6);tone(1320,"sine",.06,.06,1.8);},
  pickupHeart:function(){tone(520,"sine",.12,.14,1.5);tone(780,"sine",.08,.08,1.7);},
  pickupPower:function(){tone(660,"triangle",.1,.12,1.4);tone(990,"sine",.07,.07,1.9);},
  gameOver:function(){tone(200,"sawtooth",.4,.18,.3);tone(100,"sawtooth",.6,.1,.25);},
  victory:function(){[660,880,990,1320,1520].forEach(function(f,i){setTimeout(function(){tone(f,"sine",.3,.12,1);},i*110);});noise(.3,.04,"lowpass");},
  land:function(){tone(140,"sine",.05,.08,1.2);},
  setEnabled:function(v){enabled=v;if(ctx&&ctx.state==="suspended")ctx.resume();}
 };
})();

function el(tag,attrs,parent){var n=document.createElementNS(NSVG,tag);if(attrs)for(var k in attrs)n.setAttribute(k,attrs[k]);if(parent)parent.appendChild(n);return n;}
function clamp(v,a,b){return v<a?a:(v>b?b:v);}
function rnd(a,b){return a+Math.random()*(b-a);}
function pick(arr){return arr[Math.floor(Math.random()*arr.length)];}
function aabb(a,b){return a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;}

var $=function(id){return document.getElementById(id);};
var svg=$("game"),sky=$("sky"),far=$("layerFar"),mid=$("layerMid");
var world=$("world"),gPlat=$("gPlat"),gItems=$("gItems"),gEnemies=$("gEnemies"),gBullets=$("gBullets"),gBoss=$("gBoss"),gPlayer=$("gPlayer"),gFx=$("gFx");
var ovMenu=$("ovMenu"),ovPause=$("ovPause"),ovOver=$("ovOver"),ovWin=$("ovWin");

var SEGS=[[0,1250],[1390,1080],[2630,1300],[4110,1150],[5440,1760]];
var FLOATS=[[1265,380,110],[2495,390,110],[3945,400,80],[4040,350,80],[5285,385,130],
[700,360,120],[950,300,110],[1700,370,130],[1950,310,120],[2200,370,130],
[2900,360,120],[3150,300,120],[3400,365,130],[4300,370,120],[4560,315,110],
[4800,370,120],[5700,360,120],[5950,305,120]];
var PLATS=[];
var G={
 state:"MENU",prev:"MENU",score:0,time:0,camX:0,shakeT:0,
 keys:{},jumpQ:false,dashQ:false,bossOn:false,winT:-1,fadeT:0
};
var player=null,enemies=[],bullets=[],items=[],parts=[],boss=null;

function buildSky(){
 el("rect",{x:0,y:0,width:VIEW_W,height:VIEW_H,fill:"url(#skyGrad)"},sky);
 for(var i=0;i<70;i++){el("circle",{cx:rnd(0,VIEW_W),cy:rnd(0,300),r:rnd(.5,1.6),fill:"#cfe6ff",opacity:rnd(.25,.9)},sky);}
 var sun=el("circle",{cx:730,cy:300,r:110,fill:"url(#sunGrad)"},sky);
 for(var s=0;s<5;s++){el("rect",{x:730-120,y:300+8+s*16,width:240,height:5+s*1.5,fill:"#2a1a52",opacity:.9},sky);}
}
function buildFar(){
 var x=-120;
 while(x<2900){
  var w=rnd(180,340),h=rnd(110,250);
  el("polygon",{points:x+",510 "+(x+w/2)+","+(510-h)+" "+(x+w)+",510",fill:"#161d40"},far);
  x+=w*rnd(.72,.92);
 }
}
function buildMid(){
 var x=-80;
 while(x<4800){
  var w=rnd(60,150),h=rnd(120,320);
  el("rect",{x:x,y:512-h,width:w,height:h,fill:"#1d2549"},mid);
  if(Math.random()<.5)el("line",{x1:x+w/2,y1:512-h,x2:x+w/2,y2:512-h-rnd(14,40),stroke:"#1d2549","stroke-width":3},mid);
  var cols=Math.floor(w/20),rows=Math.floor(h/30);
  for(var c=0;c<cols;c++)for(var r=0;r<rows;r++){
   if(Math.random()<.3)el("rect",{x:x+6+c*20,y:512-h+8+r*30,width:5,height:8,fill:pick(["#39d7ff","#ff4fa3","#ffd23f"]),opacity:.75},mid);
  }
  x+=w+rnd(14,50);
 }
}
function buildPlats(){
 PLATS.length=0;
 SEGS.forEach(function(s){
  var p={x:s[0],y:GY,w:s[1],h:90,ground:true};
  PLATS.push(p);
  el("rect",{x:p.x,y:p.y,width:p.w,height:p.h,fill:"url(#groundGrad)"},gPlat);
  el("rect",{x:p.x,y:p.y,width:p.w,height:4,fill:"#3fe0ff",opacity:.85},gPlat);
  for(var gx=p.x+18;gx<p.x+p.w-14;gx+=rnd(60,120)){
   el("rect",{x:gx,y:p.y+14,width:rnd(18,42),height:3,rx:1.5,fill:"#3a477e"},gPlat);
  }
 });
 FLOATS.forEach(function(f){
  var p={x:f[0],y:f[1],w:f[2],h:16,ground:false};
  PLATS.push(p);
  el("rect",{x:p.x,y:p.y,width:p.w,height:p.h,rx:6,fill:"#26315e",stroke:"#3fe0ff","stroke-width":1.4},gPlat);
  el("rect",{x:p.x+8,y:p.y+p.h+4,width:p.w-16,height:2.5,fill:"#3fe0ff",opacity:.35},gPlat);
 });
}
function segBoundsFor(x){
 for(var i=0;i<SEGS.length;i++){var s=SEGS[i];if(x>=s[0]&&x<=s[0]+s[1])return[s[0]+30,s[0]+s[1]-30];}
 return[x-120,x+120];
}

function makePlayerNode(){
 var g=el("g",null,gPlayer);
 var flip=el("g",null,g);
 el("polygon",{points:"-4,10 -30,16 -4,22",fill:"#ff2e88",opacity:.9},flip);
 el("circle",{cx:19,cy:9,r:8,fill:"#e8f4ff",stroke:"#22335f","stroke-width":1.5},flip);
 el("rect",{x:16,y:6,width:10,height:4,rx:2,fill:"#12244a"},flip);
 var body=el("rect",{x:4,y:15,width:22,height:18,rx:5,fill:"#29e6ff",stroke:"#0e5f78","stroke-width":1.5},flip);
 el("rect",{x:9,y:20,width:12,height:4,rx:2,fill:"#0e5f78"},flip);
 var gun=el("rect",{x:22,y:20,width:12,height:6,rx:2,fill:"#22335f"},flip);
 var muzzle=el("circle",{cx:36,cy:23,r:5,fill:"#ffe95c",opacity:0},flip);
 var legL=el("rect",{x:7,y:33,width:6,height:13,rx:2.5,fill:"#22335f"},flip);
 var legR=el("rect",{x:17,y:33,width:6,height:13,rx:2.5,fill:"#22335f"},flip);
 return{node:g,flip:flip,legL:legL,legR:legR,muzzle:muzzle,gun:gun,body:body};
}
function resetPlayer(){
 clearGroup(gPlayer);
 var v=makePlayerNode();
 player={x:120,y:GY-46-60,w:30,h:46,vx:0,vy:0,facing:1,hp:100,maxHp:100,
  grounded:false,jumpsUsed:0,coyote:0,invuln:0,dashT:0,dashCd:0,power:1,fireCd:0,
  mzT:0,lastSafeX:120,plat:null,animT:0,maxFall:1100,
  node:v.node,flip:v.flip,legL:v.legL,legR:v.legR,muzzle:v.muzzle};
}

function makeWalker(x){
 var g=el("g",null,gEnemies);
 el("rect",{x:0,y:8,width:42,height:28,rx:7,fill:"#ff5a3c",stroke:"#5f1408","stroke-width":1.5},g);
 el("rect",{x:6,y:14,width:30,height:6,rx:3,fill:"#ffd23f"},g);
 var l1=el("rect",{x:8,y:36,width:7,height:12,rx:3,fill:"#5f1408"},g);
 var l2=el("rect",{x:27,y:36,width:7,height:12,rx:3,fill:"#5f1408"},g);
 var b=segBoundsFor(x);
 enemies.push({type:"walker",x:x,y:GY-48,w:42,h:48,vx:70,dir:1,x0:b[0],x1:b[1],hp:3,maxHp:3,val:100,t:rnd(0,6),legs:[l1,l2],node:g});
}
function makeDrone(x,y){
 var g=el("g",null,gEnemies);
 var rotor=el("rect",{x:-6,y:-4,width:52,height:3,rx:1.5,fill:"#8fa2ff"},g);
 el("ellipse",{cx:20,cy:10,rx:20,ry:12,fill:"#b44cff",stroke:"#3c1466","stroke-width":1.5},g);
 el("circle",{cx:30,cy:10,r:4,fill:"#ff4b5c"},g);
 enemies.push({type:"drone",x:x,y:y,w:40,h:24,vx:60,dir:1,x0:x-140,x1:x+140,y0:y,t:rnd(0,6),rotor:rotor,hp:2,maxHp:2,val:150,node:g});
}
function makeTurret(x){
 var g=el("g",null,gEnemies);
 el("path",{d:"M2 44 L8 20 L44 20 L50 44 Z",fill:"#3a477e",stroke:"#101736","stroke-width":1.5},g);
 el("circle",{cx:26,cy:18,r:11,fill:"#57d7ff",stroke:"#101736","stroke-width":1.5},g);
 var bar=el("rect",{x:24,y:4,width:8,height:14,rx:2,fill:"#101736"},g);
 enemies.push({type:"turret",x:x,y:GY-46,w:52,h:46,vx:0,dir:-1,ft:rnd(1,2.2),barrel:bar,hp:4,maxHp:4,val:200,t:0,node:g});
}
function makeItem(kind,x,y){
 var g=el("g",null,gItems);
 if(kind==="gem")el("polygon",{points:"0,-11 9,0 0,11 -9,0",fill:"#3fe0ff",stroke:"#0e5f78","stroke-width":1.5},g);
 else if(kind==="heart")el("path",{d:"M0 8 C -12 -2 -8 -12 0 -5 C 8 -12 12 -2 0 8 Z",fill:"#ff4fa3",stroke:"#5f0837","stroke-width":1.5},g);
 else el("polygon",{points:"0,-12 3.5,-4 12,-4 5.5,1.5 8,10 0,5 -8,10 -5.5,1.5 -12,-4 -3.5,-4",fill:"#ffd23f",stroke:"#7a5a00","stroke-width":1.2},g);
 items.push({kind:kind,x:x-14,y:y-14,w:28,h:28,t:rnd(0,6),taken:false,node:g});
}
var ITEM_DEFS=[
 ["gem",760,320],["gem",990,262],["power",1980,272],["gem",1760,332],["gem",2260,332],
 ["heart",2690,428],["gem",2960,322],["gem",3210,262],["heart",3430,327],["gem",3660,430],
 ["power",4590,277],["gem",4360,332],["gem",4860,332],["heart",4830,430],["gem",5760,322],
 ["gem",6010,267],["heart",6520,428]
];
var ENEMY_DEFS=[];
[[520,900],[1620,2120],[2760,3230],[3650],[4230,4720,5120],[5600,5920]].forEach(function(g){
 g.forEach(function(x){ENEMY_DEFS.push(["walker",x]);});
});
[[760,300],[1470,280],[2320,300],[3060,270],[3560,300],[4420,280],[4970,300],[5770,270]].forEach(function(d){
 ENEMY_DEFS.push(["drone",d[0],d[1]]);
});
[2870,3790,4650,5570,6060].forEach(function(x){ENEMY_DEFS.push(["turret",x]);});

function clearGroup(gr){while(gr.firstChild)gr.removeChild(gr.firstChild);}
function resetEntities(){
 clearGroup(gEnemies);clearGroup(gItems);clearGroup(gBullets);clearGroup(gFx);clearGroup(gBoss);
 enemies=[];bullets=[];items=[];parts=[];
 ENEMY_DEFS.forEach(function(d){
  if(d[0]==="walker")makeWalker(d[1]);
  else if(d[0]==="drone")makeDrone(d[1],d[2]);
  else makeTurret(d[1]);
 });
 ITEM_DEFS.forEach(function(d){makeItem(d[0],d[1],d[2]);});
 boss={x:6640,y:GY-152,w:132,h:152,vx:0,vy:0,hp:46,maxHp:46,active:false,dead:false,
  volT:2.2,leapT:5.5,t:0,deadT:0,grounded:false,maxFall:1300,node:null,legs:[],face:-1};
 buildBossNode();
 $("bossBar").setAttribute("visibility","hidden");
}
function buildBossNode(){
 var g=el("g",null,gBoss);
 el("rect",{x:14,y:30,width:104,height:80,rx:12,fill:"#7b2bd6",stroke:"#2a0a4d","stroke-width":2.5},g);
 el("path",{d:"M30 30 Q66 -8 102 30 Z",fill:"#9b4dff",stroke:"#2a0a4d","stroke-width":2.5},g);
 el("circle",{cx:66,cy:18,r:9,fill:"#ff2e88"},g);
 el("rect",{x:34,y:52,width:64,height:14,rx:4,fill:"#2a0a4d"},g);
 el("circle",{cx:44,cy:59,r:4,fill:"#ffd23f"},g);
 el("circle",{cx:66,cy:59,r:4,fill:"#ffd23f"},g);
 el("circle",{cx:88,cy:59,r:4,fill:"#ff4b5c"},g);
 el("rect",{x:-8,y:36,width:22,height:16,rx:5,fill:"#5a1aa6",stroke:"#2a0a4d","stroke-width":2},g);
 el("rect",{x:118,y:36,width:22,height:16,rx:5,fill:"#5a1aa6",stroke:"#2a0a4d","stroke-width":2},g);
 var l1=el("rect",{x:30,y:108,width:20,height:44,rx:6,fill:"#3c1466",stroke:"#2a0a4d","stroke-width":2},g);
 var l2=el("rect",{x:82,y:108,width:20,height:44,rx:6,fill:"#3c1466",stroke:"#2a0a4d","stroke-width":2},g);
 el("rect",{x:18,y:148,width:44,height:8,rx:4,fill:"#2a0a4d"},g);
 el("rect",{x:70,y:148,width:44,height:8,rx:4,fill:"#2a0a4d"},g);
 boss.node=g;boss.legs=[l1,l2];
}

function makeBulletNode(isEnemy){
 var g=el("g",null,gBullets);
 if(isEnemy){el("circle",{cx:0,cy:0,r:8,fill:"#ff2e88",opacity:.35},g);el("circle",{cx:0,cy:0,r:4.5,fill:"#ff7ba9"},g);}
 else{el("rect",{x:-3,y:-4,width:22,height:8,rx:4,fill:"#3fe0ff",opacity:.35},g);el("rect",{x:0,y:-2.5,width:16,height:5,rx:2.5,fill:"#bff4ff"},g);}
 return g;
}
function shoot(){
  var p=player,n=p.power>=3?3:1;
  var bx=p.facing>0?p.x+p.w:p.x-14,by=p.y+18;
  for(var i=0;i<n;i++){
   var ang=n===3?(i-1)*.16:0;
   bullets.push({x:bx,y:by,vx:p.facing*Math.cos(ang)*BSPD,vy:Math.sin(ang)*BSPD,
    w:16,h:8,from:"p",dmg:1,ttl:1.2,node:makeBulletNode(false)});
  }
  p.fireCd=p.power>=2?.21:.32;p.mzT=.07;AudioFX.shoot();
}
function enemyShot(x,y,tx,ty,spd){
 var dx=tx-x,dy=ty-y,L=Math.sqrt(dx*dx+dy*dy)||1;
 bullets.push({x:x,y:y,vx:dx/L*spd,vy:dy/L*spd,w:12,h:12,from:"e",dmg:14,ttl:3.2,node:makeBulletNode(true)});
}
function spawnParts(x,y,color,n,spd){
 for(var i=0;i<n;i++){
  if(parts.length>220)break;
  var a=rnd(0,Math.PI*2),v=rnd(spd*.3,spd);
  parts.push({x:x,y:y,vx:Math.cos(a)*v,vy:Math.sin(a)*v-60,r:rnd(2,5),
   life:rnd(.35,.7),max:.7,color:color,node:null});
  var q=parts[parts.length-1];
  q.node=el("circle",{cx:q.x,cy:q.y,r:q.r,fill:color},gFx);
 }
}
function scoreAdd(v){G.score+=v;}

function setState(s){
 G.prev=G.state;G.state=s;
 ovMenu.setAttribute("visibility",s==="MENU"?"visible":"hidden");
 ovPause.setAttribute("visibility",s==="PAUSED"?"visible":"hidden");
 ovOver.setAttribute("visibility",s==="GAMEOVER"?"visible":"hidden");
 ovWin.setAttribute("visibility",s==="VICTORY"?"visible":"hidden");
}
function startGame(){
  resetPlayer();resetEntities();
  G.score=0;G.camX=0;G.bossOn=false;G.winT=-1;
  AudioFX.setEnabled(true);
  setState("PLAYING");
}
function hurtPlayer(d,dir){
  var p=player;
  if(p.invuln>0||p.dashT>0)return;
  p.hp-=d;p.invuln=1.1;p.vx=dir*260;p.vy=-280;G.shakeT=.25;
  spawnParts(p.x+p.w/2,p.y+p.h/2,"#ff4b5c",10,260);AudioFX.hit();
  if(p.hp<=0){p.hp=0;$("overScore").textContent="SCORE "+G.score;setState("GAMEOVER");AudioFX.gameOver();}
}
function killEnemy(e,idx){
  spawnParts(e.x+e.w/2,e.y+e.h/2,"#ffd23f",14,300);
  spawnParts(e.x+e.w/2,e.y+e.h/2,"#ff5a3c",10,220);AudioFX.enemyKill();
  scoreAdd(e.val);
  e.node.remove();enemies.splice(idx,1);
  if(Math.random()<.12)makeItem("heart",e.x+e.w/2,e.y);
}

function physics(e,dt){
 e.vy=Math.min(e.vy+GRAV*dt,e.maxFall);
 e.x+=e.vx*dt;resolveAxis(e,"x");
 var wasAir=!e.grounded;
 e.y+=e.vy*dt;e.grounded=false;resolveAxis(e,"y");
 if(wasAir&&e.grounded)return true;
 return false;
}
function resolveAxis(e,axis){
 for(var i=0;i<PLATS.length;i++){
  var pl=PLATS[i];
  if(!aabb(e,pl))continue;
  if(axis==="x"){
   if(e.vx>0)e.x=pl.x-e.w;else if(e.vx<0)e.x=pl.x+pl.w;
  }else{
   if(e.vy>0){e.y=pl.y-e.h;e.vy=0;e.grounded=true;e.plat=pl;}
   else if(e.vy<0){e.y=pl.y+pl.h;e.vy=0;}
  }
 }
}

function updatePlayer(dt){
 var p=player,K=G.keys;
 var mv=(K.ArrowRight?1:0)-(K.ArrowLeft?1:0);
 if(p.dashT>0){
  p.dashT-=dt;p.vx=p.facing*DASH_SPD;p.vy=0;
 }else{
  var tgt=mv*MOVE,k=p.grounded?14:7;
  p.vx+=(tgt-p.vx)*Math.min(1,k*dt);
  if(mv!==0)p.facing=mv;
 }
 p.dashCd-=dt;
 if(G.dashQ){G.dashQ=false;if(p.dashCd<=0&&p.dashT<=0){p.dashT=DASH_T;p.dashCd=DASH_CD;p.invuln=Math.max(p.invuln,DASH_T+.08);spawnParts(p.x+p.w/2,p.y+p.h/2,"#3fe0ff",8,180);AudioFX.dash();}}
 if(p.grounded){p.coyote=.09;p.jumpsUsed=0;}else p.coyote-=dt;
if(G.jumpQ){
   G.jumpQ=false;
   if(p.coyote>0){p.vy=JUMP_V;p.jumpsUsed=1;p.coyote=0;AudioFX.jump();}
   else if(p.jumpsUsed<2){p.vy=DJ_V;p.jumpsUsed=2;spawnParts(p.x+p.w/2,p.y+p.h,"#3fe0ff",6,140);AudioFX.doubleJump();}
  }
 if(!(K.Space||K.KeyW||K.ArrowUp)&&p.vy<-260)p.vy=-260;
var landed=physics(p,dt);
  if(landed){spawnParts(p.x+p.w/2,p.y+p.h,"#8fa2ff",5,120);AudioFX.land();}
 if(p.fireCd>0)p.fireCd-=dt;
 if(p.mzT>0)p.mzT-=dt;
 if((K.KeyZ||K.KeyJ)&&p.fireCd<=0)shoot();
 p.invuln-=dt;
 if(G.bossOn)p.x=clamp(p.x,6200,WORLD_W-p.w);
 else p.x=clamp(p.x,0,WORLD_W-p.w);
 if(p.grounded&&p.plat&&p.plat.ground)p.lastSafeX=p.x;
 if(p.y>640){
  p.hp-=20;G.shakeT=.3;
  if(p.hp<=0){p.hp=0;$("overScore").textContent="SCORE "+G.score;setState("GAMEOVER");return;}
  p.x=p.lastSafeX;p.y=GY-260;p.vx=0;p.vy=0;p.invuln=1.4;
 }
 p.animT+=dt;
}
function updateEnemies(dt){
 var p=player;
 for(var i=enemies.length-1;i>=0;i--){
  var e=enemies[i];e.t+=dt;
  if(e.type==="walker"){
   e.x+=e.dir*e.vx*dt;
   if(e.x<e.x0){e.x=e.x0;e.dir=1;}if(e.x+e.w>e.x1){e.x=e.x1-e.w;e.dir=-1;}
   var sw=Math.sin(e.t*10)*22;
   e.legs[0].setAttribute("transform","rotate("+sw+" 11 36)");
   e.legs[1].setAttribute("transform","rotate("+(-sw)+" 30 36)");
  }else if(e.type==="drone"){
   e.x+=e.dir*e.vx*dt;
   if(e.x<e.x0){e.x=e.x0;e.dir=1;}if(e.x+e.w>e.x1){e.x=e.x1-e.w;e.dir=-1;}
   e.node.setAttribute("transform","translate("+e.x+","+(e.y0+Math.sin(e.t*3)*24)+")");
   e.rotor.setAttribute("transform","rotate("+(e.t*720)%360+" 20 -2)");
   e.y=e.y0+Math.sin(e.t*3)*24;
  }else{
   var dx=(p.x+p.w/2)-(e.x+26);
   e.barrel.setAttribute("transform",dx<0?"translate(52,0) scale(-1,1)":"");
   e.ft-=dt;
   if(e.ft<=0&&Math.abs(dx)<520&&G.state!=="MENU"){
    e.ft=2.1;
    enemyShot(e.x+26,e.y+8,p.x+p.w/2,p.y+p.h/2,270);
   }
  }
  if(aabb(e,p))hurtPlayer(e.type==="turret"?12:12,(p.x<e.x?-1:1));
 }
}
function updateBoss(dt){
 var b=boss,p=player;
 if(!b||b.dead){
  if(b&&b.dead){
   b.deadT+=dt;
   if(b.deadT<.8&&Math.floor(b.deadT/.16)!==Math.floor((b.deadT-dt)/.16))
    spawnParts(b.x+rnd(10,120),b.y+rnd(10,140),pick(["#ffd23f","#ff5a3c","#ff2e88"]),12,340);
   if(b.deadT>1.3&&G.winT<0){$("winScore").textContent="SCORE "+G.score+"  TIME "+Math.floor(G.time)+"s";G.winT=0;}
   if(b.deadT>1.5&&G.state==="BOSS"){setState("VICTORY");AudioFX.victory();}
  }
  return;
 }
 if(!b.active){
  if(Math.abs(p.x-b.x)<620)b.active=true,$("bossBar").setAttribute("visibility","visible");
  b.node.setAttribute("transform","translate("+b.x+","+b.y+")");
  return;
 }
 b.t+=dt;b.face=(p.x>b.x)?1:-1;
 var enr=b.hp<b.maxHp*.4;
 if(b.grounded){
  b.vx=b.face*(enr?130:85);
  b.volT-=dt;
  if(b.volT<=0){
   b.volT=enr?1.4:2.2;
   var cx=b.x+b.w/2,cy=b.y+30;
   for(var k=-1;k<=1;k++){
    var dx=(p.x+p.w/2)-cx,dy=(p.y+p.h/2)-cy,a=Math.atan2(dy,dx)+k*.2;
    bullets.push({x:cx,y:cy,vx:Math.cos(a)*300,vy:Math.sin(a)*300,w:12,h:12,from:"e",dmg:16,ttl:3.4,node:makeBulletNode(true)});
   }
  }
  b.leapT-=dt;
  if(b.leapT<=0){b.leapT=5.5;b.vy=-760;b.vx=((p.x>b.x)?320:-320);}
 }else b.vx*=1-Math.min(1,dt*1.5);
 var wasAir=!b.grounded;
 var landed=physics(b,dt);
 b.x=clamp(b.x,6300,7080);
 if(landed){G.shakeT=.3;spawnParts(b.x+b.w/2,b.y+b.h,"#b44cff",12,260);}
 var stomp=Math.sin(b.t*9)*(b.grounded&&Math.abs(b.vx)>10?14:0);
 b.legs[0].setAttribute("transform","translate(0,"+Math.max(0,stomp)+")");
 b.legs[1].setAttribute("transform","translate(0,"+Math.max(0,-stomp)+")");
 b.node.setAttribute("transform","translate("+b.x+","+b.y+")"+(b.face<0?"":""));
 $("bossHp").setAttribute("width",436*clamp(b.hp/b.maxHp,0,1));
 if(aabb(b,p))hurtPlayer(20,(p.x<b.x?-1:1));
}
function damageBoss(d){
  var b=boss;
  if(!b||b.dead||!b.active)return;
  b.hp-=d;
  spawnParts(b.x+rnd(20,110),b.y+rnd(20,120),"#ffd23f",5,200);AudioFX.bossHit();
  if(b.hp<=0){
   b.hp=0;b.dead=true;scoreAdd(1000);G.shakeT=.5;
   G.sweep=true;
   for(var i=enemies.length-1;i>=0;i--){killEnemy(enemies[i],i);}
   if(player)player.invuln=Math.max(player.invuln,2.5);
   spawnParts(b.x+b.w/2,b.y+b.h/2,"#ffffff",20,420);AudioFX.bossDeath();
  }
}
function updateBullets(dt){
 var p=player,i,j,bl;
 if(G.sweep){
  for(i=bullets.length-1;i>=0;i--){
   if(bullets[i].from==="e"){bullets[i].node.remove();bullets.splice(i,1);}
  }
  G.sweep=false;
 }
 for(i=bullets.length-1;i>=0;i--){
  var bl=bullets[i];
  bl.ttl-=dt;bl.x+=bl.vx*dt;bl.y+=bl.vy*dt;
  var dead=bl.ttl<=0||bl.y>600||bl.y<-60;
if(bl.from==="p"){
    for(var j=enemies.length-1;j>=0;j--){
     var e=enemies[j];
     if(bl.x>e.x-4&&bl.x<e.x+e.w+4&&bl.y>e.y-4&&bl.y<e.y+e.h+4){
      e.hp-=bl.dmg;dead=true;
      spawnParts(bl.x,bl.y,"#bff4ff",4,160);AudioFX.enemyHit();
      if(e.hp<=0)killEnemy(e,j);
      break;
     }
    }
    if(!dead&&boss&&!boss.dead&&boss.active&&bl.x>boss.x&&bl.x<boss.x+boss.w&&bl.y>boss.y&&bl.y<boss.y+boss.h){damageBoss(bl.dmg);dead=true;}
   }else{
   if(p.invuln<=0&&p.dashT<=0&&bl.x>p.x&&bl.x<p.x+p.w&&bl.y>p.y&&bl.y<p.y+p.h){hurtPlayer(bl.dmg,bl.vx>0?1:-1);dead=true;}
  }
  if(dead){bl.node.remove();bullets.splice(i,1);}
  else bl.node.setAttribute("transform","translate("+bl.x+","+bl.y+")");
 }
}
function updateItems(dt){
 var p=player;
 for(var i=items.length-1;i>=0;i--){
  var it=items[i];it.t+=dt;
  if(!it.taken&&aabb(it,p)){
   it.taken=true;
   if(it.kind==="heart"){p.hp=Math.min(p.maxHp,p.hp+30);spawnParts(it.x+14,it.y+14,"#ff4fa3",8,180);AudioFX.pickupHeart();}
   else if(it.kind==="gem"){scoreAdd(50);spawnParts(it.x+14,it.y+14,"#3fe0ff",8,180);AudioFX.pickupGem();}
   else{p.power=Math.min(3,p.power+1);spawnParts(it.x+14,it.y+14,"#ffd23f",10,220);AudioFX.pickupPower();}
   it.node.remove();items.splice(i,1);
  }
 }
}
function updateParts(dt){
 for(var i=parts.length-1;i>=0;i--){
  var q=parts[i];
  q.life-=dt;q.x+=q.vx*dt;q.y+=q.vy*dt;q.vy+=700*dt;
  if(q.life<=0){q.node.remove();parts.splice(i,1);}
  else q.node.setAttribute("transform","translate("+q.x+","+q.y+") scale("+(q.life/q.max)+")");
 }
}
function updateCamera(dt){
 var p=player;
 var target=clamp(p.x-VIEW_W*.42+p.facing*40,G.bossOn?6240:0,WORLD_W-VIEW_W);
 G.camX+=(target-G.camX)*Math.min(1,dt*6);
}
function updateHud(){
 var p=player,pct=clamp(p.hp/p.maxHp,0,1);
 var f=$("hudHp");
 f.setAttribute("width",206*pct);
 f.setAttribute("fill",pct>.5?"#3dff8f":pct>.25?"#ffd23f":"#ff4b5c");
 $("hudScore").textContent="SCORE "+String(G.score).padStart(6,"0");
 for(var i=0;i<3;i++)$("pip"+i).setAttribute("fill",p.power>i?"#ffd23f":"#20304f");
 var pr=clamp(p.x/GOAL_X,0,1);
 $("progFill").setAttribute("width",318*pr);
 $("progMark").setAttribute("transform","translate("+(70+318*pr)+",517)");
}
function sim(dt){
 G.time+=dt;
 updatePlayer(dt);
 if(G.state==="GAMEOVER")return;
 updateEnemies(dt);
 updateBoss(dt);
 updateBullets(dt);
 updateItems(dt);
 if(!G.bossOn&&player.x>=GOAL_X){G.bossOn=true;G.shakeT=.35;if(boss&&!boss.dead){boss.active=true;$("bossBar").setAttribute("visibility","visible");setState("BOSS");}}
 updateCamera(dt);
 updateHud();
}
function render(){
 var shx=0,shy=0;
 if(G.shakeT>0){G.shakeT-=1/60;shx=rnd(-4,4);shy=rnd(-4,4);}
 world.setAttribute("transform","translate("+(-Math.round(G.camX)+shx)+","+shy+")");
 far.setAttribute("transform","translate("+(-G.camX*.25+shx*.4)+","+shy*.4+")");
 mid.setAttribute("transform","translate("+(-G.camX*.55+shx*.7)+","+shy*.7+")");
 var p=player;
 if(p){
  p.node.setAttribute("transform","translate("+Math.round(p.x)+","+Math.round(p.y)+")");
  p.flip.setAttribute("transform",p.facing<0?"translate(30,0) scale(-1,1)":"");
  var moving=Math.abs(p.vx)>30&&p.grounded;
  var a=moving?Math.sin(p.animT*16)*26:(p.grounded?0:(p.vy<0?-18:14));
  p.legL.setAttribute("transform","rotate("+a+" 10 33)");
  p.legR.setAttribute("transform","rotate("+(-a)+" 20 33)");
  p.muzzle.setAttribute("opacity",p.mzT>0?.95:0);
  p.node.setAttribute("opacity",(p.invuln>0&&Math.floor(p.animT*10)%2===0)?.35:1);
 }
 for(var i=0;i<enemies.length;i++){
  var e=enemies[i];
  if(e.type==="walker")e.node.setAttribute("transform","translate("+e.x+","+e.y+")");
  else if(e.type==="turret")e.node.setAttribute("transform","translate("+e.x+","+e.y+")");
 }
 for(var j=0;j<items.length;j++){
  var it=items[j];
  var bob=Math.sin(it.t*3)*5;
  if(it.kind==="power")it.node.setAttribute("transform","translate("+(it.x+14)+","+(it.y+14+bob)+") rotate("+(it.t*80)%360+") translate(-14,-14)");
  else it.node.setAttribute("transform","translate("+(it.x+14)+","+(it.y+14+bob)+") translate(-14,-14)");
 }
}
function frame(now){
 var dt=Math.min(.033,(now-(frame.last||now))/1000)||0;
 frame.last=now;
 if(G.state==="PLAYING"||G.state==="BOSS")sim(dt);
 updateParts(dt);
 render();
 requestAnimationFrame(frame);
}
function bindInput(){
 addEventListener("keydown",function(e){
  if(["ArrowLeft","ArrowRight","Space","ArrowUp"].indexOf(e.code)>=0)e.preventDefault();
  G.keys[e.code]=true;
  var act=G.state==="PLAYING"||G.state==="BOSS";
  if(act&&(e.code==="Space"||e.code==="KeyW"||e.code==="ArrowUp"))G.jumpQ=true;
  if(act&&(e.code==="ShiftLeft"||e.code==="ShiftRight"))G.dashQ=true;
  if(e.code==="Enter"&&(G.state==="MENU"||G.state==="GAMEOVER"||G.state==="VICTORY"))startGame();
  if(e.code==="KeyP"){if(act)setState("PAUSED");else if(G.state==="PAUSED")setState(G.prev==="PAUSED"?"PLAYING":G.prev);}
 });
 addEventListener("keyup",function(e){G.keys[e.code]=false;});
 addEventListener("blur",function(){G.keys={};});
 $("btnStart").addEventListener("click",startGame);
 $("btnRetry1").addEventListener("click",startGame);
 $("btnRetry2").addEventListener("click",startGame);
}
function init(){
 buildSky();buildFar();buildMid();buildPlats();
 resetPlayer();resetEntities();
 bindInput();
 setState("MENU");
 requestAnimationFrame(frame);
}
window.__game={G:G,get player(){return player;},get enemies(){return enemies;},
 get bullets(){return bullets;},get items(){return items;},get boss(){return boss;},
 get PLATS(){return PLATS;},start:startGame,state:function(){return G.state;},
 step:function(dt){if(G.state==="PLAYING"||G.state==="BOSS")sim(dt);updateParts(dt);render();}};
init();
})();

