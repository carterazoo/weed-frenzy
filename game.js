// Weed Frenzy prototype (milestone 1)
// One map, 2 dispensaries, orders with patience rings, 5 stars, tips, level timer,
// BLAZE combo letters. Art lives in the assets folder.

// Phones held upright get a portrait layout (map on top, panel below);
// everything else gets the landscape layout (panel on the right).
const PORTRAIT = window.innerHeight > window.innerWidth;
const W = PORTRAIT ? 720 : 960;
const H = PORTRAIT ? 1360 : 720;
const RES = 2;            // render scale for sharpness

// Every text object renders at the same double resolution.
const _addText = Phaser.GameObjects.GameObjectFactory.prototype.text;
Phaser.GameObjects.GameObjectFactory.prototype.text = function (x, y, text, style) {
  return _addText.call(this, x, y, text, { resolution: RES, ...style });
};
// Square map on computers, tall map on phones (720 x 1080).
const MAP_W = 720;
const MAP_H = PORTRAIT ? 1080 : 720;
const MAP_FILE = PORTRAIT ? 'assets/map-suburbs-tall.jpg' : 'assets/map-suburbs.jpg';

// Where the panel pieces go in each layout (game coordinates).
const HUD = PORTRAIT ? {
  panel: { key: 'ui-panel-wide', x: 360, y: 1220, w: 712, h: 272 }, bg: [360, 1220, 720, 280],
  cards: [[530, 1172], [530, 1268]], cardK: 0.95,
  note: { x: 95, y: 1215, w: 140, h: 134, k: 1.03 },
  jar: { x: 400, y: 1220, w: 141, h: 200 },
  cash: { x: 250, y: 1185, w: 150, h: 46, k: 1.2 },
  stars: Array.from({ length: 5 }, (_, i) => [250 + (i - 2) * 30, 1245]), starSize: 29,
  pause: { x: 644, y: 1220, w: 106, h: 72, k: 0.85 },
} : {
  panel: { key: 'ui-panel', x: 840, y: 360, w: 236, h: 714 }, bg: [840, 360, 240, 720],
  cards: [[786, 60], [894, 60]], cardK: 1,
  note: { x: 840, y: 166, w: 136, h: 130, k: 1 },
  jar: { x: 840, y: 340, w: 141, h: 200 },
  cash: { x: 840, y: 464, w: 150, h: 40, k: 1 },
  stars: Array.from({ length: 5 }, (_, i) => [840, 508 + i * 31]), starSize: 31,
  pause: { x: 840, y: 684, w: 150, h: 57, k: 1 },
};
const TAP = ('ontouchstart' in window) ? 'tap' : 'click';
const JK = HUD.jar.h / 200;   // jar scale relative to the original 200 px jar

// Turning the phone switches layouts, which needs a reload.
window.addEventListener('resize', () => {
  if ((window.innerHeight > window.innerWidth) !== PORTRAIT) location.reload();
});

// ---- Tuning knobs (change these to adjust difficulty) ----
const LEVEL_SECONDS = 90;      // level length
const CASH_TARGET = 250;       // cash needed to pass the level
const START_STARS = 5;
const PATIENCE_MS = 14000;     // how long a customer waits (ms)
const ORDER_PAY = 10;          // base pay per correct order
const TIP_MIN = 3, TIP_MAX = 8;
const TIP_LIFETIME_MS = 3000;  // how long a tip stays clickable
const SPAWN_START_MS = 2600;   // gap between orders at level start
const SPAWN_END_MS = 1300;     // gap between orders near the end
const RUSH_SECONDS = 20;       // rush hour: last N seconds spawn twice as fast

// Combo word: each same-product order in a row lights one letter at that
// dispensary. Light the whole word for a frenzy bonus. Any 5-letter word works.
const COMBO_WORD = 'BLAZE';
const FRENZY_BONUS = 50;
const JAR_ITEMS = 34;

// The robber: looks like a normal order. Serve him and he steals some of your
// cash; ignore him and he leaves with no penalty.
const ROBBER_CHANCE = 0.12;       // chance each new order is the robber
const ROBBER_AFTER_SECONDS = 15;  // he doesn't show up until this far into a level
const ROBBER_STEAL = 0.25;        // share of your cash he takes
const ROBBER_FILE = 'assets/cust-robber.png';

// Start screen logo. Set to 'assets/logo.png' once you have one.
const LOGO_FILE = 'assets/logo.png';

// Sounds. Put MP3s in assets/sounds/ and fill in the file names, e.g.
//   pop: 'assets/sounds/pop.mp3'
// Any left as null are simply skipped.
const SOUNDS = {
  music: null,     // background loop
  pop: 'assets/sounds/pop.mp3',       // a customer appears
  pickup: 'assets/sounds/pickup.mp3',    // you pick up an order
  deliver: null,   // order sent to the right shop
  tip: 'assets/sounds/tip.mp3',       // tip collected
  letter: null,    // a BLAZE letter lights
  frenzy: null,    // WEED FRENZY!
  miss: null,      // too slow / wrong shop
  gameover: null,  // level over
};          // bills and coins in a full jar
const FRENZY_TEXT = 'WEED FRENZY!';   // banner shown when the word is complete

// How many orders of the same product you can pick up before clicking a shop.
// (Later this can grow with product tiers, like the original.)
const MAX_CARRY = 3;

// Products. Swap names, colors and icon files here.
const PRODUCTS = [
  { key: 'flower',  name: 'Flower',  icon: 'icon-flower',  color: 0x6abf2e },
  { key: 'gummies', name: 'Gummies', icon: 'icon-gummies', color: 0xe040a0 },
];

// Customers who phone in orders (face images in assets). The narc is saved
// for the narc mechanic, so he isn't in the regular rotation.
const CUSTOMERS = ['cust-yoga', 'cust-hoodie', 'cust-conspiracy', 'cust-stoner', 'cust-rapper'];

// Positions on each map (map coordinates).
// Shops: x, y, w, h = clickable area over the painted shop; door = where couriers
// leave; lx, ly = where the combo letters sit.
// Houses: a door (courier stop, tip drop) and a bubble spot above the roof, per row.
// Roads: centerlines used to route the courier along the streets.
const MAPS = {
  square: {   // assets/map-suburbs.jpg, 720 x 720, 12 houses
    shops: [
      { product: 'flower',  name: 'Green Leaf', x: 203, y: 577, w: 178, h: 168, door: [205, 650], lx: 203, ly: 699 },
      { product: 'gummies', name: 'Sugar High', x: 515, y: 577, w: 182, h: 168, door: [515, 650], lx: 515, ly: 699 },
    ],
    houseX: [148, 252, 470, 575],
    rows: [{ door: 170, bubble: 76 }, { door: 307, bubble: 214 }, { door: 445, bubble: 352 }],
    roadX: [67, 318, 401, 652],
    roadY: [69, 208, 346, 487, 694],
  },
  tall: {     // assets/map-suburbs-tall.jpg, 720 x 1080, 12 big houses
    shops: [
      { product: 'flower',  name: 'Green Leaf', x: 175, y: 870, w: 260, h: 240, door: [178, 985], lx: 175, ly: 1058 },
      { product: 'gummies', name: 'Sugar High', x: 540, y: 870, w: 265, h: 240, door: [540, 985], lx: 540, ly: 1058 },
    ],
    houseX: [112, 246, 478, 612],
    bubbleX: [96, 264, 460, 628],   // nudged apart so the big phone faces don't overlap
    rows: [{ door: 200, bubble: 88 }, { door: 438, bubble: 326 }, { door: 674, bubble: 563 }],
    roadX: [15, 324, 395, 705],
    roadY: [15, 262, 498, 733, 1020],
  },
};
const M = PORTRAIT ? MAPS.tall : MAPS.square;
const DISPENSARIES = M.shops;
const ROAD_X = M.roadX;
const ROAD_Y = M.roadY;
const COURIER_SPEED = 0.42;                 // pixels per millisecond
const HOUSE_X = M.houseX;
const HOUSE_ROWS = M.rows;
const HOUSES = HOUSE_ROWS.flatMap(r => HOUSE_X.map((x, i) =>
  ({ door: [x, r.door], bubble: [M.bubbleX ? M.bubbleX[i] : x, r.bubble] })));

// Size of customer faces, badges and rings (bigger on phones).
const FACE_K = PORTRAIT ? 1.75 : 1;
// Size of the courier, tips, combo letters and pop-up text (bigger on phones).
const UI_K = PORTRAIT ? 1.35 : 1;

const productByKey = Object.fromEntries(PRODUCTS.map(p => [p.key, p]));

// ---------- Start screen (also loads all the art and sound) ----------
class TitleScene extends Phaser.Scene {
  constructor() { super('title'); }

  preload() {
    this.load.image('map', MAP_FILE);
    this.load.image('icon-flower', 'assets/icon-flower.png');
    this.load.image('icon-gummies', 'assets/icon-gummies.png');
    this.load.image('courier', 'assets/courier.png');
    this.load.image('tip', 'assets/tip.png');
    this.load.image('jar-coin', 'assets/jar-coin.png');
    this.load.image('jar-bill', 'assets/jar-bill.png');
    for (let i = 0; i < COMBO_WORD.length; i++) {
      this.load.image(`letter-${i}-off`, `assets/letter-${i}-off.png`);
      this.load.image(`letter-${i}-on`, `assets/letter-${i}-on.png`);
    }
    [...CUSTOMERS, 'cust-narc'].forEach(k => this.load.image(k, `assets/${k}.png`));
    ['ui-panel', 'ui-panel-wide', 'ui-jar', 'ui-note', 'ui-button', 'star-full', 'star-empty']
      .forEach(k => this.load.image(k, `assets/${k}.png`));
    if (LOGO_FILE) this.load.image('logo', LOGO_FILE);
    if (ROBBER_FILE) this.load.image('cust-robber', ROBBER_FILE);
    Object.entries(SOUNDS).forEach(([k, file]) => { if (file) this.load.audio(k, file); });
  }

  create() {
    this.cameras.main.setZoom(RES).centerOn(W / 2, H / 2);

    // Dimmed map behind everything
    this.add.image(W / 2, H / 2, 'map').setDisplaySize(H * MAP_W / MAP_H, H);
    this.add.rectangle(W / 2, H / 2, W, H, 0x0c0a12, 0.6);
    const OY = (H - 720) / 2;   // centers the layout on tall phone screens

    // Logo: the real image once assets/logo.png exists, a text stand-in until then
    if (this.textures.exists('logo')) {
      const logo = this.add.image(W / 2, OY + 124, 'logo');
      logo.setScale(Math.min(560 / logo.width, 226 / logo.height));
      this.tweens.add({ targets: logo, scale: logo.scale * 1.04, yoyo: true, repeat: -1, duration: 900, ease: 'Sine.InOut' });
    } else {
      this.add.text(W / 2, OY + 130, 'WEED FRENZY', {
        fontFamily: 'Arial Black, Arial', fontSize: '76px', color: '#8ee34a',
        stroke: '#1b3a0e', strokeThickness: 14,
      }).setOrigin(0.5);
    }

    // How to play
    const box = this.add.graphics();
    box.fillStyle(0x14121c, 0.88).fillRoundedRect(W / 2 - 300, OY + 248, 600, 362, 22);
    box.lineStyle(4, 0x8ee34a).strokeRoundedRect(W / 2 - 300, OY + 248, 600, 362, 22);
    this.add.text(W / 2, OY + 282, 'HOW TO PLAY', {
      fontFamily: 'Arial Black, Arial', fontSize: '26px', color: '#ffd54f',
    }).setOrigin(0.5);
    const steps = [
      'Customers pop up wanting Flower or Gummies.',
      `${TAP === 'tap' ? 'Tap' : 'Click'} or drag them to the shop that sells it.`,
      'Grab up to 3 of the same item and send them at once.',
      'Same item in a row lights up B-L-A-Z-E. Fill it for a WEED FRENZY bonus!',
      `${TAP === 'tap' ? 'Tap' : 'Click'} the cash tips before they disappear.`,
      'Leave the guy in the ski mask alone. Serve him and he robs you!',
      `Too slow or wrong shop costs a star. Make $${CASH_TARGET} before time runs out.`,
    ];
    this.add.text(W / 2 - 270, OY + 314, steps.map((t, i) => `${i + 1}.  ${t}`).join('\n'), {
      fontFamily: 'Arial', fontSize: '18px', color: '#ffffff', lineSpacing: 8,
      wordWrap: { width: 540 },
    });

    const start = this.add.text(W / 2, OY + 656, `${TAP.toUpperCase()} TO START`, {
      fontFamily: 'Arial Black, Arial', fontSize: '34px', color: '#ffffff',
      stroke: '#1b3a0e', strokeThickness: 8,
    }).setOrigin(0.5);
    this.tweens.add({ targets: start, scale: 1.08, yoyo: true, repeat: -1, duration: 600 });

    // The first click also unlocks sound in the browser.
    this.input.once('pointerdown', () => {
      // Safari can leave audio asleep until it's explicitly woken on a tap.
      const ctx = this.sound.context;
      if (ctx && ctx.state !== 'running') ctx.resume();
      if (this.sound.unlock) this.sound.unlock();
      this.scene.start('game');
    });
  }
}

// Plays a sound only if its file is set in SOUNDS (silently skips otherwise).
function sfx(scene, key, config) {
  if (scene.cache.audio.exists(key)) scene.sound.play(key, config);
}

class GameScene extends Phaser.Scene {
  constructor() { super('game'); }


  create() {
    this.cameras.main.setZoom(RES).centerOn(W / 2, H / 2);
    this.makeJarTextures();
    this.sound.stopAll();
    sfx(this, 'music', { loop: true, volume: 0.35 });
    this.cash = 0;
    this.stars = START_STARS;
    this.timeLeft = LEVEL_SECONDS * 1000;
    this.nextSpawn = 800;
    this.selected = [];
    this.orders = [];
    this.comboProduct = null;
    this.comboCount = 0;
    this.over = false;
    this.paused = false;
    this.time.paused = false;

    this.drawMap();
    this.houses = HOUSES.map(h => this.makeHouse(h));
    this.dispensaries = DISPENSARIES.map(d => this.makeDispensary(d));
    this.makeHud();

    this.ringGfx = this.add.graphics().setDepth(5);

    // Clicking empty ground cancels the current selection.
    this.setupDragging();

    this.input.on('pointerdown', (pointer, objects) => {
      if (!this.over && objects.length === 0) this.select(null);
    });

    this.showBanner('Click a customer, then the dispensary\nthat sells what they want.', 2500);
  }

  // ---------- Map ----------
  drawMap() {
    this.add.image(0, 0, 'map').setOrigin(0).setDisplaySize(MAP_W, MAP_H);
  }

  makeHouse(h) {
    return { x: h.door[0], y: h.door[1], bx: h.bubble[0], by: h.bubble[1], order: null };
  }

  makeDispensary(d) {
    const p = productByKey[d.product];
    // Invisible click zone over the painted shop; glows on hover.
    const box = this.add.rectangle(d.x, d.y, d.w, d.h, 0xffffff, 0.001)
      .setInteractive({ useHandCursor: true });
    const glow = this.add.rectangle(d.x, d.y, d.w, d.h).setStrokeStyle(5, p.color).setVisible(false);

    // Combo letters on a dark pill, dim until lit.
    // (Letter images: assets/letter-<n>-off.png / -on.png, drawn for BLAZE.)
    this.add.rectangle(d.lx, d.ly, (COMBO_WORD.length * 31 + 14) * UI_K, 40 * UI_K, 0x14121c, 0.6).setDepth(3);
    const letters = COMBO_WORD.split('').map((ch, i) => {
      const img = this.add.image(d.lx + (i - (COMBO_WORD.length - 1) / 2) * 31 * UI_K, d.ly, `letter-${i}-off`)
        .setDepth(4);
      img.setScale(34 * UI_K / img.height);
      img.baseScale = img.scale;
      return img;
    });

    const disp = { ...d, x: d.door[0], y: d.door[1], box, glow, letters, color: p.color };
    box.on('pointerdown', () => this.onDispensaryClick(disp));
    box.on('pointerover', () => glow.setVisible(true));
    box.on('pointerout', () => glow.setVisible(false));
    return disp;
  }

  // ---------- HUD ----------
  makeHud() {
    const label = (x, y, txt, size, color = '#3b2a1a') => this.add.text(x, y, txt, {
      fontFamily: 'Arial Black, Arial', fontSize: size, color, align: 'center', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(32);

    const px = n => `${Math.round(n)}px`;

    // Wooden panel (side panel on computers, bottom panel on phones)
    this.add.rectangle(...HUD.bg, 0x2b1a0e).setDepth(29);
    this.add.image(HUD.panel.x, HUD.panel.y, HUD.panel.key).setDisplaySize(HUD.panel.w, HUD.panel.h).setDepth(30);

    // Product cards: icon + price per order
    const ck = HUD.cardK;
    PRODUCTS.forEach((p, i) => {
      const [cx, cy] = HUD.cards[i];
      this.add.rectangle(cx, cy, 96 * ck, 84 * ck, 0x2a2438).setStrokeStyle(4, p.color).setDepth(31);
      this.add.image(cx, cy - 10 * ck, p.icon).setDisplaySize(46 * ck, 46 * ck).setDepth(32);
      label(cx, cy + 26 * ck, `$${ORDER_PAY}`, px(16 * ck), '#ffffff');
    });

    // Note card: time left
    const n = HUD.note;
    this.add.image(n.x, n.y, 'ui-note').setDisplaySize(n.w, n.h).setDepth(31);
    label(n.x - 4 * n.k, n.y - 6 * n.k, 'TIME LEFT', px(14 * n.k));
    this.timeText = label(n.x - 4 * n.k, n.y + 24 * n.k, '', px(32 * n.k));

    // Tips jar: fills up toward the cash target
    const j = HUD.jar;
    this.add.image(j.x, j.y, 'ui-jar').setDisplaySize(j.w, j.h).setDepth(31);
    this.jarItems = [];
    label(j.x, j.y + 14 * JK, `GOAL\n$${CASH_TARGET}`, px(17 * JK)).setDepth(34);

    // Cash
    const c = HUD.cash;
    this.add.rectangle(c.x, c.y, c.w, c.h, 0x14121c, 0.85).setStrokeStyle(3, 0x000000).setDepth(31);
    this.cashText = label(c.x, c.y, '', px(24 * c.k), '#c5ff9e');

    // Stars
    this.starIcons = HUD.stars.map(([x, y]) =>
      this.add.image(x, y, 'star-full').setDisplaySize(HUD.starSize, HUD.starSize * 0.97).setDepth(32));

    // Pause button
    const pz = HUD.pause;
    const btn = this.add.image(pz.x, pz.y, 'ui-button').setDisplaySize(pz.w, pz.h).setDepth(31)
      .setInteractive({ useHandCursor: true });
    this.pauseText = label(pz.x, pz.y - 1, 'PAUSE', px(20 * pz.k), '#ffffff');
    this.pauseText.setStroke('#3b2a1a', 5);
    btn.on('pointerdown', () => this.togglePause());

    this.updateHud();
  }

  updateHud() {
    this.cashText.setText(`$${this.cash}`);
    const s = Math.max(0, Math.ceil(this.timeLeft / 1000));
    this.timeText.setText(`${s}`);
    this.timeText.setColor(s <= RUSH_SECONDS ? '#d84315' : '#3b2a1a');
    this.starIcons.forEach((img, i) => img.setTexture(i < this.stars ? 'star-full' : 'star-empty'));

    // Bills and coins pile up in the jar as cash comes in.
    const frac = Phaser.Math.Clamp(this.cash / CASH_TARGET, 0, 1);
    const want = Math.floor(frac * JAR_ITEMS);
    while (this.jarItems.length < want) this.addJarItem();
    while (this.jarItems.length > want) {   // money taken out (robbed): it flies away
      const item = this.jarItems.pop();
      this.tweens.add({
        targets: item, y: item.y - 120 * JK, x: item.x + Phaser.Math.Between(-60, 60) * JK,
        alpha: 0, angle: item.angle + 180, duration: 600, onComplete: () => item.destroy(),
      });
    }
  }

  // Simple bill and coin pictures drawn in code. Real art can replace them:
  // add assets/jar-bill.png and jar-coin.png and load them under these keys.
  makeJarTextures() {
    // Placeholder robber face (black ski mask) until real art is added.
    if (!this.textures.exists('cust-robber')) {
      const g = this.make.graphics({ add: false });
      g.fillStyle(0xf6e7a8).fillCircle(64, 64, 64);
      g.fillStyle(0x111111).fillCircle(64, 64, 58);
      g.fillStyle(0x2a2a2a).fillEllipse(64, 30, 70, 26);
      g.fillStyle(0xd9a066).fillRoundedRect(30, 46, 68, 24, 10);
      g.fillStyle(0xffffff).fillCircle(48, 58, 8).fillCircle(80, 58, 8);
      g.fillStyle(0x000000).fillCircle(50, 59, 4).fillCircle(82, 59, 4);
      g.fillStyle(0xd9a066).fillEllipse(64, 92, 26, 14);
      g.fillStyle(0x7a1f1f).fillEllipse(64, 93, 16, 7);
      g.generateTexture('cust-robber', 128, 128);
      g.destroy();
    }
    if (!this.textures.exists('jar-coin')) {
      const g = this.make.graphics({ add: false });
      g.fillStyle(0x3b2a1a).fillCircle(12, 12, 12);
      g.fillStyle(0xf2b827).fillCircle(12, 12, 10);
      g.fillStyle(0xffe27a).fillCircle(10, 10, 6);
      g.generateTexture('jar-coin', 24, 24);
      g.destroy();
    }
    if (!this.textures.exists('jar-bill')) {
      const g = this.make.graphics({ add: false });
      g.fillStyle(0x1f3d14).fillRoundedRect(0, 0, 36, 20, 4);
      g.fillStyle(0x6abf45).fillRoundedRect(2, 2, 32, 16, 3);
      g.fillStyle(0x3f8a2a).fillCircle(18, 10, 5);
      g.fillStyle(0x3f8a2a).fillRect(5, 5, 4, 10).fillRect(27, 5, 4, 10);
      g.generateTexture('jar-bill', 36, 20);
      g.destroy();
    }
  }

  addJarItem() {
    const n = this.jarItems.length;
    const j = HUD.jar;
    const top = j.y - 44 * JK, bottom = j.y + 84 * JK;
    const y = bottom - (n / JAR_ITEMS) * (bottom - top) - Phaser.Math.Between(0, 6) * JK;
    const isBill = Math.random() < 0.55;
    const spread = (isBill ? 42 : 50) * JK;
    const x = j.x + Phaser.Math.FloatBetween(-spread, spread);
    const item = this.add.image(x, j.y - 70 * JK, isBill ? 'jar-bill' : 'jar-coin')
      .setDepth(32).setAngle(Phaser.Math.Between(-35, 35));
    if (isBill) item.setDisplaySize(42 * JK, 28 * JK); else item.setDisplaySize(26 * JK, 26 * JK);
    this.jarItems.push(item);
    this.tweens.add({ targets: item, y, duration: 350, ease: 'Bounce.Out' });
  }

  togglePause() {
    if (this.over) return;
    this.paused = !this.paused;
    this.time.paused = this.paused;
    if (this.paused) {
      this.tweens.pauseAll();
      this.sound.pauseAll();
      this.select(null);
      this.pauseCover = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.6)
        .setDepth(45).setInteractive();
      this.pauseCover.on('pointerdown', () => this.togglePause());
      this.pauseLabel = this.add.text(MAP_W / 2, MAP_H / 2, `PAUSED\n${TAP} to resume`, {
        fontFamily: 'Arial Black, Arial', fontSize: '40px', color: '#ffffff', align: 'center',
      }).setOrigin(0.5).setDepth(46);
      this.pauseText.setText('RESUME');
    } else {
      this.tweens.resumeAll();
      this.sound.resumeAll();
      this.pauseCover.destroy();
      this.pauseLabel.destroy();
      this.pauseText.setText('PAUSE');
    }
  }

  // ---------- Orders ----------
  spawnOrder() {
    const free = this.houses.filter(h => !h.order);
    if (free.length === 0) return;
    const house = Phaser.Utils.Array.GetRandom(free);
    const product = Phaser.Utils.Array.GetRandom(PRODUCTS);
    const bx = house.bx, by = house.by;

    // Customer's face in a circle (the part you click or drag), with a small
    // badge on the corner showing what they want.
    const elapsed = LEVEL_SECONDS * 1000 - this.timeLeft;
    const robber = elapsed > ROBBER_AFTER_SECONDS * 1000 && Math.random() < ROBBER_CHANCE;
    const customer = robber ? 'cust-robber' : Phaser.Utils.Array.GetRandom(CUSTOMERS);
    const K = FACE_K;
    const bubble = this.add.circle(bx, by, 35 * K, 0x14121c, 0.9)
      .setStrokeStyle(3, product.color)
      .setDepth(6)
      // Tap zone is wider than the picture so near misses still count.
      .setInteractive({ hitArea: new Phaser.Geom.Circle(35 * K, 35 * K, 50 * K), hitAreaCallback: Phaser.Geom.Circle.Contains, useHandCursor: true });
    const face = this.add.image(bx, by, customer).setDisplaySize(65 * K, 65 * K).setDepth(7);
    const badge = this.add.circle(bx + 29 * K, by + 26 * K, 21 * K, 0x14121c, 0.95)
      .setStrokeStyle(3, product.color).setDepth(8);
    const icon = this.add.image(bx + 29 * K, by + 26 * K, product.icon).setDisplaySize(34 * K, 34 * K).setDepth(9);

    const order = { house, product, customer, robber, bubble, icon, parts: [bubble, face, badge, icon], x: bx, y: by, waited: 0 };
    house.order = order;
    this.orders.push(order);
    sfx(this, 'pop', { volume: 0.5 });
    // Click to pick up (on release, so a drag doesn't count as a click),
    // or drag it onto a shop.
    bubble.orderRef = order;
    this.input.setDraggable(bubble);
    bubble.on('pointerup', () => {
      if (this.justDragged) return;
      this.toggleSelect(order);
    });

    // Pop-in animation
    order.parts.forEach(part => {
      const full = part.scale;
      part.setScale(0);
      this.tweens.add({ targets: part, scale: full, duration: 180, ease: 'Back.Out' });
    });
  }

  // Click a bubble to pick it up. Click more bubbles of the same product to
  // carry several (up to MAX_CARRY). Clicking a different product starts over;
  // clicking a picked-up bubble again puts it back.
  toggleSelect(order) {
    if (this.over) return;
    if (this.selected.includes(order)) {
      this.unmark(order);
      this.selected = this.selected.filter(o => o !== order);
      return;
    }
    if (this.selected.length && this.selected[0].product !== order.product) this.select(null);
    if (this.selected.length >= MAX_CARRY) {
      this.floatText(order.x, order.y - 30, `Max ${MAX_CARRY}!`, '#ffffff');
      return;
    }
    this.selected.push(order);
    sfx(this, 'pickup', { volume: 0.6 });
    order.bubble.setStrokeStyle(5, 0xffffff);
    this.tweens.add({ targets: order.bubble, scale: { from: 1.25, to: 1 }, duration: 150 });
  }

  // ---------- Dragging ----------
  setupDragging() {
    this.input.dragDistanceThreshold = 8;   // a tiny wobble still counts as a click

    this.input.on('dragstart', (pointer, obj) => {
      const order = obj.orderRef;
      if (this.over || this.paused || !order) return;
      // The dragged order joins the carried batch (or starts a new one).
      if (!this.selected.includes(order)) this.toggleSelect(order);
      if (!this.selected.includes(order)) return;   // batch full

      // A copy of the icon follows the pointer, with a count when carrying several.
      const ghost = this.add.container(pointer.worldX, pointer.worldY).setDepth(50);
      ghost.add(this.add.circle(0, 0, 34, 0x14121c, 0.85).setStrokeStyle(4, 0xffffff));
      ghost.add(this.add.image(0, 0, order.product.icon).setDisplaySize(52, 52));
      if (this.selected.length > 1) {
        ghost.add(this.add.text(26, -31, `x${this.selected.length}`, {
          fontFamily: 'Arial', fontSize: '18px', color: '#ffffff', fontStyle: 'bold',
          stroke: '#000000', strokeThickness: 4,
        }).setOrigin(0.5));
      }
      this.dragGhost = ghost;
    });

    this.input.on('drag', (pointer) => {
      if (!this.dragGhost) return;
      this.dragGhost.setPosition(pointer.worldX, pointer.worldY);
      this.dispensaries.forEach(d =>
        d.glow.setVisible(d.box.getBounds().contains(pointer.worldX, pointer.worldY)));
    });

    this.input.on('dragend', (pointer) => {
      this.justDragged = true;
      this.time.delayedCall(50, () => { this.justDragged = false; });
      if (!this.dragGhost) return;
      this.dragGhost.destroy();
      this.dragGhost = null;
      this.dispensaries.forEach(d => d.glow.setVisible(false));
      const target = this.dispensaries.find(d =>
        d.box.getBounds().contains(pointer.worldX, pointer.worldY));
      if (target) this.onDispensaryClick(target);
      // Dropped anywhere else: the orders stay picked up.
    });
  }

  // select(null) drops everything currently picked up.
  select(order) {
    this.selected.forEach(o => this.unmark(o));
    this.selected = [];
    if (order && !this.over) this.toggleSelect(order);
  }

  unmark(order) {
    if (order.bubble.active) order.bubble.setStrokeStyle(3, order.product.color);
  }

  removeOrder(order) {
    this.selected = this.selected.filter(o => o !== order);
    order.house.order = null;
    order.parts.forEach(part => { this.tweens.killTweensOf(part); part.destroy(); });
    this.orders = this.orders.filter(o => o !== order);
  }

  onDispensaryClick(disp) {
    if (this.over || this.selected.length === 0) return;
    const batch = [...this.selected];
    this.select(null);
    // Serving the robber from any shop gets you robbed.
    batch.filter(o => o.robber).forEach(o => this.getRobbed(o));
    const real = batch.filter(o => !o.robber);
    if (real.length === 0) return;
    if (real[0].product.key === disp.product) {
      sfx(this, 'deliver');
      real.forEach((order, i) => this.deliver(order, disp, i));
    } else {
      // Every order sent to the wrong shop is a miss.
      for (const order of real) {
        this.fail(order, 'Wrong shop!');
        if (this.over) break;
      }
    }
  }

  getRobbed(order) {
    const { house } = order;
    this.removeOrder(order);
    const stolen = Math.ceil(this.cash * ROBBER_STEAL);
    this.cash -= stolen;
    this.resetCombo();
    sfx(this, 'miss');
    this.cameras.main.shake(250, 0.008);
    this.floatText(house.bx, house.by - 30, stolen > 0 ? `ROBBED! -$${stolen}` : 'ROBBED!', '#ff5252');
    this.updateHud();
  }

  deliver(order, disp, i = 0) {
    const { house } = order;
    this.removeOrder(order);
    this.cash += ORDER_PAY;
    this.floatText(house.bx, house.by - 30, `+$${ORDER_PAY}`, '#c5ff9e');
    this.advanceCombo(disp);
    this.updateHud();

    // Courier rides from the dispensary along the roads to the house, then drops a tip.
    const path = this.roadPath(disp.x, disp.y, house.x, house.y);
    const courier = this.add.image(disp.x, disp.y, 'courier').setDisplaySize(58 * UI_K, 58 * UI_K).setDepth(8);
    const ride = { t: 0 };
    this.tweens.add({
      targets: ride, t: 1,
      duration: path.getLength() / COURIER_SPEED,
      delay: i * 250,
      onUpdate: () => {
        const p = path.getPoint(ride.t);
        if (Math.abs(p.x - courier.x) > 0.5) courier.setFlipX(p.x < courier.x);  // face travel direction
        courier.setPosition(p.x, p.y);
      },
      onComplete: () => {
        this.dropTip(house);
        this.tweens.add({ targets: courier, alpha: 0, duration: 250, onComplete: () => courier.destroy() });
      },
    });
  }

  // Route from a door down to the road below it, along to the best cross street,
  // over to the destination's road, then up to its door.
  roadPath(x1, y1, x2, y2) {
    const roadBelow = y => ROAD_Y.find(r => r > y) ?? ROAD_Y[ROAD_Y.length - 1];
    const ry1 = roadBelow(y1), ry2 = roadBelow(y2);
    const pts = [[x1, y1], [x1, ry1]];
    if (ry1 !== ry2) {
      const vx = ROAD_X.reduce((best, x) =>
        Math.abs(x1 - x) + Math.abs(x - x2) < Math.abs(x1 - best) + Math.abs(best - x2) ? x : best);
      pts.push([vx, ry1], [vx, ry2]);
    }
    pts.push([x2, ry2], [x2, y2]);
    const path = new Phaser.Curves.Path(x1, y1);
    let [px, py] = pts[0];
    for (const [x, y] of pts.slice(1)) {
      if (x !== px || y !== py) path.lineTo(x, y);   // skip zero-length legs
      [px, py] = [x, y];
    }
    return path;
  }

  dropTip(house) {
    if (this.over) return;
    const amount = Phaser.Math.Between(TIP_MIN, TIP_MAX);
    const tip = this.add.image(house.x + 28 * UI_K, house.y, 'tip').setDisplaySize(56 * UI_K, 56 * UI_K).setDepth(9);
    tip.setInteractive({ hitArea: new Phaser.Geom.Circle(tip.width / 2, tip.height / 2, tip.width * 0.75), hitAreaCallback: Phaser.Geom.Circle.Contains, useHandCursor: true });
    this.tweens.add({ targets: tip, y: tip.y - 6, yoyo: true, repeat: -1, duration: 300 });

    const expire = this.time.delayedCall(TIP_LIFETIME_MS, () => {
      this.tweens.killTweensOf(tip);
      this.tweens.add({ targets: tip, alpha: 0, duration: 200, onComplete: () => tip.destroy() });
    });
    tip.on('pointerdown', () => {
      if (this.over) return;
      expire.remove();
      this.tweens.killTweensOf(tip);
      tip.destroy();
      this.floatText(house.x + 26, house.y - 24, `tip +$${amount}`, '#ffe082');
      sfx(this, 'tip');
      // The tip flies over to the jar, then counts.
      const coin = this.add.image(house.x + 26, house.y, 'jar-coin').setDepth(40).setDisplaySize(36, 36);
      this.tweens.add({
        targets: coin, x: HUD.jar.x, y: HUD.jar.y - 78 * JK, scale: coin.scale * 0.7, duration: 500, ease: 'Quad.In',
        onComplete: () => { coin.destroy(); this.cash += amount; this.updateHud(); },
      });
    });
  }

  // ---------- Combo letters ----------
  advanceCombo(disp) {
    if (this.comboProduct === disp.product) {
      this.comboCount += 1;
    } else {
      this.resetCombo();
      this.comboProduct = disp.product;
      this.comboCount = 1;
    }
    this.lightLetters(disp);

    if (this.comboCount >= COMBO_WORD.length) {
      this.cash += FRENZY_BONUS;
      this.showFrenzy(disp);
      this.comboProduct = null;
      this.comboCount = 0;
      this.time.delayedCall(700, () => { if (!this.over) this.lightLetters(disp, 0); });
    }
  }

  lightLetters(disp, count = this.comboCount) {
    disp.letters.forEach((t, i) => {
      const lit = i < count;
      t.setTexture(`letter-${i}-${lit ? 'on' : 'off'}`);
      if (lit && i === count - 1) {
        sfx(this, 'letter', { volume: 0.7 });
        this.tweens.add({ targets: t, scale: { from: t.baseScale * 1.6, to: t.baseScale }, duration: 250, ease: 'Back.Out' });
      }
    });
  }

  resetCombo() {
    const disp = this.dispensaries.find(d => d.product === this.comboProduct);
    if (disp) this.lightLetters(disp, 0);
    this.comboProduct = null;
    this.comboCount = 0;
  }

  showFrenzy(disp) {
    sfx(this, 'frenzy');
    this.cameras.main.flash(200, 255, 255, 255);
    const t = this.add.text(MAP_W / 2, MAP_H / 2, `${FRENZY_TEXT}\n+$${FRENZY_BONUS}`, {
      fontFamily: 'Arial Black, Arial', fontSize: '68px', color: '#ffffff', align: 'center',
      stroke: '#' + disp.color.toString(16).padStart(6, '0'), strokeThickness: 13,
    }).setOrigin(0.5).setDepth(35).setScale(0);
    this.tweens.add({
      targets: t, scale: 1, duration: 300, ease: 'Back.Out',
      onComplete: () => this.tweens.add({
        targets: t, alpha: 0, y: MAP_H / 2 - 40, delay: 700, duration: 400, onComplete: () => t.destroy(),
      }),
    });
  }

  fail(order, label) {
    const { house } = order;
    this.removeOrder(order);
    this.resetCombo();
    this.stars -= 1;
    sfx(this, 'miss');
    this.floatText(house.bx, house.by - 30, label, '#ff6b6b');
    this.cameras.main.shake(150, 0.004);
    this.updateHud();
    if (this.stars <= 0) this.endGame(false);
  }

  // ---------- Loop ----------
  update(time, delta) {
    // If every carried order timed out mid-drag, drop the floating icon.
    if (this.dragGhost && (this.over || this.selected.length === 0)) {
      this.dragGhost.destroy();
      this.dragGhost = null;
      this.dispensaries.forEach(d => d.glow.setVisible(false));
    }
    if (this.over || this.paused) return;

    this.timeLeft -= delta;
    if (this.timeLeft <= 0) {
      this.timeLeft = 0;
      this.updateHud();
      this.endGame(this.cash >= CASH_TARGET);
      return;
    }

    // Spawning gets faster over the level, and doubles in rush hour.
    this.nextSpawn -= delta;
    if (this.nextSpawn <= 0) {
      this.spawnOrder();
      const progress = 1 - this.timeLeft / (LEVEL_SECONDS * 1000);
      let gap = Phaser.Math.Linear(SPAWN_START_MS, SPAWN_END_MS, progress);
      if (this.timeLeft <= RUSH_SECONDS * 1000) gap /= 2;
      this.nextSpawn = gap * Phaser.Math.FloatBetween(0.8, 1.2);
    }

    // Patience rings drain; an empty ring means the customer leaves.
    this.ringGfx.clear();
    for (const order of [...this.orders]) {
      order.waited += delta;
      const left = 1 - order.waited / PATIENCE_MS;
      if (left <= 0) {
        if (order.robber) {   // ignoring the robber is the right move: no penalty
          this.floatText(order.x, order.y - 30, 'Dodged him!', '#c5ff9e');
          this.removeOrder(order);
          continue;
        }
        this.fail(order, 'Too slow!'); if (this.over) return; continue;
      }
      const color = left > 0.5 ? 0x8bc34a : left > 0.25 ? 0xffc107 : 0xf44336;
      const start = Phaser.Math.DegToRad(-90);
      this.ringGfx.lineStyle(6 * FACE_K, color);
      this.ringGfx.beginPath();
      this.ringGfx.arc(order.x, order.y, 42 * FACE_K, start, start + Math.PI * 2 * left, false);
      this.ringGfx.strokePath();
    }

    this.updateHud();
  }

  // ---------- Helpers ----------
  floatText(x, y, msg, color) {
    const t = this.add.text(x, y, msg, {
      fontFamily: 'Arial', fontSize: `${Math.round(18 * UI_K)}px`, color, fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(20);
    this.tweens.add({ targets: t, y: y - 40, alpha: 0, duration: 900, onComplete: () => t.destroy() });
  }

  showBanner(msg, ms) {
    const t = this.add.text(MAP_W / 2, MAP_H / 2 + 128, msg, {
      fontFamily: 'Arial', fontSize: '18px', color: '#ffffff', align: 'center',
      backgroundColor: '#000000aa', padding: { x: 12, y: 8 },
    }).setOrigin(0.5).setDepth(30);
    this.time.delayedCall(ms, () => this.tweens.add({ targets: t, alpha: 0, duration: 400, onComplete: () => t.destroy() }));
  }

  endGame(won) {
    if (this.over) return;
    this.over = true;
    this.sound.stopAll();
    sfx(this, 'gameover');
    this.ringGfx.clear();
    this.select(null);

    this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.65).setDepth(40);
    const title = won ? 'Level complete!' : (this.stars <= 0 ? 'Out of stars!' : 'Missed the target');
    this.add.text(W / 2, H / 2 - 50, title, {
      fontFamily: 'Arial', fontSize: '44px', color: won ? '#c5ff9e' : '#ff8a80', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(41);
    this.add.text(W / 2, H / 2 + 10, `Cash: $${this.cash}  (target $${CASH_TARGET})`, {
      fontFamily: 'Arial', fontSize: '24px', color: '#ffffff',
    }).setOrigin(0.5).setDepth(41);
    this.add.text(W / 2, H / 2 + 60, `${TAP === 'tap' ? 'Tap' : 'Click'} to play again`, {
      fontFamily: 'Arial', fontSize: '20px', color: '#bbbbbb',
    }).setOrigin(0.5).setDepth(41);

    this.time.delayedCall(600, () => this.input.once('pointerdown', () => this.scene.restart()));
  }
}

new Phaser.Game({
  // Canvas renderer + plain <img> loading lets the game run from a
  // double-clicked index.html (browsers block WebGL images from local files).
  type: Phaser.CANVAS,
  loader: { imageLoadType: 'HTMLImageElement' },
  parent: 'game',
  // Drawn at double resolution (camera zoom 2) so art and text stay sharp
  // when the browser scales the game up. Game coordinates are still 960 x 720.
  width: W * RES,
  height: H * RES,
  backgroundColor: '#14121c',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  // Web Audio on the real site (reliable on phones); plain HTML5 audio only when
  // the game is opened as a double-clicked local file, where Web Audio can't load.
  audio: { disableWebAudio: location.protocol === 'file:' },
  scene: [TitleScene, GameScene],
});
