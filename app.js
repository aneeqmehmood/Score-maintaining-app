// ============================================================
// CRICKET SCORER — MAIN APP  v2
// ============================================================

const App = (() => {
  let currentMatch = null;
  let settings = { darkMode: true };

  // ── Utility ────────────────────────────────────────────────
  function esc(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function toast(msg, type = 'default', duration = 2800) {
    const c  = document.getElementById('toast-container');
    const el = document.createElement('div');
    el.className   = `toast ${type}`;
    el.textContent = msg;
    c.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 300); }, duration);
  }

  function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id)?.classList.add('active');
    window.scrollTo({ top: 0, behavior: 'auto' });
    if (id === 'screen-match') activateTab('tab-scoring');
  }

  function openModal(id)  { document.getElementById(id)?.classList.add('open');    }
  function closeModal(id) { document.getElementById(id)?.classList.remove('open'); }

  function chipClass(e) {
    const base = 'over-chip';
    if (e.type === 'wicket')   return base + ' wicket';
    if (e.type === 'wide')     return base + ' wide';
    if (e.type === 'noball')   return base + ' noball';
    if (e.type === 'bye' || e.type === 'legbye') return base + ' extras';
    if ((e.runsScored || 0) === 6) return base + ' six';
    if ((e.runsScored || 0) === 4) return base + ' four';
    if ((e.runsScored || 0) === 0) return base + ' dot';
    return base;
  }

  // ── Tab helper ─────────────────────────────────────────────
  function activateTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(tabId)?.classList.add('active');
    document.querySelectorAll('.tab-btn').forEach(b => {
      if (b.dataset.tab === tabId) b.classList.add('active');
    });
  }

  // ── Dashboard ─────────────────────────────────────────────
  function renderDashboard() {
    showScreen('screen-dashboard');
    const matches = Storage.loadMatches();
    const el = document.getElementById('matches-list');

    if (!matches.length) {
      el.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🏏</div>
          <h3>NO MATCHES YET</h3>
          <p>Tap <strong>New Match</strong> to get started</p>
        </div>`;
      return;
    }
    el.innerHTML = matches.map(buildMatchCardHTML).join('');
    el.querySelectorAll('.match-card').forEach(card =>
      card.addEventListener('click', () => openMatch(card.dataset.id))
    );
  }

  function buildMatchCardHTML(m) {
    const STATUS = {
      setup:      ['Setup',      'setup'],
      innings1:   ['● Live',     'live'],
      innings2:   ['● Live',     'live'],
      superOver1: ['Super Over', 'superover'],
      superOver2: ['Super Over', 'superover'],
      completed:  ['Completed',  'completed'],
      abandoned:  ['Abandoned',  'abandoned'],
    };
    const [lbl, cls] = STATUS[m.status] || ['—',''];
    const date = m.date
      ? new Date(m.date).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' })
      : '';

    let scoreHtml = '';
    if (m.innings1) scoreHtml += `${esc(m.teamA)}: <strong>${m.innings1.runs}/${m.innings1.wickets}</strong> (${ScoringLogic.formatOvers(m.innings1.balls)} ov)`;
    if (m.innings2) scoreHtml += ` &nbsp;|&nbsp; ${esc(m.teamB)}: <strong>${m.innings2.runs}/${m.innings2.wickets}</strong> (${ScoringLogic.formatOvers(m.innings2.balls)} ov)`;

    const resultHtml = m.result
      ? `<div class="match-card-result">${esc(m.result.text)}</div>` : '';

    return `<div class="match-card" data-id="${m.id}">
      <div class="match-card-top">
        <div>
          <div class="match-card-title">${esc(m.title)}</div>
          <div class="match-card-meta">${date}${m.venue ? ' · ' + esc(m.venue) : ''}${m.overs ? ' · ' + m.overs + ' ov/side' : ''}</div>
        </div>
        <span class="status-badge ${cls}">${lbl}</span>
      </div>
      <div class="match-card-teams">
        <span>${esc(m.teamA)}</span><span class="vs">VS</span><span>${esc(m.teamB)}</span>
      </div>
      ${scoreHtml ? `<div class="match-card-score">${scoreHtml}</div>` : ''}
      ${resultHtml}
    </div>`;
  }

  // ── Create Match ───────────────────────────────────────────
  function showCreateMatch() {
    showScreen('screen-create');
    document.getElementById('form-create-match').reset();
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    document.getElementById('f-date').value = now.toISOString().slice(0,16);
    setTimeout(() => document.getElementById('f-teamA').focus(), 100);
  }

  function handleCreateMatch(e) {
    e.preventDefault();
    const teamA = document.getElementById('f-teamA').value.trim();
    const teamB = document.getElementById('f-teamB').value.trim();
    if (!teamA || !teamB) { toast('Enter both team names', 'error'); return; }
    if (teamA.toLowerCase() === teamB.toLowerCase()) { toast('Teams must have different names', 'error'); return; }

    const match = MatchManager.createMatch({
      title:  document.getElementById('f-title').value.trim() || `Match #${Storage.loadMatches().length + 1}`,
      teamA, teamB,
      date:   document.getElementById('f-date').value || new Date().toISOString(),
      venue:  document.getElementById('f-venue').value.trim(),
      overs:  Math.max(0, parseInt(document.getElementById('f-overs').value) || 0),
    });
    Storage.saveMatch(match);
    currentMatch = match;
    Storage.saveCurrentMatchId(match.id);
    renderMatchScreen();
    showScreen('screen-match');
    toast('Match created! 🏏', 'success');
  }

  // ── Open Match ─────────────────────────────────────────────
  function openMatch(id) {
    const m = Storage.getMatch(id);
    if (!m) { toast('Match not found', 'error'); renderDashboard(); return; }
    currentMatch = m;
    Storage.saveCurrentMatchId(id);
    renderMatchScreen();
    showScreen('screen-match');
  }

  // ── Master Render ──────────────────────────────────────────
  function renderMatchScreen() {
    const m = currentMatch;
    if (!m) return;
    window.__currentMatch = m;

    document.getElementById('match-title-display').textContent = m.title;
    const meta = [
      m.date   ? new Date(m.date).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' }) : null,
      m.venue  || null,
      m.overs  ? `${m.overs} ov/side` : null,
    ].filter(Boolean).join(' · ');
    document.getElementById('match-meta-display').textContent = meta;

    const resetBtn = document.getElementById('btn-match-reset');
    if (resetBtn) resetBtn.style.display = (m.status !== 'completed' && m.status !== 'abandoned') ? '' : 'none';

    renderScoreboard();
    renderInfoStrip();
    renderScoringPanel();
    renderOverStrip();
    renderOverHistory('over-history');
    renderInningsSummaries('innings-summaries');
    renderResultSection();
    if (document.getElementById('tab-chart')?.classList.contains('active')) updateWormChart();
  }

  // ── Scoreboard ─────────────────────────────────────────────
  function renderScoreboard() {
    const m   = currentMatch;
    const el  = document.getElementById('scoreboard');
    const isSO = ['superOver1','superOver2'].includes(m.status);
    const cur  = MatchManager.getCurrentInnings(m);

    let leftScore='—', leftOvers='', rightScore='—', rightOvers='';
    let leftBat=false, rightBat=false;

    if (isSO) {
      leftBat  = m.status === 'superOver2';
      rightBat = m.status === 'superOver1';
      const s1=m.superOver1, s2=m.superOver2;
      leftScore  = s2 ? `${s2.runs}/${s2.wickets}` : (leftBat  && cur ? `${cur.runs}/${cur.wickets}` : '—');
      leftOvers  = s2 ? ScoringLogic.formatOvers(s2.balls) : (leftBat  && cur ? ScoringLogic.formatOvers(cur.balls) : '');
      rightScore = s1 ? `${s1.runs}/${s1.wickets}` : (rightBat && cur ? `${cur.runs}/${cur.wickets}` : '—');
      rightOvers = s1 ? ScoringLogic.formatOvers(s1.balls) : (rightBat && cur ? ScoringLogic.formatOvers(cur.balls) : '');
    } else {
      leftBat  = m.status === 'innings1';
      rightBat = m.status === 'innings2';
      if (m.innings1) { leftScore  = `${m.innings1.runs}/${m.innings1.wickets}`; leftOvers  = ScoringLogic.formatOvers(m.innings1.balls); }
      if (m.innings2) { rightScore = `${m.innings2.runs}/${m.innings2.wickets}`; rightOvers = ScoringLogic.formatOvers(m.innings2.balls); }
    }

    const midLabel = isSO ? 'SUPER OVER'
      : m.status === 'innings2' ? '2ND INNINGS'
      : (m.status === 'completed' || m.status === 'abandoned') ? 'FINAL'
      : '1ST INNINGS';

    el.innerHTML = `
      <div class="score-team ${leftBat ? 'batting' : ''}">
        <div class="team-name">${esc(m.teamA)}</div>
        <div class="score-display">${leftScore}</div>
        <div class="score-overs">${leftOvers ? leftOvers + ' ov' : '&nbsp;'}</div>
      </div>
      <div class="score-divider">
        <div class="vs-text">VS</div>
        <div class="innings-label">${midLabel}</div>
      </div>
      <div class="score-team right ${rightBat ? 'batting' : ''}">
        <div class="team-name">${esc(m.teamB)}</div>
        <div class="score-display">${rightScore}</div>
        <div class="score-overs">${rightOvers ? rightOvers + ' ov' : '&nbsp;'}</div>
      </div>`;
  }

  // ── Info Strip ─────────────────────────────────────────────
  function renderInfoStrip() {
    const m   = currentMatch;
    const el  = document.getElementById('info-strip');
    const inn = MatchManager.getCurrentInnings(m);
    if (!inn || inn.isComplete) { el.innerHTML = ''; return; }
    const isSuperOver = ['superOver1', 'superOver2'].includes(m.status);
    const maxBalls = isSuperOver ? 6 : (m.overs > 0 ? m.overs * 6 : null);
    const ballsLeft = maxBalls !== null ? Math.max(0, maxBalls - inn.balls) : null;

    const chips = [];
    chips.push(`<span class="info-chip">RR&nbsp;${ScoringLogic.getRunRate(inn)}</span>`);

    const target = MatchManager.getTarget(m);
    if (target !== null) {
      const need = Math.max(0, target - inn.runs);
      chips.push(`<span class="info-chip highlight">Target&nbsp;${target} · Need&nbsp;${need}</span>`);
      if (ballsLeft !== null) {
        const rrr = ScoringLogic.getRequiredRunRate(target, inn.runs, ballsLeft);
        if (rrr !== null) chips.push(`<span class="info-chip ${parseFloat(rrr) > 12 ? 'warning' : ''}">RRR&nbsp;${rrr}</span>`);
      }
    }

    const ex = inn.extras;
    if (ex.total > 0) {
      const parts=[];
      if (ex.wides)   parts.push(`Wd ${ex.wides}`);
      if (ex.noBalls) parts.push(`Nb ${ex.noBalls}`);
      if (ex.byes)    parts.push(`B ${ex.byes}`);
      if (ex.legByes) parts.push(`Lb ${ex.legByes}`);
      chips.push(`<span class="info-chip">Extras&nbsp;${ex.total}${parts.length ? ` (${parts.join(', ')})` : ''}</span>`);
    }
    if (ballsLeft !== null) chips.push(`<span class="info-chip">${ScoringLogic.formatOvers(ballsLeft)}&nbsp;ov left</span>`);

    el.innerHTML = chips.join('');
  }

  // ── Scoring Panel ──────────────────────────────────────────
  function renderScoringPanel() {
    const m   = currentMatch;
    const el  = document.getElementById('scoring-panel');
    const inn = MatchManager.getCurrentInnings(m);

    if (m.status === 'setup') {
      el.innerHTML = `
        <div class="scoring-panel-title">START MATCH</div>
        <p class="panel-hint">Toss done? Start the first innings when ready.</p>
        <button class="btn btn-primary btn-lg" id="btn-si1">🏏 Start Innings 1 — ${esc(m.teamA)} Bat</button>`;
      document.getElementById('btn-si1').onclick = startInnings1;
      return;
    }
    if (m.status === 'completed' || m.status === 'abandoned') { el.innerHTML = ''; return; }
    if (inn && inn.isComplete) { el.innerHTML = buildTransitionPanel(); return; }
    if (!inn) { el.innerHTML = ''; return; }

    el.innerHTML = `
      <div class="scoring-panel-title">RECORD BALL — <span style="color:var(--accent)">${esc(inn.battingTeam)}</span> batting</div>
      <div class="ball-grid" id="ball-grid">
        <button class="ball-btn dot"    data-type="dot">            <span>•</span><span class="ball-sub">Dot</span></button>
        <button class="ball-btn run1"   data-type="runs" data-runs="1"><span>1</span><span class="ball-sub">Run</span></button>
        <button class="ball-btn run2"   data-type="runs" data-runs="2"><span>2</span><span class="ball-sub">Runs</span></button>
        <button class="ball-btn run3"   data-type="runs" data-runs="3"><span>3</span><span class="ball-sub">Runs</span></button>
        <button class="ball-btn run4"   data-type="runs" data-runs="4"><span>4</span><span class="ball-sub">Four</span></button>
        <button class="ball-btn run6"   data-type="runs" data-runs="6"><span>6</span><span class="ball-sub">Six</span></button>
        <button class="ball-btn wicket" data-type="wicket">          <span>W</span><span class="ball-sub">Wicket</span></button>
        <button class="ball-btn wide"   data-modal="wide">           <span>Wd</span><span class="ball-sub">Wide</span></button>
        <button class="ball-btn noball" data-modal="noball">         <span>Nb</span><span class="ball-sub">No Ball</span></button>
        <button class="ball-btn bye"    data-modal="bye">            <span>B</span><span class="ball-sub">Bye</span></button>
        <button class="ball-btn legbye" data-modal="legbye">         <span>Lb</span><span class="ball-sub">Leg Bye</span></button>
      </div>
      <div class="action-row">
        <button class="btn btn-secondary btn-sm" id="btn-undo">↩ Undo Last</button>
        <button class="btn btn-warning   btn-sm" id="btn-end">⬛ End Innings</button>
      </div>`;

    document.getElementById('ball-grid').addEventListener('click', e => {
      const btn = e.target.closest('[data-type],[data-modal]');
      if (!btn) return;
      if (btn.dataset.type === 'dot')    { recordBall('dot'); return; }
      if (btn.dataset.type === 'runs')   { recordBall('runs', parseInt(btn.dataset.runs)); return; }
      if (btn.dataset.type === 'wicket') { recordBall('wicket'); return; }
      if (btn.dataset.modal === 'wide')   openWideModal();
      if (btn.dataset.modal === 'noball') openNoBallModal();
      if (btn.dataset.modal === 'bye')    openByeModal();
      if (btn.dataset.modal === 'legbye') openLegByeModal();
    });
    document.getElementById('btn-undo').onclick = undoBall;
    document.getElementById('btn-end').onclick  = confirmEndInnings;
  }

  function buildTransitionPanel() {
    const m   = currentMatch;
    const inn = MatchManager.getCurrentInnings(m);
    let html  = `<div class="scoring-panel-title">INNINGS COMPLETE</div>`;

    if (m.status === 'innings1') {
      const t = (m.innings1?.runs ?? 0) + 1;
      html += `<p class="panel-hint">${esc(m.teamA)} set ${t} to win.</p>
               <button class="btn btn-primary" id="btn-si2">🏏 Start Innings 2 — ${esc(m.teamB)} Bat</button>`;
    } else if (m.status === 'innings2') {
      const r = ScoringLogic.determineResult(m);
      if (r?.type === 'tie') {
        html += `<p class="panel-hint">Scores are level! Play a Super Over.</p>
                 <div style="display:flex;gap:8px;flex-wrap:wrap">
                   <button class="btn btn-primary"   id="btn-sso1">⚡ Start Super Over</button>
                   <button class="btn btn-secondary" id="btn-dte">🤝 Declare Tie</button>
                 </div>`;
      }
    } else if (m.status === 'superOver1') {
      const n = (inn?.runs ?? 0) + 1;
      html += `<p class="panel-hint">${esc(m.teamB)} scored ${inn?.runs ?? 0}/${inn?.wickets ?? 0}. ${esc(m.teamA)} need ${n} to win.</p>
               <button class="btn btn-primary" id="btn-sso2">🏏 ${esc(m.teamA)}'s Super Over</button>`;
    }

    setTimeout(() => {
      document.getElementById('btn-si2')?.addEventListener('click', startInnings2);
      document.getElementById('btn-sso1')?.addEventListener('click', startSuperOver);
      document.getElementById('btn-dte')?.addEventListener('click', declareTie);
      document.getElementById('btn-sso2')?.addEventListener('click', startSuperOver2);
    }, 0);
    return html;
  }

  // ── Over Strip ─────────────────────────────────────────────
  function renderOverStrip() {
    const m   = currentMatch;
    const inn = MatchManager.getCurrentInnings(m);
    const el  = document.getElementById('over-strip');
    if (!inn || inn.isComplete) { el.innerHTML = ''; return; }

    const overNum = inn.overs + 1;
    const evts    = inn.currentOverEvents;
    const legal   = evts.filter(e => !['wide','noball'].includes(e.type)).length;
    const gaps    = Math.max(0, 6 - evts.length);

    const chips = evts.map(e =>
      `<div class="${chipClass(e)}">${ScoringLogic.getEventLabel(e)}</div>`
    ).join('');
    const placeholders = Array(gaps).fill('<div class="over-chip-placeholder"></div>').join('');

    el.innerHTML = `
      <div class="over-strip">
        <div class="over-strip-header">
          <span class="over-strip-title">OVER ${overNum}</span>
          <span class="info-chip">${legal} / 6 legal balls</span>
        </div>
        <div class="over-chips">${chips}${placeholders}</div>
      </div>`;
  }

  // ── Over History ───────────────────────────────────────────
  function renderOverHistory(containerId) {
    const m   = currentMatch;
    const inn = MatchManager.getCurrentInnings(m);
    const el  = document.getElementById(containerId);
    if (!el) return;
    if (!inn?.overHistory?.length) { el.innerHTML = ''; return; }
    el.innerHTML = buildOverHistoryHTML(inn);
  }

  function buildOverHistoryHTML(inn) {
    if (!inn?.overHistory?.length)
      return '<p class="text-muted" style="padding:20px">No completed overs yet.</p>';

    let html = `<div class="over-history">
      <div class="over-history-title">OVER HISTORY — ${esc(inn.battingTeam)}</div>`;

    [...inn.overHistory].reverse().forEach((ovEvts, revIdx) => {
      const idx     = inn.overHistory.length - revIdx;
      const summary = ScoringLogic.getOverSummary(ovEvts);
      const chips   = ovEvts.map(e =>
        `<div class="${chipClass(e)}">${ScoringLogic.getEventLabel(e)}</div>`
      ).join('');
      html += `<div class="over-row">
        <div class="over-num">Ov ${idx}</div>
        <div class="over-balls">${chips}</div>
        <div class="over-total">${summary.runs}${summary.wickets ? ` <span class="text-red">-${summary.wickets}W</span>` : ''}</div>
      </div>`;
    });
    return html + '</div>';
  }

  // ── Innings Summaries ──────────────────────────────────────
  function renderInningsSummaries(containerId) {
    const m  = currentMatch;
    const el = document.getElementById(containerId);
    if (!el) return;

    const items = [
      { inn: m.innings1,   label: '1st Innings',  show: ['innings2','superOver1','superOver2','completed','abandoned'] },
      { inn: m.innings2,   label: '2nd Innings',  show: ['superOver1','superOver2','completed','abandoned'] },
      { inn: m.superOver1, label: 'Super Over 1', show: ['superOver2','completed'] },
      { inn: m.superOver2, label: 'Super Over 2', show: ['completed'] },
    ];

    el.innerHTML = items
      .filter(({ inn, show }) => inn && (inn.isComplete || show.includes(m.status)))
      .map(({ inn, label }) => buildInningsSummaryHTML(inn, label))
      .join('');
  }

  function buildInningsSummaryHTML(inn, label) {
    const ex  = inn.extras;
    const endMap = { allOut:'All Out', oversComplete:'Overs Up', manual:'Declared', target:'Won' };
    const endLbl = inn.isComplete && inn.endReason ? (endMap[inn.endReason] || '') : '';

    return `<div class="innings-summary">
      <div class="innings-summary-header">
        <span class="innings-summary-team">${label} — ${esc(inn.battingTeam)}</span>
        <span class="innings-summary-score">${inn.runs}/${inn.wickets}</span>
      </div>
      <div class="info-strip" style="margin:0 0 8px">
        <span class="info-chip">Overs ${ScoringLogic.formatOvers(inn.balls)}</span>
        <span class="info-chip">RR ${ScoringLogic.getRunRate(inn)}</span>
        ${endLbl ? `<span class="info-chip" style="border-color:var(--accent);color:var(--accent)">✓ ${endLbl}</span>` : ''}
      </div>
      <div class="extras-row">
        ${ex.total > 0 ? `
          <span class="extra-chip">Extras ${ex.total}</span>
          ${ex.wides   ? `<span class="extra-chip">Wides ${ex.wides}</span>`      : ''}
          ${ex.noBalls ? `<span class="extra-chip">No Balls ${ex.noBalls}</span>` : ''}
          ${ex.byes    ? `<span class="extra-chip">Byes ${ex.byes}</span>`         : ''}
          ${ex.legByes ? `<span class="extra-chip">Leg Byes ${ex.legByes}</span>` : ''}
        ` : '<span class="extra-chip" style="color:var(--text3)">No extras</span>'}
      </div>
    </div>`;
  }

  // ── Result Banner ──────────────────────────────────────────
  function renderResultSection() {
    const m  = currentMatch;
    const el = document.getElementById('result-section');
    if (m.status !== 'completed' && m.status !== 'abandoned') { el.innerHTML = ''; return; }

    const result = m.superOverResult || m.result;
    const icon = m.status === 'abandoned' ? '🚫'
      : (result?.type === 'tie' || result?.type === 'supertie') ? '🤝' : '🏆';
    const text = m.status === 'abandoned' ? 'Match Abandoned'
      : result ? result.text : 'Match Complete';
    const sub = (m.superOverResult && m.result?.type === 'tie')
      ? 'Main match was tied — decided by Super Over' : '';

    el.innerHTML = `
      <div class="result-banner">
        <div class="result-icon">${icon}</div>
        <h2>${esc(text)}</h2>
        ${sub ? `<p>${esc(sub)}</p>` : ''}
        <div class="result-actions">
          <button class="btn btn-secondary" onclick="App.exportMatch()">⬇ Export JSON</button>
          <button class="btn btn-secondary" onclick="App.printMatch()">🖨 Print</button>
        </div>
      </div>`;
  }

  // ── Worm Chart ─────────────────────────────────────────────
  function updateWormChart() {
    const canvas = document.getElementById('wormCanvas');
    if (!canvas) return;
    const m = currentMatch;
    if (!m) return;
    requestAnimationFrame(() => {
      const W   = canvas.parentElement?.clientWidth || 560;
      const H   = 180;
      const dpr = window.devicePixelRatio || 1;
      canvas.width        = W * dpr;
      canvas.height       = H * dpr;
      canvas.style.width  = W + 'px';
      canvas.style.height = H + 'px';
      const ctx = canvas.getContext('2d');
      ctx.scale(dpr, dpr);
      drawWorm(ctx, m, W, H);
    });
  }

  function drawWorm(ctx, m, W, H) {
    ctx.clearRect(0, 0, W, H);
    const isDark   = document.documentElement.dataset.theme !== 'light';
    const textA    = isDark ? 0.4 : 0.45;
    const gridA    = isDark ? 0.07 : 0.1;
    const innings  = [m.innings1, m.innings2].filter(i => i?.events?.length > 0);

    if (!innings.length) {
      ctx.fillStyle = isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.25)';
      ctx.font = '13px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('No deliveries recorded yet', W / 2, H / 2);
      return;
    }

    const allMax = Math.max(...innings.map(i => i.runs), 20);
    const colors = ['#00d4aa', '#4facfe'];
    const fills  = ['rgba(0,212,170,0.09)', 'rgba(79,172,254,0.09)'];
    const PAD    = { t:16, r:12, b:16, l:32 };
    const cW = W - PAD.l - PAD.r;
    const cH = H - PAD.t - PAD.b;

    // Grid
    ctx.setLineDash([3,4]);
    for (let i=0; i<=4; i++) {
      const y = PAD.t + (1 - i/4) * cH;
      ctx.strokeStyle = `rgba(${isDark?'255,255,255':'0,0,0'},${gridA})`;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(PAD.l, y); ctx.lineTo(W-PAD.r, y); ctx.stroke();
      ctx.fillStyle = `rgba(${isDark?'255,255,255':'0,0,0'},${textA})`;
      ctx.font = `10px monospace`; ctx.textAlign = 'right';
      ctx.fillText(Math.round((i/4)*allMax), PAD.l-5, y+3);
    }
    ctx.setLineDash([]);

    innings.forEach((inn, idx) => {
      let cum=0, legal=0;
      const pts = [{x:0, y:0}];
      for (const e of inn.events) {
        cum += e.runsScored || 0;
        if (!['wide','noball'].includes(e.type)) legal++;
        pts.push({x:legal, y:cum});
      }
      const maxB = Math.max(pts[pts.length-1].x, 6);
      const sx   = cW / maxB;
      const sy   = cH / allMax;
      const px   = x => PAD.l + x*sx;
      const py   = y => PAD.t + cH - y*sy;

      // Area
      ctx.beginPath();
      ctx.moveTo(px(0), PAD.t+cH);
      pts.forEach(p => ctx.lineTo(px(p.x), py(p.y)));
      ctx.lineTo(px(pts[pts.length-1].x), PAD.t+cH);
      ctx.closePath(); ctx.fillStyle = fills[idx]; ctx.fill();

      // Line
      ctx.beginPath(); ctx.strokeStyle=colors[idx]; ctx.lineWidth=2.5;
      ctx.lineJoin='round'; ctx.shadowBlur=10; ctx.shadowColor=colors[idx];
      pts.forEach((p,i) => i===0 ? ctx.moveTo(px(p.x),py(p.y)) : ctx.lineTo(px(p.x),py(p.y)));
      ctx.stroke(); ctx.shadowBlur=0;

      // Endpoint dot + label
      const last = pts[pts.length-1];
      ctx.beginPath(); ctx.arc(px(last.x), py(last.y), 4, 0, Math.PI*2);
      ctx.fillStyle=colors[idx]; ctx.shadowBlur=8; ctx.shadowColor=colors[idx];
      ctx.fill(); ctx.shadowBlur=0;
      ctx.fillStyle=colors[idx]; ctx.font=`bold 11px sans-serif`; ctx.textAlign='left';
      ctx.fillText(`${inn.runs}/${inn.wickets}`, px(last.x)+8, py(last.y)+4);

      // Wicket markers (red dots)
      let legalSoFar=0;
      inn.events.forEach((e, evIdx) => {
        if (!['wide','noball'].includes(e.type)) legalSoFar++;
        if (e.type !== 'wicket') return;
        const pt = pts.find(p => p.x === legalSoFar) || pts[legalSoFar] || last;
        ctx.beginPath(); ctx.arc(px(pt.x), py(pt.y), 3, 0, Math.PI*2);
        ctx.fillStyle='#ff4e6a'; ctx.fill();
      });
    });
  }

  // ── Ball Recording ─────────────────────────────────────────
  function recordBall(type, runs, extraRuns) {
    if (!currentMatch) return;
    const inn = MatchManager.getCurrentInnings(currentMatch);
    if (!inn || inn.isComplete) { toast('No active innings', 'error'); return; }
    try {
      currentMatch = MatchManager.recordBall(currentMatch, {type, runs:runs||0, extraRuns:extraRuns||0});
      renderMatchScreen();
      if (currentMatch.status === 'completed') {
        const r = currentMatch.superOverResult || currentMatch.result;
        toast(r ? r.text : 'Match complete!', 'success', 4000);
      } else if (type==='runs' && runs===6) { toast('🎉 SIX!', 'success', 1600); }
        else if (type==='runs' && runs===4) { toast('⚡ FOUR!', 'success', 1600); }
        else if (type==='wicket')           { toast('🎯 WICKET!', 'error',   1600); }
    } catch(err) { toast(err.message, 'error'); }
  }

  function undoBall() {
    if (!currentMatch) return;
    const inn = MatchManager.getCurrentInnings(currentMatch);
    if (!inn || !inn.events.length) { toast('Nothing to undo', 'error'); return; }
    currentMatch = MatchManager.undoBall(currentMatch);
    renderMatchScreen();
    toast('↩ Last ball undone', 'default');
  }

  // ── Extra Modals ───────────────────────────────────────────
  function openExtraModal(title, hint, defaultVal, onConfirm) {
    document.getElementById('modal-extra-title').textContent      = title;
    document.getElementById('modal-extra-runs-label').textContent = hint;
    let selected = defaultVal;
    const btns   = document.querySelectorAll('.modal-num-btn');
    btns.forEach(b => {
      b.classList.toggle('selected', parseInt(b.dataset.val) === defaultVal);
      b.onclick = () => {
        btns.forEach(x => x.classList.remove('selected'));
        b.classList.add('selected');
        selected = parseInt(b.dataset.val);
      };
    });
    document.getElementById('btn-modal-extra-confirm').onclick = () => {
      closeModal('modal-extra'); onConfirm(selected);
    };
    openModal('modal-extra');
  }

  function openWideModal()   { openExtraModal('WIDE',    'Extra runs (overthrows, boundary off wide)?', 0, r => recordBall('wide',   0, r)); }
  function openNoBallModal() { openExtraModal('NO BALL', 'Bat runs scored off this no-ball?',           0, r => recordBall('noball', r, 0)); }
  function openByeModal()    { openExtraModal('BYE',     'How many bye runs?',                          1, r => recordBall('bye',    r||1, 0)); }
  function openLegByeModal() { openExtraModal('LEG BYE', 'How many leg bye runs?',                      1, r => recordBall('legbye', r||1, 0)); }

  // ── Match Flow ─────────────────────────────────────────────
  function startInnings1() {
    try { currentMatch = MatchManager.startInnings1(currentMatch); Storage.saveMatch(currentMatch); renderMatchScreen(); toast(`1st innings started — ${currentMatch.teamA} batting 🏏`, 'success'); }
    catch(err) { toast(err.message, 'error'); }
  }
  function startInnings2() {
    try { currentMatch = MatchManager.startInnings2(currentMatch); Storage.saveMatch(currentMatch); renderMatchScreen();
      const t = currentMatch.innings1 ? currentMatch.innings1.runs + 1 : '?';
      toast(`2nd innings — ${currentMatch.teamB} needs ${t} to win`, 'success');
    } catch(err) { toast(err.message, 'error'); }
  }
  function startSuperOver() {
    try { currentMatch = MatchManager.startSuperOver1(currentMatch); Storage.saveMatch(currentMatch); renderMatchScreen(); toast('Super Over started! ⚡', 'success'); }
    catch(err) { toast(err.message, 'error'); }
  }
  function startSuperOver2() {
    try { currentMatch = MatchManager.startSuperOver2(currentMatch); Storage.saveMatch(currentMatch); renderMatchScreen(); }
    catch(err) { toast(err.message, 'error'); }
  }
  function declareTie() {
    currentMatch.status = 'completed';
    currentMatch.result = { winner:null, type:'tie', text:'Match Tied!' };
    Storage.saveMatch(currentMatch); renderMatchScreen(); toast('Match declared a Tie 🤝', 'default');
  }
  function confirmEndInnings() { openModal('modal-confirm-end'); }
  function doEndInnings() {
    closeModal('modal-confirm-end');
    try { currentMatch = MatchManager.endInningsManually(currentMatch); renderMatchScreen(); toast('Innings ended', 'default'); }
    catch(err) { toast(err.message, 'error'); }
  }

  // ── Reset Match ────────────────────────────────────────────
  function confirmResetMatch() { openModal('modal-confirm-reset'); }
  function doResetMatch() {
    closeModal('modal-confirm-reset');
    if (!currentMatch) return;
    currentMatch.status        = 'setup';
    currentMatch.innings1      = null;
    currentMatch.innings2      = null;
    currentMatch.superOver1    = null;
    currentMatch.superOver2    = null;
    currentMatch.result        = null;
    currentMatch.superOverResult = null;
    Storage.saveMatch(currentMatch);
    renderMatchScreen();
    toast('Match reset to setup', 'default');
  }

  // ── Export / Print ─────────────────────────────────────────
  function exportMatch() {
    if (!currentMatch) return;
    MatchManager.exportToJSON(currentMatch);
    toast('Match exported as JSON ⬇', 'success');
  }
  function printMatch() { window.print(); }

  // ── Clear History ──────────────────────────────────────────
  function doClearHistory() {
    Storage.clearAll(); currentMatch = null;
    closeModal('modal-confirm-clear'); renderDashboard();
    toast('All history cleared', 'default');
  }

  // ── Theme ──────────────────────────────────────────────────
  function toggleTheme() {
    const toLight = document.documentElement.dataset.theme !== 'light';
    document.documentElement.dataset.theme = toLight ? 'light' : 'dark';
    settings.darkMode = !toLight;
    Storage.saveSettings(settings);
    document.getElementById('theme-btn').textContent = toLight ? '🌙' : '☀️';
    if (document.getElementById('tab-chart')?.classList.contains('active')) updateWormChart();
  }

  // ── Init ───────────────────────────────────────────────────
  function init() {
    settings = Storage.loadSettings();
    if (!settings.darkMode) {
      document.documentElement.dataset.theme = 'light';
      document.getElementById('theme-btn').textContent = '🌙';
    }

    document.getElementById('btn-dashboard')    .addEventListener('click', renderDashboard);
    document.getElementById('theme-btn')         .addEventListener('click', toggleTheme);
    document.getElementById('btn-new-match')     .addEventListener('click', showCreateMatch);
    document.getElementById('btn-clear-history') .addEventListener('click', () => openModal('modal-confirm-clear'));
    document.getElementById('form-create-match') .addEventListener('submit', handleCreateMatch);
    document.getElementById('btn-cancel-create') .addEventListener('click', renderDashboard);
    document.getElementById('btn-match-back')    .addEventListener('click', renderDashboard);
    document.getElementById('btn-match-export')  .addEventListener('click', exportMatch);
    document.getElementById('btn-match-print')   .addEventListener('click', printMatch);
    document.getElementById('btn-match-reset')   .addEventListener('click', confirmResetMatch);

    document.getElementById('btn-confirm-end-yes')  .addEventListener('click', doEndInnings);
    document.getElementById('btn-confirm-end-no')   .addEventListener('click', () => closeModal('modal-confirm-end'));
    document.getElementById('btn-confirm-clear-yes').addEventListener('click', doClearHistory);
    document.getElementById('btn-confirm-clear-no') .addEventListener('click', () => closeModal('modal-confirm-clear'));
    document.getElementById('btn-confirm-reset-yes').addEventListener('click', doResetMatch);
    document.getElementById('btn-confirm-reset-no') .addEventListener('click', () => closeModal('modal-confirm-reset'));

    document.querySelectorAll('.modal-overlay').forEach(overlay =>
      overlay.addEventListener('click', e => { if (e.target === overlay) overlay.classList.remove('open'); })
    );

    window.addEventListener('resize', () => {
      if (document.getElementById('tab-chart')?.classList.contains('active')) updateWormChart();
    });

    const lastId = Storage.loadCurrentMatchId();
    if (lastId) {
      const m = Storage.getMatch(lastId);
      if (m && m.status !== 'completed' && m.status !== 'abandoned') {
        currentMatch = m; renderMatchScreen(); showScreen('screen-match');
        document.body.classList.add('loaded'); return;
      }
    }
    renderDashboard();
    document.body.classList.add('loaded');
  }

  return {
    init, renderDashboard, showCreateMatch, openMatch,
    startInnings1, startInnings2, startSuperOver, startSuperOver2, declareTie,
    recordBall, undoBall,
    openWideModal, openNoBallModal, openByeModal, openLegByeModal,
    confirmEndInnings, doEndInnings,
    confirmResetMatch, doResetMatch,
    exportMatch, printMatch, toggleTheme,
    updateWormChart, drawWorm,
    buildOverHistoryHTML, renderInningsSummaries, activateTab,
  };
})();

document.addEventListener('DOMContentLoaded', App.init);
