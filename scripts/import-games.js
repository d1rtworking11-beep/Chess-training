import fs from 'node:fs';
import crypto from 'node:crypto';
import { Chess } from 'chess.js';
const games=[],seen=new Set();
for(const player of ['Fischer','Kasparov','Carlsen']){
 const filename=process.argv.slice(2).find(f=>f.includes(player));if(!filename)throw new Error('Missing PGN for '+player);
 const text=fs.readFileSync(filename,'utf8').replace(/\r/g,'');
 const records=text.split(/\n(?=\[Event )/); const valid=[];
 const classicDate={Fischer:'1972.07.23',Kasparov:'1999.01.20',Carlsen:'2013.11.21'}[player];
 const classics=records.filter(pgn=>pgn.includes('[Date \"'+classicDate+'\"]'));
 const sampleCount=250-classics.length;
 const sampled=Array.from({length:sampleCount},(_,i)=>records[Math.floor(i*(records.length-1)/(sampleCount-1))]);
 const candidates=[...classics,...sampled,...records];
 for(const pgn of candidates){if(valid.length===250)break;try{const c=new Chess();c.loadPgn(pgn);const h=c.getHeaders();const moves=c.history();if(moves.length<30||!h.White||!h.Black)continue;const hash=crypto.createHash('sha256').update(moves.join(' ')).digest('hex');if(seen.has(hash))continue;seen.add(hash);valid.push({id:hash.slice(0,16),white:h.White,black:h.Black,event:h.Event,date:h.Date,result:h.Result,eco:h.ECO||'',whiteElo:h.WhiteElo||'',blackElo:h.BlackElo||'',moves,pgn,source:'https://github.com/rozim/ChessData/blob/master/PgnMentor/'+player+'.pgn'});}catch{}}
 // Spread selections across the player's career rather than taking only early games.
 for(let i=0;i<250;i++){const game=valid[i];if(!game)throw new Error('Insufficient games for '+player);games.push(game);}
 console.log(player+': '+valid.length+' legal, unique candidates; selected 250');
}
if(new Set(games.map(g=>g.id)).size!==750)throw new Error('Duplicate selection');
fs.writeFileSync('public/data/games.json',JSON.stringify(games));
console.log('Saved '+games.length+' distinct real games');
