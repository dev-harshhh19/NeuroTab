import { formatTime, getTodayKey, getCurrentWeekDates, escapeHtml, isValidDomain } from '../utils/helpers.js';
import { CATEGORIES, CATEGORY_COLORS } from '../utils/constants.js';

// ============ STATE ============
let weeklyChart = null;
let distributionChart = null;

// ============ INITIALIZATION ============
document.addEventListener('DOMContentLoaded', async () => {
  setupNavigation();
  await loadAllData();
  setupEventListeners();
});

// ============ NAVIGATION ============
function setupNavigation() {
  const navItems = document.querySelectorAll('.nav-item');

  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();

      // Update active nav
      navItems.forEach(n => n.classList.remove('active'));
      item.classList.add('active');

      // Show section
      const sectionId = item.dataset.section;
      document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
      document.getElementById(sectionId).classList.add('active');
    });
  });
}

// ============ DATA LOADING ============
async function loadAllData() {
  await Promise.all([
    loadOverviewStats(),
    loadWeeklyChart(),
    loadDistributionChart(),
    loadTopSites(),
    loadWebsiteRules(),
    loadFocusSessions()
  ]);
}

async function loadOverviewStats() {
  try {
    const status = await chrome.runtime.sendMessage({ action: 'getStatus' });
    const sessions = await chrome.runtime.sendMessage({ action: 'getFocusSessions' });

    // Today's stats
    document.getElementById('todayProductiveTime').textContent = formatTimeDisplay(status.today.productiveTime);
    document.getElementById('todayDistractingTime').textContent = formatTimeDisplay(status.today.distractingTime);

    // Today's focus sessions
    const todayKey = getTodayKey();
    const todaySessions = sessions.filter(s =>
      new Date(s.startTime).toISOString().split('T')[0] === todayKey
    );
    document.getElementById('todayFocusSessions').textContent = todaySessions.length;

    // Average focus score
    const completedSessions = sessions.filter(s => s.completed && s.score);
    if (completedSessions.length > 0) {
      const avgScore = Math.round(
        completedSessions.reduce((sum, s) => sum + s.score, 0) / completedSessions.length
      );
      document.getElementById('avgFocusScore').textContent = avgScore;
    }

    // Streaks
    const streakData = await chrome.runtime.sendMessage({ action: 'getStreakData' });
    document.getElementById('streakValueDashboard').textContent = `${streakData.currentStreak || 0} Days`;
    document.getElementById('maxStreakValue').textContent = `Max: ${streakData.maxStreak || 0} Days`;

    // Setup share logic
    setupShareButton(status, streakData);

  } catch (error) {
    console.error('Error loading overview stats:', error);
  }
}

async function loadWeeklyChart() {
  try {
    const websiteData = await chrome.runtime.sendMessage({ action: 'getWebsiteData' });
    const rules = await chrome.runtime.sendMessage({ action: 'getWebsiteRules' });
    const weekDates = getCurrentWeekDates();

    const productiveData = [];
    const distractingData = [];
    const labels = [];

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    weekDates.forEach(dateKey => {
      const dayData = websiteData[dateKey] || {};
      let productive = 0;
      let distracting = 0;

      for (const [domain, data] of Object.entries(dayData)) {
        const rule = rules[domain];
        if (rule?.category === CATEGORIES.PRODUCTIVE) {
          productive += data.totalTime;
        } else if (rule?.category === CATEGORIES.DISTRACTING) {
          distracting += data.totalTime;
        }
      }

      productiveData.push(Math.round(productive / 60)); // Convert to minutes
      distractingData.push(Math.round(distracting / 60));

      const date = new Date(dateKey);
      labels.push(dayNames[date.getDay()]);
    });

    const ctx = document.getElementById('weeklyChart').getContext('2d');

    if (weeklyChart) {
      weeklyChart.destroy();
    }

    weeklyChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Productive',
            data: productiveData,
            backgroundColor: 'rgba(16, 185, 129, 0.7)',
            borderRadius: 6
          },
          {
            label: 'Distracting',
            data: distractingData,
            backgroundColor: 'rgba(239, 68, 68, 0.7)',
            borderRadius: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: '#a0a0b0',
              padding: 20,
              usePointStyle: true
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: '#6b6b7b' }
          },
          y: {
            grid: { color: 'rgba(255,255,255,0.05)' },
            ticks: {
              color: '#6b6b7b',
              callback: (value) => value + 'm'
            }
          }
        }
      }
    });
  } catch (error) {
    console.error('Error loading weekly chart:', error);
  }
}

async function loadDistributionChart() {
  try {
    const status = await chrome.runtime.sendMessage({ action: 'getStatus' });

    const { productiveTime, distractingTime, totalTime } = status.today;
    const neutralTime = Math.max(0, totalTime - productiveTime - distractingTime);

    const ctx = document.getElementById('distributionChart').getContext('2d');

    if (distributionChart) {
      distributionChart.destroy();
    }

    distributionChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Productive', 'Distracting', 'Neutral'],
        datasets: [{
          data: [
            Math.round(productiveTime / 60),
            Math.round(distractingTime / 60),
            Math.round(neutralTime / 60)
          ],
          backgroundColor: [
            CATEGORY_COLORS.productive,
            CATEGORY_COLORS.distracting,
            CATEGORY_COLORS.neutral
          ],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '70%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: '#a0a0b0',
              padding: 20,
              usePointStyle: true
            }
          }
        }
      }
    });
  } catch (error) {
    console.error('Error loading distribution chart:', error);
  }
}

async function loadTopSites() {
  try {
    const todayStats = await chrome.runtime.sendMessage({ action: 'getTodayStats' });
    const rules = await chrome.runtime.sendMessage({ action: 'getWebsiteRules' });

    const sitesList = document.getElementById('topSitesList');

    // Convert to array and sort by time
    const sites = Object.entries(todayStats)
      .map(([domain, data]) => ({
        domain,
        ...data,
        category: rules[domain]?.category || CATEGORIES.NEUTRAL
      }))
      .sort((a, b) => b.totalTime - a.totalTime)
      .slice(0, 5);

    if (sites.length === 0) {
      sitesList.innerHTML = `
        <div class="empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <p>No browsing activity today</p>
        </div>
      `;
      return;
    }

    sitesList.innerHTML = sites.map(site => `
      <div class="site-item">
        <img class="site-favicon" src="https://www.google.com/s2/favicons?domain=${escapeHtml(site.domain)}&sz=64" alt="">
        <div class="site-info">
          <div class="site-domain">${escapeHtml(site.domain)}</div>
          <div class="site-category">${site.category}</div>
        </div>
        <div class="site-time ${site.category}">${formatTime(site.totalTime)}</div>
      </div>
    `).join('');
  } catch (error) {
    console.error('Error loading top sites:', error);
  }
}

async function loadWebsiteRules() {
  try {
    const rules = await chrome.runtime.sendMessage({ action: 'getWebsiteRules' });
    const rulesList = document.getElementById('rulesList');

    const rulesArray = Object.entries(rules).sort((a, b) => a[0].localeCompare(b[0]));

    if (rulesArray.length === 0) {
      rulesList.innerHTML = `
        <div class="empty-state">
          <p>No website rules configured</p>
        </div>
      `;
      return;
    }

    rulesList.innerHTML = rulesArray.map(([domain, rule]) => `
      <div class="rule-item" data-domain="${escapeHtml(domain)}">
        <span class="rule-domain">${escapeHtml(domain)}</span>
        <span class="rule-category ${rule.category}">${rule.category}</span>
        <span class="rule-limit">${rule.dailyLimit ? Math.round(rule.dailyLimit / 60) + ' min' : 'No limit'}</span>
        <button class="rule-remove" data-domain="${escapeHtml(domain)}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
    `).join('');

    // Add remove handlers
    document.querySelectorAll('.rule-remove').forEach(btn => {
      btn.addEventListener('click', async () => {
        const domain = btn.dataset.domain;
        await chrome.runtime.sendMessage({ action: 'removeWebsiteRule', domain });
        await loadWebsiteRules();
      });
    });
  } catch (error) {
    console.error('Error loading website rules:', error);
  }
}

async function loadFocusSessions() {
  try {
    const sessions = await chrome.runtime.sendMessage({ action: 'getFocusSessions' });

    // Stats
    const completedSessions = sessions.filter(s => s.completed);
    const totalFocusTime = sessions.reduce((sum, s) => sum + (s.actualDuration || 0), 0);
    const avgScore = completedSessions.length > 0
      ? Math.round(completedSessions.reduce((sum, s) => sum + (s.score || 0), 0) / completedSessions.length)
      : '—';

    document.getElementById('totalSessions').textContent = sessions.length;
    document.getElementById('completedSessions').textContent = completedSessions.length;
    document.getElementById('totalFocusTime').textContent = formatTimeDisplay(totalFocusTime);
    document.getElementById('avgScore').textContent = avgScore;

    // Sessions list
    const sessionsList = document.getElementById('sessionsList');
    const recentSessions = sessions.slice(-10).reverse();

    if (recentSessions.length === 0) {
      sessionsList.innerHTML = `
        <div class="empty-state">
          <p>No focus sessions yet. Start your first session!</p>
        </div>
      `;
      return;
    }

    sessionsList.innerHTML = recentSessions.map(session => {
      const date = new Date(session.startTime);
      const dateStr = date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      return `
        <div class="session-item">
          <div class="session-icon ${session.completed ? 'completed' : 'incomplete'}">
            ${session.completed ? '✓' : '✗'}
          </div>
          <div class="session-info">
            <div class="session-date">${dateStr}</div>
            <div class="session-details">
              ${formatTime(session.actualDuration || session.duration)} • 
              ${session.distractions || 0} distractions
            </div>
          </div>
          <div class="session-score">
            <div class="session-score-value" style="color: ${getScoreColor(session.score)}">${session.score || '—'}</div>
            <div class="session-score-label">score</div>
          </div>
        </div>
      `;
    }).join('');
  } catch (error) {
    console.error('Error loading focus sessions:', error);
  }
}

// ============ EVENT LISTENERS ============
function setupEventListeners() {
  // Add rule form
  document.getElementById('addRuleForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const domain = document.getElementById('newDomain').value.trim().toLowerCase();
    const category = document.getElementById('newCategory').value;
    const limitMinutes = parseInt(document.getElementById('newLimit').value) || null;

    if (!isValidDomain(domain)) {
      alert("Please enter a valid domain name");
      return;
    }

    const rule = {
      category,
      dailyLimit: limitMinutes ? limitMinutes * 60 : null,
      blocked: category === CATEGORIES.DISTRACTING,
      cooldown: 15 * 60
    };

    await chrome.runtime.sendMessage({ action: 'addWebsiteRule', domain, rule });

    // Reset form
    document.getElementById('newDomain').value = '';
    document.getElementById('newLimit').value = '';

    await loadWebsiteRules();
  });

  // Export data
  document.getElementById('exportBtn').addEventListener('click', async () => {
    const data = await chrome.storage.local.get(null);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `NeuroTab-export-${getTodayKey()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  // Clear data
  document.getElementById('clearBtn').addEventListener('click', async () => {
    if (confirm('Are you sure you want to clear all data? This cannot be undone.')) {
      await chrome.storage.local.clear();
      location.reload();
    }
  });
}

// ============ HELPERS ============
function formatTimeDisplay(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

function getScoreColor(score) {
  if (!score) return '#6b6b7b';
  if (score >= 80) return '#10b981';
  if (score >= 50) return '#f59e0b';
  return '#ef4444';
}

function setupShareButton(status, streakData) {
  const shareBtn = document.getElementById('shareStatsBtn');
  if (!shareBtn) return;

  const productiveFormatted = formatTimeDisplay(status.today.productiveTime);
  const currentStreak = streakData.currentStreak || 0;

  const textToShare = `🔥 I'm on a ${currentStreak}-day focus streak using NeuroTab!\nToday: ${productiveFormatted} Productive Time. 🚀\nStay focused, stay sharp!`;

  shareBtn.addEventListener('click', async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'My NeuroTab Stats',
          text: textToShare,
        });
      } else {
        // Fallback to clipboard
        await navigator.clipboard.writeText(textToShare);
        const originalText = shareBtn.innerHTML;
        shareBtn.innerHTML = 'Copied to Clipboard!';
        setTimeout(() => {
          shareBtn.innerHTML = originalText;
        }, 2000);
      }
    } catch (err) {
      console.warn("Error sharing:", err);
    }
  });
}
