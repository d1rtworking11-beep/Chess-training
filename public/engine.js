// WebAssembly build first; the pure-JavaScript build is slower but runs where a
// security policy blocks WebAssembly.
const BUILDS = [
  {url: '/engine/stockfish-19-lite-single.js', name: 'Stockfish 19', wasm: true},
  {url: '/engine/stockfish-19-asm.js', name: 'Stockfish 19 · compatibility mode', wasm: false},
];
function wasmAllowed() {
  try { new WebAssembly.Module(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0])); return true; } catch { return false; }
}
export class Engine {
  constructor() {
    this.queue = Promise.resolve();
    const builds = wasmAllowed() ? BUILDS : BUILDS.filter(b => !b.wasm);
    this.ready = this.start(builds);
  }
  start([build, ...rest]) {
    return new Promise((resolve, reject) => {
      const worker = new Worker(build.url);
      const fail = () => {
        clearTimeout(timer); worker.terminate();
        if (rest.length) resolve(this.start(rest)); else reject(Object.assign(new Error('Engine could not load. Reload to retry.'), {code: 'engineLoad'}));
      };
      const timer = setTimeout(fail, 25000);
      worker.onmessage = ({data}) => { if (String(data).includes('uciok')) { clearTimeout(timer); this.worker = worker; this.name = build.name; this.compat = !build.wasm; resolve(build.name); } };
      worker.onerror = event => { event.preventDefault?.(); fail(); };
      worker.postMessage('uci');
    });
  }
  analyze(fen, {elo = null, time = 500} = {}) {
    const run = async () => {
      await this.ready;
      return new Promise((resolve, reject) => {
        const lines = new Map();
        const timer = setTimeout(() => { this.worker.postMessage('stop'); reject(Object.assign(new Error('Analysis timed out.'), {code: 'analysisTimeout'})); }, 15000);
        this.worker.onmessage = ({data}) => {
          const text = String(data);
          if (text.startsWith('info depth') && text.includes(' pv ')) {
            const index = Number(text.match(/multipv (\d+)/)?.[1] || 1);
            const score = text.match(/score (cp|mate) (-?\d+)/);
            if (score) lines.set(index, {type: score[1], score: Number(score[2]), pv: text.split(' pv ')[1].trim().split(' '), depth: Number(text.match(/depth (\d+)/)?.[1])});
          }
          if (text.startsWith('bestmove')) { clearTimeout(timer); resolve({best: text.split(' ')[1], lines: [...lines.entries()].sort((a,b) => a[0]-b[0]).map(x => x[1])}); }
        };
        this.worker.postMessage('setoption name UCI_LimitStrength value ' + (elo ? 'true' : 'false'));
        if (elo) this.worker.postMessage('setoption name UCI_Elo value ' + Math.max(1320, Math.min(3190, elo)));
        this.worker.postMessage('setoption name MultiPV value ' + (elo ? 1 : 3));
        this.worker.postMessage('position fen ' + fen);
        this.worker.postMessage('go movetime ' + time);
      });
    };
    const next = this.queue.then(run, run); this.queue = next.catch(() => {}); return next;
  }
}
