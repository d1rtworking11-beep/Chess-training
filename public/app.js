import { Chess } from '/vendor/chess.js';
import { Engine } from './engine.js';
import { CATEGORIES, SUMMARY_ORDER, reviewMove, buildTheory, summarize, comment, headline, label } from './review.js';
import { t, getLanguage, setLanguage, applyStatic, decimal, locale } from './i18n.js';
const $ = id => document.getElementById(id);
const pieces = {k:'♚',q:'♛',r:'♜',b:'♝',n:'♞',p:'♟'};
// Text on the page is rendered from this state, so switching language can redraw everything.
// reveal: how far the hint for the current position is shown (1 = piece, 2 = best move).
const state = {chess:new Chess(), mode:'practice', library:[], libraryError:null, record:null, recordMoves:[], ply:0, flipped:false, selected:null, legal:[], last:null, revision:0, busy:false, thinking:false, botToken:0, evaluation:null, lines:[], page:0, reviewRun:0, gameReview:null, progress:null, message:{key:'msg.selectPiece',params:{}}, analysis:null, shown:{kind:'empty'}, engine:'starting', bot:{elo:'1500',side:'w'}, reveal:{fen:null,step:0,wait:false}, linesOn:null,
  drill:{puzzles:null,loading:null,error:null,length:'any',current:null,side:'w',startFen:null,solution:[],index:0,left:0,status:'idle',phase:'turn',marks:{},history:[],auto:false,engineMode:false,usedHint:false,firstTry:true,run:0,recent:[],stats:{solved:0,attempts:0,streak:0,best:0}}};
const engine = new Engine();
const analyses = new Map(), reviews = new Map();
let theory = () => ({book:false, opening:null});
const openingsReady = fetch('/data/openings.json').then(response=>{if(!response.ok)throw new Error('Unable to load opening names');return response.json();}).then(data=>{theory=buildTheory(data);}).catch(()=>{});
engine.ready.then(() => { state.engine='ready'; renderEngineState(); }).catch(error => { state.engine=error; renderEngineState(); message('msg.error',{error}); showReview({kind:'error',error}); });
const errorText = error => error?.code ? t('error.'+error.code) : String(error?.message ?? error);
const engineName = () => t(engine.compat ? 'engine.compat' : 'engine.name');
// Engine lines and tips would give the move away while you are finding it yourself.
const hideLines = () => state.mode==='bot' || (state.mode==='drills' ? state.drill.status==='playing' : $('guess-mode').checked);
// While a drill is being solved the engine stays locked; otherwise the switch decides, defaulting to the mode's choice.
const drillLocked = () => state.mode==='drills' && state.drill.status==='playing';
const linesVisible = () => !drillLocked() && (state.linesOn ?? !hideLines());
// Your colour when you play against the bot or solve a drill; master games are told by colour instead.
const userSide = () => state.mode==='bot' ? state.bot.side : state.mode==='drills' ? state.drill.side : null;
const whoOf = move => userSide() ? (move.color===userSide()?'you':state.mode==='drills'?'opp':'bot') : move.color;
// The hint follows a drill's known solution until you leave it; otherwise the engine's best move.
const hintMove = () => { const d=state.drill; return state.mode==='drills'&&d.status==='playing'&&!d.engineMode ? d.solution[d.index] : state.lines[0]?.pv[0]; };
const moveLabel = move => move.before.split(' ')[5]+(move.color==='w'?'. ':'… ')+move.san;
const pieceSrc = (color, type) => '/pieces/'+color+type.toUpperCase()+'.svg';
function message(key, params={}) { state.message={key,params}; renderMessage(); }
function renderMessage() { const {key,params}=state.message,values={}; for(const [name,value] of Object.entries(params)) values[name]=value instanceof Error?errorText(value):value; $('board-message').textContent=t(key,values); }
function uciMove(chess, uci) { return chess.move({from:uci.slice(0,2),to:uci.slice(2,4),promotion:uci[4] || 'q'}); }
function whiteScore(line, turn) { const score = line.type === 'mate' ? Math.sign(line.score)*100000 : line.score; return (turn==='w'?1:-1)*score; }
function scoreText(line, turn) { if(line.type==='mate') return 'M'+((turn==='w'?1:-1)*line.score); return ((turn==='w'?1:-1)*line.score/100).toFixed(2).replace(/^(?=\d)/,'+'); }
// Move notation with small piece images for K, Q, R, B and N (the board's own piece set, so it looks the same everywhere).
function figurine(text){const out=document.createDocumentFragment();for(const part of text.split(/([KQRBN])/)){if(!part)continue;if(/^[KQRBN]$/.test(part)){const img=document.createElement('img');img.className='fig';img.src=pieceSrc('w',part.toLowerCase());img.alt=part;out.append(img);}else out.append(part);}return out;}
function variation(fen, moves) { const c=new Chess(fen); const out=[]; for(const move of moves.slice(0,5)) {try{out.push(uciMove(c,move).san);}catch{break;}} return out.join('  '); }
function clearSelection(){state.selected=null;state.legal=[];}
// Engine results are cached per position so live analysis and move reviews share work.
function getAnalysis(fen, time=500){ if(!analyses.has(fen)) analyses.set(fen, engine.analyze(fen,{time}).catch(error=>{analyses.delete(fen);throw error;})); return analyses.get(fen); }
const reviewKey = move => move.before+'|'+move.lan;
const reviewOf = move => move && reviews.get(reviewKey(move));
// line: the game's verbose moves from the start up to and including `move`.
async function getReview(move, previous, line, time=500){
  const key=reviewKey(move); if(reviews.has(key)) return reviews.get(key);
  const before=await getAnalysis(move.before,time), after=await getAnalysis(move.after,time);
  await openingsReady;
  const prevReview=reviewOf(previous);
  const prior=previous && {captured:previous.captured,to:previous.to,category:prevReview?.category};
  const {book,opening}=theory(line,prevReview);
  const review=reviewMove({Chess,move,before,after,previous:prior,book,opening});
  reviews.set(key,review); return review;
}
function badge(category, className='badge'){const info=CATEGORIES[category],name=label(category,getLanguage()),b=document.createElement('span');b.className=className;b.textContent=info.symbol;b.style.setProperty('--c',info.color);b.title=name;b.setAttribute('aria-label',name);return b;}
function moveList(){ return state.mode==='practice' && state.record ? state.recordMoves : state.chess.history({verbose:true}); }
function squareCenter(sq){ let f='abcdefgh'.indexOf(sq[0]), r=8-Number(sq[1]); if(state.flipped){f=7-f;r=7-r;} return [f+0.5,r+0.5]; }
function drawArrow(uci, kind=''){
  const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 8 8');svg.setAttribute('class','arrows'+(kind?' '+kind:''));svg.setAttribute('aria-hidden','true');
  const [x1,y1]=squareCenter(uci.slice(0,2)),[x2,y2]=squareCenter(uci.slice(2,4)),len=Math.hypot(x2-x1,y2-y1),ux=(x2-x1)/len,uy=(y2-y1)/len;
  const line=document.createElementNS(ns,'line');line.setAttribute('x1',x1+ux*0.15);line.setAttribute('y1',y1+uy*0.15);line.setAttribute('x2',x2-ux*0.32);line.setAttribute('y2',y2-uy*0.32);
  const head=document.createElementNS(ns,'polygon');const px=-uy,py=ux,bx=x2-ux*0.42,by=y2-uy*0.42;head.setAttribute('points',[[x2-ux*0.05,y2-uy*0.05],[bx+px*0.22,by+py*0.22],[bx-px*0.22,by-py*0.22]].map(p=>p.join(',')).join(' '));
  svg.append(line,head);return svg;
}
// While a piece is sliding, the board is not rebuilt; a rebuild asked for meanwhile runs when it lands.
const MOVE_MS=260, motion={until:0,pending:false,timer:0};
const reduceMotion = () => globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
function render(){ if(performance.now()<motion.until)motion.pending=true; else renderBoard(); renderPanel(); }
function renderBoard() {
  const c=state.chess,fen=c.fen(); const files=state.flipped?'hgfedcba':'abcdefgh'; const ranks=state.flipped?'12345678':'87654321';
  const lastReview=reviewOf(state.last),hint=state.reveal.fen===fen?state.reveal.step:0,best=hintMove();
  $('board').replaceChildren();
  for(const rank of ranks) for(const file of files){
    const sq=file+rank,p=c.get(sq),button=document.createElement('button');
    button.className='square'+((file.charCodeAt(0)+Number(rank))%2===0?' dark':'')+(p?' '+(p.color==='w'?'white-piece':'black-piece'):'')+(sq===state.selected?' selected':'')+(state.legal.some(m=>m.to===sq)?' legal':'')+(state.last && [state.last.from,state.last.to].includes(sq)?' last':'')+(hint&&best&&sq===best.slice(0,2)?' hint-from':'')+(p&&p.type==='k'&&p.color===c.turn()&&c.inCheck()?' check':'');
    button.dataset.square=sq;button.setAttribute('aria-label',sq+' '+t(p?'square.'+p.color+p.type:'square.empty'));
    if(p){const span=document.createElement('img');span.className='piece';span.src=pieceSrc(p.color,p.type);span.alt='';span.draggable=false;button.append(span);}
    if(file===files[7]){const label=document.createElement('span');label.className='coord rank';label.textContent=rank;button.append(label);}
    if(rank===ranks[7]){const label=document.createElement('span');label.className='coord file';label.textContent=file;button.append(label);}
    if(lastReview && sq===state.last.to) button.append(badge(lastReview.category));
    button.onclick=()=>clickSquare(sq);$('board').append(button);
  }
  // The hint arrow wins; otherwise show the better alternative to the last move, except for the bot's moves.
  if(hint>=2&&best) $('board').append(drawArrow(best,'hint'));
  else if(lastReview?.bestUci && (!userSide()||state.last.color===userSide())) $('board').append(drawArrow(lastReview.bestUci));
}
function renderPanel(){
  const c=state.chess;
  $('turn').textContent=c.isCheckmate()?t('turn.checkmate'):c.isDraw()?t('turn.draw'):t('turn.'+c.turn())+(c.isCheck()?t('turn.check'):'');
  const history=moveList();
  $('moves').replaceChildren();
  for(let i=0;i<history.length;i++){
    const m=history[i];
    // Drills start mid-game: numbers come from the position, and a Black first move leaves White's cell empty.
    if(m.color==='w'||i===0){const n=document.createElement('span');n.textContent=m.before.split(' ')[5];$('moves').append(n);if(m.color==='b'){const gap=document.createElement('span');gap.className='empty';gap.textContent='…';$('moves').append(gap);}}
    // Drills mark your moves right or wrong and outline the opponent's setup move; elsewhere each move shows its review badge.
    const b=document.createElement('button'),review=reviewOf(m),mark=state.mode==='drills'?state.drill.marks[i]:null;
    if(review&&state.mode!=='drills')b.append(badge(review.category,'mini'));b.append(figurine(m.san));
    if(mark){const sign=document.createElement('span');sign.className='mark '+mark;sign.textContent=mark==='ok'?'✓':'✗';b.append(sign);}
    b.className=(i===c.history().length-1?'current':'')+(state.mode==='drills'&&i===0?' start':'');
    b.disabled=state.mode!=='practice';b.onclick=()=>loadPosition(i+1);$('moves').append(b);
  }
  $('history-count').textContent=t('moves.count',{n:Math.ceil(history.length/2)});
  $('ply').textContent=t('ply',{n:c.moveNumber()});
  for(const id of ['first','prev','next','last']) $(id).disabled=state.mode!=='practice'||!state.record;
  $('prev').disabled ||= state.ply===0; $('first').disabled ||= state.ply===0;
  $('next').disabled ||= state.record && state.ply>=state.record.moves.length; $('last').disabled ||= state.record && state.ply>=state.record.moves.length;
  $('review-game').disabled=!history.length || state.gameReview?.running;
  drawGraph();renderHint();
}
// Slides the piece already drawn on its new square in from where it came; a fading copy shows a capture.
function animateMove(move, reverse=false){
  clearTimeout(motion.timer);motion.until=0;motion.pending=false;renderBoard();
  if(!move||reduceMotion())return;
  const square=sq=>$('board').querySelector('[data-square="'+sq+'"]');
  const slides=[reverse?[move.to,move.from]:[move.from,move.to]];
  if(move.flags.includes('k')||move.flags.includes('q')){const rank=move.color==='w'?'1':'8',rook=move.flags.includes('k')?['h'+rank,'f'+rank]:['a'+rank,'d'+rank];slides.push(reverse?[rook[1],rook[0]]:rook);}
  for(const [from,to] of slides){const target=square(to),source=square(from),img=target?.querySelector('.piece');if(!img||!source)continue;const a=source.getBoundingClientRect(),b=target.getBoundingClientRect();img.style.zIndex='6';img.animate([{transform:`translate(${a.left-b.left}px,${a.top-b.top}px)`},{transform:'none'}],{duration:MOVE_MS,easing:'cubic-bezier(.25,.8,.35,1)'}).finished.then(()=>{img.style.zIndex='';},()=>{});}
  if(move.captured){
    const cell=square(move.flags.includes('e')?move.to[0]+move.from[1]:move.to);
    if(cell&&reverse)cell.querySelector('.piece')?.animate([{opacity:0,transform:'scale(.6)'},{opacity:1,transform:'none'}],{duration:MOVE_MS,easing:'ease-out'});
    else if(cell){const ghost=document.createElement('img');ghost.className='piece ghost';ghost.src=pieceSrc(move.color==='w'?'b':'w',move.captured);ghost.alt='';cell.prepend(ghost);ghost.animate([{opacity:1,transform:'none'},{opacity:0,transform:'scale(.55)'}],{duration:MOVE_MS,easing:'ease-in',fill:'forwards'}).finished.then(()=>ghost.remove(),()=>ghost.remove());}
  }
  motion.until=performance.now()+MOVE_MS;motion.timer=setTimeout(()=>{motion.until=0;if(motion.pending){motion.pending=false;renderBoard();}},MOVE_MS+20);
}
// view: {kind:'empty'} | {kind:'error',error} | {kind:'pending'|'review',line}; line = the game's moves so far.
function showReview(view){ state.shown=view; renderReview(); }
function renderReview(){
  const view=state.shown,card=$('review-card'),lang=getLanguage();card.style.removeProperty('--c');$('review-meta').replaceChildren();$('review-who').textContent='';
  const symbol=$('review-badge');symbol.textContent='·';symbol.style.removeProperty('--c');symbol.classList.remove('pending');
  renderPrevious(view.line);
  if(view.kind==='error'){$('review-title').textContent=t('review.unavailable');$('review-text').textContent=errorText(view.error);return;}
  if(view.kind==='empty'){$('review-title').textContent=t('review.makeMove');$('review-text').textContent=t('review.intro');return;}
  const move=view.line.at(-1),review=reviewOf(move);
  $('review-who').textContent=t('who.'+whoOf(move))+' · '+moveLabel(move);
  if(!review){symbol.classList.add('pending');symbol.textContent='…';$('review-title').textContent=t('review.pendingTitle',{san:move.san});$('review-text').textContent=t('review.pendingText');return;}
  card.style.setProperty('--c',review.color);symbol.textContent=review.symbol;symbol.style.setProperty('--c',review.color);
  $('review-title').textContent=headline(review,lang);
  $('review-text').textContent=comment(review,lang,{who:whoOf(move),previous:reviewOf(view.line.at(-3))});
  const chip=text=>{const s=document.createElement('span');s.className='chip';s.textContent=text;$('review-meta').append(s);};
  chip(t('chip.eval',{change:review.evalBefore+' → '+review.evalAfter}));chip(t('chip.accuracy',{value:Math.round(review.accuracy)}));if(review.bestUci)chip(t('chip.best',{move:review.bestSan}));
}
// The move before the latest stays visible, so your move's comment survives the bot's reply.
function renderPrevious(line){
  const box=$('review-previous'),move=line?.at(-2),review=reviewOf(move);
  box.classList.toggle('hidden',!review);
  if(!review){box.replaceChildren();return;}
  const lang=getLanguage(),body=document.createElement('div'),who=document.createElement('small'),title=document.createElement('b'),text=document.createElement('p');
  who.className='review-who';who.textContent=t('who.'+whoOf(move))+' · '+moveLabel(move);title.textContent=headline(review,lang);text.textContent=comment(review,lang,{who:whoOf(move),previous:reviewOf(line.at(-4))});
  body.append(who,title,text);box.replaceChildren(badge(review.category,'mini'),body);
}
async function reviewLast(){
  const history=state.chess.history({verbose:true}),move=history.at(-1);
  if(!move){showReview({kind:'empty'});return;}
  const key=reviewKey(move),current=()=>state.last&&reviewKey(state.last)===key;
  showReview({kind:reviews.has(key)?'review':'pending',line:history});
  try{
    await getReview(move,history.at(-2),history);if(current()){renderReview();render();}
    const previous=history.at(-2);
    if(previous&&!reviews.has(reviewKey(previous))){await getReview(previous,history.at(-3),history.slice(0,-1));if(current()){renderReview();render();}}
  }catch(error){if(current())showReview({kind:'error',error});}
}
async function clickSquare(sq){
  if(state.busy||state.chess.isGameOver())return;
  if(state.mode==='bot'&&state.chess.turn()!==$('side').value)return;
  if(state.mode==='drills'&&state.drill.status==='playing'&&state.chess.turn()!==state.drill.side)return;
  const move=state.legal.find(m=>m.to===sq);
  if(move){let promotion='q';if(move.flags.includes('p'))promotion=await choosePromotion();await playMove({from:state.selected,to:sq,promotion});return;}
  const p=state.chess.get(sq);if(p&&p.color===state.chess.turn()){state.selected=sq;state.legal=state.chess.moves({square:sq,verbose:true});}else clearSelection();render();
}
function choosePromotion(){return new Promise(resolve=>{$('promotion-options').replaceChildren();for(const piece of ['q','r','b','n']){const b=document.createElement('button');b.textContent=pieces[piece];b.setAttribute('aria-label',t('piece.'+piece));b.onclick=()=>{$('promotion').close();resolve(piece);};$('promotion-options').append(b);}$('promotion').oncancel=e=>e.preventDefault();$('promotion').showModal();});}
async function playMove(move){
  let made;const movedAt=performance.now();
  try{made=state.chess.move(move);}catch{return;}
  state.last=made;clearSelection();
  if(state.mode==='bot'&&state.gameReview)resetGameReview();
  if(state.mode==='practice'&&state.record){const expected=state.record.moves[state.ply];if($('guess-mode').checked){if(made.san===expected)message('msg.correct',{move:expected});else message('msg.differs',{played:made.san,expected});}else message('msg.exploring',{move:made.san});if(made.san===expected)state.ply++;}
  render();animateMove(made);
  if(state.mode==='drills'&&state.drill.status==='playing'){await drillMove(made);return;}
  const analysis=analyze();reviewLast();await analysis;
  if(state.mode==='bot'&&state.chess.isGameOver())message('msg.gameOver');
  if(state.mode==='bot'&&!state.chess.isGameOver()&&state.chess.turn()!==$('side').value)await botMove(movedAt);
}
async function analyze(){
  const revision=++state.revision,fen=state.chess.fen();state.evaluation=null;state.lines=[];state.analysis={status:'loading'};renderAnalysis();
  try{
    const result=await getAnalysis(fen);if(revision!==state.revision)return;
    const first=result.lines[0];state.lines=result.lines;
    if(first)state.evaluation=whiteScore(first,state.chess.turn());
    state.analysis={status:first?'ready':'none',fen,turn:state.chess.turn(),lines:result.lines,check:state.chess.isCheck(),over:state.chess.isGameOver()};renderAnalysis();
    // A hint asked for before the engine finished appears as soon as it has.
    if(state.reveal.fen===fen&&state.reveal.wait&&first){state.reveal.wait=false;state.reveal.step=1;render();}else renderHint();
  }catch(error){if(revision===state.revision){state.analysis={status:'error',error};renderAnalysis();message('msg.error',{error});}}
}
function renderAnalysis(){
  const a=state.analysis,visible=linesVisible(),locked=drillLocked(),toggle=$('engine-toggle');
  toggle.checked=visible;toggle.disabled=locked;
  $('score').parentElement.classList.toggle('hidden',state.mode==='drills'&&!visible);
  if(!a)return;
  if(a.status==='loading'){$('engine-state').textContent=t('engine.analyzing');return;}
  if(a.status==='error'){$('engine-state').textContent=t('engine.unavailable');$('tip').textContent=errorText(a.error);return;}
  if(a.status==='none'){$('engine-state').textContent=t(a.over?'engine.gameOver':'engine.none');$('score').textContent='—';$('advantage').textContent='';$('lines').replaceChildren();return;}
  const first=a.lines[0],cp=whiteScore(first,a.turn);
  $('score').textContent=scoreText(first,a.turn);
  // A drill's evaluation bar stays level until the puzzle ends, so it can't hint at the answer.
  $('eval-fill').style.height=locked?'50%':(50+45*Math.tanh(cp/500))+'%';$('eval-number').textContent=locked?'':$('score').textContent;
  $('advantage').textContent=t(Math.abs(cp)<35?'analysis.balanced':cp>0?'analysis.whiteBetter':'analysis.blackBetter');
  $('engine-state').textContent=t('engine.depth',{name:engineName(),depth:first.depth});$('lines').replaceChildren();
  let tip;
  if(!visible){const note=document.createElement('p');note.className='lines-off';note.textContent=t(locked?'analysis.locked':'analysis.off');$('lines').append(note);tip=t('coach.default');}
  else{
    a.lines.forEach((line,i)=>{const div=document.createElement('div');div.className='line';const score=document.createElement('span');score.className='line-score';score.textContent=scoreText(line,a.turn);const pv=document.createElement('span');pv.className='variation';const text=variation(a.fen,line.pv);pv.append(figurine(text));pv.title=text;const tag=document.createElement('small');tag.textContent=t(i===0?'line.best':'line.alt');div.append(score,pv,tag);$('lines').append(div);});
    tip=t('tip.consider',{move:variation(a.fen,first.pv.slice(0,1))});
  }
  $('tip').textContent=a.check?t('tip.check')+' '+tip:tip;
}
function renderEngineState(){
  if(state.engine instanceof Error){$('engine-state').textContent=t('engine.unavailable');return;}
  if(state.analysis){renderAnalysis();return;}
  if(state.engine==='ready')$('engine-state').textContent=engineName();
}
// Hint in steps: first the piece to move, then the best move, then hidden again.
function renderHint(){
  const c=state.chess,fen=c.fen(),reveal=state.reveal.fen===fen?state.reveal:{step:0,wait:false},best=hintMove();
  const botTurn=state.busy||(state.mode==='bot'&&(c.turn()!==state.bot.side||state.thinking));
  $('hint').disabled=botTurn||c.isGameOver();$('hint').title=botTurn?t('hint.botTurn'):'';
  $('hint-label').textContent=t(['hint.button','hint.best','hint.hide'][reveal.step]);
  let text='';
  if(reveal.step&&best){const from=best.slice(0,2);text=reveal.step===1?t('hint.piece',{piece:t('pieceName.'+c.get(from).type),square:from}):t('hint.move',{move:variation(fen,[best])});}
  else if(reveal.wait&&!best)text=t('msg.waitEngine');
  $('hint-text').textContent=text;
}
function stopBot(){state.botToken++;state.busy=false;state.thinking=false;$('board-message').classList.remove('thinking');}
// The bot replies 3–5 seconds after your move, however quickly the engine finds it.
async function botMove(since=performance.now()){
  if(state.busy||state.chess.isGameOver())return;
  const token=++state.botToken,revision=state.revision,fen=state.chess.fen(),readyAt=since+3000+Math.random()*2000;
  state.busy=true;state.thinking=true;message('msg.botThinking');$('board-message').classList.add('thinking');renderHint();
  try{const elo=Number($('elo').value);const result=await engine.analyze(fen,{elo,time:elo>=2500?1200:400});
    const wait=readyAt-performance.now();if(wait>0)await new Promise(resolve=>setTimeout(resolve,wait));
    if(revision!==state.revision||state.chess.fen()!==fen)return;
    let move=result.best;const legal=state.chess.moves({verbose:true});
    // Below Stockfish's minimum Elo, add legal random moves to approximate a beginner.
    if(elo<1320 && Math.random()<(1320-elo)/1200){const pick=legal[Math.floor(Math.random()*legal.length)];move=pick.from+pick.to+(pick.promotion||'');}
    if(move&&move!=='(none)'){state.last=uciMove(state.chess,move);state.thinking=false;$('board-message').classList.remove('thinking');render();animateMove(state.last);message(state.chess.isGameOver()?'msg.botPlayedOver':'msg.botPlayed',{move:state.last.san});const analysis=analyze();reviewLast();await analysis;}
  }catch(error){message('msg.retry',{error});}
  finally{if(token===state.botToken){state.busy=false;state.thinking=false;$('board-message').classList.remove('thinking');renderHint();}}
}
function loadPosition(ply){
  if(!state.record)return;
  const from=state.chess.history().length===state.ply?state.ply:null;
  stopBot();state.revision++;state.chess=new Chess();for(const move of state.record.moves.slice(0,ply))state.chess.move(move);state.ply=ply;state.last=state.chess.history({verbose:true}).at(-1)||null;clearSelection();render();
  if(from!==null&&ply===from+1)animateMove(state.last);else if(from!==null&&ply===from-1)animateMove(state.recordMoves[ply],true);
  message('msg.find.'+state.chess.turn());analyze();reviewLast();
}
function resetGameReview(){state.reviewRun++;state.gameReview=null;state.progress=null;$('review-progress').classList.add('hidden');$('review-summary').classList.add('hidden');}
function renderPlayers(){
  if(state.mode==='drills'){const you=state.drill.side,them=you==='w'?'b':'w',name=color=>color==='w'?'white':'black';$(name(you)+'-name').textContent=t('player.you');$(name(them)+'-name').textContent=t('drill.opponent');$(name(you)+'-detail').textContent=t('drill.findMate');$(name(them)+'-detail').textContent=t('drill.defends');return;}
  if(state.mode==='bot'){const {elo,side}=state.bot;$('black-name').textContent=side==='w'?t('bot.name',{elo}):t('player.you');$('white-name').textContent=side==='b'?t('bot.name',{elo}):t('player.you');$('black-detail').textContent=t('player.practice');$('white-detail').textContent=t('player.coaching');return;}
  const r=state.record;if(!r)return;
  $('black-name').textContent=r.black;$('white-name').textContent=r.white;
  $('black-detail').textContent=r.blackElo?t('player.elo',{elo:r.blackElo}):t('player.masterGame');$('white-detail').textContent=r.whiteElo?t('player.elo',{elo:r.whiteElo}):t('player.findNext');
}
function renderGameInfo(){
  const r=state.record;
  if(r){$('match-title').textContent=t('game.vs',{white:r.white,black:r.black});$('match-meta').textContent=[r.event,r.date,r.result].join(' · ');}
  else if(state.libraryError)$('match-title').textContent=t('game.unavailable');
}
function loadGame(record){resetGameReview();state.record=record;const replay=new Chess();state.recordMoves=record.moves.map(m=>replay.move(m));$('source-link').href=record.source;renderGameInfo();renderPlayers();loadPosition(Math.min(16,record.moves.length-1));}
function newBot(){resetGameReview();stopBot();state.revision++;state.chess=new Chess();state.last=null;state.ply=0;clearSelection();state.bot={elo:$('elo').value,side:$('side').value};state.flipped=state.bot.side==='b';renderPlayers();render();showReview({kind:'empty'});message('msg.newGame.'+state.bot.side);analyze().then(()=>{if(state.mode==='bot'&&state.chess.turn()!==$('side').value)botMove();});}
function renderModeText(){const m=state.mode,em=document.createElement('em'),count=m==='drills'?state.drill.puzzles?.length:state.library.length;$('game-count').textContent=count?count.toLocaleString(locale()):'…';$('game-count').nextElementSibling.textContent=t(m==='drills'?'intro.countDrills':'intro.count');$('crumb').textContent=t('nav.'+m);em.textContent=t('mode.'+m+'.titleEm');$('title').replaceChildren(t('mode.'+m+'.title')+' ',em);$('subtitle').textContent=t('mode.'+m+'.subtitle');}
function setMode(mode,puzzleId=null){state.mode=mode;state.drill.run++;$('board').classList.toggle('blindfold',(mode==='practice'&&$('vision-mode').checked)||(mode==='drills'&&$('drill-vision').checked));document.querySelectorAll('.nav').forEach(b=>b.classList.toggle('active',b.dataset.mode===mode));$('practice-settings').classList.toggle('hidden',mode!=='practice');$('bot-settings').classList.toggle('hidden',mode!=='bot');$('main').classList.toggle('drills',mode==='drills');for(const id of ['drill-side','drill-feedback','drill-history'])$(id).classList.toggle('hidden',mode!=='drills');state.linesOn=null;renderModeText();if(mode==='bot')newBot();else if(mode==='drills')openDrills(puzzleId);else{state.flipped=false;if(state.record)loadGame(state.record);}}
// Checkmate drills: random mate-in-3/4/5 positions from the Lichess puzzle database (public/data/puzzles.json).
// A puzzle is [id, fen, moves, rating, n, plays, game]: the first move is the opponent's, then you mate in n moves.
const DRILL_KEY='openchess.drills',AUTO_KEY='openchess.drillAuto';
function loadDrillAuto(){try{return localStorage.getItem(AUTO_KEY)==='1';}catch{return false;}}
function saveDrillAuto(){try{localStorage.setItem(AUTO_KEY,state.drill.auto?'1':'0');}catch{}}
function loadDrillStats(){try{return {...state.drill.stats,...JSON.parse(localStorage.getItem(DRILL_KEY)||'{}')};}catch{return state.drill.stats;}}
function saveDrillStats(){try{localStorage.setItem(DRILL_KEY,JSON.stringify(state.drill.stats));}catch{}}
function loadPuzzles(){
  state.drill.loading||=fetch('/data/puzzles.json').then(response=>{if(!response.ok)throw Object.assign(new Error('Unable to load the checkmate positions'),{code:'puzzles'});return response.json();}).then(data=>{state.drill.puzzles=data.puzzles;state.drill.error=null;}).catch(error=>{state.drill.error=error;state.drill.loading=null;throw error;});
  return state.drill.loading;
}
async function openDrills(id){
  stopBot();state.revision++;resetGameReview();renderDrill();
  try{await loadPuzzles();}catch{renderDrill();return;}
  renderModeText();
  if(state.mode==='drills')startDrill(state.drill.puzzles.find(p=>p[0]===id));
}
function pickPuzzle(){
  const d=state.drill,fits=p=>d.length==='any'||p[4]===Number(d.length),fresh=d.puzzles.filter(p=>fits(p)&&!d.recent.includes(p[0]));
  const pool=fresh.length?fresh:d.puzzles.filter(fits),pick=pool[Math.floor(Math.random()*pool.length)];
  d.recent=[pick[0],...d.recent].slice(0,200);return pick;
}
function startDrill(puzzle=null,retry=false){
  const d=state.drill;if(!d.puzzles)return;puzzle||=pickPuzzle();
  const [,fen,moves,,n]=puzzle,list=moves.split(' '),run=++d.run;
  stopBot();state.revision++;resetGameReview();clearSelection();
  Object.assign(d,{current:puzzle,solution:list.slice(1),index:0,left:n,status:'playing',phase:'turn',marks:{},engineMode:false,usedHint:false,firstTry:!retry});
  state.chess=new Chess(fen);state.last=null;state.busy=true;state.lines=[];
  d.side=state.chess.turn()==='w'?'b':'w';state.flipped=d.side==='b';
  renderPlayers();showReview({kind:'empty'});renderDrill();render();
  // Show the position, then the opponent's last move sliding in.
  setTimeout(()=>{if(run!==d.run||state.mode!=='drills')return;state.last=uciMove(state.chess,list[0]);d.startFen=state.chess.fen();state.busy=false;render();animateMove(state.last);message('drill.prompt',{n,move:state.last.san});analyze();},450);
}
const retryDrill=()=>{if(state.drill.current)startDrill(state.drill.current,true);};
async function drillMove(made){
  const d=state.drill,run=d.run,ply=state.chess.history().length-1;d.left--;
  if(state.chess.isCheckmate()){d.marks[ply]='ok';finishDrill(true);analyze();reviewLast();return;}
  let reply;
  if(!d.engineMode&&made.lan===d.solution[d.index]){reply=d.solution[d.index+1];d.index+=2;}
  else{
    // Another move still counts if the engine confirms it forces mate within the moves left.
    state.busy=true;d.phase='checking';renderDrill();message('drill.checking');render();
    let result;try{result=await getAnalysis(state.chess.fen(),1500);}catch(error){if(run===d.run){state.busy=false;message('msg.error',{error});render();}return;}
    if(run!==d.run||state.mode!=='drills')return;
    const line=result.lines[0],mateIn=line?.type==='mate'&&line.score<0?-line.score:null;
    if(mateIn===null||mateIn>d.left){d.marks[ply]='fail';finishDrill(false,{move:made.san,slow:mateIn!==null});analyze();reviewLast();return;}
    d.engineMode=true;reply=line.pv[0];
  }
  d.marks[ply]='ok';d.phase='good';state.busy=true;renderDrill();message('drill.correct',{n:d.left});analyze();reviewLast();render();
  await new Promise(resolve=>setTimeout(resolve,700));
  if(run!==d.run||state.mode!=='drills')return;
  state.last=uciMove(state.chess,reply);state.busy=false;d.phase='turn';renderDrill();render();animateMove(state.last);message('drill.yourMove',{n:d.left,move:state.last.san});analyze();reviewLast();
}
function finishDrill(solved,{move,slow,gaveUp}={}){
  const d=state.drill,stats=d.stats;d.status=d.phase=solved?'solved':'failed';const run=++d.run;state.busy=false;
  // Only the first try at a position counts; a hint keeps the streak from growing.
  if(d.firstTry){stats.attempts++;if(solved){stats.solved++;if(!d.usedHint){stats.streak++;stats.best=Math.max(stats.best,stats.streak);}}else stats.streak=0;saveDrillStats();d.history=[...d.history,{puzzle:d.current,result:solved?(d.usedHint?'hint':'ok'):'fail'}].slice(-24);}
  d.firstTry=false;
  const line=formatLine(d.startFen,d.solution);
  if(solved)message(d.usedHint?'drill.solvedHint':'drill.solved',{n:d.current[4]-d.left});
  else message(gaveUp?'drill.gaveUp':slow?'drill.slow':'drill.failed',{move,line});
  renderDrill();renderAnalysis();render();
  if(solved&&d.auto)setTimeout(()=>{if(run===d.run&&state.mode==='drills')startDrill();},1500);
}
function formatLine(fen,ucis){const c=new Chess(fen),out=[];ucis.forEach((uci,i)=>{const m=uciMove(c,uci),number=m.before.split(' ')[5];out.push(m.color==='w'?number+'. '+m.san:(i===0?number+'… ':'')+m.san);});return out.join(' ');}
async function showSolution(){
  const d=state.drill;if(!d.startFen)return;const run=++d.run;d.marks={};
  stopBot();state.revision++;state.chess=new Chess(d.startFen);state.last=null;state.busy=true;clearSelection();showReview({kind:'empty'});render();
  for(const uci of d.solution){await new Promise(resolve=>setTimeout(resolve,850));if(run!==d.run||state.mode!=='drills')return;state.last=uciMove(state.chess,uci);render();animateMove(state.last);}
  state.busy=false;analyze();reviewLast();render();
}
function renderDrill(){
  const d=state.drill,p=d.current,icon=$('drill-icon'),finished=d.status==='solved'||d.status==='failed';
  $('drill-count').textContent=d.puzzles?t('drill.count',{n:d.puzzles.length}):'';
  for(const b of document.querySelectorAll('[data-length]'))b.setAttribute('aria-pressed',String(b.dataset.length===String(d.length)));
  $('drill-solved').textContent=d.stats.solved;$('drill-streak').textContent=d.stats.streak;$('drill-best').textContent=d.stats.best;$('drill-auto').checked=d.auto;
  renderDrillHistory();icon.className='feedback-icon';
  if(d.error&&!d.puzzles){$('drill-heading').textContent=t('drill.unavailable');$('drill-title').textContent=errorText(d.error);$('drill-status').textContent='';return;}
  if(!p){$('drill-heading').textContent=t('drill.loading');$('drill-title').textContent='';$('drill-status').textContent='';return;}
  $('drill-heading').textContent=t({good:'drill.goodMove',checking:'drill.checkingHead',solved:'drill.success',failed:'drill.failedHead'}[d.phase]||'drill.yourTurn');
  if(d.phase==='solved'||d.phase==='good'){icon.classList.add('ok');icon.textContent='✓';}else if(d.phase==='failed'){icon.classList.add('fail');icon.textContent='✗';}else icon.textContent=d.side==='w'?'♔':'♚';
  $('drill-title').textContent=t('drill.title.'+d.side,{n:p[4]});
  $('drill-status').dataset.state=d.status;$('drill-status').textContent=d.status==='solved'?t('drill.statusSolved'):d.status==='failed'?t('drill.statusFailed'):t('drill.left',{n:d.left});
  $('drill-next').classList.toggle('hidden',!finished);$('drill-retry').classList.toggle('hidden',!finished);
  $('drill-source').href='https://lichess.org/training/'+p[0];$('drill-source').textContent=t('drill.source',{id:p[0]});
  $('drill-rating').textContent=t('drill.rating',{rating:p[3]});$('drill-plays').textContent=p[5]?t('drill.plays',{n:p[5]}):'';
  $('drill-game').href=p[6]?'https://lichess.org/'+p[6]:'https://lichess.org/training/'+p[0];$('drill-length-info').textContent=t('drill.mateLine',{n:p[4]});
}
// Results of this session under the board, like a streak bar; click one to try that position again.
function renderDrillHistory(){
  const d=state.drill,box=$('drill-history');box.replaceChildren();
  for(const item of d.history){const chip=document.createElement('button');chip.type='button';chip.className='chip-'+item.result;chip.textContent=item.result==='fail'?'✗':'✓';chip.title=t('drill.source',{id:item.puzzle[0]});chip.onclick=()=>startDrill(item.puzzle,true);box.append(chip);}
  if(d.current&&d.status==='playing'){const now=document.createElement('span');now.className='chip-now';now.setAttribute('aria-hidden','true');box.append(now);}
}
// Full-game review: rates every move in order, then shows accuracy, a tally and an evaluation graph.
async function reviewGame(){
  const moves=moveList();if(!moves.length)return;
  const run=++state.reviewRun,results=[];state.gameReview={running:true,moves,results};
  $('review-summary').classList.add('hidden');$('review-progress').classList.remove('hidden');render();
  for(let i=0;i<moves.length;i++){
    if(run!==state.reviewRun)return;
    state.progress={key:'review.progress',params:{move:(Math.floor(i/2)+1)+(i%2?'…':'.'),i:i+1,n:moves.length}};renderProgress();$('review-progress-fill').style.width=(100*i/moves.length)+'%';
    try{results.push(await getReview(moves[i],moves[i-1],moves.slice(0,i+1),350));}
    catch(error){if(run===state.reviewRun){state.progress={key:'review.stopped',params:{error}};renderProgress();state.gameReview.running=false;render();}return;}
    if(run!==state.reviewRun)return;
    if(i%6===5)render();
  }
  state.gameReview.running=false;state.progress=null;$('review-progress').classList.add('hidden');renderSummary();render();
  if(state.last&&reviewOf(state.last))showReview({kind:'review',line:state.chess.history({verbose:true})});
}
function renderProgress(){if(!state.progress)return;const {key,params}=state.progress;$('review-progress-label').textContent=t(key,{...params,error:params.error&&errorText(params.error)});}
function renderSummary(){
  const {results}=state.gameReview,sides=summarize(results),lang=getLanguage();
  const names=state.mode==='practice'&&state.record?{w:state.record.white,b:state.record.black}:{w:$('white-name').textContent,b:$('black-name').textContent};
  $('accuracy-white').textContent=sides.w.accuracy==null?'—':decimal(sides.w.accuracy,1);$('accuracy-black').textContent=sides.b.accuracy==null?'—':decimal(sides.b.accuracy,1);
  $('name-white').textContent=names.w;$('name-black').textContent=names.b;
  const opening=results.at(-1)?.opening;$('review-opening').textContent=opening?t('review.opening',{name:opening}):'';
  const table=$('tally');table.replaceChildren();
  for(const key of SUMMARY_ORDER){const row=document.createElement('div');row.className='tally-row';const w=document.createElement('b'),b=document.createElement('b'),name=document.createElement('span');w.textContent=sides.w.tally[key]||0;b.textContent=sides.b.tally[key]||0;name.append(badge(key,'mini'),label(key,lang));if(!sides.w.tally[key]&&!sides.b.tally[key])row.classList.add('zero');row.append(w,name,b);table.append(row);}
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
  results.forEach((r,i)=>{if(!['brilliant','great','inaccuracy','mistake','miss','blunder'].includes(r.category))return;const dot=document.createElementNS(ns,'circle');dot.setAttribute('cx',points[i+1][0]);dot.setAttribute('cy',points[i+1][1]);dot.setAttribute('r',2.6);dot.setAttribute('fill',r.color);dot.setAttribute('class','graph-dot');const title=document.createElementNS(ns,'title');title.textContent=(Math.floor(i/2)+1)+(i%2?'… ':'. ')+r.san+' · '+label(r.category,getLanguage());dot.append(title);svg.append(dot);});
  svg.classList.toggle('clickable',state.mode==='practice');
}
$('eval-graph').onclick=event=>{if(state.mode!=='practice'||!state.gameReview)return;const box=$('eval-graph').getBoundingClientRect();const n=state.gameReview.results.length;loadPosition(Math.max(0,Math.min(n,Math.round(n*(event.clientX-box.left)/box.width))));};
$('review-game').onclick=reviewGame;
function renderLibrary(){const term=$('search').value.toLowerCase();const filtered=state.library.filter(g=>[g.white,g.black,g.event,g.date,g.eco].join(' ').toLowerCase().includes(term));const pages=Math.max(1,Math.ceil(filtered.length/10));state.page=Math.min(state.page,pages-1);$('results-label').textContent=t('library.found',{n:filtered.length});$('game-list').replaceChildren();for(const game of filtered.slice(state.page*10,state.page*10+10)){const b=document.createElement('button');b.className='game-row';const detail=document.createElement('div'),title=document.createElement('b'),meta=document.createElement('small'),result=document.createElement('span');title.textContent=game.white+' — '+game.black;meta.textContent=[game.event,game.date,game.eco].filter(Boolean).join(' · ');result.textContent=game.result;detail.append(title,meta);b.append(detail,result);b.onclick=()=>{$('library').close();loadGame(game);};$('game-list').append(b);}$('page-label').textContent=(state.page+1)+' / '+pages;$('page-prev').disabled=state.page===0;$('page-next').disabled=state.page===pages-1;}
// Redraws every piece of text in the current language.
function refreshLanguage(){
  applyStatic();
  for(const b of document.querySelectorAll('[data-lang]'))b.setAttribute('aria-pressed',String(b.dataset.lang===getLanguage()));
  renderModeText();renderPlayers();renderGameInfo();renderMessage();renderEngineState();renderReview();renderProgress();renderDrill();
  if(state.gameReview&&!state.gameReview.running)renderSummary();
  if($('library').open)renderLibrary();
  render();
}
document.querySelectorAll('[data-lang]').forEach(b=>b.onclick=()=>{if(setLanguage(b.dataset.lang))refreshLanguage();});
document.querySelectorAll('.nav').forEach(b=>b.onclick=()=>setMode(b.dataset.mode));
$('flip').onclick=()=>{state.flipped=!state.flipped;render();};$('reset').onclick=()=>state.mode==='bot'?newBot():state.mode==='drills'?retryDrill():loadPosition(0);
$('first').onclick=()=>loadPosition(0);$('prev').onclick=()=>loadPosition(Math.max(0,state.ply-1));$('next').onclick=()=>loadPosition(Math.min(state.record.moves.length,state.ply+1));$('last').onclick=()=>loadPosition(state.record.moves.length);
$('choose-game').onclick=()=>{renderLibrary();$('library').showModal();};$('close-library').onclick=()=>$('library').close();$('search').oninput=()=>{state.page=0;renderLibrary();};$('page-prev').onclick=()=>{state.page--;renderLibrary();};$('page-next').onclick=()=>{state.page++;renderLibrary();};
$('random-game').onclick=()=>loadGame(state.library[Math.floor(Math.random()*state.library.length)]);$('elo').oninput=()=>$('elo-value').textContent=$('elo').value;$('new-bot').onclick=newBot;
$('hint').onclick=()=>{const fen=state.chess.fen();if(state.reveal.fen!==fen)state.reveal={fen,step:0,wait:false};if(!hintMove()){state.reveal.wait=true;renderHint();return;}state.reveal.step=(state.reveal.step+1)%3;if(state.mode==='drills'&&state.drill.status==='playing'&&state.reveal.step)state.drill.usedHint=true;render();};
$('drill-next').onclick=()=>startDrill();$('drill-retry').onclick=retryDrill;
// Viewing the solution during a drill counts as a miss, as on most puzzle sites.
$('drill-solution').onclick=()=>{if(state.drill.status==='playing'&&state.drill.startFen)finishDrill(false,{gaveUp:true});showSolution();};
$('drill-auto').onchange=()=>{state.drill.auto=$('drill-auto').checked;saveDrillAuto();};
$('engine-toggle').onchange=()=>{state.linesOn=$('engine-toggle').checked;renderAnalysis();};
document.querySelectorAll('[data-length]').forEach(b=>b.onclick=()=>{state.drill.length=b.dataset.length;renderDrill();if(state.drill.puzzles)startDrill();});
$('drill-vision').onchange=()=>$('board').classList.toggle('blindfold',$('drill-vision').checked);
$('guess-mode').onchange=()=>renderAnalysis();
state.drill.stats=loadDrillStats();state.drill.auto=loadDrillAuto();
refreshLanguage();
try{const response=await fetch('/data/games.json');if(!response.ok)throw Object.assign(new Error('Unable to load game library'),{code:'library'});state.library=await response.json();$('game-count').textContent=state.library.length.toLocaleString(locale());loadGame(state.library.find(g=>g.white.includes('Fischer')&&g.black.includes('Spassky'))||state.library[0]);}catch(error){state.libraryError=error;renderGameInfo();message('msg.error',{error});}
// A #drill-<puzzle id> link opens that position in the checkmate drill.
const drillLink=/^#drill-([A-Za-z0-9]+)$/.exec(location.hash);if(drillLink)setMode('drills',drillLink[1]);

$('vision-mode').onchange=()=>{$('board').classList.toggle('blindfold',$('vision-mode').checked);message($('vision-mode').checked?'msg.piecesHidden':'msg.piecesShown');};
$('download-pgn').onclick=()=>{const url=URL.createObjectURL(new Blob([state.record.pgn],{type:'application/x-chess-pgn'}));const a=document.createElement('a');a.href=url;a.download=state.record.id+'.pgn';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
