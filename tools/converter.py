# Converte os OBJ do BodyParts3D (mm, Z pra cima, -Y frente) em modelo.js (cm, Y pra cima, +Z frente)
import glob, os, sys, json, base64, struct
SRC = sys.argv[1]; OUT = sys.argv[2]
MAP = {  # arquivo -> (parte, osso)
 'thyroid_cartilage':('tireoide','tireoide'), 'cricoid_cartilage':('cricoide','cricoide'),
 'right_arytenoid_cartilage':('aritenoides','arR'), 'left_arytenoid_cartilage':('aritenoides','arL'),
 'right_corniculate_cartilage':('corniculadas','arR'), 'left_corniculate_cartilage':('corniculadas','arL'),
 'right_cuneiform_cartilage':('cuneiformes','arR'), 'left_cuneiform_cartilage':('cuneiformes','arL'),
 'epiglottis':('epiglote','epiglote'), 'hyoid_bone':('hioide','hioide'), 'trachea':('traqueia','traqueia'),
 'right_vocal_ligament':('ligvocal','soft'), 'left_vocal_ligament':('ligvocal','soft'),
 'right_vocalis':('vocal','soft'), 'left_vocalis':('vocal','soft'),
 'right_thyro_arytenoid':('ta','soft'), 'left_thyro_arytenoid':('ta','soft'),
 'right_posterior_crico_arytenoid':('cap','soft'), 'left_posterior_crico_arytenoid':('cap','soft'),
 'right_lateral_crico_arytenoid':('cal','soft'), 'left_lateral_crico_arytenoid':('cal','soft'),
 'straight_part_of_right_cricothyroid':('ct','soft'), 'straight_part_of_left_cricothyroid':('ct','soft'),
 'oblique_part_of_right_cricothyroid':('ct','soft'), 'oblique_part_of_left_cricothyroid':('ct','soft'),
 'transverse_arytenoid':('ia','soft'), 'right_oblique_arytenoid':('ia','soft'), 'left_oblique_arytenoid':('ia','soft'),
 'right_aryepiglotticus':('ae','soft'), 'left_aryepiglotticus':('ae','soft'),
 'right_thyrohyoid':('th','soft'), 'left_thyrohyoid':('th','soft'),
 'hyo_epiglottic_ligament':('lhe','soft'), 'thyro_epiglottic_ligament':('lte','soft'),
 'median_cricothyroid_ligament':('mct','soft'),
}
STRAY = {'right_thyrohyoid','right_aryepiglotticus','straight_part_of_right_cricothyroid'}
def tr(x,y,z): return (x/10.0, (z-1395.0)/10.0, -(y+105.0)/10.0)
meshes=[]; allv={}
for f in sorted(glob.glob(os.path.join(SRC,'*.obj'))):
    base=os.path.basename(f).split('__')[0]; part,bone=MAP[base]
    vs=[]; fs=[]
    for l in open(f):
        if l.startswith('v '): _,x,y,z=l.split()[:4]; vs.append((float(x),float(y),float(z)))
        elif l.startswith('f '): fs.append([int(t.split('/')[0])-1 for t in l.split()[1:4]])
    if base in STRAY: fs=[t for t in fs if all(vs[i][0]<=0.0 for i in t)]
    if base=='trachea': fs=[t for t in fs if all(vs[i][2]>=1340 for i in t)]
    used=sorted({i for t in fs for i in t}); remap={o:n for n,o in enumerate(used)}
    V=[tr(*vs[i]) for i in used]; F=[remap[i] for t in fs for i in t]
    side = 'R' if base.startswith(('right','straight_part_of_right','oblique_part_of_right')) else ('L' if base.startswith(('left','straight_part_of_left','oblique_part_of_left')) else '')
    meshes.append({'name':base,'part':part,'bone':bone,'side':side,
      'pos':base64.b64encode(struct.pack('<%df'%(len(V)*3),*[c for v in V for c in v])).decode(),
      'idx':base64.b64encode(struct.pack('<%dH'%len(F),*F)).decode(),'nv':len(V)})
    allv[base]=V
def ext(V,key,fn=max): return fn(V,key=key)
avg=lambda ps:[sum(p[i] for p in ps)/len(ps) for i in range(3)]
L={}
thy=allv['thyroid_cartilage']
for s,sg in (('R',-1),('L',1)):
    side=[v for v in thy if v[0]*sg>.8 ]
    L['joint'+s]=list(min(side,key=lambda v:v[1]))
    vl=allv[('right' if s=='R' else 'left')+'_vocal_ligament']
    L['vp'+s]=list(min(vl,key=lambda v:v[2])); L['ac'+s]=list(max(vl,key=lambda v:v[2]))
    ar=allv[('right' if s=='R' else 'left')+'_arytenoid_cartilage']
    y0=min(v[1] for v in ar); L['arBase'+s]=avg([v for v in ar if v[1]<y0+.25])
    L['arMusc'+s]=list(max(ar,key=lambda v:v[0]*sg)); L['arApex'+s]=list(max(ar,key=lambda v:v[1]))
    co=allv[('right' if s=='R' else 'left')+'_corniculate_cartilage']; L['corn'+s]=list(max(co,key=lambda v:v[1]))
L['ac']=avg([L['acR'],L['acL']])
ep=allv['epiglottis']; ymin=min(v[1] for v in ep); ymax=max(v[1] for v in ep)
L['epiLow']=list(min(ep,key=lambda v:v[1])); L['epiTop']=list(max(ep,key=lambda v:v[1]))
edges={'R':[],'L':[]}
for k in range(10):
    yy=ymin+(ymax-ymin)*(.2+.45*k/9); sl=[v for v in ep if abs(v[1]-yy)<.12]
    edges['R'].append(list(min(sl,key=lambda v:v[0]))); edges['L'].append(list(max(sl,key=lambda v:v[0])))
L['epiEdge']=edges
hy=allv['hyoid_bone']; L['hyFront']=list(max(hy,key=lambda v:v[2]))
tb=[];hb=[]
for k in range(15):
    x=-1.4+2.8*k/14
    a=[v for v in thy if abs(v[0]-x)<.18 and v[1]>1.5]; b=[v for v in hy if abs(v[0]-x)<.2]
    if a and b: tb.append(list(max(a,key=lambda v:v[1]))); hb.append(list(min(b,key=lambda v:v[1])))
L['thyTop']=tb; L['hyBot']=hb
trc=allv['trachea']; cl=[]
y=min(v[1] for v in trc)+.3
while y<0.2:
    sl=[v for v in trc if abs(v[1]-y)<.15]
    if sl: c=avg(sl); r=max(((v[0]-c[0])**2+(v[2]-c[2])**2)**.5 for v in sl); cl.append([c[0],y,c[2],r])
    y+=.5
L['trCenter']=cl
cr=allv['cricoid_cartilage']; L['crFront']=list(max(cr,key=lambda v:v[2])); L['crBack']=list(min(cr,key=lambda v:v[2]))
L['bboxCenter']=avg([avg(allv[k]) for k in ('thyroid_cartilage','cricoid_cartilage','hyoid_bone','epiglottis')])
js='window.LARINGE_MODELO='+json.dumps({'meshes':meshes,'L':L},separators=(',',':'))+';\n'
open(OUT,'w').write('/* BodyParts3D, (c) The Database Center for Life Science, licenciado sob CC Atribuição-CompartilhaIgual 2.1 Japão. Convertido para cm. */\n'+js)
print(os.path.getsize(OUT)//1024,'KB', sum(m['nv'] for m in meshes),'vértices')
for k,v in L.items():
    if k not in('epiEdge','thyTop','hyBot','trCenter'): print(k,[round(c,2) for c in v])
print('trCenter',[[round(c,2) for c in p] for p in cl])
print('edgesR',[[round(c,2) for c in p] for p in edges['R']])
