import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Chess} from 'chess.js';
import fs from 'node:fs';
import {reviewMove, buildTheory, summarize, explain, headline, label, motifs, comment} from '../public/review.js';
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

// A tiny theory set: 1.e4 (named), 1.e4 e5 (intermediate), 1.e4 e5 2.Nf3 (named).
const key = fen => fen.split(' ').slice(0, 4).join(' ');
const line = sans => { const c = new Chess(); return sans.map(m => c.move(m)); };
const tiny = (() => { const moves = line(['e4', 'e5', 'Nf3']); return {names: [['B00', "King's Pawn Game"], ['C40', "King's Knight Opening"]], positions: {[key(moves[0].after)]: 0, [key(moves[1].after)]: -1, [key(moves[2].after)]: 1}}; })();

test('Book follows named theory from the first move and names the opening', () => {
  const theory = buildTheory(tiny);
  assert.deepEqual(theory(line(['e4'])), {book: true, opening: "King's Pawn Game"});
  assert.deepEqual(theory(line(['e4', 'e5'])), {book: true, opening: "King's Pawn Game"});
  assert.deepEqual(theory(line(['e4', 'e5', 'Nf3'])), {book: true, opening: "King's Knight Opening"});
  assert.deepEqual(theory(line(['e4', 'c5'])), {book: false, opening: "King's Pawn Game"});
  assert.equal(theory(line(['d4'])).book, false);
});

test('Book never returns once a move has left it', () => {
  const theory = buildTheory(tiny);
  assert.equal(theory(line(['e4', 'e5', 'Nf3']), {book: false}).book, false);
  assert.equal(theory(line(['e4', 'e5', 'Nf3']), {book: true}).book, true);
  const move = play([], 'e4');
  const book = reviewMove({Chess, move, before: {lines: [cp(30, ['d2d4'])]}, after: {lines: [cp(-25, ['e7e5'])]}, book: true, opening: "King's Pawn Game"});
  assert.equal(book.category, 'book'); assert.equal(book.book, true); assert.equal(book.bestUci, null);
  assert.equal(book.text, "e4 follows opening theory (King's Pawn Game).");
  const refuted = reviewMove({Chess, move, before: {lines: [cp(30, ['d2d4'])]}, after: {lines: [cp(120, ['e7e5'])]}, book: true});
  assert.equal(refuted.category, 'mistake'); assert.equal(refuted.book, false);
});

test('bundled opening data matches Chess.com-style theory depth', () => {
  const data = JSON.parse(fs.readFileSync('public/data/openings.json'));
  assert.equal(data.license, 'CC0-1.0'); assert.equal(data.names.length, 3865); assert.equal(Object.keys(data.positions).length, 7982);
  const theory = buildTheory(data), games = JSON.parse(fs.readFileSync('public/data/games.json'));
  const depth = game => { const moves = line(game.moves); let n = 0; while (n < moves.length && theory(moves.slice(0, n + 1)).book) n++; return n; };
  const fischer = games.find(g => g.white.includes('Fischer') && g.black.includes('Spassky'));
  assert.equal(depth(fischer), 18); assert.equal(theory(line(fischer.moves.slice(0, 18))).opening, 'Ruy Lopez: Closed, Smyslov Defense');
  const depths = games.map(depth).sort((a, b) => a - b);
  assert.ok(depths[depths.length >> 1] <= 10, 'median Book depth should stay around the first five moves');
});

test('reviews read naturally in Russian', () => {
  const queen = reviewMove({Chess, move: play(['e4', 'd5'], 'Qg4'), before: {lines: [cp(10, ['e4d5', 'd8d5'])]}, after: {lines: [cp(850, ['c8g4', 'd2d3', 'g4e6'])]}});
  assert.equal(headline(queen, 'ru'), 'Qg4 — зевок'); assert.equal(label('blunder', 'ru'), 'Зевок');
  assert.equal(explain(queen, 'ru'), 'Qg4 теряет ферзя после Bxg4; лучше было exd5.');
  const allows = reviewMove({Chess, move: play(['f3', 'e5'], 'g4'), before: {lines: [cp(-60, ['e2e3'])]}, after: {lines: [mate(2, ['d8h4', 'g1f3'])]}});
  assert.equal(explain(allows), 'g4 allows mate in 2; e3 was necessary.');
  assert.equal(explain(allows, 'ru'), 'g4 допускает мат в 2 хода; необходимо было сыграть e3.');
  const theory = reviewMove({Chess, move: play([], 'e4'), before: {lines: [cp(30, ['d2d4'])]}, after: {lines: [cp(-25, ['e7e5'])]}, book: true, opening: "King's Pawn Game"});
  assert.equal(headline(theory, 'ru'), 'e4 — ход по теории'); assert.equal(headline(theory), 'e4 is a book move');
  assert.equal(explain(theory, 'ru'), "e4 соответствует дебютной теории (King's Pawn Game).");
});

test('move motifs: fork, save, protect, castle, development, center and mate', () => {
  const from = (fen, san) => new Chess(fen).move(san);
  assert.deepEqual(motifs(Chess, from('r3k3/8/8/1N6/8/8/8/4K3 w - - 0 1', 'Nc7+')), [{kind: 'fork', pieces: ['k', 'r']}]);
  assert.deepEqual(motifs(Chess, from('4k3/8/8/8/6b1/5N2/8/4K3 w - - 0 1', 'Ke2')), [{kind: 'protect', piece: 'n', square: 'f3'}]);
  assert.equal(motifs(Chess, from('4k3/8/p7/1B6/8/8/8/4K3 w - - 0 1', 'Bd3'))[0].kind, 'save');
  assert.deepEqual(motifs(Chess, from('4k3/8/8/8/8/8/8/4K2R w K - 0 1', 'O-O')), [{kind: 'castle', side: 'k'}]);
  assert.deepEqual(motifs(Chess, play(['e4', 'e5'], 'Nf3')), [{kind: 'develop', piece: 'n'}, {kind: 'threat', piece: 'p', square: 'e5'}]);
  assert.deepEqual(motifs(Chess, play([], 'e4')), [{kind: 'center'}]);
  assert.deepEqual(motifs(Chess, play(['e4', 'e5', 'Qh5', 'Nc6', 'Bc4', 'Nf6'], 'Qxf7#')), [{kind: 'mate'}]);
});

test('move comments say what changed, in both languages', () => {
  const nf3 = reviewMove({Chess, move: play(['e4', 'e5'], 'Nf3'), before: {lines: [cp(30, ['g1f3'])]}, after: {lines: [cp(-30, ['b8c6'])]}});
  assert.equal(comment(nf3, 'en', {who: 'you'}), 'Nf3 develops the knight and attacks the pawn on e5. The position is balanced.');
  assert.equal(comment(nf3, 'ru', {who: 'you'}), 'Nf3 развивает коня и нападает на пешку e5. Позиция равна.');
  const fork = reviewMove({Chess, move: new Chess('r3k3/8/8/1N6/8/8/8/4K3 w - - 0 1').move('Nc7+'), before: {lines: [cp(500, ['b5c7'])]}, after: {lines: [cp(-500, ['e8d7'])]}});
  assert.equal(comment(fork, 'en', {who: 'you', previous: {winAfter: 0.5}}), 'Nc7+ forks the king and the rook. Your position gets stronger. You are clearly better.');
  assert.equal(comment(fork, 'ru', {who: 'bot'}), 'Nc7+ ставит вилку королю и ладье. У бота явный перевес.');
  assert.equal(comment(fork, 'en', {who: 'opp'}), 'Nc7+ forks the king and the rook. The opponent is clearly better.');
  const grab = reviewMove({Chess, move: new Chess('4k3/8/8/3q4/8/4N3/4P3/4K3 w - - 0 1').move('Nxd5'), before: {lines: [cp(900, ['e3d5'])]}, after: {lines: [cp(-900, ['e8d7'])]}});
  assert.equal(grab.reason.kind, 'bestWins'); assert.equal(comment(grab, 'en', {who: 'you'}), 'Nxd5 takes the queen. You are winning.');
  const queen = reviewMove({Chess, move: play(['e4', 'd5'], 'Qg4'), before: {lines: [cp(10, ['e4d5', 'd8d5'])]}, after: {lines: [cp(850, ['c8g4', 'd2d3', 'g4e6'])]}});
  assert.equal(comment(queen, 'en', {who: 'w'}), 'Qg4 protects the pawn on e4. This loses the queen after Bxg4; exd5 was better.');
  assert.equal(comment(queen, 'ru', {who: 'w'}), 'Qg4 защищает пешку на e4. После Bxg4 теряется ферзь; лучше было exd5.');
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
