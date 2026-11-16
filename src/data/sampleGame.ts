// Sample HTML game (the shape AI game generation produces) so the game
// flows — play, create/edit UI, upload, results — can be tried without
// an API key. A complete, playable game: start screen with How to Play,
// HUD, pause/mute, seeded runs, and the EDUPRO_GAME_RESULT report.
//
// The game code uses string concatenation only (no template literals),
// because this file itself is one big template literal.
export const SAMPLE_GAME_HTML = `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Bat dap an dung — Rut gon phan so</title>
<style>
body{font-family:system-ui,sans-serif;background:#eff6ff;color:#1e293b;margin:0;padding:16px}
.wrap{max-width:560px;margin:0 auto;background:#fff;border-radius:16px;padding:20px;box-shadow:0 4px 20px rgba(37,99,235,.15)}
h1{color:#2563eb;font-size:22px;margin:0 0 8px}
h2{font-size:18px;margin:0 0 8px}
.hud{display:flex;flex-wrap:wrap;gap:8px;justify-content:space-between;align-items:center;background:#dbeafe;border-radius:10px;padding:10px 12px;margin:10px 0;font-weight:700}
.q{font-size:20px;text-align:center;margin:18px 0 6px}
.frac{display:inline-flex;flex-direction:column;text-align:center;vertical-align:middle;line-height:1.15;margin:0 4px}
.frac .num{padding:0 8px;border-bottom:2.5px solid #1e293b}
.frac .den{padding:0 8px}
.opts{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:14px}
.opt{font-size:20px;padding:16px 8px;border:2px solid #93c5fd;border-radius:12px;background:#fff;cursor:pointer;min-height:64px}
.opt:hover{border-color:#2563eb;background:#eff6ff}
.opt:disabled{cursor:default;opacity:.85}
.opt-correct{border-color:#059669;background:#d1fae5}
.opt-wrong{border-color:#dc2626;background:#fee2e2}
.timerbar{height:10px;background:#e2e8f0;border-radius:6px;overflow:hidden;margin-top:12px}
.timerbar>div{height:100%;background:#2563eb;width:100%}
button.primary{background:#2563eb;color:#fff;border:none;border-radius:10px;padding:12px 20px;font-size:16px;cursor:pointer}
button.ghost{background:#fff;color:#2563eb;border:1.5px solid #2563eb;border-radius:10px;padding:8px 14px;cursor:pointer}
button.small{padding:6px 10px;font-size:14px}
.rules{font-size:15px;line-height:1.6}
.float{position:fixed;font-weight:800;font-size:20px;pointer-events:none;animation:rise 1s ease-out forwards}
@keyframes rise{from{opacity:1;transform:translateY(0)}to{opacity:0;transform:translateY(-46px)}}
.shake{animation:shake .3s}
@keyframes shake{25%{transform:translateX(-5px)}75%{transform:translateX(5px)}}
.hidden{display:none!important}
.endstat{display:flex;justify-content:space-between;border-bottom:1px solid #e2e8f0;padding:8px 0}
.stars{font-size:30px;text-align:center;margin:8px 0}
.muted{color:#64748b;font-size:14px}
</style>
</head>
<body>
<div class="wrap" id="app">
  <div id="startScreen">
    <h1>🎯 Bắt đáp án đúng</h1>
    <p><strong>Chủ đề:</strong> Rút gọn phân số · <strong>Mã thử thách:</strong> <span id="seedLabel">—</span></p>
    <div class="rules">
      <h2>Cách chơi (How to Play)</h2>
      <ul>
        <li>Mỗi lượt hiện một phân số cần rút gọn và 4 đáp án. Bấm đáp án đúng.</li>
        <li>Đúng: <strong>+50 điểm</strong>. Từ câu đúng thứ 3 liên tiếp trở đi, mỗi câu đúng thêm <strong>+100 × chuỗi</strong>.</li>
        <li>Sai: <strong>−30 điểm</strong> (không xuống dưới 0), chuỗi về 0. Hết 10 giây không trả lời: mất 1 mạng.</li>
        <li>Bạn có <strong>3 mạng</strong>. Chơi hết 10 câu mà còn mạng là thắng.</li>
        <li>Phím 1–4: chọn đáp án. Phím P: tạm dừng.</li>
      </ul>
    </div>
    <label><input type="checkbox" id="practiceMode"> Chế độ Luyện (không mất mạng, không tính giờ)</label>
    <p><button class="primary" id="startBtn">▶ Bắt đầu chơi</button></p>
    <p class="muted">Cùng một mã thử thách thì mọi người chơi cùng một lượt câu hỏi giống hệt nhau — thi đấu công bằng nhé!</p>
  </div>

  <div id="gameScreen" class="hidden">
    <div class="hud">
      <span>⭐ <span id="score">0</span></span>
      <span>❤️ <span id="lives">3</span></span>
      <span>Câu <span id="roundLabel">1</span>/10</span>
      <span>🔥 <span id="streak">0</span></span>
      <span>
        <button class="ghost small" id="pauseBtn">⏸ Tạm dừng</button>
        <button class="ghost small" id="muteBtn">🔊 Âm thanh</button>
      </span>
    </div>
    <div class="q">Rút gọn: <span id="questionFrac"></span> = ?</div>
    <div class="timerbar"><div id="timerFill"></div></div>
    <div class="opts" id="opts"></div>
    <p class="muted" id="feedback"></p>
  </div>

  <div id="pauseScreen" class="hidden">
    <h2>⏸ Đang tạm dừng</h2>
    <p><button class="primary" id="resumeBtn">Tiếp tục chơi</button></p>
  </div>

  <div id="endScreen" class="hidden">
    <h2 id="endTitle">🎉 Thắng!</h2>
    <div class="stars" id="stars"></div>
    <div class="endstat"><span>Điểm</span><strong id="finalScore">0</strong></div>
    <div class="endstat"><span>Đúng / Sai</span><strong id="finalAcc">0 / 0</strong></div>
    <div class="endstat"><span>Thời gian</span><strong id="finalTime">0 giây</strong></div>
    <div class="endstat"><span>Kỹ năng cần luyện thêm</span><strong id="finalWeak">Không có</strong></div>
    <p><button class="primary" id="againBtn">🔄 Chơi lại</button></p>
    <p class="muted">Mã thử thách: <span id="seedLabel2">—</span> · Kết quả đã gửi về EduPro.</p>
  </div>
</div>
<script>
(function(){
"use strict";
var GAME_ID = (typeof window.EDUPRO_GAME_ID === "string" && window.EDUPRO_GAME_ID) || "sample-game";
var SEED = (typeof window.EDUPRO_GAME_SEED === "string" && window.EDUPRO_GAME_SEED) || null;
if (!SEED) {
  var chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  SEED = "";
  for (var ci = 0; ci < 4; ci++) SEED += chars[Math.floor(Math.random() * chars.length)];
}
document.getElementById("seedLabel").textContent = SEED;
document.getElementById("seedLabel2").textContent = SEED;

function hashStr(s){ var h = 2166136261; for (var i = 0; i < s.length; i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function mulberry32(seed){ var a = seed; return function(){ a |= 0; a = (a + 0x6D2B79F5) | 0; var t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
var rand = mulberry32(hashStr(SEED));
function gcd(a, b){ while (b !== 0){ var t = a % b; a = b; b = t; } return a; }

function makeRound(){
  var b = 2 + Math.floor(rand() * 8);
  var a = 1 + Math.floor(rand() * (b - 1));
  while (gcd(a, b) !== 1){ a = 1 + Math.floor(rand() * (b - 1)); }
  var k = 2 + Math.floor(rand() * 4);
  var n = a * k, d = b * k;
  var seen = {};
  var opts = [];
  function add(nn, dd){
    var g = gcd(nn, dd); var rn = nn / g, rd = dd / g;
    var key = rn + "/" + rd;
    if (seen[key] || rn >= rd) return false;
    seen[key] = true; opts.push({ n: rn, d: rd }); return true;
  }
  add(a, b);
  var tries = 0;
  while (opts.length < 4 && tries < 40){
    tries++;
    var pick = Math.floor(rand() * 4);
    if (pick === 0) add(a + 1, b);
    else if (pick === 1) add(a, b + 1);
    else if (pick === 2) add(Math.max(1, a - 1), b);
    else add(n + 1, d);
  }
  while (opts.length < 4) add(opts.length + 1, b + opts.length + 1);
  for (var i = opts.length - 1; i > 0; i--){ var j = Math.floor(rand() * (i + 1)); var tmp = opts[i]; opts[i] = opts[j]; opts[j] = tmp; }
  var correct = -1;
  for (var c = 0; c < opts.length; c++) if (opts[c].n === a && opts[c].d === b) correct = c;
  return { n: n, d: d, options: opts, correct: correct };
}

var ROUNDS = 10;
var rounds = [];
for (var r = 0; r < ROUNDS; r++) rounds.push(makeRound());

var score = 0, lives = 3, roundIdx = 0, streak = 0, correctCount = 0, wrongCount = 0;
var startTime = 0, timerId = null, timeLeft = 10, paused = false, practice = false, finished = false, muted = false;
var audioCtx = null;

function beep(freq, dur){
  if (muted) return;
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    var o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.frequency.value = freq; o.type = "sine";
    g.gain.setValueAtTime(0.12, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
    o.connect(g); g.connect(audioCtx.destination); o.start(); o.stop(audioCtx.currentTime + dur);
  } catch (e) {}
}

function fracHtml(n, d){
  return '<span class="frac"><span class="num">' + n + '</span><span class="den">' + d + '</span></span>';
}

function floatText(text, good){
  var el = document.createElement("div");
  el.className = "float"; el.textContent = text;
  el.style.color = good ? "#059669" : "#dc2626";
  el.style.left = "45%"; el.style.top = "38%";
  document.body.appendChild(el);
  setTimeout(function(){ el.remove(); }, 1000);
}

function show(id){
  ["startScreen", "gameScreen", "pauseScreen", "endScreen"].forEach(function(s){
    document.getElementById(s).classList.toggle("hidden", s !== id);
  });
}

function renderHud(){
  document.getElementById("score").textContent = String(score);
  document.getElementById("lives").textContent = String(lives);
  document.getElementById("roundLabel").textContent = String(Math.min(roundIdx + 1, ROUNDS));
  document.getElementById("streak").textContent = String(streak);
}

function renderRound(){
  var round = rounds[roundIdx];
  document.getElementById("questionFrac").innerHTML = fracHtml(round.n, round.d);
  document.getElementById("feedback").textContent = "";
  var box = document.getElementById("opts");
  box.innerHTML = "";
  round.options.forEach(function(opt, i){
    var btn = document.createElement("button");
    btn.className = "opt";
    btn.innerHTML = fracHtml(opt.n, opt.d);
    btn.setAttribute("aria-label", "Đáp án " + (i + 1));
    btn.addEventListener("click", function(){ pick(i, btn); });
    box.appendChild(btn);
  });
  renderHud();
  timeLeft = 10;
  document.getElementById("timerFill").style.width = "100%";
  if (timerId) clearInterval(timerId);
  if (!practice) {
    timerId = setInterval(function(){
      if (paused) return;
      timeLeft -= 0.1;
      document.getElementById("timerFill").style.width = Math.max(0, timeLeft * 10) + "%";
      if (timeLeft <= 0){
        clearInterval(timerId);
        lives -= 1; streak = 0; wrongCount += 1;
        document.getElementById("feedback").textContent = "Hết giờ! Đáp án đúng là đáp án số " + (round.correct + 1) + ".";
        beep(160, 0.3);
        setTimeout(nextRound, 1200);
      }
    }, 100);
  }
}

function pick(i, btn){
  if (paused || finished) return;
  var round = rounds[roundIdx];
  var buttons = document.getElementById("opts").children;
  if (i === round.correct){
    if (timerId) clearInterval(timerId);
    correctCount += 1; streak += 1;
    var gain = 50 + (streak >= 3 ? 100 * (streak - 2) : 0);
    score += gain;
    btn.classList.add("opt-correct");
    floatText("+" + gain, true);
    beep(660, 0.15);
    for (var b = 0; b < buttons.length; b++) buttons[b].disabled = true;
    setTimeout(nextRound, 700);
  } else {
    wrongCount += 1; streak = 0;
    score = Math.max(0, score - 30);
    btn.classList.add("opt-wrong", "shake");
    btn.disabled = true;
    floatText("-30", false);
    beep(180, 0.2);
    document.getElementById("feedback").textContent = "Chưa đúng — thử đáp án khác nhé!";
    renderHud();
  }
}

function nextRound(){
  roundIdx += 1;
  if (lives <= 0 || roundIdx >= ROUNDS) endGame();
  else renderRound();
}

function endGame(){
  finished = true;
  if (timerId) clearInterval(timerId);
  var won = lives > 0;
  var total = correctCount + wrongCount;
  var acc = total > 0 ? correctCount / total : 0;
  var stars = won && acc >= 0.9 ? 3 : won ? 2 : 1;
  var durationSec = Math.round((Date.now() - startTime) / 1000);
  document.getElementById("endTitle").textContent = won ? "🎉 Thắng! Xuất sắc!" : "💪 Chưa thắng — thử lại nhé!";
  document.getElementById("stars").textContent = "★".repeat(stars) + "☆".repeat(3 - stars);
  document.getElementById("finalScore").textContent = String(score);
  document.getElementById("finalAcc").textContent = correctCount + " / " + wrongCount;
  document.getElementById("finalTime").textContent = durationSec + " giây";
  document.getElementById("finalWeak").textContent = wrongCount > 0 ? "Rút gọn phân số" : "Không có";
  show("endScreen");
  beep(won ? 880 : 220, 0.4);
  try {
    window.parent.postMessage({
      type: "EDUPRO_GAME_RESULT",
      gameId: GAME_ID,
      seed: SEED,
      won: won,
      score: score,
      stars: stars,
      durationSec: durationSec,
      correct: correctCount,
      wrong: wrongCount,
      skills: [{ skill: "Rút gọn phân số", correct: correctCount, wrong: wrongCount }],
      missedSkills: wrongCount > 0 ? ["Rút gọn phân số"] : []
    }, "*");
  } catch (e) {}
}

document.getElementById("startBtn").addEventListener("click", function(){
  practice = document.getElementById("practiceMode").checked;
  if (practice) lives = 99;
  startTime = Date.now();
  show("gameScreen");
  renderRound();
});
document.getElementById("againBtn").addEventListener("click", function(){ window.location.reload(); });
document.getElementById("pauseBtn").addEventListener("click", function(){
  paused = true; show("pauseScreen");
});
document.getElementById("resumeBtn").addEventListener("click", function(){
  paused = false; show("gameScreen");
});
document.getElementById("muteBtn").addEventListener("click", function(){
  muted = !muted;
  document.getElementById("muteBtn").textContent = muted ? "🔇 Đã tắt tiếng" : "🔊 Âm thanh";
});
document.addEventListener("keydown", function(e){
  if (finished) return;
  if (e.key === "p" || e.key === "P"){
    if (!document.getElementById("gameScreen").classList.contains("hidden")){ paused = true; show("pauseScreen"); }
    else if (!document.getElementById("pauseScreen").classList.contains("hidden")){ paused = false; show("gameScreen"); }
    return;
  }
  if (paused) return;
  var num = parseInt(e.key, 10);
  if (num >= 1 && num <= 4 && !document.getElementById("gameScreen").classList.contains("hidden")){
    var btn = document.getElementById("opts").children[num - 1];
    if (btn && !btn.disabled) btn.click();
  }
});
})();
</script>
</body>
</html>`;
