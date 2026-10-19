// Move review: classifies a played move from engine analysis of the positions
// before and after it, and explains the result in one sentence.
// Thresholds use expected points (win chance) lost, the same idea Chess.com describes.
export const CATEGORIES = {
  brilliant: {label: 'Brilliant', phrase: 'brilliant', symbol: '!!', color: '#26c2a3'},
  great: {label: 'Great', phrase: 'a great move', symbol: '!', color: '#5b9bd5'},
  best: {label: 'Best', phrase: 'best', symbol: '★', color: '#81b64c'},
  excellent: {label: 'Excellent', phrase: 'excellent', symbol: '✓', color: '#96bc4b'},
  good: {label: 'Good', phrase: 'good', symbol: '✓', color: '#8aa880'},
  book: {label: 'Book', phrase: 'a book move', symbol: '≡', color: '#b08a5e'},
  forced: {label: 'Forced', phrase: 'forced', symbol: '→', color: '#8aa880'},
  inaccuracy: {label: 'Inaccuracy', phrase: 'an inaccuracy', symbol: '?!', color: '#f0c03e'},
  mistake: {label: 'Mistake', phrase: 'a mistake', symbol: '?', color: '#e8892b'},
  miss: {label: 'Miss', phrase: 'a miss', symbol: '✕', color: '#ee6b55'},
  blunder: {label: 'Blunder', phrase: 'a blunder', symbol: '??', color: '#d9403a'},
};
export const SUMMARY_ORDER = ['brilliant', 'great', 'best', 'excellent', 'good', 'book', 'forced', 'inaccuracy', 'mistake', 'miss', 'blunder'];
const VALUE = {p: 1, n: 3, b: 3, r: 5, q: 9, k: 0};
const NAME = {p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king'};
const BAD = ['inaccuracy', 'mistake', 'miss', 'blunder'];

export const winChance = cp => 1 / (1 + Math.exp(-0.00368208 * cp));
// Win chance for the side to move in the analysed position.
export const lineWin = line => line.type === 'mate' ? (line.score > 0 ? 1 : 0) : winChance(line.score);
// Lichess-style per-move accuracy from win-chance loss (0..1).
export const moveAccuracy = loss => Math.max(0, Math.min(100, 103.1668 * Math.exp(-4.354 * loss) - 3.1669));

const minus = text => text.replace('-', '−');
export function formatEval(line, turn) {
  if (!line) return '—';
  const sign = turn === 'w' ? 1 : -1;
  if (line.type === 'mate') return (line.score * sign > 0 ? '' : '−') + 'M' + Math.abs(line.score);
  const value = line.score * sign / 100;
  return minus((value > 0 ? '+' : '') + value.toFixed(1));
}
function material(chess, color) {
  let total = 0;
  for (const row of chess.board()) for (const sq of row) if (sq) total += (sq.color === color ? 1 : -1) * VALUE[sq.type];
  return total;
}
// Follows an engine line and reports the mover's material change against `base`.
function follow(Chess, fen, pv, mover, base, plies) {
  const chess = new Chess(fen); let lost = null; let first = null;
  for (const uci of (pv || []).slice(0, plies)) {
    let move; try { move = chess.move({from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] || 'q'}); } catch { break; }
    first ??= move;
    if (move.captured && move.color !== mover && (!lost || VALUE[move.captured] > VALUE[lost.piece])) lost = {piece: move.captured, square: move.to, san: move.san};
  }
  return {net: material(chess, mover) - base, lost, first};
}
const sanOf = (Chess, fen, uci) => { try { return new Chess(fen).move({from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] || 'q'}).san; } catch { return uci; } };
const article = piece => (piece === 'p' ? 'a ' : piece === 'q' ? 'the ' : 'a ') + NAME[piece];

// move: chess.js verbose move (needs before, after, lan, san, piece, captured).
// before/after: engine results {lines:[{type,score,pv}]} for move.before and move.after.
export function reviewMove({Chess, move, before, after, previous = null, book = false}) {
  const start = new Chess(move.before), end = new Chess(move.after);
  const mover = start.turn(), opponent = mover === 'w' ? 'b' : 'w';
  const lines = before?.lines || [], best = lines[0], reply = after?.lines?.[0];
  const winBefore = best ? lineWin(best) : 0.5;
  const winAfter = end.isCheckmate() ? 1 : end.isDraw() ? 0.5 : reply ? 1 - lineWin(reply) : winBefore;
  const loss = Math.max(0, winBefore - winAfter);
  const bestUci = best?.pv?.[0], bestSan = bestUci ? sanOf(Chess, move.before, bestUci) : null;
  const matches = lines.some(l => l.pv?.[0] === move.lan && lineWin(l) >= winBefore - 0.005);
  const isBest = !best || bestUci === move.lan || matches;
  const evalBefore = formatEval(best, mover);
  const evalAfter = end.isCheckmate() ? (mover === 'w' ? '1-0' : '0-1') : end.isDraw() ? '½-½' : formatEval(reply, opponent);
  const base = material(start, mover);
  const played = follow(Chess, move.after, reply?.pv, mover, base, 4);
  const ideal = follow(Chess, move.before, best?.pv, mover, base, 5);
  const second = lines[1];

  let category = loss < 0.02 ? 'excellent' : loss < 0.05 ? 'good' : loss < 0.10 ? 'inaccuracy' : loss < 0.20 ? 'mistake' : 'blunder';
  if (isBest) category = 'best';
  const sacrifice = played.lost && played.lost.square === move.to && VALUE[move.piece] >= 3 && played.net <= -2;
  const recapture = previous?.captured && previous.to === move.to;
  if (start.moves().length === 1) category = 'forced';
  else if (end.isCheckmate()) category = 'best';
  else if (book && loss < 0.10) category = 'book';
  else if ((category === 'best' || category === 'excellent') && sacrifice && winAfter >= 0.45 && winBefore < 0.97) category = 'brilliant';
  else if (category === 'best' && second && !recapture && winBefore - lineWin(second) >= 0.15 && lineWin(second) < 0.9) category = 'great';
  else if (BAD.includes(category) && ['mistake', 'blunder'].includes(previous?.category) && winBefore >= 0.6 && winAfter >= 0.4) category = 'miss';

  const san = move.san, change = evalBefore + ' → ' + evalAfter;
  const keeps = winAfter > 0.6 ? 'the advantage' : winAfter >= 0.4 ? 'the balance' : 'the game alive';
  let text;
  if (end.isCheckmate()) text = san + ' is checkmate.';
  else if (category === 'forced') text = san + ' was the only legal move.';
  else if (category === 'book') text = san + ' is an established opening move, also played in the master games here.';
  else if (category === 'brilliant') text = san + ' sacrifices ' + article(move.piece) + ', and the engine confirms it works (' + change + ').';
  else if (category === 'great') text = san + ' is the only move that keeps ' + keeps + '; every alternative is clearly worse.';
  else if (category === 'best') {
    if (reply?.type === 'mate' && reply.score < 0) text = san + ' is the best move and forces mate in ' + Math.abs(reply.score) + '.';
    else if (move.captured && played.net >= 1) text = san + ' is the best move and wins ' + article(move.captured) + '.';
    else text = san + ' is the engine’s top choice and keeps the evaluation at ' + evalAfter + '.';
  } else if (category === 'excellent') text = san + ' is nearly as strong as the top move ' + bestSan + ' (' + change + ').';
  else if (category === 'good') text = san + ' is playable, but ' + bestSan + ' was more precise (' + change + ').';
  else if (reply?.type === 'mate' && reply.score > 0) text = san + ' allows mate in ' + reply.score + '; ' + bestSan + ' was necessary.';
  else if (best?.type === 'mate' && best.score > 0) text = san + ' misses mate in ' + best.score + ' starting with ' + bestSan + '.';
  else if (ideal.net - played.net >= 2 && played.lost) text = san + ' loses ' + article(played.lost.piece) + ' after ' + played.lost.san + '; ' + bestSan + ' was better.';
  else if (category === 'miss') text = san + ' misses the chance to punish the last move with ' + bestSan + ' (' + change + ').';
  else text = san + ' lets the evaluation slip from ' + evalBefore + ' to ' + evalAfter + '; ' + bestSan + ' was stronger.';

  return {category, ...CATEGORIES[category], text, loss, winBefore, winAfter, accuracy: moveAccuracy(loss),
    evalBefore, evalAfter, bestUci: isBest || !['excellent', 'good', ...BAD].includes(category) ? null : bestUci, bestSan, mover, san, captured: move.captured, to: move.to};
}

// Opening-book lookup from the library: a move sequence is "book" when it appears
// in at least `min` games (2 when reviewing a library game, so it can't match itself).
export function buildBook(games, plies = 24) {
  const counts = new Map();
  for (const game of games) {
    const seen = new Set();
    for (let i = 1; i <= Math.min(plies, game.moves.length); i++) {
      const key = game.moves.slice(0, i).join(' ');
      if (!seen.has(key)) { seen.add(key); counts.set(key, (counts.get(key) || 0) + 1); }
    }
  }
  return (sans, min = 1) => sans.length <= plies && (counts.get(sans.join(' ')) || 0) >= min;
}

export function summarize(reviews) {
  const sides = {w: {count: 0, accuracy: 0, tally: {}}, b: {count: 0, accuracy: 0, tally: {}}};
  for (const r of reviews) {
    if (!r) continue;
    const side = sides[r.mover]; side.count++; side.accuracy += r.accuracy;
    side.tally[r.category] = (side.tally[r.category] || 0) + 1;
  }
  for (const side of Object.values(sides)) side.accuracy = side.count ? side.accuracy / side.count : null;
  return sides;
}
