// ============================================================
// CRICKET SCORING LOGIC
// ============================================================

const ScoringLogic = (() => {

  function createInnings(battingTeam) {
    return {
      battingTeam,
      runs: 0,
      wickets: 0,
      balls: 0,
      totalBalls: 0,
      overs: 0,
      extras: { wides: 0, noBalls: 0, byes: 0, legByes: 0, total: 0 },
      events: [],
      overHistory: [],
      currentOverEvents: [],
      isComplete: false,
      endReason: null
    };
  }

  function applyEvent(innings, event) {
    const e = { ...event, timestamp: Date.now() };
    let runsScored = 0;

    switch (e.type) {
      case 'dot':
        runsScored = 0;
        innings.balls++;
        break;
      case 'runs':
        runsScored = e.runs || 0;
        innings.balls++;
        break;
      case 'wicket':
        runsScored = e.runs || 0;
        innings.wickets++;
        innings.balls++;
        break;
      case 'wide':
        runsScored = 1 + (e.extraRuns || 0);
        innings.extras.wides += runsScored;
        innings.extras.total += runsScored;
        break;
      case 'noball':
        runsScored = 1 + (e.runs || 0);
        innings.extras.noBalls += 1;
        innings.extras.total += 1;
        break;
      case 'bye':
        runsScored = e.runs || 1;
        innings.extras.byes += runsScored;
        innings.extras.total += runsScored;
        innings.balls++;
        break;
      case 'legbye':
        runsScored = e.runs || 1;
        innings.extras.legByes += runsScored;
        innings.extras.total += runsScored;
        innings.balls++;
        break;
      default:
        break;
    }

    innings.runs += runsScored;
    innings.totalBalls++;
    e.runsScored = runsScored;
    e.ballNumber = innings.balls;
    e.totalBallNumber = innings.totalBalls;

    innings.events.push(e);
    innings.currentOverEvents.push(e);

    if (innings.balls > 0 && innings.balls % 6 === 0) {
      innings.overHistory.push([...innings.currentOverEvents]);
      innings.currentOverEvents = [];
    }
    innings.overs = Math.floor(innings.balls / 6);

    return { innings, event: e, runsScored };
  }

  function undoLastEvent(innings) {
    if (innings.events.length === 0) return innings;

    const last = innings.events.pop();
    innings.runs -= last.runsScored || 0;
    innings.totalBalls = Math.max(0, innings.totalBalls - 1);

    switch (last.type) {
      case 'dot':
      case 'runs':
        innings.balls = Math.max(0, innings.balls - 1);
        break;
      case 'wicket':
        innings.wickets = Math.max(0, innings.wickets - 1);
        innings.balls = Math.max(0, innings.balls - 1);
        break;
      case 'wide':
        innings.extras.wides = Math.max(0, innings.extras.wides - (last.runsScored || 0));
        innings.extras.total = Math.max(0, innings.extras.total - (last.runsScored || 0));
        break;
      case 'noball':
        innings.extras.noBalls = Math.max(0, innings.extras.noBalls - 1);
        innings.extras.total = Math.max(0, innings.extras.total - 1);
        break;
      case 'bye':
        innings.extras.byes = Math.max(0, innings.extras.byes - (last.runsScored || 0));
        innings.extras.total = Math.max(0, innings.extras.total - (last.runsScored || 0));
        innings.balls = Math.max(0, innings.balls - 1);
        break;
      case 'legbye':
        innings.extras.legByes = Math.max(0, innings.extras.legByes - (last.runsScored || 0));
        innings.extras.total = Math.max(0, innings.extras.total - (last.runsScored || 0));
        innings.balls = Math.max(0, innings.balls - 1);
        break;
    }

    innings.overs = Math.floor(innings.balls / 6);

    innings.overHistory = [];
    innings.currentOverEvents = [];
    let overBuf = [];
    let legalCount = 0;

    for (const ev of innings.events) {
      const isLegal = !['wide', 'noball'].includes(ev.type);
      overBuf.push(ev);
      if (isLegal) {
        legalCount++;
        if (legalCount % 6 === 0) {
          innings.overHistory.push([...overBuf]);
          overBuf = [];
        }
      }
    }
    innings.currentOverEvents = overBuf;

    return innings;
  }

  function getRunRate(innings) {
    if (innings.balls === 0) return '0.00';
    return (innings.runs / (innings.balls / 6)).toFixed(2);
  }

  function formatOvers(balls) {
    return `${Math.floor(balls / 6)}.${balls % 6}`;
  }

  function getRequiredRunRate(target, currentRuns, ballsRemaining) {
    if (ballsRemaining <= 0) return null;
    const needed = target - currentRuns;
    if (needed <= 0) return '0.00';
    return (needed / (ballsRemaining / 6)).toFixed(2);
  }

  function getOverSummary(overEvents) {
    let runs = 0, wickets = 0, extras = 0;
    const labels = [];
    for (const e of overEvents) {
      runs += e.runsScored || 0;
      if (e.type === 'wicket') wickets++;
      if (['wide', 'noball', 'bye', 'legbye'].includes(e.type)) extras += e.runsScored || 0;
      labels.push(getEventLabel(e));
    }
    return { runs, wickets, extras, labels };
  }

  function getEventLabel(e) {
    switch (e.type) {
      case 'dot':    return '•';
      case 'runs':   return String(e.runs);
      case 'wicket': return e.runs ? `${e.runs}W` : 'W';
      case 'wide':   return e.extraRuns ? `W+${e.extraRuns}` : 'Wd';
      case 'noball': return e.runs ? `N+${e.runs}` : 'Nb';
      case 'bye':    return `B${e.runs}`;
      case 'legbye': return `L${e.runs}`;
      default:       return '?';
    }
  }

  function determineResult(match) {
    const i1 = match.innings1;
    const i2 = match.innings2;
    if (!i1 || !i2 || !i1.isComplete || !i2.isComplete) return null;

    if (i1.runs > i2.runs) {
      const margin = i1.runs - i2.runs;
      return { winner: i1.battingTeam, loser: i2.battingTeam, margin, type: 'runs',
        text: `${i1.battingTeam} won by ${margin} run${margin !== 1 ? 's' : ''}` };
    } else if (i2.runs > i1.runs) {
      const wktsLeft = 10 - i2.wickets;
      return { winner: i2.battingTeam, loser: i1.battingTeam, margin: wktsLeft, type: 'wickets',
        text: `${i2.battingTeam} won by ${wktsLeft} wicket${wktsLeft !== 1 ? 's' : ''}` };
    } else {
      return { winner: null, type: 'tie', text: 'Match Tied!' };
    }
  }

  function determineSuperOverResult(match) {
    const so1 = match.superOver1;
    const so2 = match.superOver2;
    if (!so1 || !so2 || !so1.isComplete || !so2.isComplete) return null;

    if (so1.runs > so2.runs) {
      return { winner: so1.battingTeam, type: 'superover', text: `${so1.battingTeam} won the Super Over!` };
    } else if (so2.runs > so1.runs) {
      return { winner: so2.battingTeam, type: 'superover', text: `${so2.battingTeam} won the Super Over!` };
    } else {
      return { winner: null, type: 'supertie', text: 'Super Over also Tied!' };
    }
  }

  return {
    createInnings, applyEvent, undoLastEvent,
    getRunRate, formatOvers, getRequiredRunRate,
    getOverSummary, getEventLabel,
    determineResult, determineSuperOverResult
  };
})();
