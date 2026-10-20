// Builds public/data/puzzles.json from the Lichess puzzle database (CC0-1.0): mate-in-3, 4 and 5
// puzzles from real games, spread across rating bands, each replayed to check it ends in checkmate.
// Usage: node scripts/import-puzzles.js lichess_db_puzzle.csv.zst [snapshot-date]
import fs from 'node:fs';
import readline from 'node:readline';
import zlib from 'node:zlib';
import { Chess } from 'chess.js';
const [file, snapshot = ''] = process.argv.slice(2);
if (!file) throw new Error('Usage: node scripts/import-puzzles.js lichess_db_puzzle.csv.zst [snapshot-date]');
const COLUMNS = 'PuzzleId,FEN,Moves,Rating,RatingDeviation,Popularity,NbPlays,Themes,GameUrl,OpeningTags';
const QUOTA = {3: 4000, 4: 3500, 5: 2500};
const BANDS = [[0, 1200], [1200, 1500], [1500, 1800], [1800, 2100], [2100, 2400], [2400, Infinity]];
// A stable order from the puzzle id, so the same snapshot always gives the same selection.
const hash = id => { let h = 2166136261; for (const ch of id) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; };
// Lichess puzzles start one move early: the first move is the opponent's, then the solver mates in n.
function valid(p) {
  try {
    const chess = new Chess(p.fen), moves = p.moves.split(' ');
    for (const uci of moves) chess.move({from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4]});
    return moves.length === 2 * p.n && chess.isCheckmate();
  } catch { return false; }
}
const candidates = {3: [], 4: [], 5: []};
let rows = 0;
const input = fs.createReadStream(file).pipe(zlib.createZstdDecompress());
for await (const line of readline.createInterface({input, crlfDelay: Infinity})) {
  if (!rows++) { if (!line.startsWith(COLUMNS)) throw new Error('Unexpected columns: ' + line); continue; }
  const [id, fen, moves, rating, deviation, popularity, plays, themes] = line.split(',');
  const n = /\bmateIn([345])\b/.exec(themes)?.[1];
  // Well-tested, well-liked puzzles only: a settled rating, positive votes and plenty of plays.
  if (!n || Number(deviation) > 80 || Number(popularity) < 85 || Number(plays) < 300) continue;
  candidates[n].push({id, fen, moves, rating: Number(rating), n: Number(n), key: hash(id)});
}
// Takes puzzles from every rating band in turn, so easy and hard positions are equally represented.
function pick(list, quota) {
  const bands = BANDS.map(([low, high]) => list.filter(p => p.rating >= low && p.rating < high).sort((a, b) => a.key - b.key));
  const chosen = [], cursor = bands.map(() => 0);
  while (chosen.length < quota) {
    let added = false;
    for (let b = 0; b < bands.length && chosen.length < quota; b++) {
      while (cursor[b] < bands[b].length) { const p = bands[b][cursor[b]++]; if (valid(p)) { chosen.push(p); added = true; break; } }
    }
    if (!added) break;
  }
  return chosen;
}
const chosen = [3, 4, 5].map(n => pick(candidates[n], QUOTA[n]));
const puzzles = chosen.flat().sort((a, b) => a.key - b.key).map(p => [p.id, p.fen, p.moves, p.rating, p.n]);
fs.writeFileSync('public/data/puzzles.json', JSON.stringify({source: 'https://database.lichess.org/#puzzles', license: 'CC0-1.0', snapshot, puzzles}));
console.log(`Read ${rows - 1} puzzles; candidates mate in 3/4/5: ${[3, 4, 5].map(n => candidates[n].length).join('/')}; saved ${puzzles.length} (${chosen.map(c => c.length).join('/')})`);
