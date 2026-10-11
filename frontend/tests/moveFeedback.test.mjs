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
  react.useLayoutEffect = react.useEffect;
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
    if (name === 'react/jsx-runtime') return { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
    return {};
  } });
  function render(move) {
    cursor = 0; exports.useMoveFeedback(move, 'room'); pending.splice(0).forEach(fn => fn());
    cursor = 0; return exports.useMoveFeedback(move, 'room');
  }
  function renderLayer(props) {
    cursor = 0; exports.MoveAnimationLayer(props); pending.splice(0).forEach(fn => fn());
    cursor = 0; return exports.MoveAnimationLayer(props);
  }
  function renderGeometry(game, board) {
    cursor = 0; const result = exports.useBoardGeometry(game, board);
    pending.splice(0).forEach(fn => fn());
    return result;
  }
  return { render, renderLayer, renderGeometry, advance(ms) { clock += ms; for (const [id, timer] of timers) {
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

test('capture lasts 900 ms and leaves its text summary afterward', () => {
  const c = client(); c.render(null);
  const m = { ...move(1), capturedCards: [{ id: 'cups-7', value: 7, suit: 'CUPS' }] };
  c.render(m); c.advance(899);
  assert.equal(c.render(m).animating, true);
  c.advance(1); assert.equal(c.render(m).animating, false);
  assert.equal(c.render(m).feedback.sequence, 1);
  c.advance(2600); assert.equal(c.render(m).feedback, null);
});

function layerFixture(playerId) {
  const rect = (x, y) => ({ x, y, width: 60, height: 90 });
  const table = { getBoundingClientRect: () => ({ x: 0, y: 100, width: 400, height: 120 }), querySelectorAll: () => [] };
  const players = ['local', 'manon', 'jeremie'].map((id, i) => ({ dataset: { playerId: id },
    querySelector: () => ({ getBoundingClientRect: () => rect(i * 100, id === 'local' ? 300 : 0) }) }));
  const root = { getBoundingClientRect: () => ({ x: 0, y: 0, width: 400, height: 500 }),
    querySelector: selector => selector === '.table-cards' ? table : { getBoundingClientRect: () => rect(0, 0) },
    querySelectorAll: () => players };
  return { move: { ...move(1), playerId, capturedCards: [{ id: 'cups-7', value: 7, suit: 'CUPS' }] },
    board: { current: root }, localPlayerId: 'local',
    previousGeometry: { current: { previousCards: new Map([['gold-7', rect(150, 300)], ['cups-7', rect(80, 110)]]) } } };
}
test('local card leaves its previous hand position and captured card starts in place', () => {
  const tree = client().renderLayer(layerFixture('local'));
  const group = tree.props.children;
  const [captured, played] = group.props.children;
  assert.equal(played.props.style['--card-dy'], '185px');
  assert.equal(captured[0].props.style.left, 80);
  assert.ok(parseFloat(group.props.style['--capture-right']) > 0);
});
test('each opponent uses its own player area above the table', () => {
  const manon = client().renderLayer(layerFixture('manon')).props.children.props.children[1];
  const jeremie = client().renderLayer(layerFixture('jeremie')).props.children.props.children[1];
  assert.ok(parseFloat(manon.props.style['--card-dy']) < 0);
  assert.notEqual(manon.props.style['--card-dx'], jeremie.props.style['--card-dx']);
});

test('card geometry survives the authoritative move snapshot and duplicate snapshots', () => {
  const c = client();
  let visible = [{ dataset: { cardId: 'cups-7' }, closest: () => null,
    getBoundingClientRect: () => ({ x: 80, y: 110, width: 60, height: 90 }) }];
  const board = { current: { querySelectorAll: () => visible } };
  c.renderGeometry({ lastMove: null }, board);
  visible = [];
  const geometry = c.renderGeometry({ lastMove: move(1) }, board);
  assert.equal(geometry.current.cards.size, 0);
  assert.equal(geometry.current.previousCards.get('cups-7').x, 80);
  c.renderGeometry({ lastMove: move(1) }, board);
  assert.equal(geometry.current.previousCards.get('cups-7').x, 80);
});
