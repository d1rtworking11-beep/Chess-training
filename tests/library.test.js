import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Chess} from 'chess.js';
test('750 distinct games with complete legal move sequences and source PGNs',()=>{
 const games=JSON.parse(fs.readFileSync('public/data/games.json'));
 assert.equal(games.length,750);assert.equal(new Set(games.map(g=>g.id)).size,750);
 for(const g of games){assert.ok(g.source.startsWith('https://github.com/rozim/ChessData/'));const c=new Chess();for(const m of g.moves)c.move(m);assert.ok(c.history().length>=30);assert.ok(g.pgn.includes(g.white));}
});
test('rules enforce checkmate, castling, en passant and underpromotion',()=>{
 const c=new Chess();for(const move of ['f3','e5','g4','Qh4#'])c.move(move);assert.ok(c.isCheckmate());
 const castle=new Chess('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');castle.move('O-O');assert.equal(castle.get('f1').type,'r');
 const ep=new Chess();for(const m of ['e4','a6','e5','d5','exd6'])ep.move(m);assert.equal(ep.get('d5'),undefined);
 const promo=new Chess('7k/P7/8/8/8/8/8/7K w - - 0 1');promo.move({from:'a7',to:'a8',promotion:'n'});assert.equal(promo.get('a8').type,'n');
});
