# Exatidão vertical (ASPRS 2023, "NVA"): pontos de controlo = chão LiDAR, aberto, sem mudanças
import numpy as np, json
from scipy.spatial import cKDTree
from caminhos import *
rng = np.random.default_rng(1)
L = np.load(LAZ_BAIRRO); lx, ly, lz, lc = L['x'], L['y'], L['z'], L['c']
Mo = np.load('modelo.npz'); mE, mN, mz, op = Mo['E'], Mo['N'], Mo['z'], Mo['op']; mX, mY = Mo['X'], Mo['Y']
E0, N0 = np.median(lx), np.median(ly)
g = lc == 2
gx, gy, gz = lx[g], ly[g], lz[g]
tg = cKDTree(np.stack([gx, gy], 1))
alto = np.isin(lc, [4, 5, 6])
ta = cKDTree(np.stack([lx[alto], ly[alto]], 1))
k = op > 0.5
tm = cKDTree(np.stack([mE[k], mN[k]], 1)); mzk = mz[k]
# 1) candidatos: um ponto de chão por célula de 2 m (o mais perto do centro)
cel = np.floor(np.stack([gx, gy], 1) / 2).astype(np.int64)
chave = cel[:, 0] * 10**7 + cel[:, 1]
d0 = np.hypot(gx - (cel[:, 0] + .5) * 2, gy - (cel[:, 1] + .5) * 2)
o = np.lexsort((d0, chave)); _, primeiro = np.unique(chave[o], return_index=True)
cand = o[primeiro]
n_celulas = len(cand); print('células com chão', n_celulas)
# 2) aberto: nada alto (árvore/prédio) a menos de 1,5 m
viz = ta.query_ball_point(np.stack([gx[cand], gy[cand]], 1), 1.5, return_length=True)
cand = cand[viz == 0]
n_abertos = len(cand); print('abertos', n_abertos)
# 3) plano: chão LiDAR num raio de 1 m cabe num plano (resíduo < 5 cm, declive < 15 %)
P = np.stack([gx[cand], gy[cand]], 1)
viz = tg.query_ball_point(P, 1.0)
ok = np.zeros(len(cand), bool); decl = np.zeros(len(cand)); zplano_L = np.zeros(len(cand))
for i, v in enumerate(viz):
    if len(v) < 8: continue
    A = np.stack([gx[v] - P[i, 0], gy[v] - P[i, 1], np.ones(len(v))], 1)
    sol, *_ = np.linalg.lstsq(A, gz[v], rcond=None)
    r = gz[v] - A @ sol
    decl[i] = np.hypot(sol[0], sol[1]); zplano_L[i] = sol[2]
    ok[i] = (np.sqrt(np.mean(r**2)) < 0.05) and decl[i] < 0.15
cand, P, decl, zplano_L = cand[ok], P[ok], decl[ok], zplano_L[ok]
n_planos = len(cand); print('planos', n_planos)
# 4) altura do modelo: mediana das manchas (opacidade > 0,5) a menos de 30 cm; sem objetos por cima
viz = tm.query_ball_point(P, 0.3)
zm = np.full(len(cand), np.nan); limpo = np.zeros(len(cand), bool); nviz = np.zeros(len(cand), int)
for i, v in enumerate(viz):
    if len(v) < 5: continue
    zz = mzk[v]; med = np.median(zz)
    zm[i] = med; nviz[i] = len(v)
    limpo[i] = np.mean(zz > med + 0.5) < 0.1   # carro, muro novo, gente
sel = np.isfinite(zm) & limpo
cand, P, zm, zL = cand[sel], P[sel], zm[sel], zplano_L[sel]
print('com modelo e limpos', len(cand))
# coordenadas do modelo (antes da rotação) nesses pontos, para a correção do site
tX = cKDTree(np.stack([mE, mN], 1))
_, j = tX.query(P); Xm, Ym = mX[j] + (P[:, 0] - mE[j]), mY[j] + (P[:, 1] - mN[j])
# 5) dobras espaciais: xadrez de 50 m
blk = np.floor((P - [E0, N0]) / 50).astype(int)
dobra = (blk[:, 0] + blk[:, 1]) % 2
bid = blk[:, 0] * 1000 + blk[:, 1]
def ajusta(i):
    A = np.stack([zm[i], P[i, 0] - E0, P[i, 1] - N0, np.ones(i.sum())], 1)
    w = np.ones(i.sum())
    for _ in range(10):
        sol = np.linalg.lstsq(A * w[:, None], zL[i] * w, rcond=None)[0]
        r = zL[i] - A @ sol; s_ = 1.4826 * np.median(np.abs(r)); w = (np.abs(r) < 3 * s_).astype(float)
    return sol
def aplica(sol, i):
    return sol[0] * zm[i] + sol[1] * (P[i, 0] - E0) + sol[2] * (P[i, 1] - N0) + sol[3]
erro = np.full(len(cand), np.nan)
sols = []
for f in (0, 1):
    sol = ajusta(dobra != f); sols.append(sol)
    erro[dobra == f] = aplica(sol, dobra == f) - zL[dobra == f]
# correção que o site usa (altura.json a1), ajustada noutra sessão contra o MDS: só o desvio constante é novo
a1 = json.load(open(ALTURA_SITE))['a1']
zsite = zm - a1['b'] * Xm + a1['c'] * Ym - a1['d']
off = np.median(zsite - zL)
erro_site = zsite - off - zL
# sem correção nenhuma (só o desvio constante)
erro_bruto = zm - zL - np.median(zm - zL)
# As zonas que mudaram vêm de 4-mudanca.py, que por sua vez usa a inclinação
# ajustada aqui. Na primeira passagem ainda não existem: corre-se este, depois
# 4-mudanca.py, e depois este outra vez (o ajuste não depende delas).
import os
if os.path.exists('mudanca.npz'):
    zmud = np.load('mudanca.npz')
    ixm = ((P[:, 0] - float(zmud['x0'])) / 0.5).astype(int); iym = ((P[:, 1] - float(zmud['y0'])) / 0.5).astype(int)
    mudou = zmud['mud'][iym, ixm]
else:
    print('ainda sem mudanca.npz: corra 4-mudanca.py e depois este outra vez')
    mudou = np.zeros(len(P), bool)
print('em zonas mudadas', mudou.sum())
def est(e, nome, sel):
    if not sel.any():   # na primeira passagem não há zonas mudadas
        print(nome, 'sem pontos'); return None
    e = e[sel]; b_ = bid[sel]
    rmse = np.sqrt(np.mean(e**2)); nm = 1.4826 * np.median(np.abs(e - np.median(e)))
    ub = np.unique(b_); grupos = {u: np.nonzero(b_ == u)[0] for u in ub}; bs = []; bn = []; b95 = []
    for _ in range(1000):
        esc = rng.choice(ub, len(ub)); ee = e[np.concatenate([grupos[u] for u in esc])]
        bs.append(np.sqrt(np.mean(ee**2))); bn.append(1.4826 * np.median(np.abs(ee - np.median(ee)))); b95.append(np.percentile(np.abs(ee), 95))
    r = dict(n=int(len(e)), blocos=int(len(ub)), media=e.mean(), dp=e.std(ddof=1), rmse=rmse, rmse_ic=np.percentile(bs, [2.5, 97.5]).tolist(),
             nmad=nm, nmad_ic=np.percentile(bn, [2.5, 97.5]).tolist(), mediana=np.median(e),
             p68=np.percentile(np.abs(e), 68), p95=np.percentile(np.abs(e), 95), p95_ic=np.percentile(b95, [2.5, 97.5]).tolist(),
             mais_1m=int((np.abs(e) > 1).sum()))
    print(nome, {k_: (np.round(v, 3).tolist() if isinstance(v, list) else round(float(v), 3)) for k_, v in r.items()})
    return r
todos = np.ones(len(erro), bool)
res = dict(validacao_cruzada_sem_mudancas=est(erro, 'VC, sem mudanças', ~mudou),
           validacao_cruzada_todos=est(erro, 'VC, todos', todos),
           validacao_cruzada_mudados=est(erro, 'VC, só mudados', mudou),
           correcao_site_sem_mudancas=est(erro_site, 'site, sem mudanças', ~mudou),
           sem_correcao_sem_mudancas=est(erro_bruto, 'sem correção, sem mudanças', ~mudou),
           solucoes=[s_.tolist() for s_ in sols], declive_mediano=float(np.median(decl)), vizinhos_medianos=int(np.median(nviz)),
           candidatos=dict(chao=int(n_celulas), abertos=int(n_abertos), planos=int(n_planos), finais=int(len(erro))))
# por tipo de superfície? cor do modelo não diz; fica a distribuição espacial
np.savez('vertical_pontos.npz', P=P, mudou=mudou, erro=erro, erro_site=erro_site, erro_bruto=erro_bruto, dobra=dobra)
json.dump(res, open('vertical.json', 'w'), indent=1, default=float)
