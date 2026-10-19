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
    book: inBook, opening, motifs: motifs(Chess, move), number: Number(move.before.split(' ')[5]), evalBefore, evalAfter, bestUci: isBest || !['excellent', 'good', ...BAD].includes(category) ? null : bestUci, bestSan, mover, san: move.san, captured: move.captured, to: move.to};
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

// What a move does on the board, for the move comment: castles, develops, takes, forks, checks,
// saves or protects a piece, or attacks one. Works on chess.js board() matrices (rank 8 first).
const FILES = 'abcdefgh';
const at = (board, sq) => board[8 - Number(sq[1])][FILES.indexOf(sq[0])];
function attacks(board, from) {
  const piece = at(board, from), f = FILES.indexOf(from[0]), r = Number(from[1]), out = [];
  const add = (df, dr) => { const nf = f + df, nr = r + dr; if (nf < 0 || nf > 7 || nr < 1 || nr > 8) return false; const sq = FILES[nf] + nr; out.push(sq); return !at(board, sq); };
  const ray = (df, dr) => { for (let i = 1; add(df * i, dr * i); i++); };
  if (piece.type === 'p') { const dir = piece.color === 'w' ? 1 : -1; add(-1, dir); add(1, dir); }
  else if (piece.type === 'n') for (const [df, dr] of [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]]) add(df, dr);
  else if (piece.type === 'k') for (const [df, dr] of [[1, 1], [1, 0], [1, -1], [0, -1], [-1, -1], [-1, 0], [-1, 1], [0, 1]]) add(df, dr);
  else {
    if (piece.type !== 'r') for (const [df, dr] of [[1, 1], [1, -1], [-1, -1], [-1, 1]]) ray(df, dr);
    if (piece.type !== 'b') for (const [df, dr] of [[1, 0], [0, -1], [-1, 0], [0, 1]]) ray(df, dr);
  }
  return out;
}
function attackersOf(board, sq, color) {
  const out = [];
  for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) {
    const piece = board[r][f], from = FILES[f] + (8 - r);
    if (piece && piece.color === color && attacks(board, from).includes(sq)) out.push(piece.type);
  }
  return out;
}
// A piece is en prise when it is attacked and either undefended or attackable by something cheaper.
function enPrise(board, sq) {
  const piece = at(board, sq);
  if (!piece || piece.type === 'k') return false;
  const enemies = attackersOf(board, sq, piece.color === 'w' ? 'b' : 'w');
  if (!enemies.length) return false;
  return !attackersOf(board, sq, piece.color).length || Math.min(...enemies.map(type => type === 'k' ? 99 : VALUE[type])) < VALUE[piece.type];
}
const worth = type => type === 'k' ? 99 : VALUE[type];
const HOME = {n: ['b1', 'g1', 'b8', 'g8'], b: ['c1', 'f1', 'c8', 'f8']};
const PRIORITY = ['mate', 'promote', 'castle', 'capture', 'fork', 'check', 'save', 'protect', 'threat', 'develop', 'center'];
const READING = ['castle', 'develop', 'center', 'capture', 'promote', 'save', 'protect', 'fork', 'check', 'threat', 'mate'];
export function motifs(Chess, move) {
  const end = new Chess(move.after), board = end.board(), before = new Chess(move.before).board();
  if (end.isCheckmate()) return [{kind: 'mate'}];
  const them = move.color === 'w' ? 'b' : 'w', type = move.promotion || move.piece, found = [];
  const fullmove = Number(move.before.split(' ')[5]);
  if (move.flags.includes('k') || move.flags.includes('q')) found.push({kind: 'castle', side: move.flags.includes('k') ? 'k' : 'q'});
  if (move.promotion) found.push({kind: 'promote', piece: move.promotion});
  if (move.captured) found.push({kind: 'capture', piece: move.captured});
  // Targets: enemy pieces the moved piece now attacks that are the king, worth more than it, or undefended.
  const targets = attacks(board, move.to).map(square => ({square, piece: at(board, square)}))
    .filter(t => t.piece?.color === them && (t.piece.type === 'k' || VALUE[t.piece.type] > VALUE[type] || !attackersOf(board, t.square, them).length))
    .sort((a, b) => worth(b.piece.type) - worth(a.piece.type));
  const big = targets.filter(t => worth(t.piece.type) >= 3);
  const fork = big.length >= 2;
  if (fork) found.push({kind: 'fork', pieces: [big[0].piece.type, big[1].piece.type]});
  if (end.inCheck() && !(fork && big[0].piece.type === 'k')) found.push({kind: 'check'});
  if (move.piece !== 'k' && enPrise(before, move.from) && !enPrise(board, move.to)) found.push({kind: 'save', piece: move.piece});
  const guarded = [];
  for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) {
    const piece = board[r][f], square = FILES[f] + (8 - r), old = at(before, square);
    if (piece && piece.color === move.color && piece.type !== 'k' && square !== move.to && old?.color === piece.color && old.type === piece.type && enPrise(before, square) && !enPrise(board, square)) guarded.push({square, piece: piece.type});
  }
  guarded.sort((a, b) => VALUE[b.piece] - VALUE[a.piece]);
  if (guarded.length) found.push({kind: 'protect', piece: guarded[0].piece, square: guarded[0].square});
  const threat = !fork && targets.find(t => t.piece.type !== 'k');
  if (threat) found.push({kind: 'threat', piece: threat.piece.type, square: threat.square});
  if (fullmove <= 12 && HOME[move.piece]?.includes(move.from)) found.push({kind: 'develop', piece: move.piece});
  if (move.piece === 'p' && fullmove <= 10 && ['d4', 'e4', 'd5', 'e5'].includes(move.to)) found.push({kind: 'center'});
  return found.sort((a, b) => PRIORITY.indexOf(a.kind) - PRIORITY.indexOf(b.kind)).slice(0, 2).sort((a, b) => READING.indexOf(a.kind) - READING.indexOf(b.kind));
}

// The move comment shown in the review card: what the move does, the verdict, and who stands better.
// `who` is 'you', 'bot', 'w' or 'b'; `previous` is the same player's previous review, for "stronger".
const NAME_EN = {p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king'};
const RU = {
  dat: {p: 'пешке', n: 'коню', b: 'слону', r: 'ладье', q: 'ферзю', k: 'королю'},
  gen: {p: 'пешки', n: 'коня', b: 'слона', r: 'ладьи', q: 'ферзя', k: 'короля'},
  nom: {p: 'пешка', n: 'конь', b: 'слон', r: 'ладья', q: 'ферзь', k: 'король'},
};
const CLAUSE = {
  en: {
    mate: () => 'delivers checkmate',
    castle: m => m.side === 'k' ? 'castles kingside' : 'castles queenside',
    promote: m => `promotes to a ${NAME_EN[m.piece]}`,
    capture: m => `takes the ${NAME_EN[m.piece]}`,
    fork: m => `forks the ${NAME_EN[m.pieces[0]]} and the ${NAME_EN[m.pieces[1]]}`,
    check: () => 'gives check',
    save: m => `saves the ${NAME_EN[m.piece]}`,
    protect: m => `protects the ${NAME_EN[m.piece]} on ${m.square}`,
    threat: m => `attacks the ${NAME_EN[m.piece]}${m.piece === 'p' ? ' on ' + m.square : ''}`,
    develop: m => `develops the ${NAME_EN[m.piece]}`,
    center: () => 'takes the center',
  },
  ru: {
    mate: () => 'ставит мат',
    castle: m => m.side === 'k' ? 'делает короткую рокировку' : 'делает длинную рокировку',
    promote: m => `превращает пешку в ${PIECE.ru[m.piece]}`,
    capture: m => `берёт ${PIECE.ru[m.piece]}`,
    fork: m => `ставит вилку ${RU.dat[m.pieces[0]]} и ${RU.dat[m.pieces[1]]}`,
    check: () => 'объявляет шах',
    save: m => `уводит ${PIECE.ru[m.piece]} из-под удара`,
    protect: m => `защищает ${PIECE.ru[m.piece]} на ${m.square}`,
    threat: m => `нападает на ${PIECE.ru[m.piece]}${m.piece === 'p' ? ' ' + m.square : ''}`,
    develop: m => `развивает ${PIECE.ru[m.piece]}`,
    center: () => 'занимает центр',
  },
};
const VERDICT = {
  en: {
    forced: () => 'It was the only legal move.',
    book: r => `This is opening theory${r.opening ? ` (${r.opening})` : ''}.`,
    brilliant: (r, x) => `A brilliant ${NAME_EN[x.piece]} sacrifice: the engine confirms it works (${change(r)}).`,
    great: (r, x) => `The only move that keeps ${KEEPS.en[x.keeps]}; every alternative is clearly worse.`,
    bestMate: (r, x) => `It forces mate in ${x.n}.`,
    bestWins: (r, x) => `It wins ${PIECE.en[x.piece]}.`,
    excellent: r => `Nearly as strong as the top move ${r.bestSan} (${change(r)}).`,
    good: r => `Playable, but ${r.bestSan} was more precise (${change(r)}).`,
    allowsMate: (r, x) => `This allows mate in ${x.n}; ${r.bestSan} was necessary.`,
    missesMate: (r, x) => `This misses mate in ${x.n} starting with ${r.bestSan}.`,
    loses: (r, x) => `This loses ${PIECE.en[x.piece]} after ${x.reply}; ${r.bestSan} was better.`,
    miss: r => `This misses the chance to punish the last move with ${r.bestSan} (${change(r)}).`,
    slip: r => `This weakens the position (${change(r)}); ${r.bestSan} was stronger.`,
  },
  ru: {
    forced: () => 'Это был единственный возможный ход.',
    book: r => `Это дебютная теория${r.opening ? ` (${r.opening})` : ''}.`,
    brilliant: (r, x) => `Блестящая жертва ${RU.gen[x.piece]}: движок подтверждает, что она корректна (${change(r)}).`,
    great: (r, x) => `Единственный ход, сохраняющий ${KEEPS.ru[x.keeps]}; остальные заметно хуже.`,
    bestMate: (r, x) => `Этот ход форсирует мат в ${ruMoves(x.n)}.`,
    bestWins: (r, x) => `Этот ход выигрывает ${PIECE.ru[x.piece]}.`,
    excellent: r => `Почти не уступает лучшему ходу ${r.bestSan} (${change(r)}).`,
    good: r => `Приемлемо, но ${r.bestSan} был точнее (${change(r)}).`,
    allowsMate: (r, x) => `Это допускает мат в ${ruMoves(x.n)}; необходимо было сыграть ${r.bestSan}.`,
    missesMate: (r, x) => `Упущен мат в ${ruMoves(x.n)}, который начинался с ${r.bestSan}.`,
    loses: (r, x) => `После ${x.reply} теряется ${RU.nom[x.piece]}; лучше было ${r.bestSan}.`,
    miss: r => `Упущен шанс наказать соперника за предыдущий ход: сильнее было ${r.bestSan} (${change(r)}).`,
    slip: r => `Это ослабляет позицию (${change(r)}); сильнее было ${r.bestSan}.`,
  },
};
const STANDING = {
  en: {
    you: ['You are winning.', 'You are clearly better.', 'You have a slight edge.', 'The position is balanced.', 'You are slightly worse.', 'You are clearly worse.', 'You are losing.'],
    bot: ['The bot is winning.', 'The bot is clearly better.', 'The bot has a slight edge.', 'The position is balanced.', 'The bot is slightly worse.', 'The bot is clearly worse.', 'The bot is losing.'],
    w: ['White is winning.', 'White is clearly better.', 'White has a slight edge.', 'The position is balanced.', 'White is slightly worse.', 'White is clearly worse.', 'White is losing.'],
    b: ['Black is winning.', 'Black is clearly better.', 'Black has a slight edge.', 'The position is balanced.', 'Black is slightly worse.', 'Black is clearly worse.', 'Black is losing.'],
  },
  ru: {
    you: ['Вы выигрываете.', 'У вас явный перевес.', 'У вас небольшое преимущество.', 'Позиция равна.', 'Ваша позиция чуть хуже.', 'Ваша позиция заметно хуже.', 'Вы проигрываете.'],
    bot: ['Бот выигрывает.', 'У бота явный перевес.', 'У бота небольшое преимущество.', 'Позиция равна.', 'Позиция бота чуть хуже.', 'Позиция бота заметно хуже.', 'Бот проигрывает.'],
    w: ['Белые выигрывают.', 'У белых явный перевес.', 'У белых небольшое преимущество.', 'Позиция равна.', 'Позиция белых чуть хуже.', 'Позиция белых заметно хуже.', 'Белые проигрывают.'],
    b: ['Чёрные выигрывают.', 'У чёрных явный перевес.', 'У чёрных небольшое преимущество.', 'Позиция равна.', 'Позиция чёрных чуть хуже.', 'Позиция чёрных заметно хуже.', 'Чёрные проигрывают.'],
  },
};
const STRONGER = {
  en: {you: 'Your position gets stronger.', bot: "The bot's position gets stronger.", w: "White's position gets stronger.", b: "Black's position gets stronger."},
  ru: {you: 'Ваша позиция становится сильнее.', bot: 'Позиция бота становится сильнее.', w: 'Позиция белых становится сильнее.', b: 'Позиция чёрных становится сильнее.'},
};
const ERRORS = ['allowsMate', 'missesMate', 'loses', 'miss', 'slip'];
const standingLevel = w => w >= 0.9 ? 0 : w >= 0.72 ? 1 : w >= 0.58 ? 2 : w > 0.42 ? 3 : w > 0.28 ? 4 : w > 0.1 ? 5 : 6;
export function comment(review, lang = 'en', {who = review.mover, previous = null} = {}) {
  const L = lang === 'ru' ? 'ru' : 'en', kind = review.reason.kind, parts = [], found = review.motifs || [];
  if (found.length) parts.push(review.san + ' ' + found.map(m => CLAUSE[L][m.kind](m)).join(L === 'ru' ? ' и ' : ' and ') + '.');
  const verdict = VERDICT[L][kind]?.(review, review.reason);
  if (verdict) parts.push(verdict);
  if (!ERRORS.includes(kind) && kind !== 'checkmate' && kind !== 'bestMate') {
    if (previous && review.winAfter - previous.winAfter >= 0.08) parts.push(STRONGER[L][who]);
    parts.push(STANDING[L][who][standingLevel(review.winAfter)]);
  }
  return parts.join(' ');
}

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
