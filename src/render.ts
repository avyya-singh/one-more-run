import { WIDTH, HEIGHT, ROCKS, type Frame } from "./engine.js";
import { rng } from "./model.js";
const PLAYER = [
  "..hhhh..",
  ".hhhhhh.",
  ".hsssssh",
  ".hsees.h",
  "..ssss..",
  "..pppp..",
  ".pppppp.",
  "spppppps",
  "s.pppp.s",
  "..bbbb..",
  "..b.bb..",
  ".kk.kk..",
];
const MOCHI = [
  ".o....o.",
  ".oo..oo.",
  ".oooooo.",
  "oooooooo",
  "oowoowoo",
  "ooeooeoo",
  "orrmmrro",
  ".oooooo.",
  "..oooo..",
  "..o..o..",
  ".oo..oo.",
];
const COLORS: Record<string, string> = {
  h: "#423b38",
  s: "#d8ae82",
  e: "#303b38",
  p: "#b9acd7",
  b: "#636976",
  k: "#3a4541",
  o: "#d9a26d",
  w: "#efe2bd",
  r: "#d6816b",
  m: "#654a36",
};
export class Renderer {
  private bg: HTMLCanvasElement;
  constructor(public canvas: HTMLCanvasElement) {
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    this.bg = document.createElement("canvas");
    this.bg.width = WIDTH;
    this.bg.height = HEIGHT;
    this.background();
  }
  private background() {
    const c = this.bg.getContext("2d")!;
    const random = rng(913);
    c.fillStyle = "#50654b";
    c.fillRect(0, 0, WIDTH, HEIGHT);
    c.fillStyle = "#5b724e";
    c.fillRect(20, 24, 760, 405);
    c.fillStyle = "#a3936f";
    c.fillRect(30, 34, 740, 394);
    c.fillStyle = "#827452";
    c.fillRect(30, 416, 740, 12);
    c.fillStyle = "#788e5b";
    c.fillRect(34, 38, 732, 378);
    for (let y = 38; y < 416; y += 22)
      for (let x = 34; x < 766; x += 22) {
        c.fillStyle = random() > 0.5 ? "#7c925f" : "#809663";
        c.fillRect(x, y, 22, 22);
      }
    for (let i = 0; i < 750; i++) {
      const x = 38 + Math.floor((random() * 720) / 3) * 3,
        y = 42 + Math.floor((random() * 365) / 3) * 3;
      c.fillStyle = random() > 0.5 ? "#8ea36d" : "#6f8655";
      c.fillRect(x, y, 3, 3);
      if (random() > 0.7) c.fillRect(x + 3, y - 3, 3, 3);
    }
    // Worn centre path and stone fragments.
    c.fillStyle = "#9b9b6b";
    for (let i = 0; i < 55; i++) {
      const x = 150 + random() * 500,
        y = 200 + random() * 65;
      c.globalAlpha = 0.22;
      c.fillRect(
        Math.round(x / 4) * 4,
        Math.round(y / 4) * 4,
        12 + Math.floor(random() * 4) * 4,
        8,
      );
    }
    c.globalAlpha = 1;
    for (const o of ROCKS) {
      c.fillStyle = "#465a3c45";
      c.fillRect(o.x + 5, o.y + 10, o.w, o.h);
      c.fillStyle = "#647564";
      c.fillRect(o.x, o.y + 5, o.w, o.h - 5);
      c.fillStyle = "#a2aa86";
      c.fillRect(o.x + 5, o.y, o.w - 10, 8);
      c.fillStyle = "#879778";
      c.fillRect(o.x + 4, o.y + 8, o.w - 8, o.h - 15);
      c.fillStyle = "#b0b698";
      c.fillRect(o.x + 8, o.y + 8, 10, 4);
      c.fillStyle = "#596e4b";
      c.fillRect(o.x + o.w - 12, o.y + o.h - 10, 12, 7);
    }
    for (const [x, y] of [
      [58, 80],
      [720, 70],
      [65, 355],
      [720, 365],
      [100, 60],
      [675, 400],
    ])
      this.tree(c, x, y);
    // Flowers, low shrubs and little boundary posts.
    for (let i = 0; i < 23; i++) {
      let x = 55 + random() * 690,
        y = 60 + random() * 330;
      if (x > 140 && x < 650 && y > 100 && y < 340) continue;
      x = Math.round(x / 3) * 3;
      y = Math.round(y / 3) * 3;
      c.fillStyle = "#536e44";
      c.fillRect(x, y, 3, 8);
      c.fillStyle = i % 3 ? "#e8d59b" : "#c5b5cd";
      c.fillRect(x - 3, y - 3, 9, 3);
      c.fillRect(x, y - 6, 3, 9);
    }
    for (let x = 115; x < 700; x += 80) {
      c.fillStyle = "#a6a17c";
      c.fillRect(x, 22, 7, 15);
      c.fillStyle = "#c2b899";
      c.fillRect(x, 22, 7, 4);
    }
    c.fillStyle = "#687d52";
    c.fillRect(72, 395, 25, 8);
    c.fillStyle = "#a8b081";
    c.fillRect(76, 392, 5, 4);
    c.fillStyle = "#616e59";
    c.fillRect(684, 114, 18, 8);
  }
  private tree(c: CanvasRenderingContext2D, x: number, y: number) {
    c.fillStyle = "#40513a55";
    c.fillRect(x - 18, y + 10, 50, 22);
    c.fillStyle = "#746345";
    c.fillRect(x - 4, y + 4, 11, 26);
    c.fillStyle = "#9c8960";
    c.fillRect(x - 4, y + 5, 4, 25);
    c.fillStyle = "#3f613d";
    c.fillRect(x - 24, y - 18, 50, 28);
    c.fillRect(x - 16, y - 30, 34, 15);
    c.fillRect(x - 17, y + 7, 38, 9);
    c.fillStyle = "#527644";
    c.fillRect(x - 18, y - 22, 31, 24);
    c.fillRect(x - 8, y - 30, 24, 20);
    c.fillStyle = "#648751";
    c.fillRect(x - 13, y - 21, 15, 6);
    c.fillRect(x + 1, y - 29, 9, 5);
  }
  private sprite(
    c: CanvasRenderingContext2D,
    map: string[],
    x: number,
    y: number,
    scale: number,
    flip: boolean,
  ) {
    c.save();
    c.translate(Math.round(x), Math.round(y));
    c.scale(flip ? -1 : 1, 1);
    map.forEach((row, dy) =>
      [...row].forEach((color, dx) => {
        if (color !== ".") {
          c.fillStyle = COLORS[color] || "#333";
          c.fillRect((dx - 4) * scale, (dy - map.length) * scale, scale, scale);
        }
      }),
    );
    c.restore();
  }
  draw(
    f: Frame,
    options: {
      replay?: boolean;
      paused?: boolean;
      ghost?: Frame;
      idle?: boolean;
    } = {},
  ) {
    const c = this.canvas.getContext("2d")!;
    c.imageSmoothingEnabled = false;
    c.clearRect(0, 0, WIDTH, HEIGHT);
    c.drawImage(this.bg, 0, 0);
    if (options.ghost) {
      c.globalAlpha = 0.18;
      this.sprite(
        c,
        PLAYER,
        options.ghost.player.x,
        options.ghost.player.y + 12,
        3,
        false,
      );
      c.globalAlpha = 1;
    }
    for (const b of f.bullets) {
      c.fillStyle = b.owner === "player" ? "#ddd2f0" : "#f3ce91";
      c.fillRect(Math.round(b.x) - 4, Math.round(b.y) - 4, 8, 8);
      c.fillStyle = b.owner === "player" ? "#9582b6" : "#b97b53";
      c.fillRect(Math.round(b.x) - 2, Math.round(b.y) - 2, 4, 4);
    }
    const actors = [
      { a: f.player, map: PLAYER, name: "YOU", color: "#dfd6ee" },
      { a: f.rival, map: MOCHI, name: "MOCHI", color: "#f0d2a3" },
    ].sort((a, b) => a.a.y - b.a.y);
    for (const { a, map, name, color } of actors) {
      c.fillStyle = "#34482e40";
      c.fillRect(Math.round(a.x) - 12, Math.round(a.y) + 8, 25, 6);
      if (a.invulnerable > 0 && Math.floor(f.t * 22) % 2 === 0)
        c.globalAlpha = 0.4;
      const bob = options.idle
        ? Math.sin(f.t * 2) * 1.5
        : Math.abs(a.vx) + Math.abs(a.vy) > 5
          ? Math.sin(f.t * 18) * 2
          : 0;
      this.sprite(c, map, a.x, a.y + 10 + bob, 3, a.facing < 0);
      c.globalAlpha = 1;
      c.font = '9px "IBM Plex Mono", monospace';
      c.textAlign = "center";
      c.fillStyle = "#283e2caa";
      c.fillRect(a.x - 26, a.y - 49, 52, 16);
      c.fillStyle = color;
      c.fillText(name, a.x, a.y - 38);
      c.fillStyle = "#3b5039";
      c.fillRect(a.x - 19, a.y - 28, 38, 4);
      c.fillStyle = name === "YOU" ? "#d2c2e5" : "#efc385";
      c.fillRect(a.x - 19, a.y - 28, (38 * a.hp) / 100, 4);
    }
    if (f.player.dash > 1.55) {
      c.strokeStyle = "#dfd3e880";
      c.lineWidth = 2;
      c.strokeRect(f.player.x - 17, f.player.y - 29, 34, 43);
    }
    if (f.rival.attack > 0.15) {
      c.fillStyle = "#f1d38d";
      c.fillRect(f.rival.x - 2, f.rival.y - 57, 4, 5);
    }
    c.font = '8px "IBM Plex Mono", monospace';
    c.fillStyle = "#d8ddbd";
    c.textAlign = "left";
    c.fillText("THE LITTLE CLEARING", 48, 24);
    c.textAlign = "right";
    c.fillStyle = "#b1be91";
    c.fillText(
      options.replay
        ? "REPLAY / RECORDED POSITIONS"
        : options.paused
          ? "PAUSED"
          : options.idle
            ? "MOCHI IS WAITING"
            : "45 SECOND ROUNDS",
      750,
      24,
    );
  }
}
