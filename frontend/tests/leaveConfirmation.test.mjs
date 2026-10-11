import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function client(status) {
  const slots = [], effects = [];
  let cursor = 0, calls = 0, restored = 0, finishLeave;
  const saved = { roomCode: 'ROOM', playerId: 'me', sessionToken: 'token' };
  const room = { roomCode: 'ROOM', players: [], game: status ? { status, hand: [] } : null };
  const react = {
    useState(initial) {
      const i = cursor++;
      if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial;
      return [slots[i], value => { slots[i] = value; }];
    },
    useRef(initial) { const i = cursor++; return slots[i] ??= { current: initial }; },
    useMemo(fn) { return fn(); },
    useEffect(fn, deps) {
      const i = cursor++, old = slots[i];
      if (!old || deps.some((value, j) => value !== old[j])) {
        slots[i] = deps;
        effects.push(fn);
      }
    },
  };
  class HTMLElement { focus() { restored++; } }
  const exports = {};
  const source = fs.readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText;
  vm.runInNewContext(compiled, {
    exports, HTMLElement, document: { activeElement: new HTMLElement() }, AbortController,
    localStorage: { getItem: key => key === 'scopa.roomSession' ? JSON.stringify(saved) : '', setItem() {}, removeItem() {} },
    require(name) {
      if (name === 'react') return react;
      if (name === 'react/jsx-runtime') return { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
      if (name === './api/health') return { getHealth: async () => ({}) };
      if (name === './api/rooms') return {
        getGameRoom: async () => room,
        leaveRoom: (...args) => { assert.deepEqual([...args], Object.values(saved)); calls++; return new Promise(resolve => { finishLeave = resolve; }); },
      };
      if (name.includes('useScopaSocket')) return { createScopaSocket: () => ({ addEventListener() {}, close() {} }) };
      return new Proxy({}, { get: (_, key) => key });
    },
  });
  function render() { cursor = 0; const tree = exports.default(); effects.splice(0).forEach(fn => fn()); return tree; }
  return { render, calls: () => calls, restored: () => restored, finish: () => finishLeave() };
}

for (const status of [null, 'ACTIVE', 'ROUND_FINISHED', 'MATCH_FINISHED']) {
  test(`leave confirmation gates API for ${status ?? 'LOBBY'} and prevents duplicate calls`, async () => {
    const c = client(status);
    c.render(); await Promise.resolve();
    let [screen, dialog] = c.render().props.children;
    assert.equal(dialog, null);
    screen.props.onLeave();
    [screen, dialog] = c.render().props.children;
    assert.equal(c.calls(), 0);
    assert.equal(dialog.type, 'LeaveGameDialog');
    assert.equal(dialog.props.active, status === 'ACTIVE');
    dialog.props.onCancel();
    assert.equal(c.restored(), 1);
    assert.equal(c.render().props.children[1], null);
    assert.equal(c.calls(), 0);
    screen.props.onLeave();
    dialog = c.render().props.children[1];
    const first = dialog.props.onConfirm();
    await dialog.props.onConfirm();
    assert.equal(c.calls(), 1);
    assert.equal(c.render().props.children[1], null);
    c.finish(); await first;
    assert.equal(c.render().type, 'LandingScreen');
  });
}
