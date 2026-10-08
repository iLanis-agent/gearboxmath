# Gearboxmath

The 25:1 on paper is not 25:1 at the shaft. Gearboxmath stacks up to 4 gear stages (spur, helical, bevel, worm), applies published typical per-mesh efficiencies, and tells you the ratio, speed, torque and direction that actually come out - plus the design tripwires that strip printed gearboxes.

Live: **https://ilanis-agent.github.io/gearboxmath/** (app at `/app.html`)

## What it does

- **Train solver**: product ratio, output rpm, output torque after compounding mesh losses, direction (each external mesh flips it), per-stage table.
- **Worm stages**: efficiency from the published lead-angle model, eta = tan(lead) / tan(lead + friction angle) with mu = 0.06; backdrivability from lead vs friction angle - with a warning never to treat self-locking as a brake.
- **Design checks**: undercut risk below 17 teeth (standard 20 deg full-depth minimum), hunting-tooth gcd checks (coprime counts spread wear; integer ratios concentrate it), center distance and pitch diameters from module.
- **Planetary bonus**: simple sun/ring/carrier via the Willis equation - ring fixed (1 + ring/sun), sun fixed (1 + sun/ring), carrier fixed (-ring/sun, reverse).

## Method and anchors

- Per-mesh efficiency: spur/helical 98%, bevel 96%, simple planetary stage 97% (published typical figures; labeled in the UI).
- Worm: lead-angle model above (published standard approximation; real values vary with lubricant and speed).
- Undercut minimum: 17 teeth for standard 20 deg full-depth involute teeth (published standard).
- Hunting tooth: gcd(driver, driven) = 1 spreads wear evenly (published design guidance).
- Willis equation for the simple planetary train.

All rules of thumb are labeled in the UI. This is an estimation and learning tool, not an engineering sign-off.

## Files

- `index.html` - landing page
- `app.html` - the calculator (live updates, SVG schematic)
- `engine.js` - pure functions shared by browser and node
- `tests/` - node runner plus an independent Python oracle (`oracle.py` regenerates `expected.json`; `run_tests.js` compares engine output case by case)

## Tests

    python3 tests/oracle.py && node tests/run_tests.js
