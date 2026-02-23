import { STORAGE_KEYS, MODES, DEFAULT_DISTRACTING_SITES, DEFAULT_PRODUCTIVE_SITES, DEFAULT_NEUTRAL_SITES, CATEGORIES, DEFAULT_TIME_LIMITS, MAX_ALLOWED_DISTRACTION_TIME } from './utils/constants.js';
import { getTodayKey, deepMerge } from './utils/helpers.js';

/**
 * Storage Manager for Chrome Storage API
 */
class StorageManager {

  /**
   * Get data from storage
   * @param {string|string[]} keys - Key(s) to retrieve
   * @returns {Promise<Object>} Stored data
   */
  async get(keys) {
    return new Promise((resolve) => {
      chrome.storage.local.get(keys, (result) => {
        resolve(result);
      });
    });
  }

  /**
   * Set data in storage
   * @param {Object} data - Data to store
   * @returns {Promise<void>}
   */
  async set(data) {
    return new Promise((resolve) => {
      chrome.storage.local.set(data, resolve);
    });
  }

  /**
   * Initialize storage with defaults
   */
  async initialize() {
    const result = await this.get([STORAGE_KEYS.SETTINGS]);

    if (!result[STORAGE_KEYS.SETTINGS]) {
      // First time setup
      await this.set({
        [STORAGE_KEYS.CURRENT_MODE]: MODES.NORMAL,
        [STORAGE_KEYS.WEBSITE_DATA]: {},
        [STORAGE_KEYS.FOCUS_SESSIONS]: [],
        [STORAGE_KEYS.ACTIVE_FOCUS_SESSION]: null,
        [STORAGE_KEYS.WEBSITE_RULES]: this.getDefaultRules(),
        [STORAGE_KEYS.SETTINGS]: {
          initialized: true,
          idleThreshold: 60,
          showNotifications: true,
          strictMode: false
        },
        [STORAGE_KEYS.DAILY_STATS]: {},
        [STORAGE_KEYS.DISTRACTION_LOG]: [],
        [STORAGE_KEYS.STREAK_DATA]: {
          currentStreak: 0,
          maxStreak: 0,
          lastEvaluateDate: null
        }
      });
    }
  }

  /**
   * Get default website rules
   */
  getDefaultRules() {
    const rules = {};

    // Add distracting sites with default time limit
    DEFAULT_DISTRACTING_SITES.forEach(site => {
      rules[site] = {
        category: CATEGORIES.DISTRACTING,
        dailyLimit: DEFAULT_TIME_LIMITS.distracting * 60, // Convert to seconds
        blocked: true, // Blocked in productivity mode
        cooldown: DEFAULT_TIME_LIMITS.cooldown * 60
      };
    });

    // Add productive sites
    DEFAULT_PRODUCTIVE_SITES.forEach(site => {
      rules[site] = {
        category: CATEGORIES.PRODUCTIVE,
        dailyLimit: null, // No limit
        blocked: false,
        cooldown: 0
      };
    });

    // Add neutral sites
    DEFAULT_NEUTRAL_SITES.forEach(site => {
      rules[site] = {
        category: CATEGORIES.NEUTRAL,
        dailyLimit: null,
        blocked: false,
        cooldown: 0
      };
    });

    return rules;
  }

  // ============ MODE MANAGEMENT ============

  async getCurrentMode() {
    const result = await this.get(STORAGE_KEYS.CURRENT_MODE);
    return result[STORAGE_KEYS.CURRENT_MODE] || MODES.NORMAL;
  }

  async setMode(mode) {
    await this.set({ [STORAGE_KEYS.CURRENT_MODE]: mode });
  }

  // ============ WEBSITE DATA ============

  async getWebsiteData() {
    const result = await this.get(STORAGE_KEYS.WEBSITE_DATA);
    return result[STORAGE_KEYS.WEBSITE_DATA] || {};
  }

  async updateWebsiteTime(domain, seconds) {
    const todayKey = getTodayKey();
    const data = await this.getWebsiteData();

    if (!data[todayKey]) {
      data[todayKey] = {};
    }

    if (!data[todayKey][domain]) {
      data[todayKey][domain] = {
        totalTime: 0,
        visits: 0,
        lastVisit: null
      };
    }

    data[todayKey][domain].totalTime += seconds;
    data[todayKey][domain].lastVisit = Date.now();

    await this.set({ [STORAGE_KEYS.WEBSITE_DATA]: data });

    return data[todayKey][domain].totalTime;
  }

  async incrementVisit(domain) {
    const todayKey = getTodayKey();
    const data = await this.getWebsiteData();

    if (!data[todayKey]) {
      data[todayKey] = {};
    }

    if (!data[todayKey][domain]) {
      data[todayKey][domain] = {
        totalTime: 0,
        visits: 0,
        lastVisit: null
      };
    }

    data[todayKey][domain].visits += 1;
    data[todayKey][domain].lastVisit = Date.now();

    await this.set({ [STORAGE_KEYS.WEBSITE_DATA]: data });
  }

  async getTodayTimeForSite(domain) {
    const todayKey = getTodayKey();
    const data = await this.getWebsiteData();

    if (data[todayKey] && data[todayKey][domain]) {
      return data[todayKey][domain].totalTime;
    }

    return 0;
  }

  async getTodayStats() {
    const todayKey = getTodayKey();
    const data = await this.getWebsiteData();
    return data[todayKey] || {};
  }

  // ============ WEBSITE RULES ============

  async getWebsiteRules() {
    const result = await this.get(STORAGE_KEYS.WEBSITE_RULES);
    return result[STORAGE_KEYS.WEBSITE_RULES] || {};
  }

  async getRuleForSite(domain) {
    const rules = await this.getWebsiteRules();

    // Check exact match
    if (rules[domain]) {
      return rules[domain];
    }

    // Check parent domain (e.g., subdomain.youtube.com -> youtube.com)
    const parts = domain.split('.');
    if (parts.length > 2) {
      const parentDomain = parts.slice(-2).join('.');
      if (rules[parentDomain]) {
        return rules[parentDomain];
      }
    }

    // Default: neutral, no restrictions
    return {
      category: CATEGORIES.NEUTRAL,
      dailyLimit: null,
      blocked: false,
      cooldown: 0
    };
  }

  async addWebsiteRule(domain, rule) {
    const rules = await this.getWebsiteRules();
    rules[domain] = rule;
    await this.set({ [STORAGE_KEYS.WEBSITE_RULES]: rules });
  }

  async removeWebsiteRule(domain) {
    const rules = await this.getWebsiteRules();
    delete rules[domain];
    await this.set({ [STORAGE_KEYS.WEBSITE_RULES]: rules });
  }

  // ============ FOCUS SESSIONS ============

  async getFocusSessions() {
    const result = await this.get(STORAGE_KEYS.FOCUS_SESSIONS);
    return result[STORAGE_KEYS.FOCUS_SESSIONS] || [];
  }

  async addFocusSession(session) {
    const sessions = await this.getFocusSessions();
    sessions.push(session);
    await this.set({ [STORAGE_KEYS.FOCUS_SESSIONS]: sessions });
  }

  async getActiveFocusSession() {
    const result = await this.get(STORAGE_KEYS.ACTIVE_FOCUS_SESSION);
    return result[STORAGE_KEYS.ACTIVE_FOCUS_SESSION];
  }

  async setActiveFocusSession(session) {
    await this.set({ [STORAGE_KEYS.ACTIVE_FOCUS_SESSION]: session });
  }

  async clearActiveFocusSession() {
    await this.set({ [STORAGE_KEYS.ACTIVE_FOCUS_SESSION]: null });
  }

  // ============ EXAM SESSIONS ============

  async getActiveExamSession() {
    const result = await this.get(STORAGE_KEYS.ACTIVE_EXAM_SESSION);
    return result[STORAGE_KEYS.ACTIVE_EXAM_SESSION];
  }

  async setActiveExamSession(session) {
    await this.set({ [STORAGE_KEYS.ACTIVE_EXAM_SESSION]: session });
  }

  async clearActiveExamSession() {
    await this.set({ [STORAGE_KEYS.ACTIVE_EXAM_SESSION]: null });
  }


  // ============ DISTRACTION LOG ============

  async logDistraction(distraction) {
    const result = await this.get(STORAGE_KEYS.DISTRACTION_LOG);
    const log = result[STORAGE_KEYS.DISTRACTION_LOG] || [];

    log.push({
      ...distraction,
      timestamp: Date.now()
    });

    // Keep only last 1000 entries
    const trimmedLog = log.slice(-1000);

    await this.set({ [STORAGE_KEYS.DISTRACTION_LOG]: trimmedLog });
  }

  async getDistractionLog(limit = 100) {
    const result = await this.get(STORAGE_KEYS.DISTRACTION_LOG);
    const log = result[STORAGE_KEYS.DISTRACTION_LOG] || [];
    return log.slice(-limit);
  }

  // ============ STREAK ============

  async getStreakData() {
    const result = await this.get(STORAGE_KEYS.STREAK_DATA);
    return result[STORAGE_KEYS.STREAK_DATA] || {
      currentStreak: 0,
      maxStreak: 0,
      lastEvaluateDate: null
    };
  }

  async setStreakData(streakData) {
    await this.set({ [STORAGE_KEYS.STREAK_DATA]: streakData });
  }

  async evaluateStreak() {
    const streakData = await this.getStreakData();
    const todayKey = getTodayKey();

    if (streakData.lastEvaluateDate === todayKey) {
      return; // Already evaluated today
    }

    if (!streakData.lastEvaluateDate) {
      streakData.lastEvaluateDate = todayKey;
      await this.setStreakData(streakData);
      return;
    }

    // Evaluate the past dates up to todayKey
    const websiteData = await this.getWebsiteData();
    const rules = await this.getWebsiteRules();

    // We expect evaluates to happen reasonably often, usually yesterday
    let evaluatingDateStr = new Date(streakData.lastEvaluateDate);
    const todayDate = new Date(todayKey);

    let streakFailed = false;

    // Check all dates since last evaluate up to today
    while (evaluatingDateStr < todayDate) {
      const evaluatingKey = evaluatingDateStr.toISOString().split('T')[0];
      const stats = websiteData[evaluatingKey];

      let distractingTime = 0;
      let productiveTime = 0;

      if (stats) {
        for (const [domain, data] of Object.entries(stats)) {
          const rule = rules[domain] || { category: CATEGORIES.NEUTRAL };
          if (rule.category === CATEGORIES.DISTRACTING) {
            distractingTime += data.totalTime;
          } else if (rule.category === CATEGORIES.PRODUCTIVE) {
            productiveTime += data.totalTime;
          }
        }
      }

      // 1. More than 1 hour (3600s) of distraction = streak broken
      if (distractingTime > MAX_ALLOWED_DISTRACTION_TIME) {
        streakFailed = true;
        break; // A single failure breaks the streak entirely
      }

      // If we passed the day safely, increment evaluating target
      evaluatingDateStr.setDate(evaluatingDateStr.getDate() + 1);

      // 2. To gain streak, must have at least 3 hours (10800s) of productive time
      if (!streakFailed) {
        if (productiveTime >= 10800) {
          streakData.currentStreak += 1;
          streakData.maxStreak = Math.max(streakData.maxStreak, streakData.currentStreak);
        } else {
          // If they didn't meet the 3 hour goal, the streak resets
          streakFailed = true;
          break;
        }
      }
    }

    if (streakFailed) {
      streakData.currentStreak = 0;
    }

    streakData.lastEvaluateDate = todayKey;
    await this.setStreakData(streakData);
  }

  // ============ SETTINGS ============

  async getSettings() {
    const result = await this.get(STORAGE_KEYS.SETTINGS);
    return result[STORAGE_KEYS.SETTINGS] || {};
  }

  async updateSettings(newSettings) {
    const currentSettings = await this.getSettings();
    const merged = deepMerge(currentSettings, newSettings);
    await this.set({ [STORAGE_KEYS.SETTINGS]: merged });
  }
}

// Export singleton instance
export const storage = new StorageManager();
