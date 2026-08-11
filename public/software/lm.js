const PAT = /'(?:[sdmt]|ll|ve|re)| ?\p{L}+| ?\p{N}+| ?[^\s\p{L}\p{N}]+|\s+(?!\S)|\s+/gu;

class Tokenizer {
  constructor(data) {
    this.vocab = data.vocab.map(b => Uint8Array.from(b));
    this.reverse = new Map(this.vocab.map((b, i) => [b.join(','), i]));
    this.ranks = new Map(data.merges.map(([a, b], i) => [a.join(',') + '|' + b.join(','), i]));
    this.eot = data.special_tokens['<|endoftext|>'];
  }
  encode(text) {
    const enc = new TextEncoder();
    const ids = [];
    for (const m of text.matchAll(PAT)) {
      let parts = Array.from(enc.encode(m[0]), b => String(b));
      while (parts.length > 1) {
        let best = -1, bestRank = Infinity;
        for (let i = 0; i < parts.length - 1; i++) {
          const r = this.ranks.get(parts[i] + '|' + parts[i + 1]);
          if (r !== undefined && r < bestRank) { bestRank = r; best = i; }
        }
        if (best < 0) break;
        parts.splice(best, 2, parts[best] + ',' + parts[best + 1]);
      }
      for (const p of parts) {
        const id = this.reverse.get(p);
        if (id === undefined) throw new Error('token not in vocab: ' + p);
        ids.push(id);
      }
    }
    return ids;
  }
  decode(ids) {
    const chunks = ids.map(i => this.vocab[i]);
    const buf = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
    let o = 0;
    for (const c of chunks) { buf.set(c, o); o += c.length; }
    return new TextDecoder('utf-8', { fatal: false }).decode(buf);
  }
}

function sample(logits, temp, topP) {
  const n = logits.length;
  let max = -Infinity;
  for (let i = 0; i < n; i++) max = Math.max(max, logits[i] / temp);
  const p = new Float64Array(n);
  let sum = 0;
  for (let i = 0; i < n; i++) { p[i] = Math.exp(logits[i] / temp - max); sum += p[i]; }
  const order = Array.from(p.keys()).sort((a, b) => p[b] - p[a]);
  let cum = 0, cut = n;
  for (let i = 0; i < n; i++) {
    cum += p[order[i]] / sum;
    if (cum >= topP) { cut = i + 1; break; }
  }
  let r = Math.random() * cum * sum;
  for (let i = 0; i < cut; i++) {
    r -= p[order[i]];
    if (r <= 0) return order[i];
  }
  return order[cut - 1];
}

export async function loadLM({ onProgress } = {}) {
  const meta = await (await fetch('meta.json')).json();
  const tok = new Tokenizer(await (await fetch('tokenizer.json')).json());
  onProgress?.('tokenizer');
  const ep = 'wasm';
  const session = await ort.InferenceSession.create('model.int8.onnx', { executionProviders: [ep] });
  onProgress?.('model');
  console.log('[lm] ready', ep);

  let running = false;
  async function generate(prompt, { onText, onToken, temp = 0.8, topP = 0.95 } = {}) {
    if (running) return null;
    running = true;
    const ctxLen = meta.config.context_length;
    let ids = tok.encode(prompt);
    const promptLen = ids.length;
    const t0 = performance.now();
    try {
      while (ids.length < ctxLen) {
        const feed = new ort.Tensor('int64', BigInt64Array.from(ids, BigInt), [1, ids.length]);
        const res = await session.run({ input_ids: feed });
        const vocab = res.logits.dims[2];
        const logits = res.logits.data.subarray((ids.length - 1) * vocab, ids.length * vocab);
        const next = sample(logits, temp, topP);
        if (next === tok.eot) break;
        ids.push(next);
        onToken?.(next, tok.decode(ids.slice(promptLen)));
        onText?.(tok.decode(ids));
        await new Promise(requestAnimationFrame);
      }
      const made = ids.length - promptLen;
      const tps = made / ((performance.now() - t0) / 1000);
      console.log('[lm] RESULT', JSON.stringify({ tokens: made, tps: +tps.toFixed(2), ep }));
      return { text: tok.decode(ids), made, tps, ep };
    } finally {
      running = false;
    }
  }
  return { generate, tok, meta, ep, isRunning: () => running };
}
