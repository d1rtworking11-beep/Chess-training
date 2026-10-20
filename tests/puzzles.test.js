import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Chess} from 'chess.js';

test('10,000 distinct mate-in-3/4/5 puzzles, each replaying to checkmate in n moves', () => {
  const data = JSON.parse(fs.readFileSync('public/data/puzzles.json'));
  assert.equal(data.license, 'CC0-1.0'); assert.equal(data.puzzles.length, 10000);
  assert.equal(new Set(data.puzzles.map(p => p[0])).size, 10000);
  const counts = {3: 0, 4: 0, 5: 0};
  for (const [id, fen, moves, rating, n] of data.puzzles) {
    counts[n]++;
    const chess = new Chess(fen), list = moves.split(' ');
    assert.equal(list.length, 2 * n, id);
    for (const uci of list) chess.move({from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4]});
    assert.ok(chess.isCheckmate(), id + ' should end in checkmate');
    assert.ok(rating >= 400 && rating <= 3500, id);
  }
  assert.deepEqual(counts, {3: 4000, 4: 3500, 5: 2500});
});
