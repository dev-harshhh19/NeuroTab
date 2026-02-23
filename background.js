import { storage } from './storage.js';
import { MODES, CATEGORIES, IDLE_THRESHOLD } from './utils/constants.js';
import { extractDomain, isTrackableUrl, generateId, getTodayKey, calculateFocusScore } from './utils/helpers.js';

// ============ STATE ============
let currentTabId = null;
let currentDomain = null;
let trackingStartTime = null;
let isWindowFocused = true;
let isIdle = false;
let focusSessionInterval = null;
let activeExamTabId = null;
let activeExamUrl = null;

// ============ INITIALIZATION ============

chrome.runtime.onInstalled.addListener(async () => {
  console.log('NeuroTabinstalled');
  await storage.initialize();
});

chrome.runtime.onStartup.addListener(async () => {
  console.log('NeuroTabstartup');
  await storage.initialize();
  await startTracking();
});

// Initialize on service worker start
(async () => {
  await storage.initialize();

  const activeExam = await storage.getActiveExamSession();
  if (activeExam) {
    activeExamTabId = activeExam.tabId;
    activeExamUrl = activeExam.url;
  }

  await startTracking();
})();

// ============ TIME TRACKING ============

async function startTracking() {
  // Get current active tab
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tabs[0]) {
    await handleTabChange(tabs[0].id, tabs[0].url);
  }
}

async function handleTabChange(tabId, url) {
  // Save time for previous tab
  await saveCurrentTime();

  // Update to new tab
  currentTabId = tabId;

  if (url && isTrackableUrl(url)) {
    currentDomain = extractDomain(url);
    trackingStartTime = Date.now();

    // Increment visit count
    await storage.incrementVisit(currentDomain);

    // Check if site should be blocked
    await checkAndBlockIfNeeded(tabId, currentDomain);
  } else {
    currentDomain = null;
    trackingStartTime = null;
  }
}

async function saveCurrentTime() {
  if (currentDomain && trackingStartTime && isWindowFocused && !isIdle) {
    const elapsed = (Date.now() - trackingStartTime) / 1000; // seconds

    if (elapsed > 0.5) { // Only save if more than 0.5 seconds
      await storage.updateWebsiteTime(currentDomain, elapsed);

      // Check time limits after updating
      await checkTimeLimits(currentDomain);
    }

    trackingStartTime = Date.now();
  }
}

// Periodic time saving
setInterval(async () => {
  if (isWindowFocused && !isIdle) {
    await saveCurrentTime();
  }

  // Every interval, also ensure the streak is evaluated correctly for today
  await storage.evaluateStreak();
}, 5000); // Every 5 seconds

// ============ TAB EVENTS ============

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const mode = await storage.getCurrentMode();
    if (mode === MODES.EXAM && activeExamTabId) {
      if (activeInfo.tabId !== activeExamTabId) {
        chrome.tabs.update(activeExamTabId, { active: true });
        logExamViolation('tab_switch');
        return;
      }
    }

    const tab = await chrome.tabs.get(activeInfo.tabId);
    await handleTabChange(activeInfo.tabId, tab.url);
  } catch (error) {
    console.error('Error handling tab activation:', error);
  }
});

chrome.tabs.onCreated.addListener(async (tab) => {
  const mode = await storage.getCurrentMode();
  if (mode === MODES.EXAM && activeExamTabId) {
    chrome.tabs.remove(tab.id);
    logExamViolation('new_tab');
  }
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  const mode = await storage.getCurrentMode();
  if (mode === MODES.EXAM && activeExamTabId) {
    if (tabId === activeExamTabId && changeInfo.url && activeExamUrl) {
      if (changeInfo.url.split('#')[0] !== activeExamUrl.split('#')[0]) {
        chrome.tabs.update(tabId, { url: activeExamUrl });
        logExamViolation('navigation');
        return;
      }
    }
  }

  if (tabId === currentTabId && changeInfo.url) {
    await handleTabChange(tabId, changeInfo.url);
  }
});

// ============ WINDOW FOCUS ============

chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    // Browser lost focus
    await saveCurrentTime();
    isWindowFocused = false;
    trackingStartTime = null;
  } else {
    // Browser gained focus
    isWindowFocused = true;
    trackingStartTime = Date.now();

    // Re-check current tab
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs[0]) {
      currentTabId = tabs[0].id;
      if (tabs[0].url && isTrackableUrl(tabs[0].url)) {
        currentDomain = extractDomain(tabs[0].url);
      }
    }
  }
});

// ============ IDLE DETECTION ============

chrome.idle.setDetectionInterval(IDLE_THRESHOLD);

chrome.idle.onStateChanged.addListener(async (state) => {
  if (state === 'idle' || state === 'locked') {
    await saveCurrentTime();
    isIdle = true;
    trackingStartTime = null;
  } else if (state === 'active') {
    isIdle = false;
    trackingStartTime = Date.now();
  }
});

// ============ BLOCKING LOGIC ============

async function checkAndBlockIfNeeded(tabId, domain) {
  const mode = await storage.getCurrentMode();
  const rule = await storage.getRuleForSite(domain);

  // Productivity Mode: Block all restricted sites
  if (mode === MODES.PRODUCTIVITY && rule.blocked) {
    await blockTab(tabId, 'productivity', domain);
    await logDistraction(domain, 'productivity_block');
    return;
  }

  // Normal Mode: Check time limits
  if (mode === MODES.NORMAL && rule.dailyLimit) {
    const timeSpent = await storage.getTodayTimeForSite(domain);

    if (timeSpent >= rule.dailyLimit) {
      await blockTab(tabId, 'time_limit', domain);
      return;
    }
  }
}

async function checkTimeLimits(domain) {
  const mode = await storage.getCurrentMode();
  if (mode !== MODES.NORMAL) return;

  const rule = await storage.getRuleForSite(domain);
  if (!rule.dailyLimit) return;

  const timeSpent = await storage.getTodayTimeForSite(domain);

  // Block if limit reached
  if (timeSpent >= rule.dailyLimit && currentTabId) {
    await blockTab(currentTabId, 'time_limit', domain);
  }
}

async function blockTab(tabId, reason, domain) {
  const blockUrl = chrome.runtime.getURL('blocked/blocked.html') +
    `?reason=${reason}&domain=${encodeURIComponent(domain)}`;

  try {
    await chrome.tabs.update(tabId, { url: blockUrl });
  } catch (error) {
    console.error('Error blocking tab:', error);
  }
}

async function logDistraction(domain, type) {
  const activeSession = await storage.getActiveFocusSession();

  const distraction = {
    domain,
    type,
    sessionId: activeSession?.id || null
  };

  await storage.logDistraction(distraction);

  // Update focus session distraction count
  if (activeSession) {
    activeSession.distractions = (activeSession.distractions || 0) + 1;
    await storage.setActiveFocusSession(activeSession);
  }
}

// ============ FOCUS SESSIONS ============

async function startFocusSession(duration) {
  // End any active exam session first
  const activeExam = await storage.getActiveExamSession();
  if (activeExam) {
    await endExamSession(false);
  }

  const session = {
    id: generateId(),
    startTime: Date.now(),
    duration: duration * 60, // Convert to seconds
    distractions: 0,
    completed: false
  };

  await storage.setActiveFocusSession(session);
  await storage.setMode(MODES.PRODUCTIVITY);

  // Set alarm for session end
  chrome.alarms.create('focusSessionEnd', { delayInMinutes: duration });

  return session;
}

async function endFocusSession(completed = false) {
  const session = await storage.getActiveFocusSession();

  if (session) {
    const actualDuration = (Date.now() - session.startTime) / 1000;

    const completedSession = {
      ...session,
      endTime: Date.now(),
      actualDuration,
      completed,
      score: calculateFocusScore(actualDuration, session.distractions)
    };

    await storage.addFocusSession(completedSession);
    await storage.clearActiveFocusSession();
  }

  await storage.setMode(MODES.NORMAL);
  chrome.alarms.clear('focusSessionEnd');
}

// ============ EXAM SESSIONS ============

async function startExamSession(duration, tabId) {
  // End any active focus session first
  const activeFocus = await storage.getActiveFocusSession();
  if (activeFocus) {
    await endFocusSession(false);
  }

  const tab = await chrome.tabs.get(tabId);

  const session = {
    id: generateId(),
    startTime: Date.now(),
    duration: duration * 60,
    tabId: tabId,
    url: tab.url,
    violations: 0
  };

  await storage.setActiveExamSession(session);
  await storage.setMode(MODES.EXAM);
  activeExamTabId = tabId;
  activeExamUrl = tab.url;

  try {
    await chrome.scripting.insertCSS({
      target: { tabId: tabId },
      files: ['content_scripts/exam_content.css']
    });
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['content_scripts/exam_content.js']
    });
  } catch (e) {
    console.error("Failed to inject exam scripts", e);
  }

  chrome.alarms.create('examSessionEnd', { delayInMinutes: duration });
  return session;
}

async function endExamSession(completed = false) {
  const session = await storage.getActiveExamSession();
  if (session) {
    await storage.clearActiveExamSession();

    try {
      chrome.tabs.sendMessage(session.tabId, { action: 'endExam' });
    } catch (e) {
      console.error("Failed to notify content script", e);
    }
  }

  activeExamTabId = null;
  activeExamUrl = null;
  await storage.setMode(MODES.NORMAL);
  chrome.alarms.clear('examSessionEnd');
}

async function logExamViolation(type) {
  const session = await storage.getActiveExamSession();
  if (session) {
    session.violations = (session.violations || 0) + 1;
    await storage.setActiveExamSession(session);

    try {
      chrome.tabs.sendMessage(session.tabId, { action: 'examViolation', type: type });
    } catch (e) {
      console.error("Failed to send violation warning", e);
    }
  }
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'focusSessionEnd') {
    await endFocusSession(true);

    // Notify user
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: 'Focus Session Complete! 🎉',
      message: 'Great job staying focused! Take a break before your next session.'
    });
  } else if (alarm.name === 'examSessionEnd') {
    await endExamSession(true);

    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: 'Exam Complete! 🎓',
      message: 'Your exam time is up. The browser is now unlocked.'
    });
  }
});

// ============ MESSAGE HANDLING ============

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Security check: Only accept messages from our own extension
  if (sender.id !== chrome.runtime.id) {
    console.warn('Blocked message from untrusted sender:', sender);
    return false;
  }

  handleMessage(message).then(sendResponse);
  return true; // Keep channel open for async response
});

async function handleMessage(message) {
  switch (message.action) {
    case 'getStatus':
      return await getFullStatus();

    case 'setMode':
      if (message.mode === MODES.NORMAL) {
        if (await storage.getActiveFocusSession()) await endFocusSession(false);
        if (await storage.getActiveExamSession()) await endExamSession(false);
      } else if (message.mode === MODES.PRODUCTIVITY) {
        if (await storage.getActiveExamSession()) await endExamSession(false);
      } else if (message.mode === MODES.EXAM) {
        if (await storage.getActiveFocusSession()) await endFocusSession(false);
      }

      await storage.setMode(message.mode);
      if (message.mode === MODES.PRODUCTIVITY && currentTabId && currentDomain) {
        await checkAndBlockIfNeeded(currentTabId, currentDomain);
      }
      return { success: true };

    case 'startFocusSession':
      return await startFocusSession(message.duration);

    case 'endFocusSession':
      await endFocusSession(false);
      return { success: true };

    case 'startExamSession':
      return await startExamSession(message.duration, message.tabId);

    case 'endExamSession':
      await endExamSession(false);
      return { success: true };

    case 'logExamViolationContent':
      await logExamViolation(message.type);
      return { success: true };

    case 'getTodayStats':
      return await storage.getTodayStats();

    case 'getWebsiteRules':
      return await storage.getWebsiteRules();

    case 'addWebsiteRule':
      await storage.addWebsiteRule(message.domain, message.rule);
      return { success: true };

    case 'removeWebsiteRule':
      await storage.removeWebsiteRule(message.domain);
      return { success: true };

    case 'getFocusSessions':
      return await storage.getFocusSessions();

    case 'getDistractionLog':
      return await storage.getDistractionLog(message.limit || 100);

    case 'getWebsiteData':
      return await storage.getWebsiteData();

    case 'getStreakData':
      return await storage.getStreakData();

    default:
      return { error: 'Unknown action' };
  }
}

async function getFullStatus() {
  const mode = await storage.getCurrentMode();
  const activeSession = await storage.getActiveFocusSession();
  const todayStats = await storage.getTodayStats();

  // Calculate today's totals
  let totalTime = 0;
  let productiveTime = 0;
  let distractingTime = 0;

  const rules = await storage.getWebsiteRules();

  for (const [domain, data] of Object.entries(todayStats)) {
    totalTime += data.totalTime;

    const rule = rules[domain];
    if (rule) {
      if (rule.category === CATEGORIES.PRODUCTIVE) {
        productiveTime += data.totalTime;
      } else if (rule.category === CATEGORIES.DISTRACTING) {
        distractingTime += data.totalTime;
      }
    }
  }

  // Get current site info
  let currentSiteInfo = null;
  if (currentDomain) {
    const timeSpent = await storage.getTodayTimeForSite(currentDomain);
    const rule = await storage.getRuleForSite(currentDomain);

    currentSiteInfo = {
      domain: currentDomain,
      timeSpent,
      category: rule.category,
      dailyLimit: rule.dailyLimit
    };
  }

  return {
    mode,
    activeSession,
    activeExamSession: await storage.getActiveExamSession(),
    currentSite: currentSiteInfo,
    today: {
      totalTime,
      productiveTime,
      distractingTime
    }
  };
}
