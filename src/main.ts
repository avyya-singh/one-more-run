import { MoveModel, ACTIONS, type SavedModel } from "./model.js";
import {
  Game,
  ROUND_SECONDS,
  WIDTH,
  HEIGHT,
  type Frame,
  type Round,
  type Mode,
  type Input,
} from "./engine.js";
import { Renderer } from "./render.js";
import "./style.css";

const $ = <T extends HTMLElement = HTMLElement>(id: string) =>
  document.getElementById(id) as T;
const KEY = "one-more-run-v2";
let rounds: Round[] = [],
  model = new MoveModel();
function validRound(r: Round) {
  const finite = (v: unknown) => typeof v === "number" && Number.isFinite(v);
  return (
    r &&
    ["adaptive", "scripted"].includes(r.mode) &&
    ["win", "loss", "timeout"].includes(r.result) &&
    finite(r.duration) &&
    r.duration > 0 &&
    r.duration < 46 &&
    Array.isArray(r.frames) &&
    r.frames.length > 0 &&
    r.frames.length < 600 &&
    r.frames.every(
      (f) =>
        finite(f.t) &&
        f.player &&
        f.rival &&
        [f.player, f.rival].every(
          (a) =>
            finite(a.x) &&
            finite(a.y) &&
            finite(a.hp) &&
            a.hp >= 0 &&
            a.hp <= 100,
        ) &&
        Array.isArray(f.bullets) &&
        f.bullets.length < 100 &&
        f.bullets.every((b) => finite(b.x) && finite(b.y)),
    ) &&
    Array.isArray(r.samples) &&
    r.samples.length < 200 &&
    r.samples.every(
      (s) =>
        finite(s.t) &&
        finite(s.loss) &&
        s.actual >= 0 &&
        s.actual < 5 &&
        s.predicted >= 0 &&
        s.predicted < 5,
    ) &&
    Array.isArray(r.events) &&
    r.events.length < 1000 &&
    r.events.every(
      (e) => finite(e.t) && typeof e.text === "string" && e.text.length < 300,
    )
  );
}
try {
  const saved = JSON.parse(localStorage.getItem(KEY) || "null");
  if (saved?.model) model = new MoveModel(saved.model as SavedModel);
  if (Array.isArray(saved?.rounds))
    rounds = saved.rounds.filter(validRound).slice(-8);
} catch {}
let toastTimer = 0;
function toast(text: string) {
  $("toast").textContent = text;
  $("toast").classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(
    () => $("toast").classList.remove("show"),
    3000,
  );
}
function save() {
  for (const count of [8, 4, 1]) {
    try {
      rounds = rounds.slice(-count);
      localStorage.setItem(
        KEY,
        JSON.stringify({ model: model.save(), rounds }),
      );
      return;
    } catch {}
  }
  toast("Browser storage is full or blocked. You can still export this round.");
}
const canvas = $<HTMLCanvasElement>("game"),
  renderer = new Renderer(canvas);
const keys = new Set<string>();
let touchX = 0,
  touchY = 0,
  touchDash = false,
  touchFire = false;
let pointer = { x: 580, y: 220 },
  mouseFire = false;
let status: "ready" | "playing" | "paused" | "ended" = "ready";
let game: Game | null = null;
let replay: Round | null = null,
  replayTime = 0,
  replayPlaying = false;
let selected = rounds.at(-1) || null;
let last = performance.now(),
  accumulator = 0,
  uiTime = 0;
let audio: AudioContext | null = null,
  sound = false;
const idle: Frame = {
  t: 0,
  player: {
    x: 255,
    y: 250,
    hp: 100,
    vx: 0,
    vy: 0,
    dash: 0,
    attack: 0,
    invulnerable: 0,
    facing: 1,
  },
  rival: {
    x: 550,
    y: 227,
    hp: 100,
    vx: 0,
    vy: 0,
    dash: 0,
    attack: 0,
    invulnerable: 0,
    facing: -1,
  },
  bullets: [],
  samples: 0,
  correct: 0,
  prediction: 4,
  confidence: 0.2,
};
function beep(freq: number, seconds = 0.06) {
  if (!sound || !audio) return;
  const o = audio.createOscillator(),
    g = audio.createGain();
  o.type = "triangle";
  o.frequency.value = freq;
  g.gain.setValueAtTime(0.025, audio.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + seconds);
  o.connect(g);
  g.connect(audio.destination);
  o.start();
  o.stop(audio.currentTime + seconds);
}
function clearInput() {
  keys.clear();
  touchX = touchY = 0;
  touchDash = touchFire = mouseFire = false;
}
function showOverlay(
  kicker: string,
  title: string,
  description: string,
  button: string,
  hint: string,
) {
  $("overlay").hidden = false;
  $("overlay-kicker").textContent = kicker;
  $("overlay-title").textContent = title;
  $("overlay-description").textContent = description;
  $("start").innerHTML = button + " <span>↗</span>";
  $("overlay-hint").textContent = hint;
}
function begin() {
  if (status === "paused") {
    resume();
    return;
  }
  clearInput();
  replay = null;
  replayPlaying = false;
  game = new Game(
    model,
    $<HTMLSelectElement>("mode").value as Mode,
    Math.floor(Date.now() % 1000000),
  );
  status = "playing";
  $("new-round").hidden = true;
  $("overlay").hidden = true;
  $<HTMLButtonElement>("pause").disabled = false;
  $("pause").textContent = "Ⅱ Pause";
  $<HTMLSelectElement>("mode").disabled = true;
  $<HTMLSelectElement>("round-select").disabled = true;
  $<HTMLButtonElement>("watch-replay").disabled = true;
  $<HTMLButtonElement>("reset-model").disabled = true;
  $("arena-state").textContent = "Round live. Mochi is watching your movement.";
  $("arena-corner").textContent = "AIM WITH YOUR MOUSE · J AUTO-AIMS AT MOCHI";
  $("round-number").textContent =
    `ROUND ${String(rounds.length + 1).padStart(2, "0")}`;
  canvas.focus({ preventScroll: true });
  last = performance.now();
  accumulator = 0;
  beep(440, 0.1);
}
function pause() {
  if (status !== "playing") return;
  status = "paused";
  clearInput();
  $("pause").textContent = "▶ Resume";
  showOverlay(
    "TAKE YOUR TIME",
    "A tiny breather.",
    "Your round and learning state are paused.",
    "Keep playing",
    "Press P to resume",
  );
  $("arena-state").textContent =
    "Paused. No training happens while you’re away.";
}
function resume() {
  if (status !== "paused") return;
  status = "playing";
  $("overlay").hidden = true;
  $("pause").textContent = "Ⅱ Pause";
  last = performance.now();
  accumulator = 0;
  canvas.focus({ preventScroll: true });
  $("arena-state").textContent = "Back in the clearing.";
}
function end() {
  if (!game || status === "ended") return;
  status = "ended";
  $("new-round").hidden = false;
  clearInput();
  const r = game.finish();
  rounds.push(r);
  save();
  selected = r;
  $<HTMLSelectElement>("mode").disabled = false;
  $<HTMLButtonElement>("pause").disabled = true;
  $<HTMLButtonElement>("watch-replay").disabled = false;
  $<HTMLButtonElement>("reset-model").disabled = false;
  updateRounds();
  renderRound(r);
  updateBrain();
  const title =
    r.result === "win"
      ? "You got Mochi."
      : r.result === "loss"
        ? "Mochi got you."
        : "Call it a draw?";
  showOverlay(
    "ROUND COMPLETE",
    title,
    `${r.samples.length} moves observed. ${r.hits} shots landed. Ready for another?`,
    "One more run",
    `Model has now seen ${model.samples} moves · replay is ready below`,
  );
  $("arena-state").textContent =
    `${r.result === "win" ? "You win" : r.result === "loss" ? "Mochi wins" : "Time up"}. Replay saved on this device.`;
  beep(r.result === "win" ? 660 : 220, 0.2);
}
$("new-round").addEventListener("click", begin);
$("start").addEventListener("click", begin);
$("pause").addEventListener("click", () =>
  status === "paused" ? resume() : pause(),
);
$("sound").addEventListener("click", () => {
  sound = !sound;
  if (sound) {
    audio ??= new AudioContext();
    void audio.resume();
    beep(520);
  }
  $("sound").textContent = sound ? "Sound on" : "Sound off";
  $("sound").setAttribute("aria-pressed", String(sound));
});
addEventListener("keydown", (e) => {
  if (
    e.target instanceof HTMLInputElement ||
    e.target instanceof HTMLSelectElement
  )
    return;
  if ((e.target as HTMLElement)?.closest("button,a")) return;
  const k = e.key.toLowerCase();
  if (k === "p" && game) {
    e.preventDefault();
    status === "paused" ? resume() : pause();
    return;
  }
  if (status !== "playing") return;
  if (
    [
      "w",
      "a",
      "s",
      "d",
      "arrowup",
      "arrowdown",
      "arrowleft",
      "arrowright",
      " ",
      "j",
    ].includes(k)
  ) {
    e.preventDefault();
    keys.add(k);
  }
});
addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));
addEventListener("blur", () => {
  clearInput();
  pause();
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    clearInput();
    pause();
    replayPlaying = false;
  }
});
canvas.addEventListener("pointermove", (e) => {
  const r = canvas.getBoundingClientRect();
  pointer = {
    x: ((e.clientX - r.left) / r.width) * WIDTH,
    y: ((e.clientY - r.top) / r.height) * HEIGHT,
  };
});
canvas.addEventListener("pointerdown", (e) => {
  if (status !== "playing") return;
  canvas.focus({ preventScroll: true });
  if (e.pointerType === "mouse") {
    mouseFire = true;
    canvas.setPointerCapture(e.pointerId);
  }
});
addEventListener("pointerup", () => (mouseFire = false));
canvas.addEventListener("contextmenu", (e) => e.preventDefault());
document
  .querySelectorAll<HTMLButtonElement>("[data-direction]")
  .forEach((b) => {
    const dir = b.dataset.direction;
    const active = new Set<number>();
    b.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      active.add(e.pointerId);
      b.setPointerCapture(e.pointerId);
      if (dir === "left") touchX = -1;
      if (dir === "right") touchX = 1;
      if (dir === "up") touchY = -1;
      if (dir === "down") touchY = 1;
    });
    const release = (e: PointerEvent) => {
      active.delete(e.pointerId);
      if (!active.size) {
        if (dir === "left" || dir === "right") touchX = 0;
        else touchY = 0;
      }
    };
    b.addEventListener("pointerup", release);
    b.addEventListener("pointercancel", release);
    b.addEventListener("lostpointercapture", release);
  });
for (const id of ["touch-dash", "touch-attack"]) {
  const b = $(id);
  b.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    b.setPointerCapture(e.pointerId);
    if (id === "touch-dash") touchDash = true;
    else touchFire = true;
  });
  const release = () => {
    if (id === "touch-dash") touchDash = false;
    else touchFire = false;
  };
  b.addEventListener("pointerup", release);
  b.addEventListener("pointercancel", release);
  b.addEventListener("lostpointercapture", release);
}
function input(): Input {
  const auto = keys.has("j") || touchFire;
  return {
    x:
      touchX +
      (keys.has("d") || keys.has("arrowright") ? 1 : 0) -
      (keys.has("a") || keys.has("arrowleft") ? 1 : 0),
    y:
      touchY +
      (keys.has("s") || keys.has("arrowdown") ? 1 : 0) -
      (keys.has("w") || keys.has("arrowup") ? 1 : 0),
    dash: keys.has(" ") || touchDash,
    fire: mouseFire || auto,
    aimX: auto && game ? game.rival.x : pointer.x,
    aimY: auto && game ? game.rival.y : pointer.y,
  };
}
function time(t: number) {
  const sec = Math.max(0, Math.floor(t));
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
}
function pct(n: number, d: number) {
  return d ? Math.round((n / d) * 100) + "%" : "—";
}
function updateBrain() {
  const samples = game?.samples.length ? game.samples : selected?.samples || [];
  const correct = samples.filter((s) => s.correct).length;
  const base = samples.filter((s) => s.baselineCorrect).length;
  $("samples").textContent = model.samples.toLocaleString();
  $("accuracy").textContent = pct(correct, samples.length);
  $("baseline").textContent = samples.length
    ? `${pct(base, samples.length)} majority baseline · this round`
    : "play a round to measure";
  $("level").textContent = String(1 + Math.floor(model.samples / 150));
  const current = game?.samples.at(-1) || selected?.samples.at(-1);
  document
    .querySelectorAll<HTMLElement>("[data-action]")
    .forEach((el) =>
      el.classList.toggle(
        "active",
        !!current && Number(el.dataset.action) === current.predicted,
      ),
    );
  $("prediction-confidence").textContent = current
    ? `${Math.round(current.confidence * 100)}% CONF.`
    : "WAITING";
  $("prediction-note").textContent = current
    ? `Last guess: ${ACTIONS[current.predicted]}. Actual next move: ${ACTIONS[current.actual]}. Scored before training.`
    : "Mochi needs a few moves to work with.";
  const plot = $("learning-plot");
  if (rounds.length) {
    const values = rounds.map(
      (r) =>
        r.samples.filter((s) => s.correct).length /
        Math.max(1, r.samples.length),
    );
    const points = values.map(
      (v, i) =>
        `${rounds.length === 1 ? 130 : 8 + (i / (rounds.length - 1)) * 244},${60 - v * 50}`,
    );
    plot.innerHTML =
      `<path d="M0 20H260M0 50H260" stroke="#dde2d0" stroke-dasharray="3 4"/><polyline points="${points.join(" ")}" fill="none" stroke="#879d6c" stroke-width="2"/>` +
      values
        .map(
          (v, i) =>
            `<circle cx="${rounds.length === 1 ? 130 : 8 + (i / (rounds.length - 1)) * 244}" cy="${60 - v * 50}" r="3" fill="#879d6c"/>`,
        )
        .join("");
    plot.setAttribute(
      "aria-label",
      `Prediction accuracy by round: ${values.map((v) => Math.round(v * 100) + "%").join(", ")}`,
    );
  }
}
function updateRounds() {
  const select = $<HTMLSelectElement>("round-select");
  select.replaceChildren();
  if (!rounds.length) {
    select.add(new Option("Play your first round", ""));
    select.disabled = true;
    $("replay-empty").hidden = false;
    $("replay-body").hidden = true;
    return;
  }
  rounds.forEach((r, i) =>
    select.add(new Option(`Round ${i + 1} · ${r.mode} · ${r.result}`, r.id)),
  );
  select.value = selected?.id || rounds.at(-1)!.id;
  select.disabled = status === "playing" || status === "paused";
  $("replay-count").textContent =
    `${rounds.length} round${rounds.length === 1 ? "" : "s"}`;
  $<HTMLButtonElement>("export").disabled = false;
  $("replay-empty").hidden = true;
  $("replay-body").hidden = false;
}
function renderRound(r: Round) {
  selected = r;
  replayTime = 0;
  $("result-title").textContent =
    r.result === "win"
      ? "You won this one."
      : r.result === "loss"
        ? "This one goes to Mochi."
        : "Time’s up.";
  $("result-info").textContent =
    `${time(r.duration)} · ${r.mode.toUpperCase()} · ${r.samples.length} samples`;
  $<HTMLInputElement>("scrubber").max = r.duration.toFixed(2);
  $<HTMLInputElement>("scrubber").value = "0";
  $("round-accuracy").textContent = pct(
    r.samples.filter((s) => s.correct).length,
    r.samples.length,
  );
  $("round-baseline").textContent = pct(
    r.samples.filter((s) => s.baselineCorrect).length,
    r.samples.length,
  );
  $("round-hits").textContent = `${r.hits} / ${r.shots}`;
  $("round-loss").textContent = r.samples.length
    ? (r.samples.reduce((n, s) => n + s.loss, 0) / r.samples.length).toFixed(2)
    : "—";
  const counts = [0, 0, 0, 0, 0];
  r.samples.forEach((s) => counts[s.actual]++);
  const most = counts.indexOf(Math.max(...counts)),
    share = counts[most] / Math.max(1, r.samples.length);
  $("notes-title").textContent =
    share > 0.6
      ? most === 4
        ? "A little too comfortable."
        : `A bit of a ${ACTIONS[most]} habit.`
      : "You kept Mochi guessing.";
  $("notes-copy").textContent =
    `${Math.round(share * 100)}% of sampled next moves were ${ACTIONS[most]}. Mochi guessed ${pct(r.samples.filter((s) => s.correct).length, r.samples.length)} correctly; the online majority baseline scored ${pct(r.samples.filter((s) => s.baselineCorrect).length, r.samples.length)}.`;
  $("notes-tip").textContent =
    r.mode === "scripted"
      ? "Scripted Mochi aims at delayed positions. The model still learns and is measured, but does not guide the rival’s shots."
      : "Adaptive Mochi leads its shots when its model is confident. Try varying your direction or using obstacles.";
  const c = $<HTMLCanvasElement>("timeline").getContext("2d")!;
  c.clearRect(0, 0, 650, 70);
  c.fillStyle = "#edf0e4";
  c.fillRect(0, 15, 650, 35);
  r.events.forEach((e) => {
    const x = (e.t / r.duration) * 650;
    if (e.type === "dash") {
      c.fillStyle = "#b4a0c8";
      c.fillRect(x, 18, 3, 28);
    } else if (e.type === "hit") {
      c.fillStyle = "#d6a075";
      c.fillRect(x, 24, 3, 20);
    } else if (e.type === "predict") {
      c.fillStyle = "#95a879";
      c.fillRect(x, 32, 2, 10);
    }
  });
  c.font = "8px monospace";
  c.fillStyle = "#a0ac8d";
  c.fillText("0:00", 0, 65);
  c.textAlign = "right";
  c.fillText(time(r.duration), 650, 65);
  c.textAlign = "left";
  const list = $("event-list");
  list.replaceChildren();
  r.events
    .filter((e) => ["dash", "hit", "predict"].includes(e.type))
    .slice(0, 12)
    .forEach((e) => {
      const b = document.createElement("button");
      b.textContent = `${time(e.t)} · ${e.text}`;
      b.addEventListener("click", () => openReplay(e.t));
      list.appendChild(b);
    });
  updateReplayTime();
}
function updateReplayTime() {
  $("replay-time").textContent =
    `${time(replayTime)} / ${time(selected?.duration || ROUND_SECONDS)}`;
  $<HTMLInputElement>("scrubber").value = String(replayTime);
  $("replay-play").textContent = replayPlaying ? "Ⅱ" : "▶";
  $("replay-play").setAttribute(
    "aria-label",
    replayPlaying ? "Pause replay" : "Play replay",
  );
}
function openReplay(t = 0, play = false) {
  if (status === "playing" || status === "paused") {
    toast("Finish your current round before watching a replay.");
    return;
  }
  if (!selected) return;
  $("new-round").hidden = false;
  replay = selected;
  replayTime = Math.max(0, Math.min(selected.duration, t));
  replayPlaying = play;
  $("overlay").hidden = true;
  $("arena-state").textContent =
    "Replay mode. Recorded positions; the model is not training.";
  $("arena-corner").textContent = "REPLAY MODE · NO TRAINING";
  updateReplayTime();
}
$("watch-replay").addEventListener("click", () => {
  openReplay(0, true);
  $("arena").scrollIntoView({
    behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "instant"
      : "smooth",
  });
});
$("replay-play").addEventListener("click", () => {
  if (!selected) return;
  if (replayTime >= selected.duration) replayTime = 0;
  openReplay(replayTime, !replayPlaying);
});
$("scrubber").addEventListener("input", () =>
  openReplay(Number($<HTMLInputElement>("scrubber").value), false),
);
$("round-select").addEventListener("change", () => {
  const r = rounds.find(
    (r) => r.id === $<HTMLSelectElement>("round-select").value,
  );
  if (r) {
    renderRound(r);
    game = null;
    updateBrain();
    if (replay) openReplay();
  }
});
$("reset-model").addEventListener("click", () => {
  if (status === "playing" || status === "paused") return;
  model = new MoveModel();
  game = null;
  save();
  updateBrain();
  toast("Model weights reset. Your recorded rounds are still available.");
});
$("export").addEventListener("click", () => {
  if (!rounds.length) return;
  const blob = new Blob(
    [
      JSON.stringify(
        {
          schemaVersion: 2,
          project: "one-more-run",
          model: model.save(),
          rounds,
          measurement:
            "Next-action predictions scored before training. Baseline is an online majority predictor; match comparisons are observational.",
        },
        null,
        2,
      ),
    ],
    { type: "application/json" },
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "one-more-run-telemetry.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast("Telemetry exported. No data was uploaded.");
});
function loop(now: number) {
  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;
  if (status === "playing" && game) {
    accumulator += dt;
    while (accumulator >= 1 / 60 && status === "playing") {
      const shots = game.shots;
      game.step(1 / 60, input());
      if (game.shots > shots) beep(420, 0.035);
      accumulator -= 1 / 60;
      if (game.ended) end();
    }
  }
  let f = game?.snapshot() || { ...idle, t: now / 1000 };
  if (replay) {
    if (replayPlaying) {
      replayTime = Math.min(
        replay.duration,
        replayTime + dt * Number($<HTMLSelectElement>("replay-speed").value),
      );
      if (replayTime >= replay.duration) replayPlaying = false;
    }
    f =
      replay.frames[
        Math.max(0, replay.frames.findIndex((x) => x.t > replayTime) - 1)
      ] || replay.frames[0];
    if (replayTime >= replay.frames[replay.frames.length - 1].t)
      f = replay.frames[replay.frames.length - 1];
    updateReplayTime();
  }
  renderer.draw(f, {
    idle: status === "ready" && !replay,
    paused: status === "paused",
    replay: !!replay,
  });
  if (now - uiTime > 150) {
    uiTime = now;
    $("player-hp").textContent = String(f.player.hp);
    $("rival-hp").textContent = String(f.rival.hp);
    $("timer").textContent = time(
      game || replay ? Math.ceil(ROUND_SECONDS - f.t) : ROUND_SECONDS,
    );
    $("dash-status").innerHTML =
      f.player.dash > 0
        ? `<i></i>dash ${f.player.dash.toFixed(1)}s`
        : "<i></i>dash ready";
    if (status === "playing") updateBrain();
  }
  requestAnimationFrame(loop);
}
updateRounds();
if (selected) renderRound(selected);
updateBrain();
requestAnimationFrame(loop);
