import { CATEGORIES, DEFAULT_TIME_LIMITS } from '../utils/constants.js';
import { escapeHtml, isValidDomain } from '../utils/helpers.js';

// ============ DOM ELEMENTS ============
const elements = {
  backBtn: document.getElementById('backBtn'),
  addSiteForm: document.getElementById('addSiteForm'),
  siteInput: document.getElementById('siteInput'),
  distractingSites: document.getElementById('distractingSites'),
  timeLimitWarnings: document.getElementById('timeLimitWarnings'),
  focusReminders: document.getElementById('focusReminders')
};

// ============ INITIALIZATION ============
document.addEventListener('DOMContentLoaded', async () => {
  await loadDistractingSites();
  setupEventListeners();
});

// ============ LOAD DATA ============
async function loadDistractingSites() {
  try {
    const rules = await chrome.runtime.sendMessage({ action: 'getWebsiteRules' });

    const distractingSites = Object.entries(rules)
      .filter(([_, rule]) => rule.category === CATEGORIES.DISTRACTING)
      .map(([domain]) => domain);

    renderSiteChips(distractingSites);
  } catch (error) {
    console.error('Error loading sites:', error);
  }
}

function renderSiteChips(sites) {
  elements.distractingSites.innerHTML = sites.map(site => `
    <div class="site-chip" data-domain="${escapeHtml(site)}">
      <span>${escapeHtml(site)}</span>
      <button class="chip-remove" data-domain="${escapeHtml(site)}">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
  `).join('');

  // Add remove handlers
  document.querySelectorAll('.chip-remove').forEach(btn => {
    btn.addEventListener('click', async () => {
      const domain = btn.dataset.domain;
      await chrome.runtime.sendMessage({ action: 'removeWebsiteRule', domain });
      await loadDistractingSites();
    });
  });
}

// ============ EVENT LISTENERS ============
function setupEventListeners() {
  // Back button
  elements.backBtn.addEventListener('click', () => {
    window.close();
  });

  // Add site form
  elements.addSiteForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const domain = elements.siteInput.value.trim().toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .split('/')[0];

    if (!isValidDomain(domain)) {
      alert("Please enter a valid domain name");
      return;
    }

    if (!domain) return;

    const rule = {
      category: CATEGORIES.DISTRACTING,
      dailyLimit: DEFAULT_TIME_LIMITS.distracting * 60,
      blocked: true,
      cooldown: DEFAULT_TIME_LIMITS.cooldown * 60
    };

    await chrome.runtime.sendMessage({ action: 'addWebsiteRule', domain, rule });
    elements.siteInput.value = '';
    await loadDistractingSites();
  });

  // Time limit buttons
  document.querySelectorAll('.limit-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.limit-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      // Could save to settings here
    });
  });

  // Focus duration buttons
  document.querySelectorAll('.focus-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.focus-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      // Could save to settings here
    });
  });
}
