import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {STRINGS, t, setLanguage, getLanguage} from '../public/i18n.js';

const placeholders = value => [...value.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort();

test('English and Russian define the same keys and placeholders', () => {
  assert.deepEqual(Object.keys(STRINGS.ru).sort(), Object.keys(STRINGS.en).sort());
  for (const key of Object.keys(STRINGS.en)) {
    const en = STRINGS.en[key], ru = STRINGS.ru[key];
    // A language may use a function where its grammar needs plural forms.
    if (typeof en === 'string' && typeof ru === 'string') { assert.ok(ru.trim(), key + ' is empty in Russian'); assert.deepEqual(placeholders(ru), placeholders(en), key); }
    else for (const value of [en, ru]) assert.ok(String(typeof value === 'function' ? value({n: 2}) : value).trim(), key);
  }
});

test('every key the page, app and static build use is defined', () => {
  const used = new Set();
  for (const file of ['public/index.html', 'scripts/build-artifact.js']) {
    const text = fs.readFileSync(file, 'utf8');
    for (const m of text.matchAll(/data-i18n="([^"]+)"/g)) used.add(m[1]);
    for (const m of text.matchAll(/data-i18n-attr="([^"]+)"/g)) for (const pair of m[1].split(';')) used.add(pair.split(':')[1]);
  }
  for (const file of ['public/app.js', 'scripts/build-artifact.js']) for (const m of fs.readFileSync(file, 'utf8').matchAll(/'([a-z]+(?:\.[A-Za-z]+)+)'/g)) if (!m[1].startsWith('openchess.')) used.add(m[1]);
  // Keys the app builds at runtime from a side, piece, mode or error code.
  for (const side of ['w', 'b']) { used.add('turn.' + side); used.add('msg.find.' + side); used.add('msg.newGame.' + side); for (const piece of 'pnbrqk') used.add('square.' + side + piece); }
  for (const piece of 'qrbn') used.add('piece.' + piece);
  for (const piece of 'pnbrqk') used.add('pieceName.' + piece);
  for (const who of ['you', 'bot', 'opp', 'w', 'b']) used.add('who.' + who);
  for (const mode of ['practice', 'bot', 'drills']) for (const part of ['title', 'titleEm', 'subtitle']) used.add(`mode.${mode}.${part}`);
  for (const side of ['w', 'b']) used.add('drill.title.' + side);
  for (const code of ['engineLoad', 'analysisTimeout', 'library', 'puzzles']) used.add('error.' + code);
  assert.deepEqual([...used].filter(key => !Object.hasOwn(STRINGS.en, key)), []);
});

test('Russian plurals, placeholders and language switching', () => {
  const previous = getLanguage();
  assert.equal(setLanguage('ru'), true);
  assert.deepEqual([1, 3, 5, 21, 112].map(n => t('moves.count', {n})), ['1 ход', '3 хода', '5 ходов', '21 ход', '112 ходов']);
  assert.equal(t('msg.botPlayed', {move: 'Nf3'}), 'Бот сыграл Nf3. Ваш ход.');
  assert.equal(t('engine.depth', {name: 'Stockfish 19', depth: 16}), 'Stockfish 19 · глубина 16');
  assert.equal(setLanguage('de'), false); assert.equal(getLanguage(), 'ru');
  setLanguage('en');
  assert.equal(t('moves.count', {n: 1}), '1 move'); assert.equal(t('library.found', {n: 750}), '750 games found'); assert.equal(t('no.such.key'), 'no.such.key');
  setLanguage(previous);
});
