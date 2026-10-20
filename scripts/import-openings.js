// Builds public/data/openings.json from the lichess-org/chess-openings TSV files (CC0-1.0):
// every position on a named opening line, mapped to the opening's name where a line ends.
// Usage: node scripts/import-openings.js /path/to/chess-openings [commit]
import fs from 'node:fs';
import path from 'node:path';
import { Chess } from 'chess.js';
const [dir, commit = ''] = process.argv.slice(2);
if (!dir) throw new Error('Usage: node scripts/import-openings.js /path/to/chess-openings [commit]');
// Position key: placement, side to move, castling and en passant (the FEN without move counters).
const epd = chess => chess.fen().split(' ').slice(0, 4).join(' ');
const names = [], positions = {};
let duplicates = 0;
for (const file of ['a', 'b', 'c', 'd', 'e']) {
  for (const row of fs.readFileSync(path.join(dir, file + '.tsv'), 'utf8').trim().split('\n').slice(1)) {
    const [eco, name, pgn] = row.split('\t'); const chess = new Chess();
    for (const san of pgn.split(' ').filter(token => !/^\d+\.$/.test(token))) { chess.move(san); positions[epd(chess)] ??= -1; }
    const key = epd(chess);
    if (positions[key] >= 0) duplicates++; else { positions[key] = names.length; names.push([eco, name]); }
  }
}
fs.writeFileSync('public/data/openings.json', JSON.stringify({source: 'https://github.com/lichess-org/chess-openings', commit, license: 'CC0-1.0', names, positions}));
console.log('Saved ' + names.length + ' named openings covering ' + Object.keys(positions).length + ' positions' + (duplicates ? '; ' + duplicates + ' lines share an end position (first name kept)' : ''));
