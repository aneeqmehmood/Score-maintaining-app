// ============================================================
// LOCAL STORAGE UTILITY
// ============================================================

const Storage = (() => {
  const MATCHES_KEY = 'cricket_matches';
  const CURRENT_MATCH_KEY = 'cricket_current_match';
  const SETTINGS_KEY = 'cricket_settings';

  function saveMatches(matches) {
    try {
      localStorage.setItem(MATCHES_KEY, JSON.stringify(matches));
    } catch (e) {
      console.error('Storage save error:', e);
    }
  }

  function loadMatches() {
    try {
      const data = localStorage.getItem(MATCHES_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  }

  function saveMatch(match) {
    const matches = loadMatches();
    const idx = matches.findIndex(m => m.id === match.id);
    if (idx >= 0) {
      matches[idx] = match;
    } else {
      matches.unshift(match);
    }
    saveMatches(matches);
  }

  function getMatch(id) {
    const matches = loadMatches();
    return matches.find(m => m.id === id) || null;
  }

  function deleteMatch(id) {
    const matches = loadMatches().filter(m => m.id !== id);
    saveMatches(matches);
  }

  function clearAll() {
    localStorage.removeItem(MATCHES_KEY);
    localStorage.removeItem(CURRENT_MATCH_KEY);
  }

  function saveCurrentMatchId(id) {
    localStorage.setItem(CURRENT_MATCH_KEY, id || '');
  }

  function loadCurrentMatchId() {
    return localStorage.getItem(CURRENT_MATCH_KEY) || null;
  }

  function saveSettings(settings) {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }

  function loadSettings() {
    try {
      const data = localStorage.getItem(SETTINGS_KEY);
      return data ? JSON.parse(data) : { darkMode: false };
    } catch (e) {
      return { darkMode: false };
    }
  }

  return {
    saveMatches,
    loadMatches,
    saveMatch,
    getMatch,
    deleteMatch,
    clearAll,
    saveCurrentMatchId,
    loadCurrentMatchId,
    saveSettings,
    loadSettings
  };
})();
