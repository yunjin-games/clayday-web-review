// 효과음은 미리 디코드한 버퍼로 재생해 누른 순간 바로 나게 한다. 배경음악은 스트리밍한다.

const EFFECTS = ['clay_break_1', 'clay_break_2', 'clay_break_3', 'thrower_1', 'thrower_2', 'reload', 'shell_drop',
  'empty_click', 'whistle_short', 'ding', 'button', 'beat_low', 'beat_high', 'bird_squawk'];
const FILES = { cheer_small: 'cheer_small.mp3', cheer_big: 'cheer_big.mp3', aww_crowd: 'aww_crowd.mp3' };

const context = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' });
const master = context.createGain();
master.connect(context.destination);
const buffers = {};
const music = {};
let currentMusic = null;
let sfxOn = true;
let musicOn = true;
let adPlaying = false;

async function load(name, file) {
  const response = await fetch(`assets/sfx/${file}`);
  buffers[name] = await context.decodeAudioData(await response.arrayBuffer());
}

export async function loadAudio() {
  const shots = [1, 2, 3].map(n => load(`gunshot_${n}`, `gunshot_${n}.wav`));
  const effects = EFFECTS.map(n => load(n, `${n}.wav`));
  const others = Object.entries(FILES).map(([n, f]) => load(n, f));
  await Promise.all([...shots, ...effects, ...others]);
  for (const name of ['bgm_title', 'bgm_shoot', 'bgm_result']) {
    const audio = new Audio(`assets/music/${name}.mp3`);
    audio.loop = true;
    audio.volume = 0.32;
    music[name] = audio;
  }
}

export function unlockAudio() {
  if (context.state === 'suspended') context.resume();
}

// from 은 파일 안에서 시작할 초, cut 은 소리를 끝낼 초다. 끝은 뒤쪽 절반에서 줄여 뚝 끊기지 않게 한다
export function play(name, { rate = 1, gain = 1, from = 0, cut = 0 } = {}) {
  if (!sfxOn || adPlaying || !buffers[name]) return;
  const source = context.createBufferSource();
  source.buffer = buffers[name];
  source.playbackRate.value = rate;
  const volume = context.createGain();
  volume.gain.value = gain;
  source.connect(volume).connect(master);
  source.start(0, from);
  if (cut) {
    const now = context.currentTime;
    volume.gain.setValueAtTime(gain, now + cut / 2);
    volume.gain.linearRampToValueAtTime(0, now + cut);
    source.stop(now + cut);
  }
}

// 박자처럼 정확한 시각에 나야 하는 소리. pan 은 -1(왼쪽)에서 1(오른쪽)
export function playAt(name, delay, { gain = 1, pan = 0 } = {}) {
  if (!sfxOn || adPlaying || !buffers[name]) return;
  const source = context.createBufferSource();
  source.buffer = buffers[name];
  const volume = context.createGain();
  volume.gain.value = gain;
  const panner = context.createStereoPanner();
  panner.pan.value = pan;
  source.connect(volume).connect(panner).connect(master);
  source.start(context.currentTime + delay);
}

export function stopMusic() {
  if (currentMusic) currentMusic.pause();
  currentMusic = null;
}

export function playMusic(name) {
  if (currentMusic === music[name]) {
    if (musicOn && !adPlaying && currentMusic.paused) currentMusic.play().catch(() => {});
    return;
  }
  if (currentMusic) currentMusic.pause();
  currentMusic = music[name];
  if (!currentMusic) return;
  currentMusic.currentTime = 0;
  if (musicOn && !adPlaying) currentMusic.play().catch(() => {});
}

export function pauseMusic() {
  if (currentMusic) currentMusic.pause();
}

export function resumeMusic() {
  if (currentMusic && musicOn && !adPlaying) currentMusic.play().catch(() => {});
}

export function setSfx(on) {
  sfxOn = on;
}

export function setMusic(on) {
  musicOn = on;
  if (on) resumeMusic();
  else pauseMusic();
}

// 광고가 나오는 동안 게임 소리를 모두 끈다(Poki 필수 조건)
export function setAdPlaying(on) {
  adPlaying = on;
  master.gain.value = on ? 0 : 1;
  if (on) pauseMusic();
  else resumeMusic();
}

export const audioInfo = () => ({ state: context.state, loaded: Object.keys(buffers).length, sfxOn, adPlaying });
