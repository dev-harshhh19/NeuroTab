import { formatTime, formatTimerDisplay } from '../utils/helpers.js';
import { MODES, CATEGORIES } from '../utils/constants.js';

// ============ DOM ELEMENTS ============
const elements = {
  modeToggle: document.getElementById('modeToggle'),
  siteFavicon: document.getElementById('siteFavicon'),
  siteDomain: document.getElementById('siteDomain'),
  siteCategory: document.getElementById('siteCategory'),
  siteTime: document.getElementById('siteTime'),

  focusInactive: document.getElementById('focusInactive'),
  focusActive: document.getElementById('focusActive'),
  startFocusBtn: document.getElementById('startFocusBtn'),
  endFocusBtn: document.getElementById('endFocusBtn'),
  timerTime: document.getElementById('timerTime'),
  timerProgress: document.getElementById('timerProgress'),
  distractionCount: document.getElementById('distractionCount'),

  productiveTime: document.getElementById('productiveTime'),
  totalTime: document.getElementById('totalTime'),
  distractingTime: document.getElementById('distractingTime'),

  examSection: document.getElementById('examSection'),
  examInactive: document.getElementById('examInactive'),
  examActive: document.getElementById('examActive'),
  startExamBtn: document.getElementById('startExamBtn'),
  endExamBtn: document.getElementById('endExamBtn'),
  examTimerTime: document.getElementById('examTimerTime'),
  examTimerProgress: document.getElementById('examTimerProgress'),
  examTabSelect: document.getElementById('examTabSelect'),

  settingsBtn: document.getElementById('settingsBtn'),
  dashboardBtn: document.getElementById('dashboardBtn')
};

// ============ STATE ============
let selectedDuration = 25;
let selectedExamDuration = 60;
let updateInterval = null;

// ============ INITIALIZATION ============
document.addEventListener('DOMContentLoaded', async () => {
  await loadStatus();
  await loadTabsForExam();
  setupEventListeners();
  startUpdateLoop();
});

async function loadTabsForExam() {
  const tabs = await chrome.tabs.query({ windowType: 'normal' });
  const select = elements.examTabSelect;
  select.innerHTML = '<option value="">Select a tab to lock...</option>';

  let validTabsCount = 0;
  tabs.forEach(tab => {
    if (tab.url && tab.url.startsWith('http')) {
      validTabsCount++;
      const option = document.createElement('option');
      option.value = tab.id;
      option.textContent = tab.title.length > 50 ? tab.title.substring(0, 50) + '...' : tab.title;
      select.appendChild(option);
    }
  });

  if (validTabsCount === 0) {
    select.innerHTML = '<option value="">No valid web pages open (cannot lock system pages)</option>';
    elements.startExamBtn.disabled = true;
    elements.startExamBtn.style.opacity = '0.5';
  }
}

async function loadStatus() {
  try {
    const status = await chrome.runtime.sendMessage({ action: 'getStatus' });
    const streakData = await chrome.runtime.sendMessage({ action: 'getStreakData' });

    document.getElementById('streakValue').textContent = streakData.currentStreak || 0;

    updateUI(status);
  } catch (error) {
    console.error('Error loading status:', error);
  }
}

function startUpdateLoop() {
  // Update every second for live timer
  updateInterval = setInterval(async () => {
    await loadStatus();
  }, 1000);
}

// ============ UI UPDATE ============
function updateUI(status) {
  // Update mode toggle
  updateModeUI(status.mode);

  if (status.mode === MODES.EXAM) {
    document.getElementById('currentSiteCard').classList.add('hidden');
    document.getElementById('focusSection').classList.add('hidden');
    document.querySelector('.summary-section').classList.add('hidden');
    elements.examSection.classList.remove('hidden');

    updateExamUI(status.activeExamSession);
  } else if (status.mode === MODES.PRODUCTIVITY) {
    document.getElementById('currentSiteCard').classList.remove('hidden');
    document.getElementById('focusSection').classList.remove('hidden');
    document.querySelector('.summary-section').classList.remove('hidden');
    elements.examSection.classList.add('hidden');

    updateCurrentSiteUI(status.currentSite);
    updateFocusUI(status.activeSession);
    updateStatsUI(status.today);
  } else {
    // MODES.NORMAL
    document.getElementById('currentSiteCard').classList.remove('hidden');
    document.getElementById('focusSection').classList.add('hidden');
    document.querySelector('.summary-section').classList.remove('hidden');
    elements.examSection.classList.add('hidden');

    updateCurrentSiteUI(status.currentSite);
    updateStatsUI(status.today);
  }
}

function updateExamUI(activeExamSession) {
  if (activeExamSession) {
    elements.examInactive.classList.add('hidden');
    elements.examActive.classList.remove('hidden');

    const elapsed = (Date.now() - activeExamSession.startTime) / 1000;
    const remaining = Math.max(0, activeExamSession.duration - elapsed);

    elements.examTimerTime.textContent = formatTimerDisplay(remaining);

    // Update progress ring
    if (elements.examTimerProgress) {
      const progress = elapsed / activeExamSession.duration;
      const circumference = 2 * Math.PI * 45; // radius = 45
      const offset = circumference * (1 - progress);
      elements.examTimerProgress.style.strokeDasharray = circumference;
      elements.examTimerProgress.style.strokeDashoffset = Math.max(0, offset);
    }

  } else {
    elements.examInactive.classList.remove('hidden');
    elements.examActive.classList.add('hidden');
  }
}

function updateModeUI(mode) {
  const modeToggle = elements.modeToggle;
  const buttons = modeToggle.querySelectorAll('.mode-btn');

  buttons.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === mode);
  });

  modeToggle.dataset.mode = mode;
}

function updateCurrentSiteUI(currentSite) {
  if (currentSite) {
    elements.siteDomain.textContent = currentSite.domain;
    elements.siteCategory.textContent = currentSite.category;
    elements.siteCategory.className = `site-category ${currentSite.category}`;
    elements.siteTime.textContent = formatTime(currentSite.timeSpent);

    // Set favicon
    const faviconUrl = `https://www.google.com/s2/favicons?domain=${currentSite.domain}&sz=64`;
    elements.siteFavicon.src = faviconUrl;
    elements.siteFavicon.style.display = 'block';
    elements.siteFavicon.onerror = () => {
      elements.siteFavicon.style.display = 'none';
      elements.siteFavicon.src = '';
    };
  } else {
    elements.siteDomain.textContent = 'No active site';
    elements.siteCategory.textContent = '—';
    elements.siteCategory.className = 'site-category';
    elements.siteTime.textContent = '0m';
    elements.siteFavicon.style.display = 'none';
    elements.siteFavicon.src = '';
  }
}

function updateFocusUI(activeSession) {
  if (activeSession) {
    elements.focusInactive.classList.add('hidden');
    elements.focusActive.classList.remove('hidden');

    // Calculate remaining time
    const elapsed = (Date.now() - activeSession.startTime) / 1000;
    const remaining = Math.max(0, activeSession.duration - elapsed);

    elements.timerTime.textContent = formatTimerDisplay(remaining);
    elements.distractionCount.textContent = activeSession.distractions || 0;

    // Update progress ring
    const progress = elapsed / activeSession.duration;
    const circumference = 2 * Math.PI * 45; // radius = 45
    const offset = circumference * (1 - progress);
    elements.timerProgress.style.strokeDasharray = circumference;
    elements.timerProgress.style.strokeDashoffset = Math.max(0, offset);
  } else {
    elements.focusInactive.classList.remove('hidden');
    elements.focusActive.classList.add('hidden');
  }
}

function updateStatsUI(today) {
  elements.productiveTime.textContent = formatTime(today.productiveTime);
  elements.totalTime.textContent = formatTime(today.totalTime);
  elements.distractingTime.textContent = formatTime(today.distractingTime);
}

// ============ EVENT LISTENERS ============
function setupEventListeners() {
  // Mode toggle
  elements.modeToggle.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const mode = btn.dataset.mode;
      await chrome.runtime.sendMessage({ action: 'setMode', mode });
      updateModeUI(mode);
    });
  });

  // Duration selector
  document.querySelectorAll('.duration-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.duration-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedDuration = parseInt(btn.dataset.duration);
    });
  });

  // Start focus session
  elements.startFocusBtn.addEventListener('click', async () => {
    await chrome.runtime.sendMessage({
      action: 'startFocusSession',
      duration: selectedDuration
    });
    await loadStatus();
  });

  // End focus session
  elements.endFocusBtn.addEventListener('click', async () => {
    await chrome.runtime.sendMessage({ action: 'endFocusSession' });
    await loadStatus();
  });

  // Exam Duration selector
  document.querySelectorAll('.exam-duration-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.exam-duration-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedExamDuration = parseInt(btn.dataset.duration);
    });
  });

  // Enable start exam button only when a tab is selected
  elements.examTabSelect.addEventListener('change', (e) => {
    elements.startExamBtn.disabled = !e.target.value;
    if (e.target.value) {
      elements.startExamBtn.style.opacity = '1';
    } else {
      elements.startExamBtn.style.opacity = '0.5';
    }
  });

  // Start Exam
  elements.startExamBtn.addEventListener('click', async () => {
    console.log("Exam start pressed!");
    const tabId = parseInt(elements.examTabSelect.value, 10);
    if (!tabId) return;

    await chrome.runtime.sendMessage({
      action: 'startExamSession',
      duration: selectedExamDuration,
      tabId: tabId
    });
    await loadStatus();
  });

  // End Exam
  elements.endExamBtn.addEventListener('click', async () => {
    if (confirm("Are you sure you want to force quit the exam? This will be logged.")) {
      await chrome.runtime.sendMessage({ action: 'endExamSession' });
      await loadStatus();
    }
  });

  // Settings button
  elements.settingsBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('settings/settings.html') });
  });

  // Dashboard button
  elements.dashboardBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('dashboard/dashboard.html') });
  });
}

// Cleanup on popup close
window.addEventListener('unload', () => {
  if (updateInterval) {
    clearInterval(updateInterval);
  }
});
