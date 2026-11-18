(function(){
// Above 11 · Gulshan Club — Winter Daydream layout (zone plan v3). Metres; x west→east, z north→south.
const host = document.getElementById('stage'); const viewer = document.getElementById('viewer');
function fail(){ host.insertAdjacentHTML('beforeend','<div class="fallback">The 3D view needs WebGL, which this browser has turned off. The zone plan shows the same layout.</div>'); }
if(!window.THREE || !THREE.OrbitControls){ fail(); return; }
let renderer;
try{ renderer = new THREE.WebGLRenderer({antialias:true, preserveDrawingBuffer:true}); }catch(e){ fail(); return; }
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
host.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xcdd3d8);
scene.fog = new THREE.Fog(0xcdd3d8, 22, 90);
const cam = new THREE.PerspectiveCamera(40, 1, 0.1, 500);
const ctl = new THREE.OrbitControls(cam, renderer.domElement);
ctl.enableDamping = true; ctl.maxPolarAngle = Math.PI*0.495; ctl.minDistance = 2; ctl.maxDistance = 90;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

const HI = 3.2;      // indoor ceiling
// ---------- footprint (from the Above 11 sketch; approximate) ----------
const IN  = {x0:0,     x1:13.5, z0:4.95, z1:14.3};   // indoor sitting
const LOB = {x0:2.7,   x1:10.25,z0:1.6,  z1:4.8};    // lobby
const STO = {x0:10.35, x1:13.5, z0:0,    z1:4.85};   // storage
const BAR = {x0:2.7,   x1:13.5, z0:14.4, z1:17.6};   // bar counter zone
const BOH = {x0:2.7,   x1:13.5, z0:17.7, z1:21.0};   // back of house
const OUT = {x0:13.6,  x1:25.8, z0:0,    z1:21.7};   // terrace

// ---------- materials ----------
const M = (c,o={}) => new THREE.MeshStandardMaterial(Object.assign({color:c, roughness:.8, metalness:0}, o));
function canvasTex(w,h,draw,rep){ const c=document.createElement('canvas'); c.width=w; c.height=h; draw(c.getContext('2d'),w,h); const t=new THREE.CanvasTexture(c); t.encoding=THREE.sRGBEncoding; t.anisotropy=8; if(rep){t.wrapS=t.wrapT=THREE.RepeatWrapping;} return t; }
const deckTex = canvasTex(128,128,(g,w,h)=>{ g.fillStyle='#8a6a4f'; g.fillRect(0,0,w,h); for(let i=0;i<8;i++){ g.fillStyle=i%2?'#7e6048':'#937259'; g.fillRect(0,i*16,w,15); g.fillStyle='#5a4332'; g.fillRect(0,i*16+15,w,1);} },true);
const marbleTex = canvasTex(256,256,(g,w,h)=>{ g.fillStyle='#1d1f22'; g.fillRect(0,0,w,h); g.strokeStyle='rgba(230,230,230,.55)'; g.lineWidth=1; let s=3; const r=()=>(s=(s*16807)%2147483647)/2147483647; for(let i=0;i<14;i++){ g.beginPath(); let x=r()*w,y=r()*h; g.moveTo(x,y); for(let k=0;k<6;k++){ x+= (r()-.3)*60; y+=(r()-.5)*40; g.lineTo(x,y);} g.stroke(); } },true);
const onyxTex = canvasTex(256,64,(g,w,h)=>{ const gr=g.createLinearGradient(0,0,w,0); gr.addColorStop(0,'#ffb347'); gr.addColorStop(.5,'#ffd27a'); gr.addColorStop(1,'#ff9e3d'); g.fillStyle=gr; g.fillRect(0,0,w,h); g.strokeStyle='rgba(120,60,10,.35)'; for(let i=0;i<20;i++){ g.beginPath(); g.moveTo(Math.random()*w,0); g.bezierCurveTo(Math.random()*w,h*.3,Math.random()*w,h*.7,Math.random()*w,h); g.stroke(); } },true);
const netTex = canvasTex(128,128,(g,w,h)=>{ g.strokeStyle='rgba(255,255,255,.95)'; g.lineWidth=1.6; const s=10; for(let y=-s;y<h+s;y+=s*0.86){ for(let x=-s;x<w+s;x+=s){ const ox=(Math.round(y/(s*.86))%2)*s/2; g.beginPath(); for(let k=0;k<6;k++){ const a=Math.PI/3*k+Math.PI/6; const px=x+ox+Math.cos(a)*s*.55, py=y+Math.sin(a)*s*.55; k?g.lineTo(px,py):g.moveTo(px,py);} g.closePath(); g.stroke(); } } },true);
netTex.repeat.set(3,3);

const mat = {
  deck: M(0xffffff,{map:deckTex}), marble: M(0xffffff,{map:marbleTex, roughness:.25}),
  conc: M(0xcfcac2,{roughness:.9}), dark: M(0x2a2c30,{roughness:.8}), ink: M(0x16161a,{roughness:.5}),
  glass: new THREE.MeshPhysicalMaterial({color:0xcfe3f2, transparent:true, opacity:.18, roughness:.05}),
  plant: M(0x557a4a), planter: M(0x4b3f35), linen: M(0xefe7da), wood: M(0x7a4a2a,{roughness:.55}),
  velvet: M(0x5f7590,{roughness:1}), sofa: M(0xa63d32,{roughness:.9}), leather: M(0xb98258,{roughness:.6}),
  onyx: new THREE.MeshStandardMaterial({map:onyxTex, emissive:0xffa64a, emissiveMap:onyxTex, emissiveIntensity:.9, roughness:.4}),
  ceiling: M(0x2b2b2e,{roughness:1}), steel: M(0x9a9da3,{metalness:.7,roughness:.35})
};
mat.deck.map.repeat.set(5,9); mat.marble.map.repeat.set(3,3);

// ---------- helpers ----------
const add = (o,parent=scene)=>{ parent.add(o); return o; };
function box(w,h,d,m,x,y,z,parent){ const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m); o.position.set(x,y,z); o.castShadow=true; o.receiveShadow=true; return add(o,parent); }
function cyl(r1,r2,h,m,x,y,z,seg=20,parent){ const o=new THREE.Mesh(new THREE.CylinderGeometry(r1,r2,h,seg),m); o.position.set(x,y,z); o.castShadow=true; o.receiveShadow=true; return add(o,parent); }
function floor(r,m,y=0){ const o=box(r.x1-r.x0,.12,r.z1-r.z0,m,(r.x0+r.x1)/2,y-.06,(r.z0+r.z1)/2); o.castShadow=false; return o; }
const cutWalls=[];
function wall(x1,z1,x2,z2,h,m,nx,nz,opts={}){
  const L=Math.hypot(x2-x1,z2-z1), t=opts.t||.2;
  const o=new THREE.Mesh(new THREE.BoxGeometry(L,h,t),m); o.position.set((x1+x2)/2,(opts.y0||0)+h/2,(z1+z2)/2); o.rotation.y=-Math.atan2(z2-z1,x2-x1);
  o.castShadow=!opts.glass; o.receiveShadow=true; add(o);
  if(opts.cut!==false) cutWalls.push({o, c:new THREE.Vector3(o.position.x,0,o.position.z), n:new THREE.Vector3(nx,0,nz).normalize()});
  return o;
}
function group(fn){ const g=new THREE.Group(); const n0=scene.children.length; fn(); scene.children.slice(n0).forEach(o=>g.add(o)); add(g); return g; }
function person(color, parent, x, z, rotY){ const g=new THREE.Group(); const b=new THREE.Mesh(new THREE.CylinderGeometry(.2,.24,1.1,12),M(color)); b.position.y=1.0; const l=new THREE.Mesh(new THREE.CylinderGeometry(.17,.15,.45,10),M(0x22252b)); l.position.y=.22; const h=new THREE.Mesh(new THREE.SphereGeometry(.14,14,12),M(0xc79a78)); h.position.y=1.72; [b,l,h].forEach(m=>{m.castShadow=true; g.add(m);}); g.position.set(x,0,z); g.rotation.y=rotY||0; parent.add(g); return g; }

// ---------- building, floors, walls ----------
box(26.2,30,22.2,mat.conc,12.9,-15.12,10.85).castShadow=false;     // the building below (11 floors)
floor(OUT,mat.deck); floor(IN,mat.marble); floor(BAR,mat.marble); floor(BOH,mat.conc); floor(LOB,mat.marble); floor(STO,mat.conc);
// indoor shell
wall(IN.x0,IN.z0,IN.x0,BAR.z0,HI,mat.dark,-1,0);                                // west
wall(IN.x0,IN.z0,LOB.x0,IN.z0,HI,mat.dark,0,-1);
wall(LOB.x0,LOB.z0,LOB.x0,LOB.z1,HI,mat.conc,-1,0); wall(LOB.x0,LOB.z0,LOB.x1,LOB.z0,HI,mat.conc,0,-1);
wall(STO.x0,STO.z0,STO.x1,STO.z0,HI,mat.conc,0,-1); wall(STO.x0,STO.z0,STO.x0,STO.z1,HI,mat.conc,-1,0,{cut:false});
wall(STO.x1,STO.z0,STO.x1,3.6,HI,mat.conc,1,0); wall(STO.x1,4.5,STO.x1,STO.z1,HI,mat.conc,1,0);   // storage, service gate 3.6–4.5
wall(LOB.x0,LOB.z1,4.3,LOB.z1,HI,mat.conc,0,1,{cut:false}); wall(5.5,LOB.z1,LOB.x1,LOB.z1,HI,mat.conc,0,1,{cut:false}); // lobby gate 4.3–5.5
wall(IN.x0,BAR.z0,BAR.x0,BAR.z0,HI,mat.dark,0,1);
wall(BAR.x0,BAR.z0,BAR.x0,BOH.z1,HI,mat.dark,-1,0); wall(BAR.x0,BOH.z1,BOH.x1,BOH.z1,HI,mat.dark,0,1);
wall(BAR.x0,BOH.z0,BOH.x1-1.2,BOH.z0,HI,mat.dark,0,1,{cut:false,t:.12});
// glazed façade onto the terrace, main gate at z 9.1–10.1, back-of-house door at z 19
[[IN.z0,9.1],[10.1,18.4],[19.6,BOH.z1]].forEach(([a,b])=>{ wall(IN.x1,a,IN.x1,b,HI,mat.glass,1,0,{t:.06,glass:true,cut:false}); for(let z=a;z<=b+.01;z+=1.8) box(.08,HI,.08,mat.ink,IN.x1,HI/2,Math.min(z,b)); });
box(.12,.25,1.0,mat.ink,IN.x1,HI-.12,9.6);
// fluted columns
[[9.2,10.6],[4.2,13.6]].forEach(([x,z])=>cyl(.38,.38,HI,M(0x6f7e93,{roughness:.9}),x,HI/2,z,32));

// ceiling with linear lights (hidden in the dollhouse view)
const ceil = new THREE.Group(); add(ceil);
(function(){
  [[IN],[BAR],[LOB]].forEach(([r])=>{ const c=new THREE.Mesh(new THREE.BoxGeometry(r.x1-r.x0,.1,r.z1-r.z0),mat.ceiling); c.position.set((r.x0+r.x1)/2,HI+.05,(r.z0+r.z1)/2); ceil.add(c); });
})();
const strips = new THREE.Group(); add(strips);
(function(){ const sm=new THREE.MeshBasicMaterial({color:0xfff1d6, toneMapped:false}); [6.6,9.0,11.4,13.2].forEach(z=>{ const s=new THREE.Mesh(new THREE.BoxGeometry(11,.03,.05),sm); s.position.set(7,HI-.02,z); strips.add(s); }); const w=new THREE.Mesh(new THREE.BoxGeometry(10.5,.03,.05),sm); w.position.set(8.1,HI-.02,15.6); strips.add(w); })();

// ---------- terrace edge: glass rail, planters, lamps ----------
(function(){
  wall(OUT.x0,OUT.z0,OUT.x1,OUT.z0,1.1,mat.glass,0,-1,{t:.05,glass:true,cut:false});
  wall(OUT.x1,OUT.z0,OUT.x1,OUT.z1,1.1,mat.glass,1,0,{t:.05,glass:true,cut:false});
  wall(BOH.x0,OUT.z1,OUT.x1,OUT.z1,1.1,mat.glass,0,1,{t:.05,glass:true,cut:false});
  box(.06,.06,OUT.z1,mat.wood,OUT.x1,1.12,OUT.z1/2); box(OUT.x1-OUT.x0,.06,.06,mat.wood,(OUT.x0+OUT.x1)/2,1.12,0);
  const pl=(x,z)=>{ box(.7,.45,.7,mat.planter,x,.23,z); const b=new THREE.Mesh(new THREE.IcosahedronGeometry(.45,1),mat.plant); b.position.set(x,.8,z); b.castShadow=true; add(b); };
  for(let z=4.2;z<19;z+=1.3) pl(OUT.x1-.45,z);
  for(let x=14.4;x<17;x+=1.3) pl(x,.45);
  const lamp=(x,z)=>{ cyl(.05,.05,4.2,mat.ink,x,2.1,z,8); const d=cyl(.7,.7,.05,M(0xffffff,{emissive:0xfff2d8,emissiveIntensity:.6}),x,4.2,z,24); d.rotation.x=.25; };
  lamp(24.9,1.0); lamp(24.9,19.5); lamp(14.2,20.8);
})();

// ---------- distant skyline in the haze ----------
(function(){ let s=7; const r=()=>(s=(s*16807)%2147483647)/2147483647; const bm=[M(0x8e959d),M(0x9fa4aa),M(0x858c95),M(0xa8a59e)];
  const gnd=new THREE.Mesh(new THREE.PlaneGeometry(700,700),M(0x8f9188)); gnd.rotation.x=-Math.PI/2; gnd.position.y=-35; add(gnd);
  for(let i=0;i<46;i++){ const side=i%3; let x,z; if(side===0){ x=60+r()*80; z=-50+r()*120; } else if(side===1){ x=-40+r()*150; z=-90+r()*40; } else { x=-40+r()*150; z=60+r()*40; }
    const w=8+r()*14, d=8+r()*14, h=25+r()*50; const b=box(w,h,d,bm[i%4],x,-35+h/2,z); b.castShadow=false; b.receiveShadow=false; }
})();

// ---------- DJ: riser, booth, LED wall ----------
const djGroup = group(()=>{
  box(6.4,.4,2.7,M(0x2c2622,{roughness:.6}),19.7,.2,1.65);
  box(2.6,1.05,.8,M(0xc9772f,{metalness:.25,roughness:.35,emissive:0x4a2208,emissiveIntensity:.5}),19.7,.4+.525,2.15);
  box(2.65,.05,.85,mat.ink,19.7,.4+1.07,2.15);
  [[17.2,2.2],[22.2,2.2]].forEach(([x,z])=>{ box(.6,.6,.55,mat.ink,x,.4+.3,z); box(.5,.65,.45,mat.ink,x,.4+.6+.33,z); });
});
const dj = person(0x1d1f26, djGroup, 19.7, 1.4, Math.PI); dj.position.y=.4;
const meshTex = canvasTex(256,256,(g,w,h)=>{ g.clearRect(0,0,w,h); g.strokeStyle='#fff'; g.lineWidth=3; for(let i=0;i<=w;i+=16){ g.beginPath(); g.moveTo(i,0); g.lineTo(i,h); g.stroke(); g.beginPath(); g.moveTo(0,i); g.lineTo(w,i); g.stroke(); } },true);
meshTex.repeat.set(4,2);
const meshMat = new THREE.MeshStandardMaterial({color:0x9aa0a6, metalness:.6, roughness:.4, alphaMap:meshTex, transparent:true, side:THREE.DoubleSide, depthWrite:false});
const ledScreen = new THREE.Group(); add(ledScreen);   // wire-mesh backdrop: the city stays visible through it
(function(){ const pane=new THREE.Mesh(new THREE.PlaneGeometry(6.2,3.2),meshMat); pane.position.set(19.7,.4+1.6,.3); ledScreen.add(pane);
  const fr=M(0x3a3d42,{metalness:.6,roughness:.4}); [[16.6],[22.8]].forEach(([x])=>{ const p=new THREE.Mesh(new THREE.BoxGeometry(.08,3.3,.08),fr); p.position.set(x,.4+1.65,.3); ledScreen.add(p); });
  const t=new THREE.Mesh(new THREE.BoxGeometry(6.3,.08,.08),fr); t.position.set(19.7,.4+3.25,.3); ledScreen.add(t); })();
const ledCanvas=document.createElement('canvas'); ledCanvas.width=512; ledCanvas.height=256;
const lg=ledCanvas.getContext('2d'); const ledTex=new THREE.CanvasTexture(ledCanvas); ledTex.encoding=THREE.sRGBEncoding;
const ledOn = new THREE.MeshBasicMaterial({map:ledTex, toneMapped:false});
function drawLED(t){ const w=512,h=256; const gr=lg.createLinearGradient(0,0,w,h); gr.addColorStop(0,'#9ec3e6'); gr.addColorStop(.55,'#f2c08a'); gr.addColorStop(1,'#f2a541'); lg.fillStyle=gr; lg.fillRect(0,0,w,h);
  for(let i=0;i<6;i++){ const cx=w*(.12+i*.16)+Math.sin(t*.4+i)*28, cy=h*(.5+.25*Math.sin(t*.3+i*1.7)); const rg=lg.createRadialGradient(cx,cy,2,cx,cy,95); rg.addColorStop(0,'rgba(255,255,255,.75)'); rg.addColorStop(1,'rgba(255,255,255,0)'); lg.fillStyle=rg; lg.fillRect(0,0,w,h); }
  lg.font='italic 64px Georgia'; lg.fillStyle='rgba(31,39,51,.75)'; lg.textAlign='center'; lg.fillText('Winter Daydream',w/2,h/2+20); ledTex.needsUpdate=true; }


// ---------- stage decor (reference: carved timber frame + hanging flower canopy) ----------
const carveTex = canvasTex(128,512,(g,w,h)=>{ g.fillStyle='#e9cfa6'; g.fillRect(0,0,w,h); g.fillStyle='#b8925f';
  for(let y=40;y<h;y+=64){ const cx=w/2; g.beginPath(); g.arc(cx,y,7,0,7); g.fill(); for(let k=0;k<8;k++){ const a=k*Math.PI/4; g.beginPath(); g.arc(cx+Math.cos(a)*20,y+Math.sin(a)*20,4.5,0,7); g.fill(); } for(let k=0;k<12;k++){ const a=k*Math.PI/6; g.beginPath(); g.arc(cx+Math.cos(a)*34,y+Math.sin(a)*34,2.5,0,7); g.fill(); } }
  g.fillStyle='#d9b886'; g.fillRect(0,0,8,h); g.fillRect(w-8,0,8,h); });
const grassTex = canvasTex(128,128,(g,w,h)=>{ g.fillStyle='#4f7d3a'; g.fillRect(0,0,w,h); for(let i=0;i<1800;i++){ g.fillStyle=`rgba(${60+Math.random()*60|0},${110+Math.random()*70|0},${40+Math.random()*30|0},.9)`; g.fillRect(Math.random()*w,Math.random()*h,1.5,3+Math.random()*4); } },true);
const SD={x0:16.3,x1:23.1,z0:.5,z1:3.25,y:3.9};
const stageDecor = group(()=>{
  const carve=new THREE.MeshStandardMaterial({map:carveTex,roughness:.8}), beamM=M(0xd8b98c,{roughness:.8});
  // carved pillars (front pair facing the floor, back pair at the LED wall)
  [[SD.x0,SD.z1],[SD.x1,SD.z1],[SD.x0,SD.z0],[SD.x1,SD.z0]].forEach(([x,z])=>box(.55,SD.y-.4,.55,carve,x,.4+(SD.y-.4)/2,z));
  box(SD.x1-SD.x0+.9,.45,.5,beamM,(SD.x0+SD.x1)/2,SD.y+.2,SD.z1); box(SD.x1-SD.x0+.9,.45,.5,beamM,(SD.x0+SD.x1)/2,SD.y+.2,SD.z0);
  for(let x=SD.x0;x<=SD.x1+.01;x+=(SD.x1-SD.x0)/5) box(.18,.18,SD.z1-SD.z0,beamM,x,SD.y+.35,(SD.z0+SD.z1)/2);
  // grass-clad booth front
  box(2.8,1.05,.08,new THREE.MeshStandardMaterial({map:grassTex,roughness:1}),19.7,.4+.53,2.6);
  // planter boxes with flowers along the front of the riser
  const bloom=[0xb57ad6,0xf2a7c9,0xffffff,0xffd36b,0xe2557f]; let s2=21; const r2=()=>(s2=(s2*16807)%2147483647)/2147483647;
  [[17.1,3.35],[18.3,3.35],[21.1,3.35],[22.3,3.35]].forEach(([x,z])=>{ box(1.0,.5,.45,M(0xb06a3c,{roughness:.7}),x,.65,z);
    for(let k=0;k<9;k++){ const f=new THREE.Mesh(new THREE.SphereGeometry(.09+r2()*.06,8,6),M(k%3?0x5c8a46:bloom[k%5])); f.position.set(x-.4+r2()*.8,.95+r2()*.18,z-.15+r2()*.3); add(f); } });
  // greenery on top of the frame
  for(let i=0;i<26;i++){ const b=new THREE.Mesh(new THREE.IcosahedronGeometry(.35+r2()*.3,1),M(i%4?0x4f7a42:0x6d9a52)); b.position.set(SD.x0+r2()*(SD.x1-SD.x0),SD.y+.25+r2()*.25,SD.z0+r2()*(SD.z1-SD.z0)); b.scale.y=.6; add(b); }
  // hanging wisteria strands
  const cols=[0x8a4fd0,0xa86ee0,0xc99af0,0xffffff,0xd9e07a,0xc0559f,0x6b3fb0,0xe58ac0];
  const N=440, cone=new THREE.ConeGeometry(.09,1,6); cone.rotateX(Math.PI); cone.translate(0,-.5,0);
  const im=new THREE.InstancedMesh(cone,new THREE.MeshStandardMaterial({color:0xffffff,roughness:.9}),N); const m=new THREE.Matrix4(), c=new THREE.Color();
  for(let i=0;i<N;i++){ const edge=r2()<.55; let x,z; if(edge){ const side=r2()<.6; x=SD.x0-.3+r2()*(SD.x1-SD.x0+.6); z=side?SD.z1+(r2()-.5)*.5:SD.z0+(r2()-.5)*.4; } else { x=SD.x0+r2()*(SD.x1-SD.x0); z=SD.z0+r2()*(SD.z1-SD.z0); }
    const L=.5+r2()*(edge?1.5:1.0), w=.7+r2()*.8; m.compose(new THREE.Vector3(x,SD.y,z),new THREE.Quaternion(),new THREE.Vector3(w,L,w)); im.setMatrixAt(i,m); im.setColorAt(i,c.setHex(cols[i%cols.length])); }
  im.castShadow=true; add(im);
  // lanterns and teal balloons, as in the reference
  const lan=M(0xfff3dc,{roughness:.9});   // paper lanterns, unlit
  [[17.6,3.0,3.1],[19.0,2.8,1.4],[20.6,3.05,3.1],[22.0,2.9,1.6]].forEach(([x,y,z])=>{ cyl(.12,.12,.28,lan,x,y,z,12); cyl(.005,.005,SD.y-y,mat.ink,x,(SD.y+y)/2,z,4); });
  const teal=M(0x3cc8c8,{roughness:.35});
  [[16.2,2.6,.3],[16.5,3.0,.2],[23.1,2.7,.3],[22.8,3.1,.2],[16.0,3.2,.55],[23.4,3.15,.5]].forEach(([x,y,z])=>{ const b=new THREE.Mesh(new THREE.SphereGeometry(.28,16,12),teal); b.position.set(x,y,z); b.scale.y=1.15; b.castShadow=true; add(b); });
});

// ---------- RGB pixel bars on the railing ----------
const pixBars = new THREE.Group(); add(pixBars); const PIX=[];
(function(){
  const xs=[]; for(let z=4.4;z<20.6;z+=2.6) xs.push([OUT.x1-.12,z]); for(let x=16.6;x<24.6;x+=2.6) xs.push([x,OUT.z1-.12]);
  pixBars.userData.n=xs.length;
  const step=.09, y0=.2, y1=2.4, n=Math.floor((y1-y0)/step);
  const im=new THREE.InstancedMesh(new THREE.BoxGeometry(.075,.072,.075),new THREE.MeshBasicMaterial({color:0xffffff,toneMapped:false}),xs.length*n);
  const m=new THREE.Matrix4(); let i=0;
  xs.forEach(([x,z])=>{ box(.1,y1-y0+.1,.1,mat.ink,x,(y0+y1)/2,z,pixBars); for(let k=0;k<n;k++){ const y=y0+k*step; m.makeTranslation(x,y,z); im.setMatrixAt(i,m); PIX.push([x,y,z]); i++; } });
  pixBars.add(im); pixBars.userData.im=im;
})();
const _c=new THREE.Color();
function colourPixels(t){ const im=pixBars.userData.im; PIX.forEach(([x,y,z],i)=>{ const h=((t*.12 + z*.03 + x*.03 - y*.09)%1+1)%1; _c.setHSL(h,1,.55); im.setColorAt(i,_c); }); im.instanceColor.needsUpdate=true; }
colourPixels(0);
const washLights = new THREE.Group(); add(washLights);
[[16,3,5,0x3d6dff,1.2],[23,3,5,0xff8a3d,1.1],[19.7,3.2,8,0xff5f8a,.9]].forEach(([x,y,z,c,i])=>{ const l=new THREE.PointLight(c,i,12,2); l.position.set(x,y,z); washLights.add(l); });

// ---------- cloud canopy on a truss over the dance floor ----------
const clouds = new THREE.Group(); add(clouds);
const DF={x0:15.0,x1:25.0,z0:3.4,z1:12.6};
const CAN={x0:13.8,x1:25.6,z0:.2,z1:21.5};   // canopy over the whole terrace
(function(){
  const tr=M(0x3a3d42,{metalness:.6,roughness:.4}), TH=4.4;
  const xs=[CAN.x0,(CAN.x0+CAN.x1)/2,CAN.x1], zs=[CAN.z0,CAN.z0+(CAN.z1-CAN.z0)/3,CAN.z0+2*(CAN.z1-CAN.z0)/3,CAN.z1];
  xs.forEach(x=>zs.forEach(z=>{ if(x===xs[1]&&z!==CAN.z0&&z!==CAN.z1) return; box(.22,TH,.22,tr,x,TH/2,z,clouds); }));
  zs.forEach(z=>box(CAN.x1-CAN.x0,.22,.22,tr,(CAN.x0+CAN.x1)/2,TH,z,clouds));
  xs.forEach(x=>box(.22,.22,CAN.z1-CAN.z0,tr,x,TH,(CAN.z0+CAN.z1)/2,clouds));
  for(let z=CAN.z0+1.8; z<CAN.z1; z+=1.8) box(CAN.x1-CAN.x0,.05,.05,mat.ink,(CAN.x0+CAN.x1)/2,TH-.05,z,clouds);
  const cols=[0x9ec3e6,0xf2a541,0xffffff,0xe3a6a1,0xb9b2da,0xffd27a];
  let s=11; const rnd=()=>(s=(s*16807)%2147483647)/2147483647;
  for(let i=0;i<130;i++){
    const r=.55+rnd()*.6; const geo=new THREE.IcosahedronGeometry(r,3); const p=geo.attributes.position, v=new THREE.Vector3();
    for(let k=0;k<p.count;k++){ v.fromBufferAttribute(p,k); const n=1+.28*Math.sin(v.x*2.3+i)*Math.cos(v.y*3.1-i)+.18*Math.sin(v.z*3.7+i*.5); v.multiplyScalar(n); p.setXYZ(k,v.x,v.y*.5,v.z); }
    geo.computeVertexNormals(); const c=cols[i%cols.length];
    const x=CAN.x0+.7+rnd()*(CAN.x1-CAN.x0-1.4), z=CAN.z0+.7+rnd()*(CAN.z1-CAN.z0-1.4), y=3.35+rnd()*.55; if(x>15.6&&x<23.8&&z<4.2){ i--; continue; }
    const a=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({color:c,transparent:true,opacity:.35,side:THREE.DoubleSide,depthWrite:false}));
    const b=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({color:c,alphaMap:netTex,transparent:true,side:THREE.DoubleSide,depthWrite:false}));
    [a,b].forEach(m=>{ m.position.set(x,y,z); m.rotation.set(rnd()*.6,rnd()*6.3,rnd()*.6); m.userData.cloud=true; clouds.add(m); });
    const w=new THREE.Mesh(new THREE.CylinderGeometry(.006,.006,TH-y,4),mat.ink); w.position.set(x,y+(TH-y)/2,z); clouds.add(w);
  }
})();

// ---------- dancing crowd ----------
const crowd = new THREE.Group(); add(crowd);
const people=[]; (function(){ let s=5; const rnd=()=>(s=(s*16807)%2147483647)/2147483647; let guard=0;
  while(people.length<160 && guard++<40000){ const x=DF.x0+.4+rnd()*(DF.x1-DF.x0-.8), z=DF.z0+.6+rnd()*(DF.z1-DF.z0-.6); if(people.some(p=>Math.hypot(p.x-x,p.z-z)<.6)) continue; people.push({x,z,ph:rnd()*6.3,sp:2.4+rnd()*1.6,h:.92+rnd()*.16,ry:Math.PI+(rnd()-.5)*1.2}); } })();
const pal=[0xefe7da,0x1d1f26,0x9ec3e6,0xe7b9ad,0xf2a541,0x6f7f6a,0xd9cdb8,0x3b4a6b,0xffffff,0xb85c4a];
const bodyIM=new THREE.InstancedMesh(new THREE.CylinderGeometry(.19,.23,1.1,10), M(0xffffff), people.length);
const legIM=new THREE.InstancedMesh(new THREE.CylinderGeometry(.16,.14,.5,8), M(0x24262c), people.length);
const headIM=new THREE.InstancedMesh(new THREE.SphereGeometry(.135,12,10), M(0xb88c6a), people.length);
const armIM=new THREE.InstancedMesh(new THREE.CylinderGeometry(.05,.05,.6,6), M(0xc79a78), people.length*2);
[bodyIM,legIM,headIM,armIM].forEach(m=>{ m.castShadow=true; crowd.add(m); });
people.forEach((p,i)=>bodyIM.setColorAt(i,new THREE.Color(pal[i%pal.length])));
const m4=new THREE.Matrix4(), q=new THREE.Quaternion(), e=new THREE.Euler(), sc=new THREE.Vector3(), pv=new THREE.Vector3();
function poseCrowd(t){
  people.forEach((p,i)=>{ const b=Math.max(0,Math.sin(t*p.sp+p.ph)); const bob=b*b*.09; const sway=Math.sin(t*p.sp*.5+p.ph)*.12;
    e.set(0,p.ry+sway*.6,sway*.25); q.setFromEuler(e);
    m4.compose(pv.set(p.x,.25+.05*bob,p.z),q,sc.set(1,1,1)); legIM.setMatrixAt(i,m4);
    m4.compose(pv.set(p.x,1.05*p.h+bob,p.z),q,sc.set(1,p.h,1)); bodyIM.setMatrixAt(i,m4);
    m4.compose(pv.set(p.x+Math.sin(sway)*.08,1.72*p.h+bob,p.z),q,sc.set(1,1,1)); headIM.setMatrixAt(i,m4);
    const up=(i%3===0)?Math.max(0,Math.sin(t*p.sp*.5+p.ph)):0.15;
    for(let s=-1;s<=1;s+=2){ q.setFromEuler(new THREE.Euler(0,p.ry,s*(.35+up*1.9))); const off=new THREE.Vector3(0,0,s*.27).applyAxisAngle(new THREE.Vector3(0,1,0),p.ry);
      m4.compose(pv.set(p.x+off.x,1.28*p.h+bob+up*.25,p.z+off.z),q,sc.set(1,1,1)); armIM.setMatrixAt(i*2+(s>0?1:0),m4); } });
  [bodyIM,legIM,headIM,armIM].forEach(m=>m.instanceMatrix.needsUpdate=true);
}
poseCrowd(0);

// ---------- indoor: long tables, welcome drinks, bites lane, Agenda wall ----------
const chair=(x,z,ry)=>{ const g=new THREE.Group(); const s=new THREE.Mesh(new THREE.CylinderGeometry(.28,.26,.45,16),mat.velvet); s.position.y=.23; const b=new THREE.Mesh(new THREE.CylinderGeometry(.3,.3,.4,16,1,true,0,Math.PI),mat.wood); b.position.y=.6; [s,b].forEach(m=>{m.castShadow=true;g.add(m);}); g.position.set(x,0,z); g.rotation.y=ry; add(g); };
const bfastG = group(()=>{
  // Long table A · Table Talks (north–south)
  box(1.3,.06,6.4,mat.wood,2.35,.76,9.6); [[2.35,6.7],[2.35,12.5]].forEach(([x,z])=>box(1.1,.73,.12,mat.wood,x,.37,z));
  for(let z=7.0;z<12.4;z+=.9){ chair(1.35,z,Math.PI/2); chair(3.35,z,-Math.PI/2); }
  // Long table B (east–west, by the terrace gate)
  box(6.1,.06,1.1,mat.wood,9.55,.76,6.75); [[6.7,6.75],[12.4,6.75]].forEach(([x,z])=>box(.12,.73,.95,mat.wood,x,.37,z));
  for(let x=7.0;x<12.4;x+=.9){ chair(x,5.85,0); chair(x,7.65,Math.PI); }
  // welcome drinks, by the lobby gate
  box(1.8,1.0,.6,mat.linen,6.6,.5,5.5); for(let k=0;k<7;k++) cyl(.04,.035,.14,M(0xffe2b0,{transparent:true,opacity:.8}),5.9+k*.22,1.08,5.45,10);
  // bites lane: cocktail tables
  [[6.6,9.6],[8.4,11.4],[10.2,9.6],[6.6,12.6],[10.2,12.6]].forEach(([x,z])=>{ cyl(.35,.35,.04,mat.linen,x,1.08,z,24); cyl(.04,.04,1.06,mat.ink,x,.53,z,8); });
});
const agenda = group(()=>{ box(.12,2.0,2.4,M(0xfbfaf7),13.15,1.15,11.6); for(let i=0;i<24;i++){ const cs=[0x9ec3e6,0xf2a541,0xe3a6a1,0xfbfaf7]; box(.02,.22,.16,M(cs[i%4]),13.08,.55+Math.floor(i/6)*.36,10.65+(i%6)*.38); } });

// ---------- bar, gameboxes, back of house ----------
const barG = group(()=>{
  box(6.6,1.05,.7,mat.onyx,6.2,.53,16.4); box(6.8,.06,.95,M(0xd9d4cc,{roughness:.3}),6.2,1.08,16.45);
  for(let k=0;k<7;k++){ const x=3.4+k*.92; cyl(.22,.18,.12,mat.leather,x,.78,15.7,16); cyl(.03,.03,.72,mat.steel,x,.36,15.7,8); }
  box(6.6,2.2,.35,M(0x3a3632),6.2,1.1,17.5); for(let k=0;k<3;k++) box(6.4,.03,.3,mat.steel,6.2,1.3+k*.45,17.4);
  [4.2,6.2,8.2].forEach(x=>{ for(let k=0;k<5;k++) cyl(.05,.04,.11,M(0xfbfaf7),x-.4+k*.2,1.17,16.4,10); });
});
const gameG = group(()=>{
  const cab=(x)=>{ box(.75,1.75,.7,M(0x1f2733,{roughness:.5}),x,.88,16.3); const s=box(.6,.45,.05,new THREE.MeshBasicMaterial({color:0x5ac8fa,toneMapped:false}),x,1.35,15.94); s.rotation.x=-.2; box(.7,.12,.3,M(0xf2a541),x,1.0,15.85); };
  cab(10.6); cab(11.9);
});
box(5,1.0,.6,M(0x8c8c8c,{metalness:.5,roughness:.4}),8,.5,20.4); box(3,1.0,.6,M(0x8c8c8c,{metalness:.5,roughness:.4}),11.4,.5,18.3);

// ---------- terrace: lounge, art & making, photobooth ----------
const loungeG = group(()=>{
  box(.9,.45,2.4,mat.sofa,14.3,.23,16.2); box(.25,.4,2.4,mat.sofa,13.95,.6,16.2);
  box(.9,.45,2.4,mat.sofa,14.3,.23,19.3); box(.25,.4,2.4,mat.sofa,13.95,.6,19.3);
  cyl(.4,.4,.45,M(0xd8cbb8),15.6,.23,17.8,24);
  [[16.0,15.6],[16.0,20.2]].forEach(([x,z])=>{ const c=cyl(.35,.32,.45,mat.leather,x,.23,z,16); });
});
const artG = group(()=>{
  box(2.6,.05,1.0,mat.linen,22.6,.76,13.6); [[21.5,13.3],[23.7,13.3],[21.5,13.9],[23.7,13.9]].forEach(([x,z])=>cyl(.03,.03,.74,mat.ink,x,.37,z,8));
  const cs=[0x9ec3e6,0xf2a541,0xe3a6a1,0xa9c2a0]; for(let k=0;k<6;k++) box(.32,.02,.24,M(cs[k%4]),21.7+k*.36,.8,13.6);
  [[21.6,15.4],[23.6,15.4]].forEach(([x,z])=>{ const g=new THREE.Group(); [-.2,.2].forEach(dx=>{ const l=new THREE.Mesh(new THREE.BoxGeometry(.04,1.6,.04),mat.wood); l.position.set(dx,.8,0); l.rotation.z=dx*.15; g.add(l); }); const c=new THREE.Mesh(new THREE.BoxGeometry(.6,.75,.03),M(0xfbfaf7)); c.position.set(0,1.15,.05); g.add(c); g.position.set(x,0,z); g.rotation.x=-.12; add(g); });
  [[20.2,17.2],[24.0,17.8],[17.6,14.4],[24.6,13.4]].forEach(([x,z])=>{ cyl(.35,.35,.04,mat.linen,x,1.08,z,24); cyl(.04,.04,1.06,mat.ink,x,.53,z,8); });
});
const photoG = group(()=>{
  box(4.4,2.5,.15,M(0x9ec3e6,{roughness:.5}),21.2,1.25,21.35);
  const rm=M(0xf2a541,{roughness:.5}); for(let k=0;k<5;k++){ const r=new THREE.Mesh(new THREE.TorusGeometry(.26,.035,8,24),rm); r.position.set(19.5+k*.85,1.6+(k%2)*.35,21.25); add(r); }
  box(1.6,.06,1.4,M(0xefe7da),21.2,.03,20.2);
  cyl(.1,.1,1.6,mat.ink,19.0,.8,20.2,10); cyl(.1,.1,1.6,mat.ink,23.4,.8,20.2,10);
  // election-themed placards on a rack
  const cs=[0xfbfaf7,0xf2a541,0x1f2733,0xe3a6a1]; for(let k=0;k<4;k++){ box(.02,.9,.05,mat.wood,24.4,.45+.0,19.4+k*.3); box(.04,.35,.5,M(cs[k]),24.4,1.05,19.4+k*.3); }
});

// ---------- labels ----------
function mkLabel(t,x,y,z,kind){ const el=document.createElement('div'); el.className='label'+(kind==='dim'?' dim':''); el.textContent=t; el.hidden=true; viewer.appendChild(el); return {el,v:new THREE.Vector3(x,y,z),kind}; }
const labels=[['Lobby',6.5,2.4,3.2],['Storage',11.9,2.4,2.4],['Main gate',13.6,2.6,9.6],['Long table · Table Talks',2.35,1.6,9.6],['Long table',9.5,1.6,6.75],['Welcome drinks',6.6,1.8,5.3],['Bites lane',8.4,1.8,11],['Agenda wall',13.0,2.4,11.6],['Coffee & breakfast bar',6.2,2.0,16.4],['Retro Gamebox ×2',11.25,2.2,16.2],['Back of house',8,1.8,19.5],['DJ',19.7,2.4,1.6],['Dance floor',20,.6,8],['Fog threshold',14.4,1.0,9.6],['Art & making',22.6,1.8,14.2],['Open deck · roaming bites',19.4,1.2,16.6],['Lounge',14.6,1.4,17.8],['Photobooth',21.2,2.9,20.6]].map(a=>mkLabel(a[0],a[1],a[2],a[3],'room'));
const dimG=new THREE.Group(); add(dimG);
(function(){ const lm=new THREE.LineBasicMaterial({color:0xc46f1c}); const L=(pts)=>{ const g=new THREE.BufferGeometry().setFromPoints(pts.map(p=>new THREE.Vector3(...p))); dimG.add(new THREE.Line(g,lm)); };
  L([[OUT.x0,.08,-.6],[OUT.x1,.08,-.6]]); L([[OUT.x1+.6,.08,0],[OUT.x1+.6,.08,OUT.z1]]); L([[IN.x0,.08,IN.z0-.4],[IN.x1,.08,IN.z0-.4]]);
  L([[DF.x0,.05,DF.z0],[DF.x1,.05,DF.z0],[DF.x1,.05,DF.z1],[DF.x0,.05,DF.z1],[DF.x0,.05,DF.z0]]); })();
[['Terrace ≈ 12 m',19.7,.3,-.6],['Terrace ≈ 22 m',OUT.x1+.6,.3,10.8],['Indoor ≈ 13.5 m',6.7,.3,IN.z0-.4],['Dance floor ≈ 10 × 9 m',20,.3,DF.z1+.3]].forEach(a=>labels.push(mkLabel(a[0],a[1],a[2],a[3],'dim')));

// ---------- light ----------
const hemi=add(new THREE.HemisphereLight(0xf3f1ec,0x6b5a4a,.85));
const sun=add(new THREE.DirectionalLight(0xffe2bd,.6)); sun.position.set(40,22,-10); sun.castShadow=true;
Object.assign(sun.shadow.camera,{left:-22,right:22,top:22,bottom:-22,near:1,far:120}); sun.shadow.mapSize.set(2048,2048); sun.target.position.set(13,0,11); add(sun.target);
const warmIn=add(new THREE.PointLight(0xffc27a,.6,16,2)); warmIn.position.set(7,HI-.4,10);

// ---------- toggles ----------
const T = id => document.getElementById(id);
const on = id => T(id) ? T(id).checked : true;
function apply(){
  djGroup.visible = on('t-dj'); stageDecor.visible = on('t-flora'); ledScreen.visible = on('t-led');
  pixBars.visible = false; strips.visible = false; washLights.visible = false;   // daytime event: no lighting rig
  clouds.visible = on('t-ceil'); crowd.visible = on('t-crowd');
  bfastG.visible = on('t-bfast'); photoG.visible = on('t-photo'); gameG.visible = on('t-game'); artG.visible = on('t-art'); loungeG.visible = on('t-lounge');
  const lab = on('t-lab') && T('t-lab').checked, dim = T('t-dim') && T('t-dim').checked; dimG.visible = !!dim;
  labels.forEach(l=>l.el.dataset.on = (l.kind==='dim' ? dim : lab) ? '1' : '');
}
['t-dj','t-flora','t-led','t-pix','t-warm','t-wash','t-ceil','t-crowd','t-bfast','t-photo','t-game','t-art','t-lounge','t-lab','t-dim'].forEach(id=>T(id)&&T(id).addEventListener('change',apply)); apply();
if(T('spec-pix')) T('spec-pix').textContent = pixBars.userData.n + ' bars'; if(T('pix-n')) T('pix-n').textContent = pixBars.userData.n + ' bars';
function setCrowd(){ const n=Math.min(people.length,+T('r-crowd').value); [bodyIM,legIM,headIM].forEach(m=>m.count=n); armIM.count=n*2; T('crowd-read').textContent = n + ' dancers shown · floor holds ≈ ' + people.length; }
T('r-crowd').max = people.length; T('r-crowd').addEventListener('input',setCrowd); setCrowd();
function setCloud(){ const d=+T('r-cloud').value; clouds.children.forEach(c=>{ if(c.userData.cloud){ if(c.userData.y0===undefined) c.userData.y0=c.position.y; c.position.y=c.userData.y0+d; } }); T('cloud-read').textContent = 'lowest cloud ≈ ' + (2.9+d).toFixed(1) + ' m above the deck · truss 4.4 m over the whole terrace'; }
T('r-cloud').addEventListener('input',setCloud); setCloud();

// time of day
const SKY={ haze:{bg:0xcdd3d8, fogN:18, fogF:75, hemi:.85, sun:.55, sp:[40,14,-10], read:'9 AM: kuasha over Gulshan, soft light, the skyline half hidden.'},
            sun:{bg:0xa9cbea, fogN:60, fogF:200, hemi:1.0, sun:1.35, sp:[20,45,25], read:'Noon: haze burnt off, sun on the deck, full skyline.'} };
let tod='haze';
function setTod(k){ tod=k; const s=SKY[k]; scene.background.setHex(s.bg); scene.fog.color.setHex(s.bg); scene.fog.near=s.fogN; scene.fog.far=s.fogF; hemi.intensity=s.hemi; sun.intensity=s.sun; sun.position.set(...s.sp);
  document.querySelectorAll('#viewer .seg button[data-b]').forEach(b=>b.setAttribute('aria-pressed', b.dataset.b===k)); if(T('bal-read')) T('bal-read').textContent=s.read; }
document.querySelectorAll('#viewer .seg button[data-b]').forEach(b=>b.addEventListener('click',()=>setTod(b.dataset.b))); setTod('haze');

// ---------- camera views ----------
const VIEWS = {
  over:  {p:[38,24,34], t:[13,0,10]},
  top:   {p:[13,50,10.8], t:[13,0,10.79]},
  floor: {p:[20,2.3,15.2], t:[19.8,1.6,1]},
  entry: {p:[3.9,1.7,5.3], t:[13.5,1.3,12.5]},
  dj:    {p:[19.7,2.1,1.4], t:[19.5,1.2,14]},
  lounge:{p:[12.6,2.3,14.2], t:[2,1,7]}
};
let tween=null;
function go(name, instant){
  const v=VIEWS[name]||VIEWS.over; document.querySelectorAll('.cams button[data-v]').forEach(b=>b.setAttribute('aria-pressed', b.dataset.v===name));
  const p1=new THREE.Vector3(...v.p), t1=new THREE.Vector3(...v.t);
  if(instant||reduce){ cam.position.copy(p1); ctl.target.copy(t1); ctl.update(); tween=null; return; }
  tween={p0:cam.position.clone(), t0:ctl.target.clone(), p1, t1, s:performance.now(), d:1200};
}
document.querySelectorAll('.cams button[data-v]').forEach(b=>b.addEventListener('click',()=>go(b.dataset.v)));
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
  cutWalls.forEach(w=>{ dir.subVectors(cam.position,w.c); dir.y=0; w.o.visible = dir.dot(w.n) <= 0 || (cam.position.y < HI-.3 && dir.length()<1); });
  ceil.visible = cam.position.y < HI-.1;
  // keep the plan readable from above: push the haze back and thin the clouds when the camera is high
  const lift=Math.max(0,cam.position.y-8); scene.fog.near=SKY[tod].fogN+lift*1.6; scene.fog.far=SKY[tod].fogF+lift*1.6;
  const thin = cam.position.y>12 ? .15 : 1; if(thin!==clouds.userData.thin){ clouds.userData.thin=thin; clouds.children.forEach(c=>{ if(c.userData.cloud){ const mt=c.material; if(mt.userData.base===undefined) mt.userData.base=mt.opacity; mt.opacity=mt.userData.base*thin; } }); }
  if(!reduce){
    if(crowd.visible) poseCrowd(t);
    if(djGroup.visible){ dj.rotation.y=Math.PI+Math.sin(t*2.4)*.15; dj.position.y=.4+Math.max(0,Math.sin(t*4.8))*.04; }
  }
  renderer.render(scene,cam);
  const w=host.clientWidth, h=host.clientHeight;
  labels.forEach(l=>{ if(!l.el.dataset.on){ l.el.hidden=true; return; } tmp.copy(l.v).project(cam); l.el.hidden = tmp.z>1 || Math.abs(tmp.x)>1.05 || Math.abs(tmp.y)>1.05; l.el.style.left=((tmp.x+1)/2*w)+'px'; l.el.style.top=((1-tmp.y)/2*h)+'px'; });
});
drawLED(0);
window.__go = go; window.__tod = setTod;
})();
