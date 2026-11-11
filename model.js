(function(){
const host = document.getElementById('stage'); const viewer = document.getElementById('viewer');
function fail(){ host.insertAdjacentHTML('beforeend','<div class="fallback">The 3D view needs WebGL, which this browser has turned off. The floor plan in the moodboard shows the same layout.</div>'); }
if(!window.THREE || !THREE.OrbitControls){ fail(); return; }
let renderer;
try{ renderer = new THREE.WebGLRenderer({antialias:true, preserveDrawingBuffer:true}); }catch(e){ fail(); return; }
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = .82;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
host.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x120f0d);
scene.fog = new THREE.Fog(0x120f0d, 70, 140);
const cam = new THREE.PerspectiveCamera(40, 1, 0.1, 400);
const ctl = new THREE.OrbitControls(cam, renderer.domElement);
ctl.enableDamping = true; ctl.maxPolarAngle = Math.PI*0.495; ctl.minDistance = 2; ctl.maxDistance = 110;

const H = 4.8;            // ceiling height
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- materials ----------
const M = (c,o={}) => new THREE.MeshStandardMaterial(Object.assign({color:c, roughness:.8, metalness:0}, o));
function canvasTex(w,h,draw,rep){ const c=document.createElement('canvas'); c.width=w; c.height=h; draw(c.getContext('2d'),w,h); const t=new THREE.CanvasTexture(c); t.encoding=THREE.sRGBEncoding; t.anisotropy=8; if(rep){t.wrapS=t.wrapT=THREE.RepeatWrapping;} return t; }
const slatTex = canvasTex(256,64,(g,w,h)=>{ for(let i=0;i<16;i++){ const x=i*16; const tone=150+((i*37)%30); g.fillStyle=`rgb(${tone},${Math.round(tone*.55)},${Math.round(tone*.3)})`; g.fillRect(x,0,12,h); g.fillStyle='#2a1a10'; g.fillRect(x+12,0,4,h);} },true);
const carpetTex = canvasTex(256,256,(g,w,h)=>{ g.fillStyle='#b8692f'; g.fillRect(0,0,w,h); for(let i=0;i<2600;i++){ const y=Math.random()*h, x=Math.random()*w; g.fillStyle=`rgba(${120+Math.random()*80|0},${60+Math.random()*40|0},${20+Math.random()*20|0},.35)`; g.fillRect(x,y,8+Math.random()*30,1.5);} },true);
carpetTex.repeat.set(9,5);
const deckTex = canvasTex(128,128,(g,w,h)=>{ g.fillStyle='#b48a62'; g.fillRect(0,0,w,h); for(let i=0;i<8;i++){ g.fillStyle=i%2?'#a77f58':'#bc936b'; g.fillRect(0,i*16,w,15); g.fillStyle='#7d5d40'; g.fillRect(0,i*16+15,w,1);} },true);
deckTex.repeat.set(4,10);
const netTex = canvasTex(128,128,(g,w,h)=>{ g.clearRect(0,0,w,h); g.strokeStyle='rgba(255,255,255,.95)'; g.lineWidth=1.6; const s=10; for(let y=-s;y<h+s;y+=s*0.86){ for(let x=-s;x<w+s;x+=s){ const ox=(Math.round(y/(s*.86))%2)*s/2; g.beginPath(); for(let k=0;k<6;k++){ const a=Math.PI/3*k+Math.PI/6; const px=x+ox+Math.cos(a)*s*.55, py=y+Math.sin(a)*s*.55; k?g.lineTo(px,py):g.moveTo(px,py);} g.closePath(); g.stroke(); } } },true);
netTex.repeat.set(3,3);

const mat = {
  carpet: M(0xffffff,{map:carpetTex, roughness:.95}),
  wood: M(0xffffff,{map:slatTex, roughness:.7}),
  stage: M(0x9a5c32,{roughness:.55}), riser: M(0x7a4626,{roughness:.6}),
  conc: M(0xd9d2c7,{roughness:.9}), deck: M(0xffffff,{map:deckTex}), timber: M(0xa8774f,{roughness:.7}),
  lobby: M(0x8f8a83), led: M(0x101418,{roughness:.3}), ink: M(0x16161a,{roughness:.5}),
  glass: new THREE.MeshPhysicalMaterial({color:0xbfd9ee, transparent:true, opacity:.16, roughness:.05, metalness:0}),
  plant: M(0x4f7a49), planter: M(0x5b4a3b), linen: M(0xefe7da), copper: M(0xb86b3a,{metalness:.45, roughness:.35}),
  ceiling: M(0x140c07,{roughness:1}), slat: M(0x5e361c,{roughness:.85})
};

// ---------- helpers ----------
const add = (o,parent=scene)=>{ parent.add(o); return o; };
function box(w,h,d,m,x,y,z,parent){ const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m); o.position.set(x,y,z); o.castShadow=true; o.receiveShadow=true; return add(o,parent); }
function cyl(r1,r2,h,m,x,y,z,seg=20,parent){ const o=new THREE.Mesh(new THREE.CylinderGeometry(r1,r2,h,seg),m); o.position.set(x,y,z); o.castShadow=true; o.receiveShadow=true; return add(o,parent); }
function slab(pts, m, top=0, depth=.15){ const s=new THREE.Shape(pts.map(p=>new THREE.Vector2(p[0],p[1]))); const g=new THREE.ExtrudeGeometry(s,{depth,bevelEnabled:false}); g.rotateX(Math.PI/2); const o=new THREE.Mesh(g,m); o.position.y=top; o.receiveShadow=true;
  // planar UVs in metres
  const pos=g.attributes.position, uv=g.attributes.uv; for(let i=0;i<pos.count;i++){ uv.setXY(i,pos.getX(i)/4,pos.getZ(i)/4);} uv.needsUpdate=true; return add(o); }

// walls that hide when they face the camera (dollhouse cut-away)
const cutWalls = [];
function wall(x1,z1,x2,z2,h,m,nx,nz,opts={}){
  const L=Math.hypot(x2-x1,z2-z1), t=opts.t||.25;
  const g=new THREE.BoxGeometry(L,h,t);
  if(m===mat.wood){ const uv=g.attributes.uv; for(let i=0;i<uv.count;i++){ uv.setX(i, uv.getX(i)*L/2.2); } }
  const o=new THREE.Mesh(g,m); o.position.set((x1+x2)/2,(opts.y0||0)+h/2,(z1+z2)/2); o.rotation.y=-Math.atan2(z2-z1,x2-x1);
  o.castShadow=!opts.glass; o.receiveShadow=true; add(o);
  if(opts.cut!==false) cutWalls.push({o, c:new THREE.Vector3(o.position.x,0,o.position.z), n:new THREE.Vector3(nx,0,nz).normalize()});
  return o;
}

// ---------- plan geometry (metres; x along hall, z across) ----------
const D0=[38.5,-6], D1=[26.8,20];
const facX = z => 38.5 - 11.7*(z+6)/26;           // x of the glazed façade at depth z
const HALL=[[0,0],[36,0],[26.8,20],[0,20]];
const FOOD=[[27.5,-6],[38.5,-6],[36,0],[27.5,0]];
const BAL=[[38.5,-6],[39.4,-6],[41.6,20],[26.8,20]];
const LOBBY=[[15,-6],[27.5,-6],[27.5,0],[15,0]];

slab(HALL, mat.carpet); slab(FOOD, mat.timber); slab(BAL, mat.deck, 0, .2); slab(LOBBY, mat.lobby);

// hall walls (slatted timber inside, as in the reference)
wall(0,0,0,20,H,mat.wood,-1,0);
wall(0,0,23,0,H,mat.wood,0,-1); wall(26,0,27.5,0,H,mat.wood,0,-1);
box(3,H-3,.25,mat.wood,24.5,3+(H-3)/2,0).userData.cutGroup=true;
wall(0,20,26.8,20,H,mat.wood,0,1);
// food + lobby enclosure
wall(27.5,-6,38.5,-6,H,mat.conc,0,-1); wall(27.5,-6,27.5,-3.4,H,mat.conc,-1,0,{cut:false}); wall(27.5,-2.1,27.5,0,H,mat.conc,-1,0,{cut:false});
wall(15,-6,27.5,-6,H,mat.conc,0,-1); wall(15,-6,15,0,H,mat.conc,-1,0);
// glazed façade with two door openings onto the balcony
(function(){
  const segs=[[0,.52],[.6,.86],[.94,1]];
  const P=t=>[D0[0]+(D1[0]-D0[0])*t, D0[1]+(D1[1]-D0[1])*t];
  segs.forEach(([a,b])=>{ const p=P(a), q=P(b); wall(p[0],p[1],q[0],q[1],H,mat.glass,20,9.2,{t:.06,glass:true,cut:false});
    for(let k=0;k<=Math.floor((b-a)*13);k++){ const r=P(a+(b-a)*k/Math.max(1,Math.floor((b-a)*13))); box(.08,H,.08,mat.ink,r[0],H/2,r[1]); } });
  [[.52,.6],[.86,.94]].forEach(([a,b])=>{ const p=P(a), q=P(b); wall(p[0],p[1],q[0],q[1],.18,mat.ink,20,9.2,{t:.1,y0:H-.18,cut:false}); });
})();
// columns
[[11,1.2],[22,1.2]].forEach(([x,z])=>box(.9,H,.9,mat.conc,x,H/2,z));
[[8.7,16],[21.3,16]].forEach(([x,z])=>cyl(.5,.5,H,mat.conc,x,H/2,z,28));
[[29.4,6.6],[27.6,13.4]].forEach(([x,z])=>cyl(.55,.55,H,mat.conc,x,H/2,z,28));
[[38.3,.1],[38.9,6.6],[39.4,13.1]].forEach(([x,z])=>cyl(.42,.42,H+.6,mat.conc,x,(H+.6)/2,z,24));
// lifts
box(2.2,2.7,.15,mat.conc,17.1,1.35,-5.85); box(2.2,2.7,.15,mat.conc,19.9,1.35,-5.85);

// ceiling (only drawn when the camera is below it)
const ceil = new THREE.Group(); add(ceil);
(function(){
  const g=new THREE.BoxGeometry(1,.16,.09); const rows=[]; for(let z=.2; z<19.9; z+=.34) rows.push(z);
  const im=new THREE.InstancedMesh(g, mat.slat, rows.length); const m4=new THREE.Matrix4();
  rows.forEach((z,i)=>{ const xmax=facX(z)-.1; m4.compose(new THREE.Vector3(xmax/2, H-.35-(i%3)*.06, z), new THREE.Quaternion(), new THREE.Vector3(xmax,1,1)); im.setMatrixAt(i,m4); });
  ceil.add(im);
  const s=new THREE.Shape(HALL.map(p=>new THREE.Vector2(p[0],p[1]))); const cg=new THREE.ShapeGeometry(s); cg.rotateX(Math.PI/2);
  const c=new THREE.Mesh(cg, mat.ceiling); c.position.y=H; ceil.add(c);
})();

// stage, steps, LED wall, house speakers
box(4.5,.6,10,mat.stage,2.25,.3,10);
for(let k=0;k<3;k++) box(.35,.2*(k+1),1.8,mat.stage,4.5+.175+(2-k)*.35,.1*(k+1),14.1);
const ledScreen = box(.18,3.2,6.4,mat.led,.25,.6+1.75,10);
box(.6,1.6,.6,mat.ink,4.2,H-1.3,4.4); box(.6,1.6,.6,mat.ink,4.2,H-1.3,15.6);

// LED wall content (animated canvas)
const ledCanvas=document.createElement('canvas'); ledCanvas.width=512; ledCanvas.height=256;
const lg=ledCanvas.getContext('2d'); const ledTex=new THREE.CanvasTexture(ledCanvas); ledTex.encoding=THREE.sRGBEncoding;
const ledOn = new THREE.MeshBasicMaterial({map:ledTex, toneMapped:false});
function drawLED(t){
  const w=512,h=256; const gr=lg.createLinearGradient(0,0,w,h); gr.addColorStop(0,'#0b1f6b'); gr.addColorStop(.5,'#1d4fd6'); gr.addColorStop(1,'#071233'); lg.fillStyle=gr; lg.fillRect(0,0,w,h);
  for(let i=0;i<7;i++){ const cx=w*(.15+i*.12)+Math.sin(t*.4+i)*30, cy=h*(.55+.25*Math.sin(t*.3+i*1.7)); const rg=lg.createRadialGradient(cx,cy,2,cx,cy,90); rg.addColorStop(0,i%2?'rgba(255,170,60,.95)':'rgba(255,120,40,.8)'); rg.addColorStop(1,'rgba(255,120,40,0)'); lg.fillStyle=rg; lg.fillRect(0,0,w,h); }
  lg.strokeStyle='rgba(255,220,170,.55)'; lg.lineWidth=2; for(let i=0;i<5;i++){ lg.beginPath(); for(let x=0;x<=w;x+=8){ const y=h*.5+Math.sin(x*.012+t*.8+i)*40*(1+i*.2)+i*12; x?lg.lineTo(x,y):lg.moveTo(x,y);} lg.stroke(); }
  ledTex.needsUpdate=true;
}
// glowing strip lights between the wall slats
const strips = new THREE.Group(); add(strips);
(function(){
  const sm=new THREE.MeshBasicMaterial({color:0xffb766, toneMapped:false});
  const put=(x,z,rot)=>{ const s=new THREE.Mesh(new THREE.BoxGeometry(.04,H-.5,.05),sm); s.position.set(x,(H-.5)/2+.1,z); s.rotation.y=rot; strips.add(s); };
  for(let z=1;z<20;z+=1.6) if(z<4.6||z>15.4) put(.14,z,0);

})();
// RGB pixel bars set into the slatted timber on both long side walls
const pixBars = new THREE.Group(); add(pixBars);
const PIX=[];
(function(){
  const xs=[]; for(let x=1.6;x<22.6;x+=3.2) xs.push([x,.135]); xs.push([26.8,.135]);
  for(let x=1.6;x<26.4;x+=3.2) if(x<13.2||x>19.6) xs.push([x,19.865]);
  pixBars.userData.n=xs.length;
  const step=.09, y0=.35, y1=H-.45, n=Math.floor((y1-y0)/step);
  const chan=new THREE.MeshStandardMaterial({color:0x140c07,roughness:.9});
  const pg=new THREE.BoxGeometry(.075,.072,.035);
  const im=new THREE.InstancedMesh(pg,new THREE.MeshBasicMaterial({color:0xffffff,toneMapped:false}),xs.length*n);
  const m=new THREE.Matrix4(); let i=0;
  xs.forEach(([x,z])=>{ const ch=new THREE.Mesh(new THREE.BoxGeometry(.12,y1-y0+.12,.02),chan); ch.position.set(x,(y0+y1)/2,z); pixBars.add(ch);
    const zz = z<1 ? z+.02 : z-.02;
    for(let k=0;k<n;k++){ const y=y0+k*step; m.makeTranslation(x,y,zz); im.setMatrixAt(i,m); PIX.push([x,y,z]); i++; } });
  pixBars.add(im); pixBars.userData.im=im;
})();
const _c=new THREE.Color();
function colourPixels(t){ const im=pixBars.userData.im; PIX.forEach(([x,y,z],i)=>{ const h=((t*.12 + x*.035 - y*.09 + (z>10?.5:0))%1+1)%1; _c.setHSL(h,1,.55); im.setColorAt(i,_c); }); im.instanceColor.needsUpdate=true; }
colourPixels(0);
const ledLights = new THREE.Group(); add(ledLights);
[[3,2.6,10,0x3d6dff,1.6],[9,3.9,7,0xff8a3d,1.2],[14,3.9,13,0xff5f8a,1.1],[18,3.8,8,0x4fd1c5,1]].forEach(([x,y,z,c,i])=>{ const l=new THREE.PointLight(c,i,18,2); l.position.set(x,y,z); ledLights.add(l); });

// ---------- DJ riser, table, speakers, DJ ----------
const djGroup = new THREE.Group(); add(djGroup);
box(3,.28,4,mat.riser,6.4,.14,10,djGroup);
const tableMat = M(0xc9772f,{metalness:.25, roughness:.35, emissive:0x4a2208, emissiveIntensity:.6});
box(1,1.05,2.6,tableMat,7.1,.28+.525,10,djGroup);
box(1.05,.05,2.65,mat.ink,7.1,.28+1.07,10,djGroup);
[[6.9,9.3],[6.9,10.7]].forEach(([x,z])=>box(.42,.04,.42,M(0x2a2a30),x,1.38,z,djGroup));
box(.35,.03,.25,M(0xdedede,{metalness:.6,roughness:.3}),7.25,1.39,10.05,djGroup).rotation.z=.3;
[[7.6,8.1],[7.6,11.9]].forEach(([x,z])=>{ box(.6,.55,.55,mat.ink,x,.28+.28,z,djGroup); box(.5,.6,.45,mat.ink,x,.28+.55+.33,z,djGroup); });
function person(color, parent, x, z, rotY){ const g=new THREE.Group(); const b=new THREE.Mesh(new THREE.CylinderGeometry(.2,.24,1.1,12),M(color)); b.position.y=.55+.45; const l=new THREE.Mesh(new THREE.CylinderGeometry(.17,.15,.45,10),M(0x22252b)); l.position.y=.22; const h=new THREE.Mesh(new THREE.SphereGeometry(.14,14,12),M(0xc79a78)); h.position.y=1.72; [b,l,h].forEach(m=>{m.castShadow=true; g.add(m);}); g.position.set(x,0,z); g.rotation.y=rotY||0; parent.add(g); return g; }
const dj = person(0x1d1f26, djGroup, 6.25, 10, 0); dj.position.y=.28;

// ---------- ceiling decor: translucent mesh clouds over the dancefloor ----------
const clouds = new THREE.Group(); add(clouds);
(function(){
  const cols=[0x2f5bff,0xff7a1a,0xffc81f,0xff4f7a,0x2fc2b5,0x7a4cff,0xe0302a,0x9fd2ff,0xff9ab8,0x1f9a5e];
  let s=11; const rnd=()=>(s=(s*16807)%2147483647)/2147483647;
  for(let i=0;i<64;i++){
    const r=.7+rnd()*.75; const geo=new THREE.IcosahedronGeometry(r,3);
    const p=geo.attributes.position, v=new THREE.Vector3();
    for(let k=0;k<p.count;k++){ v.fromBufferAttribute(p,k); const n=1+.28*Math.sin(v.x*2.3+i)*Math.cos(v.y*3.1-i)+.18*Math.sin(v.z*3.7+i*.5); v.multiplyScalar(n); p.setXYZ(k,v.x,v.y*.5,v.z); }
    geo.computeVertexNormals();
    const c=cols[i%cols.length];
    const net=new THREE.MeshBasicMaterial({color:c, alphaMap:netTex, transparent:true, side:THREE.DoubleSide, depthWrite:false});
    const fill=new THREE.MeshBasicMaterial({color:c, transparent:true, opacity:.3, side:THREE.DoubleSide, depthWrite:false});
    const x=5.2+rnd()*14.3, z=4.9+rnd()*10.8, y=3.75+rnd()*.5;
    const a=new THREE.Mesh(geo,fill), b=new THREE.Mesh(geo,net);
    [a,b].forEach(m=>{ m.position.set(x,y,z); m.rotation.set(rnd()*.6,rnd()*6.3,rnd()*.6); clouds.add(m); });
    const wire=new THREE.Mesh(new THREE.CylinderGeometry(.006,.006,H-y,4), mat.ink); wire.position.set(x,y+(H-y)/2,z); clouds.add(wire);
  }
  // hanging glass drops in front of the LED, as in the reference
  const dm=new THREE.MeshStandardMaterial({color:0xffe9cc, emissive:0xffb766, emissiveIntensity:.8, transparent:true, opacity:.85});
  for(let i=0;i<80;i++){ const d=new THREE.Mesh(new THREE.SphereGeometry(.06,8,6),dm); d.position.set(1.2+rnd()*3,2.6+rnd()*1.7,7+rnd()*6); clouds.add(d); }
})();

// ---------- dancing crowd (instanced) ----------
const crowd = new THREE.Group(); add(crowd);
const people=[]; (function(){
  let s=5; const rnd=()=>(s=(s*16807)%2147483647)/2147483647;
  while(people.length<120){ const x=8.4+rnd()*11.2, z=4.9+rnd()*10.8; if(people.some(p=>Math.hypot(p.x-x,p.z-z)<.62) || Math.hypot(x-8.7,z-16)<1 || z>15.3) continue; people.push({x,z,ph:rnd()*6.3,sp:2.4+rnd()*1.6,h:.92+rnd()*.16,ry:Math.PI/2+(rnd()-.5)*1.2}); }
})();
const pal=[0xefe7da,0x1d1f26,0x9ec3e6,0xe7b9ad,0xf2a541,0x6f7f6a,0xd9cdb8,0x3b4a6b,0xffffff,0xb85c4a];
const bodyIM=new THREE.InstancedMesh(new THREE.CylinderGeometry(.19,.23,1.1,10), M(0xffffff), people.length);
const legIM=new THREE.InstancedMesh(new THREE.CylinderGeometry(.16,.14,.5,8), M(0x24262c), people.length);
const headIM=new THREE.InstancedMesh(new THREE.SphereGeometry(.135,12,10), M(0xb88c6a), people.length);
const armIM=new THREE.InstancedMesh(new THREE.CylinderGeometry(.05,.05,.6,6), M(0xc79a78), people.length*2);
[bodyIM,legIM,headIM,armIM].forEach(m=>{ m.castShadow=true; crowd.add(m); });
people.forEach((p,i)=>bodyIM.setColorAt(i,new THREE.Color(pal[i%pal.length])));
const m4=new THREE.Matrix4(), q=new THREE.Quaternion(), e=new THREE.Euler(), sc=new THREE.Vector3(), pv=new THREE.Vector3();
function poseCrowd(t){
  people.forEach((p,i)=>{
    const b=Math.max(0,Math.sin(t*p.sp+p.ph)); const bob=b*b*.09; const sway=Math.sin(t*p.sp*.5+p.ph)*.12;
    sc.set(1,p.h,1);
    e.set(0,p.ry+sway*.6,sway*.25); q.setFromEuler(e);
    m4.compose(pv.set(p.x,.25+.05*bob,p.z),q,sc.set(1,1,1)); legIM.setMatrixAt(i,m4);
    m4.compose(pv.set(p.x,(.5+.55)*p.h+bob,p.z),q,sc.set(1,p.h,1)); bodyIM.setMatrixAt(i,m4);
    m4.compose(pv.set(p.x+Math.sin(sway)*.08,1.72*p.h+bob,p.z),q,sc.set(1,1,1)); headIM.setMatrixAt(i,m4);
    const up=(i%3===0)?Math.max(0,Math.sin(t*p.sp*.5+p.ph))*1.0:0.15;
    for(let s=-1;s<=1;s+=2){ const ax=new THREE.Euler(0,p.ry,s*(.35+up*1.9)); q.setFromEuler(ax);
      const off=new THREE.Vector3(0,0,s*.27).applyAxisAngle(new THREE.Vector3(0,1,0),p.ry);
      m4.compose(pv.set(p.x+off.x,1.28*p.h+bob+up*.25,p.z+off.z),q,sc.set(1,1,1)); armIM.setMatrixAt(i*2+(s>0?1:0),m4); }
  });
  [bodyIM,legIM,headIM,armIM].forEach(m=>m.instanceMatrix.needsUpdate=true);
}
poseCrowd(0);

// ---------- food room, balcony ----------
box(8.6,.9,.8,mat.linen,32.6,.45,-5.2); for(let x=28.9;x<36.6;x+=1.05) box(.6,.18,.42,M(0xc9cdd3,{metalness:.7,roughness:.3}),x,.99,-5.2);
box(2.2,.9,.9,mat.copper,30.3,.45,-3.1); box(1.8,1,.8,mat.ink,34.5,.5,-1.3);
(function(){ // planters + glass balustrade
  for(let z=-5.6;z<20;z+=1.25){ const x=38.95+2.1*(z+6)/26+.15; box(.8,.55,1.2,mat.planter,x+.35,.48,z); const b=new THREE.Mesh(new THREE.IcosahedronGeometry(.55,1),mat.plant); b.position.set(x+.35,1.05,z); b.castShadow=true; add(b); }
  wall(26.8,20,41.6,20,1.1,mat.glass,0,1,{t:.05,glass:true,y0:.2,cut:false});
})();

const _n0=scene.children.length;
// ---------- photobooth on the south wall, between the pillars ----------
(function(){
  box(5.6,2.6,.18,M(0x9ec3e6,{roughness:.5}),16.4,1.3,19.7);
  const rm=M(0xf2a541,{roughness:.5});
  for(let k=0;k<5;k++){ const r=new THREE.Mesh(new THREE.TorusGeometry(.28,.035,8,24),rm); r.position.set(14.2+k*1.1,1.6+(k%2)*.4,19.58); add(r); const h=box(.06,.5,.04,rm,14.2+k*1.1,1.6+(k%2)*.4-.5,19.58); }
  box(1.4,.06,1.4,M(0xefe7da),16.4,.03,18.6);
  cyl(.12,.12,1.6,mat.ink,13.3,.8,18.6,10); cyl(.12,.12,1.6,mat.ink,19.5,.8,18.6,10);
})();
const photoG=new THREE.Group(); scene.children.slice(_n0).forEach(o=>photoG.add(o)); add(photoG);
const _n1=scene.children.length;
// ---------- breakfast tables in the hall ----------
(function(){
  [[21.9,11.6],[21.9,7.2],[25.3,16.1],[26.5,12.7],[28.1,9.6]].forEach(([x,z])=>{
    cyl(.8,.8,.05,M(0xfbfaf7),x,.75,z,32); cyl(.82,.82,.7,mat.linen,x,.38,z,32);
    for(let k=0;k<6;k++){ const a=k/6*Math.PI*2; const c=box(.42,.9,.42,M(0xd9cdb8),x+Math.cos(a)*1.25,.45,z+Math.sin(a)*1.25); c.rotation.y=-a; }
  });
})();
const bfastG=new THREE.Group(); scene.children.slice(_n1).forEach(o=>bfastG.add(o)); add(bfastG);
// ---------- balcony programme ----------
const xIn = z => facX(z)+.7;                       // inner edge (glass façade side)
const xOut = z => 38.9+2.1*(z+6)/26-.35;           // outer edge (planter side)
const balEarly = new THREE.Group(), balLate = new THREE.Group();
[balEarly,balLate].forEach(g=>add(g));
function zonePad(pts,color,op,g){ const s=new THREE.Shape(pts.map(p=>new THREE.Vector2(p[0],p[1]))); const geo=new THREE.ShapeGeometry(s); geo.rotateX(Math.PI/2); const o=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color,transparent:true,opacity:op,roughness:1,side:THREE.DoubleSide})); o.position.y=.215; o.receiveShadow=true; g.add(o); return o; }
// 7–8 AM: meditation & sunbath — yoga mats in the wide end
(function(){
  zonePad([[xIn(11.6),11.6],[xOut(11.6),11.6],[xOut(19.4),19.4],[xIn(19.4),19.4]],0x9db59a,.35,balEarly);
  const mm=M(0x7f9a84,{roughness:.95});
  [12.6,14.8,17.0,19.0].forEach(z=>{ for(let x=xIn(z+.9)+.4; x+.6<=xOut(z)-.1; x+=1.15){ const mat_=box(.62,.03,1.8,mm,x+.31,.23,z-.05,balEarly); mat_.castShadow=false; } });
  cyl(.32,.22,.28,M(0xc98a3a,{metalness:.6,roughness:.3}),36.4,.36,11.3,24,balEarly); // singing bowl
})();
// after 8:30: sunbathing on the open deck (no chairs) + smoking zone in the open south-east corner
(function(){
  zonePad([[xIn(11.6),11.6],[35.8,11.6],[35.8,19.4],[xIn(19.4),19.4]],0xf2c98a,.35,balLate);
  zonePad([[36.2,14.4],[xOut(14.4),14.4],[xOut(19.6),19.6],[36.2,19.6]],0x6b6660,.5,balLate);
  const st=M(0x2b2b30,{metalness:.5,roughness:.4});
  [[37.2,15.6],[39.6,18.4]].forEach(([x,z])=>{ cyl(.2,.22,.9,st,x,.65,z,16,balLate); cyl(.24,.24,.05,M(0xbfbfbf,{metalness:.8,roughness:.3}),x,1.12,z,16,balLate); });
  [[38.6,15.4],[37.6,18.6]].forEach(([x,z])=>{ cyl(.35,.35,.04,M(0xfbfaf7),x,1.28,z,20,balLate); cyl(.04,.04,1.06,mat.ink,x,.75,z,8,balLate); });
  // sign post
  box(.05,1.4,.05,mat.ink,36.4,.9,14.6,balLate); box(.6,.4,.04,M(0xefe7da),36.4,1.6,14.6,balLate);
})();

// ---------- labels ----------
function mkLabel(t,x,y,z,when,kind){ const el=document.createElement('div'); el.className='label'+(kind==='dim'?' dim':'')+(when?' slot':''); el.textContent=t; el.hidden=true; viewer.appendChild(el); return {el,v:new THREE.Vector3(x,y,z),when,kind}; }
const labels=[['Stage',2.2,1.4,10],['Dancefloor',12,.4,4.2],['DJ',6.4,1.8,10],['Main entry',24.5,2.6,.6],['Breakfast & coffee',32.6,2.4,-3],['Photobooth',16.5,2.9,19.4],['Breakfast tables',24.5,1.9,12.5],['Balcony gate',32.4,2.6,8.6],['Balcony',36.6,1.4,6.2],['Meditation & sunbath · 7–8 AM',33.5,1.2,16.4,'early'],['Smoking zone · after 8:30',38.3,2.0,17,'late'],['Sunbathing · after 8:30',32.2,1.4,16.4,'late'],['Lift lobby',21,2.6,-3]].map(([t,x,y,z,when])=>mkLabel(t,x,y,z,when,'room'));
const dimG=new THREE.Group(); add(dimG);
(function(){ const lm=new THREE.LineBasicMaterial({color:0xffc27a}); const L=(pts)=>{ const g=new THREE.BufferGeometry().setFromPoints(pts.map(p=>new THREE.Vector3(...p))); dimG.add(new THREE.Line(g,lm)); };
  L([[0,.06,-.7],[36,.06,-.7]]); L([[0,.06,-1],[0,.06,-.4]]); L([[36,.06,-1],[36,.06,-.4]]);
  L([[-.7,.06,0],[-.7,.06,20]]); L([[-1,.06,0],[-.4,.06,0]]); L([[-1,.06,20],[-.4,.06,20]]);
  L([[4.5,.05,4.6],[19.8,.05,4.6],[19.8,.05,15.9],[4.5,.05,15.9],[4.5,.05,4.6]]);
  L([[.5,0,.5],[.5,H,.5]]); L([[26.8,.25,20.7],[41.6,.25,20.7]]); })();
[['36 m (approx.)',18,.3,-.7],['20 m (approx.)',-.7,.3,10],['Dancefloor 15 × 11 m',12,.3,15.9],['Ceiling 4.8 m',.5,2.6,.5],['Balcony wide end 15 m',34.2,.5,20.7],['DJ riser 3 × 4 m',6.4,.6,12.3]].forEach(([t,x,y,z])=>labels.push(mkLabel(t,x,y,z,null,'dim')));

// ---------- base lighting ----------
const hemi=add(new THREE.HemisphereLight(0xffe2c2,0x3a2414,.38));
const warm=add(new THREE.DirectionalLight(0xffd6a8,.55)); warm.position.set(30,40,30); warm.castShadow=true;
Object.assign(warm.shadow.camera,{left:-30,right:30,top:30,bottom:-30,near:1,far:120}); warm.shadow.mapSize.set(2048,2048); warm.target.position.set(18,0,8); add(warm.target);
const fill=add(new THREE.PointLight(0xffb070,.45,40,2)); fill.position.set(13,H-.5,10);

// ---------- toggles ----------
const T = id => document.getElementById(id);
function apply(){
  djGroup.visible = T('t-dj').checked;
  const led = T('t-led').checked; ledScreen.material = led ? ledOn : mat.led; tableMat.emissiveIntensity = led ? .6 : 0;
  pixBars.visible = T('t-pix').checked; strips.visible = T('t-warm').checked; ledLights.visible = T('t-wash').checked;
  clouds.visible = T('t-ceil').checked; crowd.visible = T('t-crowd').checked;
  bfastG.visible = T('t-bfast').checked; photoG.visible = T('t-photo').checked;
  const lab = T('t-lab').checked, dim = T('t-dim').checked; dimG.visible = dim;
  labels.forEach(l=>l.el.dataset.on = (l.kind==='dim' ? dim : lab) ? '1' : '');
}
['t-dj','t-led','t-pix','t-warm','t-wash','t-ceil','t-crowd','t-bfast','t-photo','t-lab','t-dim'].forEach(id=>T(id).addEventListener('change',apply)); apply();
document.getElementById('spec-pix').textContent = pixBars.userData.n + ' bars'; document.getElementById('pix-n').textContent = pixBars.userData.n + ' bars';
function setCrowd(){ const n=+T('r-crowd').value; [bodyIM,legIM,headIM].forEach(m=>m.count=n); armIM.count=n*2; T('crowd-read').textContent = n + ' dancers shown · floor capacity ≈ 120'; }
T('r-crowd').addEventListener('input',setCrowd); setCrowd();
function setCloud(){ const d=+T('r-cloud').value; clouds.position.y = d; T('cloud-read').textContent = 'lowest cloud ≈ ' + (3.0+d).toFixed(1) + ' m above floor · ceiling 4.8 m'; }
T('r-cloud').addEventListener('input',setCloud); setCloud();

// ---------- camera views ----------
const VIEWS = {
  over:  {p:[40,26,38], t:[14.5,0,9]},
  floor: {p:[24.5,2.2,17.5], t:[3,1.9,9.5]},
  entry: {p:[25.6,1.8,2.4], t:[5,2.0,11]},
  dj:    {p:[6.0,2.0,10], t:[20,1.6,10]},
  top:   {p:[15.5,64,7.01], t:[15.5,0,7]},
  balcony: {p:[24,9,25], t:[35,0,12]}
};
let tween=null;
function go(name, instant){
  const v=VIEWS[name]; document.querySelectorAll('.cams button[data-v]').forEach(b=>b.setAttribute('aria-pressed', b.dataset.v===name));
  const p1=new THREE.Vector3(...v.p), t1=new THREE.Vector3(...v.t);
  if(instant||reduce){ cam.position.copy(p1); ctl.target.copy(t1); ctl.update(); tween=null; return; }
  tween={p0:cam.position.clone(), t0:ctl.target.clone(), p1, t1, s:performance.now(), d:1200};
}
document.querySelectorAll('.cams button[data-v]').forEach(b=>b.addEventListener('click',()=>go(b.dataset.v)));
let balMode='early';
function setBal(m){ balMode=m; balEarly.visible = m==='early'; balLate.visible = m==='late'; document.querySelectorAll('.seg button[data-b]').forEach(b=>b.setAttribute('aria-pressed', b.dataset.b===m)); T('bal-read').textContent = m==='early' ? 'Yoga mats for meditation and sunbath across the wide end.' : 'Mats cleared. Open deck for sunbathing; smoking zone in the far corner.'; }
document.querySelectorAll('.seg button[data-b]').forEach(b=>b.addEventListener('click',()=>setBal(b.dataset.b))); setBal('early');
window.__bal=setBal;
renderer.domElement.addEventListener('pointerdown',()=>{ tween=null; });
go('over', true);

// ---------- loop ----------
function size(){ const w=host.clientWidth, h=host.clientHeight; renderer.setSize(w,h,false); cam.aspect=w/h; cam.updateProjectionMatrix(); }
new ResizeObserver(size).observe(host); size();
let running=true; new IntersectionObserver(es=>{ running=es[0].isIntersecting; },{rootMargin:'100px'}).observe(host);
const tmp=new THREE.Vector3(), dir=new THREE.Vector3(); const clock=new THREE.Clock(); let ledT=0;
renderer.setAnimationLoop(()=>{
  if(!running) return;
  const t=clock.getElapsedTime();
  if(tween){ const k=Math.min(1,(performance.now()-tween.s)/tween.d), ez=k<.5?2*k*k:1-Math.pow(-2*k+2,2)/2; cam.position.lerpVectors(tween.p0,tween.p1,ez); ctl.target.lerpVectors(tween.t0,tween.t1,ez); if(k>=1) tween=null; }
  ctl.update();
  // dollhouse cut-away: hide walls between the camera and the room
  cutWalls.forEach(w=>{ dir.subVectors(cam.position,w.c); dir.y=0; w.o.visible = dir.dot(w.n) <= 0 || cam.position.y < H-.3 && dir.length()<1; });
  ceil.visible = cam.position.y < H-.2;
  if(!reduce){
    if(crowd.visible) poseCrowd(t);
    if(pixBars.visible) colourPixels(t);
    if(T('t-led').checked && t-ledT>.06){ drawLED(t); ledT=t; }
    if(clouds.visible) clouds.rotation.y=0, clouds.children.forEach((c,i)=>{ if(c.geometry.type==='IcosahedronGeometry'||c.geometry.parameters&&c.geometry.parameters.detail===3) c.position.y+=Math.sin(t*.6+i)*.0008; });
    if(djGroup.visible) dj.rotation.y=Math.sin(t*2.4)*.15, dj.position.y=.28+Math.max(0,Math.sin(t*4.8))*.04;
  } else if(ledT===0){ drawLED(1); ledT=1; }
  renderer.render(scene,cam);
  const w=host.clientWidth, h=host.clientHeight;
  labels.forEach(l=>{ if(!l.el.dataset.on || (l.when && l.when!==balMode)){ l.el.hidden=true; return; } tmp.copy(l.v).project(cam); l.el.hidden = tmp.z>1 || Math.abs(tmp.x)>1.05 || Math.abs(tmp.y)>1.05; l.el.style.left=((tmp.x+1)/2*w)+'px'; l.el.style.top=((1-tmp.y)/2*h)+'px'; });
});
drawLED(0);
window.__go = go;
})();
