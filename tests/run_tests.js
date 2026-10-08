#!/usr/bin/env node
/* Compares engine.js against the independent Python oracle (expected.json),
   plus property and published-anchor checks. */
const G = require('../engine.js');
const exp = require('./expected.json');
let pass = 0, fail = 0;
const T = (name, cond) => { if (cond) pass++; else { fail++; console.error('FAIL', name); } };
const near = (a, b, tol) => Math.abs(a - b) <= (tol || 1e-9) * Math.max(1, Math.abs(b));

for (const c of exp.cases) {
  if (c.kind === 'train') {
    const s = G.solveTrain(c.stages, c.rpm, c.torque);
    T(`train ratio ${JSON.stringify(c.stages.map(x=>x.driver+'>'+x.driven))}`, near(s.totalRatio, c.expected.totalRatio, 1e-12));
    T('train eta', near(s.efficiency, c.expected.efficiency, 1e-12));
    T('train rpm', near(s.outRpm, c.expected.outRpm, 1e-12));
    T('train torque', near(s.outTorque, c.expected.outTorque, 1e-12));
    T('train dir', s.direction === c.expected.direction);
  } else if (c.kind === 'planetary') {
    const p = G.solvePlanetary(c.sun, c.ring, c.fixed, c.rpm, c.torque);
    T(`planetary ${c.sun}/${c.ring}/${c.fixed} ratio`, near(p.ratio, c.expected.ratio, 1e-12));
    T('planetary rpm', near(p.outRpm, c.expected.outRpm, 1e-12));
    T('planetary torque', near(p.outTorque, c.expected.outTorque, 1e-12));
    T('planetary planet', p.planet === c.expected.planet);
  } else if (c.kind === 'worm') {
    T(`worm eta lead ${c.lead}`, near(G.wormEta(c.lead, G.WORM_MU), c.expected.eta, 1e-12));
    T('worm backdrive', G.wormBackdrivable(c.lead, G.WORM_MU) === c.expected.backdrivable);
  } else if (c.kind === 'gcd') {
    const m = G.stageMath(c.a, c.b, 'spur');
    T(`gcd ${c.a}/${c.b}`, G.gcd(c.a, c.b) === c.expected.gcd);
    T('hunting', m.hunting === c.expected.hunting);
    T('integer ratio', m.integerRatio === c.expected.integerRatio);
  } else if (c.kind === 'sizing') {
    T(`center ${c.module}/${c.n1}/${c.n2}`, near(G.centerDistance(c.module, c.n1, c.n2), c.expected.center, 1e-12));
    T('pitch dias', near(G.pitchDia(c.module, c.n1), c.expected.d1, 1e-12) && near(G.pitchDia(c.module, c.n2), c.expected.d2, 1e-12));
  }
}

// --- published anchors ---
T('anchor: 12>60 spur = 5:1', near(G.stageMath(12, 60, 'spur').ratio, 5));
T('anchor: 3000rpm/5 = 600rpm', near(G.solveTrain([{driver:12,driven:60,type:'spur'}], 3000, 0.5).outRpm, 600));
T('anchor: torque x5x0.98 = 2.45', near(G.solveTrain([{driver:12,driven:60,type:'spur'}], 3000, 0.5).outTorque, 2.45, 1e-12));
T('anchor: two 5:1 stages = 25:1', near(G.solveTrain([{driver:12,driven:60,type:'spur'},{driver:12,driven:60,type:'spur'}], 3000, 0.5).totalRatio, 25));
T('anchor: 0.98^2 = 0.9604', near(G.solveTrain([{driver:12,driven:60,type:'spur'},{driver:12,driven:60,type:'spur'}], 3000, 0.5).efficiency, 0.9604, 1e-12));
T('anchor: planetary 24/72 ring fixed = 4:1', near(G.solvePlanetary(24, 72, 'ring', 1200, 1).ratio, 4));
T('anchor: planetary 24/72 sun fixed = 1.3333', near(G.solvePlanetary(24, 72, 'sun', 1200, 1).ratio, 4/3, 1e-12));
T('anchor: carrier fixed = -3 reverse', near(G.solvePlanetary(24, 72, 'carrier', 1200, 1).ratio, -3));
T('anchor: worm lead 4 eta ~0.5359', near(G.wormEta(4, 0.06), Math.tan(4*Math.PI/180)/Math.tan((4+Math.atan(0.06)*180/Math.PI)*Math.PI/180), 1e-12));
T('anchor: friction angle atan(0.06) = 3.4336 deg', near(Math.atan(0.06)*180/Math.PI, 3.43363, 1e-4));

// --- properties ---
const rng = (() => { let s = 42; return () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff; })();
for (let i = 0; i < 60; i++) {
  const d = 8 + Math.floor(rng() * 60), n = d + 1 + Math.floor(rng() * 100);
  const type = ['spur','helical','bevel'][Math.floor(rng() * 3)];
  const one = G.solveTrain([{driver:d,driven:n,type}], 1000, 1);
  T('prop: ratio>1 slows', one.outRpm < 1000 && one.outRpm > 0);
  T('prop: torque rises but under ideal', one.outTorque > 1 && one.outTorque < n / d + 1e-9);
  T('prop: dir flips once', one.direction === 'reversed');
  const two = G.solveTrain([{driver:d,driven:n,type},{driver:d,driven:n,type}], 1000, 1);
  T('prop: eta compounds down', two.efficiency < one.efficiency);
  T('prop: square ratio', near(two.totalRatio, one.totalRatio * one.totalRatio, 1e-9));
  T('prop: two stages same dir', two.direction === 'same');
}
for (let i = 0; i < 40; i++) {
  const sun = 12 + Math.floor(rng() * 30), planet = 6 + Math.floor(rng() * 20), ring = sun + 2 * planet;
  const rf = G.solvePlanetary(sun, ring, 'ring', 500, 1);
  T('prop: ring-fixed ratio = 1+ring/sun', near(rf.ratio, 1 + ring / sun, 1e-12));
  const sf = G.solvePlanetary(sun, ring, 'sun', 500, 1);
  T('prop: sun-fixed slower than ring-fixed', sf.ratio < rf.ratio);
  T('prop: planet implied', rf.planet === planet);
}
for (const lead of [2,4,6,10,15,20,30]) {
  T('prop: worm eta in (0,1)', G.wormEta(lead, 0.06) > 0 && G.wormEta(lead, 0.06) < 1);
}
T('prop: worm eta rises with lead', G.wormEta(20, 0.06) > G.wormEta(4, 0.06));
T('prop: undercut boundary 17', G.UNDERCUT_MIN === 17);
T('prop: 1:1 stage keeps speed', near(G.solveTrain([{driver:25,driven:25,type:'spur'}], 1000, 1).outRpm, 1000));

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
