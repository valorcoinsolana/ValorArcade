// Dev Bot Dodger - Phaser 3 single-file game scene
// Drop-in for: lobby/games/dev-bot-dodger/src/main.js

const W = 800;
const H = 450;

const SCAM_LINES = [
  "Link wallet to claim",
  "Urgent: wallet compromised",
  "Send 0.5 SOL to verify",
  "AirDrop ending in 5 mins",
  "Click to mint for free",
  "Support here: dm admin",
  "Your account is flagged",
  "Claim rewards now",
  "We need your seed phrase",
  "Verify to unlock access",
];

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function randItem(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function pad2(n) { return String(n).padStart(2, "0"); }

class DevBotDodger extends Phaser.Scene {
  constructor() {
    super("DevBotDodger");
    this.state = "PLAY"; // PLAY | GAMEOVER
  }

  create() {
    // Background
    this.add.rectangle(W / 2, H / 2, W, H, 0x0b0f14, 1);

    // Subtle dots
    const dots = this.add.graphics();
    dots.fillStyle(0xffffff, 0.05);
    for (let i = 0; i < 90; i++) {
      dots.fillCircle(
        Phaser.Math.Between(0, W),
        Phaser.Math.Between(0, H),
        Phaser.Math.Between(1, 2)
      );
    }

    // HUD
    this.titleText = this.add.text(16, 10, "Dev Bot Dodger", {
      fontFamily: "system-ui, Arial",
      fontSize: "18px",
      color: "#e6edf3",
    });

    this.timeText = this.add.text(16, 34, "Uptime: 00:00", {
      fontFamily: "system-ui, Arial",
      fontSize: "14px",
      color: "#cbd5e1",
    });

    this.hintText = this.add.text(W - 16, 12, "WASD/Arrows • Touch joystick", {
      fontFamily: "system-ui, Arial",
      fontSize: "12px",
      color: "#64748b",
    }).setOrigin(1, 0);

    // Player
    this.player = this.add.rectangle(W / 2, H / 2, 18, 18, 0x22c55e, 1);
    this.playerSpeed = 220; // px/sec

    // Keyboard
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys("W,A,S,D,R");

    // Enemies container
    this.bots = [];

    // Difficulty / spawning
    this.startTime = this.time.now;
    this.elapsedSeconds = 0;

    this.spawnTimer = 0;
    this.spawnInterval = 900; // ms, will ramp down
    this.maxBots = 60;

    // Game over UI
    this.gameOverTitle = this.add.text(W / 2, H / 2 - 18, "", {
      fontFamily: "system-ui, Arial",
      fontSize: "34px",
      color: "#e6edf3",
    }).setOrigin(0.5);

    this.gameOverSub = this.add.text(W / 2, H / 2 + 22, "", {
      fontFamily: "system-ui, Arial",
      fontSize: "14px",
      color: "#cbd5e1",
    }).setOrigin(0.5);

    // Touch joystick
    this.joy = this.createJoystick();

    // Restart triggers
    this.input.on("pointerdown", () => {
      if (this.state === "GAMEOVER") this.restart();
    });

    this.keys.R.on("down", () => {
      if (this.state === "GAMEOVER") this.restart();
    });
  }

  createJoystick() {
    // A very simple on-screen joystick:
    // - Appears when touch starts on left half
    // - Knob follows within radius
    // - Produces normalized dx/dy in [-1..1]
    const base = this.add.circle(90, H - 90, 44, 0x111827, 0.6).setVisible(false);
    base.setStrokeStyle(2, 0x334155, 0.8);

    const knob = this.add.circle(90, H - 90, 18, 0x1f2937, 0.8).setVisible(false);
    knob.setStrokeStyle(2, 0x475569, 0.9);

    const joy = {
      active: false,
      pointerId: null,
      cx: 90,
      cy: H - 90,
      radius: 44,
      dx: 0,
      dy: 0,
      base,
      knob,
    };

    this.input.on("pointerdown", (p) => {
      // only start joystick if touch/click begins on left side, not on UI
      if (this.state !== "PLAY") return;
      if (p.x > W * 0.55) return;

      joy.active = true;
      joy.pointerId = p.id;
      joy.cx = clamp(p.x, 60, W - 60);
      joy.cy = clamp(p.y, 60, H - 60);
      joy.base.setPosition(joy.cx, joy.cy).setVisible(true);
      joy.knob.setPosition(joy.cx, joy.cy).setVisible(true);
      joy.dx = 0; joy.dy = 0;
    });

    this.input.on("pointermove", (p) => {
      if (!joy.active) return;
      if (p.id !== joy.pointerId) return;

      const vx = p.x - joy.cx;
      const vy = p.y - joy.cy;
      const len = Math.hypot(vx, vy) || 1;

      const max = joy.radius;
      const sx = vx * Math.min(1, max / len);
      const sy = vy * Math.min(1, max / len);

      joy.knob.setPosition(joy.cx + sx, joy.cy + sy);

      // Normalize to [-1..1]
      joy.dx = clamp(sx / max, -1, 1);
      joy.dy = clamp(sy / max, -1, 1);
    });

    const endJoy = (p) => {
      if (!joy.active) return;
      if (p.id !== joy.pointerId) return;
      joy.active = false;
      joy.pointerId = null;
      joy.base.setVisible(false);
      joy.knob.setVisible(false);
      joy.dx = 0; joy.dy = 0;
    };

    this.input.on("pointerup", endJoy);
    this.input.on("pointerupoutside", endJoy);

    return joy;
  }

  spawnBot() {
    if (this.bots.length >= this.maxBots) return;

    const side = Phaser.Math.Between(0, 3);
    let x, y;

    if (side === 0) { x = -20; y = Phaser.Math.Between(0, H); } // left
    if (side === 1) { x = W + 20; y = Phaser.Math.Between(0, H); } // right
    if (side === 2) { x = Phaser.Math.Between(0, W); y = -20; } // top
    if (side === 3) { x = Phaser.Math.Between(0, W); y = H + 20; } // bottom

    const bot = this.add.rectangle(x, y, 18, 18, 0xef4444, 1);
    bot.setStrokeStyle(2, 0x7f1d1d, 0.9);

    const bubble = this.add.text(x, y - 26, randItem(SCAM_LINES), {
      fontFamily: "system-ui, Arial",
      fontSize: "12px",
      color: "#e6edf3",
      backgroundColor: "rgba(15,23,42,0.85)",
      padding: { left: 8, right: 8, top: 4, bottom: 4 },
    }).setOrigin(0.5);

    // Add a subtle outline by stroke (Phaser text stroke)
    bubble.setStroke("#0b0f14", 4);

    const speedBase = 70; // base bot speed
    const botObj = {
      bot,
      bubble,
      speed: speedBase,
    };

    this.bots.push(botObj);
  }

  update(time, delta) {
    if (this.state !== "PLAY") return;

    // Time survived
    this.elapsedSeconds = Math.max(0, Math.floor((time - this.startTime) / 1000));
    const mm = Math.floor(this.elapsedSeconds / 60);
    const ss = this.elapsedSeconds % 60;
    this.timeText.setText(`Uptime: ${pad2(mm)}:${pad2(ss)}`);

    // Difficulty ramp
    // - increase spawn rate
    // - increase bot speed slowly
    const t = this.elapsedSeconds;
    this.spawnInterval = clamp(900 - t * 10, 260, 900); // from 900ms down to 260ms
    const botSpeedBoost = clamp(t * 1.2, 0, 180); // speed grows with time

    // Spawn bots
    this.spawnTimer += delta;
    while (this.spawnTimer >= this.spawnInterval) {
      this.spawnTimer -= this.spawnInterval;
      this.spawnBot();
    }

    // Movement input (keyboard + joystick)
    let ix = 0, iy = 0;

    // Keyboard
    if (this.cursors.left.isDown || this.keys.A.isDown) ix -= 1;
    if (this.cursors.right.isDown || this.keys.D.isDown) ix += 1;
    if (this.cursors.up.isDown || this.keys.W.isDown) iy -= 1;
    if (this.cursors.down.isDown || this.keys.S.isDown) iy += 1;

    // Joystick overrides/adds
    if (this.joy && this.joy.active) {
      ix += this.joy.dx;
      iy += this.joy.dy;
    }

    // Normalize movement
    const len = Math.hypot(ix, iy);
    if (len > 0) { ix /= len; iy /= len; }

    const px = this.player.x + ix * this.playerSpeed * (delta / 1000);
    const py = this.player.y + iy * this.playerSpeed * (delta / 1000);

    this.player.x = clamp(px, 12, W - 12);
    this.player.y = clamp(py, 12, H - 12);

    // Update bots: chase player, update bubbles, check collision
    for (let i = 0; i < this.bots.length; i++) {
      const b = this.bots[i];

      const dx = this.player.x - b.bot.x;
      const dy = this.player.y - b.bot.y;
      const d = Math.hypot(dx, dy) || 1;

      const speed = b.speed + botSpeedBoost;

      b.bot.x += (dx / d) * speed * (delta / 1000);
      b.bot.y += (dy / d) * speed * (delta / 1000);

      // Bubble follows
      b.bubble.x = b.bot.x;
      b.bubble.y = b.bot.y - 28;

      // Collision (simple AABB using sizes)
      const hit = Math.abs(this.player.x - b.bot.x) < 16 && Math.abs(this.player.y - b.bot.y) < 16;
      if (hit) {
        this.gameOver();
        break;
      }
    }
  }

  gameOver() {
    this.state = "GAMEOVER";

    this.gameOverTitle.setText("You got rugged.");
    this.gameOverSub.setText("Tap to retry • Press R");

    // Freeze bots visually (no update since state changes)
    // Optional: tint player red
    this.player.fillColor = 0xf97316;
  }

  restart() {
    // Destroy bots and bubbles
    for (const b of this.bots) {
      b.bot.destroy();
      b.bubble.destroy();
    }
    this.bots = [];

    // Reset player
    this.player.x = W / 2;
    this.player.y = H / 2;
    this.player.fillColor = 0x22c55e;

    // Reset timers
    this.startTime = this.time.now;
    this.spawnTimer = 0;
    this.elapsedSeconds = 0;

    // Reset UI
    this.gameOverTitle.setText("");
    this.gameOverSub.setText("");
    this.state = "PLAY";
  }
}

new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  backgroundColor: "#0b0f14",
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: W,
    height: H,
  },
  scene: [DevBotDodger],
});
