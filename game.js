// Weed Frenzy
// Customers order products; send each order to the dispensary that stocks it.
// Carry up to 3 of a kind, light B-L-A-Z-E for a frenzy, grab tips, dodge the
// robber, pay off the dirty cop. Earn cash to buy new products between stages.
// Art lives in assets/, sounds in assets/sounds/.

// ======================================================================
// Screen layout
// ======================================================================
// Phones held upright: map on top, panel along the bottom.
// Computers (and phones on their side): map on the left, panel on the right.
const PORTRAIT = window.innerHeight > window.innerWidth;
const MAP_W = 720;
const MAP_H = 1080;              // every stage uses a tall 2:3 map (720 x 1080)
const W = PORTRAIT ? 720 : 960;
const H = PORTRAIT ? 1360 : 1080;
const RES = 2;                   // render scale for sharpness
const TAP = ('ontouchstart' in window) ? 'tap' : 'click';
const Tap = TAP === 'tap' ? 'Tap' : 'Click';

// Every text object renders at the same double resolution.
const _addText = Phaser.GameObjects.GameObjectFactory.prototype.text;
Phaser.GameObjects.GameObjectFactory.prototype.text = function (x, y, text, style) {
  return _addText.call(this, x, y, text, { resolution: RES, ...style });
};

// Turning a phone switches layouts, which needs a reload.
// (Touch devices only, so resizing a computer window never restarts the game.)
window.addEventListener('resize', () => {
  if (('ontouchstart' in window) && (window.innerHeight > window.innerWidth) !== PORTRAIT) location.reload();
});

// Where the panel pieces go (game coordinates).
const HUD = PORTRAIT ? {
  panel: { key: 'ui-panel-wide', x: 360, y: 1220, w: 712, h: 272 }, bg: [360, 1220, 720, 280],
  note: { x: 95, y: 1215, w: 140, h: 134, k: 1.03 },
  jar: { x: 386, y: 1222, w: 124, h: 176 },
  cash: { x: 250, y: 1185, w: 140, h: 46, k: 1.2 },
  stars: Array.from({ length: 5 }, (_, i) => [250 + (i - 2) * 28, 1245]), starSize: 27,
  pause: { x: 644, y: 1220, w: 106, h: 72, k: 0.85 },
  pause4: { x: 664, y: 1220, w: 86, h: 72, k: 0.75 },     // narrower when 4 product cards
  cards2: { k: 0.95, at: [[530, 1172], [530, 1268]] },
  cards4: { k: 0.8, at: [[494, 1172], [576, 1172], [494, 1268], [576, 1268]] },
  stageLabel: null,
} : {
  panel: { key: 'ui-panel-tall', x: 840, y: 540, w: 236, h: 1074 }, bg: [840, 540, 240, 1080],
  note: { x: 840, y: 330, w: 150, h: 143, k: 1.1 },
  jar: { x: 840, y: 560, w: 160, h: 227 },
  cash: { x: 840, y: 730, w: 170, h: 46, k: 1.15 },
  stars: Array.from({ length: 5 }, (_, i) => [840 + (i - 2) * 36, 800]), starSize: 32,
  pause: { x: 840, y: 1000, w: 170, h: 64, k: 1.1 },
  pause4: { x: 840, y: 1000, w: 170, h: 64, k: 1.1 },
  cards2: { k: 1, at: [[786, 120], [894, 120]] },
  cards4: { k: 0.95, at: [[786, 75], [894, 75], [786, 170], [894, 170]] },
  stageLabel: { x: 840, y: 895 },
};
const JK = HUD.jar.h / 200;      // jar scale relative to the original 200 px jar

// Size of customer faces/badges/rings, and of the courier, tips, combo letters
// and pop-up text, relative to the original artwork.
const FACE_K = 1.75;
const UI_K = 1.35;

// ======================================================================
// Tuning knobs (shared by all stages; each stage can also override some)
// ======================================================================
const START_STARS = 5;
const PATIENCE_MS = 14000;       // how long a customer waits (ms)
const TIP_MIN = 3, TIP_MAX = 8;
const TIP_LIFETIME_MS = 3000;    // how long a tip stays clickable
const SPAWN_START_MS = 2600;     // gap between orders at level start
const SPAWN_END_MS = 1300;       // gap between orders near the end
const RUSH_SECONDS = 20;         // rush hour: last N seconds spawn twice as fast
const MAX_CARRY = 3;             // orders of one product you can carry at once

// Combo word: each same-product order in a row lights one letter at that shop.
const COMBO_WORD = 'BLAZE';
const FRENZY_BONUS = 50;
const FRENZY_TEXT = 'WEED FRENZY!';
const JAR_ITEMS = 34;            // bills and coins in a full jar

// The robber: serve him and he steals some of your cash; ignore him, no penalty.
const ROBBER_AFTER_SECONDS = 15; // doesn't show up until this far into a level
const ROBBER_STEAL = 0.25;       // share of your cash he takes

// The dirty cop: serve him (he pays nothing) and robbers stay away for a while;
// ignore him and he fines you.
const COP_AFTER_SECONDS = 10;
const COP_FINE = 0.15;           // share of your cash he takes if ignored
const COP_MIN_FINE = 10;
const COP_PROTECT_SECONDS = 30;  // robber-free time after paying him off

// ======================================================================
// Products (the shop sells these between stages)
// ======================================================================
// file: icon image in assets/ (null = a placeholder is drawn until art arrives)
const PRODUCTS = [
  // color: each product's badge color, picked so similar-looking icons are easy
  // to tell apart (green, pink, orange, purple, red, blue).
  { key: 'flower',   name: 'Flower',    pay: 10, cost: 0,    color: 0x43a047, file: 'assets/icon-flower.png' },
  { key: 'gummies',  name: 'Gummies',   pay: 10, cost: 0,    color: 0xe040a0, file: 'assets/icon-gummies.png' },
  { key: 'prerolls', name: 'Pre-rolls', pay: 15, cost: 300,  color: 0xff7a1a, file: 'assets/icon-prerolls.png' },
  { key: 'vape',     name: 'Vape Pens', pay: 20, cost: 600,  color: 0x9c4dcc, file: 'assets/icon-vape.png' },
  { key: 'brownies', name: 'Brownies',  pay: 25, cost: 900,  color: 0xd32f2f, file: 'assets/icon-brownies.png' },
  { key: 'wax',      name: 'Wax',       pay: 35, cost: 1400, color: 0x1e88e5, file: 'assets/icon-wax.png' },
];
const productByKey = Object.fromEntries(PRODUCTS.map(p => [p.key, p]));
const iconKey = p => `icon-${p.key}`;
const STARTER_PRODUCTS = ['flower', 'gummies'];
// What each shop sells by default (if you own it), matching its sign.
const SHOP_DEFAULTS = { 'Green Leaf': 'flower', 'Sugar High': 'gummies', 'Kush Corner': 'prerolls', 'Higher Learning': 'vape' };

// ======================================================================
// Characters
// ======================================================================
// Regular customers (face images in assets/). Each stage lists who shows up there.
const CUSTOMER_FILES = ['cust-yoga', 'cust-hoodie', 'cust-conspiracy', 'cust-stoner', 'cust-rapper'];
const SUBURBS_CUSTOMERS = ['cust-soccermom', 'cust-grilldad', 'cust-retiree'];
const HOOD_CUSTOMERS = ['cust-grandma', 'cust-barber', 'cust-storeowner', 'cust-baller', 'cust-producer'];
const COLLEGE_CUSTOMERS = ['cust-fratguy', 'cust-sorority', 'cust-professor', 'cust-artstudent', 'cust-freshman'];
const ROBBER_FILE = 'assets/cust-robber.png';
const COP_FILE = 'assets/cust-cop.png';

// ======================================================================
// Stages
// ======================================================================
// map: positions on that stage's map (map coordinates, 720 x 1080).
//   shops: x, y, w, h = clickable area over the painted shop; door = where
//          couriers leave; lx, ly = where the combo letters sit.
//   houseX/bubbleX/rows: house doors (courier stop, tip drop) and order spots.
//   roadX/roadY: road centerlines, for routing the courier along the streets.
// A stage with mapFile: null shows as "coming soon" until its map art arrives.
const STAGES = [
  {
    id: 'suburbs', name: 'Suburbs', goal: 250, seconds: 90,
    robberChance: 0.12, copChance: 0.06,
    customers: [...CUSTOMER_FILES, ...SUBURBS_CUSTOMERS],
    mapFile: 'assets/map-suburbs-tall.jpg',
    map: {
      shops: [
        { name: 'Green Leaf', x: 175, y: 870, w: 260, h: 240, door: [178, 985], lx: 175, ly: 1058, badge: [175, 900] },
        { name: 'Sugar High', x: 540, y: 870, w: 265, h: 240, door: [540, 985], lx: 540, ly: 1058, badge: [540, 900] },
      ],
      houseX: [112, 246, 478, 612],
      bubbleX: [96, 264, 460, 628],
      rows: [{ door: 200, bubble: 88 }, { door: 438, bubble: 326 }, { door: 674, bubble: 563 }],
      roadX: [15, 324, 395, 705],
      roadY: [15, 262, 498, 733, 1020],
    },
  },
  {
    id: 'hood', name: 'The Hood', goal: 450, seconds: 100,
    robberChance: 0.15, copChance: 0.08,
    customers: [...CUSTOMER_FILES, ...HOOD_CUSTOMERS],
    mapFile: 'assets/map-hood-tall.jpg',
    map: {
            shops: [
        { name: 'Green Leaf',  x: 155, y: 905, w: 200, h: 190, door: [160, 990], lx: 155, ly: 1058, badge: [155, 905] },
        { name: 'Sugar High',  x: 357, y: 905, w: 197, h: 190, door: [357, 990], lx: 357, ly: 1058, badge: [357, 905] },
        { name: 'Kush Corner', x: 565, y: 905, w: 200, h: 190, door: [568, 990], lx: 565, ly: 1058, badge: [565, 905] },
      ],
      houseX: [122, 240, 485, 600],
      bubbleX: [100, 262, 463, 622],
      rows: [{ door: 212, bubble: 92 }, { door: 462, bubble: 335 }, { door: 702, bubble: 575 }],
      // The shops fill the bottom block, so couriers use the outer roads to get uptown.
      roadX: [15, 705],
      roadY: [15, 266, 510, 757, 1022],
    },
  },
  {
    id: 'college', name: 'College', goal: 700, seconds: 110,
    robberChance: 0.15, copChance: 0.1,
    customers: [...CUSTOMER_FILES, ...COLLEGE_CUSTOMERS],
    mapFile: 'assets/map-college-tall.jpg',
    map: {
      shops: [
        { name: 'Green Leaf',      x: 122, y: 905, w: 155, h: 190, door: [122, 990], lx: 122, ly: 1058, badge: [122, 912] },
        { name: 'Sugar High',      x: 283, y: 905, w: 155, h: 190, door: [285, 990], lx: 283, ly: 1058, badge: [283, 912] },
        { name: 'Kush Corner',     x: 442, y: 905, w: 155, h: 190, door: [442, 990], lx: 442, ly: 1058, badge: [442, 912] },
        { name: 'Higher Learning', x: 602, y: 905, w: 155, h: 190, door: [602, 990], lx: 602, ly: 1058, badge: [602, 912] },
      ],
      // Campus buildings aren't a neat grid (the library is one big building),
      // so each order spot is listed: door [x, y] and bubble [x, y].
      houses: [
        { door: [113, 190], bubble: [98, 92] },    // dorm
        { door: [250, 190], bubble: [266, 92] },   // dorm
        { door: [470, 190], bubble: [452, 92] },   // frat
        { door: [608, 190], bubble: [628, 92] },   // frat
        { door: [178, 455], bubble: [178, 345] },  // library
        { door: [474, 445], bubble: [452, 345] },  // lecture hall A
        { door: [610, 445], bubble: [628, 345] },  // lecture hall B
        { door: [113, 690], bubble: [98, 590] },   // dorm
        { door: [248, 690], bubble: [266, 590] },  // dorm
        { door: [470, 690], bubble: [452, 590] },  // student union
        { door: [610, 690], bubble: [628, 590] },  // lecture hall C
      ],
      // The shops fill the bottom block, so couriers use the outer roads.
      roadX: [15, 705],
      roadY: [15, 272, 522, 772, 1024],
    },
  },
];
const shopCountOf = st => (st.map ? st.map.shops.length : st.shopCount);

// ======================================================================
// Sounds
// ======================================================================
// MP3s in assets/sounds/. Any left as null are simply skipped.
const SOUNDS = {
  music: null,                              // background loop
  pop: 'assets/sounds/pop.mp3',             // a customer appears
  pickup: 'assets/sounds/pickup.mp3',       // you pick up an order
  deliver: 'assets/sounds/deliver.mp3',     // order sent to the right shop
  tip: 'assets/sounds/tip.mp3',             // tip collected
  letter: null,                             // a BLAZE letter lights
  frenzy: 'assets/sounds/frenzy.mp3',       // WEED FRENZY!
  robber: 'assets/sounds/robber.mp3',       // the robber shows up
  cop: null,                                // the dirty cop shows up
  miss: null,                               // too slow / wrong shop / robbed / fined
  gameover: null,                           // level over
  buy: null,                                // bought something in the shop
};
// Volume for each sound, 0 to 1.
const SOUND_VOLUME = {
  music: 0.35, pop: 0.5, pickup: 0.6, deliver: 0.3, tip: 0.45, letter: 0.7,
  frenzy: 0.9, robber: 0.8, cop: 0.8, miss: 0.8, gameover: 0.9, buy: 0.7,
};

// Start screen logo.
const LOGO_FILE = 'assets/logo.png';

// ======================================================================
// Saved progress (on this device)
// ======================================================================
const SAVE_KEY = 'weedfrenzy-save';
function loadSave() {
  let s = null;
  try { s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch (e) { /* ignore */ }
  if (!s) {
    s = { wallet: 0, owned: [...STARTER_PRODUCTS], cleared: [], best: {} };
    // carry over the best score from before stages existed
    try { const old = parseInt(localStorage.getItem('weedfrenzy-best') || '0', 10); if (old) s.best.suburbs = old; } catch (e) { /* ignore */ }
  }
  s.owned = s.owned || [...STARTER_PRODUCTS];
  s.cleared = s.cleared || [];
  s.best = s.best || {};
  s.wallet = s.wallet || 0;
  return s;
}
function writeSave(s) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(s)); } catch (e) { /* ignore */ }
}
const stageUnlocked = (save, i) => i === 0 || save.cleared.includes(STAGES[i - 1].id);

function savedMute() {
  try { return localStorage.getItem('weedfrenzy-mute') === '1'; } catch (e) { return false; }
}
function saveMute(m) {
  try { localStorage.setItem('weedfrenzy-mute', m ? '1' : '0'); } catch (e) { /* ignore */ }
}
const soundLabel = scene => (scene.sound.mute ? '🔇 Sound off' : '🔊 Sound on');

// Plays a sound only if its file is set in SOUNDS.
function sfx(scene, key, config = {}) {
  if (scene.cache.audio.exists(key)) {
    scene.sound.play(key, { volume: SOUND_VOLUME[key] ?? 1, ...config });
  }
}

// ======================================================================
// Shared drawing helpers for the menu screens
// ======================================================================
function screenSetup(scene, mapKey = 'map-suburbs') {
  scene.cameras.main.setZoom(RES).centerOn(W / 2, H / 2);
  scene.add.image(W / 2, H / 2, mapKey).setDisplaySize(H * MAP_W / MAP_H, H);
  scene.add.rectangle(W / 2, H / 2, W, H, 0x0c0a12, 0.72);
}

function text(scene, x, y, str, size, color = '#ffffff', extra = {}) {
  return scene.add.text(x, y, str, {
    fontFamily: 'Arial', fontSize: `${size}px`, color, fontStyle: 'bold', align: 'center', ...extra,
  }).setOrigin(0.5);
}

// Metal button art built from three pieces (left cap, stretchy middle, right cap)
// so its rounded ends never squash, whatever the button's size.
function buttonImage(scene, x, y, w, h) {
  const tex = scene.textures.get('ui-button');
  const src = tex.getSourceImage();
  const SW = src.width, SH = src.height, CAP = Math.round(SH * 0.5);
  if (!tex.has('L')) {
    tex.add('L', 0, 0, 0, CAP, SH);
    tex.add('M', 0, CAP, 0, SW - 2 * CAP, SH);
    tex.add('R', 0, SW - CAP, 0, CAP, SH);
  }
  const cap = Math.min(CAP * (h / SH), w / 2 - 1);
  const c = scene.add.container(x, y);
  c.add(scene.add.image(-w / 2 + cap / 2, 0, 'ui-button', 'L').setDisplaySize(cap, h));
  c.add(scene.add.image(0, 0, 'ui-button', 'M').setDisplaySize(w - 2 * cap + 2, h));
  c.add(scene.add.image(w / 2 - cap / 2, 0, 'ui-button', 'R').setDisplaySize(cap, h));
  c.setSize(w, h);
  return c;
}

function woodButton(scene, x, y, w, h, label, onTap, enabled = true, size = 24) {
  const img = buttonImage(scene, x, y, w, h);
  const t = text(scene, x, y - 1, label, size, '#ffffff', { fontFamily: 'Arial Black, Arial' });
  t.setStroke('#14121c', 6);
  if (enabled) {
    img.setInteractive({ useHandCursor: true });
    img.on('pointerdown', () => {
      scene.tweens.add({ targets: [img, t], scaleX: '*=0.94', scaleY: '*=0.94', yoyo: true, duration: 70 });
      scene.time.delayedCall(90, onTap);
    });
  } else {
    img.setAlpha(0.4); t.setAlpha(0.5);
  }
  return { img, t };
}

function card(scene, x, y, w, h, borderColor = 0x8ee34a, alpha = 0.92) {
  const g = scene.add.graphics();
  g.fillStyle(0x14121c, alpha).fillRoundedRect(x - w / 2, y - h / 2, w, h, 18);
  g.lineStyle(4, borderColor).strokeRoundedRect(x - w / 2, y - h / 2, w, h, 18);
  return g;
}

function walletTag(scene, save, x = 20, y = 20) {
  return scene.add.text(x, y, `💰 $${save.wallet}`, {
    fontFamily: 'Arial', fontSize: '24px', color: '#c5ff9e', backgroundColor: '#14121ccc',
    padding: { x: 12, y: 8 }, fontStyle: 'bold',
  });
}

// Placeholder pictures drawn in code until real art exists.
function makePlaceholders(scene) {
  // Product icons: a colored disc with the product's initials.
  PRODUCTS.forEach(p => {
    if (scene.textures.exists(iconKey(p))) return;
    const tex = scene.textures.createCanvas(iconKey(p), 128, 128);
    const ctx = tex.getContext();
    const hex = '#' + p.color.toString(16).padStart(6, '0');
    ctx.fillStyle = '#1b1426'; ctx.beginPath(); ctx.arc(64, 64, 62, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = hex; ctx.beginPath(); ctx.arc(64, 64, 54, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 44px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(p.name.replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase(), 64, 66);
    tex.refresh();
  });
  // Robber (black ski mask)
  if (!scene.textures.exists('cust-robber')) {
    const g = scene.make.graphics({ add: false });
    g.fillStyle(0xf6e7a8).fillCircle(64, 64, 64);
    g.fillStyle(0x111111).fillCircle(64, 64, 58);
    g.fillStyle(0xd9a066).fillRoundedRect(30, 46, 68, 24, 10);
    g.fillStyle(0xffffff).fillCircle(48, 58, 8).fillCircle(80, 58, 8);
    g.fillStyle(0x000000).fillCircle(50, 59, 4).fillCircle(82, 59, 4);
    g.generateTexture('cust-robber', 128, 128);
    g.destroy();
  }
  // Dirty cop (navy cap, badge)
  if (!scene.textures.exists('cust-cop')) {
    const g = scene.make.graphics({ add: false });
    g.fillStyle(0xf6e7a8).fillCircle(64, 64, 64);
    g.fillStyle(0x1f2d5c).fillCircle(64, 110, 46);
    g.fillStyle(0xf0c9a0).fillCircle(64, 66, 32);
    g.fillStyle(0x1f2d5c).fillRoundedRect(28, 26, 72, 22, 8);
    g.fillStyle(0x111a3a).fillRect(24, 44, 80, 6);
    g.fillStyle(0xffd54f).fillCircle(64, 36, 6);
    g.fillStyle(0x7a5a8a).fillEllipse(52, 70, 14, 6).fillEllipse(76, 70, 14, 6);
    g.fillStyle(0x000000).fillCircle(52, 64, 3).fillCircle(76, 64, 3);
    g.fillStyle(0x7a1f1f).fillRoundedRect(50, 82, 28, 6, 3);
    g.generateTexture('cust-cop', 128, 128);
    g.destroy();
  }
  // Jar coins and bills (only if the real art failed to load)
  if (!scene.textures.exists('jar-coin')) {
    const g = scene.make.graphics({ add: false });
    g.fillStyle(0x3b2a1a).fillCircle(12, 12, 12);
    g.fillStyle(0xf2b827).fillCircle(12, 12, 10);
    g.generateTexture('jar-coin', 24, 24);
    g.destroy();
  }
  if (!scene.textures.exists('jar-bill')) {
    const g = scene.make.graphics({ add: false });
    g.fillStyle(0x1f3d14).fillRoundedRect(0, 0, 36, 20, 4);
    g.fillStyle(0x6abf45).fillRoundedRect(2, 2, 32, 16, 3);
    g.generateTexture('jar-bill', 36, 20);
    g.destroy();
  }
}

// ======================================================================
// Start screen (also loads all the art and sound)
// ======================================================================
class TitleScene extends Phaser.Scene {
  constructor() { super('title'); }

  preload() {
    STAGES.forEach(st => {
      if (st.mapFile) this.load.image(`map-${st.id}`, st.mapFile);
      this.load.image(`stage-${st.id}`, `assets/stage-${st.id}.png`);   // stage select icon
    });
    PRODUCTS.forEach(p => { if (p.file) this.load.image(iconKey(p), p.file); });
    const faces = [...new Set(STAGES.flatMap(st => st.customers))];
    ['courier', 'tip', 'jar-coin', 'jar-bill', ...faces,
      'ui-panel-wide', 'ui-panel-tall', 'ui-jar', 'ui-note', 'ui-button', 'ui-tray', 'star-full', 'star-empty']
      .forEach(k => this.load.image(k, `assets/${k}.png`));
    for (let i = 0; i < COMBO_WORD.length; i++) {
      this.load.image(`letter-${i}-off`, `assets/letter-${i}-off.png`);
      this.load.image(`letter-${i}-on`, `assets/letter-${i}-on.png`);
    }
    if (LOGO_FILE) this.load.image('logo', LOGO_FILE);
    if (ROBBER_FILE) this.load.image('cust-robber', ROBBER_FILE);
    if (COP_FILE) this.load.image('cust-cop', COP_FILE);
    Object.entries(SOUNDS).forEach(([k, file]) => { if (file) this.load.audio(k, file); });
  }

  create() {
    makePlaceholders(this);
    screenSetup(this);
    const OY = (H - 720) / 2;   // centers the layout on tall screens

    const logo = this.add.image(W / 2, OY + 124, 'logo');
    logo.setScale(Math.min(560 / logo.width, 226 / logo.height));
    this.tweens.add({ targets: logo, scale: logo.scale * 1.04, yoyo: true, repeat: -1, duration: 900, ease: 'Sine.InOut' });

    // How to play
    card(this, W / 2, OY + 405, 620, 320);
    text(this, W / 2, OY + 268, 'HOW TO PLAY', 26, '#ffd54f', { fontFamily: 'Arial Black, Arial' });
    const steps = [
      `${Tap} or drag customers to the shop that sells what they want.`,
      'Grab up to 3 of the same item and send them at once.',
      'Same item in a row lights B-L-A-Z-E for a WEED FRENZY bonus!',
      `${Tap} the cash tips before they disappear.`,
      'Ski mask guy: leave him alone or he robs you.',
      'Dirty cop: serve him to pay him off, or he fines you.',
      'Too slow or wrong shop costs a star.',
      'Spend your cash on new products between stages.',
    ];
    this.add.text(W / 2 - 280, OY + 296, steps.map((t, i) => `${i + 1}.  ${t}`).join('\n'), {
      fontFamily: 'Arial', fontSize: '18px', color: '#ffffff', lineSpacing: 7, wordWrap: { width: 560 },
    });

    const start = text(this, W / 2, OY + 660, `${TAP.toUpperCase()} TO START`, 34, '#ffffff',
      { fontFamily: 'Arial Black, Arial', stroke: '#1b3a0e', strokeThickness: 8 });
    this.tweens.add({ targets: start, scale: 1.08, yoyo: true, repeat: -1, duration: 600 });

    // Sound on/off (top right)
    this.sound.mute = savedMute();
    const muteBtn = this.add.text(W - 20, 20, soundLabel(this), {
      fontFamily: 'Arial', fontSize: '22px', color: '#ffffff', backgroundColor: '#14121ccc',
      padding: { x: 12, y: 8 },
    }).setOrigin(1, 0).setInteractive({ useHandCursor: true });
    muteBtn.on('pointerdown', () => {
      this.sound.mute = !this.sound.mute;
      saveMute(this.sound.mute);
      muteBtn.setText(soundLabel(this));
    });
    walletTag(this, loadSave());

    // The first tap continues (and unlocks sound in the browser).
    this.started = false;
    this.input.on('pointerdown', (pointer, objects) => {
      if (objects.includes(muteBtn) || this.started) return;
      this.started = true;
      const ctx = this.sound.context;   // Safari can leave audio asleep until a tap wakes it
      if (ctx && ctx.state !== 'running') ctx.resume();
      if (this.sound.unlock) this.sound.unlock();
      this.scene.start('stages');
    });
  }
}

// ======================================================================
// Stage select
// ======================================================================
class StagesScene extends Phaser.Scene {
  constructor() { super('stages'); }

  create() {
    screenSetup(this);
    const save = loadSave();
    walletTag(this, save);
    const OY = (H - 1080) / 2;
    text(this, W / 2, OY + 110, 'CHOOSE A STAGE', 40, '#ffd54f', { fontFamily: 'Arial Black, Arial' });

    STAGES.forEach((st, i) => {
      const y = OY + 270 + i * 230;
      const unlocked = stageUnlocked(save, i);
      const ready = !!st.map;
      const cleared = save.cleared.includes(st.id);
      card(this, W / 2, y, 600, 200, cleared ? 0xffd54f : unlocked && ready ? 0x8ee34a : 0x666666);
      const iconKeyName = this.textures.exists(`stage-${st.id}`) ? `stage-${st.id}` : `map-${st.id}`;
      if (this.textures.exists(iconKeyName)) {
        const img = this.add.image(W / 2 - 207, y, iconKeyName);
        if (iconKeyName.startsWith('stage-')) img.setDisplaySize(165, 165); else img.setDisplaySize(120, 180);
        if (!unlocked) img.setAlpha(0.35);
      } else {
        text(this, W / 2 - 207, y, '?', 64, '#555555');
      }
      text(this, W / 2 - 110, y - 60, `STAGE ${i + 1}: ${st.name.toUpperCase()}`, 26,
        '#ffffff', { fontFamily: 'Arial Black, Arial' }).setOrigin(0, 0.5);
      text(this, W / 2 - 110, y - 20, `${shopCountOf(st)} shops   ·   Goal $${st.goal}   ·   ${st.seconds}s`, 19,
        '#cccccc').setOrigin(0, 0.5);
      const best = save.best[st.id];
      text(this, W / 2 - 110, y + 14, best ? `🏆 Best: $${best}${cleared ? '   ✔ Cleared' : ''}` : ' ', 19,
        '#ffd54f').setOrigin(0, 0.5);

      let label = 'PLAY', ok = true;
      if (!ready) { label = 'SOON'; ok = false; }
      else if (!unlocked) { label = 'LOCKED'; ok = false; }
      woodButton(this, W / 2 + 160, y + 58, 200, 60, label,
        () => this.scene.start('stock', { stage: i }), ok, 22);
      if (!ready) text(this, W / 2 - 110, y + 58, 'Map coming soon', 18, '#888888').setOrigin(0, 0.5);
      else if (!unlocked) text(this, W / 2 - 110, y + 58, `Clear Stage ${i} first`, 18, '#888888').setOrigin(0, 0.5);
    });

    const by = OY + 1000;
    woodButton(this, W / 2 - 150, by, 260, 76, 'SHOP', () => this.scene.start('shop', { back: 'stages' }));
    woodButton(this, W / 2 + 150, by, 260, 76, 'TITLE', () => this.scene.start('title'));
  }
}

// ======================================================================
// Shop: buy new products with your wallet
// ======================================================================
class ShopScene extends Phaser.Scene {
  constructor() { super('shop'); }

  init(data) { this.back = data.back || 'stages'; this.backData = data.backData || {}; }

  create() {
    screenSetup(this);
    const save = loadSave();
    const OY = (H - 1080) / 2;
    const wallet = walletTag(this, save);
    text(this, W / 2, OY + 90, 'PRODUCT SHOP', 40, '#ffd54f', { fontFamily: 'Arial Black, Arial' });
    text(this, W / 2, OY + 140, 'Higher-paying products earn more per order.', 20, '#cccccc');

    PRODUCTS.forEach((p, i) => {
      const y = OY + 240 + i * 118;
      const owned = save.owned.includes(p.key);
      card(this, W / 2, y, 620, 104, owned ? 0x8ee34a : 0x555555);
      this.add.circle(W / 2 - 250, y, 44, p.color).setStrokeStyle(4, 0x14121c);
      this.add.image(W / 2 - 250, y, iconKey(p)).setDisplaySize(70, 70);
      text(this, W / 2 - 195, y - 18, p.name, 26, '#ffffff', { fontFamily: 'Arial Black, Arial' }).setOrigin(0, 0.5);
      text(this, W / 2 - 195, y + 20, `Pays $${p.pay} per order`, 19, '#c5ff9e').setOrigin(0, 0.5);
      if (owned) {
        text(this, W / 2 + 200, y, '✔ OWNED', 22, '#8ee34a', { fontFamily: 'Arial Black, Arial' });
      } else {
        const afford = save.wallet >= p.cost;
        woodButton(this, W / 2 + 200, y, 190, 62, `BUY $${p.cost}`, () => {
          const s = loadSave();
          if (s.wallet < p.cost || s.owned.includes(p.key)) return;
          s.wallet -= p.cost;
          s.owned.push(p.key);
          writeSave(s);
          sfx(this, 'buy');
          this.scene.restart({ back: this.back, backData: this.backData });
        }, afford, 20);
      }
    });

    text(this, W / 2, OY + 950, 'Short on cash? Replay a stage to earn more.', 19, '#aaaaaa');
    woodButton(this, W / 2, OY + 1020, 260, 72, 'BACK', () => this.scene.start(this.back, this.backData));
  }
}

// ======================================================================
// Stock your shops before a stage
// ======================================================================
class StockScene extends Phaser.Scene {
  constructor() { super('stock'); }

  init(data) { this.stageIndex = data.stage; }

  create() {
    const st = STAGES[this.stageIndex];
    screenSetup(this, `map-${st.id}`);
    const save = loadSave();
    walletTag(this, save);
    const OY = (H - 1080) / 2;
    const n = st.map.shops.length;
    text(this, W / 2, OY + 90, `STAGE ${this.stageIndex + 1}: ${st.name.toUpperCase()}`, 34, '#ffd54f',
      { fontFamily: 'Arial Black, Arial' });
    text(this, W / 2, OY + 140, `Goal: $${st.goal} in ${st.seconds} seconds`, 22, '#ffffff');

    // Not enough products to stock every shop?
    if (save.owned.length < n) {
      card(this, W / 2, OY + 420, 600, 300, 0xff8a80);
      text(this, W / 2, OY + 360, `This stage has ${n} shops.`, 28, '#ffffff');
      text(this, W / 2, OY + 410, `You own ${save.owned.length} products.`, 24, '#ffd54f');
      text(this, W / 2, OY + 470, `Buy ${n - save.owned.length} more in the shop to open it.`, 22, '#cccccc');
      woodButton(this, W / 2, OY + 680, 300, 80, 'SHOP', () =>
        this.scene.start('shop', { back: 'stock', backData: { stage: this.stageIndex } }));
      woodButton(this, W / 2, OY + 790, 300, 80, 'BACK', () => this.scene.start('stages'));
      return;
    }

    // Default stock: best-paying products, one per shop.
    // Default stock: each shop's matching product if you own it, then your
    // best-paying leftovers for the rest.
    const byPay = [...save.owned].sort((a, b) => productByKey[b].pay - productByKey[a].pay);
    this.stock = st.map.shops.map(sh => (save.owned.includes(SHOP_DEFAULTS[sh.name]) ? SHOP_DEFAULTS[sh.name] : null));
    this.stock = this.stock.map(k => k || byPay.find(p => !this.stock.includes(p)));
    this.stock = this.stock.map((k, i, arr) => (arr.indexOf(k) === i ? k : byPay.find(p => !arr.includes(p))));
    text(this, W / 2, OY + 220, `STOCK YOUR SHOPS`, 28, '#ffffff', { fontFamily: 'Arial Black, Arial' });
    text(this, W / 2, OY + 260, `${Tap} a shop to change what it sells.`, 20, '#cccccc');

    this.slots = st.map.shops.map((shop, i) => {
      const y = OY + 360 + i * 125;
      card(this, W / 2, y, 560, 110, 0x8ee34a);
      text(this, W / 2 - 250, y, shop.name, 26, '#ffffff', { fontFamily: 'Arial Black, Arial' }).setOrigin(0, 0.5);
      const disc = this.add.circle(W / 2 + 90, y, 46, 0xffffff).setStrokeStyle(4, 0x14121c);
      const icon = this.add.image(W / 2 + 90, y, iconKey(productByKey[this.stock[i]])).setDisplaySize(72, 72);
      const label = text(this, W / 2 + 145, y, '', 20, '#c5ff9e').setOrigin(0, 0.5);
      const hit = this.add.rectangle(W / 2, y, 560, 110, 0xffffff, 0.001).setInteractive({ useHandCursor: true });
      hit.on('pointerdown', () => this.cycle(i));
      return { icon, label, disc };
    });
    this.refresh();

    const by = OY + 360 + n * 125 + 60;
    woodButton(this, W / 2, by, 320, 90, 'START', () =>
      this.scene.start('game', { stage: this.stageIndex, stock: [...this.stock] }), true, 32);
    woodButton(this, W / 2 - 150, by + 115, 260, 66, 'SHOP', () =>
      this.scene.start('shop', { back: 'stock', backData: { stage: this.stageIndex } }), true, 20);
    woodButton(this, W / 2 + 150, by + 115, 260, 66, 'BACK', () => this.scene.start('stages'), true, 20);
  }

  // Next owned product that no other shop is selling.
  cycle(i) {
    const owned = loadSave().owned;
    let k = owned.indexOf(this.stock[i]);
    for (let step = 0; step < owned.length; step++) {
      k = (k + 1) % owned.length;
      if (!this.stock.includes(owned[k])) { this.stock[i] = owned[k]; break; }
    }
    this.refresh();
  }

  refresh() {
    this.slots.forEach((s, i) => {
      const p = productByKey[this.stock[i]];
      s.icon.setTexture(iconKey(p)).setDisplaySize(72, 72);
      s.disc.setFillStyle(p.color);
      s.label.setText(`${p.name}\n$${p.pay}/order`);
    });
  }
}

// ======================================================================
// The game
// ======================================================================
class GameScene extends Phaser.Scene {
  constructor() { super('game'); }

  init(data) {
    this.stageIndex = data.stage || 0;
    this.st = STAGES[this.stageIndex];
    this.stock = data.stock || STARTER_PRODUCTS;
    this.products = this.stock.map(k => productByKey[k]);
    // Only use faces whose picture actually loaded (a missing file would show
    // as a black box), falling back to the original five.
    this.faces = this.st.customers.filter(k => this.textures.exists(k));
    if (this.faces.length === 0) this.faces = CUSTOMER_FILES.filter(k => this.textures.exists(k));
  }

  create() {
    this.cameras.main.setZoom(RES).centerOn(W / 2, H / 2);
    this.sound.mute = savedMute();
    this.sound.stopAll();
    sfx(this, 'music', { loop: true });

    const st = this.st;
    this.levelMs = st.seconds * 1000;
    this.cash = 0;
    this.stars = START_STARS;
    this.timeLeft = this.levelMs;
    this.nextSpawn = 800;
    this.selected = [];
    this.orders = [];
    this.comboProduct = null;
    this.comboCount = 0;
    this.protectedUntil = 0;   // elapsed ms until which robbers stay away
    this.stats = { delivered: 0, frenzies: 0, tips: 0, tipCash: 0, robbed: 0, stolen: 0, missed: 0, copsPaid: 0, fines: 0 };
    this.over = false;
    this.paused = false;
    this.time.paused = false;
    this.hudKey = null;

    const m = st.map;
    this.roadX = m.roadX;
    this.roadY = m.roadY;
    this.add.image(0, 0, `map-${st.id}`).setOrigin(0).setDisplaySize(MAP_W, MAP_H);
    this.houses = m.houses
      ? m.houses.map(h => ({ x: h.door[0], y: h.door[1], bx: h.bubble[0], by: h.bubble[1], order: null }))
      : m.rows.flatMap(r => m.houseX.map((x, i) => ({
        x, y: r.door, bx: m.bubbleX ? m.bubbleX[i] : x, by: r.bubble, order: null,
      })));
    this.dispensaries = m.shops.map((d, i) => this.makeDispensary(d, this.products[i]));
    this.makeHud();
    this.ringGfx = this.add.graphics().setDepth(5);
    this.setupDragging();

    // Clicking empty ground cancels the current selection.
    this.input.on('pointerdown', (pointer, objects) => {
      if (!this.over && objects.length === 0) this.select(null);
    });

    this.showBanner(`STAGE ${this.stageIndex + 1}: ${st.name.toUpperCase()}\n${Tap} or drag customers to the shop that sells what they want.`, 2800);
  }

  get elapsed() { return this.levelMs - this.timeLeft; }

  makeDispensary(d, product) {
    const box = this.add.rectangle(d.x, d.y, d.w, d.h, 0xffffff, 0.001).setInteractive({ useHandCursor: true });
    const glow = this.add.rectangle(d.x, d.y, d.w, d.h).setStrokeStyle(5, product.color).setVisible(false);

    // What this shop sells: an icon badge on the corner of the building.
    const [bx, by] = d.badge || [d.x + d.w / 2 - 34, d.y - d.h / 2 + 34];
    this.add.circle(bx, by, 36, product.color, 1).setStrokeStyle(5, 0x14121c).setDepth(3);
    this.add.image(bx, by, iconKey(product)).setDisplaySize(52, 52).setDepth(3);

    // Combo letters on a dark pill, dim until lit. Spacing shrinks when shops are narrow.
    const n = COMBO_WORD.length;
    const sp = Math.min(31 * UI_K, (d.w - 30) / n);
    const lh = Math.min(34 * UI_K, sp * 1.05);
    this.add.rectangle(d.lx, d.ly, n * sp + 14, lh + 10, 0x14121c, 0.6).setDepth(3);
    const letters = COMBO_WORD.split('').map((ch, i) => {
      const img = this.add.image(d.lx + (i - (n - 1) / 2) * sp, d.ly, `letter-${i}-off`).setDepth(4);
      img.setScale(lh / img.height);
      img.baseScale = img.scale;
      return img;
    });

    const disp = { ...d, product, x: d.door[0], y: d.door[1], box, glow, letters, color: product.color };
    box.on('pointerdown', () => this.onDispensaryClick(disp));
    box.on('pointerover', () => glow.setVisible(true));
    box.on('pointerout', () => glow.setVisible(false));
    box.on('pointerup', () => { if (TAP === 'tap') glow.setVisible(false); });
    return disp;
  }

  // ---------- HUD ----------
  makeHud() {
    const label = (x, y, txt, size, color = '#3b2a1a') => this.add.text(x, y, txt, {
      fontFamily: 'Arial Black, Arial', fontSize: size, color, align: 'center', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(32);
    const px = n => `${Math.round(n)}px`;

    this.add.rectangle(...HUD.bg, 0x2b1a0e).setDepth(29);
    this.add.image(HUD.panel.x, HUD.panel.y, HUD.panel.key).setDisplaySize(HUD.panel.w, HUD.panel.h).setDepth(30);

    // Product cards: icon + pay per order
    const cards = this.products.length > 2 ? HUD.cards4 : HUD.cards2;
    const ck = cards.k;
    this.products.forEach((p, i) => {
      const [cx, cy] = cards.at[i];
      this.add.rectangle(cx, cy, 96 * ck, 84 * ck, p.color).setStrokeStyle(4, 0x14121c).setDepth(31);
      this.add.image(cx, cy - 10 * ck, iconKey(p)).setDisplaySize(46 * ck, 46 * ck).setDepth(32);
      label(cx, cy + 26 * ck, `$${p.pay}`, px(16 * ck), '#ffffff');
    });

    const n = HUD.note;
    this.add.image(n.x, n.y, 'ui-note').setDisplaySize(n.w, n.h).setDepth(31);
    label(n.x - 4 * n.k, n.y - 6 * n.k, 'TIME LEFT', px(14 * n.k));
    this.timeText = label(n.x - 4 * n.k, n.y + 24 * n.k, '', px(32 * n.k));

    const j = HUD.jar;
    this.add.image(j.x, j.y, 'ui-jar').setDisplaySize(j.w, j.h).setDepth(31);
    this.jarItems = [];
    label(j.x, j.y + 14 * JK, `GOAL\n$${this.st.goal}`, px(17 * JK)).setDepth(34);

    const c = HUD.cash;
    this.add.rectangle(c.x, c.y, c.w, c.h, 0x14121c, 0.85).setStrokeStyle(3, 0x000000).setDepth(31);
    this.cashText = label(c.x, c.y, '', px(24 * c.k), '#c5ff9e');

    this.starIcons = HUD.stars.map(([x, y]) =>
      this.add.image(x, y, 'star-full').setDisplaySize(HUD.starSize, HUD.starSize * 0.97).setDepth(32));

    if (HUD.stageLabel) {
      label(HUD.stageLabel.x, HUD.stageLabel.y, `STAGE ${this.stageIndex + 1}\n${this.st.name.toUpperCase()}`, '20px', '#1c1c24')
        .setStroke('#ffffff', 4);
    }

    const pz = this.products.length > 2 ? HUD.pause4 : HUD.pause;
    const btn = buttonImage(this, pz.x, pz.y, pz.w, pz.h).setDepth(31)
      .setInteractive({ useHandCursor: true });
    this.pauseText = label(pz.x, pz.y - 1, 'PAUSE', px(20 * pz.k), '#ffffff');
    this.pauseText.setStroke('#14121c', 6);
    btn.on('pointerdown', () => this.togglePause());

    this.updateHud();
  }

  updateHud() {
    // Only redraw what changed (text redraws are slow on phones).
    const s = Math.max(0, Math.ceil(this.timeLeft / 1000));
    const key = `${this.cash}|${s}|${this.stars}`;
    if (key === this.hudKey) return;
    this.hudKey = key;
    this.cashText.setText(`$${this.cash}`);
    this.timeText.setText(`${s}`);
    this.timeText.setColor(s <= RUSH_SECONDS ? '#d84315' : '#3b2a1a');
    this.starIcons.forEach((img, i) => img.setTexture(i < this.stars ? 'star-full' : 'star-empty'));

    // Bills and coins pile up in the jar as cash comes in.
    const frac = Phaser.Math.Clamp(this.cash / this.st.goal, 0, 1);
    const want = Math.floor(frac * JAR_ITEMS);
    while (this.jarItems.length < want) this.addJarItem();
    while (this.jarItems.length > want) {   // money taken out: it flies away
      const item = this.jarItems.pop();
      this.tweens.add({
        targets: item, y: item.y - 120 * JK, x: item.x + Phaser.Math.Between(-60, 60) * JK,
        alpha: 0, angle: item.angle + 180, duration: 600, onComplete: () => item.destroy(),
      });
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
      this.pauseCover = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.6).setDepth(45).setInteractive();
      this.pauseCover.on('pointerdown', () => this.togglePause());
      this.pauseLabel = this.add.text(MAP_W / 2, MAP_H / 2, `PAUSED\n${TAP} to resume`, {
        fontFamily: 'Arial Black, Arial', fontSize: '40px', color: '#ffffff', align: 'center',
      }).setOrigin(0.5).setDepth(46);
      this.pauseSound = this.add.text(MAP_W / 2, MAP_H / 2 + 110, soundLabel(this), {
        fontFamily: 'Arial', fontSize: '26px', color: '#ffffff', backgroundColor: '#2b1a0e', padding: { x: 16, y: 10 },
      }).setOrigin(0.5).setDepth(47).setInteractive({ useHandCursor: true });
      this.pauseSound.on('pointerdown', () => {
        this.sound.mute = !this.sound.mute;
        saveMute(this.sound.mute);
        this.pauseSound.setText(soundLabel(this));
      });
      this.pauseQuit = this.add.text(MAP_W / 2, MAP_H / 2 + 185, 'Quit to stages', {
        fontFamily: 'Arial', fontSize: '22px', color: '#ffb4a8', backgroundColor: '#2b1a0e', padding: { x: 14, y: 8 },
      }).setOrigin(0.5).setDepth(47).setInteractive({ useHandCursor: true });
      this.pauseQuit.on('pointerdown', () => { this.sound.stopAll(); this.scene.start('stages'); });
      this.pauseText.setText('RESUME');
    } else {
      this.tweens.resumeAll();
      this.sound.resumeAll();
      [this.pauseCover, this.pauseLabel, this.pauseSound, this.pauseQuit].forEach(o => o.destroy());
      this.pauseText.setText('PAUSE');
    }
  }

  // ---------- Orders ----------
  spawnOrder() {
    const free = this.houses.filter(h => !h.order);
    if (free.length === 0) return;
    const house = Phaser.Utils.Array.GetRandom(free);
    const product = Phaser.Utils.Array.GetRandom(this.products);
    const bx = house.bx, by = house.by;
    const st = this.st;

    // Who is calling? Maybe the robber or the dirty cop.
    const safe = this.elapsed < this.protectedUntil;
    let kind = 'customer';
    const r = Math.random();
    if (this.elapsed > COP_AFTER_SECONDS * 1000 && r < st.copChance) kind = 'cop';
    else if (!safe && this.elapsed > ROBBER_AFTER_SECONDS * 1000 && r < st.copChance + st.robberChance) kind = 'robber';
    const face = kind === 'robber' ? 'cust-robber' : kind === 'cop' ? 'cust-cop' : Phaser.Utils.Array.GetRandom(this.faces);

    // Face in a circle (the part you click or drag) with a badge for what they want.
    const K = FACE_K;
    const bubble = this.add.circle(bx, by, 35 * K, 0x14121c, 0.9)
      .setStrokeStyle(3, product.color).setDepth(6)
      // Tap zone is wider than the picture so near misses still count.
      .setInteractive({ hitArea: new Phaser.Geom.Circle(35 * K, 35 * K, 50 * K), hitAreaCallback: Phaser.Geom.Circle.Contains, useHandCursor: true });
    const faceImg = this.add.image(bx, by, face).setDisplaySize(65 * K, 65 * K).setDepth(7);
    const badge = this.add.circle(bx + 29 * K, by + 26 * K, 22 * K, product.color, 1).setStrokeStyle(4, 0x14121c).setDepth(8);
    const icon = this.add.image(bx + 29 * K, by + 26 * K, iconKey(product)).setDisplaySize(34 * K, 34 * K).setDepth(9);

    const order = { house, product, kind, bubble, parts: [bubble, faceImg, badge, icon], x: bx, y: by, waited: 0 };
    house.order = order;
    this.orders.push(order);
    sfx(this, kind === 'robber' ? 'robber' : kind === 'cop' ? (this.cache.audio.exists('cop') ? 'cop' : 'pop') : 'pop');

    // Click to pick up (on release, so a drag doesn't count as a click), or drag to a shop.
    bubble.orderRef = order;
    this.input.setDraggable(bubble);
    bubble.on('pointerup', () => { if (!this.justDragged) this.toggleSelect(order); });

    order.parts.forEach(part => {
      const full = part.scale;
      part.setScale(0);
      this.tweens.add({ targets: part, scale: full, duration: 180, ease: 'Back.Out' });
    });
  }

  // Pick up an order; pick up more of the same product to carry several.
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
    sfx(this, 'pickup');
    order.bubble.setStrokeStyle(5, 0xffffff);
    this.tweens.add({ targets: order.bubble, scale: { from: 1.25, to: 1 }, duration: 150 });
  }

  setupDragging() {
    this.input.dragDistanceThreshold = 8;   // a tiny wobble still counts as a click

    this.input.on('dragstart', (pointer, obj) => {
      const order = obj.orderRef;
      if (this.over || this.paused || !order) return;
      if (!this.selected.includes(order)) this.toggleSelect(order);
      if (!this.selected.includes(order)) return;   // batch full

      const g = UI_K;
      const ghost = this.add.container(pointer.worldX, pointer.worldY).setDepth(50);
      ghost.add(this.add.circle(0, 0, 34 * g, order.product.color, 1).setStrokeStyle(4, 0xffffff));
      ghost.add(this.add.image(0, 0, iconKey(order.product)).setDisplaySize(52 * g, 52 * g));
      if (this.selected.length > 1) {
        ghost.add(this.add.text(26 * g, -31 * g, `x${this.selected.length}`, {
          fontFamily: 'Arial', fontSize: `${Math.round(18 * g)}px`, color: '#ffffff', fontStyle: 'bold',
          stroke: '#000000', strokeThickness: 4,
        }).setOrigin(0.5));
      }
      this.dragGhost = ghost;
    });

    this.input.on('drag', (pointer) => {
      if (!this.dragGhost) return;
      this.dragGhost.setPosition(pointer.worldX, pointer.worldY);
      this.dispensaries.forEach(d => d.glow.setVisible(d.box.getBounds().contains(pointer.worldX, pointer.worldY)));
    });

    this.input.on('dragend', (pointer) => {
      this.justDragged = true;
      this.time.delayedCall(50, () => { this.justDragged = false; });
      if (!this.dragGhost) return;
      this.dragGhost.destroy();
      this.dragGhost = null;
      this.dispensaries.forEach(d => d.glow.setVisible(false));
      const target = this.dispensaries.find(d => d.box.getBounds().contains(pointer.worldX, pointer.worldY));
      if (target) this.onDispensaryClick(target);
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
    // The robber robs you and the cop takes his payoff, whichever shop you pick.
    batch.filter(o => o.kind === 'robber').forEach(o => this.getRobbed(o));
    batch.filter(o => o.kind === 'cop').forEach(o => this.payCop(o));
    const real = batch.filter(o => o.kind === 'customer');
    if (real.length === 0) return;
    if (real[0].product === disp.product) {
      sfx(this, 'deliver');
      real.forEach((order, i) => this.deliver(order, disp, i));
    } else {
      this.fail(real, 'Wrong shop!');   // one star for the whole batch
    }
  }

  getRobbed(order) {
    const { house } = order;
    this.removeOrder(order);
    const stolen = Math.ceil(this.cash * ROBBER_STEAL);
    this.cash -= stolen;
    this.stats.robbed += 1;
    this.stats.stolen += stolen;
    this.resetCombo();
    sfx(this, 'miss');
    this.cameras.main.shake(250, 0.008);
    this.floatText(house.bx, house.by - 30, stolen > 0 ? `ROBBED! -$${stolen}` : 'ROBBED!', '#ff5252');
    this.updateHud();
  }

  payCop(order) {
    this.removeOrder(order);
    this.stats.copsPaid += 1;
    this.protectedUntil = this.elapsed + COP_PROTECT_SECONDS * 1000;
    this.floatText(order.x, order.y - 30, 'Paid off!', '#8ecbff');
    this.showBanner(`The cop owes you one.\nNo robbers for ${COP_PROTECT_SECONDS} seconds.`, 2000);
    // Any robbers already waiting take off.
    this.orders.filter(o => o.kind === 'robber').forEach(o => {
      this.floatText(o.x, o.y - 30, 'Ran off!', '#c5ff9e');
      this.removeOrder(o);
    });
  }

  copFine(order) {
    const fine = Math.min(this.cash, Math.max(COP_MIN_FINE, Math.ceil(this.cash * COP_FINE)));
    this.removeOrder(order);
    this.cash -= fine;
    this.stats.fines += fine;
    sfx(this, 'miss');
    this.cameras.main.shake(200, 0.006);
    this.floatText(order.x, order.y - 30, fine > 0 ? `FINED! -$${fine}` : 'FINED!', '#ff5252');
    this.updateHud();
  }

  deliver(order, disp, i = 0) {
    const { house } = order;
    const pay = order.product.pay;
    this.removeOrder(order);
    this.stats.delivered += 1;
    this.cash += pay;
    this.floatText(house.bx, house.by - 30, `+$${pay}`, '#c5ff9e');
    this.advanceCombo(disp);
    this.updateHud();

    // Courier rides from the shop along the roads to the house, then drops a tip.
    const path = this.roadPath(disp.x, disp.y, house.x, house.y);
    const courier = this.add.image(disp.x, disp.y, 'courier').setDisplaySize(58 * UI_K, 58 * UI_K).setDepth(8);
    const ride = { t: 0 };
    this.tweens.add({
      targets: ride, t: 1, duration: path.getLength() / 0.42, delay: i * 250,
      onUpdate: () => {
        const p = path.getPoint(ride.t);
        if (Math.abs(p.x - courier.x) > 0.5) courier.setFlipX(p.x < courier.x);
        courier.setPosition(p.x, p.y);
      },
      onComplete: () => {
        this.dropTip(house);
        this.tweens.add({ targets: courier, alpha: 0, duration: 250, onComplete: () => courier.destroy() });
      },
    });
  }

  // Door → road below it → best cross street → destination's road → its door.
  roadPath(x1, y1, x2, y2) {
    const RY = this.roadY, RX = this.roadX;
    const roadBelow = y => RY.find(r => r > y) ?? RY[RY.length - 1];
    const ry1 = roadBelow(y1), ry2 = roadBelow(y2);
    const pts = [[x1, y1], [x1, ry1]];
    if (ry1 !== ry2) {
      const vx = RX.reduce((best, x) =>
        Math.abs(x1 - x) + Math.abs(x - x2) < Math.abs(x1 - best) + Math.abs(best - x2) ? x : best);
      pts.push([vx, ry1], [vx, ry2]);
    }
    pts.push([x2, ry2], [x2, y2]);
    const path = new Phaser.Curves.Path(x1, y1);
    let [px, py] = pts[0];
    for (const [x, y] of pts.slice(1)) {
      if (x !== px || y !== py) path.lineTo(x, y);
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
      this.floatText(house.x + 26 * UI_K, house.y - 24 * UI_K, `tip +$${amount}`, '#ffe082');
      sfx(this, 'tip');
      this.cash += amount;           // counts right away; the coin flight is just for show
      this.stats.tips += 1;
      this.stats.tipCash += amount;
      this.updateHud();
      const coin = this.add.image(house.x + 26 * UI_K, house.y, 'jar-coin').setDepth(40).setDisplaySize(36 * UI_K, 36 * UI_K);
      this.tweens.add({
        targets: coin, x: HUD.jar.x, y: HUD.jar.y - 78 * JK, scale: coin.scale * 0.7, duration: 500, ease: 'Quad.In',
        onComplete: () => coin.destroy(),
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
      this.stats.frenzies += 1;
      this.showFrenzy(disp);
      this.comboProduct = null;
      this.comboCount = 0;
      // Clear the word after the banner, keeping a letter the next order in the batch lit.
      this.time.delayedCall(700, () => {
        if (!this.over) this.lightLetters(disp, this.comboProduct === disp.product ? this.comboCount : 0, false);
      });
    }
  }

  lightLetters(disp, count = this.comboCount, animate = true) {
    disp.letters.forEach((t, i) => {
      const lit = i < count;
      t.setTexture(`letter-${i}-${lit ? 'on' : 'off'}`);
      if (animate && lit && i === count - 1) {
        sfx(this, 'letter');
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

  // A miss: one order (too slow) or a whole batch (wrong shop). Costs one star.
  fail(orders, label) {
    const list = Array.isArray(orders) ? orders : [orders];
    list.forEach(order => {
      this.removeOrder(order);
      this.floatText(order.house.bx, order.house.by - 30, label, '#ff6b6b');
    });
    this.stats.missed += list.length;
    this.resetCombo();
    this.stars -= 1;
    sfx(this, 'miss');
    this.cameras.main.shake(150, 0.004);
    this.updateHud();
    if (this.stars <= 0) this.endGame(false);
  }

  // ---------- Loop ----------
  update(time, delta) {
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
      this.endGame(this.cash >= this.st.goal);
      return;
    }

    // Spawning gets faster over the level, and doubles in rush hour.
    this.nextSpawn -= delta;
    if (this.nextSpawn <= 0) {
      this.spawnOrder();
      const progress = this.elapsed / this.levelMs;
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
        if (order.kind === 'robber') {        // ignoring the robber is right: no penalty
          this.floatText(order.x, order.y - 30, 'Dodged him!', '#c5ff9e');
          this.removeOrder(order);
        } else if (order.kind === 'cop') {    // ignoring the cop costs you
          this.copFine(order);
        } else {
          this.fail(order, 'Too slow!');
          if (this.over) return;
        }
        continue;
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
      fontFamily: 'Arial', fontSize: `${Math.round(18 * UI_K)}px`, color: '#ffffff', align: 'center',
      backgroundColor: '#000000aa', padding: { x: 14, y: 10 },
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

    // Bank the cash, record the best, unlock the next stage.
    const save = loadSave();
    const earned = Math.max(0, this.cash);
    save.wallet += earned;
    const prevBest = save.best[this.st.id] || 0;
    const newBest = this.cash > prevBest;
    if (newBest) save.best[this.st.id] = this.cash;
    const firstClear = won && !save.cleared.includes(this.st.id);
    if (won && !save.cleared.includes(this.st.id)) save.cleared.push(this.st.id);
    writeSave(save);

    const cx = W / 2, cy = H / 2;
    const txt = (x, y, str, size, color = '#ffffff', extra = {}) =>
      text(this, x, y, str, size, color, extra).setDepth(42);

    this.add.rectangle(cx, cy, W, H, 0x000000, 0.65).setDepth(40);
    // Results card: the metal rolling tray once assets/ui-tray.png exists.
    if (this.textures.exists('ui-tray')) {
      this.add.image(cx, cy, 'ui-tray').setDisplaySize(680, 680).setDepth(41);
      const inner = this.add.graphics().setDepth(41);
      inner.fillStyle(0x14121c, 0.9).fillRoundedRect(cx - 285, cy - 290, 570, 570, 22);
      inner.lineStyle(4, won ? 0x8ee34a : 0xff8a80).strokeRoundedRect(cx - 285, cy - 290, 570, 570, 22);
    } else {
      card(this, cx, cy, 600, 600, won ? 0x8ee34a : 0xff8a80, 0.96).setDepth(41);
    }

    const title = won ? 'STAGE COMPLETE!' : (this.stars <= 0 ? 'OUT OF STARS!' : 'MISSED THE GOAL');
    txt(cx, cy - 255, title, 42, won ? '#c5ff9e' : '#ff8a80', { fontFamily: 'Arial Black, Arial' });
    txt(cx, cy - 200, `Cash: $${this.cash}   (goal $${this.st.goal})`, 26);
    txt(cx, cy - 162, newBest ? `🏆 NEW BEST: $${this.cash}!` : `🏆 Best: $${Math.max(prevBest, this.cash)}`, 22, '#ffd54f');
    txt(cx, cy - 124, `+$${earned} to your wallet  (💰 $${save.wallet})`, 21, '#c5ff9e');

    const s = this.stats;
    const rows = [
      ['Orders delivered', `${s.delivered}`],
      ['WEED FRENZY bonuses', `${s.frenzies}`],
      ['Tips grabbed', `${s.tips}  (+$${s.tipCash})`],
      ['Times robbed', s.robbed ? `${s.robbed}  (-$${s.stolen})` : '0'],
      ['Cop payoffs / fines', `${s.copsPaid}  /  -$${s.fines}`],
      ['Missed orders', `${s.missed}`],
    ];
    rows.forEach(([name, val], i) => {
      const y = cy - 72 + i * 34;
      this.add.text(cx - 240, y, name, { fontFamily: 'Arial', fontSize: '20px', color: '#cccccc' }).setOrigin(0, 0.5).setDepth(42);
      this.add.text(cx + 240, y, val, { fontFamily: 'Arial', fontSize: '20px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(1, 0.5).setDepth(42);
    });

    const next = STAGES[this.stageIndex + 1];
    if (firstClear && next) txt(cx, cy + 148, `🔓 Stage ${this.stageIndex + 2} unlocked: ${next.name}`, 21, '#ffd54f');

    // Buttons (after a short delay so a frantic last tap doesn't hit one).
    this.time.delayedCall(500, () => {
      const btn = (x, label, fn) => {
        const b = woodButton(this, x, cy + 230, 250, 72, label, fn, true, 22);
        b.img.setDepth(42); b.t.setDepth(43);
      };
      btn(cx - 135, 'RE-UP', () => this.scene.restart({ stage: this.stageIndex, stock: this.stock }));
      btn(cx + 135, 'STAGES', () => this.scene.start('stages'));
    });
  }
}

new Phaser.Game({
  // Canvas renderer + plain <img> loading lets the game run from a double-clicked
  // index.html (browsers block WebGL images from local files).
  type: Phaser.CANVAS,
  loader: { imageLoadType: 'HTMLImageElement' },
  parent: 'game',
  // Drawn at double resolution (camera zoom 2) so art and text stay sharp.
  width: W * RES,
  height: H * RES,
  backgroundColor: '#14121c',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  // Web Audio on the real site (reliable on phones); HTML5 audio only for local files.
  audio: { disableWebAudio: location.protocol === 'file:' },
  scene: [TitleScene, StagesScene, ShopScene, StockScene, GameScene],
});
