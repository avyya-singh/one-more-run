export const ACTIONS = ["left", "right", "up", "down", "idle"] as const;
export const DIM = 23;
export type SavedModel = {
  weights: number[][];
  samples: number;
  correct: number;
  loss: number;
  version: 1;
};
export function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
export class MoveModel {
  weights: number[][];
  samples = 0;
  correct = 0;
  loss = 0;
  constructor(saved?: SavedModel) {
    const r = rng(43);
    this.weights = Array.from({ length: 5 }, () =>
      Array.from({ length: DIM }, () => (r() - 0.5) * 0.02),
    );
    if (saved && this.valid(saved)) {
      this.weights = saved.weights.map((w) => [...w]);
      this.samples = saved.samples;
      this.correct = saved.correct;
      this.loss = saved.loss;
    }
  }
  valid(s: SavedModel) {
    return (
      s.version === 1 &&
      Number.isSafeInteger(s.samples) &&
      s.samples >= 0 &&
      Number.isFinite(s.correct) &&
      s.correct >= 0 &&
      s.correct <= s.samples &&
      Number.isFinite(s.loss) &&
      s.weights?.length === 5 &&
      s.weights.every(
        (w) =>
          w.length === DIM &&
          w.every((v) => Number.isFinite(v) && Math.abs(v) < 100),
      )
    );
  }
  predict(x: number[]) {
    if (x.length !== DIM || x.some((v) => !Number.isFinite(v)))
      throw Error("Invalid feature vector");
    const logits = this.weights.map((w) =>
      w.reduce((s, v, i) => s + v * x[i], 0),
    );
    const max = Math.max(...logits);
    const exp = logits.map((v) => Math.exp(v - max));
    const sum = exp.reduce((a, b) => a + b, 0);
    const probs = exp.map((v) => v / sum);
    let action = 0;
    probs.forEach((p, i) => {
      if (p > probs[action]) action = i;
    });
    return { action, probs, confidence: probs[action] };
  }
  train(x: number[], label: number) {
    if (!Number.isInteger(label) || label < 0 || label >= 5)
      throw Error("Invalid action");
    const before = this.predict(x);
    const loss = -Math.log(Math.max(1e-9, before.probs[label]));
    const rate = 0.12 / Math.sqrt(1 + this.samples / 1200);
    for (let c = 0; c < 5; c++)
      for (let j = 0; j < DIM; j++)
        this.weights[c][j] -=
          rate *
          ((before.probs[c] - (c === label ? 1 : 0)) * x[j] +
            0.0005 * this.weights[c][j]);
    this.samples++;
    if (before.action === label) this.correct++;
    this.loss = this.samples === 1 ? loss : this.loss * 0.96 + loss * 0.04;
    return { ...before, loss };
  }
  save(): SavedModel {
    return {
      weights: this.weights.map((w) => [...w]),
      samples: this.samples,
      correct: this.correct,
      loss: this.loss,
      version: 1,
    };
  }
}
