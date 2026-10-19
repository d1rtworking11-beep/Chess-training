// Builds a fully static copy of OpenChess in artifact/ for hosts without the
// Express server (relative paths, engine and chess.js copied in, no file downloads).
import {cpSync, mkdirSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
const out = 'artifact';
const replaceOnce = (text, from, to) => { if (!text.includes(from)) throw new Error('Pattern not found: ' + from); return text.replace(from, to); };
rmSync(out, {recursive: true, force: true});
mkdirSync(out + '/engine', {recursive: true});
mkdirSync(out + '/vendor', {recursive: true});
cpSync('public/data', out + '/data', {recursive: true});
cpSync('public/pieces', out + '/pieces', {recursive: true});
cpSync('public/style.css', out + '/style.css');
cpSync('public/review.js', out + '/review.js');
cpSync('LICENSE', out + '/LICENSE.txt');
cpSync('node_modules/stockfish/bin/stockfish-19-lite-single.js', out + '/engine/stockfish-19-lite-single.js');
cpSync('node_modules/stockfish/bin/stockfish-19-lite-single.wasm', out + '/engine/stockfish-19-lite-single.wasm');
cpSync('node_modules/stockfish/bin/stockfish-19-asm.js', out + '/engine/stockfish-19-asm.js');
cpSync('node_modules/stockfish/Copying.txt', out + '/engine/STOCKFISH-COPYING.txt');
cpSync('node_modules/chess.js/dist/esm/chess.js', out + '/vendor/chess.js');
cpSync('node_modules/chess.js/LICENSE', out + '/vendor/CHESSJS-LICENSE.txt');

let engine = readFileSync('public/engine.js', 'utf8');
engine = engine.replaceAll("'/engine/", "'engine/");
writeFileSync(out + '/engine.js', engine);

let app = readFileSync('public/app.js', 'utf8');
app = replaceOnce(app, "from '/vendor/chess.js'", "from './vendor/chess.js'");
app = replaceOnce(app, "'/pieces/'", "'pieces/'");
app = replaceOnce(app, "fetch('/data/games.json')", "fetch('data/games.json')");
// Sandboxed viewers block downloads, so show the PGN in a dialog with a copy button instead.
app = replaceOnce(app, /\$\('download-pgn'\)\.onclick=.*$/m.exec(app)[0],
  "$('download-pgn').onclick=()=>{$('pgn-text').value=state.record.pgn;$('pgn-dialog').showModal();$('pgn-text').select();};\n" +
  "$('copy-pgn').onclick=async()=>{try{await navigator.clipboard.writeText($('pgn-text').value);$('copy-pgn').textContent='Copied';}catch{$('pgn-text').select();$('copy-pgn').textContent='Press ⌘C / Ctrl+C';}setTimeout(()=>$('copy-pgn').textContent='Copy PGN',1800);};\n" +
  "$('close-pgn').onclick=()=>$('pgn-dialog').close();");
writeFileSync(out + '/app.js', app);

let html = readFileSync('public/index.html', 'utf8');
html = html.replace(/<!doctype html>\s*<html[^>]*>\s*<head>/i, '').replace(/<\/head>\s*<body>/i, '').replace(/<\/body>\s*<\/html>\s*$/i, '');
html = html.replace(/<meta charset="utf-8">|<meta name="viewport"[^>]*>/g, '');
html = replaceOnce(html, '<title>OpenChess — Your next move</title>', '<title>OpenChess</title><meta name="claude:viewport-fit-sides" content="cover">');
html = replaceOnce(html, 'href="/style.css"', 'href="style.css"');
html = replaceOnce(html, 'src="/app.js"', 'src="app.js"');
html = replaceOnce(html, 'class="brand" href="/"', 'class="brand" href="#"');
html = replaceOnce(html, 'Download PGN ↓', 'View PGN');
html = replaceOnce(html, '<footer>', '<footer class="credits-footer">');
html = replaceOnce(html, '</footer>',
  '<span class="credits">GPLv3 · <a href="https://github.com/d1rtworking11-beep/Chess-training" target="_blank" rel="noopener">Source code</a> · <a href="LICENSE.txt" target="_blank">License</a> · <a href="https://github.com/official-stockfish/Stockfish" target="_blank" rel="noopener">Stockfish</a> (<a href="engine/STOCKFISH-COPYING.txt" target="_blank">GPLv3</a>, <a href="https://github.com/nmrugg/stockfish.js" target="_blank" rel="noopener">stockfish.js</a>) · Pieces by Colin M. L. Burnett (<a href="pieces/ATTRIBUTION.txt" target="_blank">GPLv2+</a>) · Games via <a href="https://github.com/rozim/ChessData" target="_blank" rel="noopener">rozim/ChessData</a> (PGN Mentor)</span></footer>');
html = replaceOnce(html, '<dialog id="promotion">',
  '<dialog id="pgn-dialog"><div class="modal-head"><div><div class="eyebrow">PORTABLE GAME NOTATION</div><h2>Game PGN</h2></div><button id="close-pgn" aria-label="Close PGN">×</button></div><textarea id="pgn-text" readonly rows="14" aria-label="PGN text"></textarea><div class="game-actions"><button id="copy-pgn">Copy PGN</button></div></dialog><dialog id="promotion">');
html = '<style>:root{color-scheme:dark}body{background:#161b1a}.credits-footer{flex-wrap:wrap;gap:8px 16px}.credits{flex-basis:100%;font-size:11px;opacity:.8}.credits a{color:var(--green)}#pgn-text{width:100%;min-height:220px;background:#111614;color:#e7e9e8;border:1px solid var(--line);border-radius:8px;padding:12px;font:12px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;resize:vertical;margin:12px 0}</style>\n' + html.trim();
// Keep the <title> within the first 8KB the host scans.
html = html.replace(/^(<style>[\s\S]*?<\/style>\n)(<title>[\s\S]*?content="cover">)/, '$2$1');
writeFileSync(out + '/index.html', html);
console.log('Static artifact written to ' + out + '/');
