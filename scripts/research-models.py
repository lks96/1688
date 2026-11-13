"""Exploratory comparison. All existing 2026 outcomes were already inspected.

No row is used to predict itself, but these results are NOT a fresh holdout.
Candidate definitions are fixed here before running the comparison.
"""
import json
import math
from pathlib import Path
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
Z = list('鼠牛虎兔龙蛇马羊猴鸡狗猪')
TRANS = str.maketrans({'龍':'龙','馬':'马','雞':'鸡','豬':'猪'})
raw = sorted(json.loads((ROOT/'lib/seed.json').read_text()),key=lambda r:r['openTime'])
raw = list({str(r['expect']):r for r in raw}.values())
ys=[];bs=[];counts=[];sizes=[]
for r in raw:
    animals=r['zodiac'].translate(TRANS).split(',')
    c=np.array([animals.count(z) for z in Z]);counts.append(c);ys.append((c>0).astype(float))
    offset=(Z.index(animals[0])+int(r['openCode'].split(',')[0])-1)%12
    sizes.append(np.array([5 if z==offset else 4 for z in range(12)]))
    bs.append([1-math.comb(49-(5 if z==offset else 4),7)/math.comb(49,7) for z in range(12)])
y=np.array(ys);base=np.array(bs);res=y-base;n=len(y)
prefix=np.vstack([np.zeros(12),np.cumsum(res,axis=0)])
names=['baseline','legacy90','short7','short14','short30','multiWindow','transition30','transition90','pooledLogistic','adaptive']
p={name:np.zeros((n+1,12)) for name in names}
decay=np.zeros(12);weight=0;coef=np.zeros(6);squared=np.ones(6)
members=['short7','short14','short30','multiWindow','transition30','transition90']
hits={name:[] for name in members}
def select(scores):return np.lexsort((np.arange(12),-np.round(scores,12)))[:3]
for t in range(n+1):
    b=base[min(t,n-1)]
    def window(k,s):return (prefix[t]-prefix[max(0,t-k)])/(s+min(k,t))
    p['baseline'][t]=b
    p['legacy90'][t]=b+decay/(60+weight)
    p['short7'][t]=b+window(7,12)
    p['short14'][t]=b+window(14,20)
    p['short30'][t]=b+window(30,30)
    p['multiWindow'][t]=b+.25*window(7,12)+.35*window(14,20)+.4*window(30,30)
    for name,k in [('transition30',30),('transition90',90)]:
        sums=np.zeros(12);total=np.zeros(12)
        for i in range(max(1,t-k),t):
            mask=y[i-1]==y[t-1]
            sums+=res[i]*mask;total+=mask
        p[name][t]=b+sums/(20+total)
    features=np.column_stack([window(7,0) if t else np.zeros(12),window(14,0) if t else np.zeros(12),window(30,0) if t else np.zeros(12),res[t-1] if t else np.zeros(12),(counts[t-1]-7*sizes[t-1]/49) if t else np.zeros(12),np.ones(12)])
    # Shared coefficients: no separate zodiac intercept to memorize identities.
    logits=np.log(b/(1-b))+features@coef
    p['pooledLogistic'][t]=1/(1+np.exp(-logits))
    rewards=np.array([np.mean(hits[name][-60:]) if hits[name] else 1.5 for name in members])
    weights=np.exp((rewards-rewards.max())/.15);weights=.9*weights/weights.sum()+.1/len(members)
    p['adaptive'][t]=sum(weights[i]*p[name][t] for i,name in enumerate(members))
    for name in names:p[name][t]=np.clip(p[name][t],.000001,.999999)
    if t==n:break
    if t>=90:
        for name in members:hits[name].append(float(y[t,select(p[name][t])].sum()))
    gradient=features.T@(p['pooledLogistic'][t]-y[t])/12+.05*coef
    squared+=gradient**2;coef-=.15*gradient/np.sqrt(squared)
    decay=decay*2**(-1/90)+res[t];weight=weight*2**(-1/90)+1

def metrics(name,mask):
    ids=np.flatnonzero(mask);sets=[select(p[name][t]) for t in ids]
    h=np.array([y[t,s].sum() for t,s in zip(ids,sets)])
    changes=[len(set(a)^set(b))/2 for a,b in zip(sets,sets[1:])]
    return {'draws':len(ids),'meanHits':float(h.mean()),'allHit':float((h==3).mean()),'anyHit':float((h>0).mean()),'brier':float(((p[name][ids]-y[ids])**2).mean()),'setChangeRate':float(np.mean(np.array(changes)>0)),'current':[Z[z] for z in select(p[name][-1])],'last30MeanHits':float(h[-30:].mean())}
val=np.array([i>=90 and r['openTime'].startswith('2025') for i,r in enumerate(raw)])
test=np.array([r['openTime'].startswith('2026') for r in raw])
out={'status':'exploratory_reused_history','note':'Python exploratory rankings use NumPy rounding; published-comparison.json uses the retained JavaScript tie rule and is authoritative for the Site. No candidate showed a reliable gain; no hyperparameter search was performed. Logistic and short-window trials are retained here including their poor results.','futureVerificationFrom':'2026-10-16','definitions':names,'development':{name:metrics(name,val) for name in names},'historical2026':{name:metrics(name,test) for name in names}}
report=ROOT/'research';report.mkdir(exist_ok=True)
(report/'comparison.json').write_text(json.dumps(out,ensure_ascii=False,indent=2))
print(json.dumps(out,ensure_ascii=False,indent=2))
