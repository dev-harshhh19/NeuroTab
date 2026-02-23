// Mode definitions
export const MODES = {
  NORMAL: 'normal',
  PRODUCTIVITY: 'productivity',
  EXAM: 'exam'
};

// Website categories
export const CATEGORIES = {
  PRODUCTIVE: 'productive',
  NEUTRAL: 'neutral',
  DISTRACTING: 'distracting',
  CUSTOM: 'custom'
};

// Default distracting websites
export const DEFAULT_DISTRACTING_SITES = [
  'youtube.com',
  'twitter.com',
  'x.com',
  'facebook.com',
  'instagram.com',
  'tiktok.com',
  'reddit.com',
  'netflix.com',
  'twitch.tv',
  'discord.com'
];

// Default productive websites
export const DEFAULT_PRODUCTIVE_SITES = [
  'github.com',
  'stackoverflow.com',
  'developer.mozilla.org',
  'docs.google.com',
  'notion.so',
  'linear.app',
  'figma.com',
  'codepen.io',
  'replit.com',
  'vercel.com'
];

// Default neutral websites
export const DEFAULT_NEUTRAL_SITES = [
  'google.com',
  'bing.com',
  'duckduckgo.com',
  'wikipedia.org',
  'gmail.com',
  'outlook.com',
  'drive.google.com'
];

// Time limits (in minutes)
export const DEFAULT_TIME_LIMITS = {
  distracting: 30, // 30 minutes per day for distracting sites
  warning_threshold: 5, // Warn when 5 minutes remaining
  cooldown: 15 // 15 minute cooldown after limit reached
};

// Focus session defaults
export const FOCUS_SESSION_DEFAULTS = {
  duration: 25, // 25 minutes (Pomodoro)
  short_break: 5,
  long_break: 15,
  sessions_before_long_break: 4
};

// Idle detection
export const IDLE_THRESHOLD = 60; // seconds of inactivity before considered idle

// Storage keys
export const STORAGE_KEYS = {
  CURRENT_MODE: 'currentMode',
  WEBSITE_DATA: 'websiteData',
  FOCUS_SESSIONS: 'focusSessions',
  ACTIVE_FOCUS_SESSION: 'activeFocusSession',
  ACTIVE_EXAM_SESSION: 'activeExamSession',
  WEBSITE_RULES: 'websiteRules',
  SETTINGS: 'settings',
  DAILY_STATS: 'dailyStats',
  DISTRACTION_LOG: 'distractionLog',
  STREAK_DATA: 'streakData'
};

export const MAX_ALLOWED_DISTRACTION_TIME = 3600; // 1 hour in seconds

// Colors for categories
export const CATEGORY_COLORS = {
  productive: 'hsl(146, 17%, 59%)', // --success
  neutral: 'hsl(201, 7%, 69%)',    // --text-muted
  distracting: 'hsl(9, 26%, 64%)', // --danger
  custom: 'hsl(199, 70%, 65%)'     // --primary
};
