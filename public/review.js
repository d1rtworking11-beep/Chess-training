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

// move: chess.js verbose move (needs before, after, lan, san, piece, captured).
// before/after: engine results {lines:[{type,score,pv}]} for move.before and move.after.
// book/opening: from buildTheory; a Book move that gives up 10% or more is rated by the engine and ends the book.
export function reviewMove({Chess, move, before, after, previous = null, book = false, opening = null}) {
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
  const inBook = book && loss < 0.10;
  if (start.moves().length === 1) category = 'forced';
  else if (end.isCheckmate()) category = 'best';
  else if (inBook) category = 'book';
  else if ((category === 'best' || category === 'excellent') && sacrifice && winAfter >= 0.45 && winBefore < 0.97) category = 'brilliant';
  else if (category === 'best' && second && !recapture && winBefore - lineWin(second) >= 0.15 && lineWin(second) < 0.9) category = 'great';
  else if (BAD.includes(category) && ['mistake', 'blunder'].includes(previous?.category) && winBefore >= 0.6 && winAfter >= 0.4) category = 'miss';

  // The reason behind the label; explain() turns it into a sentence in either language.
  const keeps = winAfter > 0.6 ? 'advantage' : winAfter >= 0.4 ? 'balance' : 'alive';
  let reason;
  if (end.isCheckmate()) reason = {kind: 'checkmate'};
  else if (category === 'forced' || category === 'book') reason = {kind: category};
  else if (category === 'brilliant') reason = {kind: 'brilliant', piece: move.piece};
  else if (category === 'great') reason = {kind: 'great', keeps};
  else if (category === 'best') {
    if (reply?.type === 'mate' && reply.score < 0) reason = {kind: 'bestMate', n: Math.abs(reply.score)};
    else if (move.captured && played.net >= 1) reason = {kind: 'bestWins', piece: move.captured};
    else reason = {kind: 'best'};
  } else if (category === 'excellent' || category === 'good') reason = {kind: category};
  else if (reply?.type === 'mate' && reply.score > 0) reason = {kind: 'allowsMate', n: reply.score};
  else if (best?.type === 'mate' && best.score > 0) reason = {kind: 'missesMate', n: best.score};
  else if (ideal.net - played.net >= 2 && played.lost) reason = {kind: 'loses', piece: played.lost.piece, reply: played.lost.san};
  else if (category === 'miss') reason = {kind: 'miss'};
  else reason = {kind: 'slip'};

  const review = {category, ...CATEGORIES[category], reason, loss, winBefore, winAfter, accuracy: moveAccuracy(loss),
    book: inBook, opening, evalBefore, evalAfter, bestUci: isBest || !['excellent', 'good', ...BAD].includes(category) ? null : bestUci, bestSan, mover, san: move.san, captured: move.captured, to: move.to};
  review.text = explain(review);
  return review;
}

// Labels, headlines and explanations in English and Russian. Reviews keep their reason, so a page
// can switch language and describe moves it has already reviewed without asking the engine again.
const RU_CATEGORIES = {
  brilliant: ['Блестящий', 'блестящий ход'], great: ['Отличный', 'отличный ход'], best: ['Лучший', 'лучший ход'],
  excellent: ['Превосходный', 'превосходный ход'], good: ['Хороший', 'хороший ход'], book: ['Теория', 'ход по теории'],
  forced: ['Вынужденный', 'вынужденный ход'], inaccuracy: ['Неточность', 'неточность'], mistake: ['Ошибка', 'ошибка'],
  miss: ['Промах', 'промах'], blunder: ['Зевок', 'зевок'],
};
export const label = (category, lang = 'en') => lang === 'ru' ? RU_CATEGORIES[category][0] : CATEGORIES[category].label;
export const headline = (review, lang = 'en') => lang === 'ru' ? review.san + ' — ' + RU_CATEGORIES[review.category][1] : review.san + ' is ' + CATEGORIES[review.category].phrase;
// Russian piece names are in the accusative case ("теряет ферзя", "жертвует слона").
const PIECE = {
  en: {p: 'a pawn', n: 'a knight', b: 'a bishop', r: 'a rook', q: 'the queen', k: 'the king'},
  ru: {p: 'пешку', n: 'коня', b: 'слона', r: 'ладью', q: 'ферзя', k: 'короля'},
};
const KEEPS = {en: {advantage: 'the advantage', balance: 'the balance', alive: 'the game alive'}, ru: {advantage: 'преимущество', balance: 'равновесие', alive: 'шансы на спасение'}};
const ruMoves = n => { const form = new Intl.PluralRules('ru').select(n); return n + ' ' + (form === 'one' ? 'ход' : form === 'many' ? 'ходов' : 'хода'); };
const change = r => r.evalBefore + ' → ' + r.evalAfter;
const EXPLAIN = {
  en: {
    checkmate: r => `${r.san} is checkmate.`,
    forced: r => `${r.san} was the only legal move.`,
    book: r => `${r.san} follows opening theory${r.opening ? ` (${r.opening})` : ''}.`,
    brilliant: (r, x) => `${r.san} sacrifices ${PIECE.en[x.piece]}, and the engine confirms it works (${change(r)}).`,
    great: (r, x) => `${r.san} is the only move that keeps ${KEEPS.en[x.keeps]}; every alternative is clearly worse.`,
    bestMate: (r, x) => `${r.san} is the best move and forces mate in ${x.n}.`,
    bestWins: (r, x) => `${r.san} is the best move and wins ${PIECE.en[x.piece]}.`,
    best: r => `${r.san} is the engine’s top choice and keeps the evaluation at ${r.evalAfter}.`,
    excellent: r => `${r.san} is nearly as strong as the top move ${r.bestSan} (${change(r)}).`,
    good: r => `${r.san} is playable, but ${r.bestSan} was more precise (${change(r)}).`,
    allowsMate: (r, x) => `${r.san} allows mate in ${x.n}; ${r.bestSan} was necessary.`,
    missesMate: (r, x) => `${r.san} misses mate in ${x.n} starting with ${r.bestSan}.`,
    loses: (r, x) => `${r.san} loses ${PIECE.en[x.piece]} after ${x.reply}; ${r.bestSan} was better.`,
    miss: r => `${r.san} misses the chance to punish the last move with ${r.bestSan} (${change(r)}).`,
    slip: r => `${r.san} lets the evaluation slip from ${r.evalBefore} to ${r.evalAfter}; ${r.bestSan} was stronger.`,
  },
  ru: {
    checkmate: r => `${r.san} — мат.`,
    forced: r => `${r.san} — единственный возможный ход.`,
    book: r => `${r.san} соответствует дебютной теории${r.opening ? ` (${r.opening})` : ''}.`,
    brilliant: (r, x) => `${r.san} жертвует ${PIECE.ru[x.piece]}, и движок подтверждает, что жертва корректна (${change(r)}).`,
    great: (r, x) => `${r.san} — единственный ход, сохраняющий ${KEEPS.ru[x.keeps]}; остальные заметно хуже.`,
    bestMate: (r, x) => `${r.san} — лучший ход: он форсирует мат в ${ruMoves(x.n)}.`,
    bestWins: (r, x) => `${r.san} — лучший ход, он выигрывает ${PIECE.ru[x.piece]}.`,
    best: r => `${r.san} — первый выбор движка, оценка остаётся ${r.evalAfter}.`,
    excellent: r => `${r.san} почти не уступает лучшему ходу ${r.bestSan} (${change(r)}).`,
    good: r => `${r.san} — приемлемый ход, но ${r.bestSan} был точнее (${change(r)}).`,
    allowsMate: (r, x) => `${r.san} допускает мат в ${ruMoves(x.n)}; необходимо было сыграть ${r.bestSan}.`,
    missesMate: (r, x) => `${r.san} упускает мат в ${ruMoves(x.n)}, который начинался с ${r.bestSan}.`,
    loses: (r, x) => `${r.san} теряет ${PIECE.ru[x.piece]} после ${x.reply}; лучше было ${r.bestSan}.`,
    miss: r => `${r.san} упускает шанс наказать соперника за предыдущий ход: сильнее было ${r.bestSan} (${change(r)}).`,
    slip: r => `${r.san} ухудшает оценку с ${r.evalBefore} до ${r.evalAfter}; сильнее было ${r.bestSan}.`,
  },
};
export const explain = (review, lang = 'en') => EXPLAIN[lang === 'ru' ? 'ru' : 'en'][review.reason.kind](review, review.reason);

// Opening theory from named openings (public/data/openings.json, see scripts/import-openings.js).
// A move is Book only while every position since the first move lies on a named line, so Book
// covers the opening and, once a game leaves theory, never returns. `line` holds the chess.js
// verbose moves from the start up to the move being checked; `previous` is the earlier move's review.
export function buildTheory({names, positions}) {
  const key = fen => fen.split(' ').slice(0, 4).join(' ');
  return (line, previous = null) => {
    let opening = null;
    for (const move of line) {
      const index = positions[key(move.after)];
      if (index === undefined) return {book: false, opening};
      if (index >= 0) opening = names[index][1];
    }
    return {book: !previous || previous.book !== false, opening};
  };
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
