/* ===== 월급루팡 시뮬레이터 — 게임 로직 ===== */
(() => {
  "use strict";

  // ---- DOM ----
  const $ = (id) => document.getElementById(id);
  const stage = $("stage");
  const boss = $("boss");
  const bossCaption = $("bossCaption");
  const player = $("player");
  const statusChip = $("statusChip");
  const scoreValue = $("scoreValue");
  const bestValue = $("bestValue");
  const comboEl = $("combo");
  const holdBtn = $("holdBtn");
  const fx = $("fx");
  const ctx = fx.getContext("2d");

  const titleScreen = $("titleScreen");
  const overScreen = $("overScreen");
  const startBtn = $("startBtn");
  const retryBtn = $("retryBtn");
  const shareBtn = $("shareBtn");
  const titleBest = $("titleBest");

  // ---- 상수 ----
  const BOSS = { AWAY: "away", WARNING: "warning", WATCHING: "watching" };
  const BEST_KEY = "wolgeup_best_v1";

  const GRADES = [
    { min: 0, name: "인턴", emoji: "🐣", verdict: "긴장을 너무 하시네요. 사회생활 화이팅…" },
    { min: 12, name: "사원", emoji: "🧑‍💼", verdict: "아직 순수하시네요. 더 뻔뻔해지세요." },
    { min: 28, name: "대리", emoji: "😎", verdict: "감 잡으셨죠? 월급도둑의 재능이 보입니다." },
    { min: 48, name: "과장", emoji: "🕶️", verdict: "회사가 당신을 못 이깁니다." },
    { min: 75, name: "부장", emoji: "👔", verdict: "일은 대체 언제 하시나요? (안 함)" },
    { min: 110, name: "이사", emoji: "🏆", verdict: "당신에게 회사는 그냥 카페입니다." },
    { min: 160, name: "월급루팡 마스터", emoji: "👑", verdict: "사장님, 바로 이 사람입니다." },
  ];

  // 점수(초)에 따라 점점 미쳐가는 상황 단계
  const STAGES = [
    { at: 0,   name: "평범한 오전",     toast: null,                                     awayMul: 1.0,  warnMul: 1.0,  fakeAdd: 0 },
    { at: 14,  name: "동료 출근",       toast: "😐 옆자리 김대리가 힐끔거린다",           awayMul: 0.92, warnMul: 0.94, fakeAdd: 0.05 },
    { at: 32,  name: "부장 등장",       toast: "📢 부장님 등장! 눈치 레벨 급상승",        awayMul: 0.85, warnMul: 0.88, fakeAdd: 0.08 },
    { at: 55,  name: "사장 회의 중",     toast: "🚪 사장님 회의 들어감… 근데 자꾸 나옴",   awayMul: 0.9,  warnMul: 0.8,  fakeAdd: 0.12 },
    { at: 82,  name: "실적발표 D-1",     toast: "🔥 내일 실적발표. 근데도 딴짓하는 너",    awayMul: 0.78, warnMul: 0.74, fakeAdd: 0.12 },
    { at: 115, name: "사장 바로 뒤",     toast: "😱 사장님이 네 모니터 뒤에 서 있다",      awayMul: 0.72, warnMul: 0.66, fakeAdd: 0.15 },
    { at: 160, name: "월급루팡 각성",    toast: "👑 걸릴 걸 초월했다. 넌 이미 전설",       awayMul: 0.66, warnMul: 0.6,  fakeAdd: 0.15 },
  ];

  const CAUGHT_MSGS = [
    "사장님과 눈이 마주쳤다…",
    "\"자네, 지금 뭐 하나?\"",
    "화면에 유튜브가 켜져 있었다.",
    "하필 부장님이 지나갔다.",
    "웃참 실패. 표정을 들켰다.",
    "마우스가 아니라 폰을 잡고 있었다.",
    "\"회의실로 잠깐 오지.\"",
  ];

  // 페이크(움찔했다 안 돌아봄) 해소 시 멘트
  const FAKE_MSGS = ["사장님 그냥 기침했다", "…아무 일도 아니었다", "괜히 쫄았네", "사장님 딴 생각 중"];

  // ---- 상태 ----
  let running = false;
  let holding = false;
  let score = 0; // 초
  let best = Number(localStorage.getItem(BEST_KEY)) || 0;
  let bossState = BOSS.AWAY;
  let stateTimer = 0; // 남은 시간(초)
  let elapsed = 0; // 총 경과(난이도용)
  let comboTime = 0; // 연속 딴짓 시간
  let lastTs = 0;
  let rafId = 0;
  let particles = [];
  let floaters = []; // 떠오르는 점수 팝업
  let isFakeWarning = false;
  let scorePopAccum = 0;
  let stageIdx = 0; // 현재 상황 단계

  // ---- 오디오 (에셋 없이 합성) ----
  let audioCtx = null;
  function beep(freq, dur = 0.08, type = "square", vol = 0.05) {
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type = type; o.frequency.value = freq;
      g.gain.value = vol;
      o.connect(g); g.connect(audioCtx.destination);
      const t = audioCtx.currentTime;
      o.start(t);
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.stop(t + dur);
    } catch (e) { /* 무음 폴백 */ }
  }
  const sfx = {
    slack: () => beep(660, 0.05, "sine", 0.03),
    warn: () => beep(440, 0.12, "triangle", 0.06),
    watch: () => beep(300, 0.1, "sawtooth", 0.05),
    caught: () => { beep(160, 0.25, "sawtooth", 0.09); setTimeout(() => beep(90, 0.4, "sawtooth", 0.09), 90); },
    combo: () => beep(880, 0.06, "sine", 0.04),
    stageUp: () => { beep(523, 0.08, "square", 0.05); setTimeout(() => beep(784, 0.12, "square", 0.05), 90); },
  };

  // ---- 난이도 곡선 ----
  // 시간이 갈수록 + 상황 단계가 오를수록 안전구간·반응창이 짧아짐
  const curStage = () => STAGES[stageIdx];
  function nextAwayDuration() {
    const base = Math.max(0.6, (2.4 - elapsed * 0.02) * curStage().awayMul);
    return base + Math.random() * (base * 0.6);
  }
  function nextWarningDuration() {
    return Math.max(0.24, (0.75 - elapsed * 0.012) * curStage().warnMul); // 반응 시간
  }
  function nextWatchingDuration() {
    return 0.7 + Math.random() * (1.4 - Math.min(0.6, elapsed * 0.01));
  }
  function currentFakeChance() {
    return Math.max(0.12, 0.3 - elapsed * 0.004) + curStage().fakeAdd;
  }

  // ---- 상태 전이 ----
  function setBossState(next) {
    bossState = next;
    boss.className = "boss boss--" + next;
    if (next === BOSS.AWAY) {
      stateTimer = nextAwayDuration();
      setStatus("딴짓 찬스!", "safe");
      bossCaption.textContent = "사장님 (딴짓 서류 검토 중)";
    } else if (next === BOSS.WARNING) {
      stateTimer = nextWarningDuration();
      // 이번 경고가 페이크(안 돌아봄)인지 미리 결정
      isFakeWarning = Math.random() < currentFakeChance();
      setStatus("돌아본다?!", "warn");
      bossCaption.textContent = "사장님이 움찔…";
      sfx.warn();
    } else if (next === BOSS.WATCHING) {
      stateTimer = nextWatchingDuration();
      setStatus("들킬 위험!", "danger");
      bossCaption.textContent = "사장님이 노려본다";
      sfx.watch();
      // 감시 상태에서 딴짓 중이면 즉시 아웃
      if (holding) return gameOver();
    }
  }

  function setStatus(text, cls) {
    statusChip.textContent = text;
    statusChip.className = "hud-status " + (cls || "");
  }

  // ---- 입력 ----
  function startHold() {
    if (!running || holding) return;
    holding = true;
    player.classList.add("slacking");
    holdBtn.classList.add("pressed");
    if (bossState === BOSS.WATCHING) return gameOver();
    if (bossState === BOSS.WARNING) player.classList.add("nervous");
    sfx.slack();
  }
  function endHold() {
    if (!holding) return;
    holding = false;
    comboTime = 0;
    hideCombo();
    player.classList.remove("slacking", "nervous");
    holdBtn.classList.remove("pressed");
  }

  // ---- 콤보 ----
  let comboLevel = 0;
  function updateCombo(dt) {
    if (!holding || bossState !== BOSS.AWAY) return;
    comboTime += dt;
    const lvl = Math.floor(comboTime / 1.2);
    if (lvl > comboLevel && lvl >= 1) {
      comboLevel = lvl;
      sfx.combo();
      spawnBurst(player.offsetLeft + 80, fx.height * 0.6, "#ffd23f", 10);
    }
    comboLevel = lvl;
    if (lvl >= 1) showCombo(`x${(1 + lvl * 0.5).toFixed(1)} 배속!`);
  }
  function comboMultiplier() {
    return 1 + comboLevel * 0.5;
  }
  function showCombo(t) { comboEl.textContent = t; comboEl.classList.add("show"); }
  function hideCombo() { comboEl.classList.remove("show"); comboLevel = 0; }

  // ---- 상황 토스트 ----
  const toastEl = $("toast");
  function showToast(text) {
    toastEl.textContent = text;
    toastEl.classList.remove("show");
    void toastEl.offsetWidth; // 리플로우로 애니메이션 재시작
    toastEl.classList.add("show");
  }

  // ---- 게임 루프 ----
  function loop(ts) {
    if (!running) return;
    if (!lastTs) lastTs = ts;
    let dt = (ts - lastTs) / 1000;
    lastTs = ts;
    if (dt > 0.1) dt = 0.1; // 탭 전환 등 스파이크 방지

    elapsed += dt;
    stateTimer -= dt;

    // 점수 적립: 등 돌린 동안 딴짓 중일 때만
    if (holding && bossState === BOSS.AWAY) {
      const gain = dt * comboMultiplier();
      score += gain;
      scorePopAccum += gain;
      if (scorePopAccum >= 0.5) {
        spawnFloater(`+${scorePopAccum.toFixed(1)}`, comboLevel >= 1 ? "#ffd23f" : "#3ddc84");
        scorePopAccum = 0;
      }
      updateCombo(dt);
    }

    // 상황 단계 상승 체크
    if (stageIdx < STAGES.length - 1 && score >= STAGES[stageIdx + 1].at) {
      stageIdx++;
      const st = STAGES[stageIdx];
      if (st.toast) showToast(st.toast);
      bossCaption.textContent = "🔺 " + st.name;
      sfx.stageUp();
      spawnBurst(fx.clientWidth / 2, fx.height * 0.32, "#ff7a45", 16);
    }

    // 상태 전이
    if (stateTimer <= 0) {
      if (bossState === BOSS.AWAY) {
        setBossState(BOSS.WARNING);
      } else if (bossState === BOSS.WARNING) {
        if (isFakeWarning) {
          // 페이크: 안 돌아봄 → 버틴 사람은 콤보/점수 유지 (배짱 보상)
          bossCaption.textContent = FAKE_MSGS[(Math.random() * FAKE_MSGS.length) | 0];
          setBossState(BOSS.AWAY);
        } else {
          setBossState(BOSS.WATCHING);
        }
      } else {
        setBossState(BOSS.AWAY);
      }
    }

    render();
    drawParticles(dt);
    rafId = requestAnimationFrame(loop);
  }

  function render() {
    scoreValue.innerHTML = score.toFixed(1) + "<small>초</small>";
  }

  // ---- 파티클 ----
  function resizeFx() {
    fx.width = fx.clientWidth * devicePixelRatio;
    fx.height = fx.clientHeight * devicePixelRatio;
  }
  function spawnBurst(x, y, color, n) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = (1 + Math.random() * 3) * devicePixelRatio;
      particles.push({
        x: x * devicePixelRatio, y: y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 2 * devicePixelRatio,
        life: 1, color, size: (2 + Math.random() * 3) * devicePixelRatio,
      });
    }
  }
  function spawnFloater(text, color) {
    floaters.push({
      x: (player.offsetLeft + 80 + (Math.random() * 30 - 15)) * devicePixelRatio,
      y: fx.height * 0.62,
      vy: -1.4 * devicePixelRatio,
      life: 1, text, color,
    });
  }
  function drawParticles(dt) {
    ctx.clearRect(0, 0, fx.width, fx.height);
    const g = 9 * devicePixelRatio;
    particles = particles.filter((p) => p.life > 0);
    for (const p of particles) {
      p.vy += g * dt;
      p.x += p.vx; p.y += p.vy;
      p.life -= dt * 1.5;
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    // 점수 팝업
    floaters = floaters.filter((f) => f.life > 0);
    ctx.textAlign = "center";
    ctx.font = `800 ${18 * devicePixelRatio}px ${getComputedStyle(document.body).fontFamily}`;
    for (const f of floaters) {
      f.y += f.vy; f.life -= dt * 1.1;
      ctx.globalAlpha = Math.max(0, f.life);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
  }

  // ---- 게임 시작/종료 ----
  function startGame() {
    resizeFx();
    running = true; holding = false;
    score = 0; elapsed = 0; comboTime = 0; comboLevel = 0;
    lastTs = 0; particles = []; floaters = []; scorePopAccum = 0; isFakeWarning = false; stageIdx = 0;
    hideCombo();
    player.classList.remove("slacking", "nervous");
    holdBtn.classList.remove("pressed");
    titleScreen.classList.add("hidden");
    overScreen.classList.add("hidden");
    bestValue.innerHTML = best.toFixed(1) + "<small>초</small>";
    setBossState(BOSS.AWAY);
    stateTimer = 1.2; // 첫 안전 유예
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(loop);
  }

  function gameOver() {
    if (!running) return;
    running = false;
    holding = false;
    cancelAnimationFrame(rafId);
    player.classList.remove("slacking");
    holdBtn.classList.remove("pressed");
    hideCombo();
    sfx.caught();

    // 이펙트
    stage.classList.add("shake", "flash-danger");
    spawnBurst(fx.clientWidth / 2, fx.height * 0.5, "#ff4d5e", 24);
    setTimeout(() => stage.classList.remove("shake", "flash-danger"), 500);

    const isRecord = score > best;
    if (isRecord) { best = score; localStorage.setItem(BEST_KEY, String(best)); }

    const grade = gradeFor(score);
    setTimeout(() => {
      $("overEmoji").textContent = isRecord ? "🎉" : "😱";
      $("overTitle").textContent = isRecord ? "신기록 달성!" : "딱 걸렸다!";
      $("overReason").textContent = CAUGHT_MSGS[(Math.random() * CAUGHT_MSGS.length) | 0];
      $("resultScore").textContent = score.toFixed(1) + "초";
      $("resultGrade").textContent = grade.emoji + " " + grade.name;
      $("resultBest").textContent = best.toFixed(1) + "초";
      overScreen.classList.remove("hidden");
    }, 450);
  }

  function gradeFor(s) {
    let g = GRADES[0];
    for (const x of GRADES) if (s >= x.min) g = x;
    return g;
  }

  // ---- 공유 카드 ----
  // 공개 도메인이면 실제 플레이 URL을, 로컬/내부망이면 임시 문구를 사용
  const PLAY_URL = location.origin + location.pathname.replace(/index\.html?$/i, "");
  const IS_PUBLIC = !!location.hostname && !location.hostname.startsWith("localhost") && !/^\d+\./.test(location.hostname);
  const SHARE_LINK = IS_PUBLIC ? PLAY_URL : "";
  const SHARE_URL = IS_PUBLIC ? PLAY_URL.replace(/^https?:\/\//i, "").replace(/\/$/, "") : "월급루팡 검색";
  const shareScreen = $("shareScreen");
  const shareImg = $("shareImg");
  let lastCardBlob = null;

  function wrapText(g, text, x, y, maxW, lh) {
    const words = text.split(" ");
    let line = "";
    for (const w of words) {
      const test = line ? line + " " + w : w;
      if (g.measureText(test).width > maxW && line) {
        g.fillText(line, x, y); line = w; y += lh;
      } else line = test;
    }
    g.fillText(line, x, y);
    return y;
  }

  function buildShareCard() {
    const grade = gradeFor(score);
    const W = 1080, H = 1920;
    const c = document.createElement("canvas");
    c.width = W; c.height = H;
    const g = c.getContext("2d");
    const FONT = "'Apple SD Gothic Neo','Malgun Gothic',sans-serif";

    // 배경
    const bg = g.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#37506b"); bg.addColorStop(0.35, "#1b2430"); bg.addColorStop(1, "#0d1218");
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    // 상단 라벨
    g.textAlign = "center";
    g.fillStyle = "#ffd23f";
    g.font = `800 46px ${FONT}`;
    g.fillText("💼 월급루팡 시뮬레이터", W / 2, 150);
    g.fillStyle = "#9fb0c3";
    g.font = `600 34px ${FONT}`;
    g.fillText("오늘의 근무태도 진단서", W / 2, 210);

    // 등급 이모지
    g.font = `300px ${FONT}`;
    g.fillText(grade.emoji, W / 2, 560);

    // 등급명
    g.fillStyle = "#ff7a45";
    g.font = `900 90px ${FONT}`;
    g.fillText(grade.name, W / 2, 690);

    // 점수 헤드라인
    g.fillStyle = "#eaf1f8";
    g.font = `800 62px ${FONT}`;
    g.fillText("오늘 나", W / 2, 830);
    g.fillStyle = "#ffd23f";
    g.font = `900 130px ${FONT}`;
    g.fillText(score.toFixed(1) + "초", W / 2, 960);
    g.fillStyle = "#eaf1f8";
    g.font = `800 62px ${FONT}`;
    g.fillText("땡땡이침 🤫", W / 2, 1050);

    // 진단 코멘트 박스
    g.fillStyle = "rgba(255,255,255,0.06)";
    roundRect(g, 90, 1140, W - 180, 220, 28); g.fill();
    g.fillStyle = "#eaf1f8";
    g.font = `700 44px ${FONT}`;
    wrapText(g, "“" + grade.verdict + "”", W / 2, 1240, W - 260, 62);

    // 하단 CTA
    g.fillStyle = "#9fb0c3";
    g.font = `600 40px ${FONT}`;
    g.fillText("너도 사장님 몰래 딴짓해봐 👇", W / 2, 1600);
    // URL 박스 — 텍스트 길이에 맞춰 폰트/박스 자동 피팅
    let urlFont = 46;
    const maxBoxW = W - 140; // 좌우 여백 70px
    const padX = 44;
    g.font = `800 ${urlFont}px ${FONT}`;
    while (g.measureText(SHARE_URL).width + padX * 2 > maxBoxW && urlFont > 24) {
      urlFont -= 2; g.font = `800 ${urlFont}px ${FONT}`;
    }
    const boxW = Math.min(maxBoxW, g.measureText(SHARE_URL).width + padX * 2);
    const boxH = 110;
    g.fillStyle = "#ffd23f";
    roundRect(g, (W - boxW) / 2, 1660, boxW, boxH, 24); g.fill();
    g.fillStyle = "#2a1a00";
    g.textBaseline = "middle";
    g.fillText(SHARE_URL, W / 2, 1660 + boxH / 2);
    g.textBaseline = "alphabetic";

    return c;
  }
  function roundRect(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }

  function openShare() {
    const canvas = buildShareCard();
    shareImg.src = canvas.toDataURL("image/png");
    canvas.toBlob((b) => { lastCardBlob = b; }, "image/png");
    shareScreen.classList.remove("hidden");
  }

  async function shareAction() {
    if (!lastCardBlob) return;
    const file = new File([lastCardBlob], "월급루팡.png", { type: "image/png" });
    const grade = gradeFor(score);
    const text = `나 오늘 ${score.toFixed(1)}초 땡땡이침 ${grade.emoji} [${grade.name}] #월급루팡시뮬레이터`;
    const shareData = { files: [file], text };
    if (SHARE_LINK) shareData.url = SHARE_LINK;
    // 1) 네이티브 공유(파일) — 모바일 HTTPS에서 동작
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share(shareData); return; } catch (e) { /* 취소 */ return; }
    }
    // 2) 폴백: 이미지 다운로드
    const a = document.createElement("a");
    a.href = shareImg.src; a.download = "월급루팡.png";
    document.body.appendChild(a); a.click(); a.remove();
    setShareHint("이미지가 저장됐어요! 인스타/카톡에 올려보세요 📲");
  }

  function copyLinkText() {
    const grade = gradeFor(score);
    const linkLine = SHARE_LINK || "월급루팡 시뮬레이터 검색";
    const text = `나 오늘 ${score.toFixed(1)}초 땡땡이침 ${grade.emoji} [${grade.name}]\n월급루팡 시뮬레이터 — 너도 해봐 👇\n${linkLine}`;
    const done = () => setShareHint("문구+링크 복사됨! 붙여넣기 하세요 ✅");
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(done, fallbackCopy);
    } else fallbackCopy();
    function fallbackCopy() {
      const ta = document.createElement("textarea");
      ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.focus(); ta.select();
      try { document.execCommand("copy"); done(); } catch (e) { setShareHint("문구를 길게 눌러 복사하세요"); }
      ta.remove();
    }
  }
  function setShareHint(t) { $("shareHint").textContent = t; }
  function closeShare() { shareScreen.classList.add("hidden"); }

  // ---- 이벤트 바인딩 ----
  function bindHold(el) {
    el.addEventListener("pointerdown", (e) => { e.preventDefault(); startHold(); });
    el.addEventListener("pointerup", (e) => { e.preventDefault(); endHold(); });
    el.addEventListener("pointercancel", endHold);
    el.addEventListener("pointerleave", endHold);
  }
  bindHold(holdBtn);
  // 화면 전체도 딴짓 영역으로 (게임 중, 버튼 밖)
  stage.addEventListener("pointerdown", (e) => {
    if (!running) return;
    if (e.target.closest(".hud") || e.target.closest(".control")) return;
    startHold();
  });
  stage.addEventListener("pointerup", () => { if (running) endHold(); });

  document.addEventListener("keydown", (e) => { if (e.code === "Space") { e.preventDefault(); startHold(); } });
  document.addEventListener("keyup", (e) => { if (e.code === "Space") { e.preventDefault(); endHold(); } });

  startBtn.addEventListener("click", startGame);
  retryBtn.addEventListener("click", startGame);
  shareBtn.addEventListener("click", openShare);
  $("shareActionBtn").addEventListener("click", shareAction);
  $("copyLinkBtn").addEventListener("click", copyLinkText);
  $("closeShareBtn").addEventListener("click", closeShare);
  window.addEventListener("resize", resizeFx);
  // 탭 이탈 시 안전하게 손 떼기
  document.addEventListener("visibilitychange", () => { if (document.hidden) endHold(); });

  // ---- 초기화 ----
  titleBest.textContent = best.toFixed(1);
  bestValue.innerHTML = best.toFixed(1) + "<small>초</small>";
  resizeFx();
})();
