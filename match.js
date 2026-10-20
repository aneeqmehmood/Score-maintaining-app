// ============================================================
// MATCH STATE MANAGEMENT
// ============================================================

const MatchManager = (() => {

  function generateId() {
    return 'match_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  function createMatch({ title, teamA, teamB, date, venue, overs }) {
    return {
      id: generateId(),
      title: title || `Match #${Date.now()}`,
      teamA,
      teamB,
      date: date || new Date().toISOString(),
      venue: venue || '',
      overs: overs || 0,  // 0 = unlimited
      status: 'setup',    // setup | innings1 | innings2 | superOver1 | superOver2 | completed | abandoned
      innings1: null,
      innings2: null,
      superOver1: null,
      superOver2: null,
      result: null,
      superOverResult: null,
      createdAt: new Date().toISOString()
    };
  }

  function startInnings1(match) {
    match.innings1 = ScoringLogic.createInnings(match.teamA);
    match.status = 'innings1';
    return match;
  }

  function startInnings2(match) {
    if (!match.innings1 || !match.innings1.isComplete) {
      throw new Error('Innings 1 must be completed first');
    }
    match.innings2 = ScoringLogic.createInnings(match.teamB);
    match.status = 'innings2';
    return match;
  }

  function startSuperOver1(match) {
    const result = ScoringLogic.determineResult(match);
    if (!result || result.type !== 'tie') {
      throw new Error('Super Over only available on a tie');
    }
    // Team that batted second in main innings bats first in super over
    match.superOver1 = ScoringLogic.createInnings(match.teamB);
    match.status = 'superOver1';
    return match;
  }

  function startSuperOver2(match) {
    if (!match.superOver1 || !match.superOver1.isComplete) {
      throw new Error('Super Over 1 must be completed first');
    }
    match.superOver2 = ScoringLogic.createInnings(match.teamA);
    match.status = 'superOver2';
    return match;
  }

  function recordBall(match, event) {
    let innings = getCurrentInnings(match);
    if (!innings) return match;

    const result = ScoringLogic.applyEvent(innings, event);

    // Check win by target chase
    if (match.status === 'innings2' && match.innings1) {
      const target = match.innings1.runs + 1;
      if (innings.runs >= target) {
        innings.isComplete = true;
        innings.endReason = 'target';
      }
    }
    if (match.status === 'superOver2' && match.superOver1) {
      const target = match.superOver1.runs + 1;
      if (innings.runs >= target) {
        innings.isComplete = true;
        innings.endReason = 'target';
      }
    }

    // Check all out
    if (innings.wickets >= 10) {
      innings.isComplete = true;
      innings.endReason = 'allOut';
    }

    // Check overs complete
    if (match.overs > 0) {
      if (innings.balls >= match.overs * 6) {
        innings.isComplete = true;
        innings.endReason = 'oversComplete';
      }
    }
    // Super over: always 1 over (6 balls)
    if (['superOver1', 'superOver2'].includes(match.status)) {
      if (innings.balls >= 6) {
        innings.isComplete = true;
        innings.endReason = 'oversComplete';
      }
    }

    if (innings.isComplete) {
      onInningsComplete(match);
    }

    Storage.saveMatch(match);
    return match;
  }

  function undoBall(match) {
    let innings = getCurrentInnings(match);
    if (!innings || innings.events.length === 0) return match;
    ScoringLogic.undoLastEvent(innings);
    innings.isComplete = false;
    innings.endReason = null;
    Storage.saveMatch(match);
    return match;
  }

  function endInningsManually(match) {
    let innings = getCurrentInnings(match);
    if (!innings) return match;
    innings.isComplete = true;
    innings.endReason = 'manual';
    onInningsComplete(match);
    Storage.saveMatch(match);
    return match;
  }

  function onInningsComplete(match) {
    if (match.status === 'innings1') {
      // stay in innings1 completed state, wait for user to start innings2
    } else if (match.status === 'innings2') {
      const result = ScoringLogic.determineResult(match);
      match.result = result;
      if (result && result.type !== 'tie') {
        match.status = 'completed';
      }
      // If tie, status stays 'innings2' until super over or declared completed
    } else if (match.status === 'superOver1') {
      // wait for super over 2
    } else if (match.status === 'superOver2') {
      const soResult = ScoringLogic.determineSuperOverResult(match);
      match.superOverResult = soResult;
      match.status = 'completed';
    }
  }

  function completeMatch(match, reason = 'completed') {
    match.status = reason === 'abandoned' ? 'abandoned' : 'completed';
    if (match.innings1 && match.innings2) {
      match.result = ScoringLogic.determineResult(match);
    }
    Storage.saveMatch(match);
    return match;
  }

  function getCurrentInnings(match) {
    switch (match.status) {
      case 'innings1': return match.innings1;
      case 'innings2': return match.innings2;
      case 'superOver1': return match.superOver1;
      case 'superOver2': return match.superOver2;
      default: return null;
    }
  }

  function getTarget(match) {
    if (match.status === 'innings2' && match.innings1) {
      return match.innings1.runs + 1;
    }
    if (match.status === 'superOver2' && match.superOver1) {
      return match.superOver1.runs + 1;
    }
    return null;
  }

  function exportToJSON(match) {
    const data = JSON.stringify(match, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${match.title.replace(/\s+/g, '_')}_scorecard.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return {
    createMatch,
    startInnings1,
    startInnings2,
    startSuperOver1,
    startSuperOver2,
    recordBall,
    undoBall,
    endInningsManually,
    getCurrentInnings,
    getTarget,
    completeMatch,
    exportToJSON
  };
})();
