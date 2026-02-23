/**
 * Prevent XSS by escaping HTML characters
 * @param {string} unsafe - Unsafe string
 * @returns {string} Escaped safe string
 */
export function escapeHtml(unsafe) {
  if (typeof unsafe !== 'string') return unsafe;
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Validate format of a domain name
 * @param {string} domain 
 * @returns {boolean}
 */
export function isValidDomain(domain) {
  if (!domain || typeof domain !== 'string') return false;
  const regex = /^([a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/i;
  return regex.test(domain);
}

/**
 * Extract domain from URL
 * @param {string} url - Full URL
 * @returns {string} Domain without protocol or path
 */
export function extractDomain(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace('www.', '');
  } catch {
    return '';
  }
}

/**
 * Format time in human readable format
 * @param {number} seconds - Time in seconds
 * @returns {string} Formatted time string
 */
export function formatTime(seconds) {
  if (seconds < 60) {
    return `${Math.floor(seconds)}s`;
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  return `${minutes}m ${secs}s`;
}

/**
 * Format time for display in timer
 * @param {number} seconds - Time in seconds
 * @returns {string} MM:SS format
 */
export function formatTimerDisplay(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Get today's date as string key
 * @returns {string} YYYY-MM-DD format
 */
export function getTodayKey() {
  const today = new Date();
  return today.toISOString().split('T')[0];
}

/**
 * Get current week dates
 * @returns {string[]} Array of date keys for current week
 */
export function getCurrentWeekDates() {
  const dates = [];
  const today = new Date();
  const dayOfWeek = today.getDay();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - dayOfWeek);

  for (let i = 0; i < 7; i++) {
    const date = new Date(startOfWeek);
    date.setDate(startOfWeek.getDate() + i);
    dates.push(date.toISOString().split('T')[0]);
  }

  return dates;
}

/**
 * Calculate percentage
 * @param {number} value - Current value
 * @param {number} total - Total value
 * @returns {number} Percentage (0-100)
 */
export function calculatePercentage(value, total) {
  if (total === 0) return 0;
  return Math.min(100, Math.round((value / total) * 100));
}

/**
 * Deep merge objects
 * @param {Object} target - Target object
 * @param {Object} source - Source object
 * @returns {Object} Merged object
 */
export function deepMerge(target, source) {
  const result = { ...target };

  for (const key in source) {
    if (source[key] instanceof Object && key in target) {
      result[key] = deepMerge(target[key], source[key]);
    } else {
      result[key] = source[key];
    }
  }

  return result;
}

/**
 * Debounce function
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in ms
 * @returns {Function} Debounced function
 */
export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Check if URL should be tracked
 * @param {string} url - URL to check
 * @returns {boolean} Whether URL should be tracked
 */
export function isTrackableUrl(url) {
  if (!url) return false;

  const untrackablePrefixes = [
    'chrome://',
    'chrome-extension://',
    'about:',
    'edge://',
    'brave://',
    'moz-extension://',
    'file://'
  ];

  return !untrackablePrefixes.some(prefix => url.startsWith(prefix));
}

/**
 * Generate unique ID
 * @returns {string} Unique ID
 */
export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

/**
 * Calculate focus score based on distractions
 * @param {number} sessionDuration - Total session duration in seconds
 * @param {number} distractionCount - Number of distraction attempts
 * @returns {number} Score 0-100
 */
export function calculateFocusScore(sessionDuration, distractionCount) {
  if (sessionDuration === 0) return 0;

  // Base score starts at 100
  // Lose points for each distraction (weighted by session length)
  const minutesInSession = sessionDuration / 60;
  const distractionsPerMinute = distractionCount / minutesInSession;

  // 0 distractions = 100, more distractions = lower score
  let score = 100 - (distractionsPerMinute * 20);

  return Math.max(0, Math.min(100, Math.round(score)));
}
