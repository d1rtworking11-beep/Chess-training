export class Engine {
  constructor() {
    this.worker = new Worker('/engine/stockfish-19-lite-single.js');
    this.queue = Promise.resolve();
    this.ready = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Engine startup timed out. Reload to retry.')), 30000);
      this.worker.onmessage = ({data}) => { if (String(data).includes('uciok')) { clearTimeout(timer); resolve(); } };
      this.worker.onerror = () => { clearTimeout(timer); reject(new Error('Engine could not load. Reload to retry.')); };
      this.worker.postMessage('uci');
    });
  }
  analyze(fen, {elo = null, time = 500} = {}) {
    const run = async () => {
      await this.ready;
      return new Promise((resolve, reject) => {
        const lines = new Map();
        const timer = setTimeout(() => { this.worker.postMessage('stop'); reject(new Error('Analysis timed out.')); }, 15000);
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
