import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Chess} from 'chess.js';
import {reviewMove, buildBook, summarize} from '../public/review.js';
const play = (sans, next) => { const c = new Chess(); for (const m of sans) c.move(m); return c.move(next); };
const cp = (score, pv) => ({type: 'cp', score, pv, depth: 12});
const mate = (score, pv) => ({type: 'mate', score, pv, depth: 12});

test('engine top move is rated Best', () => {
  const move = play(['e4', 'e5'], 'Nf3');
  const r = reviewMove({Chess, move, before: {lines: [cp(30, ['g1f3', 'b8c6']), cp(20, ['f1c4'])]}, after: {lines: [cp(-30, ['b8c6'])]}});
  assert.equal(r.category, 'best'); assert.equal(r.symbol, '★'); assert.equal(r.bestUci, null);
});

test('hanging the queen is a Blunder that names the lost piece', () => {
  const move = play(['e4', 'd5'], 'Qg4');
  const r = reviewMove({Chess, move, before: {lines: [cp(10, ['e4d5', 'd8d5'])]}, after: {lines: [cp(850, ['c8g4', 'd2d3', 'g4e6'])]}});
  assert.equal(r.category, 'blunder'); assert.equal(r.symbol, '??'); assert.equal(r.phrase, 'a blunder');
  assert.match(r.text, /loses the queen after Bxg4; exd5 was better/);
  assert.equal(r.bestUci, 'e4d5');
});

test('allowing mate is a Blunder that says so', () => {
  const move = play(['f3', 'e5'], 'g4');
  const r = reviewMove({Chess, move, before: {lines: [cp(-60, ['e2e3'])]}, after: {lines: [mate(1, ['d8h4'])]}});
  assert.equal(r.category, 'blunder'); assert.match(r.text, /allows mate in 1/);
});

test('delivering mate is Best and checkmate', () => {
  const move = play(['f3', 'e5', 'g4'], 'Qh4#');
  const r = reviewMove({Chess, move, before: {lines: [mate(1, ['d8h4'])]}, after: {lines: []}});
  assert.equal(r.category, 'best'); assert.equal(r.text, 'Qh4# is checkmate.'); assert.equal(r.evalAfter, '0-1');
});

test('small and medium losses map to Inaccuracy and Mistake', () => {
  const move = play(['e4', 'e5'], 'a3');
  const inacc = reviewMove({Chess, move, before: {lines: [cp(40, ['g1f3'])]}, after: {lines: [cp(40, ['g8f6'])]}});
  assert.equal(inacc.category, 'inaccuracy'); assert.match(inacc.text, /Nf3 was stronger/);
  const mistake = reviewMove({Chess, move, before: {lines: [cp(40, ['g1f3'])]}, after: {lines: [cp(150, ['g8f6'])]}});
  assert.equal(mistake.category, 'mistake');
});

test('the only move that keeps the advantage is Great', () => {
  const move = play(['e4', 'e5'], 'Nf3');
  const r = reviewMove({Chess, move, before: {lines: [cp(150, ['g1f3']), cp(-100, ['a2a3'])]}, after: {lines: [cp(-150, ['b8c6'])]}});
  assert.equal(r.category, 'great'); assert.equal(r.symbol, '!'); assert.match(r.text, /only move that keeps the advantage/);
});

test('a sound piece sacrifice is Brilliant', () => {
  const move = play(['e4', 'e5', 'Nf3', 'd6', 'Bc4', 'h6'], 'Bxf7+');
  const r = reviewMove({Chess, move, before: {lines: [cp(60, ['c4f7']), cp(40, ['d2d4'])]}, after: {lines: [cp(-80, ['e8f7', 'd2d4', 'g8f6', 'b1c3'])]}});
  assert.equal(r.category, 'brilliant'); assert.equal(r.phrase, 'brilliant'); assert.match(r.text, /sacrifices a bishop/);
});

test('failing to punish the opponent’s blunder is a Miss', () => {
  const move = play(['e4', 'e5'], 'a3');
  const r = reviewMove({Chess, move, previous: {category: 'blunder'}, before: {lines: [cp(200, ['g1f3'])]}, after: {lines: [cp(-20, ['g8f6'])]}});
  assert.equal(r.category, 'miss'); assert.match(r.text, /misses the chance to punish the last move with Nf3/);
});

test('library openings are Book, and a game cannot match only itself', () => {
  const isBook = buildBook([{moves: ['e4', 'e5', 'Nf3']}, {moves: ['e4', 'c5']}]);
  assert.ok(isBook(['e4'], 2)); assert.ok(isBook(['e4', 'e5'], 1)); assert.ok(!isBook(['e4', 'e5'], 2));
  const move = play([], 'e4');
  const r = reviewMove({Chess, move, before: {lines: [cp(30, ['d2d4'])]}, after: {lines: [cp(-25, ['e7e5'])]}, book: true});
  assert.equal(r.category, 'book'); assert.equal(r.bestUci, null);
});

test('the only legal move is Forced', () => {
  const c = new Chess('7k/8/8/8/8/8/r7/7K w - - 0 1');
  assert.deepEqual(c.moves(), ['Kg1']);
  const move = c.move('Kg1');
  const r = reviewMove({Chess, move, before: {lines: [cp(0, [move.lan])]}, after: {lines: [cp(0, [])]}});
  assert.equal(r.category, 'forced');
});

test('summary averages accuracy per side', () => {
  const s = summarize([{mover: 'w', accuracy: 100, category: 'best'}, {mover: 'b', accuracy: 40, category: 'blunder'}, {mover: 'w', accuracy: 80, category: 'good'}]);
  assert.equal(s.w.accuracy, 90); assert.equal(s.b.tally.blunder, 1);
});
