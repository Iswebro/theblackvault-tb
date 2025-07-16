const LAUNCH_TIMESTAMP = 1751490000; // 3 July 2025 07:00 AEST (UTC+10)
const WEEK_DURATION = 7 * 24 * 60 * 60;
const nowTs = Math.floor(Date.now() / 1000);
return Math.floor((nowTs - LAUNCH_TIMESTAMP) / WEEK_DURATION);