#!/usr/bin/env python3
"""Independent oracle for gearboxmath. Recomputes every case from first
principles (no shared code with engine.js) and writes expected.json."""
import json, math

MESH_ETA = {'spur': 0.98, 'helical': 0.98, 'bevel': 0.96}
MU = 0.06

def worm_eta(lead_deg, mu=MU):
    g = math.radians(lead_deg); phi = math.atan(mu)
    return math.tan(g) / math.tan(g + phi)

def solve_train(stages, rpm, torque):
    r, t = rpm, torque
    cum_ratio = 1.0; cum_eta = 1.0
    for s in stages:
        ratio = s['driven'] / s['driver']
        eta = worm_eta(s.get('lead', 10)) if s['type'] == 'worm' else MESH_ETA[s['type']]
        r /= ratio; t *= ratio * eta
        cum_ratio *= ratio; cum_eta *= eta
    return {'totalRatio': cum_ratio, 'efficiency': cum_eta, 'outRpm': r, 'outTorque': t,
            'direction': 'reversed' if len(stages) % 2 == 1 else 'same'}

def planetary(sun, ring, fixed, rpm, torque):
    k = ring / sun
    if fixed == 'ring': ratio = 1 + k
    elif fixed == 'sun': ratio = 1 + 1 / k
    else: ratio = -k
    return {'planet': (ring - sun) / 2, 'ratio': ratio,
            'outRpm': rpm / ratio, 'outTorque': torque * ratio * 0.97}

cases = []
trains = [
    ([{'driver':12,'driven':60,'type':'spur'}], 3000, 0.5),
    ([{'driver':12,'driven':60,'type':'spur'},{'driver':12,'driven':60,'type':'spur'}], 3000, 0.5),
    ([{'driver':20,'driven':100,'type':'helical'}], 1750, 3),
    ([{'driver':16,'driven':48,'type':'bevel'},{'driver':14,'driven':56,'type':'spur'}], 1450, 1.2),
    ([{'driver':10,'driven':90,'type':'spur'},{'driver':10,'driven':80,'type':'spur'},{'driver':12,'driven':36,'type':'helical'}], 5000, 0.05),
    ([{'driver':1,'driven':40,'type':'worm','lead':4},{'driver':14,'driven':42,'type':'spur'}], 1400, 2),
    ([{'driver':1,'driven':60,'type':'worm','lead':10}], 900, 5),
    ([{'driver':2,'driven':50,'type':'worm','lead':20},{'driver':18,'driven':54,'type':'bevel'},{'driver':12,'driven':48,'type':'spur'}], 2800, 0.8),
    ([{'driver':17,'driven':68,'type':'spur'}], 100, 50),
    ([{'driver':12,'driven':61,'type':'spur'}], 3600, 0.3),
    ([{'driver':8,'driven':64,'type':'spur'},{'driver':8,'driven':64,'type':'spur'},{'driver':8,'driven':64,'type':'spur'},{'driver':8,'driven':64,'type':'spur'}], 6000, 0.02),
    ([{'driver':25,'driven':25,'type':'spur'}], 1000, 1),
]
for stages, rpm, torque in trains:
    cases.append({'kind':'train','stages':stages,'rpm':rpm,'torque':torque,'expected':solve_train(stages,rpm,torque)})

for sun, ring, fixed, rpm, torque in [(24,72,'ring',1200,1),(24,72,'sun',1200,1),(24,72,'carrier',1200,1),
                                       (12,60,'ring',3000,0.5),(18,90,'sun',900,2),(30,78,'carrier',750,4),(12,36,'ring',2000,0.1)]:
    cases.append({'kind':'planetary','sun':sun,'ring':ring,'fixed':fixed,'rpm':rpm,'torque':torque,
                  'expected':planetary(sun,ring,fixed,rpm,torque)})

for lead in [2,4,6,10,15,20,30]:
    cases.append({'kind':'worm','lead':lead,
                  'expected':{'eta':worm_eta(lead),'backdrivable':lead > math.degrees(math.atan(MU))}})

def gcd(a,b):
    while b: a,b = b,a%b
    return a
for a,b in [(12,60),(12,61),(17,68),(8,64),(25,25),(7,91),(100,35)]:
    cases.append({'kind':'gcd','a':a,'b':b,'expected':{'gcd':gcd(a,b),'hunting':gcd(a,b)==1,
                  'integerRatio':b % a == 0}})

for m,n1,n2 in [(2,12,60),(1.5,16,48),(3,20,100),(0.8,10,90),(2.5,17,68)]:
    cases.append({'kind':'sizing','module':m,'n1':n1,'n2':n2,
                  'expected':{'center':m*(n1+n2)/2,'d1':m*n1,'d2':m*n2}})

with open('expected.json','w') as f:
    json.dump({'cases':cases}, f, indent=1)
print(f'{len(cases)} cases written')
