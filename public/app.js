import { Chess } from '/vendor/chess.js';
import { Engine } from './engine.js';
const $ = id => document.getElementById(id);
const pieces = {k:'♚',q:'♛',r:'♜',b:'♝',n:'♞',p:'♟'};
const state = {chess:new Chess(), mode:'practice', library:[], record:null, ply:0, flipped:false, selected:null, legal:[], last:null, revision:0, busy:false, evaluation:null, lines:[], reviews:{}, page:0};
const engine = new Engine();
engine.ready.then(() => { $('engine-state').textContent='Stockfish 19'; }).catch(error => { $('engine-state').textContent='Unavailable'; message(error.message); });
function message(text) { $('board-message').textContent = text; }
function uciMove(chess, uci) { return chess.move({from:uci.slice(0,2),to:uci.slice(2,4),promotion:uci[4] || 'q'}); }
function whiteScore(line, turn) { const score = line.type === 'mate' ? Math.sign(line.score)*100000 : line.score; return (turn==='w'?1:-1)*score; }
function scoreText(line, turn) { if(line.type==='mate') return 'M'+((turn==='w'?1:-1)*line.score); return ((turn==='w'?1:-1)*line.score/100).toFixed(2).replace(/^(?=\d)/,'+'); }
function variation(fen, moves) { const c=new Chess(fen); const out=[]; for(const move of moves.slice(0,5)) {try{out.push(uciMove(c,move).san);}catch{break;}} return out.join('  '); }
function clearSelection(){state.selected=null;state.legal=[];}
function render() {
  const c=state.chess; const files=state.flipped?'hgfedcba':'abcdefgh'; const ranks=state.flipped?'12345678':'87654321';
  $('board').replaceChildren();
  for(const rank of ranks) for(const file of files){
    const sq=file+rank,p=c.get(sq),button=document.createElement('button');
    button.className='square'+((file.charCodeAt(0)+Number(rank))%2===0?' dark':'')+(p?' '+(p.color==='w'?'white-piece':'black-piece'):'')+(sq===state.selected?' selected':'')+(state.legal.some(m=>m.to===sq)?' legal':'')+(state.last && [state.last.from,state.last.to].includes(sq)?' last':'');
    button.dataset.square=sq;button.setAttribute('aria-label',sq+(p?' '+(p.color==='w'?'white ':'black ')+({k:'king',q:'queen',r:'rook',b:'bishop',n:'knight',p:'pawn'}[p.type]):' empty'));
    if(p){const span=document.createElement('img');span.className='piece';span.src='/pieces/'+p.color+p.type.toUpperCase()+'.svg';span.alt='';span.draggable=false;button.append(span);}
    if(file===files[0]){const label=document.createElement('span');label.className='coord rank';label.textContent=rank;button.append(label);}
    if(rank===ranks[7]){const label=document.createElement('span');label.className='coord file';label.textContent=file;button.append(label);}
    button.onclick=()=>clickSquare(sq);$('board').append(button);
  }
  $('turn').textContent=c.isCheckmate()?'Checkmate':c.isDraw()?'Draw':(c.turn()==='w'?'White':'Black')+' to move'+(c.isCheck()?' · Check':'');
  const history=state.mode==='practice' && state.record ? state.record.moves : c.history();
  $('moves').replaceChildren();
  for(let i=0;i<history.length;i++){
    if(i%2===0){const n=document.createElement('span');n.textContent=i/2+1+'.';$('moves').append(n);}
    const b=document.createElement('button');b.textContent=history[i];b.className=i===c.history().length-1?'current':'';
    b.disabled=state.mode==='bot';b.onclick=()=>loadPosition(i+1);$('moves').append(b);
  }
  $('history-count').textContent=Math.ceil(history.length/2)+' moves';
  $('ply').textContent='Move '+(Math.floor(c.history().length/2)+1);
  for(const id of ['first','prev','next','last']) $(id).disabled=state.mode==='bot'||!state.record;
  $('prev').disabled ||= state.ply===0; $('first').disabled ||= state.ply===0;
  $('next').disabled ||= state.record && state.ply>=state.record.moves.length; $('last').disabled ||= state.record && state.ply>=state.record.moves.length;
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
  const before=state.evaluation, mover=state.chess.turn();let made;
  try{made=state.chess.move(move);}catch{return;}
  state.last=made;clearSelection();
  if(state.mode==='practice'&&state.record){const expected=state.record.moves[state.ply];if($('guess-mode').checked){message(made.san===expected?'That’s the move! The master played '+expected+'.':'You played '+made.san+'. The master chose '+expected+'. Compare the engine evaluation, or use Next to return to the game.');}else message('Exploring '+made.san+'. Use the arrows to return to the recorded game.');if(made.san===expected)state.ply++;}
  render();
  await analyze({before,mover,san:made.san});
  if(state.mode==='bot'&&!state.chess.isGameOver()&&state.chess.turn()!==$('side').value)await botMove();
}
async function analyze(previous=null){
  const revision=++state.revision,fen=state.chess.fen();state.evaluation=null;state.lines=[];$('engine-state').textContent='Analyzing…';
  try{
    const result=await engine.analyze(fen);if(revision!==state.revision)return;
    const first=result.lines[0];state.lines=result.lines;
    if(!first){$('engine-state').textContent=state.chess.isGameOver()?'Game over':'No analysis';$('score').textContent='—';$('lines').replaceChildren();return;}
    state.evaluation=whiteScore(first,state.chess.turn());$('score').textContent=scoreText(first,state.chess.turn());
    const cp=state.evaluation;$('eval-fill').style.height=(50+45*Math.tanh(cp/500))+'%';$('eval-number').textContent=$('score').textContent;
    $('advantage').textContent=Math.abs(cp)<35?'The position is balanced':(cp>0?'White':'Black')+' has the advantage';
    $('engine-state').textContent='Stockfish · depth '+first.depth;$('lines').replaceChildren();
    result.lines.forEach((line,i)=>{const div=document.createElement('div');div.className='line';const score=document.createElement('span');score.className='line-score';score.textContent=scoreText(line,state.chess.turn());const pv=document.createElement('span');pv.className='variation';pv.textContent=variation(fen,line.pv);pv.title=pv.textContent;const label=document.createElement('small');label.textContent=i===0?'BEST LINE':'ALTERNATIVE';div.append(score,pv,label);$('lines').append(div);});
    let tip='Consider '+variation(fen,first.pv.slice(0,1))+'. Compare the continuations above before making your move.';
    if(previous && previous.before!==null){const loss=(previous.before-cp)*(previous.mover==='w'?1:-1);state.reviews[previous.mover]=(previous.mover==='w'?'White':'Black')+' played '+previous.san+': '+(loss>200?'a costly move':loss>80?'an inaccuracy':'a sound move')+' ('+(Math.max(0,loss)/100).toFixed(2)+' pawn loss in this short search).';}
    if(state.chess.isCheck())tip='Your king is in check. Capture the attacker, block the check, or move the king. '+tip;
    $('tip').textContent=Object.values(state.reviews).join(' ')+' '+tip;
  }catch(error){if(revision===state.revision){$('engine-state').textContent='Unavailable';$('tip').textContent=error.message;message(error.message);}}
}
async function botMove(){
  if(state.busy||state.chess.isGameOver())return;state.busy=true;const revision=state.revision;const fen=state.chess.fen();const before=state.evaluation,mover=state.chess.turn();message('Your bot is thinking…');
  try{const elo=Number($('elo').value);const result=await engine.analyze(fen,{elo,time:elo>=2500?1200:400});if(revision!==state.revision||state.chess.fen()!==fen)return;
    let move=result.best;const legal=state.chess.moves({verbose:true});
    // Below Stockfish's minimum Elo, add legal random moves to approximate a beginner.
    if(elo<1320 && Math.random()<(1320-elo)/1200){const pick=legal[Math.floor(Math.random()*legal.length)];move=pick.from+pick.to+(pick.promotion||'');}
    if(move&&move!=='(none)'){state.last=uciMove(state.chess,move);render();message('Bot played '+state.last.san+'. Your move.');await analyze({before,mover,san:state.last.san});}
  }catch(error){message(error.message+' Start a new game to retry.');}finally{state.busy=false;}
}
function loadPosition(ply){
  if(!state.record)return;state.revision++;state.busy=false;state.chess=new Chess();state.reviews={};for(const move of state.record.moves.slice(0,ply))state.chess.move(move);state.ply=ply;state.last=state.chess.history({verbose:true}).at(-1);clearSelection();render();message('Find the best move for '+(state.chess.turn()==='w'?'White':'Black')+'.');analyze();
}
function loadGame(record){state.record=record;$('source-link').href=record.source;$('match-title').textContent=record.white+' vs '+record.black;$('match-meta').textContent=[record.event,record.date,record.result].join(' · ');$('black-name').textContent=record.black;$('white-name').textContent=record.white;$('black-detail').textContent=record.blackElo?record.blackElo+' Elo':'Master game';$('white-detail').textContent=record.whiteElo?record.whiteElo+' Elo':'Find the next move';loadPosition(Math.min(16,record.moves.length-1));}
function newBot(){state.revision++;state.busy=false;state.chess=new Chess();state.reviews={};state.last=null;state.ply=0;clearSelection();state.flipped=$('side').value==='b';const elo=$('elo').value;$('black-name').textContent=$('side').value==='w'?'Stockfish · '+elo:'You';$('white-name').textContent=$('side').value==='b'?'Stockfish · '+elo:'You';$('black-detail').textContent='Practice without pressure';$('white-detail').textContent='Live coaching enabled';render();message('New game. You are playing '+($('side').value==='w'?'White':'Black')+'.');analyze().then(()=>{if(state.mode==='bot'&&state.chess.turn()!==$('side').value)botMove();});}
function setMode(mode){state.mode=mode;$('board').classList.toggle('blindfold',mode==='practice'&&$('vision-mode').checked);document.querySelectorAll('.nav').forEach(b=>b.classList.toggle('active',b.dataset.mode===mode));$('practice-settings').classList.toggle('hidden',mode!=='practice');$('bot-settings').classList.toggle('hidden',mode!=='bot');$('crumb').textContent=mode==='practice'?'Master games':'Play a bot';$('title').textContent=mode==='practice'?'Great games. Your next move.':'A worthy opponent. At every level.';$('subtitle').textContent=mode==='practice'?'Step into the minds of the masters. Find the move, understand the idea.':'Build your confidence with adjustable bots and a coach in your corner.';if(mode==='bot')newBot();else if(state.record)loadGame(state.record);}
function renderLibrary(){const term=$('search').value.toLowerCase();const filtered=state.library.filter(g=>[g.white,g.black,g.event,g.date,g.eco].join(' ').toLowerCase().includes(term));const pages=Math.max(1,Math.ceil(filtered.length/10));state.page=Math.min(state.page,pages-1);$('results-label').textContent=filtered.length+' games found';$('game-list').replaceChildren();for(const game of filtered.slice(state.page*10,state.page*10+10)){const b=document.createElement('button');b.className='game-row';const detail=document.createElement('div'),title=document.createElement('b'),meta=document.createElement('small'),result=document.createElement('span');title.textContent=game.white+' — '+game.black;meta.textContent=[game.event,game.date,game.eco].filter(Boolean).join(' · ');result.textContent=game.result;detail.append(title,meta);b.append(detail,result);b.onclick=()=>{$('library').close();loadGame(game);};$('game-list').append(b);}$('page-label').textContent=(state.page+1)+' / '+pages;$('page-prev').disabled=state.page===0;$('page-next').disabled=state.page===pages-1;}
document.querySelectorAll('.nav').forEach(b=>b.onclick=()=>setMode(b.dataset.mode));
$('flip').onclick=()=>{state.flipped=!state.flipped;render();};$('reset').onclick=()=>state.mode==='bot'?newBot():loadPosition(0);
$('first').onclick=()=>loadPosition(0);$('prev').onclick=()=>loadPosition(Math.max(0,state.ply-1));$('next').onclick=()=>loadPosition(Math.min(state.record.moves.length,state.ply+1));$('last').onclick=()=>loadPosition(state.record.moves.length);
$('choose-game').onclick=()=>{renderLibrary();$('library').showModal();};$('close-library').onclick=()=>$('library').close();$('search').oninput=()=>{state.page=0;renderLibrary();};$('page-prev').onclick=()=>{state.page--;renderLibrary();};$('page-next').onclick=()=>{state.page++;renderLibrary();};
$('random-game').onclick=()=>loadGame(state.library[Math.floor(Math.random()*state.library.length)]);$('elo').oninput=()=>$('elo-value').textContent=$('elo').value;$('new-bot').onclick=newBot;
$('hint').onclick=()=>{const best=state.lines[0]?.pv[0];if(!best){message('Wait for the engine analysis, then try again.');return;}state.selected=best.slice(0,2);state.legal=state.chess.moves({square:state.selected,verbose:true}).filter(m=>m.to===best.slice(2,4));render();message('Engine suggestion: '+variation(state.chess.fen(),[best])+'. The highlighted piece and square show the idea.');};
render();
try{const response=await fetch('/data/games.json');if(!response.ok)throw new Error('Unable to load game library');state.library=await response.json();$('game-count').textContent=state.library.length.toLocaleString();loadGame(state.library.find(g=>g.white.includes('Fischer')&&g.black.includes('Spassky'))||state.library[0]);}catch(error){$('match-title').textContent='Library unavailable';message(error.message);}

$('vision-mode').onchange=()=>{$('board').classList.toggle('blindfold',$('vision-mode').checked);message($('vision-mode').checked?'Pieces hidden. Visualize the position and try a move, or uncheck to reveal.':'Pieces revealed.');};
$('download-pgn').onclick=()=>{const url=URL.createObjectURL(new Blob([state.record.pgn],{type:'application/x-chess-pgn'}));const a=document.createElement('a');a.href=url;a.download=state.record.id+'.pgn';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
