// Simple week calculation check
const COMPETITION_LAUNCH_TIMESTAMP = 1755118800; // August 14, 2025 07:00 AEST
const WEEK_DURATION = 7 * 24 * 60 * 60; // 1 week in seconds

const nowTs = Math.floor(Date.now() / 1000);
const competitionWeekIndex = Math.floor((nowTs - COMPETITION_LAUNCH_TIMESTAMP) / WEEK_DURATION);

console.log('Current timestamp:', nowTs);
console.log('Competition launch:', COMPETITION_LAUNCH_TIMESTAMP);
console.log('Competition started:', new Date(COMPETITION_LAUNCH_TIMESTAMP * 1000).toISOString());
console.log('Current competition week:', competitionWeekIndex);

const currentWeekStart = COMPETITION_LAUNCH_TIMESTAMP + competitionWeekIndex * WEEK_DURATION;
const currentWeekEnd = currentWeekStart + WEEK_DURATION;

console.log('Current week bounds:');
console.log('Start:', new Date(currentWeekStart * 1000).toISOString());
console.log('End:', new Date(currentWeekEnd * 1000).toISOString());

// Check if we're in the competition period
if (nowTs >= COMPETITION_LAUNCH_TIMESTAMP) {
  console.log('✅ Competition is active');
} else {
  console.log('❌ Competition has not started yet');
}
