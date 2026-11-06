import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';

const Q=new URLSearchParams(location.search);
const V=(x,y,z)=>new THREE.Vector3(x,y,z);
const VA=a=>new THREE.Vector3(a[0],a[1],a[2]);
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
const sstep=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t)};
const lerp=(a,b,t)=>a+(b-a)*t;
const M=window.LARINGE_MODELO, L=M.L;
const SIDES={R:-1,L:1}; // lado direito do paciente = x negativo
const XM=(L.vpR[0]+L.vpL[0])/2; // linha do meio

/* ---------- cena ---------- */
const canvas=document.getElementById('c');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true,preserveDrawingBuffer:Q.has('shot')});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=.95;
renderer.localClippingEnabled=true;
const scene=new THREE.Scene();
scene.environment=new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(),.04).texture;
const camera=new THREE.PerspectiveCamera(30,1,.1,200);
const controls=new OrbitControls(camera,canvas);
controls.enableDamping=true; controls.dampingFactor=.09; controls.minDistance=1.2; controls.maxDistance=40; controls.screenSpacePanning=true;
controls.zoomToCursor=true; controls.zoomSpeed=.85; controls.rotateSpeed=.75; controls.panSpeed=.9;
const TARGET0=V(XM,-.3,0);
const HOME=V(-12.5,6,19.5).multiplyScalar(innerWidth<innerHeight?1.55:1).add(TARGET0);
camera.position.copy(HOME); controls.target.copy(TARGET0);
scene.add(new THREE.HemisphereLight(0xffffff,0x2a1850,.55));
const key=new THREE.DirectionalLight(0xffffff,1.75); key.position.set(-4,8,7); scene.add(key);
const fill=new THREE.DirectionalLight(0xb49bff,.7); fill.position.set(7,2,-3); scene.add(fill);
const rim=new THREE.DirectionalLight(0xffb27a,.85); rim.position.set(-2,5,-8); scene.add(rim);
const root=new THREE.Group(); scene.add(root);

/* ---------- materiais ---------- */
const cutU={value:0}; const clipPlanes=[];
function fibras(){const c=document.createElement('canvas');c.width=c.height=256;const g=c.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,256,256);
  for(let y=0;y<256;y+=2){const v=195+Math.random()*60|0;g.fillStyle=`rgb(${v},${v},${v})`;g.fillRect(0,y,256,1+(Math.random()*2|0));}
  const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.colorSpace=THREE.SRGBColorSpace;return t;}
const FIB=fibras();
const KIND={
  cartilagem:{roughness:.36,clearcoat:.5,clearcoatRoughness:.3,sheen:.5,sheenColor:new THREE.Color('#ffffff'),sheenRoughness:.6},
  osso:{roughness:.7,clearcoat:.12},
  musculo:{roughness:.5,clearcoat:.35,clearcoatRoughness:.4,map:FIB,bumpMap:FIB,bumpScale:.8},
  ligamento:{roughness:.35,clearcoat:.6,clearcoatRoughness:.3},
  prega:{roughness:.2,clearcoat:1,clearcoatRoughness:.12,opacity:.92},
  mucosa:{roughness:.3,clearcoat:.8,clearcoatRoughness:.25,opacity:.72},
  membrana:{roughness:.5,clearcoat:.3,opacity:.4},
};
function makeMat(kind,color){
  const o=KIND[kind];
  const m=new THREE.MeshPhysicalMaterial({...o,color:new THREE.Color(color),side:THREE.DoubleSide,clippingPlanes:clipPlanes,transparent:(o.opacity??1)<1,depthWrite:(o.opacity??1)>=.6});
  m.userData.baseOpacity=o.opacity??1; m.userData.cap=new THREE.Color(color).multiplyScalar(.8);
  m.onBeforeCompile=sh=>{sh.uniforms.uCap={value:m.userData.cap};sh.uniforms.uCut=cutU;
    sh.fragmentShader='uniform vec3 uCap;\nuniform float uCut;\n'+sh.fragmentShader.replace('#include <dithering_fragment>','#include <dithering_fragment>\nif(uCut>0.5 && !gl_FrontFacing){ gl_FragColor.rgb = uCap; }');};
  return m;
}

/* ---------- partes ---------- */
const GRUPOS=[['Cartilagens',['tireoide','cricoide','aritenoides','corniculadas','cuneiformes','epiglote']],
  ['Músculos',['ct','ta','vocal','te','cap','cal','ia','ae','th']],
  ['Pregas e ligamentos',['pregas','ligvocal','vestibulares','ariepiglotica','mth','mct','lhe','lte']],
  ['Osso e via aérea',['hioide','traqueia']]];
const INFO={
 tireoide:{nome:'Cartilagem tireoide',tag:'Cartilagem',kind:'cartilagem',real:'#c3d1d9',atlas:'#34BF97',view:[-.5,.25,1],
  oq:'A maior cartilagem da laringe. As duas lâminas se juntam na frente e formam o pomo de Adão (mais saliente nos homens). De cada lado tem dois cornos: o superior, que sobe em direção ao hioide, e o inferior, que se articula com a cricoide.',
  canto:'Ela gira pra frente e pra baixo sobre a cricoide, apoiada nos cornos inferiores. Esse movimento estica as pregas e deixa o som mais agudo.',act:['agudo','Ver a tireoide inclinar']},
 cricoide:{nome:'Cartilagem cricoide',tag:'Cartilagem',kind:'cartilagem',real:'#bfcdd6',atlas:'#F28A73',view:[-.7,.15,1],
  oq:'O único anel completo das vias aéreas e a base da laringe. É baixa na frente e alta atrás, como um anel de sinete.',
  canto:'É o apoio de tudo: as aritenoides ficam em cima dela, atrás, e a tireoide se articula nas laterais.',act:['agudo','Ver a tireoide girar sobre ela']},
 aritenoides:{nome:'Cartilagens aritenoides',tag:'Cartilagem',kind:'cartilagem',real:'#c8d4db',atlas:'#4A55C8',view:[-.15,1,-.6],
  oq:'Duas pirâmides pequenas apoiadas na parte de trás da cricoide. Cada uma tem uma ponta na frente (processo vocal), onde a prega vocal se prende, e uma do lado (processo muscular), onde os músculos puxam.',
  canto:'Elas giram e deslizam. Pra dentro, fecham as pregas pra cantar ou falar. Pra fora, abrem pra respirar.',act:['alterna','Ver abrir e fechar']},
 corniculadas:{nome:'Cartilagens corniculadas',tag:'Cartilagem',kind:'cartilagem',real:'#e6dfc4',atlas:'#262B8C',view:[-.2,.9,-.7],
  oq:'Duas cartilagens minúsculas em forma de chifre, na ponta de cada aritenoide.',
  canto:'Dão forma à borda de trás da entrada da laringe e acompanham as aritenoides quando elas se mexem.',act:['alterna','Ver acompanhando as aritenoides']},
 cuneiformes:{nome:'Cartilagens cuneiformes',tag:'Cartilagem',kind:'cartilagem',real:'#e8dfbf',atlas:'#3B3FA8',view:[-.5,.8,-.6],
  oq:'Bastõezinhos de cartilagem dentro da prega ariepiglótica, na frente das corniculadas.',
  canto:'Dão firmeza às paredes da entrada da laringe, que fica logo acima das pregas.'},
 epiglote:{nome:'Epiglote',tag:'Cartilagem',kind:'cartilagem',real:'#e6d8a8',atlas:'#6A63D0',view:[-1,.35,-.45],
  oq:'Cartilagem elástica (flexível) em forma de folha. Tem uma face lingual, virada pra língua, e uma face laríngea, virada pra dentro da laringe. A haste se prende por dentro da tireoide.',
  canto:'Ao engolir, o osso hioide sobe e faz a epiglote se mover pra trás (dorsalmente) e cobrir a abertura da laringe. Ao cantar, ela fica levantada e o caminho do som fica livre.',act:['engolir','Ver engolindo']},
 ct:{nome:'Músculo cricotireóideo',tag:'Músculo',kind:'musculo',real:'#b23a45',atlas:'#E5484D',view:[-.75,.05,1],
  oq:'Liga o arco da cricoide à borda de baixo da tireoide, na frente e dos lados. Tem uma parte reta e uma oblíqua. É o único músculo da laringe que fica do lado de fora dela.',
  canto:'É o músculo do agudo. Ao contrair, inclina a tireoide pra frente e estica as pregas, que ficam longas e finas.',act:['agudo','Ver ele contraindo']},
 ta:{nome:'Músculo tireoaritenóideo',tag:'Músculo',kind:'musculo',real:'#9e2b38',atlas:'#C2185B',view:[-.1,1,-.3],
  oq:'Vai da parte de dentro da tireoide até a aritenoide, por fora do músculo vocal. Forma o corpo da prega vocal.',
  canto:'É o músculo do grave e da voz de peito: encurta e engrossa a prega. Trabalha em equilíbrio com o cricotireóideo.',act:['grave','Ver ele encurtando']},
 vocal:{nome:'Músculo vocal',tag:'Músculo',kind:'musculo',real:'#8f2333',atlas:'#B5174E',view:[-.1,1,-.3],
  oq:'A parte de dentro do tireoaritenóideo, colada no ligamento vocal. É o miolo da prega que vibra.',
  canto:'Ajusta a tensão e a espessura da borda que vibra. Muito ativo na voz de peito.',act:['grave','Ver a prega encurtando']},
 te:{nome:'Músculo tireoepiglótico',tag:'Músculo',kind:'musculo',real:'#a0303d',atlas:'#C74A63',view:[-1,.4,.2],
  oq:'Feixe de cima do tireoaritenóideo, que sobe da parte de dentro da tireoide até a borda da epiglote.',
  canto:'Puxa a epiglote pra frente e alarga a entrada da laringe, ajudando a reabrir o caminho depois de engolir.',act:['engolir','Ver a epiglote se mexendo']},
 cap:{nome:'Cricoaritenóideo posterior',tag:'Músculo',kind:'musculo',real:'#a83542',atlas:'#FF7043',view:[-.35,.25,-1],
  oq:'Fica nas costas da cricoide e puxa o processo muscular da aritenoide pra trás.',
  canto:'É o único músculo que abre as pregas. Trabalha a cada respiração, inclusive entre uma frase e outra.',act:['respirar','Ver abrindo as pregas']},
 cal:{nome:'Cricoaritenóideo lateral',tag:'Músculo',kind:'musculo',real:'#a3303c',atlas:'#D84315',view:[-1,.45,.1],
  oq:'Vai da lateral do arco da cricoide até o processo muscular da aritenoide, por dentro da tireoide.',
  canto:'Gira a aritenoide pra dentro e aproxima os processos vocais: ajuda a fechar as pregas.',act:['cantar','Ver fechando as pregas']},
 ia:{nome:'Interaritenóideo',tag:'Músculo',kind:'musculo',real:'#982a36',atlas:'#AD1457',view:[0,.45,-1],
  oq:'Liga uma aritenoide à outra por trás. As fibras transversas vão retas; as oblíquas cruzam em X e continuam como ariepiglótico.',
  canto:'Junta as aritenoides e fecha a parte de trás da glote. Quando ele não fecha bem, o som sai soproso.',act:['cantar','Ver juntando as aritenoides']},
 ae:{nome:'Músculo ariepiglótico',tag:'Músculo',kind:'musculo',real:'#a5323f',atlas:'#E2566A',view:[-.6,.7,-.8],
  oq:'Vai do ápice da aritenoide até a borda da epiglote, por dentro da prega ariepiglótica. É a continuação do interaritenóideo oblíquo.',
  canto:'Estreita a entrada da laringe e ajuda a epiglote a fechar ao engolir. Esse estreitamento também é o do twang.',act:['engolir','Ver fechando a entrada']},
 th:{nome:'Músculo tíreo-hióideo',tag:'Músculo de fora',kind:'musculo',real:'#b8434c',atlas:'#D9534F',view:[-.8,.25,1],
  oq:'Vai da lâmina da tireoide até o osso hioide, por fora da laringe.',
  canto:'Aproxima a tireoide do hioide. Faz parte do grupo de músculos que muda a altura da laringe no canto.',act:['engolir','Ver a laringe subindo']},
 pregas:{nome:'Pregas vocais',tag:'Pregas',kind:'prega',real:'#f4ecea',atlas:'#FFFFFF',view:[0,1,-.35],
  oq:'Duas pregas de mucosa branco-perolada, com o ligamento vocal e o músculo vocal por dentro. Vão da tireoide (na frente) até as aritenoides (atrás). O espaço entre elas é a glote.',
  canto:'Fechadas, o ar empurra de baixo (pressão subglótica), elas se abrem e fecham centenas de vezes por segundo: isso é o som. Aqui, em câmera lenta.',act:['cantar','Ver vibrando']},
 ligvocal:{nome:'Ligamento vocal',tag:'Ligamento',kind:'ligamento',real:'#efe4c8',atlas:'#F4D35E',view:[0,1,-.35],
  oq:'A borda firme da prega vocal, da tireoide até o processo vocal da aritenoide. É a parte de cima do cone elástico.',
  canto:'No agudo ele fica esticado e fino; é ele que segura a tensão da prega.',act:['agudo','Ver ele esticando']},
 vestibulares:{nome:'Pregas vestibulares',tag:'Pregas',kind:'mucosa',real:'#d6808c',atlas:'#F48FB1',view:[0,1,-.3],
  oq:'Também chamadas de falsas pregas. Ficam logo acima das vocais, e entre as duas existe um espaço chamado ventrículo.',
  canto:'No canto saudável ficam afastadas. Quando apertam, a voz sai presa, constrita.'},
 ariepiglotica:{nome:'Prega ariepiglótica',tag:'Pregas',kind:'mucosa',real:'#e39aa4',atlas:'#F8BBD0',view:[-.3,.9,-.8],
  oq:'Prega de mucosa que vai da borda da epiglote até as aritenoides. Forma as paredes da entrada da laringe.',
  canto:'Estreitar essa região (o tubo epilaríngeo) dá o brilho metálico do twang.'},
 mth:{nome:'Membrana tíreo-hióidea',tag:'Membrana',kind:'membrana',real:'#ead8c3',atlas:'#FFE082',view:[-.35,.25,1],
  oq:'Liga a borda de cima da tireoide ao osso hioide. É por ela que a laringe fica pendurada.',
  canto:'Quando a laringe sobe ou desce, essa membrana encurta ou alonga.',act:['engolir','Ver a laringe subindo']},
 mct:{nome:'Ligamento cricotireóideo',tag:'Ligamento',kind:'ligamento',real:'#ebd5bb',atlas:'#FFCC80',view:[-.3,-.1,1],
  oq:'Liga a borda de baixo da tireoide ao arco da cricoide, na frente, entre os dois cricotireóideos.',
  canto:'Esse espaço fecha quando a tireoide inclina no agudo.',act:['agudo','Ver o espaço fechando']},
 lhe:{nome:'Ligamento hioepiglótico',tag:'Ligamento',kind:'ligamento',real:'#e8d6b6',atlas:'#9FA8DA',view:[-1,.4,.3],
  oq:'Liga a face lingual da epiglote ao osso hioide.',
  canto:'Quando o hioide sobe ao engolir, esse ligamento ajuda a levar a epiglote pra trás.',act:['engolir','Ver engolindo']},
 lte:{nome:'Ligamento tireoepiglótico',tag:'Ligamento',kind:'ligamento',real:'#e8d6b6',atlas:'#7986CB',view:[-1,.4,.3],
  oq:'Prende a haste (pecíolo) da epiglote por dentro da tireoide, logo acima das pregas.',
  canto:'É o ponto fixo de baixo da epiglote: ela gira em volta dele ao engolir.',act:['engolir','Ver engolindo']},
 hioide:{nome:'Osso hioide',tag:'Osso',kind:'osso',real:'#ecdfc2',atlas:'#EE7D6C',view:[-.4,.55,1],
  oq:'Osso em forma de U acima da laringe. É o único osso do corpo que não se encaixa em nenhum outro: a laringe fica pendurada nele.',
  canto:'Língua e mandíbula puxam o hioide. Tensão na base da língua sobe e trava a laringe.',act:['engolir','Ver subindo ao engolir']},
 traqueia:{nome:'Traqueia',tag:'Via aérea',kind:'cartilagem',real:'#c2d0d8',atlas:'#B9A6F2',view:[-.55,.05,1],
  oq:'Tubo de anéis de cartilagem em forma de C, abertos atrás, onde fica um músculo liso. Liga os pulmões à laringe.',
  canto:'É por aqui que o ar sobe e chega embaixo das pregas. Use o corte “Ao meio” pra ver o ar passando.',act:['respirar','Ver o ar passando']},
};
const P={}; for(const [id,i] of Object.entries(INFO)) P[id]={id,...i,meshes:[],mats:[],visible:true};
let colorMode=Q.get('cores')==='real'?'real':'atlas';

function addMesh(id,geo,parent){
  const p=P[id]; const mat=makeMat(p.kind,p[colorMode]);
  const m=new THREE.Mesh(geo,mat); m.userData.part=id; parent.add(m); p.meshes.push(m); p.mats.push(mat); return m;
}

/* ---------- ossos (peças que se mexem) ---------- */
function bone(pivot){const piv=new THREE.Group();piv.position.copy(pivot);root.add(piv);const inner=new THREE.Group();inner.position.copy(pivot).negate();piv.add(inner);return {piv,inner,pivot:pivot.clone()};}
const JMID=VA(L.jointR).add(VA(L.jointL)).multiplyScalar(.5);
const B={
  cricoide:bone(V(0,0,0)), traqueia:bone(V(0,0,0)), hioide:bone(V(0,0,0)),
  tireoide:bone(JMID),
  arR:bone(VA(L.arBaseR)), arL:bone(VA(L.arBaseL)),
  epiglote:bone(VA(L.epiLow).add(V(0,.75,-.08))),
};
const rel=new THREE.Matrix4(), rootInv=new THREE.Matrix4();
function boneMat(b,out){root.updateMatrixWorld(true);rootInv.copy(root.matrixWorld).invert();return out.multiplyMatrices(rootInv,B[b].inner.matrixWorld);}
const toRoot=(b,p)=>(p.isVector3?p.clone():VA(p)).applyMatrix4(boneMat(b,new THREE.Matrix4()));

/* ---------- carrega o modelo ---------- */
const b64=(s,T)=>{const bin=atob(s);const u=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);return new T(u.buffer);};
const SOFTCFG={ // [osso A, ponto A, osso B, ponto B]
  ligvocal:s=>['tireoide',L.ac,'ar'+s,L['vp'+s]], vocal:s=>['tireoide',L.ac,'ar'+s,L['vp'+s]],
  ta:s=>['tireoide',L.ac,'ar'+s,L['vp'+s]],
  te:s=>['tireoide',[L.ac[0],L.ac[1]+.1,L.ac[2]],'epiglote',L.epiEdge[s][7]],
  cap:s=>['cricoide',[SIDES[s]*.25+XM,-.55,-1.15],'ar'+s,L['arMusc'+s]],
  cal:s=>['cricoide',[SIDES[s]*.95+XM,-.1,.05],'ar'+s,L['arMusc'+s]],
  ct:s=>['cricoide',[SIDES[s]*.55+XM,-.75,.35],'tireoide',[SIDES[s]*.95+XM,.55,.25]],
  ia:()=>['arR',[L.arBaseR[0],1.2,-.85],'arL',[L.arBaseL[0],1.2,-.85]],
  ae:s=>['ar'+s,L['arApex'+s],'epiglote',L.epiEdge[s][6]],
  th:s=>['tireoide',[SIDES[s]*1.3,.4,.8],'hioide',[SIDES[s]*1.3,3.3,1.0]],
  lhe:()=>['epiglote',[0,2.6,.6],'hioide',[0,3.1,2.0]],
  lte:()=>['tireoide',[0,1.1,1.35],'epiglote',L.epiLow],
  mct:()=>['cricoide',L.crFront,'tireoide',[0,.45,1.45]],
};
const SOFT=[];
for(const mm of M.meshes){
  const pos=b64(mm.pos,Float32Array), idx=b64(mm.idx,Uint16Array);
  const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.BufferAttribute(pos.slice(),3)); g.setIndex(new THREE.BufferAttribute(idx,1));
  if(mm.bone!=='soft'){ g.computeVertexNormals(); addMesh(mm.part,g,B[mm.bone].inner); continue; }
  let part=mm.part; if(part==='ta'&&/FJ2803|FJ2785/.test(mm.name)) part='te';
  const side=mm.side||(mm.name.includes('right')?'R':'L');
  const [ba,pa,bb,pb]=SOFTCFG[part](side); const A=VA(pa),Bp=VA(pb),D=Bp.clone().sub(A),dl=D.lengthSq();
  const n=pos.length/3, w=new Float32Array(n), uv=new Float32Array(n*2); const perp=V(-D.z,0,D.x).normalize(); if(perp.lengthSq()<.5)perp.set(1,0,0);
  for(let i=0;i<n;i++){const p=V(pos[i*3],pos[i*3+1],pos[i*3+2]);const t=p.clone().sub(A).dot(D)/dl;w[i]=sstep(-.05,1.05,t);uv[i*2]=t;uv[i*2+1]=p.dot(perp)*2.2;}
  g.setAttribute('uv',new THREE.BufferAttribute(uv,2)); g.computeVertexNormals();
  const mesh=addMesh(part,g,root); mesh.frustumCulled=false; mesh.userData.soft=true;
  SOFT.push({mesh,rest:pos,w,ba,bb});
}
const mA=new THREE.Matrix4(), mB=new THREE.Matrix4(), e1=new Float32Array(16), e2=new Float32Array(16);
function skin(s){
  boneMat(s.ba,mA); boneMat(s.bb,mB); mA.toArray(e1); mB.toArray(e2);
  const r=s.rest, w=s.w, a=s.mesh.geometry.attributes.position.array;
  for(let i=0,n=w.length;i<n;i++){const x=r[i*3],y=r[i*3+1],z=r[i*3+2],t=w[i],u=1-t;
    a[i*3]  =u*(e1[0]*x+e1[4]*y+e1[8]*z+e1[12])+t*(e2[0]*x+e2[4]*y+e2[8]*z+e2[12]);
    a[i*3+1]=u*(e1[1]*x+e1[5]*y+e1[9]*z+e1[13])+t*(e2[1]*x+e2[5]*y+e2[9]*z+e2[13]);
    a[i*3+2]=u*(e1[2]*x+e1[6]*y+e1[10]*z+e1[14])+t*(e2[2]*x+e2[6]*y+e2[10]*z+e2[14]);}
  const g=s.mesh.geometry; g.attributes.position.needsUpdate=true; g.computeVertexNormals(); g.boundingSphere=null; g.boundingBox=null;
}

/* ---------- pregas, vestibulares, prega ariepiglótica e membrana (feitas aqui) ---------- */
function grid(nu,nv,closeU,closeV){
  const cu=closeU?nu:nu+1, cv=closeV?nv:nv+1, g=new THREE.BufferGeometry(), idx=[];
  for(let i=0;i<nu;i++)for(let j=0;j<nv;j++){const i1=(i+1)%cu,j1=(j+1)%cv;const a=i*cv+j,b=i1*cv+j,c=i1*cv+j1,d=i*cv+j1;idx.push(a,b,d,b,c,d);}
  g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(cu*cv*3),3)); g.setIndex(idx);
  g.fill=function(fn){const a=this.attributes.position;for(let i=0;i<cu;i++)for(let j=0;j<cv;j++){const p=fn(i,j,i/nu,j/nv);a.setXYZ(i*cv+j,p.x,p.y,p.z);}
    a.needsUpdate=true;this.computeVertexNormals();this.boundingSphere=null;this.boundingBox=null;};
  return g;
}
const resample=(poly,n)=>new THREE.CatmullRomCurve3(poly.map(p=>V(p[0],p[1],0)),true,'centripetal').getSpacedPoints(n).slice(0,n).map(p=>[p.x,p.y]);
const DYN=[];
function dyn(id,nu,nv,closeU,closeV,upd){const g=grid(nu,nv,closeU,closeV);const m=addMesh(id,g,root);m.frustumCulled=false;m.userData.soft=true;DYN.push({mesh:m,upd});return m;}
function slab(a,b,out,th,bulge){
  const n=a.length; return (i,j,u)=>{let k=j,layer=1;if(j>=n){k=2*n-1-j;layer=-1;}
    const s=Math.sin(Math.PI*u),ed=Math.sin(Math.PI*clamp(k/(n-1),0,1));
    return a[k].clone().lerp(b[k],u).addScaledVector(out[k],bulge*s+layer*th*.5*(.3+.7*Math.sqrt(ed))*(.55+.45*s));};
}
const SEC_M=resample([[0,.02],[.04,.05],[.17,.07],[.2,-.06],[.15,-.24],[.03,-.08]],16);
const SEC_V=resample([[0,0],[.12,.09],[.26,.06],[.24,-.07],[.08,-.06]],14);
let tNow=0;
const S={open:1,tilt:0,sw:0,short:0,vib:0,explode:0}, T={...S};
const freq=()=>1.5+1.5*S.tilt-.4*S.short;
function foldFn(A,Bp,sg,sec,thick,vib){
  const X=Bp.clone().sub(A),len=X.length();X.normalize();
  const Z=X.clone().cross(V(0,1,0)).normalize(); if(Z.x*sg<0)Z.negate(); const Y=Z.clone().cross(X).normalize(); if(Y.y<0)Y.negate();
  return (i,j,u)=>{const f=.35+.65*Math.pow(Math.sin(Math.PI*u),.6);const [lat,y]=sec[j%sec.length];const off=vib*Math.sin(Math.PI*u);
    return A.clone().addScaledVector(X,u*len).addScaledVector(Z,lat*f+off).addScaledVector(Y,y*f*thick);};
}
const vibAmt=()=>.06*S.vib*(1-clamp(S.open*3,0,1))*Math.max(0,Math.sin(tNow*Math.PI*2*freq()));
for(const s of ['R','L']){
  const sg=SIDES[s];
  const AC=VA(L['ac'+s]).add(V(0,.0,-.02)), VP=VA(L['vp'+s]);
  dyn('pregas',26,16,false,true,()=>foldFn(toRoot('tireoide',AC),toRoot('ar'+s,VP).add(V(-sg*.02,0,.02)),sg,SEC_M,(1-.35*S.tilt)*(1+.3*S.short),vibAmt()));
  const vA=AC.clone().add(V(sg*.05,.42,-.05)), vB=VP.clone().add(V(sg*.12,.38,-.12));
  dyn('vestibulares',22,14,false,true,()=>foldFn(toRoot('tireoide',vA),toRoot('ar'+s,vB),sg,SEC_V.map(([a,b])=>[a+.02,b]),1,0));
  const N=10;
  dyn('ariepiglotica',14,2*N,false,true,()=>{const a=[],b=[],o=[];for(let k=0;k<N;k++){const t=k/(N-1);
    a.push(toRoot('epiglote',L.epiEdge[s][Math.round(t*7)]));
    const q=t<.7?VA(L['vp'+s]).add(V(sg*.12,.45,-.15)).lerp(VA(L['arApex'+s]),t/.7):VA(L['arApex'+s]).lerp(VA(L['corn'+s]),(t-.7)/.3);
    b.push(toRoot('ar'+s,q));o.push(V(sg,0,0));}return slab(a,b,o,.05,.04);});
}
{const n=L.thyTop.length; dyn('mth',22,2*n,false,true,()=>{const a=[],b=[],o=[];for(let k=0;k<n;k++){const pa=toRoot('tireoide',L.thyTop[k]);a.push(pa);b.push(toRoot('hioide',L.hyBot[k]).add(V(0,-.02,-.05)));o.push(V(pa.x*.3,0,1).normalize());}return slab(a,b,o,.025,.12);});}

/* ---------- ar ---------- */
const AC0=VA(L.ac), VPm=VA(L.vpR).add(VA(L.vpL)).multiplyScalar(.5), GL=AC0.clone().add(VPm).multiplyScalar(.5);
const INLET=VA(L.arApexR).add(VA(L.arApexL)).multiplyScalar(.5).lerp(VA(L.epiEdge.R[4]).add(VA(L.epiEdge.L[4])).multiplyScalar(.5),.5);
const knots=[...L.trCenter.map(c=>[V(c[0],c[1],c[2]),c[3]*.8,c[3]*.75]),[GL.clone().add(V(0,-.5,0)),.5,.65],[GL,.3,.62],[GL.clone().add(V(0,.45,0)),.35,.5],[INLET,.38,.45],[INLET.clone().add(V(0,2.2,.2)),.5,.5]];
const PATH=new THREE.CatmullRomCurve3(knots.map(k=>k[0]));
const KS=knots.map((k,i)=>i/(knots.length-1)); const GATE=KS[knots.length-4];
const radAt=(s,idx)=>{for(let i=0;i<KS.length-1;i++)if(s<=KS[i+1]){const t=(s-KS[i])/(KS[i+1]-KS[i]);return lerp(knots[i][idx],knots[i+1][idx],t);}return knots.at(-1)[idx];};
const NP=260, airPos=new Float32Array(NP*3), AIR=[];
for(let i=0;i<NP;i++)AIR.push({s:Math.random(),a:Math.random()*6.28,r:Math.sqrt(Math.random()),sp:.06+Math.random()*.04});
const airGeo=new THREE.BufferGeometry(); airGeo.setAttribute('position',new THREE.BufferAttribute(airPos,3));
const air=new THREE.Points(airGeo,new THREE.PointsMaterial({color:0xFFDA00,size:.06,transparent:true,opacity:.95,depthWrite:false,clippingPlanes:clipPlanes}));
root.add(air);
function stepAir(dt){
  const open=S.open>.2||(S.vib>.5&&Math.sin(tNow*Math.PI*2*freq())>.5);
  for(let i=0;i<NP;i++){const p=AIR[i];let ns=p.s+dt*p.sp*(S.open>.2?1.5:1);
    if(p.s<GATE-.004&&ns>=GATE-.004&&!open) ns=GATE-.004-Math.random()*.05;
    if(S.sw>.5&&ns>GATE) ns=0;
    if(ns>1){ns=0;p.a=Math.random()*6.28;}
    p.s=ns; const c=PATH.getPointAt(Math.min(ns,1)); let rx=radAt(ns,1), rz=radAt(ns,2);
    const gw=sstep(GATE-.05,GATE,ns)*sstep(GATE+.05,GATE,ns); rx=lerp(rx,.02+.28*S.open,gw);
    airPos[i*3]=c.x+Math.cos(p.a)*rx*p.r; airPos[i*3+1]=c.y; airPos[i*3+2]=c.z+Math.sin(p.a)*rz*p.r;}
  airGeo.attributes.position.needsUpdate=true;
}

/* ---------- ângulos das aritenoides ---------- */
// aritenoides: giram um pouco e deslizam até o processo vocal chegar no alvo
function arPose(s,ang,targetX){const r=VA(L['vp'+s]).sub(VA(L['arBase'+s]));const x=L['arBase'+s][0]+r.x*Math.cos(ang)+r.z*Math.sin(ang);return {a:ang,dx:targetX-x};}
const ANG={R:{fecha:arPose('R',.32,XM-.03),abre:arPose('R',-.38,L.vpR[0]-.26)},L:{fecha:arPose('L',-.32,XM+.03),abre:arPose('L',.38,L.vpL[0]+.26)}};

/* ---------- poses ---------- */
const POSES={
  respirar:{open:1,tilt:0,sw:0,short:0,vib:0,cap:'Pregas abertas: o ar passa livre pela glote.'},
  cantar:{open:0,tilt:0,sw:0,short:0,vib:1,cap:'Pregas fechadas. O ar faz pressão por baixo e passa em pulsos: elas vibram (aqui em câmera lenta).'},
  agudo:{open:0,tilt:1,sw:0,short:0,vib:1,cap:'O cricotireóideo inclina a tireoide: as pregas esticam, afinam e vibram mais rápido.'},
  grave:{open:0,tilt:0,sw:0,short:1,vib:1,cap:'O tireoaritenóideo encurta e engrossa as pregas: vibram mais devagar.'},
  engolir:{open:0,tilt:0,sw:1,short:0,vib:0,cap:'O hioide sobe e a epiglote se move pra trás, cobrindo a abertura da laringe.'},
};
let pose='respirar';
function setPose(n){if(n==='alterna')n=pose==='respirar'?'cantar':'respirar';pose=n;const p=POSES[n];Object.assign(T,{open:p.open,tilt:p.tilt,sw:p.sw,short:p.short,vib:p.vib});
  document.querySelectorAll('#poses .bts button').forEach(b=>b.classList.toggle('on',b.dataset.p===n));document.getElementById('cap').textContent=p.cap;}
document.querySelectorAll('#poses .bts button').forEach(b=>b.onclick=()=>setPose(b.dataset.p));
const slOpen=document.getElementById('slOpen'), slTilt=document.getElementById('slTilt');
slOpen.oninput=()=>{T.open=S.open=slOpen.value/100;}; slTilt.oninput=()=>{T.tilt=S.tilt=slTilt.value/100;};

/* ---------- aplica estado ---------- */
const EXP={tireoide:V(0,.2,2.0),hioide:V(0,1.7,.7),epiglote:V(0,1.6,-.3),traqueia:V(0,-1.4,0),arR:V(-.8,1.2,-.6),arL:V(.8,1.2,-.6)};
let lastKey='';
function applyState(){
  const e=S.explode;
  root.position.y=.6*S.sw;
  B.tireoide.piv.rotation.x=.15*S.tilt;
  B.tireoide.piv.position.copy(B.tireoide.pivot).addScaledVector(EXP.tireoide,e);
  B.hioide.piv.position.copy(EXP.hioide).multiplyScalar(e).add(V(0,.45*S.sw,.25*S.sw));
  B.epiglote.piv.position.copy(B.epiglote.pivot).addScaledVector(EXP.epiglote,e).add(V(0,.3*S.sw,0));
  B.epiglote.piv.rotation.x=-1.25*S.sw;
  B.traqueia.piv.position.copy(EXP.traqueia).multiplyScalar(e);
  for(const s of ['R','L']){const b=B['ar'+s];
    const A=ANG[s];b.piv.position.copy(b.pivot).addScaledVector(EXP['ar'+s],e).add(V(lerp(A.fecha.dx,A.abre.dx,S.open),0,.09*S.short));
    b.piv.rotation.set(-.1*S.short-.06*S.sw,lerp(A.fecha.a,A.abre.a,S.open),0);}
  const soft=1-sstep(.02,.22,e);
  const k=[S.open,S.tilt,S.sw,S.short,e].map(v=>v.toFixed(3)).join();
  const moved=k!==lastKey; lastKey=k;
  const hid=id=>hideTop&&TOP_OFF.includes(id);
  for(const s of SOFT){s.mesh.visible=soft>.01&&P[s.mesh.userData.part].visible&&!hid(s.mesh.userData.part);s.mesh.userData.softA=soft;if(s.mesh.visible&&(moved||!s.done)){skin(s);s.done=true;}}
  const vibra=S.vib>.01&&S.open<.34;
  for(const d of DYN){d.mesh.visible=soft>.01&&P[d.mesh.userData.part].visible&&!hid(d.mesh.userData.part);d.mesh.userData.softA=soft;if(d.mesh.visible&&(moved||!d.done||(vibra&&d.mesh.userData.part==='pregas'))){d.mesh.geometry.fill(d.upd());d.done=true;}}
}

/* ---------- opacidade / seleção / cores ---------- */
let sel=null;
function refreshAlpha(){
  for(const p of Object.values(P)){const a=(sel&&sel!==p.id)?.1:1;
    p.mats.forEach((m,i)=>{const mesh=p.meshes[i];const o=m.userData.baseOpacity*a*(mesh.userData.soft?(mesh.userData.softA??1):1);
      m.opacity=o;const tr=o<.999;if(m.transparent!==tr){m.transparent=tr;m.needsUpdate=true;}m.depthWrite=o>.6;m.emissive.set(sel===p.id?0x3a2a00:0);});}
}
function applyColors(){
  for(const p of Object.values(P))p.mats.forEach(m=>{m.color.set(p[colorMode]);m.userData.cap.set(p[colorMode]).multiplyScalar(.8);});
  document.querySelectorAll('.row .dot').forEach(d=>d.style.background=P[d.dataset.id][colorMode]);
  document.querySelectorAll('#segCor [data-k]').forEach(b=>b.classList.toggle('on',b.dataset.k===colorMode));
}

/* ---------- câmera ---------- */
let tween=null;
function flyTo(pos,tgt,dur=.9){tween={p0:camera.position.clone(),t0:controls.target.clone(),p1:pos,t1:tgt,t:0,dur};}
const VIEWS={frente:V(0,.15,1),lado:V(-1,.15,0),tras:V(0,.15,-1),cima:V(0,1,-.45)};
const HIDE_TOP=['hioide','mth','th','lhe','te','ct','tireoide','traqueia'];let hideTop=false;
const TOP_OFF=['hioide','mth','th','lhe','lte','ct','ta','vocal','te','cap','cal','ia','ae','ligvocal','mct'];
function setHideTop(on){hideTop=on;P.hioide.meshes.forEach(m=>m.visible=on?false:P.hioide.visible);lastKey='';}
function setView(v){setHideTop(v==='cima');const d=VIEWS[v].clone().normalize();const tg=v==='cima'?GL.clone():TARGET0.clone();flyTo(tg.clone().addScaledVector(d,(v==='cima'?12.5:20)*(innerWidth<innerHeight?1.5:1)),tg);
  document.querySelectorAll('#segVista button').forEach(b=>b.classList.toggle('on',b.dataset.v===v));}
document.querySelectorAll('#segVista button').forEach(b=>b.onclick=()=>setView(b.dataset.v));

/* ---------- corte ---------- */
const PL={lado:new THREE.Plane(V(1,0,0),-XM),frente:new THREE.Plane(V(0,0,-1),GL.z)};
function setCut(c){clipPlanes.length=0;if(c)clipPlanes.push(PL[c]);cutU.value=c?1:0;
  for(const p of Object.values(P))p.mats.forEach(m=>m.needsUpdate=true);air.material.needsUpdate=true;
  document.querySelectorAll('#segCorte button').forEach(b=>b.classList.toggle('on',b.dataset.c===c));
  if(c==='lado')setView('lado');if(c==='frente')setView('frente');}
document.querySelectorAll('#segCorte button').forEach(b=>b.onclick=()=>setCut(b.dataset.c));
const clipped=p=>clipPlanes.some(pl=>pl.distanceToPoint(p)<-1e-3);

/* ---------- lista de partes ---------- */
const eyeOn='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>';
const eyeOff='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3l18 18M10.6 5.1A10.8 10.8 0 0 1 12 5c7 0 11 7 11 7a18 18 0 0 1-3.2 4M6.6 6.6C3.4 8.6 1 12 1 12s4 7 11 7a10.6 10.6 0 0 0 5.4-1.5"/></svg>';
const lista=document.getElementById('partes'), lst=lista.querySelector('.lst');
GRUPOS.forEach(([g,ids],gi)=>{const grp=document.createElement('div');grp.className='grp'+(gi?' fechado':'');
  grp.innerHTML=`<button class="gh"><span>${g}<span class="c">${ids.length}</span></span><i>▾</i></button><div class="rows"></div>`;
  grp.querySelector('.gh').onclick=()=>grp.classList.toggle('fechado');lst.appendChild(grp);const rows=grp.querySelector('.rows');
  for(const id of ids){const r=document.createElement('div');r.className='row';r.dataset.id=id;
    r.innerHTML=`<span class="dot" data-id="${id}"></span><span class="nm">${P[id].nome}</span><button class="eye" title="Mostrar/ocultar">${eyeOn}</button>`;
    r.querySelector('.nm').onclick=()=>select(id);r.querySelector('.dot').onclick=()=>select(id);
    r.querySelector('.eye').onclick=e=>{e.stopPropagation();P[id].visible=!P[id].visible;P[id].meshes.forEach(m=>m.visible=P[id].visible);r.classList.toggle('off',!P[id].visible);r.querySelector('.eye').innerHTML=P[id].visible?eyeOn:eyeOff;lastKey='';};
    rows.appendChild(r);}});
document.getElementById('btnAjustes').onclick=()=>document.getElementById('tools').classList.toggle('open');
document.getElementById('btnPartes').onclick=()=>lista.classList.toggle('open');

/* ---------- card ---------- */
const card=document.getElementById('card');
function select(id){
  sel=id;refreshAlpha();const p=P[id];
  document.querySelectorAll('.row').forEach(r=>{r.classList.toggle('on',r.dataset.id===id);if(r.dataset.id===id)r.closest('.grp').classList.remove('fechado');});
  document.body.classList.add('comcard');
  card.querySelector('.tag').textContent=p.tag;card.querySelector('h2').textContent=p.nome;
  card.querySelector('.oq').textContent=p.oq;card.querySelector('.canto p').textContent=p.canto;
  const go=card.querySelector('.go');if(p.act){go.style.display='';go.textContent='▶ '+p.act[1];go.onclick=()=>setPose(p.act[0]);}else go.style.display='none';
  document.getElementById('btnCamadas').style.display=['pregas','ligvocal','vocal'].includes(id)?'':'none';
  card.classList.add('on');lista.classList.remove('open');
  const box=new THREE.Box3();p.meshes.forEach(m=>{if(m.visible){m.geometry.computeBoundingBox();box.expandByObject(m);}});
  if(!box.isEmpty()){const c=box.getCenter(new THREE.Vector3()),r=box.getSize(new THREE.Vector3()).length();
    flyTo(c.clone().addScaledVector(V(...p.view).normalize(),clamp(r*2.4+3.5,5,18)),c);}
}
function deselect(){sel=null;refreshAlpha();document.body.classList.remove('comcard');card.classList.remove('on');document.querySelectorAll('.row').forEach(r=>r.classList.remove('on'));}
card.querySelector('.x').onclick=deselect;
document.getElementById('btnTudo').onclick=()=>{deselect();flyTo(HOME.clone(),TARGET0.clone());};

/* ---------- botões ---------- */
document.querySelectorAll('#segCor [data-k]').forEach(b=>b.onclick=()=>{colorMode=b.dataset.k;applyColors();});
let showNomes=true,showAr=true;
document.getElementById('tgNomes').onclick=e=>{showNomes=!showNomes;e.currentTarget.classList.toggle('on',showNomes);};
document.getElementById('tgAr').onclick=e=>{showAr=!showAr;e.currentTarget.classList.toggle('on',showAr);air.visible=showAr;};
const exS=document.getElementById('explode');exS.oninput=()=>{T.explode=exS.value/100;};

/* ---------- nomes na tela ---------- */
function nearest(id,target){let best=null,bd=1e9;for(const m of P[id].meshes){const a=m.geometry.attributes.position;for(let i=0;i<a.count;i+=3){const d=(a.getX(i)-target[0])**2+(a.getY(i)-target[1])**2+(a.getZ(i)-target[2])**2;if(d<bd){bd=d;best={m,i};}}}return best;}
function anchor(id,target){const h=nearest(id,target);return ()=>{const a=h.m.geometry.attributes.position;return root.worldToLocal(h.m.localToWorld(V(a.getX(h.i),a.getY(h.i),a.getZ(h.i))));};}
const LABELS=[
  ['tireoide',anchor('tireoide',[-1.6,1.3,1.0])],['tireoide',anchor('tireoide',[-1.9,3.6,-.6]),'corno superior'],['tireoide',anchor('tireoide',L.jointR),'corno inferior'],
  ['cricoide',anchor('cricoide',[-1.0,-.6,.4])],['aritenoides',anchor('aritenoides',L.arApexR)],['epiglote',anchor('epiglote',L.epiTop)],
  ['hioide',anchor('hioide',[-1.2,3.4,1.9])],['traqueia',anchor('traqueia',[-1.2,-2.6,-.4])],
  ['pregas',()=>toRoot('tireoide',L.acR).lerp(toRoot('arR',L.vpR),.5)],
];
const labWrap=document.getElementById('labels');
const LAB=LABELS.map(([id,f,txt])=>{const d=document.createElement('div');d.className='lab';d.innerHTML=`<span>${txt||P[id].nome.replace('Cartilagem ','').replace('Cartilagens ','').replace('Músculo ','')}</span><i></i><b></b>`;d.onclick=()=>select(id);labWrap.appendChild(d);return {id,f,d};});
const ray=new THREE.Raycaster();
const pickables=()=>{const a=[];for(const p of Object.values(P))for(const m of p.meshes)if(m.visible&&m.material.opacity>.3)a.push(m);return a;};
function updLabels(occl){
  const W=innerWidth,H=innerHeight,placed=[];
  for(const Lb of LAB){const p=P[Lb.id];const wp=root.localToWorld(Lb.f());const v=wp.clone().project(camera);
    const x=(v.x*.5+.5)*W,y=(-v.y*.5+.5)*H;
    let vis=showNomes&&p.visible&&!sel&&v.z<1&&!clipped(wp)&&(S.explode<.05||Lb.id!=='pregas')&&!(hideTop&&HIDE_TOP.includes(Lb.id));
    if(vis&&occl){const dir=wp.clone().sub(camera.position);const dist=dir.length();ray.set(camera.position,dir.normalize());
      const hit=ray.intersectObjects(pickables(),false).find(h=>!clipped(h.point));Lb.occ=!!hit&&hit.distance<dist-.08&&hit.object.userData.part!==Lb.id;}
    if(vis&&placed.some(q=>Math.abs(q[0]-x)<110&&Math.abs(q[1]-y)<30))vis=false;
    if(!vis){Lb.d.style.display='none';continue;}
    placed.push([x,y]);Lb.d.style.display='';Lb.d.style.transform=`translate(${x}px,${y}px) translate(-50%,-100%)`;Lb.d.classList.toggle('dim',!!Lb.occ);}
}

/* ---------- clique e mouse ---------- */
const tip=document.getElementById('tip');const mouse=new THREE.Vector2();let down=null;
function pick(e){const r=canvas.getBoundingClientRect();mouse.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);
  ray.setFromCamera(mouse,camera);const h=ray.intersectObjects(pickables(),false).find(h=>!clipped(h.point));return h?h.object.userData.part:null;}
const hintEl=document.getElementById('hint');const hideHint=()=>hintEl.classList.add('off');setTimeout(hideHint,9000);
canvas.addEventListener('pointerdown',e=>{hideHint();down={x:e.clientX,y:e.clientY};canvas.classList.add('drag');});
canvas.addEventListener('pointerup',e=>{canvas.classList.remove('drag');if(down&&Math.hypot(e.clientX-down.x,e.clientY-down.y)<6){const id=pick(e);if(id)select(id);else if(sel)deselect();}down=null;});
let lastMove=0;
canvas.addEventListener('pointermove',e=>{const now=performance.now();if(e.buttons||now-lastMove<70||e.pointerType!=='mouse')return;lastMove=now;
  const id=pick(e);canvas.classList.toggle('hov',!!id);
  if(id){tip.textContent=P[id].nome;tip.style.left=e.clientX+'px';tip.style.top=e.clientY+'px';tip.style.opacity=1;}else tip.style.opacity=0;});
canvas.addEventListener('pointerleave',()=>tip.style.opacity=0);
controls.addEventListener('start',()=>{tween=null;});
document.getElementById('zCentro').addEventListener('click',()=>{setHideTop(false);document.querySelectorAll('#segVista button').forEach(b=>b.classList.remove('on'));});
// clique duplo: a parte vira o centro do giro e do zoom
canvas.addEventListener('dblclick',e=>{const r=canvas.getBoundingClientRect();mouse.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);
  ray.setFromCamera(mouse,camera);const h=ray.intersectObjects(pickables(),false).find(h=>!clipped(h.point));if(!h)return;
  const d=camera.position.clone().sub(controls.target);const dist=Math.min(d.length(),7);flyTo(h.point.clone().addScaledVector(d.normalize(),dist),h.point.clone(),.6);});
// botões de zoom
function zoomBy(f){const d=camera.position.clone().sub(controls.target);const len=clamp(d.length()*f,controls.minDistance,controls.maxDistance);flyTo(controls.target.clone().addScaledVector(d.normalize(),len),controls.target.clone(),.35);}
document.getElementById('zMais').onclick=()=>zoomBy(.7);
document.getElementById('zMenos').onclick=()=>zoomBy(1.4);
document.getElementById('zCentro').onclick=()=>flyTo(HOME.clone(),TARGET0.clone());

/* ---------- loop ---------- */
function resize(){const w=innerWidth,h=innerHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
addEventListener('resize',resize);resize();
const clock=new THREE.Clock();let alphaKey='';let frame=0;
function tick(){
  const dt=Math.min(clock.getDelta(),.05);tNow+=dt;const k=1-Math.exp(-dt*4.5);
  for(const key of Object.keys(S))S[key]+=(T[key]-S[key])*k;
  if(document.activeElement!==slOpen)slOpen.value=Math.round(S.open*100);
  if(document.activeElement!==slTilt)slTilt.value=Math.round(S.tilt*100);
  applyState();const ak=sel+'|'+S.explode.toFixed(2);if(ak!==alphaKey){alphaKey=ak;refreshAlpha();}if(showAr)stepAir(dt);
  if(tween){tween.t+=dt/tween.dur;const t=Math.min(tween.t,1),e=t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
    camera.position.lerpVectors(tween.p0,tween.p1,e);controls.target.lerpVectors(tween.t0,tween.t1,e);if(tween.t>=1)tween=null;}
  controls.update();renderer.render(scene,camera);frame++;updLabels(frame%8===0);requestAnimationFrame(tick);
}
const jump=()=>{if(tween){camera.position.copy(tween.p1);controls.target.copy(tween.t1);tween=null;}};
applyColors();setPose(Q.get('pose')||'respirar');
if(Q.get('explode')){T.explode=+Q.get('explode');exS.value=T.explode*100;}
for(const key of Object.keys(S))S[key]=T[key];
if(Q.get('cut')){setCut(Q.get('cut'));jump();}
if(Q.get('v')){setView(Q.get('v'));jump();}
if(Q.get('so')){const keep=Q.get('so').split(',');for(const p of Object.values(P)){p.visible=keep.includes(p.id);p.meshes.forEach(m=>m.visible=p.visible);}}
applyState();
if(Q.get('sel')){select(Q.get('sel'));jump();}
if(Q.has('dbg')){for(const id of ['pregas','aritenoides','vestibulares']){const b=new THREE.Box3();P[id].meshes.forEach(m=>{m.geometry.computeBoundingBox();b.expandByObject(m);});console.log('DBG',id,JSON.stringify(b.min),JSON.stringify(b.max),P[id].meshes.map(m=>m.visible).join());}
 console.log('DBG ANG',JSON.stringify(ANG),'vp',toRoot('arR',L.vpR).toArray().map(v=>v.toFixed(2)).join(),toRoot('arL',L.vpL).toArray().map(v=>v.toFixed(2)).join());}
tick();
document.getElementById('load').style.opacity=0;setTimeout(()=>document.getElementById('load').remove(),600);
