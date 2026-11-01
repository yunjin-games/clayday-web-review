// Poki SDK 를 감싼다. 광고 차단기로 SDK 가 없어도 게임은 광고 없이 진행된다.
import { setAdPlaying } from './audio.js';

const poki = () => window.PokiSDK;
let playing = false;

// SDK 가 없으면 광고를 볼 수 없으므로 보상도 줄 수 없다
export const adsAvailable = () => Boolean(poki());

export async function initSdk() {
  if (!poki()) return;
  try {
    await poki().init();
  } catch {
    // 광고 차단기가 켜져 있어도 게임은 계속된다
  }
}

export function loadingFinished() {
  poki()?.gameLoadingFinished?.();
}

export function gameplayStart() {
  if (playing) return;
  playing = true;
  poki()?.gameplayStart?.();
}

export function gameplayStop() {
  if (!playing) return;
  playing = false;
  poki()?.gameplayStop?.();
}

// 광고 시작 콜백은 오지 않을 수도 있어서, 부르기 전에 소리를 끄고 끝나면 되돌린다
async function adBreak(show) {
  setAdPlaying(true);
  try {
    return await show();
  } finally {
    setAdPlaying(false);
  }
}

export async function commercialBreak() {
  if (poki()) await adBreak(() => poki().commercialBreak());
}

export async function rewardedBreak() {
  if (!poki()) return false;
  return adBreak(() => poki().rewardedBreak());
}
