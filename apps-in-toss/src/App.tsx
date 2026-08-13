// @ts-nocheck
import { useEffect, useRef } from "react";
import { createGame } from "./engine";
import { initTossSdk } from "./toss";
import "./game.css";

export default function App() {
  const gameRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const sdk = await initTossSdk();
      if (cancelled) return;
      gameRef.current = createGame(sdk);
    })();
    return () => {
      cancelled = true;
      try { gameRef.current?.destroy(); } catch { /* 무시 */ }
    };
  }, []);

  const openLeaderboard = () => {
    const ok = gameRef.current?.openLeaderboard?.();
    if (!ok) alert("순위표는 토스 앱에서 볼 수 있어요 🏆");
  };

  return (
    <div id="app">
      {/* 게임 무대 */}
      <div id="stage" className="stage">
        {/* 상단 HUD */}
        <div className="hud">
          <div className="hud-score">
            <span className="hud-label">땡땡이</span>
            <span id="scoreValue" className="hud-value">0.0<small>초</small></span>
          </div>
          <div className="hud-status" id="statusChip">대기 중</div>
          <div className="hud-best">
            <span className="hud-label">최고</span>
            <span id="bestValue" className="hud-value">0.0<small>초</small></span>
          </div>
        </div>

        {/* 사장님 */}
        <div className="boss-zone">
          <div id="boss" className="boss boss--away" aria-hidden="true">
            <div className="boss-alert" id="bossAlert">!</div>
            <div className="boss-head">
              <div className="boss-hair"></div>
              <div className="boss-face">
                <div className="boss-eye left"></div>
                <div className="boss-eye right"></div>
                <div className="boss-brow left"></div>
                <div className="boss-brow right"></div>
                <div className="boss-mouth"></div>
              </div>
            </div>
            <div className="boss-body"></div>
            <div className="boss-caption" id="bossCaption">사장님</div>
          </div>
        </div>

        {/* 나(플레이어) */}
        <div className="player-zone">
          <div id="player" className="player">
            <div className="sweat" id="sweat"></div>
            <div className="player-head"></div>
            <div className="player-body"></div>
            <div className="phone" id="phone">▶</div>
            <div className="desk"></div>
            <div className="monitor"></div>
          </div>
          <div className="combo" id="combo"></div>
        </div>

        {/* 상황 알림 토스트 */}
        <div id="toast" className="toast"></div>

        {/* 파티클/이펙트 캔버스 */}
        <canvas id="fx" className="fx"></canvas>

        {/* 하단 조작부 */}
        <div className="control">
          <button id="holdBtn" className="hold-btn" type="button">
            <span className="hold-btn__label">꾹 눌러서<br /><b>딴짓</b></span>
          </button>
          <p className="control-hint">사장님이 <b>등 돌리면</b> 꾹 눌러 딴짓 · <b>돌아보기 전</b> 손 떼기</p>
        </div>
      </div>

      {/* 시작 화면 */}
      <div id="titleScreen" className="overlay overlay--title">
        <div className="overlay-card">
          <div className="logo">💼</div>
          <h1 className="title">월급루팡<br />시뮬레이터</h1>
          <p className="subtitle">사장님 몰래 딴짓하고<br />최고 땡땡이 기록에 도전!</p>
          <button id="startBtn" className="cta">출근하기</button>
          <button className="ghost" onClick={openLeaderboard}>🏆 전국 순위표</button>
          <p className="tiny">최고 기록 <span id="titleBest">0.0</span>초</p>
        </div>
      </div>

      {/* 게임오버 화면 */}
      <div id="overScreen" className="overlay overlay--over hidden">
        <div className="overlay-card">
          <div className="over-emoji" id="overEmoji">😱</div>
          <h2 className="over-title" id="overTitle">딱 걸렸다!</h2>
          <p className="over-reason" id="overReason">사장님과 눈이 마주쳤다…</p>
          <div className="result">
            <div className="result-row">
              <span>오늘 땡땡이</span>
              <b id="resultScore">0.0초</b>
            </div>
            <div className="result-row">
              <span>등급</span>
              <b id="resultGrade" className="grade">인턴</b>
            </div>
            <div className="result-row result-row--best">
              <span>최고 기록</span>
              <b id="resultBest">0.0초</b>
            </div>
          </div>
          <button id="retryBtn" className="cta">한 판 더</button>
          <button className="ghost" onClick={openLeaderboard}>🏆 전국 순위표</button>
          <button id="shareBtn" className="ghost">📸 결과 카드 만들기</button>
        </div>
      </div>

      {/* 공유 카드 화면 */}
      <div id="shareScreen" className="overlay hidden">
        <div className="overlay-card share-card-wrap">
          <img id="shareImg" className="share-preview" alt="결과 카드" />
          <button id="shareActionBtn" className="cta">공유 / 저장</button>
          <button id="copyLinkBtn" className="ghost">문구 + 링크 복사</button>
          <button id="closeShareBtn" className="ghost">닫기</button>
          <p className="tiny" id="shareHint">이미지를 꾹 눌러 저장하거나 공유하세요</p>
        </div>
      </div>
    </div>
  );
}
