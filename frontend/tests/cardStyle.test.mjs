import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function load(file, modules, extra = {}) {
  const source = fs.readFileSync(new URL(`../src/components/cards/${file}.tsx`, import.meta.url), 'utf8');
  const exports = {};
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText,
    { exports, ...extra, require: name => modules[name] ?? {} });
  return exports;
}
const jsx = (type, props) => ({ type, props });
const runtime = { jsx, jsxs: jsx };

test('all 40 traditional faces map to distinct correct suit/value cells without changing card data', () => {
  const { traditionalFace } = load('CardFace', {});
  const locations = new Set();
  for (const [suit, file] of Object.entries({ GOLD: 'denari', CUPS: 'coppe', SWORDS: 'spade', CLUBS: 'bastoni' })) {
    for (let value = 1; value <= 10; value++) {
      const card = Object.freeze({ id: `${suit}-${value}`, suit, value });
      const face = traditionalFace(card);
      assert.equal(face.file, `/cards/sicilian/${file}.jpg`);
      const index = value <= 8 ? value - 1 : value;
      assert.equal(face.column, index % 4);
      assert.equal(face.row, Math.floor(index / 4));
      locations.add(JSON.stringify(face));
      assert(fs.existsSync(new URL(`../public${face.file}`, import.meta.url)));
    }
  }
  assert.equal(locations.size, 40);
});

test('style switches retain the same button identity and interaction props', () => {
  const { ScopaCardButton } = load('ScopaCardButton', { 'react/jsx-runtime': runtime, './cardText': { cardName: c => c.id } });
  const card = Object.freeze({ id: 'GOLD-7', suit: 'GOLD', value: 7 });
  const onClick = () => {};
  const button = ScopaCardButton({ card, selected: true, suggested: true, onClick });
  assert.equal(button.props['data-card-id'], card.id);
  assert.equal(button.props.onClick, onClick);
  assert.equal(button.props['aria-pressed'], true);
  assert.equal(button.props.children.props.card, card);
  assert.match(button.props.className, /is-selected/);
});

test('preference defaults to modern, restores traditional, and tolerates blocked storage', () => {
  let state, writes = [];
  const storage = { getItem: () => 'traditional', setItem: (...args) => writes.push(args) };
  const react = { createContext: () => ({ Provider: 'provider' }), useContext: () => {},
    useState: init => { state = init(); return [state, value => { state = value; }]; } };
  const { CardStyleProvider } = load('CardStyle', { react, 'react/jsx-runtime': runtime }, { localStorage: storage });
  let provider = CardStyleProvider({ children: null });
  assert.equal(provider.props.value.style, 'traditional');
  provider.props.value.setStyle('modern');
  assert.equal(state, 'modern');
  assert.equal(writes[0][0], 'scopa.cardStyle');
  assert.equal(writes[0][1], 'modern');
  storage.getItem = () => 'invalid';
  assert.equal(CardStyleProvider({}).props.value.style, 'modern');
  storage.getItem = () => { throw Error('blocked'); };
  storage.setItem = () => { throw Error('blocked'); };
  provider = CardStyleProvider({});
  assert.equal(provider.props.value.style, 'modern');
  assert.doesNotThrow(() => provider.props.value.setStyle('traditional'));
  writes = [];
  CardStyleProvider({ persist: false }).props.value.setStyle('traditional');
  assert.equal(writes.length, 0);
});
