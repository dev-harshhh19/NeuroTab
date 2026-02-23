import { formatTimerDisplay } from '../utils/helpers.js';

// Motivational quotes
const QUOTES = [
  { text: "Focus is saying no to a hundred good ideas.", author: "Steve Jobs" },
  { text: "The successful warrior is the average man, with laser-like focus.", author: "Bruce Lee" },
  { text: "Concentrate all your thoughts upon the work at hand.", author: "Alexander Graham Bell" },
  { text: "Where focus goes, energy flows.", author: "Tony Robbins" },
  { text: "It is during our darkest moments that we must focus to see the light.", author: "Aristotle" },
  { text: "The key to success is to focus on goals, not obstacles.", author: "Unknown" },
  { text: "Starve your distractions, feed your focus.", author: "Unknown" },
  { text: "Your focus determines your reality.", author: "George Lucas" }
];

// Get URL parameters
const params = new URLSearchParams(window.location.search);
const reason = params.get('reason');
const domain = params.get('domain');

// DOM elements
const domainName = document.getElementById('domainName');
const reasonText = document.getElementById('reasonText');
const infoSection = document.getElementById('infoSection');
const focusProgress = document.getElementById('focusProgress');
const progressFill = document.getElementById('progressFill');
const progressTime = document.getElementById('progressTime');
const goBackBtn = document.getElementById('goBackBtn');
const quoteText = document.getElementById('quoteText');
const quoteAuthor = document.getElementById('quoteAuthor');

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  // Set domain
  domainName.textContent = domain || 'Unknown site';

  // Set reason text and info based on block reason
  setReasonContent(reason);

  // Set random quote
  setRandomQuote();

  // Load focus session if active
  await loadFocusSession();

  // Setup go back button
  goBackBtn.addEventListener('click', () => {
    history.back();
  });
});

function setReasonContent(reason) {
  switch (reason) {
    case 'productivity':
      reasonText.textContent = "You're in Focus Mode. This site is blocked to help you stay productive.";
      infoSection.innerHTML = `
        <div class="info-row">
          <span class="info-label">Block reason</span>
          <span class="info-value highlight">Focus Mode Active</span>
        </div>
      `;
      break;

    case 'time_limit':
      reasonText.textContent = "You've reached your daily limit for this site.";
      infoSection.innerHTML = `
        <div class="info-row">
          <span class="info-label">Block reason</span>
          <span class="info-value">Daily limit reached</span>
        </div>
        <div class="info-row" style="margin-top: 12px;">
          <span class="info-label">Access resumes</span>
          <span class="info-value highlight">Tomorrow</span>
        </div>
      `;
      break;

    default:
      reasonText.textContent = "This site is currently blocked to help you stay focused.";
      infoSection.innerHTML = `
        <div class="info-row">
          <span class="info-label">Status</span>
          <span class="info-value">Blocked</span>
        </div>
      `;
  }
}

function setRandomQuote() {
  const quote = QUOTES[Math.floor(Math.random() * QUOTES.length)];
  quoteText.textContent = `"${quote.text}"`;
  quoteAuthor.textContent = `— ${quote.author}`;
}

async function loadFocusSession() {
  try {
    const status = await chrome.runtime.sendMessage({ action: 'getStatus' });

    if (status.activeSession) {
      focusProgress.classList.remove('hidden');
      updateFocusProgress(status.activeSession);

      // Update every second
      setInterval(async () => {
        const newStatus = await chrome.runtime.sendMessage({ action: 'getStatus' });
        if (newStatus.activeSession) {
          updateFocusProgress(newStatus.activeSession);
        }
      }, 1000);
    }
  } catch (error) {
    console.error('Error loading focus session:', error);
  }
}

function updateFocusProgress(session) {
  const elapsed = (Date.now() - session.startTime) / 1000;
  const remaining = Math.max(0, session.duration - elapsed);
  const progress = (elapsed / session.duration) * 100;

  progressTime.textContent = formatTimerDisplay(remaining);
  progressFill.style.width = `${Math.min(100, progress)}%`;
}
