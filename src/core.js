// 게임 규칙. 화면과 소리를 모르는 순수한 코드라 node --test 로 시험한다.
//
// 리듬이 게임의 중심이다. 접시는 짧은 칸(step) 단위로 끊기지 않고 이어져 나오고,
// 왼쪽 뒤에 오른쪽이 한 칸 차이로 붙어 나오기도 한다. 그래서 화면에는 늘 3~4개가 날아다닌다.
// 좌우 링은 네 칸을 한 박으로 삼아 호흡하듯 엇갈려 오르내린다.
// 접시는 자기 칸이 오는 순간 링 중심에 도착하므로 리듬에 맞춰 쏘면 딱 맞는다.

export const WIDTH = 1280;
export const HEIGHT = 720;
export const STAGE_COUNT = 500;
export const STAGES_PER_PAGE = 10;
export const RING_RADIUS = 56;
export const RING_X = { L: 400, R: 880 };
const RING_MIDDLE_Y = 215;
const RING_SWAY = 40;
const WIND_SWAY = 34;
const PERFECT_RATIO = 0.38;
const LAUNCH_X = { L: 130, R: 1150 };
const LAUNCH_Y = 470;
const LOADED_SHOTS = 2;
// 재장전 시간. 칸 길이의 배수라서 접시가 빨라지면 함께 빨라지고, 한 칸을 비우면 언제나 끝나 있다.
// 1.5 로 두었더니 사람의 오차로 재장전에 걸려 맞힐 수 없는 접시가 많았다(2026-11-01 실제 플레이)
const RELOAD_STEPS = 1;
const MAX_RUN = 2;
export const COUNT_IN_STEPS = 6;
const STEPS_PER_BEAT = 4;

// 8칸 리듬 조각. L·R 은 접시가 나오는 쪽, 점은 빈 칸이다. 빈 칸에는 새가 날아오기도 한다.
// 점은 두 개 넘게 잇지 않는다. 흐름이 끊기면 집중이 풀리기 때문이다.
// 접시는 두 개씩 붙어 온다. 두 발을 쏘면 장전해야 해서 한 칸을 비워 둔다
const PHRASES = [
  ['LR..RL..', 'L.R.L.R.', 'LR..LR..', 'RL..RL..', 'L.RL..R.', 'R.LR..L.', 'LL..RR..', 'RR..LL..'],
  ['LR.RL.LR', 'RL.LR.RL', 'L.RL.LR.', 'R.LR.RL.', 'LL.RR.L.', 'RR.LL.R.', 'LR.LL.R.', 'RL.RR.L.'],
  ['LR.LR.LR', 'RL.RL.RL', 'LL.RR.LL', 'RR.LL.RR', 'LR.RL.RL', 'RL.LR.LR', 'LR.LR.RL', 'RL.RL.LR'],
  ['LR.RR.LR', 'RL.LL.RL', 'LL.RL.RR', 'RR.LR.LL', 'LR.RL.LL', 'RL.LR.RR', 'LL.RR.LR', 'RR.LL.RL'],
];

const FIRST_STAGES = [
  { count: 30, step: 0.3, flight: 1.0, tier: 0, gold: 2, birds: 0 },
  { count: 34, step: 0.29, flight: 0.98, tier: 0, gold: 2, birds: 2 },
  { count: 38, step: 0.28, flight: 0.96, tier: 1, gold: 2, birds: 3 },
  { count: 42, step: 0.275, flight: 0.95, tier: 1, gold: 3, birds: 4 },
  { count: 46, step: 0.27, flight: 0.92, tier: 1, gold: 3, birds: 4 },
  { count: 50, step: 0.26, flight: 0.9, tier: 2, gold: 3, birds: 5 },
  { count: 54, step: 0.255, flight: 0.88, tier: 2, gold: 3, birds: 5 },
  { count: 58, step: 0.25, flight: 0.86, tier: 2, gold: 4, birds: 6 },
  { count: 62, step: 0.245, flight: 0.84, tier: 2, gold: 4, birds: 6 },
  { count: 66, step: 0.24, flight: 0.8, tier: 2, gold: 4, birds: 7 },
];

// 10스테이지까지는 직접 다듬었고, 그 뒤는 번호로 만든다.
// 10개씩 묶어 묶음마다 처음엔 쉽고 끝으로 갈수록 빨라지는 물결을 만든다
function baseDef(number) {
  if (number <= FIRST_STAGES.length) return FIRST_STAGES[number - 1];
  const pack = Math.floor((number - 1) / 10);
  const index = (number - 1) % 10;
  return {
    count: Math.min(40 + index * 3 + pack, 80),
    step: Math.max(0.21, 0.29 - pack * 0.002 - index * 0.004),
    flight: Math.max(0.66, 0.98 - pack * 0.006 - index * 0.012),
    tier: index < 3 ? 1 : pack < 3 ? 2 : 3,
    gold: 2 + Math.floor(index / 3),
    birds: Math.min(2 + Math.floor(index / 2) + Math.floor(pack / 3), 10),
  };
}

// 초반은 접시가 조금 더 천천히 나온다. 1스테이지는 10% 느리고 50스테이지에서 원래 속도가 된다.
// 장전 틈만큼 접시가 뜸해지므로 오래 날게 해서 화면에 3~4개를 유지한다. 1스테이지보다 느려지지는 않는다
function stageDef(number) {
  const def = baseDef(number);
  return {
    ...def,
    step: def.step * (1 + 0.1 * Math.max(0, (50 - number) / 49)),
    flight: Math.min(FIRST_STAGES[0].flight, def.flight * (1 + 0.2 * Math.min(1, (number - 1) / 9))),
  };
}

// 접시를 던지는 각도. 스테이지가 오를수록 새 각도가 섞인다.
// apex 는 가장 높이 뜨는 지점이 링보다 얼마나 앞뒤인지다(1 이면 링에서 가장 높다).
// cross 는 양쪽 링을 모두 지나서 첫 링을 놓쳐도 반대쪽에서 다시 맞힐 수 있다.
// speed 는 보통 접시와 견준 빠르기다. 낮고 멀리 가면 빠르고, 높이 뜨면 공중에 오래 머문다
const CROSS_TOP = 130;
const ANGLES = {
  cross: { from: 1, speed: 1.5 },
  drop: { from: 6, apex: 0.7, speed: 0.75 },
  rise: { from: 16, apex: 1.4, speed: 1.25 },
};

// 콤보가 이어질수록 점수 배율이 오른다
export const COMBO_STEPS = [5, 15, 30];
export const comboRate = streak => 1 + COMBO_STEPS.filter(step => streak >= step).length;

// 세계마다 배경과 방해 요소가 하나씩 새로 나온다. 한 판이 약 26초라서 앞쪽은 빨리 바꾼다
export const WORLD_STARTS = [1, 11, 21, 51, 71, 101, 151, 201, 301, 401];
export const WORLDS = [
  { name: 'Sunny Meadow', hazard: 'bird', intro: 'Leave the birds alone!' },
  { name: 'Sunset Farm', hazard: 'steel', intro: 'Steel clays take two shots!' },
  { name: 'Misty Lake', hazard: 'fog', intro: 'Fog hides the rings. Trust the beat!' },
  { name: 'Windy Hill', hazard: 'wind', intro: 'Wind pushes the rings!' },
  { name: 'Flower Garden', hazard: 'bee', intro: 'Bees zigzag. Leave them alone!' },
  { name: 'Snowy Field', hazard: 'curve', intro: 'Curve clays wobble in flight!' },
  { name: 'Red Canyon', hazard: 'small', intro: 'Small clays score more!' },
  { name: 'Night Range', hazard: 'night', intro: 'It is dark. Watch the rings!' },
  { name: 'Stormy Beach', hazard: 'surge', intro: 'Big waves! The rings swing wider!' },
  { name: 'Fireworks Fest', hazard: 'mix', intro: 'Everything at once!' },
];
const MIXED_HAZARDS = ['steel', 'fog', 'wind', 'bee', 'curve', 'small', 'night', 'surge'];

export const worldIndex = number => WORLD_STARTS.filter(start => start <= number).length - 1;
export const worldOf = number => WORLDS[worldIndex(number)];
export const isWorldStart = number => WORLD_STARTS.includes(number);

export function hazardsOf(number) {
  const { hazard } = worldOf(number);
  if (hazard !== 'mix') return [hazard];
  return [MIXED_HAZARDS[number % 8], MIXED_HAZARDS[(number + 3) % 8]];
}

const UPGRADES = {
  ring: { values: [1, 1.1, 1.2, 1.3], costs: [100, 220, 400] },
  reload: { values: [0.27, 0.24, 0.21, 0.18], costs: [120, 240, 420] },
};

function randomFrom(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const stageStep = number => stageDef(number).step;
export const stageBeat = number => stageStep(number) * STEPS_PER_BEAT;
export const stageStart = number => stageStep(number) * COUNT_IN_STEPS;

// 링은 사람이 숨 쉬듯 두 박자에 한 번 오르내린다. 왼쪽이 올라가면 오른쪽이 내려간다.
// 큰 파도 세계에서는 더 크게 출렁이고, 바람 세계에서는 좌우로도 밀린다
export function ringPos(side, t, beat, start, hazards = []) {
  const breath = Math.cos(Math.PI * ((t - start) / beat));
  const sway = hazards.includes('surge') ? RING_SWAY * 1.55 : RING_SWAY;
  const wind = hazards.includes('wind') ? WIND_SWAY * Math.sin((2 * Math.PI * (t - start)) / (beat * 3)) : 0;
  return { x: RING_X[side] + (side === 'L' ? 1 : -1) * wind, y: RING_MIDDLE_Y + (side === 'L' ? -1 : 1) * sway * breath };
}

const otherSide = side => (side === 'L' ? 'R' : 'L');

// 발사대에서 링까지 포물선을 정한다. 어떤 각도든 도착 시각에는 링 중심에 닿는다
function aimDisc(disc, apex) {
  const flight = disc.arrive - disc.launch;
  const peak = flight * apex;
  const curve = (LAUNCH_Y - disc.ringY) / (peak ** 2 - (flight - peak) ** 2);
  disc.vx = (disc.ringX - LAUNCH_X[disc.side]) / flight;
  disc.rise = -2 * curve * peak;
  disc.fall = curve;
  disc.dur = peak * 2;
}

// 첫 링을 지나 반대쪽 링까지 날아가 건너편 발사대 쪽으로 떨어지는 경로
function acrossPath(disc, arrive2, far) {
  const from = LAUNCH_X[disc.side];
  const vx = (far.x - disc.ringX) / (arrive2 - disc.arrive);
  const launch = disc.arrive - (disc.ringX - from) / vx;
  const first = disc.arrive - launch;
  const second = arrive2 - launch;
  const fall = ((far.y - LAUNCH_Y) / second - (disc.ringY - LAUNCH_Y) / first) / (second - first);
  const rise = (disc.ringY - LAUNCH_Y) / first - fall * first;
  return { vx, launch, rise, fall, arrive2, dur: (LAUNCH_X[otherSide(disc.side)] - from) / vx, top: LAUNCH_Y - rise ** 2 / (4 * fall) };
}

export function makeStage(number) {
  const def = stageDef(number);
  const start = stageStart(number);
  const beat = stageBeat(number);
  const rand = randomFrom(number * 7919);
  const hazards = hazardsOf(number);
  const disc = (stepIndex, side, decoy) => {
    const arrive = start + stepIndex * def.step;
    const ring = ringPos(side, arrive, beat, start, hazards);
    const made = {
      side, arrive, launch: arrive - def.flight, ringX: ring.x, ringY: ring.y,
      gold: false, decoy, hp: 1, curve: false, small: false, angle: null,
      bee: decoy && hazards.includes('bee'),
    };
    aimDisc(made, 1);
    return made;
  };
  const pool = PHRASES[def.tier];
  const discs = [];
  const rests = [];
  let index = 0;
  let last = -1;
  let run = 0;
  while (discs.length < def.count) {
    let pick = Math.floor(rand() * pool.length);
    if (pick === last) pick = (pick + 1) % pool.length;
    last = pick;
    for (const mark of pool[pick]) {
      if (mark === '.') {
        rests.push(index);
        run = 0;
      } else if (discs.length < def.count) {
        // 두 발을 쏜 뒤 장전할 틈을 준다. 그래서 탕탕 철컥 하는 리듬이 된다
        if (run === MAX_RUN) {
          rests.push(index);
          index += 1;
          run = 0;
        }
        discs.push(disc(index, mark, false));
        run += 1;
      }
      index += 1;
    }
  }
  const clays = discs.map((d, i) => i).filter(i => i > 1);
  for (let i = 0; i < def.gold; i++) discs[clays.splice(Math.floor(rand() * clays.length), 1)[0]].gold = true;
  const end = (discs.at(-1).arrive - start) / def.step;
  const birdSteps = rests.filter(i => i > 1 && i < end);
  for (let i = 0; i < def.birds && birdSteps.length; i++) {
    const stepIndex = birdSteps.splice(Math.floor(rand() * birdSteps.length), 1)[0];
    discs.push(disc(stepIndex, rand() < 0.5 ? 'L' : 'R', true));
  }
  discs.sort((a, b) => a.arrive - b.arrive);
  markHazards(discs, number, hazards, def.step, rand);
  const stepOf = t => Math.round((t - start) / def.step);
  const taken = new Map(discs.map(d => [stepOf(d.arrive), d]));
  const crossGap = Math.round((((RING_X.R - RING_X.L) / (RING_X.L - LAUNCH_X.L)) * def.flight) / ANGLES.cross.speed / def.step);
  const kinds = Object.keys(ANGLES).filter(kind => number >= ANGLES[kind].from);
  const plain = discs.slice(2).filter(d => !d.decoy && !d.gold && d.hp === 1 && !d.curve && !d.small);
  const amount = Math.round(plain.length * Math.min(0.5, 0.2 + number * 0.003));
  // 둘째 링을 지나는 칸이 비어 있어야 다른 접시와 겹치지 않는다. 안 비었으면 한 칸 빠르거나 느리게 던진다
  const throwAcross = (d, overBirds) => {
    for (const extra of [0, -1, 1]) {
      const crossStep = stepOf(d.arrive) + crossGap + extra;
      const sitting = taken.get(crossStep);
      if (sitting && !(overBirds && sitting.decoy)) continue;
      const arrive2 = start + crossStep * def.step;
      const path = acrossPath(d, arrive2, ringPos(otherSide(d.side), arrive2, beat, start, hazards));
      // 빠른 접시는 낮게 난다. 두 링이 다 높은 순간에는 가장 높이 뜨게 되므로 던지지 않는다
      if (path.top < CROSS_TOP) continue;
      if (sitting) discs.splice(discs.indexOf(sitting), 1);
      taken.set(crossStep, d);
      Object.assign(d, path, { angle: 'cross' });
      return true;
    }
    return false;
  };
  const shuffled = plain.map(d => [rand(), d]).sort((a, b) => a[0] - b[0]).map(pair => pair[1]);
  let crosses = 0;
  const crossSome = (list, limit, overBirds) => list.filter(d => {
    if (crosses >= limit || !throwAcross(d, overBirds)) return true;
    crosses += 1;
    return false;
  });
  // 빈 칸이 거의 없는 스테이지에서는 새 자리를 내주어 가로지르기가 빠지지 않게 한다
  const quota = Math.ceil(amount / kinds.length);
  const waiting = crossSome(crossSome(shuffled, quota, false), Math.min(3, quota), true);
  const steep = kinds.filter(kind => kind !== 'cross');
  for (const d of steep.length ? waiting.slice(0, amount - crosses) : []) {
    d.angle = steep[Math.floor(rand() * steep.length)];
    d.launch = d.arrive - def.flight / ANGLES[d.angle].speed;
    aimDisc(d, ANGLES[d.angle].apex);
  }
  return discs;
}

// 세계 안에서 뒤로 갈수록 방해 요소가 붙은 접시가 많아진다
function markHazards(discs, number, hazards, step, rand) {
  const clays = discs.filter(d => !d.decoy && !d.gold);
  // 세계 길이와 상관없이 같은 속도로 늘어서 짧은 세계가 갑자기 어려워지지 않는다
  const share = 0.1 + 0.2 * Math.min((number - WORLD_STARTS[worldIndex(number)]) / 49, 1);
  const pick = (from, apply) => {
    const pool = [...from];
    const amount = Math.max(2, Math.round(clays.length * share));
    for (let i = 0; i < amount && pool.length; i++) apply(pool.splice(Math.floor(rand() * pool.length), 1)[0]);
  };
  if (hazards.includes('curve')) pick(clays, d => { d.curve = true; });
  if (hazards.includes('small')) pick(clays, d => { d.small = true; });
  if (hazards.includes('steel')) {
    // 두 번 쏠 틈이 있도록 바로 뒤 칸의 접시를 비운다
    pick(clays.slice(0, -1), d => {
      if (!discs.includes(d)) return;
      d.hp = 2;
      const next = discs[discs.indexOf(d) + 1];
      if (next && next.arrive - d.arrive < step * 1.5 && next.hp === 1) discs.splice(discs.indexOf(next), 1);
    });
  }
}

// 자기 쪽 발사대에서 올라와 각도에 맞는 포물선으로 날아간다.
// 커브 접시와 벌은 흔들리며 날지만 링에 닿는 순간에는 제자리로 돌아온다
export function discPos(disc, t) {
  const time = t - disc.launch;
  const u = time / disc.dur;
  let y = LAUNCH_Y + disc.rise * time + disc.fall * time * time;
  if (disc.curve) y += 46 * Math.sin(4 * Math.PI * u);
  if (disc.bee) y += 30 * Math.sin(8 * Math.PI * u);
  return { x: LAUNCH_X[disc.side] + disc.vx * time, y, u };
}

// 글자가 아니라 물리 키로 판별한다. 한글 입력 상태에서는 A 가 'ㅁ' 으로 들어오기 때문이다
export function sideForKey(code) {
  if (code === 'KeyA' || code === 'ArrowLeft') return 'L';
  if (code === 'KeyD' || code === 'ArrowRight') return 'R';
  return null;
}

export const sideForPoint = x => (x < WIDTH / 2 ? 'L' : 'R');

export const ringScale = level => UPGRADES.ring.values[level];
export const reloadTime = level => UPGRADES.reload.values[level];

export function upgradeCost(key, level) {
  const cost = UPGRADES[key].costs[level];
  return cost === undefined ? null : cost;
}

// 한 판의 접시를 전부 맞히면 코인이 이만큼 곱해진다
export const ALL_CLEAR_COINS = 2;

export const starsFor = (hits, total) => {
  const ratio = total ? hits / total : 0;
  if (ratio >= 0.94) return 3;
  if (ratio >= 0.75) return 2;
  return ratio >= 0.5 ? 1 : 0;
};

export class Session {
  constructor(stage, upgrades) {
    this.stage = stage;
    this.step = stageStep(stage);
    this.beat = stageBeat(stage);
    this.start = stageStart(stage);
    this.hazards = hazardsOf(stage);
    this.radius = RING_RADIUS * ringScale(upgrades.ring);
    // 재장전은 접시 칸에 맞춘다. 강화하면 같은 비율로 빨라진다
    this.reloadSeconds = this.step * RELOAD_STEPS * (reloadTime(upgrades.reload) / reloadTime(0));
    this.discs = makeStage(stage).map(d => ({ ...d, state: 'waiting', passed: false }));
    this.total = this.discs.filter(d => !d.decoy).length;
    const stepOf = t => Math.round((t - this.start) / this.step);
    this.stepSides = new Map(this.discs.filter(d => !d.decoy).map(d => [stepOf(d.arrive), d.side]));
    this.crossSteps = new Map(this.discs.filter(d => d.arrive2).map(d => [stepOf(d.arrive2), d]));
    this.t = 0;
    this.shots = LOADED_SHOTS;
    this.reloadLeft = 0;
    this.score = 0;
    this.streak = 0;
    this.bestStreak = 0;
    this.hits = 0;
    this.perfects = 0;
    this.golds = 0;
    this.finished = false;
  }

  get waiting() {
    return this.discs.filter(d => !d.decoy && d.state === 'waiting').length;
  }

  ringAt(side, t) {
    return ringPos(side, t, this.beat, this.start, this.hazards);
  }

  ring(side) {
    return this.ringAt(side, this.t);
  }

  // 접시가 링을 완전히 지나는 시각. 강화로 링이 커지면 함께 늘어난다
  passTime(disc) {
    return (disc.arrive2 ?? disc.arrive) + this.radius / Math.abs(disc.vx);
  }

  // 그 칸에 접시가 오는 쪽. 빈 칸은 null. 가로지르는 접시가 아직 날고 있으면 반대쪽에서 들린다
  sideAtStep(index) {
    const crossing = this.crossSteps.get(index);
    if (crossing?.state === 'flying') return otherSide(crossing.side);
    return this.stepSides.get(index) ?? null;
  }

  // 아직 맞히지 않은 접시 중 가장 먼저 링에 닿는 쪽
  nextSide() {
    let side = 'L';
    let soonest = Infinity;
    for (const d of this.discs) {
      if (d.decoy || d.passed || (d.state !== 'waiting' && d.state !== 'flying')) continue;
      const second = d.arrive2 && this.t > d.arrive + this.radius / Math.abs(d.vx);
      const at = second ? d.arrive2 : d.arrive;
      if (at < soonest) {
        soonest = at;
        side = second ? otherSide(d.side) : d.side;
      }
    }
    return side;
  }

  update(dt) {
    const events = [];
    this.t += dt;
    if (this.reloadLeft > 0) {
      this.reloadLeft -= dt;
      if (this.reloadLeft <= 0) {
        events.push({ type: 'reloaded', wasEmpty: this.shots === 0 });
        this.shots = LOADED_SHOTS;
        this.reloadLeft = 0;
      }
    }
    for (const d of this.discs) {
      if (d.state === 'waiting' && this.t >= d.launch) {
        d.state = 'flying';
        events.push({ type: 'launch', side: d.side, decoy: d.decoy });
      }
      if (d.state === 'flying' && !d.passed && this.t >= this.passTime(d)) {
        d.passed = true;
        if (!d.decoy) {
          this.streak = 0;
          events.push({ type: 'missed' });
        }
      }
      if (d.state === 'flying' && this.t >= d.launch + d.dur) d.state = d.decoy ? 'avoided' : 'missed';
    }
    if (this.discs.every(d => d.state !== 'waiting' && d.state !== 'flying') && !this.finished) {
      this.finished = true;
      events.push({ type: 'finished' });
    }
    return events;
  }

  fire(side) {
    if (this.shots === 0) return { type: 'empty', side };
    this.shots -= 1;
    // 마지막으로 쏜 뒤 재장전 시간이 지나면 두 발이 다 찬다
    this.reloadLeft = this.reloadSeconds;
    const ring = this.ring(side);
    let target = null;
    let nearest = Infinity;
    for (const d of this.discs) {
      if (d.state !== 'flying' || d.passed) continue;
      const p = discPos(d, this.t);
      const distance = Math.hypot(p.x - ring.x, p.y - ring.y);
      if (distance <= this.radius && distance < nearest) {
        target = d;
        nearest = distance;
      }
    }
    if (!target) {
      this.streak = 0;
      return { type: 'whiff', side };
    }
    const at = discPos(target, this.t);
    if (target.decoy) {
      target.state = 'shot';
      this.score = Math.max(0, this.score - 200);
      this.streak = 0;
      return { type: 'decoy', side, x: at.x, y: at.y, points: -200, bee: target.bee };
    }
    if (target.hp > 1) {
      target.hp -= 1;
      this.score += 30;
      // 두 번째 탄이 모자라지 않도록 금이 가면 한 발을 돌려준다
      this.shots = Math.min(LOADED_SHOTS, this.shots + 1);
      if (this.shots === LOADED_SHOTS) this.reloadLeft = 0;
      return { type: 'crack', side, x: at.x, y: at.y, points: 30 };
    }
    const perfect = nearest <= this.radius * PERFECT_RATIO * (target.small ? 0.6 : 1);
    target.state = 'hit';
    this.streak += 1;
    const rate = comboRate(this.streak);
    const points = ((target.gold ? 300 : 100) + (target.small ? 100 : 0) + (perfect ? 50 : 0)) * rate;
    this.score += points;
    this.bestStreak = Math.max(this.bestStreak, this.streak);
    this.hits += 1;
    if (perfect) this.perfects += 1;
    if (target.gold) this.golds += 1;
    return {
      type: 'hit', side, x: at.x, y: at.y, points, perfect, gold: target.gold,
      streak: this.streak, rate, rateUp: COMBO_STEPS.includes(this.streak), allClear: this.hits === this.total,
    };
  }

  result() {
    const stars = starsFor(this.hits, this.total);
    const allClear = this.hits === this.total;
    const coins = this.hits * 4 + this.perfects * 2 + this.golds * 20;
    return {
      stage: this.stage,
      clear: stars > 0,
      stars,
      allClear,
      score: this.score,
      hits: this.hits,
      total: this.total,
      accuracy: Math.round((this.hits / this.total) * 100),
      bestStreak: this.bestStreak,
      coins: allClear ? coins * ALL_CLEAR_COINS : coins,
    };
  }
}

export const newSave = () => ({ stars: {}, best: {}, crowns: {}, coins: 0, upgrades: { ring: 0, reload: 0 } });

export const isUnlocked = (save, stage) => stage === 1 || (save.stars[stage - 1] || 0) > 0;

export const totalStars = save => Object.values(save.stars).reduce((a, b) => a + b, 0);

export function applyResult(save, stage, result) {
  const newBest = result.score > (save.best[stage] || 0);
  save.coins += result.coins;
  if (result.clear) save.stars[stage] = Math.max(save.stars[stage] || 0, result.stars);
  if (result.allClear) save.crowns[stage] = true;
  if (newBest) save.best[stage] = result.score;
  return newBest;
}

export function buyUpgrade(save, key) {
  const cost = upgradeCost(key, save.upgrades[key]);
  if (cost === null || save.coins < cost) return false;
  save.coins -= cost;
  save.upgrades[key] += 1;
  return true;
}
