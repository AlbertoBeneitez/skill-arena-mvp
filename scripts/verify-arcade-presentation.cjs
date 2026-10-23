// Read-only presentation regressions for the three-game clarity pass.
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
module.exports = (async () => {
  const root = path.resolve(__dirname, '..');
  const { recorder, compile, ui: sky, initial } = await require('./verify-sky-hop-presentation.cjs');
  async function core(file) {
    return import(pathToFileURL(path.join(root, '.det-test/lib/verified', file)));
  }
  async function renderer(file, dependencies, symbol) {
    const exports = {};
    new Function('require', 'exports', await compile(path.join(root, 'components/games', file), `\nexports.paint=${symbol};`))(
      name => dependencies[name] || require(name), exports,
    );
    return exports.paint;
  }
  const river = await core('riverDashCore.v4.js');
  const alien = await core('alienDashCore.v3.js');
  const common = { '@/lib/spaceBackdrop': { drawSpaceBackdrop() {} }, './CoreCanvasGame': { default() {} } };
  const paintRiver = await renderer('RiverDashVerified.tsx', { ...common, '@/lib/verified/riverDashCore.v4': river }, 'render');
  const paintAlien = await renderer('AlienDash.tsx', {
    ...common, '@/lib/verified/alienDashCore.v3': alien,
    './alien-dash/presentation': { withAlienCamera(ctx, viewport, draw) { draw(); return { horizontal: false, left: 0, scale: 1 }; }, alienCssScale() { return 1; } },
  }, 'renderWorld');
  function draw(paint, state) {
    const before = JSON.stringify(state), ctx = recorder();
    paint(ctx, state);
    assert.equal(JSON.stringify(state), before, 'renderer changed authoritative state');
    assert.equal(ctx.stack.length, 0, 'unbalanced canvas save/restore');
    for (const call of ctx.calls) for (const value of call.args) {
      if (typeof value === 'number') assert.ok(Number.isFinite(value), 'nonfinite drawing coordinate');
    }
    return ctx;
  }
  const state = alien.ALIEN_DASH_CORE_V3.create('shadow-regression');
  state.actors = [{ ...state.actors[0], kind: 'platform', x: 0, width: 200000, height: 44000, bottom: 508000 }];
  state.scroll = 0;
  state.feet = 464000;
  let ctx = draw(paintAlien, state);
  assert.ok(ctx.calls.some(c => c.op === 'ellipse' && c.args[0] === 90 && c.args[1] === 464), 'shadow must sit on raised roof');
  state.actors = [];
  ctx = draw(paintAlien, state);
  assert.ok(ctx.calls.some(c => c.op === 'ellipse' && c.args[0] === 90 && c.args[1] === 508), 'shadow must return to ground');
  for (let seed = 0; seed < 8; seed++) {
    const r = river.RIVER_DASH_CORE_V4.create(`presentation-${seed}`);
    for (const tick of [0, 1, 6, 12, 240, 1800]) {
      r.tick = tick;
      draw(paintRiver, r);
    }
  }
  const crumble = initial.platforms.findIndex(p => p.kind === 'crumble');
  assert.ok(crumble >= 0);
  const broken = structuredClone(initial);
  broken.camera = broken.platforms[crumble].y - 300000;
  broken.brokenAt[crumble] = 100;
  broken.tick = 101;
  ctx = draw(sky.render, broken);
  assert.ok(ctx.calls.some(c => c.op === 'fillRect' && c.fillStyle === '#ef94aa' && c.args[2] === 6 && c.args[3] === 3), 'broken platform should disperse');
  broken.tick = 148;
  ctx = draw(sky.render, broken);
  assert.ok(!ctx.calls.some(c => c.op === 'fillRect' && c.fillStyle === '#ef94aa' && c.args[2] === 6 && c.args[3] === 3), 'debris must expire');
  for (const elapsed of [0, 150, 300]) {
    const terminal = { ...initial, status: 'failed', failure: 'FALLEN' };
    draw((ctx, s) => sky.failureFinale.render(ctx, s, elapsed), terminal);
  }
  console.log('Arcade presentation: raised-roof shadow, river flow/traffic geometry, crumble expiry, fall finale, finite coordinates and immutable state passed');
})();
