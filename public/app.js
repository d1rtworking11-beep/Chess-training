import { Chess } from '/vendor/chess.js';
import { Engine } from './engine.js';
import { CATEGORIES, SUMMARY_ORDER, reviewMove, buildTheory, summarize } from './review.js';
const $ = id => document.getElementById(id);
const pieces = {k:'♚',q:'♛',r:'♜',b:'♝',n:'♞',p:'♟'};
const state = {chess:new Chess(), mode:'practice', library:[], record:null, recordMoves:[], ply:0, flipped:false, selected:null, legal:[], last:null, revision:0, busy:false, evaluation:null, lines:[], page:0, reviewRun:0, gameReview:null};
const engine = new Engine();
const analyses = new Map(), reviews = new Map();
let theory = () => ({book:false, opening:null});
const openingsReady = fetch('/data/openings.json').then(response=>{if(!response.ok)throw new Error('Unable to load opening names');return response.json();}).then(data=>{theory=buildTheory(data);}).catch(()=>{});
engine.ready.then(name => { $('engine-state').textContent=name; }).catch(error => { $('engine-state').textContent='Unavailable'; message(error.message); showReview({error:error.message}); });
function message(text) { $('board-message').textContent = text; }
function uciMove(chess, uci) { return chess.move({from:uci.slice(0,2),to:uci.slice(2,4),promotion:uci[4] || 'q'}); }
function whiteScore(line, turn) { const score = line.type === 'mate' ? Math.sign(line.score)*100000 : line.score; return (turn==='w'?1:-1)*score; }
function scoreText(line, turn) { if(line.type==='mate') return 'M'+((turn==='w'?1:-1)*line.score); return ((turn==='w'?1:-1)*line.score/100).toFixed(2).replace(/^(?=\d)/,'+'); }
function variation(fen, moves) { const c=new Chess(fen); const out=[]; for(const move of moves.slice(0,5)) {try{out.push(uciMove(c,move).san);}catch{break;}} return out.join('  '); }
function clearSelection(){state.selected=null;state.legal=[];}
// Engine results are cached per position so live analysis and move reviews share work.
function getAnalysis(fen, time=500){ if(!analyses.has(fen)) analyses.set(fen, engine.analyze(fen,{time}).catch(error=>{analyses.delete(fen);throw error;})); return analyses.get(fen); }
const reviewKey = move => move.before+'|'+move.lan;
// line: the game's verbose moves from the start up to and including `move`.
async function getReview(move, previous, line, time=500){
  const key=reviewKey(move); if(reviews.has(key)) return reviews.get(key);
  const before=await getAnalysis(move.before,time), after=await getAnalysis(move.after,time);
  await openingsReady;
  const prevReview=previous && reviews.get(reviewKey(previous));
  const prior=previous && {captured:previous.captured,to:previous.to,category:prevReview?.category};
  const {book,opening}=theory(line,prevReview);
  const review=reviewMove({Chess,move,before,after,previous:prior,book,opening});
  reviews.set(key,review); return review;
}
function badge(review, className='badge'){const b=document.createElement('span');b.className=className;b.textContent=review.symbol;b.style.setProperty('--c',review.color);b.title=review.label;b.setAttribute('aria-label',review.label);return b;}
function moveList(){ return state.mode==='practice' && state.record ? state.recordMoves : state.chess.history({verbose:true}); }
function squareCenter(sq){ let f='abcdefgh'.indexOf(sq[0]), r=8-Number(sq[1]); if(state.flipped){f=7-f;r=7-r;} return [f+0.5,r+0.5]; }
function drawArrow(uci){
  const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 8 8');svg.setAttribute('class','arrows');svg.setAttribute('aria-hidden','true');
  const [x1,y1]=squareCenter(uci.slice(0,2)),[x2,y2]=squareCenter(uci.slice(2,4)),len=Math.hypot(x2-x1,y2-y1),ux=(x2-x1)/len,uy=(y2-y1)/len;
  const line=document.createElementNS(ns,'line');line.setAttribute('x1',x1+ux*0.15);line.setAttribute('y1',y1+uy*0.15);line.setAttribute('x2',x2-ux*0.32);line.setAttribute('y2',y2-uy*0.32);
  const head=document.createElementNS(ns,'polygon');const px=-uy,py=ux,bx=x2-ux*0.42,by=y2-uy*0.42;head.setAttribute('points',[[x2-ux*0.05,y2-uy*0.05],[bx+px*0.22,by+py*0.22],[bx-px*0.22,by-py*0.22]].map(p=>p.join(',')).join(' '));
  svg.append(line,head);return svg;
}
function render() {
  const c=state.chess; const files=state.flipped?'hgfedcba':'abcdefgh'; const ranks=state.flipped?'12345678':'87654321';
  const lastReview=state.last && reviews.get(reviewKey(state.last));
  $('board').replaceChildren();
  for(const rank of ranks) for(const file of files){
    const sq=file+rank,p=c.get(sq),button=document.createElement('button');
    button.className='square'+((file.charCodeAt(0)+Number(rank))%2===0?' dark':'')+(p?' '+(p.color==='w'?'white-piece':'black-piece'):'')+(sq===state.selected?' selected':'')+(state.legal.some(m=>m.to===sq)?' legal':'')+(state.last && [state.last.from,state.last.to].includes(sq)?' last':'');
    button.dataset.square=sq;button.setAttribute('aria-label',sq+(p?' '+(p.color==='w'?'white ':'black ')+({k:'king',q:'queen',r:'rook',b:'bishop',n:'knight',p:'pawn'}[p.type]):' empty'));
    if(p){const span=document.createElement('img');span.className='piece';span.src='/pieces/'+p.color+p.type.toUpperCase()+'.svg';span.alt='';span.draggable=false;button.append(span);}
    if(file===files[0]){const label=document.createElement('span');label.className='coord rank';label.textContent=rank;button.append(label);}
    if(rank===ranks[7]){const label=document.createElement('span');label.className='coord file';label.textContent=file;button.append(label);}
    if(lastReview && sq===state.last.to) button.append(badge(lastReview));
    button.onclick=()=>clickSquare(sq);$('board').append(button);
  }
  if(lastReview?.bestUci) $('board').append(drawArrow(lastReview.bestUci));
  $('turn').textContent=c.isCheckmate()?'Checkmate':c.isDraw()?'Draw':(c.turn()==='w'?'White':'Black')+' to move'+(c.isCheck()?' · Check':'');
  const history=moveList();
  $('moves').replaceChildren();
  for(let i=0;i<history.length;i++){
    if(i%2===0){const n=document.createElement('span');n.textContent=i/2+1+'.';$('moves').append(n);}
    const b=document.createElement('button');const review=reviews.get(reviewKey(history[i]));if(review)b.append(badge(review,'mini'));b.append(history[i].san);b.className=i===c.history().length-1?'current':'';
    b.disabled=state.mode==='bot';b.onclick=()=>loadPosition(i+1);$('moves').append(b);
  }
  $('history-count').textContent=Math.ceil(history.length/2)+' moves';
  $('ply').textContent='Move '+(Math.floor(c.history().length/2)+1);
  for(const id of ['first','prev','next','last']) $(id).disabled=state.mode==='bot'||!state.record;
  $('prev').disabled ||= state.ply===0; $('first').disabled ||= state.ply===0;
  $('next').disabled ||= state.record && state.ply>=state.record.moves.length; $('last').disabled ||= state.record && state.ply>=state.record.moves.length;
  $('review-game').disabled=!history.length || state.gameReview?.running;
  drawGraph();
}
function showReview(review, move){
  const card=$('review-card');card.style.removeProperty('--c');$('review-meta').replaceChildren();
  const symbol=$('review-badge');symbol.textContent='·';symbol.style.removeProperty('--c');symbol.classList.remove('pending');
  if(review?.error){$('review-title').textContent='Review unavailable';$('review-text').textContent=review.error;return;}
  if(!review){$('review-title').textContent='Make a move';$('review-text').textContent='Every move is checked by Stockfish and labelled from Brilliant to Blunder, with what changed.';return;}
  if(review==='pending'){symbol.classList.add('pending');symbol.textContent='…';$('review-title').textContent='Reviewing '+move.san+'…';$('review-text').textContent='Stockfish is comparing this move with the best alternatives.';return;}
  card.style.setProperty('--c',review.color);symbol.textContent=review.symbol;symbol.style.setProperty('--c',review.color);
  $('review-title').textContent=review.san+' is '+review.phrase;
  $('review-text').textContent=review.text;
  const chip=(label,value)=>{const s=document.createElement('span');s.className='chip';s.textContent=label+' '+value;$('review-meta').append(s);};
  chip('Eval',review.evalBefore+' → '+review.evalAfter);chip('Accuracy',Math.round(review.accuracy)+'%');if(review.bestUci)chip('Best',review.bestSan);
}
async function reviewLast(){
  const history=state.chess.history({verbose:true}),move=history.at(-1);
  if(!move){showReview(null);return;}
  const key=reviewKey(move);if(!reviews.has(key))showReview('pending',move);
  try{const review=await getReview(move,history.at(-2),history);if(state.last&&reviewKey(state.last)===key){showReview(review);render();}}
  catch(error){if(state.last&&reviewKey(state.last)===key)showReview({error:error.message});}
}
async function clickSquare(sq){
  if(state.busy||state.chess.isGameOver())return;
  if(state.mode==='bot'&&state.chess.turn()!==$('side').value)return;
  const move=state.legal.find(m=>m.to===sq);
  if(move){let promotion='q';if(move.flags.includes('p'))promotion=await choosePromotion();await playMove({from:state.selected,to:sq,promotion});return;}
  const p=state.chess.get(sq);if(p&&p.color===state.chess.turn()){state.selected=sq;state.legal=state.chess.moves({square:sq,verbose:true});}else clearSelection();render();
}
function choosePromotion(){return new Promise(resolve=>{$('promotion-options').replaceChildren();for(const piece of ['q','r','b','n']){const b=document.createElement('button');b.textContent=pieces[piece];b.setAttribute('aria-label',({q:'Queen',r:'Rook',b:'Bishop',n:'Knight'})[piece]);b.onclick=()=>{$('promotion').close();resolve(piece);};$('promotion-options').append(b);}$('promotion').oncancel=e=>e.preventDefault();$('promotion').showModal();});}
async function playMove(move){
  let made;
  try{made=state.chess.move(move);}catch{return;}
  state.last=made;clearSelection();
  if(state.mode==='bot'&&state.gameReview)resetGameReview();
  if(state.mode==='practice'&&state.record){const expected=state.record.moves[state.ply];if($('guess-mode').checked){message(made.san===expected?'That’s the move! The master played '+expected+'.':'You played '+made.san+'. The master chose '+expected+'. Compare the engine evaluation, or use Next to return to the game.');}else message('Exploring '+made.san+'. Use the arrows to return to the recorded game.');if(made.san===expected)state.ply++;}
  render();
  const analysis=analyze();reviewLast();await analysis;
  if(state.mode==='bot'&&state.chess.isGameOver())message('Game over. Use “Review full game” to see every move rated.');
  if(state.mode==='bot'&&!state.chess.isGameOver()&&state.chess.turn()!==$('side').value)await botMove();
}
async function analyze(){
  const revision=++state.revision,fen=state.chess.fen();state.evaluation=null;state.lines=[];$('engine-state').textContent='Analyzing…';
  try{
    const result=await getAnalysis(fen);if(revision!==state.revision)return;
    const first=result.lines[0];state.lines=result.lines;
    if(!first){$('engine-state').textContent=state.chess.isGameOver()?'Game over':'No analysis';$('score').textContent='—';$('lines').replaceChildren();return;}
    state.evaluation=whiteScore(first,state.chess.turn());$('score').textContent=scoreText(first,state.chess.turn());
    const cp=state.evaluation;$('eval-fill').style.height=(50+45*Math.tanh(cp/500))+'%';$('eval-number').textContent=$('score').textContent;
    $('advantage').textContent=Math.abs(cp)<35?'The position is balanced':(cp>0?'White':'Black')+' has the advantage';
    $('engine-state').textContent=(engine.name||'Stockfish')+' · depth '+first.depth;$('lines').replaceChildren();
    result.lines.forEach((line,i)=>{const div=document.createElement('div');div.className='line';const score=document.createElement('span');score.className='line-score';score.textContent=scoreText(line,state.chess.turn());const pv=document.createElement('span');pv.className='variation';pv.textContent=variation(fen,line.pv);pv.title=pv.textContent;const label=document.createElement('small');label.textContent=i===0?'BEST LINE':'ALTERNATIVE';div.append(score,pv,label);$('lines').append(div);});
    let tip='Consider '+variation(fen,first.pv.slice(0,1))+'. Compare the continuations above before making your move.';
    if(state.chess.isCheck())tip='Your king is in check. Capture the attacker, block the check, or move the king. '+tip;
    $('tip').textContent=tip;
  }catch(error){if(revision===state.revision){$('engine-state').textContent='Unavailable';$('tip').textContent=error.message;message(error.message);}}
}
async function botMove(){
  if(state.busy||state.chess.isGameOver())return;state.busy=true;const revision=state.revision;const fen=state.chess.fen();message('Your bot is thinking…');
  try{const elo=Number($('elo').value);const result=await engine.analyze(fen,{elo,time:elo>=2500?1200:400});if(revision!==state.revision||state.chess.fen()!==fen)return;
    let move=result.best;const legal=state.chess.moves({verbose:true});
    // Below Stockfish's minimum Elo, add legal random moves to approximate a beginner.
    if(elo<1320 && Math.random()<(1320-elo)/1200){const pick=legal[Math.floor(Math.random()*legal.length)];move=pick.from+pick.to+(pick.promotion||'');}
    if(move&&move!=='(none)'){state.last=uciMove(state.chess,move);render();message(state.chess.isGameOver()?'Bot played '+state.last.san+'. Game over. Use “Review full game” to see every move rated.':'Bot played '+state.last.san+'. Your move.');const analysis=analyze();reviewLast();await analysis;}
  }catch(error){message(error.message+' Start a new game to retry.');}finally{state.busy=false;}
}
function loadPosition(ply){
  if(!state.record)return;state.revision++;state.busy=false;state.chess=new Chess();for(const move of state.record.moves.slice(0,ply))state.chess.move(move);state.ply=ply;state.last=state.chess.history({verbose:true}).at(-1)||null;clearSelection();render();message('Find the best move for '+(state.chess.turn()==='w'?'White':'Black')+'.');analyze();reviewLast();
}
function resetGameReview(){state.reviewRun++;state.gameReview=null;$('review-progress').classList.add('hidden');$('review-summary').classList.add('hidden');}
function loadGame(record){resetGameReview();state.record=record;const replay=new Chess();state.recordMoves=record.moves.map(m=>replay.move(m));$('source-link').href=record.source;$('match-title').textContent=record.white+' vs '+record.black;$('match-meta').textContent=[record.event,record.date,record.result].join(' · ');$('black-name').textContent=record.black;$('white-name').textContent=record.white;$('black-detail').textContent=record.blackElo?record.blackElo+' Elo':'Master game';$('white-detail').textContent=record.whiteElo?record.whiteElo+' Elo':'Find the next move';loadPosition(Math.min(16,record.moves.length-1));}
function newBot(){resetGameReview();state.revision++;state.busy=false;state.chess=new Chess();state.last=null;state.ply=0;clearSelection();state.flipped=$('side').value==='b';const elo=$('elo').value;$('black-name').textContent=$('side').value==='w'?'Stockfish · '+elo:'You';$('white-name').textContent=$('side').value==='b'?'Stockfish · '+elo:'You';$('black-detail').textContent='Practice without pressure';$('white-detail').textContent='Live coaching enabled';render();showReview(null);message('New game. You are playing '+($('side').value==='w'?'White':'Black')+'.');analyze().then(()=>{if(state.mode==='bot'&&state.chess.turn()!==$('side').value)botMove();});}
function setMode(mode){state.mode=mode;$('board').classList.toggle('blindfold',mode==='practice'&&$('vision-mode').checked);document.querySelectorAll('.nav').forEach(b=>b.classList.toggle('active',b.dataset.mode===mode));$('practice-settings').classList.toggle('hidden',mode!=='practice');$('bot-settings').classList.toggle('hidden',mode!=='bot');$('crumb').textContent=mode==='practice'?'Master games':'Play a bot';$('title').textContent=mode==='practice'?'Great games. Your next move.':'A worthy opponent. At every level.';$('subtitle').textContent=mode==='practice'?'Step into the minds of the masters. Find the move, understand the idea.':'Build your confidence with adjustable bots and a coach in your corner.';if(mode==='bot')newBot();else if(state.record)loadGame(state.record);}
// Full-game review: rates every move in order, then shows accuracy, a tally and an evaluation graph.
async function reviewGame(){
  const moves=moveList();if(!moves.length)return;
  const run=++state.reviewRun,results=[];state.gameReview={running:true,moves,results};
  $('review-summary').classList.add('hidden');$('review-progress').classList.remove('hidden');render();
  for(let i=0;i<moves.length;i++){
    if(run!==state.reviewRun)return;
    $('review-progress-label').textContent='Reviewing move '+(Math.floor(i/2)+1)+(i%2?'…':'.')+' ('+(i+1)+' of '+moves.length+')';$('review-progress-fill').style.width=(100*i/moves.length)+'%';
    try{results.push(await getReview(moves[i],moves[i-1],moves.slice(0,i+1),350));}
    catch(error){if(run===state.reviewRun){$('review-progress-label').textContent='Review stopped: '+error.message;state.gameReview.running=false;render();}return;}
    if(run!==state.reviewRun)return;
    if(i%6===5)render();
  }
  state.gameReview.running=false;$('review-progress').classList.add('hidden');renderSummary();render();
  if(state.last){const r=reviews.get(reviewKey(state.last));if(r)showReview(r);}
}
function renderSummary(){
  const {results}=state.gameReview,sides=summarize(results);
  const names=state.mode==='practice'&&state.record?{w:state.record.white,b:state.record.black}:{w:$('white-name').textContent,b:$('black-name').textContent};
  $('accuracy-white').textContent=sides.w.accuracy==null?'—':sides.w.accuracy.toFixed(1);$('accuracy-black').textContent=sides.b.accuracy==null?'—':sides.b.accuracy.toFixed(1);
  $('name-white').textContent=names.w;$('name-black').textContent=names.b;
  const opening=results.at(-1)?.opening;$('review-opening').textContent=opening?'Opening: '+opening:'';
  const table=$('tally');table.replaceChildren();
  for(const key of SUMMARY_ORDER){const cat=CATEGORIES[key],row=document.createElement('div');row.className='tally-row';const w=document.createElement('b'),b=document.createElement('b'),label=document.createElement('span');w.textContent=sides.w.tally[key]||0;b.textContent=sides.b.tally[key]||0;label.append(badge(cat,'mini'),cat.label);if(!sides.w.tally[key]&&!sides.b.tally[key])row.classList.add('zero');row.append(w,label,b);table.append(row);}
  $('review-summary').classList.remove('hidden');
}
function drawGraph(){
  const svg=$('eval-graph');if(!svg||!state.gameReview||state.gameReview.running){return;}
  const {results}=state.gameReview,n=results.length;if(!n)return;
  const W=300,H=70,x=i=>W*i/n,y=w=>H*(1-w);
  const points=[[0,y(results[0].mover==='w'?results[0].winBefore:1-results[0].winBefore)]];
  results.forEach((r,i)=>points.push([x(i+1),y(r.mover==='w'?r.winAfter:1-r.winAfter)]));
  const ns='http://www.w3.org/2000/svg';svg.replaceChildren();
  const area=document.createElementNS(ns,'path');area.setAttribute('class','graph-white');area.setAttribute('d','M0,'+H+' L'+points.map(p=>p.join(',')).join(' L')+' L'+W+','+H+' Z');
  const mid=document.createElementNS(ns,'line');mid.setAttribute('class','graph-mid');mid.setAttribute('x1',0);mid.setAttribute('x2',W);mid.setAttribute('y1',H/2);mid.setAttribute('y2',H/2);
  svg.append(area,mid);
  const ply=state.mode==='practice'?state.ply:state.chess.history().length;
  const cursor=document.createElementNS(ns,'line');cursor.setAttribute('class','graph-cursor');cursor.setAttribute('x1',x(ply));cursor.setAttribute('x2',x(ply));cursor.setAttribute('y1',0);cursor.setAttribute('y2',H);svg.append(cursor);
  results.forEach((r,i)=>{if(!['brilliant','great','inaccuracy','mistake','miss','blunder'].includes(r.category))return;const dot=document.createElementNS(ns,'circle');dot.setAttribute('cx',points[i+1][0]);dot.setAttribute('cy',points[i+1][1]);dot.setAttribute('r',2.6);dot.setAttribute('fill',r.color);dot.setAttribute('class','graph-dot');const t=document.createElementNS(ns,'title');t.textContent=(Math.floor(i/2)+1)+(i%2?'… ':'. ')+r.san+' · '+r.label;dot.append(t);svg.append(dot);});
  svg.classList.toggle('clickable',state.mode==='practice');
}
$('eval-graph').onclick=event=>{if(state.mode!=='practice'||!state.gameReview)return;const box=$('eval-graph').getBoundingClientRect();const n=state.gameReview.results.length;loadPosition(Math.max(0,Math.min(n,Math.round(n*(event.clientX-box.left)/box.width))));};
$('review-game').onclick=reviewGame;
function renderLibrary(){const term=$('search').value.toLowerCase();const filtered=state.library.filter(g=>[g.white,g.black,g.event,g.date,g.eco].join(' ').toLowerCase().includes(term));const pages=Math.max(1,Math.ceil(filtered.length/10));state.page=Math.min(state.page,pages-1);$('results-label').textContent=filtered.length+' games found';$('game-list').replaceChildren();for(const game of filtered.slice(state.page*10,state.page*10+10)){const b=document.createElement('button');b.className='game-row';const detail=document.createElement('div'),title=document.createElement('b'),meta=document.createElement('small'),result=document.createElement('span');title.textContent=game.white+' — '+game.black;meta.textContent=[game.event,game.date,game.eco].filter(Boolean).join(' · ');result.textContent=game.result;detail.append(title,meta);b.append(detail,result);b.onclick=()=>{$('library').close();loadGame(game);};$('game-list').append(b);}$('page-label').textContent=(state.page+1)+' / '+pages;$('page-prev').disabled=state.page===0;$('page-next').disabled=state.page===pages-1;}
document.querySelectorAll('.nav').forEach(b=>b.onclick=()=>setMode(b.dataset.mode));
$('flip').onclick=()=>{state.flipped=!state.flipped;render();};$('reset').onclick=()=>state.mode==='bot'?newBot():loadPosition(0);
$('first').onclick=()=>loadPosition(0);$('prev').onclick=()=>loadPosition(Math.max(0,state.ply-1));$('next').onclick=()=>loadPosition(Math.min(state.record.moves.length,state.ply+1));$('last').onclick=()=>loadPosition(state.record.moves.length);
$('choose-game').onclick=()=>{renderLibrary();$('library').showModal();};$('close-library').onclick=()=>$('library').close();$('search').oninput=()=>{state.page=0;renderLibrary();};$('page-prev').onclick=()=>{state.page--;renderLibrary();};$('page-next').onclick=()=>{state.page++;renderLibrary();};
$('random-game').onclick=()=>loadGame(state.library[Math.floor(Math.random()*state.library.length)]);$('elo').oninput=()=>$('elo-value').textContent=$('elo').value;$('new-bot').onclick=newBot;
$('hint').onclick=()=>{const best=state.lines[0]?.pv[0];if(!best){message('Wait for the engine analysis, then try again.');return;}state.selected=best.slice(0,2);state.legal=state.chess.moves({square:state.selected,verbose:true}).filter(m=>m.to===best.slice(2,4));render();message('Engine suggestion: '+variation(state.chess.fen(),[best])+'. The highlighted piece and square show the idea.');};
render();showReview(null);
try{const response=await fetch('/data/games.json');if(!response.ok)throw new Error('Unable to load game library');state.library=await response.json();$('game-count').textContent=state.library.length.toLocaleString();loadGame(state.library.find(g=>g.white.includes('Fischer')&&g.black.includes('Spassky'))||state.library[0]);}catch(error){$('match-title').textContent='Library unavailable';message(error.message);}

$('vision-mode').onchange=()=>{$('board').classList.toggle('blindfold',$('vision-mode').checked);message($('vision-mode').checked?'Pieces hidden. Visualize the position and try a move, or uncheck to reveal.':'Pieces revealed.');};
$('download-pgn').onclick=()=>{const url=URL.createObjectURL(new Blob([state.record.pgn],{type:'application/x-chess-pgn'}));const a=document.createElement('a');a.href=url;a.download=state.record.id+'.pgn';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
