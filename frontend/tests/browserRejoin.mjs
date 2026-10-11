// Optional real-browser check. Start a temporary backend serving frontend/dist,
// and Chrome with --headless --remote-debugging-port=9237 and a temporary profile.
// Run: node tests/browserRejoin.mjs [http://127.0.0.1:8087] [http://127.0.0.1:9237]
import assert from 'node:assert/strict';

const base = process.argv[2] ?? 'http://127.0.0.1:8087';
const debuggerUrl = process.argv[3] ?? 'http://127.0.0.1:9237';
const { webSocketDebuggerUrl } = await (await fetch(`${debuggerUrl}/json/version`)).json();
const socket = new WebSocket(webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', reject, { once: true });
});
let nextId = 0;
const pending = new Map(), requests = [], exceptions = [], contexts = [];
socket.addEventListener('message', event => {
  const message = JSON.parse(event.data);
  if (message.id) {
    const job = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) job.reject(new Error(JSON.stringify(message.error)));
    else job.resolve(message.result);
  }
  if (message.method === 'Network.requestWillBeSent') requests.push(message.params.request.url);
  if (message.method === 'Runtime.exceptionThrown') exceptions.push(message.params.exceptionDetails.text);
});
function command(method, params = {}, sessionId) {
  const id = ++nextId;
  const promise = new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
  socket.send(JSON.stringify({ id, method, params, sessionId }));
  return promise;
}
async function evaluate(page, expression) {
  const result = await command('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, page.sessionId);
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}
async function until(check) {
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    if (await check()) return;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('Browser check timed out');
}
async function api(path, body) {
  const response = await fetch(`${base}/api/rooms${path}`, body ? {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  } : {});
  const result = await response.json();
  assert.equal(response.ok, true, JSON.stringify(result));
  return result;
}
const identity = player => ({ playerId: player.playerId, sessionToken: player.sessionToken });
const snapshot = player => api(`/${player.roomCode}/game?${new URLSearchParams(identity(player))}`);
async function pageInContext(context, width) {
  const { targetId } = await command('Target.createTarget', { url: 'about:blank', browserContextId: context });
  const { sessionId } = await command('Target.attachToTarget', { targetId, flatten: true });
  const page = { targetId, sessionId, width };
  await command('Runtime.enable', {}, sessionId);
  await command('Network.enable', {}, sessionId);
  await command('Emulation.setDeviceMetricsOverride', { width, height: width < 500 ? 740 : 900, deviceScaleFactor: 1, mobile: width < 500 }, sessionId);
  if (width < 500) await command('Emulation.setTouchEmulationEnabled', { enabled: true }, sessionId);
  await command('Page.navigate', { url: base }, sessionId);
  await until(() => evaluate(page, "Boolean(document.querySelector('#root')?.children.length)"));
  return page;
}
async function playerPage(player, width) {
  const { browserContextId } = await command('Target.createBrowserContext');
  contexts.push(browserContextId);
  const page = await pageInContext(browserContextId, width);
  page.context = browserContextId;
  await evaluate(page, `localStorage.setItem('scopa.roomSession', ${JSON.stringify(JSON.stringify({ roomCode: player.roomCode, ...identity(player) }))});
    localStorage.setItem('scopa.displayName', ${JSON.stringify(player.room.players.find(p => p.playerId === player.playerId).displayName)}); location.reload();`);
  await until(() => evaluate(page, "Boolean(document.querySelector('.lobby-shell'))"));
  return page;
}
const button = (label, scope = 'document') => `[...${scope}.querySelectorAll('button')].find(b => b.textContent.trim() === ${JSON.stringify(label)})`;
async function click(page, expression) {
  const rect = await evaluate(page, `(() => { const b = ${expression}; if (!b || b.disabled) throw new Error('Button unavailable');
    const r = b.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
  if (page.width < 500) {
    await command('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [rect] }, page.sessionId);
    await command('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }, page.sessionId);
  } else {
    await command('Input.dispatchMouseEvent', { type: 'mousePressed', ...rect, button: 'left', clickCount: 1 }, page.sessionId);
    await command('Input.dispatchMouseEvent', { type: 'mouseReleased', ...rect, button: 'left', clickCount: 1 }, page.sessionId);
  }
}
async function escape(page) {
  for (const type of ['keyDown', 'keyUp']) await command('Input.dispatchKeyEvent', { type, key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 }, page.sessionId);
}
const leaveCount = () => requests.filter(url => url.endsWith('/leave')).length;

try {
  for (const width of [1280, 360]) {
    const host = await api('', { displayName: 'Quentin' });
    const guest = await api(`/${host.roomCode}/join`, { displayName: 'Manon' });
    const hostPage = await playerPage(host, width);
    let guestPage = await playerPage(guest, width);
    await api(`/${host.roomCode}/ready`, { ...identity(host), ready: true });
    await api(`/${host.roomCode}/ready`, { ...identity(guest), ready: true });
    const started = await api(`/${host.roomCode}/game/start`, identity(host));
    await until(() => evaluate(hostPage, "Boolean(document.querySelector('.game-board'))"));
    await until(() => evaluate(guestPage, "Boolean(document.querySelector('.game-board'))"));
    if (started.game.currentPlayerId === host.playerId) {
      const card = started.game.hand[0];
      const capture = started.game.possibleCaptures.find(c => c.handCardId === card.id);
      await api(`/${host.roomCode}/game/play`, { ...identity(host), cardId: card.id, captureCardIds: capture?.tableCardIds ?? [] });
    }
    const before = (await snapshot(guest)).game;
    assert.equal(before.currentPlayerId, guest.playerId);
    const initialCount = leaveCount();
    await click(guestPage, button('Leave'));
    await until(() => evaluate(guestPage, "Boolean(document.querySelector('.leave-game-dialog[open]'))"));
    assert.equal(leaveCount(), initialCount);
    assert.equal(await evaluate(guestPage, 'document.activeElement.textContent.trim()'), 'Cancel');
    await escape(guestPage);
    await until(() => evaluate(guestPage, "!document.querySelector('.leave-game-dialog[open]')"));
    assert.equal(await evaluate(guestPage, 'document.activeElement.textContent.trim()'), 'Leave');
    await click(guestPage, button('Leave'));
    await until(() => evaluate(guestPage, "Boolean(document.querySelector('.leave-game-dialog[open]'))"));
    await click(guestPage, button('Cancel', "document.querySelector('.leave-game-dialog')"));
    assert.equal(leaveCount(), initialCount);
    assert.equal(await evaluate(guestPage, 'document.activeElement.textContent.trim()'), 'Leave');
    await click(guestPage, button('Leave'));
    await until(() => evaluate(guestPage, "Boolean(document.querySelector('.leave-game-dialog[open]'))"));
    await click(guestPage, button('Leave game', "document.querySelector('.leave-game-dialog')"));
    await until(() => evaluate(guestPage, "Boolean(document.querySelector('.landing'))"));
    assert.equal(leaveCount(), initialCount + 1);
    await until(() => evaluate(hostPage, "Boolean(document.querySelector('.pause-game-dialog[open]'))"));
    assert.equal(await evaluate(hostPage, "document.querySelector('.pause-room-code strong').textContent"), host.roomCode);
    assert.match(await evaluate(hostPage, "document.querySelector('.pause-game-dialog').textContent"), /Manon/);
    assert.equal((await snapshot(guest)).game.status, 'PAUSED');
    assert.equal((await snapshot(guest)).players.length, 2);
    const layout = await evaluate(hostPage, `(() => { const d = document.querySelector('.pause-game-dialog'), r = d.getBoundingClientRect();
      return { fits: r.x >= 0 && r.y >= 0 && r.right <= innerWidth && r.bottom <= innerHeight,
        touch: [...d.querySelectorAll('button')].every(b => b.getBoundingClientRect().height >= 48),
        focused: document.activeElement.id }; })()`);
    assert.equal(layout.fits, true);
    assert.equal(layout.touch, true);
    assert.equal(layout.focused, 'pause-game-title');
    await click(guestPage, button('Join'));
    await until(() => evaluate(guestPage, "Boolean(document.querySelector('.pause-game-dialog[open]'))"));
    assert.match(await evaluate(guestPage, "document.querySelector('.pause-game-dialog').textContent"), /Rejoined game successfully/);
    const restored = (await snapshot(guest)).game;
    assert.deepEqual({ ...restored, status: before.status }, before);
    assert.deepEqual(await evaluate(guestPage, "[...document.querySelectorAll('.hand-cards [data-card-id]')].map(c => c.dataset.cardId)"), before.hand.map(c => c.id));
    await until(() => evaluate(hostPage, `Boolean(${button('Resume game')})`));
    await click(hostPage, button('Resume game'));
    await until(async () => (await snapshot(guest)).game.status === 'ACTIVE');
    assert.deepEqual((await snapshot(guest)).game, before);

    // Close and reopen the application in the same browser context: no manual identity injection.
    await command('Target.closeTarget', { targetId: guestPage.targetId });
    await until(async () => (await snapshot(host)).game.status === 'PAUSED');
    guestPage = await pageInContext(guestPage.context, width);
    await until(() => evaluate(guestPage, "Boolean(document.querySelector('.pause-game-dialog[open]'))"));
    assert.deepEqual({ ...(await snapshot(guest)).game, status: before.status }, before);
    await until(() => evaluate(hostPage, `Boolean(${button('Resume game')})`));
    await click(hostPage, button('End game'));
    await until(() => evaluate(hostPage, "document.querySelector('#pause-game-title')?.textContent.trim() === 'End current game?'"));
    assert.equal(await evaluate(hostPage, 'document.activeElement.textContent.trim()'), 'Cancel');
    await escape(hostPage);
    await until(() => evaluate(hostPage, "document.querySelector('#pause-game-title')?.textContent.trim() === 'GAME PAUSED'"));
    assert.equal((await snapshot(host)).game.status, 'PAUSED');
    await click(hostPage, button('End game'));
    await until(() => evaluate(hostPage, "document.querySelector('#pause-game-title')?.textContent.trim() === 'End current game?'"));
    await click(hostPage, button('End game'));
    await until(async () => (await snapshot(host)).game === null);
    await until(() => evaluate(guestPage, "Boolean(document.querySelector('.lobby-shell'))"));
    console.log(`${width}px: leave/cancel/Escape, one leave request, reserved seat, exact hand/turn, rejoin/resume, reopen, confirmed end: passed`);
  }
  assert.deepEqual(exceptions, []);
} finally {
  for (const browserContextId of contexts) await command('Target.disposeBrowserContext', { browserContextId });
  socket.close();
}
