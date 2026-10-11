import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function client(status, options = {}) {
  const slots = [], effects = [];
  let cursor = 0, calls = 0, restored = 0, finishLeave, finishSnapshot;
  const sockets = [], timers = new Map(), joins = [], lifecycle = [];
  let timerId = 0, finishLifecycle;
  const saved = { roomCode: 'ROOM', playerId: 'me', sessionToken: 'token' };
  let room = { roomCode: 'ROOM', hostPlayerId: 'me', players: [
    { playerId: 'me', displayName: 'Quentin', host: true, connected: true },
    { playerId: 'other', displayName: 'Manon', connected: status !== 'PAUSED' },
  ], game: status ? { status, hand: [] } : null };
  const storage = new Map([
    ['scopa.displayName', 'Quentin'],
    ...(options.active === false ? [] : [['scopa.roomSession', JSON.stringify(saved)]]),
    ...(options.reserved ? [['scopa.reservedSessions', JSON.stringify({ ROOM: saved })]] : []),
  ]);
  class ApiError extends Error { constructor(message, status) { super(message); this.status = status; } }
  const doLifecycle = action => {
    lifecycle.push(action);
    return new Promise(resolve => { finishLifecycle = () => {
      room = action === 'resume' ? { ...room, game: { ...room.game, status: 'ACTIVE' } }
        : { ...room, game: null, status: 'LOBBY' };
      resolve(room);
    }; });
  };
  const react = {
    useState(initial) {
      const i = cursor++;
      if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial;
      return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value; }];
    },
    useRef(initial) { const i = cursor++; return slots[i] ??= { current: initial }; },
    useMemo(fn) { return fn(); },
    useEffect(fn, deps) {
      const i = cursor++, old = slots[i];
      if (!old || deps.some((value, j) => value !== old.deps[j])) {
        slots[i] = { deps };
        effects.push(() => { old?.cleanup?.(); slots[i].cleanup = fn(); });
      }
    },
  };
  class HTMLElement { focus() { restored++; } }
  const trigger = new HTMLElement();
  const exports = {};
  const source = fs.readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText;
  vm.runInNewContext(compiled, {
    exports, HTMLElement, document: { activeElement: null }, AbortController,
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
    setTimeout: fn => { const id = ++timerId; timers.set(id, fn); return id; },
    clearTimeout: id => timers.delete(id),
    require(name) {
      if (name === 'react') return react;
      if (name === 'react/jsx-runtime') return { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
      if (name === './api/health') return { getHealth: async () => ({}) };
      if (name === './api/rooms') return {
        ApiError,
        getGameRoom: async () => {
          if (options.fetchError) throw options.fetchError;
          if (options.fetchDeferred) return new Promise(resolve => { finishSnapshot = () => resolve(room); });
          return room;
        },
        joinRoom: async (...args) => { joins.push(args); return { ...saved, room }; },
        resumeGame: () => doLifecycle('resume'),
        endGame: () => doLifecycle('end'),
        leaveRoom: (...args) => { assert.deepEqual([...args], Object.values(saved)); calls++; return new Promise(resolve => { finishLeave = resolve; }); },
      };
      if (name.includes('useScopaSocket')) return { createScopaSocket: (...identity) => {
        const listeners = {};
        const socket = { identity, emit: (name, event) => listeners[name]?.(event),
          addEventListener: (name, listener) => { listeners[name] = listener; },
          close: () => listeners.close?.({ code: 1000 }) };
        sockets.push(socket);
        return socket;
      } };
      return new Proxy({}, { get: (_, key) => key });
    },
  });
  function render() { cursor = 0; const tree = exports.default(); effects.splice(0).forEach(fn => fn()); return tree; }
  return { render, trigger, saved, storage, sockets, joins, lifecycle,
    calls: () => calls, restored: () => restored, finish: () => finishLeave(),
    finishLifecycle: () => finishLifecycle(),
    finishSnapshot: () => finishSnapshot(),
    retry: () => { const pending = [...timers.values()]; timers.clear(); pending.forEach(fn => fn()); },
  };
}

for (const status of [null, 'ACTIVE', 'PAUSED', 'ROUND_FINISHED', 'MATCH_FINISHED']) {
  test(`leave confirmation gates API for ${status ?? 'LOBBY'} and prevents duplicate calls`, async () => {
    const c = client(status);
    c.render(); await Promise.resolve();
    let tree = c.render();
    let screen = tree.props.children[0], dialog = tree.props.children.at(-1);
    assert.equal(dialog, null);
    screen.props.onLeave({ currentTarget: c.trigger });
    tree = c.render();
    screen = tree.props.children[0]; dialog = tree.props.children.at(-1);
    assert.equal(c.calls(), 0);
    assert.equal(dialog.type, 'LeaveGameDialog');
    assert.equal(dialog.props.active, Boolean(status && status !== 'MATCH_FINISHED'));
    dialog.props.onCancel();
    assert.equal(c.restored(), 1);
    assert.equal(c.render().props.children.at(-1), null);
    assert.equal(c.calls(), 0);
    screen.props.onLeave();
    dialog = c.render().props.children.at(-1);
    const first = dialog.props.onConfirm();
    await dialog.props.onConfirm();
    assert.equal(c.calls(), 1);
    screen.props.onLeave({ currentTarget: c.trigger });
    assert.equal(c.render().props.children.at(-1), null);
    c.finish(); await first;
    assert.equal(c.render().type, 'LandingScreen');
  });
}

test('dialog focuses Cancel by default and closes before cancellation restores focus', () => {
  const exports = {}, effects = [], sequence = [];
  const element = {
    showModal: () => sequence.push('open'),
    close: () => sequence.push('close'),
  };
  const source = fs.readFileSync(new URL('../src/components/LeaveGameDialog.tsx', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText;
  vm.runInNewContext(compiled, {
    exports,
    require(name) {
      if (name === 'react') return {
        useRef: () => ({ current: element }),
        useEffect: fn => effects.push(fn),
      };
      if (name === 'react/jsx-runtime') return {
        jsx: (type, props) => ({ type, props }),
        jsxs: (type, props) => ({ type, props }),
      };
      throw new Error(`Unexpected import: ${name}`);
    },
  });
  let confirmations = 0;
  const dialog = exports.LeaveGameDialog({
    active: true,
    onCancel: () => sequence.push('restore focus'),
    onConfirm: () => confirmations++,
  });
  effects.forEach(fn => fn());
  assert.equal(dialog.props.role, 'dialog');
  assert.equal(dialog.props['aria-modal'], 'true');
  assert.equal(dialog.props['aria-labelledby'], dialog.props.children[0].props.id);
  assert.equal(dialog.props['aria-describedby'], dialog.props.children[1].props.id);
  const [cancel, confirm] = dialog.props.children[2].props.children;
  assert.equal(cancel.props.autoFocus, true);
  assert.equal(confirm.props.autoFocus, undefined);
  cancel.props.onClick();
  assert.deepEqual(sequence, ['open', 'close', 'restore focus']);
  dialog.props.onCancel({ preventDefault: () => sequence.push('prevent default') });
  assert.deepEqual(sequence.slice(-3), ['prevent default', 'close', 'restore focus']);
  assert.equal(confirmations, 0);
  confirm.props.onClick();
  assert.equal(confirmations, 1);
});

test('temporary leave retains credentials and room-code join reclaims the saved identity', async () => {
  const c = client('ACTIVE');
  c.render(); await Promise.resolve();
  let tree = c.render();
  tree.props.children[0].props.onLeave({ currentTarget: c.trigger });
  tree = c.render();
  const leaving = tree.props.children.at(-1).props.onConfirm();
  c.finish(); await leaving;
  let landing = c.render();
  assert.equal(landing.type, 'LandingScreen');
  assert.equal(c.storage.has('scopa.roomSession'), false);
  assert.deepEqual(JSON.parse(c.storage.get('scopa.reservedSessions')), { ROOM: c.saved });
  assert.equal(landing.props.joinCode, 'ROOM');
  assert.equal(landing.props.reservedRoomCode, 'ROOM');
  await landing.props.onJoin({ preventDefault() {} });
  assert.deepEqual(JSON.parse(JSON.stringify(c.joins[0])), ['ROOM', 'Quentin', c.saved]);
  tree = c.render();
  assert.equal(tree.props.children[0].type, 'GameScreen');
  assert.equal(tree.props.children[0].props.session.playerId, c.saved.playerId);
});

test('opening the app restores a reserved identity directly into the paused game', async () => {
  const c = client('PAUSED', { active: false, reserved: true });
  c.render(); await Promise.resolve();
  const tree = c.render();
  assert.equal(tree.props.children[0].type, 'GameScreen');
  const pause = tree.props.children[1];
  assert.equal(pause.type, 'PauseGameDialog');
  assert.equal(pause.props.roomCode, 'ROOM');
  assert.equal(pause.props.rejoined, true);
  assert.deepEqual(c.sockets[0].identity, Object.values(c.saved));
  assert.equal(c.joins.length, 0);
});

test('socket retries preserve identity and stop after an explicit leave', async () => {
  const c = client('ACTIVE');
  c.render(); await Promise.resolve();
  c.sockets[0].emit('close', { code: 1006 });
  c.retry();
  assert.equal(c.sockets.length, 2);
  assert.deepEqual(c.sockets[1].identity, c.sockets[0].identity);
  c.sockets[1].emit('message', { data: JSON.stringify({
    roomCode: 'ROOM', hostPlayerId: 'me', players: [], game: { status: 'PAUSED', hand: [] },
  }) });
  let tree = c.render();
  assert.equal(tree.props.children[1].type, 'PauseGameDialog');
  tree.props.children[0].props.onLeave({ currentTarget: c.trigger });
  tree = c.render();
  const leaving = tree.props.children.at(-1).props.onConfirm();
  c.sockets[1].emit('close', { code: 1000 });
  c.retry();
  assert.equal(c.sockets.length, 2);
  c.finish(); await leaving;
  c.render();
  c.retry();
  assert.equal(c.sockets.length, 2);
});

for (const action of ['resume', 'end']) {
  test(`host ${action} calls the API once even on repeated confirmation`, async () => {
    const c = client('PAUSED');
    c.render(); await Promise.resolve();
    const pause = c.render().props.children[1];
    const callback = action === 'resume' ? pause.props.onResume : pause.props.onEnd;
    const first = callback();
    await callback();
    assert.deepEqual(c.lifecycle, [action]);
    c.finishLifecycle(); await first;
    const tree = c.render();
    assert.equal(tree.props.children[0].type, action === 'resume' ? 'GameScreen' : 'LobbyScreen');
    assert.equal(c.storage.has('scopa.roomSession'), true);
    if (action === 'end') assert.deepEqual(JSON.parse(c.storage.get('scopa.reservedSessions')), {});
  });
}

test('temporary network failure never deletes saved reconnect credentials', async () => {
  const c = client('PAUSED', { reserved: true, fetchError: new Error('Network unavailable') });
  c.render(); await Promise.resolve(); await Promise.resolve();
  c.render();
  assert.deepEqual(JSON.parse(c.storage.get('scopa.roomSession')), c.saved);
  assert.deepEqual(JSON.parse(c.storage.get('scopa.reservedSessions')), { ROOM: c.saved });
});

test('a delayed initial HTTP snapshot cannot overwrite a newer paused socket snapshot', async () => {
  const c = client('ACTIVE', { fetchDeferred: true });
  c.render();
  c.sockets[0].emit('message', { data: JSON.stringify({
    roomCode: 'ROOM', hostPlayerId: 'me', players: [], game: { status: 'PAUSED', hand: [] },
  }) });
  c.render();
  c.finishSnapshot(); await Promise.resolve(); await Promise.resolve();
  const tree = c.render();
  assert.equal(tree.props.children[0].props.game.status, 'PAUSED');
  assert.equal(tree.props.children[1].type, 'PauseGameDialog');
});
