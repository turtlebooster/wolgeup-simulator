// @ts-nocheck
/* 앱인토스 SDK 어댑터
 * - 토스 앱 안에서는 네이티브 SDK 사용, 일반 브라우저(개발/웹)에서는 폴백.
 * - 모든 호출을 isSupported 가드 + try/catch로 감싸 어디서든 게임이 죽지 않게 함. */
import {
  getUserKeyForGame,
  submitGameCenterLeaderBoardScore,
  openGameCenterLeaderboard,
  getSafeAreaInsets,
  eventLog,
  generateHapticFeedback,
} from "@apps-in-toss/web-framework";

const BEST_KEY = "wolgeup_best_v1";
const supported = (fn) => {
  try { return typeof fn?.isSupported === "function" ? fn.isSupported() : false; }
  catch { return false; }
};

// 리더보드는 정수 점수만 → 0.1초 단위(데시초)로 제출. 예: 18.1초 → "181"
const toBoardScore = (sec) => String(Math.max(0, Math.round(sec * 10)));

/** Safe Area를 CSS 변수로 반영 (노치/홈바 대응) */
function applySafeArea() {
  try {
    const i = getSafeAreaInsets?.();
    if (!i) return;
    const r = document.documentElement.style;
    r.setProperty("--sa-top", (i.top ?? 0) + "px");
    r.setProperty("--sa-bottom", (i.bottom ?? 0) + "px");
    r.setProperty("--sa-left", (i.left ?? 0) + "px");
    r.setProperty("--sa-right", (i.right ?? 0) + "px");
  } catch { /* 무시 */ }
}

async function loadBest() {
  try { return Number(localStorage.getItem(BEST_KEY)) || 0; } catch { return 0; }
}
function saveBest(v) {
  try { localStorage.setItem(BEST_KEY, String(v)); } catch { /* 무시 */ }
}

/** createGame(sdk)로 넘길 어댑터 객체 생성 */
export async function initTossSdk() {
  applySafeArea();

  // 로그인(선택): 유저 식별키 확보 시도 — 실패해도 게임은 진행
  try {
    if (supported(getUserKeyForGame)) await getUserKeyForGame();
  } catch { /* 비로그인으로 진행 */ }

  const best = await loadBest();

  return {
    initialBest: best,
    saveBest,
    // 행동 로그 (비핵심 — 실패해도 무시)
    track: (name) => {
      try { eventLog?.({ name, params: {} }); } catch { /* 무시 */ }
    },
    // 리더보드 점수 제출
    submitScore: (sec) => {
      try {
        if (supported(submitGameCenterLeaderBoardScore)) {
          submitGameCenterLeaderBoardScore({ score: toBoardScore(sec) });
        }
      } catch { /* 무시 */ }
    },
    // 순위표 열기 (토스 게임센터 UI)
    openLeaderboard: () => {
      try {
        if (supported(openGameCenterLeaderboard)) { openGameCenterLeaderboard(); return true; }
      } catch { /* 무시 */ }
      return false;
    },
    haptic: () => {
      try { generateHapticFeedback?.({ type: "basic" }); } catch { /* 무시 */ }
    },
    shareUrl: "토스 > 월급루팡 검색",
  };
}

/** 토스 앱 안에서 실행 중인지 대략 판별 (순위표 지원 여부 기준) */
export function isRunningInToss() {
  return supported(openGameCenterLeaderboard) || supported(submitGameCenterLeaderBoardScore);
}
