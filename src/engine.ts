import { MoveModel, rng, type SavedModel } from "./model.js";
export const WIDTH = 800,
  HEIGHT = 450,
  ROUND_SECONDS = 45;
export type Mode = "adaptive" | "scripted";
export type Obstacle = { x: number; y: number; w: number; h: number };
export const ROCKS: Obstacle[] = [
  { x: 180, y: 130, w: 48, h: 38 },
  { x: 560, y: 280, w: 48, h: 38 },
  { x: 365, y: 90, w: 54, h: 32 },
  { x: 365, y: 325, w: 54, h: 32 },
];
export type Actor = {
  x: number;
  y: number;
  hp: number;
  vx: number;
  vy: number;
  dash: number;
  attack: number;
  invulnerable: number;
  facing: number;
};
export type Bullet = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  owner: "player" | "rival";
  life: number;
};
export type GameEvent = { t: number; type: string; text: string };
export type Sample = {
  features: number[];
  t: number;
  predicted: number;
  actual: number;
  confidence: number;
  correct: boolean;
  loss: number;
  baselineCorrect: boolean;
};
export type Frame = {
  t: number;
  player: Actor;
  rival: Actor;
  bullets: Bullet[];
  samples: number;
  correct: number;
  prediction: number;
  confidence: number;
};
export type Round = {
  id: string;
  seed: number;
  mode: Mode;
  result: "win" | "loss" | "timeout";
  duration: number;
  frames: Frame[];
  events: GameEvent[];
  samples: Sample[];
  shots: number;
  hits: number;
  damageTaken: number;
  modelBefore: number;
  modelAfter: number;
  modelStart: SavedModel;
  modelEnd: SavedModel;
  created: string;
};
export type Input = {
  x: number;
  y: number;
  dash: boolean;
  fire: boolean;
  aimX: number;
  aimY: number;
};
const actor = (x: number, y: number): Actor => ({
  x,
  y,
  hp: 100,
  vx: 0,
  vy: 0,
  dash: 0,
  attack: 0,
  invulnerable: 0,
  facing: 1,
});
export function blocked(x: number, y: number, r = 10) {
  return (
    x < 38 ||
    x > WIDTH - 38 ||
    y < 45 ||
    y > HEIGHT - 38 ||
    ROCKS.some(
      (o) =>
        x + r > o.x && x - r < o.x + o.w && y + r > o.y && y - r < o.y + o.h,
    )
  );
}
export function move(a: Actor, dx: number, dy: number) {
  if (!blocked(a.x + dx, a.y)) a.x += dx;
  if (!blocked(a.x, a.y + dy)) a.y += dy;
}
function action(a: Actor) {
  return Math.abs(a.vx) < 3 && Math.abs(a.vy) < 3
    ? 4
    : Math.abs(a.vx) > Math.abs(a.vy)
      ? a.vx < 0
        ? 0
        : 1
      : a.vy < 0
        ? 2
        : 3;
}
export function features(
  p: Actor,
  r: Actor,
  last: number,
  prev: { vx: number; vy: number },
  t: number,
) {
  const dx = r.x - p.x,
    dy = r.y - p.y;
  return [
    1,
    p.x / WIDTH,
    p.y / HEIGHT,
    dx / WIDTH,
    dy / HEIGHT,
    Math.hypot(dx, dy) / 900,
    p.hp / 100,
    p.dash / 1.8,
    p.attack / 0.27,
    p.vx / 170,
    p.vy / 170,
    prev.vx / 170,
    prev.vy / 170,
    Math.sin(t * 0.3),
    blocked(p.x - 25, p.y) ? 0 : 1,
    blocked(p.x + 25, p.y) ? 0 : 1,
    blocked(p.x, p.y - 25) ? 0 : 1,
    blocked(p.x, p.y + 25) ? 0 : 1,
    ...Array.from({ length: 5 }, (_, i) => (i === last ? 1 : 0)),
  ];
}
export class Game {
  player = actor(230, 245);
  rival = actor(580, 220);
  bullets: Bullet[] = [];
  events: GameEvent[] = [];
  samples: Sample[] = [];
  frames: Frame[] = [];
  elapsed = 0;
  shots = 0;
  hits = 0;
  damageTaken = 0;
  ended = false;
  result: Round["result"] = "timeout";
  modelBefore: number;
  modelStart: SavedModel;
  prediction = 4;
  confidence = 0.2;
  private nextSample = 0.25;
  private nextFrame = 0;
  private pending: number[];
  private previous = { vx: 0, vy: 0 };
  private last = 4;
  private random: () => number;
  private nextEnemy = 1.2;
  private dodgeUntil = 0;
  private dodgeX = 1;
  private dodgeY = 0;
  private memory = { x: 230, y: 245 };
  private nextMemory = 0;
  constructor(
    public model: MoveModel,
    public mode: Mode = "adaptive",
    public seed = 42,
  ) {
    this.random = rng(seed);
    this.modelBefore = model.samples;
    this.modelStart = model.save();
    this.pending = features(
      this.player,
      this.rival,
      this.last,
      this.previous,
      0,
    );
    this.events.push({
      t: 0,
      type: "start",
      text:
        mode === "adaptive"
          ? "Adaptive round started"
          : "Scripted round started",
    });
    this.record();
  }
  private record() {
    this.frames.push({
      t: this.elapsed,
      player: { ...this.player },
      rival: { ...this.rival },
      bullets: this.bullets.map((b) => ({ ...b })),
      samples: this.samples.length,
      correct: this.samples.filter((s) => s.correct).length,
      prediction: this.prediction,
      confidence: this.confidence,
    });
  }
  private shoot(a: Actor, owner: Bullet["owner"], x: number, y: number) {
    const dx = x - a.x,
      dy = y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const speed = owner === "player" ? 380 : 195;
    this.bullets.push({
      x: a.x + (dx / len) * 15,
      y: a.y + (dy / len) * 15,
      vx: (dx / len) * speed,
      vy: (dy / len) * speed,
      owner,
      life: 2.5,
    });
  }
  step(dt: number, input: Input) {
    if (this.ended) return;
    if (!Number.isFinite(dt) || dt <= 0 || dt > 0.05)
      throw Error("Use a fixed timestep of at most 50ms");
    this.elapsed += dt;
    for (const a of [this.player, this.rival]) {
      a.dash = Math.max(0, a.dash - dt);
      a.attack = Math.max(0, a.attack - dt);
      a.invulnerable = Math.max(0, a.invulnerable - dt);
    }
    const p = this.player,
      r = this.rival;
    let ix = Math.max(-1, Math.min(1, input.x)),
      iy = Math.max(-1, Math.min(1, input.y));
    const len = Math.hypot(ix, iy) || 1;
    if (len > 1) {
      ix /= len;
      iy /= len;
    }
    p.vx = ix * 170;
    p.vy = iy * 170;
    if (ix) p.facing = ix < 0 ? -1 : 1;
    if (input.dash && p.dash === 0 && (ix || iy)) {
      p.dash = 1.8;
      p.invulnerable = 0.24;
      this.dodgeUntil = this.elapsed + 0.17;
      this.dodgeX = ix;
      this.dodgeY = iy;
      this.events.push({ t: this.elapsed, type: "dash", text: "You dashed" });
    }
    if (this.elapsed < this.dodgeUntil)
      move(p, this.dodgeX * 510 * dt, this.dodgeY * 510 * dt);
    else move(p, p.vx * dt, p.vy * dt);
    if (input.fire && p.attack === 0) {
      this.shoot(p, "player", input.aimX, input.aimY);
      p.attack = 0.27;
      this.shots++;
      this.events.push({
        t: this.elapsed,
        type: "attack",
        text: "You attacked",
      });
    }
    if (this.elapsed >= this.nextSample) {
      const label = action(p);
      const counts = [0, 0, 0, 0, 0];
      this.samples.forEach((s) => counts[s.actual]++);
      const majority = this.samples.length
        ? counts.indexOf(Math.max(...counts))
        : 4;
      const trained = this.model.train(this.pending, label);
      this.samples.push({
        features: [...this.pending],
        t: this.elapsed,
        predicted: trained.action,
        actual: label,
        confidence: trained.confidence,
        correct: trained.action === label,
        loss: trained.loss,
        baselineCorrect: majority === label,
      });
      this.prediction = trained.action;
      this.confidence = trained.confidence;
      this.last = label;
      this.pending = features(p, r, label, this.previous, this.elapsed);
      this.previous = { vx: p.vx, vy: p.vy };
      this.nextSample += 0.25;
    }
    if (this.elapsed >= this.nextMemory) {
      this.memory = { x: p.x, y: p.y };
      this.nextMemory = this.elapsed + 0.6;
    }
    const dx = this.memory.x - r.x,
      dy = this.memory.y - r.y,
      dist = Math.hypot(dx, dy) || 1;
    const strafe = Math.sin(this.elapsed * 0.7) * 0.45;
    let rx =
        (dx / dist) * (dist > 150 ? 1 : dist < 105 ? -1 : 0) -
        (dy / dist) * strafe,
      ry =
        (dy / dist) * (dist > 150 ? 1 : dist < 105 ? -1 : 0) +
        (dx / dist) * strafe;
    r.vx = rx * 65;
    r.vy = ry * 65;
    r.facing = dx < 0 ? -1 : 1;
    move(r, r.vx * dt, r.vy * dt);
    if (this.elapsed >= this.nextEnemy) {
      let target = { ...this.memory };
      if (this.mode === "adaptive") {
        const pred = this.model.predict(
          features(p, r, this.last, this.previous, this.elapsed),
        );
        const directions = [
          [-1, 0],
          [1, 0],
          [0, -1],
          [0, 1],
          [0, 0],
        ];
        if (pred.confidence > 0.3) {
          target = {
            x: p.x + directions[pred.action][0] * 80,
            y: p.y + directions[pred.action][1] * 80,
          };
          this.events.push({
            t: this.elapsed,
            type: "predict",
            text: `Mochi aimed at your predicted move (${Math.round(pred.confidence * 100)}% confidence)`,
          });
        }
      }
      this.shoot(r, "rival", target.x, target.y);
      r.attack = 0.35;
      this.nextEnemy = this.elapsed + 1.12 + this.random() * 0.3;
    }
    for (const b of this.bullets) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (blocked(b.x, b.y, 2)) {
        b.life = 0;
        continue;
      }
      const target = b.owner === "player" ? r : p;
      if (b.life > 0 && Math.hypot(target.x - b.x, target.y - b.y) < 15) {
        b.life = 0;
        if (target.invulnerable === 0) {
          const damage = b.owner === "player" ? 10 : 16;
          target.hp = Math.max(0, target.hp - damage);
          target.invulnerable = 0.16;
          if (b.owner === "player") this.hits++;
          else this.damageTaken += damage;
          this.events.push({
            t: this.elapsed,
            type: "hit",
            text: b.owner === "player" ? "Your attack landed" : "Mochi hit you",
          });
        }
      }
    }
    this.bullets = this.bullets.filter((b) => b.life > 0);
    if (this.elapsed >= this.nextFrame) {
      this.record();
      this.nextFrame += 0.1;
    }
    if (p.hp <= 0 || r.hp <= 0 || this.elapsed >= ROUND_SECONDS) {
      this.ended = true;
      this.result = r.hp <= 0 ? "win" : p.hp <= 0 ? "loss" : "timeout";
      this.events.push({
        t: this.elapsed,
        type: "end",
        text:
          this.result === "win"
            ? "You won the round"
            : this.result === "loss"
              ? "Mochi won the round"
              : "Time is up",
      });
      this.record();
    }
  }
  snapshot(): Frame {
    return {
      t: this.elapsed,
      player: { ...this.player },
      rival: { ...this.rival },
      bullets: this.bullets,
      samples: this.samples.length,
      correct: this.samples.filter((s) => s.correct).length,
      prediction: this.prediction,
      confidence: this.confidence,
    };
  }
  finish(): Round {
    if (!this.ended) throw Error("Round is not finished");
    return {
      id: `round-${this.seed}-${Date.now()}`,
      seed: this.seed,
      mode: this.mode,
      result: this.result,
      duration: this.elapsed,
      frames: this.frames,
      events: this.events,
      samples: this.samples,
      shots: this.shots,
      hits: this.hits,
      damageTaken: this.damageTaken,
      modelBefore: this.modelBefore,
      modelAfter: this.model.samples,
      modelStart: this.modelStart,
      modelEnd: this.model.save(),
      created: new Date().toISOString(),
    };
  }
}
