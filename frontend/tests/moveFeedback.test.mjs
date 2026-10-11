import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

// Exercise the real hook with deterministic effect scheduling and virtual timers.
function client(reduced = false) {
  const slots = []; let cursor = 0; const pending = []; const timers = new Map(); let clock = 0; let next = 0;
  const react = {
    useRef(value) { const i = cursor++; return slots[i] ??= { current: value }; },
    useState(value) { const i = cursor++; if (!(i in slots)) slots[i] = typeof value === 'function' ? value() : value;
      return [slots[i], value => { slots[i] = value; }]; },
    useEffect(effect, deps) { const i = cursor++; const old = slots[i];
      if (!old || deps.some((d, j) => d !== old.deps[j])) pending.push(() => {
        old?.cleanup?.(); slots[i] = { deps, cleanup: effect() };
      });
    },
  };
  const media = { matches: reduced, addEventListener() {}, removeEventListener() {} };
  const window = { matchMedia: () => media,
    setTimeout(fn, delay) { const id = ++next; timers.set(id, { fn, at: clock + delay }); return id; },
    clearTimeout(id) { timers.delete(id); },
  };
  const source = fs.readFileSync(new URL('../src/components/game/MoveFeedback.tsx', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, { exports, window, require(name) {
    if (name === 'react') return react;
    return {};
  } });
  function render(move) {
    cursor = 0; exports.useMoveFeedback(move, 'room'); pending.splice(0).forEach(fn => fn());
    cursor = 0; return exports.useMoveFeedback(move, 'room');
  }
  return { render, advance(ms) { clock += ms; for (const [id, timer] of timers) {
    if (timer.at <= clock) { timers.delete(id); timer.fn(); }
  } } };
}
const move = sequence => ({ sequence, playerId: 'manon', playerDisplayName: 'Manon',
  playedCard: { id: 'gold-7', value: 7, suit: 'GOLD' }, capturedCards: [], scopa: false });

test('initial/reconnected snapshot is static context', () => {
  const c = client(); const m = move(42);
  assert.equal(c.render(m).animating, false);
  assert.equal(c.render(m).feedback.sequence, 42);
  c.advance(2600); assert.equal(c.render(m).feedback, null);
});
test('new sequences animate once, duplicates do not restart, next move replaces active feedback', () => {
  const c = client(); c.render(null);
  assert.equal(c.render(move(1)).animating, true);
  c.advance(200); c.render(move(1)); c.advance(800);
  assert.equal(c.render(move(1)).animating, false);
  assert.equal(c.render(move(2)).animating, true);
  assert.equal(c.render(move(3)).feedback.sequence, 3);
  c.advance(4000); assert.equal(c.render(move(3)).feedback, null);
  assert.equal(c.render(move(3)).animating, false);
});
test('reduced motion preserves public feedback without movement', () => {
  const c = client(true); c.render(null);
  const result = c.render(move(1));
  assert.equal(result.animating, false); assert.equal(result.reduced, true);
  assert.equal(result.feedback.playedCard.id, 'gold-7');
});
test('round resets clear visuals while keeping the sequence watermark', () => {
  const c = client(); c.render(null); c.render(move(5));
  assert.equal(c.render(null).feedback, null);
  assert.equal(c.render(move(4)).animating, false);
  assert.equal(c.render(move(6)).animating, true);
});
