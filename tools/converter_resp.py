# Converte as peças do BodyParts3D (sistema respiratório) em resp-modelo.js
# - reduz malhas pesadas (agrupamento de vértices)
# - gera os pulmões (o banco não tem a superfície deles)
# - pesos de "pele" (cada vértice segue até 2 ossos: costelas, esterno, clavículas, escápulas ou fixo)
# - formas-alvo (morph): diafragma contrai, pulmões descem/sobem, barriga sai/entra
import os, sys, glob, json, base64, struct, math, time
SRC, OUT = sys.argv[1], sys.argv[2]
T0 = time.time()
def log(*a): print(f'[{time.time()-T0:6.1f}s]', *a, flush=True)

ORD = ['first','second','third','fourth','fifth','sixth','seventh','eighth','ninth','tenth','eleventh','twelfth']
def classify(base):
    side = 'R' if ('right' in base) else ('L' if 'left' in base else '')
    for i, o in enumerate(ORD):
        if base in (f'right_{o}_rib', f'left_{o}_rib'): return ('costelas', f'rib{side}{i+1}', side, 2.0)
        if base in (f'right_{o}_costal_cartilage', f'left_{o}_costal_cartilage'): return ('cartilagens', 'soft', side, 1.6)
    if base in ('manubrium', 'body_of_sternum', 'xiphoid_process'): return ('esterno', 'sterno', '', 1.6)
    if base.endswith('clavicle'): return ('claviculas', 'clav' + side, side, 1.6)
    if base.endswith('scapula'): return ('escapulas', 'scap' + side, side, 3.0)
    if 'vertebra' in base: return ('coluna', 'static', '', 2.0)
    if base in ('sacrum',) or 'hip_bone' in base: return ('pelve', 'static', '', 3.0)
    if base == 'trachea' or 'main_bronchus' in base or 'bronchial_tree' in base: return ('vias', 'static', side, 1.6)
    if base == 'diaphragm': return ('diafragma', 'soft', '', 3.2)
    if 'external_intercostal' in base: return ('intext', 'soft', side, 3.6)
    if 'internal_intercostal' in base: return ('intint', 'soft', side, 3.6)
    if 'transversus_thoracis' in base: return ('tt', 'soft', side, 2.0)
    if 'external_oblique' in base: return ('obliquo', 'soft', side, 4.0)
    if 'scalenus' in base: return ('escalenos', 'soft', side, 1.6)
    if 'sternocleidomastoid' in base: return ('ecm', 'soft', side, 2.0)
    if 'trapezius' in base: return ('trapezio', 'soft', side, 3.0)
    if 'levator_scapulae' in base: return ('levantador', 'soft', side, 2.4)
    if 'pectoralis_minor' in base: return ('peitoral', 'soft', side, 2.4)
    if 'serratus_anterior' in base: return ('serratil', 'soft', side, 3.4)
    return None

def load(fn):
    vs, fs = [], []
    for l in open(fn):
        if l.startswith('v '):
            p = l.split(); vs.append((float(p[1]), float(p[2]), float(p[3])))
        elif l.startswith('f '):
            fs.append(tuple(int(t.split('/')[0]) - 1 for t in l.split()[1:4]))
    return vs, fs

def decimate(vs, fs, cell):
    if not cell: return vs, fs
    key = {}; acc = []; idx = []
    for (x, y, z) in vs:
        k = (int(math.floor(x / cell)), int(math.floor(y / cell)), int(math.floor(z / cell)))
        j = key.get(k)
        if j is None:
            j = len(acc); key[k] = j; acc.append([0.0, 0.0, 0.0, 0])
        a = acc[j]; a[0] += x; a[1] += y; a[2] += z; a[3] += 1
        idx.append(j)
    nv = [(a[0] / a[3], a[1] / a[3], a[2] / a[3]) for a in acc]
    seen = set(); nf = []
    for (a, b, c) in fs:
        A, B, C = idx[a], idx[b], idx[c]
        if A == B or B == C or A == C: continue
        s = tuple(sorted((A, B, C)))
        if s in seen: continue
        seen.add(s); nf.append((A, B, C))
    return nv, nf

# ---------- carrega ----------
groups = {}   # part -> list of (vs, fs, bone, side)
raw = {}      # part -> vertices crus (pra pulmão / diafragma)
for fn in sorted(glob.glob(os.path.join(SRC, '*.obj'))):
    base = os.path.basename(fn).split('__')[0]
    c = classify(base)
    if not c: log('ignorado', base); continue
    part, bone, side, cell = c
    vs, fs = load(fn)
    if part in ('diafragma', 'costelas', 'cartilagens', 'esterno', 'intint', 'coluna'):
        raw.setdefault(part, []).extend(vs)
    vs, fs = decimate(vs, fs, cell)
    groups.setdefault(part, []).append((vs, fs, bone, side, base))
log('carregado', {k: sum(len(m[0]) for m in v) for k, v in groups.items()})

# ---------- ossos ----------
BONES = ['static'] + [f'ribR{i}' for i in range(1, 13)] + [f'ribL{i}' for i in range(1, 13)] + ['sterno', 'clavR', 'clavL', 'scapR', 'scapL']
BI = {b: i for i, b in enumerate(BONES)}
bonepts = {b: [] for b in BONES}
for part, ms in groups.items():
    for vs, fs, bone, side, base in ms:
        if bone == 'soft': continue
        if part == 'vias' and 'bronchial_tree' in base: continue
        bonepts[bone].extend(vs[::2])

def tr(p): x, y, z = p; return [x / 10.0, (z - 1180.0) / 10.0, -(y + 110.0) / 10.0]
def sub(a, b): return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
def norm(a): l = math.sqrt(sum(c * c for c in a)) or 1; return [c / l for c in a]

bone_info = {}
for i in range(1, 13):
    for s, sg in (('R', -1), ('L', 1)):
        pts = bonepts[f'rib{s}{i}']
        ymax = max(p[1] for p in pts)
        post = [p for p in pts if p[1] > ymax - 14]
        head = min(post, key=lambda p: abs(p[0]))                       # cabeça da costela (junto da coluna)
        post2 = [p for p in pts if p[1] > ymax - 30]
        tub = max(post2, key=lambda p: abs(p[0]))                       # tubérculo (aprox.)
        ant = min(pts, key=lambda p: p[1])                              # ponta da frente
        lat = max(pts, key=lambda p: abs(p[0]))
        bone_info[f'rib{s}{i}'] = {'pivot': tr(head), 'axis': norm(sub(tr(tub), tr(head))), 'ant': tr(ant), 'lat': tr(lat)}
st = bonepts['sterno']; bone_info['sterno'] = {'pivot': tr(max(st, key=lambda p: p[2]))}
for s in 'RL':
    cl = bonepts['clav' + s]; med = min(cl, key=lambda p: abs(p[0])); latp = max(cl, key=lambda p: abs(p[0]))
    bone_info['clav' + s] = {'pivot': tr(med), 'lat': tr(latp)}
    sc = bonepts['scap' + s]; bone_info['scap' + s] = {'pivot': tr(max(sc, key=lambda p: p[2]))}

# hash espacial dos ossos pra achar os 2 mais próximos
CELL = 22.0
grid = {}
for b, pts in bonepts.items():
    for p in pts[::2]:
        k = (int(p[0] // CELL), int(p[1] // CELL), int(p[2] // CELL))
        grid.setdefault(k, []).append((p, BI[b]))
def near2(p):
    best = {}
    k0 = (int(p[0] // CELL), int(p[1] // CELL), int(p[2] // CELL))
    for r in (1, 2, 3):
        for dx in range(-r, r + 1):
            for dy in range(-r, r + 1):
                for dz in range(-r, r + 1):
                    if r > 1 and max(abs(dx), abs(dy), abs(dz)) < r: continue
                    for q, bi in grid.get((k0[0] + dx, k0[1] + dy, k0[2] + dz), ()):
                        d = (q[0] - p[0]) ** 2 + (q[1] - p[1]) ** 2 + (q[2] - p[2]) ** 2
                        if d < best.get(bi, 1e18): best[bi] = d
        if len(best) >= 2: break
    # pescoço/cabeça: fixo
    hd = max(0.0, 1440.0 - p[2]); hd2 = hd * hd
    if hd2 < best.get(0, 1e18): best[0] = hd2
    it = sorted(best.items(), key=lambda kv: kv[1])[:2]
    if len(it) == 1: return it[0][0], 0, 1.0
    (b1, d1), (b2, d2) = it
    d1 = math.sqrt(d1) + 1.0; d2 = math.sqrt(d2) + 1.0
    w1 = (1 / d1 ** 3) / (1 / d1 ** 3 + 1 / d2 ** 3)
    return b1, b2, w1

# ---------- pulmões ----------
log('gerando pulmões')
wall = raw['costelas'] + raw['cartilagens'] + raw['esterno'] + raw['intint'][::3] + raw['coluna'][::2]
dia = raw['diafragma']
DC = 6.0; dmap = {}
for (x, y, z) in dia:
    k = (int(x // DC), int(y // DC)); dmap[k] = max(dmap.get(k, -1e9), z)
def zdia(x, y):
    k = (int(x // DC), int(y // DC)); best = None
    for r in range(0, 3):
        for dx in range(-r, r + 1):
            for dy in range(-r, r + 1):
                v = dmap.get((k[0] + dx, k[1] + dy))
                if v is not None and (best is None or v > best): best = v
        if best is not None: return best
    return None
HEART = (18.0, -148.0, 1172.0, 62.0, 52.0, 60.0)
def in_heart(x, y, z):
    cx, cy, cz, rx, ry, rz = HEART
    return ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 + ((z - cz) / rz) ** 2 < 1
NB = 48; STEP = 4.0
lung_meshes = []
for side, sg in (('R', -1), ('L', 1)):
    cx, cy = sg * 72.0, -112.0
    slices = {}
    for (x, y, z) in wall:
        if x * sg < -5: continue
        k = int(z // STEP)
        a = math.atan2(y - cy, x - cx); r = math.hypot(x - cx, y - cy)
        b = int((a + math.pi) / (2 * math.pi) * NB) % NB
        sl = slices.setdefault(k, [None] * NB)
        if sl[b] is None or r < sl[b]: sl[b] = r
    # suaviza entre fatias vizinhas e preenche lacunas
    contour = {}
    for k in slices:
        rs = [None] * NB
        for b in range(NB):
            vals = [slices[kk][b] for kk in (k - 1, k, k + 1) if kk in slices and slices[kk][b] is not None]
            rs[b] = min(vals) if vals else None
        if sum(1 for r in rs if r is not None) < NB * 0.55: continue
        for b in range(NB):
            if rs[b] is None:
                for d in range(1, NB):
                    l, rr = rs[(b - d) % NB], rs[(b + d) % NB]
                    if l is not None or rr is not None:
                        rs[b] = min(v for v in (l, rr) if v is not None); break
        contour[k] = rs
    def inside(x, y, z):
        if x * sg < 16: return False
        k = int(z // STEP); rs = contour.get(k)
        if rs is None: return False
        a = math.atan2(y - cy, x - cx); r = math.hypot(x - cx, y - cy)
        b = int((a + math.pi) / (2 * math.pi) * NB) % NB
        if r > rs[b] - 5: return False
        zd = zdia(x, y)
        if zd is not None and z < zd + 5: return False
        if zd is None and z < 1110: return False
        if in_heart(x, y, z): return False
        return True
    xs = [sg * (10 + i * STEP) for i in range(0, 34)]
    ys = [-215 + j * STEP for j in range(0, 52)]
    zs = [1060 + kk * STEP for kk in range(0, 80)]
    if sg < 0: xs = xs[::-1]
    NX, NY, NZ = len(xs), len(ys), len(zs)
    occ = [[[inside(xs[i], ys[j], zs[k]) for k in range(NZ)] for j in range(NY)] for i in range(NX)]
    # surface nets em campo binário
    vid = {}; verts = []
    def V(i, j, k):
        return occ[i][j][k] if 0 <= i < NX and 0 <= j < NY and 0 <= k < NZ else False
    for i in range(-1, NX):
        for j in range(-1, NY):
            for k in range(-1, NZ):
                c = [V(i + a, j + b, k + cc) for a in (0, 1) for b in (0, 1) for cc in (0, 1)]
                if all(c) or not any(c): continue
                vid[(i, j, k)] = len(verts)
                verts.append(((i + .5), (j + .5), (k + .5)))
    faces = []
    for i in range(NX):
        for j in range(NY):
            for k in range(NZ):
                if not occ[i][j][k]: continue
                for (di, dj, dk) in ((1, 0, 0), (0, 1, 0), (0, 0, 1), (-1, 0, 0), (0, -1, 0), (0, 0, -1)):
                    if V(i + di, j + dj, k + dk): continue
                    # face entre a célula (i,j,k) e a vizinha vazia: os 4 vértices dos cubos que compartilham essa aresta-face
                    if di: a = i if di > 0 else i - 1; q = [(a, j - 1, k - 1), (a, j, k - 1), (a, j, k), (a, j - 1, k)]
                    elif dj: b = j if dj > 0 else j - 1; q = [(i - 1, b, k - 1), (i - 1, b, k), (i, b, k), (i, b, k - 1)]
                    else: c = k if dk > 0 else k - 1; q = [(i - 1, j - 1, c), (i, j - 1, c), (i, j, c), (i - 1, j, c)]
                    ids = [vid.get(t) for t in q]
                    if None in ids: continue
                    if (di + dj + dk) < 0: ids = ids[::-1]
                    faces.append((ids[0], ids[1], ids[2])); faces.append((ids[0], ids[2], ids[3]))
    # para mm
    def tomm(v):
        fi, fj, fk = v
        x = xs[0] + (xs[1] - xs[0]) * fi; y = ys[0] + STEP * fj; z = zs[0] + STEP * fk
        return [x, y, z]
    P = [tomm(v) for v in verts]
    nbr = [set() for _ in P]
    for a, b, c in faces:
        nbr[a].update((b, c)); nbr[b].update((a, c)); nbr[c].update((a, b))
    for it in range(14):   # Taubin (suaviza sem encolher)
        lam = .55 if it % 2 == 0 else -.58
        NP = []
        for vi, p in enumerate(P):
            n = nbr[vi]
            if not n: NP.append(p); continue
            m = [sum(P[q][d] for q in n) / len(n) for d in range(3)]
            NP.append([p[d] + lam * (m[d] - p[d]) for d in range(3)])
        P = NP
    lung_meshes.append((P, faces, side))
    log('pulmão', side, len(P), 'vértices', len(faces), 'faces')

# ---------- monta saída ----------
def b64f(a): return base64.b64encode(struct.pack('<%df' % len(a), *a)).decode()
def b64i(a, big): return base64.b64encode(struct.pack(('<%dI' if big else '<%dH') % len(a), *a)).decode()
def b64u8(a): return base64.b64encode(bytes(a)).decode()
def sstep(a, b, x):
    t = max(0.0, min(1.0, (x - a) / (b - a))); return t * t * (3 - 2 * t)

def morphs_for(part, vs):
    M = {}
    if part == 'diafragma':
        M['contrai'] = [c for (x, y, z) in vs for c in (0.0, -3.4 * sstep(1070, 1185, z), 0.0)]
    if part == 'pulmoes':
        zmin = min(v[2] for v in vs); zmax = max(v[2] for v in vs)
        dd = []; aa = []
        for (x, y, z) in vs:
            zd = zdia(x, y) or zmin
            D = -3.4 * sstep(1070, 1185, zd)
            w = max(0.0, min(1.0, 1 - (z - zd) / max(40.0, zmax - zd)))
            dd += [0.0, D * w, 0.0]
            h = sstep(1270, 1350, z); aa += [0.0, 0.7 * h, 0.4 * h]
        M['baixa'] = dd; M['alta'] = aa
    if part == 'obliquo':
        fo = []; de = []
        for (x, y, z) in vs:
            wf = sstep(1150, 1030, z) * sstep(-100, -180, y)
            wl = sstep(1160, 1050, z) * sstep(70, 125, abs(x))
            sx = 1 if x > 0 else -1
            fo += [sx * .55 * wl, 0.0, 1.8 * wf + .3 * wl]          # (X, Y, Z) já no sistema da cena: +Z é frente
            de += [-sx * .4 * wl, 0.0, -1.1 * wf - .2 * wl]
        M['fora'] = fo; M['dentro'] = de
    return M

out_meshes = []
def add_mesh(part, vs, fs, bone, side, skin):
    pos = [c for p in vs for c in tr(p)]
    idx = [i for f in fs for i in f]
    big = len(vs) > 65535
    si = []; sw = []
    if bone != 'soft':
        b = BI[bone]
        for _ in vs: si += [b, 0, 0, 0]; sw.append(255)
    else:
        for p in vs:
            b1, b2, w1 = near2(p); si += [b1, b2, 0, 0]; sw.append(int(round(w1 * 255)))
    m = {'part': part, 'side': side, 'pos': b64f(pos), 'idx': b64i(idx, big), 'big': big, 'si': b64u8(si), 'sw': b64u8(sw), 'nv': len(vs)}
    mo = morphs_for(part, vs)
    if mo: m['morph'] = {k: b64f(v) for k, v in mo.items()}
    out_meshes.append(m)

for part, ms in groups.items():
    # junta tudo da mesma parte numa malha só
    if part == 'vias':
        # traqueia + brônquios principais separados das árvores segmentares
        for nm, flt in (('vias', lambda b: 'bronchial_tree' not in b), ('bronquios', lambda b: 'bronchial_tree' in b)):
            VS, FS = [], []
            for vs, fs, bone, side, base in ms:
                if not flt(base): continue
                o = len(VS); VS += vs; FS += [(a + o, b + o, c + o) for a, b, c in fs]
            add_mesh(nm, VS, FS, 'static', '', False)
        continue
    rigid = all(m[2] != 'soft' for m in ms)
    if rigid:
        # cada osso com o seu índice; junta por parte
        VS, FS, SI = [], [], []
        for vs, fs, bone, side, base in ms:
            o = len(VS); VS += vs; FS += [(a + o, b + o, c + o) for a, b, c in fs]; SI += [BI[bone]] * len(vs)
        pos = [c for p in VS for c in tr(p)]; idx = [i for f in FS for i in f]
        si = []
        for b in SI: si += [b, 0, 0, 0]
        out_meshes.append({'part': part, 'side': '', 'pos': b64f(pos), 'idx': b64i(idx, len(VS) > 65535), 'big': len(VS) > 65535, 'si': b64u8(si), 'sw': b64u8([255] * len(VS)), 'nv': len(VS)})
    else:
        VS, FS = [], []
        for vs, fs, bone, side, base in ms:
            o = len(VS); VS += vs; FS += [(a + o, b + o, c + o) for a, b, c in fs]
        add_mesh(part, VS, FS, 'soft', '', True)
    log('ok', part, out_meshes[-1]['nv'])
for P, F, side in lung_meshes:
    add_mesh('pulmoes', P, F, 'soft', side, True)
    log('ok pulmão', side)

# pontos pro ar: topo da traqueia, carina e pontas dos brônquios
tra = [p for vs, fs, b, s, base in groups['vias'] if base == 'trachea' for p in vs]
top = max(tra, key=lambda p: p[2]); car = min(tra, key=lambda p: p[2])
tips = []
for vs, fs, b, s, base in groups['vias']:
    if 'bronchial_tree' in base:
        tips.append(min(vs, key=lambda p: p[2]) if 'basal' in base else max(vs, key=lambda p: abs(p[0])))
L = {'traqTopo': tr(top), 'carina': tr(car), 'pontas': [tr(p) for p in tips],
     'ribAnt': {k: v['ant'] for k, v in bone_info.items() if k.startswith('rib')}}
data = {'bones': BONES, 'boneInfo': bone_info, 'meshes': out_meshes, 'L': L}
js = '/* BodyParts3D, (c) The Database Center for Life Science, CC Atribuição-CompartilhaIgual 2.1 Japão. Pulmões gerados a partir das costelas e do diafragma. */\nwindow.RESP_MODELO=' + json.dumps(data, separators=(',', ':')) + ';\n'
open(OUT, 'w').write(js)
log('salvo', OUT, os.path.getsize(OUT) // 1024, 'KB', sum(m['nv'] for m in out_meshes), 'vértices')
