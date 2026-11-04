import { test } from "node:test";
import assert from "node:assert/strict";
import { MoveModel, DIM } from "../src/model.js";
import { Game, features, blocked, move, type Input } from "../src/engine.js";
test("softmax probabilities are normalized and training learns a repeated pattern", () => {
  const m = new MoveModel(),
    x = Array.from({ length: DIM }, (_, i) => (i === 0 ? 1 : i / 100));
  const before = m.predict(x).probs[0];
  for (let n = 0; n < 120; n++) m.train(x, 0);
  const after = m.predict(x);
  assert(after.probs[0] > 0.9);
  assert(after.probs[0] > before);
  assert(Math.abs(after.probs.reduce((a, b) => a + b) - 1) < 1e-9);
  assert.equal(m.samples, 120);
  assert.throws(() => m.train(x, 8));
  assert.throws(() => m.predict([NaN]));
  assert.deepEqual(new MoveModel(m.save()).save(), m.save());
});
test("training metrics score predictions before updating weights", () => {
  const m = new MoveModel(),
    x = Array(DIM).fill(0);
  x[0] = 1;
  const before = m.predict(x);
  const label = (before.action + 1) % 5;
  const result = m.train(x, label);
  assert.equal(result.action, before.action);
  assert.equal(m.correct, 0);
  assert.equal(m.samples, 1);
});
test("features have the expected size and obstacles block movement", () => {
  const g = new Game(new MoveModel());
  assert.equal(features(g.player, g.rival, 4, { vx: 0, vy: 0 }, 0).length, DIM);
  assert(blocked(5, 50));
  assert(blocked(200, 140));
  const p = { ...g.player, x: 170, y: 145 };
  move(p, 20, 0);
  assert.equal(p.x, 170);
});
function simulation(seed: number, mode: "adaptive" | "scripted" = "adaptive") {
  const g = new Game(new MoveModel(), mode, seed);
  for (let n = 0; n < 3000 && !g.ended; n++) {
    const i: Input = {
      x: n % 240 < 120 ? 1 : -1,
      y: n % 360 < 180 ? 1 : -1,
      dash: n % 180 < 3,
      fire: true,
      aimX: g.rival.x,
      aimY: g.rival.y,
    };
    g.step(1 / 60, i);
  }
  return g;
}
test("fixed seed and inputs produce deterministic telemetry and actual combat", () => {
  const a = simulation(112),
    b = simulation(112);
  assert(a.ended);
  assert.deepEqual(a.frames, b.frames);
  assert.deepEqual(a.samples, b.samples);
  assert(a.shots > 0);
  assert(a.samples.length > 0);
  assert(a.model.samples === a.samples.length);
  assert(a.frames.length >= 2);
  assert(a.hits > 0 || a.damageTaken > 0);
  assert(a.finish().events.some((e) => e.type === "end"));
});
test("idle round ends, records replay, and majority baseline is measured honestly", () => {
  const g = new Game(new MoveModel(), "scripted", 42);
  assert.throws(() => g.finish());
  assert.throws(() =>
    g.step(0.2, { x: 0, y: 0, dash: false, fire: false, aimX: 0, aimY: 0 }),
  );
  for (let n = 0; n < 3000 && !g.ended; n++)
    g.step(1 / 60, { x: 0, y: 0, dash: false, fire: false, aimX: 0, aimY: 0 });
  const r = g.finish();
  assert(r.duration <= 45.1);
  assert(r.samples.every((s) => s.actual === 4));
  assert(r.samples.every((s) => s.baselineCorrect));
  assert.equal(r.mode, "scripted");
  assert(r.frames.every((f) => f.player.x >= 38 && f.player.hp >= 0));
  const saved = JSON.stringify(g.model.save());
  r.frames.forEach((f) => assert(Number.isFinite(f.t)));
  assert.equal(JSON.stringify(g.model.save()), saved);
});
test("adaptive rival records prediction-led aim while scripted rival does not", () => {
  const m = new MoveModel();
  const g = new Game(m, "adaptive", 2);
  for (let n = 0; n < 720 && !g.ended; n++)
    g.step(1 / 60, { x: 1, y: 0, dash: false, fire: false, aimX: 0, aimY: 0 });
  assert(g.events.some((e) => e.type === "predict"));
  const s = simulation(112, "scripted");
  assert(!s.events.some((e) => e.type === "predict"));
});
