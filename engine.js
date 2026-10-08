/* gearboxmath engine - gear-train truth-teller.
   Pure functions, shared by browser and node test runner.
   Published anchors: per-mesh efficiencies (spur/helical ~0.98, bevel ~0.96 - typical published values);
   worm model eta = tan(lead)/tan(lead+friction angle), backdrivable iff lead > friction angle (published);
   undercut minimum 17 teeth for standard 20-deg full-depth spur teeth (published standard);
   hunting-tooth rule gcd==1 spreads wear (published design guidance);
   Willis equation for simple planetary trains. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Gearbox = api;
})(typeof self !== 'undefined' ? self : globalThis, function () {
  const MESH_ETA = { spur: 0.98, helical: 0.98, bevel: 0.96 };
  const UNDERCUT_MIN = 17; // standard 20 deg full-depth teeth, published
  const WORM_MU = 0.06;    // typical steel worm / bronze wheel, published range ~0.05-0.08

  const rad = d => d * Math.PI / 180;
  const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) { [a, b] = [b, a % b]; } return a; };

  function wormEta(leadDeg, mu) {
    const g = rad(leadDeg), phi = Math.atan(mu);
    return Math.tan(g) / Math.tan(g + phi);
  }
  function wormBackdrivable(leadDeg, mu) { return leadDeg > Math.atan(mu) * 180 / Math.PI; }

  function stageMath(driverTeeth, drivenTeeth, type, leadDeg) {
    const ratio = drivenTeeth / driverTeeth; // reduction >1 slows down
    let eta, backdrivable = true;
    if (type === 'worm') {
      eta = wormEta(leadDeg == null ? 10 : leadDeg, WORM_MU);
      backdrivable = wormBackdrivable(leadDeg == null ? 10 : leadDeg, WORM_MU);
    } else eta = MESH_ETA[type];
    const g = gcd(driverTeeth, drivenTeeth);
    const hunting = g === 1;
    const integerRatio = drivenTeeth % driverTeeth === 0;
    return { ratio, eta, backdrivable, gcd: g, hunting, integerRatio };
  }

  function solveTrain(stages, inputRpm, inputTorque) {
    // stages: [{driver, driven, type, leadDeg?}] - each external mesh flips direction
    let rpm = inputRpm, torque = inputTorque, cumRatio = 1, cumEta = 1;
    const rows = [], warnings = [];
    stages.forEach((s, i) => {
      const m = stageMath(s.driver, s.driven, s.type, s.leadDeg != null ? s.leadDeg : s.lead);
      rpm = rpm / m.ratio;
      torque = torque * m.ratio * m.eta;
      cumRatio *= m.ratio; cumEta *= m.eta;
      rows.push({
        stage: i + 1, driver: s.driver, driven: s.driven, type: s.type,
        ratio: m.ratio, eta: m.eta, outRpm: rpm, outTorque: torque,
        dir: (i + 1) % 2 === 1 ? 'reversed' : 'same'
      });
      if (s.driver < UNDERCUT_MIN || (s.driven < UNDERCUT_MIN && s.type !== 'worm'))
        warnings.push(`Stage ${i + 1}: under 17 teeth (${Math.min(s.driver, s.driven)}) - standard 20-deg full-depth teeth undercut below 17 (published minimum); real gears need profile shift.`);
      if (m.integerRatio && s.type !== 'worm')
        warnings.push(`Stage ${i + 1}: exact integer ratio ${m.ratio}:1 - the same teeth meet every revolution, so wear concentrates (hunting-tooth design guidance). A one-tooth change (hunting ratio) spreads it.`);
      else if (!m.hunting && s.type !== 'worm')
        warnings.push(`Stage ${i + 1}: tooth counts share a factor of ${m.gcd} - tooth pairs re-meet periodically; coprime counts (hunting ratio) spread wear evenly.`);
      if (s.type === 'worm') {
        warnings.push(`Stage ${i + 1} worm (lead ${s.leadDeg} deg): model efficiency ${(m.eta * 100).toFixed(0)}% from eta = tan(lead)/tan(lead + friction angle), mu ${WORM_MU} (published model, real values vary with lubricant and speed).`);
        warnings.push(m.backdrivable
          ? `Stage ${i + 1} worm: lead angle above the friction angle - the wheel CAN back-drive the worm (published criterion). Do not count on it to hold a load.`
          : `Stage ${i + 1} worm: lead angle below the friction angle - self-locking in this model; it can hold position, but treat self-locking as a bonus, not a brake.`);
      }
    });
    const dir = stages.length % 2 === 1 ? 'reversed' : 'same';
    return { rows, warnings, totalRatio: cumRatio, efficiency: cumEta, outRpm: rpm, outTorque: torque, direction: dir };
  }

  function solvePlanetary(sun, ring, fixed, inputRpm, inputTorque) {
    // Simple planetary: planets mesh sun and ring. Willis: (ws - wc) / (wr - wc) = -ring/sun.
    const planet = (ring - sun) / 2;
    const warnings = [];
    if (planet !== Math.floor(planet)) warnings.push(`Sun ${sun} + ring ${ring} leave a non-integer planet tooth count - pick ring = sun + 2 x planet.`);
    if (planet < 1) warnings.push('Ring must exceed sun for real planets to fit.');
    const k = ring / sun;
    let ratio, label;
    if (fixed === 'ring') { ratio = 1 + k; label = 'ring fixed, carrier out: 1 + ring/sun'; }
    else if (fixed === 'sun') { ratio = 1 + 1 / k; label = 'sun fixed, carrier out: 1 + sun/ring'; }
    else { ratio = -k; label = 'carrier fixed, ring out: -ring/sun (reverse)'; }
    const outRpm = inputRpm / ratio;
    const eta = 0.97; // simple planetary per-stage typical published figure
    return { planet, ratio, outRpm, outTorque: inputTorque * ratio * eta, eta, label, warnings,
             reverse: ratio < 0 };
  }

  const centerDistance = (module_, n1, n2) => module_ * (n1 + n2) / 2;
  const pitchDia = (module_, n) => module_ * n;
  const fmt = (x, dp) => x.toFixed(dp == null ? 2 : dp);

  return { MESH_ETA, UNDERCUT_MIN, WORM_MU, gcd, wormEta, wormBackdrivable, stageMath, solveTrain, solvePlanetary, centerDistance, pitchDia, fmt };
});
