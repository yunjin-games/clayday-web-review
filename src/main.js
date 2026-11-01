// 화면 전환, 입력, 사격 장면.
import {
  WIDTH, HEIGHT, STAGE_COUNT, STAGES_PER_PAGE, Session, discPos, newSave, applyResult, buyUpgrade, isUnlocked,
  totalStars, upgradeCost, sideForKey, sideForPoint, COUNT_IN_STEPS, COMBO_STEPS, comboRate, worldOf, worldIndex, isWorldStart,
  ALL_CLEAR_COINS,
} from './core.js';
import { audioInfo, loadAudio, unlockAudio, play, playAt, playMusic, stopMusic, pauseMusic, resumeMusic, setSfx, setMusic } from './audio.js';
import { initSdk, loadingFinished, gameplayStart, gameplayStop, commercialBreak, rewardedBreak, adsAvailable } from './sdk.js';

const SAVE_KEY = 'clay-day-save-v1';
const $ = id => document.getElementById(id);
const number = value => value.toLocaleString('en-US');

// ---------- 저장 ----------
function readSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? { ...newSave(), ...JSON.parse(raw) } : newSave();
  } catch {
    return newSave();
  }
}

const save = readSave();
const settings = { sfx: true, music: true };

function writeSave() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch {
    // 저장이 막힌 브라우저에서도 게임은 진행된다
  }
}

const latestStage = () => {
  for (let n = STAGE_COUNT; n >= 1; n--) if (isUnlocked(save, n)) return n;
  return 1;
};
const bestTotal = () => Object.values(save.best).reduce((a, b) => a + b, 0);

// ---------- 화면 ----------
const screens = ['title', 'stages', 'play', 'result'];
let screen = 'title';

function show(name) {
  screen = name;
  for (const s of screens) $(`s-${s}`).classList.toggle('on', s === name);
}

// 16:9 가 아닌 화면은 판을 늘려 빈 띠 없이 채운다. 게임 좌표의 1280×720 은 가로는 가운데, 세로는 아래에 붙인다
let viewW = WIDTH;
let viewH = HEIGHT;
let viewX = 0;
let viewY = 0;

function fit() {
  const scale = Math.min(innerWidth / WIDTH, innerHeight / HEIGHT);
  viewW = Math.ceil(innerWidth / scale);
  viewH = Math.ceil(innerHeight / scale);
  viewX = Math.floor((viewW - WIDTH) / 2);
  viewY = viewH - HEIGHT;
  const stage = $('stage');
  stage.style.setProperty('--w', `${viewW}px`);
  stage.style.setProperty('--h', `${viewH}px`);
  stage.style.transform = `scale(${scale})`;
  if (canvas.width !== viewW) canvas.width = viewW;
  if (canvas.height !== viewH) canvas.height = viewH;
}

function refreshTitle() {
  $('t-stars').textContent = totalStars(save);
  $('t-best').textContent = number(bestTotal());
  $('t-coins').textContent = number(save.coins);
  $('t-stage').textContent = `STAGE ${latestStage()}`;
}

const STAR = 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z';
const LOCK = 'M12 1.5a5.25 5.25 0 00-5.25 5.25v3a3 3 0 00-3 3v6.75a3 3 0 003 3h10.5a3 3 0 003-3v-6.75a3 3 0 00-3-3v-3c0-2.9-2.35-5.25-5.25-5.25zm3.75 8.25v-3a3.75 3.75 0 00-7.5 0v3h7.5z';
const star = cls => `<svg class="${cls}" viewBox="0 0 24 24" fill="currentColor"><path d="${STAR}"/></svg>`;
const CROWN = '<svg class="stage-crown" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 8.5l4.6 3.7L12 5l4.4 7.2L21 8.5 19 19H5L3 8.5z"/></svg>';

function stageCard(n) {
  const stars = save.stars[n] || 0;
  const best = save.best[n] ? `Best ${number(save.best[n])}` : 'Not played';
  if (!isUnlocked(save, n)) {
    const final = n === STAGE_COUNT;
    const tone = final ? 'text-amber-200' : 'text-slate-300/80';
    return `<div class="stage-card stage-locked">
      <div class="w-full flex items-center justify-between px-1">
        <span class="text-xs font-black uppercase ${tone} tracking-wider">${final ? 'FINAL' : 'STAGE'}</span>
        <svg class="w-3.5 h-3.5 ${final ? 'text-amber-200' : 'text-slate-300'}" viewBox="0 0 24 24" fill="currentColor"><path fill-rule="evenodd" clip-rule="evenodd" d="${LOCK}"/></svg>
      </div>
      <div class="text-4xl font-extrabold ${final ? 'text-amber-100' : 'text-slate-300/80'} tracking-tight leading-none my-1">${n}</div>
      <div class="text-[11px] font-bold ${final ? 'text-amber-200' : 'text-slate-300/70'} uppercase tracking-wider">Locked</div>
      <div class="w-full flex items-center justify-center gap-1.5 pt-1 border-t border-slate-500/40">${star('w-4 h-4 text-slate-500').repeat(3)}</div>
    </div>`;
  }
  if (!stars) {
    return `<div class="stage-card stage-current" data-stage="${n}" role="button" tabindex="0" aria-label="Play stage ${n}">
      <div class="absolute -top-3.5 inset-x-0 mx-auto w-24 bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-400 text-[#492803] font-black text-[10px] tracking-wider uppercase py-0.5 rounded-full border-2 border-[#391e04] shadow-md text-center">★ PLAY NEXT ★</div>
      <div class="w-full flex items-center justify-between px-1 mt-1">
        <span class="text-xs font-black uppercase text-[#143d04] tracking-wider">STAGE</span>
        <span class="text-[11px] font-black px-2 py-0.5 rounded-full bg-white text-[#1f6305] uppercase shadow-sm animate-pulse">ACTIVE</span>
      </div>
      <div class="text-4xl font-extrabold text-white stroke-text tracking-tight leading-none my-1">${n}</div>
      <div class="text-[11px] font-extrabold text-[#113a02] uppercase tracking-wider">${best}</div>
      <div class="w-full flex items-center justify-center gap-1.5 pt-1 border-t border-[#31690a]/40">${star('w-5 h-5 text-[#214f08] opacity-60').repeat(3)}</div>
    </div>`;
  }
  return `<div class="stage-card stage-cleared group" data-stage="${n}" role="button" tabindex="0" aria-label="Play stage ${n}">
    ${save.crowns[n] ? CROWN : ''}
    <div class="w-full flex items-center justify-between px-1">
      <span class="text-xs font-black uppercase text-[#88470a] tracking-wider">STAGE</span>
      <span class="text-[11px] font-black px-2 py-0.5 rounded-full bg-emerald-600 text-white uppercase shadow-sm">CLEAR</span>
    </div>
    <div class="text-4xl font-extrabold text-[#743505] tracking-tight leading-none my-1">${n}</div>
    <div class="text-[11px] font-bold text-[#864c1b] uppercase tracking-wider">${best}</div>
    <div class="w-full flex items-center justify-center gap-1.5 pt-1 border-t border-[#df9d54]/40">${star('w-5 h-5 text-amber-400 star-earned').repeat(stars)}${star('w-5 h-5 text-amber-800 star-empty').repeat(3 - stars)}</div>
  </div>`;
}

let stagePage = 0;
const pageCount = Math.ceil(STAGE_COUNT / STAGES_PER_PAGE);

function renderStagePage() {
  const first = stagePage * STAGES_PER_PAGE + 1;
  const last = Math.min(first + STAGES_PER_PAGE - 1, STAGE_COUNT);
  $('st-range').textContent = `${worldOf(first).name} • Stages ${first} - ${last}`;
  let cards = '';
  for (let n = first; n <= last; n++) cards += stageCard(n);
  $('stage-grid').innerHTML = cards;
  $('st-prev').style.visibility = stagePage > 0 ? 'visible' : 'hidden';
  $('st-next').style.visibility = stagePage < pageCount - 1 ? 'visible' : 'hidden';
}

function refreshStages() {
  $('st-stars').textContent = totalStars(save);
  $('st-coins').textContent = number(save.coins);
  $('st-play-n').textContent = latestStage();
  stagePage = Math.floor((latestStage() - 1) / STAGES_PER_PAGE);
  renderStagePage();
}

function turnPage(delta) {
  stagePage = Math.max(0, Math.min(pageCount - 1, stagePage + delta));
  renderStagePage();
}

function refreshUpgrades() {
  $('u-coins').textContent = number(save.coins);
  const rows = { ring: ['u-ring-level', 'buy-ring', '10% wider rings'], reload: ['u-reload-level', 'buy-reload', 'Quicker reload'] };
  for (const [key, [label, button, text]] of Object.entries(rows)) {
    const level = save.upgrades[key];
    const cost = upgradeCost(key, level);
    $(label).textContent = `Level ${level} / 3 • ${text}`;
    $(button).textContent = cost === null ? 'MAX' : `${cost} COINS`;
    $(button).disabled = cost === null || save.coins < cost;
    $(button).style.opacity = $(button).disabled ? 0.55 : 1;
  }
}

function openModal(name) {
  if (name === 'upgrades') refreshUpgrades();
  $(`m-${name}`).classList.remove('hidden');
}

function closeModals() {
  document.querySelectorAll('[data-modal]').forEach(m => m.classList.add('hidden'));
  refreshTitle();
  if (screen === 'stages') refreshStages();
  if (screen === 'result') renderResultCoins();
}

// ---------- 사격 장면 ----------
const canvas = $('field');
const ctx = canvas.getContext('2d');
const images = {};
const IMAGE_FILES = ['clay', 'bird', 'bee', 'gun', 'flash_1', 'flash_2', 'shard_1', 'shard_2', 'shard_3', 'shard_4', 'shard_5', 'shard_6'];

const loadImage = name => new Promise((resolve, reject) => {
  const img = new Image();
  img.onload = () => { images[name] = img; resolve(); };
  img.onerror = reject;
  img.src = `assets/img/${name}.webp`;
});

// 밝기는 두고 색만 바꿔서 접시의 테두리와 무늬가 그대로 남는다
function tinted(img, color) {
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  const g = c.getContext('2d');
  g.drawImage(img, 0, 0);
  g.globalCompositeOperation = 'color';
  g.fillStyle = color;
  g.fillRect(0, 0, c.width, c.height);
  g.globalCompositeOperation = 'destination-in';
  g.drawImage(img, 0, 0);
  return c;
}

const GUNSHOT_CUT = 0.45;
const RELOAD_CLICK = 0.41;
let session = null;
let paused = false;
let finishing = 0;
let lastTime = 0;
let nextStep = 0;
let shake = 0;
let recoil = 0;
let aim = -1;
let aimTarget = -1;
let flash = 0;
let flashSide = 'L';
const particles = [];
const popups = [];
const fleeing = [];
const shotMarks = [];
let hudScore = -1;
let hudStreak = -1;
const comboPops = [];
const COMBO_POP_LIFE = 0.6;
const COMBO_TILT = -0.2;
const COMBO_COLORS = ['#fff', '#ffd982', '#ff9b1f', '#ff5a5a'];
let allClearPop = 0;
const ALL_CLEAR_LIFE = 1.8;
const CONFETTI_COLORS = ['#ffd982', '#ff9b1f', '#ff5a5a', '#58c8ff', '#fff'];
let hudLeft = -1;
let hudShots = -1;

function burst(x, y, gold) {
  for (let i = 0; i < (gold ? 22 : 15); i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 120 + Math.random() * 360;
    particles.push({
      img: images[`shard_${1 + (i % 6)}`], x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 80,
      spin: (Math.random() - 0.5) * 16, angle: Math.random() * 6, size: 16 + Math.random() * 22, life: 0.9,
    });
  }
}

// 새는 다치지 않는다. 깃털만 날리고 놀라서 도망간다
function scareBird(x, y, side, bee) {
  fleeing.push({ x, y, vx: side === 'L' ? -520 : 520, vy: -620, life: 1.1, dir: side === 'L' ? 1 : -1, img: bee ? images.bee : images.bird });
  for (let i = 0; i < 12; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 60 + Math.random() * 170;
    particles.push({
      feather: true, x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 60,
      spin: (Math.random() - 0.5) * 6, angle: Math.random() * 6, size: 14 + Math.random() * 12, life: 1,
    });
  }
}

// 맞힐 때마다 콤보 숫자가 팝콘처럼 터진다. 기울기는 언제나 같은 방향이다
function popCombo(event) {
  // 앞 숫자를 바로 걷어 내서 빠른 구간에서도 겹쳐 뭉개지지 않는다
  for (const pop of comboPops) pop.life = Math.min(pop.life, 0.12);
  comboPops.push({
    text: `x${event.streak}`, color: COMBO_COLORS[event.rate - 1], life: COMBO_POP_LIFE,
    x: 640 + (Math.random() - 0.5) * 90, y: 205 + (Math.random() - 0.5) * 40,
  });
}

// 마지막 접시까지 전부 맞히면 콤보 대신 ALL CLEAR 가 터지고 색종이가 날린다
function celebrateAllClear() {
  comboPops.length = 0;
  allClearPop = ALL_CLEAR_LIFE;
  play('cheer_big', { gain: 0.7 });
  for (let i = 0; i < 70; i++) {
    const angle = -Math.PI * Math.random();
    const speed = 260 + Math.random() * 520;
    particles.push({
      confetti: CONFETTI_COLORS[i % CONFETTI_COLORS.length], x: 640, y: 300,
      vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      spin: (Math.random() - 0.5) * 14, angle: Math.random() * 6, size: 12 + Math.random() * 10, life: 1.5,
    });
  }
}

function showPopup(label, text) {
  const popup = $('popup');
  $('p-label').textContent = label;
  $('p-points').textContent = text;
  popup.classList.remove('show');
  void popup.offsetWidth;
  popup.classList.add('show');
}

function fire(side) {
  if (!session || paused || session.finished || screen !== 'play') return;
  unlockAudio();
  const event = session.fire(side);
  aimTarget = side === 'L' ? -1 : 1;
  if (event.type === 'empty') {
    play('empty_click');
    return;
  }
  // 소리와 반동을 입력과 같은 순간에 시작한다
  play(`gunshot_${1 + Math.floor(Math.random() * 3)}`, { cut: GUNSHOT_CUT });
  recoil = 1;
  flash = 1;
  flashSide = side;
  shotMarks.push({ ...session.ring(side), r: 22, life: 0.22, seed: Math.random() * 6 });
  shake = Math.max(shake, 5);
  // 뒷소리가 다음 발에 밀리지 않게 두 발을 다 쓴 빈 칸에만 탄피가 떨어진다
  if (session.shots === 0) playAt('shell_drop', 0.1, { gain: 0.35 });
  if (event.type === 'hit') {
    play(`clay_break_${1 + Math.floor(Math.random() * 3)}`);
    burst(event.x, event.y, event.gold);
    shake = 9;
    if (event.streak >= 2) popCombo(event);
    if (event.perfect) {
      play('ding', { rate: 2 ** (Math.min(event.streak, 12) / 12), gain: 0.7 });
      shake = 13;
    }
    if (event.allClear) {
      celebrateAllClear();
    } else if (event.rateUp) {
      play(event.rate === 4 ? 'cheer_big' : 'cheer_small', { gain: 0.4 });
      showPopup(`${event.streak} IN A ROW!`, `SCORE x${event.rate}`);
    } else if (event.perfect) {
      showPopup(event.gold ? 'GOLD PERFECT!' : 'PERFECT!', `+${event.points}`);
    } else if (event.gold) {
      showPopup('GOLD CLAY!', `+${event.points}`);
    } else {
      popups.push({ x: event.x, y: event.y, text: `+${event.points}`, life: 0.7 });
    }
  } else if (event.type === 'decoy') {
    play('bird_squawk');
    scareBird(event.x, event.y, event.side, event.bee);
    showPopup(event.bee ? 'LEAVE THE BEES!' : 'LEAVE THE BIRDS!', `${event.points}`);
  } else if (event.type === 'crack') {
    play('ding', { rate: 0.6, gain: 0.5 });
    burst(event.x, event.y, false);
    shake = 7;
    popups.push({ x: event.x, y: event.y, text: 'One more!', life: 0.6 });
  }
  refreshHud();
}

function refreshHud() {
  if (!session) return;
  if (session.score !== hudScore) $('h-score').textContent = number(hudScore = session.score);
  if (session.streak !== hudStreak) {
    if (session.streak === 0 && hudStreak >= COMBO_STEPS[0]) {
      play('aww_crowd', { gain: 0.3 });
      popups.push({ x: 640, y: 250, text: 'Combo lost', life: 0.8 });
    }
    hudStreak = session.streak;
    const rate = comboRate(hudStreak);
    $('h-rate').textContent = rate;
    $('h-rate-badge').dataset.rate = rate;
  }
  if (session.waiting !== hudLeft) $('h-left').textContent = hudLeft = session.waiting;
  if (session.shots !== hudShots) {
    hudShots = session.shots;
    $('h-shots').textContent = hudShots === 0 ? 'Reloading' : `${hudShots} / 2`;
    $('shell-1').classList.toggle('shell-used', hudShots < 1);
    $('shell-2').classList.toggle('shell-used', hudShots < 2);
    $('btn-left').classList.toggle('no-shot', hudShots === 0);
    $('btn-right').classList.toggle('no-shot', hudShots === 0);
  }
}

function drawRing(side, active) {
  const ring = session.ring(side);
  const r = session.radius;
  ctx.save();
  ctx.lineWidth = active ? 7 : 5;
  ctx.setLineDash(active ? [] : [16, 12]);
  ctx.strokeStyle = 'rgba(60,30,10,.55)';
  ctx.beginPath(); ctx.arc(ring.x, ring.y + 2, r, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = active ? '#ffe978' : 'rgba(255,255,255,.9)';
  ctx.beginPath(); ctx.arc(ring.x, ring.y, r, 0, Math.PI * 2); ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = active ? 'rgba(255,233,120,.22)' : 'rgba(255,255,255,.09)';
  ctx.beginPath(); ctx.arc(ring.x, ring.y, r, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = active ? '#ffe978' : 'rgba(255,255,255,.9)';
  ctx.beginPath(); ctx.arc(ring.x, ring.y, r * 0.38, 0, Math.PI * 2);
  ctx.globalAlpha = 0.28; ctx.fill(); ctx.globalAlpha = 1;
  ctx.restore();
}

function drawGun() {
  const gun = images.gun;
  const scale = 620 / gun.height;
  const w = gun.width * scale;
  const h = 620;
  ctx.save();
  ctx.translate(640, 905);
  ctx.rotate(aim * 0.28);
  ctx.translate(0, recoil * 46);
  if (flash > 0.02) {
    const img = flash > 0.5 ? images.flash_1 : images.flash_2;
    const size = 230 * (0.6 + flash * 0.6);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = Math.min(1, flash * 1.4);
    ctx.drawImage(img, -8 - size / 2, -568 - size / 2, size, size);
    ctx.restore();
  }
  ctx.drawImage(gun, -w / 2, -560, w, h);
  ctx.restore();
}

function drawFlyer(img, x, y, dir) {
  const flap = 1 + 0.1 * Math.sin(performance.now() / 45);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(dir, flap);
  ctx.drawImage(img, -48, -48, 96, 96);
  ctx.restore();
}

// 안개가 천천히 지나가며 링을 가린다
function drawFog() {
  const t = performance.now() / 1000;
  ctx.save();
  ctx.fillStyle = 'rgba(245,250,255,.86)';
  for (let i = 0; i < 3; i++) {
    const x = ((t * 70 + i * 560) % (viewW + 400)) - 200 - viewX;
    const y = 200 + Math.sin(t * 0.6 + i * 2) * 26;
    for (const [dx, dy, r] of [[0, 0, 96], [-92, 18, 70], [94, 16, 74], [40, -38, 62]]) {
      ctx.beginPath(); ctx.arc(x + dx, y + dy, r, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.restore();
}

// 밤에는 링 주변만 보인다
function drawNight() {
  ctx.save();
  ctx.fillStyle = 'rgba(5,9,30,.8)';
  ctx.beginPath();
  ctx.rect(-viewX - 20, -viewY - 20, viewW + 40, viewH + 40);
  for (const side of ['L', 'R']) {
    const ring = session.ring(side);
    ctx.moveTo(ring.x + 118, ring.y);
    ctx.arc(ring.x, ring.y, 118, 0, Math.PI * 2);
  }
  ctx.fill('evenodd');
  ctx.restore();
}

// 눈, 비, 불꽃은 화면 분위기만 바꾼다
function drawWeather(kind) {
  const t = performance.now() / 1000;
  ctx.save();
  if (kind === 'snow') {
    ctx.fillStyle = 'rgba(255,255,255,.9)';
    for (let i = 0; i < 46; i++) {
      const x = (i * 137 + t * 34 + Math.sin(t + i) * 18) % viewW - viewX;
      const y = (i * 91 + t * (70 + (i % 5) * 16)) % viewH - viewY;
      ctx.beginPath(); ctx.arc(x, y, 2 + (i % 3), 0, Math.PI * 2); ctx.fill();
    }
  } else if (kind === 'rain') {
    ctx.strokeStyle = 'rgba(210,230,255,.45)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 60; i++) {
      const x = (i * 113 + t * 180) % viewW - viewX;
      const y = (i * 79 + t * 760) % viewH - viewY;
      ctx.moveTo(x, y); ctx.lineTo(x - 7, y + 20);
    }
    ctx.stroke();
  } else if (kind === 'sparks') {
    const colors = ['#ffd23f', '#ff6fa8', '#6fe3ff', '#b6ff6f'];
    for (let burstIndex = 0; burstIndex < 3; burstIndex++) {
      const phase = (t * 0.5 + burstIndex * 0.37) % 1;
      const seed = Math.floor(t * 0.5 + burstIndex * 0.37) * 7 + burstIndex * 13;
      const cx = 120 + (seed * 211) % 1040;
      const cy = 50 + (seed * 97) % 90;
      ctx.globalAlpha = 1 - phase;
      ctx.fillStyle = colors[seed % 4];
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        ctx.beginPath(); ctx.arc(cx + Math.cos(a) * phase * 90, cy + Math.sin(a) * phase * 90, 3, 0, Math.PI * 2); ctx.fill();
      }
    }
  }
  ctx.restore();
}

// 터지듯 확 커졌다가 잠깐 줄고, 다시 부풀면서 사라진다
const popScale = u => {
  if (u < 0.22) return 0.2 + 1.3 * (u / 0.22);
  if (u < 0.4) return 1.5 - 0.5 * ((u - 0.22) / 0.18);
  return 1 + 0.35 * ((u - 0.4) / 0.6);
};

// 플레이어가 보는 두 링 사이에 콤보를 보여 준다. 배율이 오르면 색이 달라진다
function drawCombo() {
  const label = (text, y) => { ctx.strokeText(text, 0, y); ctx.fillText(text, 0, y); };
  for (const pop of comboPops) {
    const u = 1 - pop.life / COMBO_POP_LIFE;
    const scale = popScale(u);
    ctx.save();
    ctx.globalAlpha = Math.min(1, (1 - u) / 0.3);
    ctx.translate(pop.x, pop.y);
    ctx.rotate(COMBO_TILT);
    ctx.scale(scale, scale);
    ctx.textAlign = 'center';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#3c1e0a';
    ctx.fillStyle = '#fff';
    ctx.lineWidth = 6;
    ctx.font = '700 24px Fredoka, sans-serif';
    label('COMBO', -34);
    ctx.fillStyle = pop.color;
    ctx.lineWidth = 10;
    ctx.font = '700 76px Fredoka, sans-serif';
    label(pop.text, 34);
    ctx.restore();
  }
}

function drawAllClear() {
  if (allClearPop <= 0) return;
  const u = 1 - allClearPop / ALL_CLEAR_LIFE;
  const scale = popScale(Math.min(1, u * 2));
  const label = (text, y) => { ctx.strokeText(text, 0, y); ctx.fillText(text, 0, y); };
  ctx.save();
  ctx.globalAlpha = Math.min(1, (1 - u) / 0.2);
  ctx.translate(640, 250);
  ctx.rotate(COMBO_TILT);
  ctx.scale(scale, scale);
  ctx.textAlign = 'center';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#3c1e0a';
  ctx.fillStyle = '#ffd982';
  ctx.lineWidth = 14;
  ctx.font = '700 96px Fredoka, sans-serif';
  label('ALL CLEAR!', 10);
  ctx.fillStyle = '#fff';
  ctx.lineWidth = 8;
  ctx.font = '700 34px Fredoka, sans-serif';
  label(`COINS x${ALL_CLEAR_COINS}`, 62);
  ctx.restore();
}

// 새 세계의 첫 스테이지에서 방해 요소를 알려 준다
function drawWorldIntro() {
  const world = worldOf(session.stage);
  const alpha = Math.min(1, Math.max(0, (session.start + 1.6 - session.t) * 2));
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = 'rgba(60,30,10,.92)';
  ctx.strokeStyle = '#ffd982';
  ctx.lineWidth = 5;
  ctx.beginPath(); ctx.roundRect(310, 300, 660, 118, 22); ctx.fill(); ctx.stroke();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd982';
  ctx.font = '700 26px Fredoka, sans-serif';
  ctx.fillText(world.name, 640, 340);
  ctx.fillStyle = '#fff';
  ctx.font = '700 34px Fredoka, sans-serif';
  ctx.fillText(world.intro, 640, 390);
  ctx.restore();
}

// 판이 16:9 보다 늘어난 자리는 배경을 거울처럼 이어 붙인다. 세로로 남는 자리는 하늘뿐이다
function drawField() {
  for (const col of viewW > WIDTH ? [-1, 0, 1] : [0]) {
    for (const row of viewY > 0 ? [-1, 0] : [0]) {
      ctx.save();
      ctx.translate(col > 0 ? WIDTH * 2 : 0, 0);
      ctx.scale(col ? -1 : 1, row ? -1 : 1);
      ctx.drawImage(images.field, 0, 0, WIDTH, HEIGHT);
      ctx.restore();
    }
  }
}

function draw() {
  ctx.save();
  ctx.translate(viewX, viewY);
  if (shake > 0.2) ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
  drawField();
  if (session) {
    const flying = session.discs.filter(d => d.state === 'flying').map(d => ({ d, p: discPos(d, session.t) }));
    const inRing = side => {
      const ring = session.ring(side);
      return flying.some(({ d, p }) => !d.passed && !d.decoy && Math.hypot(p.x - ring.x, p.y - ring.y) <= session.radius);
    };
    drawRing('L', inRing('L'));
    drawRing('R', inRing('R'));
    for (const { d, p } of flying) {
      if (d.decoy) {
        drawFlyer(d.bee ? images.bee : images.bird, p.x, p.y, d.side === 'L' ? -1 : 1);
        continue;
      }
      const img = d.gold ? images.clayGold : d.hp > 1 ? images.claySteel : d.angle === 'drop' ? images.clayHigh : d.angle ? images.clayFast : images.clay;
      const size = (d.small ? 0.62 : 1) * 78 + 18 * Math.sin(Math.PI * Math.max(0, Math.min(1, p.u)));
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((d.side === 'L' ? -0.22 : 0.22) * (1 - 2 * Math.max(0, Math.min(1, p.u))));
      ctx.drawImage(img, -size / 2, -size / 2, size, size);
      ctx.restore();
    }
    for (const m of shotMarks) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, m.life * 6);
      ctx.fillStyle = '#fff6c9';
      ctx.strokeStyle = '#3c1e0a';
      ctx.lineWidth = 2;
      for (let i = 0; i < 12; i++) {
        const a = m.seed + i * 2.399;
        const d = m.r * (0.35 + (i % 4) * 0.25);
        ctx.beginPath(); ctx.arc(m.x + Math.cos(a) * d, m.y + Math.sin(a) * d, 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      }
      ctx.restore();
    }
    for (const b of fleeing) drawFlyer(b.img, b.x, b.y, b.dir);
    for (const q of particles) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, q.life * 2);
      ctx.translate(q.x, q.y);
      ctx.rotate(q.angle);
      if (q.feather) {
        ctx.fillStyle = '#fff'; ctx.strokeStyle = '#3c1e0a'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(0, 0, q.size / 2, q.size / 5, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      } else if (q.confetti) {
        ctx.fillStyle = q.confetti;
        ctx.fillRect(-q.size / 2, -q.size / 4, q.size, q.size / 2);
      } else {
        ctx.drawImage(q.img, -q.size / 2, -q.size / 2, q.size, q.size);
      }
      ctx.restore();
    }
    ctx.font = "700 34px Fredoka, sans-serif";
    ctx.textAlign = 'center';
    ctx.lineWidth = 7;
    ctx.strokeStyle = '#3c1e0a';
    ctx.fillStyle = '#fff';
    for (const q of popups) {
      ctx.globalAlpha = Math.min(1, q.life * 3);
      ctx.strokeText(q.text, q.x, q.y - 40 + q.life * 30);
      ctx.fillText(q.text, q.x, q.y - 40 + q.life * 30);
    }
    ctx.globalAlpha = 1;
    if (session.hazards.includes('fog')) drawFog();
    if (session.hazards.includes('night')) drawNight();
    const weather = { 5: 'snow', 8: 'rain', 9: 'sparks' }[worldIndex(session.stage)];
    if (weather) drawWeather(weather);
    drawCombo();
    drawAllClear();
  }
  drawGun();
  if (session && isWorldStart(session.stage)) drawWorldIntro();
  ctx.restore();
}

function handle(event) {
  if (event.type === 'launch' && !event.decoy) play(`thrower_${event.side === 'L' ? 1 : 2}`, { gain: 0.12 });
  // 탄이 차는 순간에 철컥이 들리도록 재장전 소리의 마지막 닫히는 소리만 쓴다
  if (event.type === 'reloaded' && event.wasEmpty) play('reload', { from: RELOAD_CLICK, gain: 1 });
  if (event.type === 'finished') finishing = Math.max(0.9, allClearPop);
}

// 박자 소리를 조금 앞서 예약해 화면 프레임과 관계없이 일정하게 울린다
function scheduleBeats() {
  while (true) {
    const at = session.start + nextStep * session.step;
    if (at - session.t > 0.12) return;
    // 접시가 오는 칸은 그쪽에서 들리고, 빈 칸은 네 칸마다 작은 소리로 박을 유지한다
    const side = session.sideAtStep(nextStep);
    const delay = Math.max(0, at - session.t);
    if (side === 'L') playAt('beat_low', delay, { gain: 0.45, pan: -0.7 });
    else if (side === 'R') playAt('beat_high', delay, { gain: 0.45, pan: 0.7 });
    else if (((nextStep % 4) + 4) % 4 === 0) playAt('beat_high', delay, { gain: 0.14 });
    nextStep += 1;
  }
}

function step(dt) {
  const realDt = dt;
  if (session && !paused && !session.finished) {
    session.update(dt).forEach(handle);
    scheduleBeats();
  }
  aim += (aimTarget - aim) * Math.min(1, realDt * 22);
  recoil = Math.max(0, recoil - realDt * 7);
  flash = Math.max(0, flash - realDt * 8);
  shake = Math.max(0, shake - realDt * 60);
  for (const m of shotMarks) {
    m.r += 320 * realDt; m.life -= realDt;
  }
  for (let i = shotMarks.length - 1; i >= 0; i--) if (shotMarks[i].life <= 0) shotMarks.splice(i, 1);
  for (const b of fleeing) {
    b.vy += 300 * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
  }
  for (let i = fleeing.length - 1; i >= 0; i--) if (fleeing[i].life <= 0) fleeing.splice(i, 1);
  for (const q of particles) {
    q.vy += (q.feather ? 120 : q.confetti ? 500 : 980) * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.angle += q.spin * dt; q.life -= dt;
  }
  for (let i = particles.length - 1; i >= 0; i--) if (particles[i].life <= 0) particles.splice(i, 1);
  for (let i = popups.length - 1; i >= 0; i--) if ((popups[i].life -= realDt) <= 0) popups.splice(i, 1);
  for (let i = comboPops.length - 1; i >= 0; i--) if ((comboPops[i].life -= realDt) <= 0) comboPops.splice(i, 1);
  allClearPop = Math.max(0, allClearPop - realDt);
  if (finishing > 0 && !paused) {
    finishing -= realDt;
    if (finishing <= 0) endStage();
  }
}

function frame(now) {
  const dt = Math.min(0.05, (now - lastTime) / 1000 || 0);
  lastTime = now;
  if (screen === 'play') {
    step(dt);
    refreshHud();
    draw();
  }
  requestAnimationFrame(frame);
}

// ---------- 흐름 ----------
let result = null;
let resultCoins = 0;

async function startStage(n) {
  const field = `world_${worldIndex(n) + 1}`;
  if (!images[field]) await loadImage(field);
  images.field = images[field];
  session = new Session(n, save.upgrades);
  paused = false;
  finishing = 0;
  allClearPop = 0;
  particles.length = 0;
  popups.length = 0;
  comboPops.length = 0;
  fleeing.length = 0;
  shotMarks.length = 0;
  nextStep = -COUNT_IN_STEPS;
  hudScore = hudStreak = hudLeft = hudShots = -1;
  $('popup').classList.remove('show');
  $('h-stage').textContent = n;
  $('h-total').textContent = session.total;
  closeModals();
  show('play');
  refreshHud();
  stopMusic();
  gameplayStart();
}

function renderResultCoins() {
  if (!result) return;
  $('r-coins').textContent = `+${resultCoins}`;
}

function setStar(slot, earned) {
  const holder = document.querySelector(`[data-star="${slot}"]`);
  const size = slot === 2 ? 'w-24 h-24' : 'w-20 h-20';
  holder.querySelector('svg').outerHTML = (earned ? starGold : starEmpty).replace(/w-\d+ h-\d+/, size);
  holder.classList.toggle('opacity-60', !earned);
}

let starGold = '';
let starEmpty = '';

function endStage() {
  gameplayStop();
  result = session.result();
  resultCoins = result.coins;
  const newBest = applyResult(save, result.stage, result);
  writeSave();
  const n = result.stage;
  const missed = result.total - result.hits;
  $('r-title').textContent = result.allClear ? `Stage ${n} All Clear!` : result.clear ? `Stage ${n} Clear!` : `Stage ${n} Failed`;
  $('r-best').style.display = newBest ? '' : 'none';
  $('r-crown').style.display = result.allClear ? '' : 'none';
  $('r-score').textContent = number(result.score);
  $('r-hits').textContent = result.hits;
  $('r-total').textContent = result.total;
  $('r-missed').textContent = `${missed} Missed`;
  $('r-accuracy').textContent = `${result.accuracy}%`;
  $('r-praise').textContent = result.allClear ? 'Flawless!' : result.stars === 3 ? 'Great Shot!' : result.stars === 2 ? 'Sharp Eye!' : result.clear ? 'Nice try!' : 'Need 50%';
  $('r-streak').textContent = result.bestStreak;
  $('r-of').textContent = `Stage ${n} of ${STAGE_COUNT}`;
  $('r-next').textContent = result.clear && n < STAGE_COUNT ? `Next: Stage ${n + 1}` : result.clear ? 'All stages done' : 'Hit half to clear';
  $('r-extra').textContent = `+${result.coins} EXTRA`;
  $('r-next-label').textContent = !result.clear ? 'Try Again' : n < STAGE_COUNT ? 'Next Stage' : 'Stages';
  const double = $('r-double');
  const canDouble = result.coins > 0 && adsAvailable();
  double.disabled = !canDouble;
  double.style.opacity = canDouble ? 1 : 0.55;
  for (let i = 1; i <= 3; i++) setStar(i, i <= result.stars);
  renderResultCoins();
  show('result');
  playMusic('bgm_result');
  // 전부 맞힌 판은 마지막 접시에서 시작한 환호가 아직 이어진다
  if (!result.allClear) play(result.stars === 3 ? 'cheer_big' : result.clear ? 'cheer_small' : 'aww_crowd', { gain: 0.7 });
}

function setPaused(on) {
  if (screen !== 'play' || session?.finished) return;
  paused = on;
  $('m-pause').classList.toggle('hidden', !on);
  if (on) {
    gameplayStop();
    pauseMusic();
  } else {
    gameplayStart();
    resumeMusic();
  }
}

// 광고가 도는 동안과 다음 스테이지를 불러오는 동안은 입력을 받지 않는다(Poki 필수 조건)
let busy = false;

async function whileBusy(task) {
  busy = true;
  try {
    await task();
  } finally {
    busy = false;
  }
}

function nextFromResult() {
  if (!result || busy) return;
  const target = !result.clear ? result.stage : result.stage < STAGE_COUNT ? result.stage + 1 : null;
  if (target === null) {
    refreshStages();
    show('stages');
    playMusic('bgm_title');
    return;
  }
  whileBusy(async () => {
    await commercialBreak();
    await startStage(target);
  });
}

function doubleCoins() {
  const button = $('r-double');
  if (button.disabled || !result) return;
  button.disabled = true;
  button.style.opacity = 0.55;
  whileBusy(async () => {
    if (await rewardedBreak()) {
      save.coins += result.coins;
      resultCoins = result.coins * 2;
      writeSave();
      renderResultCoins();
      play('ding');
    } else {
      button.disabled = false;
      button.style.opacity = 1;
    }
  });
}

function tap(element, action) {
  element.addEventListener('click', () => {
    if (busy) return;
    unlockAudio();
    play('button', { gain: 0.6 });
    action();
  });
}

const SCROLL_KEYS = ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown', 'Home', 'End'];

function bindInput() {
  tap($('btn-play'), () => { refreshStages(); show('stages'); playMusic('bgm_title'); });
  tap($('st-back'), () => { refreshTitle(); show('title'); });
  tap($('st-play'), () => startStage(latestStage()));
  tap($('st-prev'), () => turnPage(-1));
  tap($('st-next'), () => turnPage(1));
  tap($('btn-sound'), () => { settings.sfx = settings.music = !settings.sfx; applySound(); });
  tap($('sfxToggle'), () => { settings.sfx = !settings.sfx; applySound(); });
  tap($('musicToggle'), () => { settings.music = !settings.music; applySound(); });
  tap($('buy-ring'), () => { if (buyUpgrade(save, 'ring')) { writeSave(); refreshUpgrades(); } });
  tap($('buy-reload'), () => { if (buyUpgrade(save, 'reload')) { writeSave(); refreshUpgrades(); } });
  tap($('btn-pause'), () => setPaused(true));
  tap($('btn-resume'), () => setPaused(false));
  tap($('btn-quit'), () => {
    paused = false; session = null; gameplayStop();
    closeModals(); refreshStages(); show('stages'); playMusic('bgm_title');
  });
  tap($('r-retry'), () => startStage(result.stage));
  tap($('r-next-btn'), nextFromResult);
  tap($('r-double'), doubleCoins);
  document.querySelectorAll('[data-open]').forEach(b => tap(b, () => openModal(b.dataset.open)));
  document.querySelectorAll('[data-close]').forEach(b => tap(b, closeModals));
  tap($('stage-grid'), () => {});
  $('stage-grid').addEventListener('click', e => {
    const card = e.target.closest('[data-stage]');
    if (card) startStage(+card.dataset.stage);
  });
  $('stage-grid').addEventListener('keydown', e => {
    const card = e.target.closest('[data-stage]');
    if (card && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); e.stopPropagation(); startStage(+card.dataset.stage); }
  });

  // 발사는 손이 닿는 순간 처리한다. click 을 기다리면 그만큼 늦는다
  for (const [id, side] of [['btn-left', 'L'], ['btn-right', 'R']]) {
    $(id).addEventListener('pointerdown', e => { e.preventDefault(); fire(side); });
  }
  // 화면 어디를 눌러도 쏜다. 왼쪽 절반은 왼쪽, 오른쪽 절반은 오른쪽이다
  canvas.addEventListener('pointerdown', e => {
    e.preventDefault();
    const box = canvas.getBoundingClientRect();
    fire(sideForPoint(((e.clientX - box.left) / box.width) * WIDTH));
  });
  addEventListener('keydown', e => {
    // 게임 키가 포키 페이지를 움직이면 안 된다. 다른 화면의 버튼을 스페이스로 누르는 것만 남긴다
    const onButton = screen !== 'play' && document.activeElement?.tagName === 'BUTTON';
    if (SCROLL_KEYS.includes(e.code) && !(e.code === 'Space' && onButton)) e.preventDefault();
    if (e.repeat || busy) return;
    unlockAudio();
    if (screen === 'play') {
      const side = sideForKey(e.code);
      if (side) fire(side);
      else if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); if (session) fire(session.nextSide()); }
      else if (e.code === 'Escape') setPaused(!paused);
    } else if (screen === 'result' && (e.code === 'Space' || e.code === 'Enter') && document.activeElement?.tagName !== 'BUTTON') {
      e.preventDefault();
      nextFromResult();
    }
  });
  addEventListener('blur', () => { if (screen === 'play' && !paused) setPaused(true); });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === 'play' && !paused) setPaused(true);
  });
  addEventListener('resize', fit);
  matchMedia('(orientation: portrait)').addEventListener('change', e => {
    if (e.matches && screen === 'play' && !paused) setPaused(true);
  });
  addEventListener('contextmenu', e => e.preventDefault());
  addEventListener('wheel', e => e.preventDefault(), { passive: false });
}

function applySound() {
  setSfx(settings.sfx);
  setMusic(settings.music);
  $('btn-sound').style.opacity = settings.sfx || settings.music ? 1 : 0.6;
  const paint = (button, on) => {
    button.style.backgroundColor = on ? '' : '#78716c';
    button.firstElementChild.style.transform = on ? '' : 'translateX(0)';
  };
  paint($('sfxToggle'), settings.sfx);
  paint($('musicToggle'), settings.music);
}

async function boot() {
  fit();
  starGold = document.querySelector('[data-star="1"] svg').outerHTML;
  starEmpty = document.querySelector('[data-star="3"] svg').outerHTML;
  await initSdk();
  await Promise.all([...IMAGE_FILES, 'world_1'].map(loadImage));
  images.field = images.world_1;
  images.clayGold = tinted(images.clay, '#ffd628');
  images.claySteel = tinted(images.clay, '#78879b');
  images.clayFast = tinted(images.clay, '#8a4dff');
  images.clayHigh = tinted(images.clay, '#3cdc5a');
  await document.fonts.ready;
  bindInput();
  refreshTitle();
  show('title');
  requestAnimationFrame(frame);
  await loadAudio();
  loadingFinished();
}

boot();
