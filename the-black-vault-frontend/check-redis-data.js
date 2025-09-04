const { Redis } = require('@upstash/redis');

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

// Timestamp constants
const COMPETITION_LAUNCH_TIMESTAMP = 1755118800; // August 14, 2025 07:00 AEST
const WEEK_DURATION = 7 * 24 * 60 * 60; // 1 week in seconds

async function checkRedisData() {
  try {
    console.log('🔍 Checking Redis data for weekly leaderboards...');
    console.log('Current time:', new Date().toISOString());
    console.log('');

    // Calculate current week
    const nowTs = Math.floor(Date.now() / 1000);
    const competitionWeekIndex = Math.floor((nowTs - COMPETITION_LAUNCH_TIMESTAMP) / WEEK_DURATION);

    console.log('📅 Week Calculations:');
    console.log('Current timestamp:', nowTs);
    console.log('Competition week index:', competitionWeekIndex);
    console.log('Competition started:', new Date(COMPETITION_LAUNCH_TIMESTAMP * 1000).toISOString());
    console.log('');

    // Check current week data
    const currentWeekKey = `leaderboard:weekly:${competitionWeekIndex}`;
    console.log('🔍 Checking current week key:', currentWeekKey);
    
    const currentWeekData = await redis.get(currentWeekKey);
    console.log('Current week data:', currentWeekData);
    console.log('');

    // Check previous week data
    const previousWeekIndex = competitionWeekIndex - 1;
    const previousWeekKey = `leaderboard:weekly:${previousWeekIndex}`;
    console.log('🔍 Checking previous week key:', previousWeekKey);
    
    const previousWeekData = await redis.get(previousWeekKey);
    console.log('Previous week data:', previousWeekData);
    console.log('');

    // Check if there are any weekly leaderboard keys
    console.log('🔍 Scanning for all weekly leaderboard keys...');
    const allKeys = await redis.keys('leaderboard:weekly:*');
    console.log('Found weekly leaderboard keys:', allKeys);
    console.log('');

    if (allKeys.length > 0) {
      console.log('📊 Data in each weekly leaderboard:');
      for (const key of allKeys) {
        const data = await redis.get(key);
        console.log(`${key}:`, data);
      }
    }

    // Check for any referral stats
    console.log('🔍 Checking for referral stats...');
    const referralKeys = await redis.keys('referral:*');
    console.log('Found referral keys:', referralKeys.slice(0, 10)); // Show first 10
    console.log('Total referral keys found:', referralKeys.length);
    console.log('');

    // Check for user referral data
    console.log('🔍 Checking for user referral data...');
    const userKeys = await redis.keys('user:*');
    console.log('Found user keys:', userKeys.slice(0, 10)); // Show first 10
    console.log('Total user keys found:', userKeys.length);
    console.log('');

    console.log('🎯 SUMMARY:');
    console.log('===========');
    console.log('Current week has data:', currentWeekData ? 'YES ✅' : 'NO ❌');
    console.log('Previous week has data:', previousWeekData ? 'YES ✅' : 'NO ❌');
    console.log('Total weekly leaderboards:', allKeys.length);
    console.log('Total referral records:', referralKeys.length);
    console.log('Total user records:', userKeys.length);

    if (!currentWeekData && !previousWeekData && allKeys.length === 0) {
      console.log('');
      console.log('⚠️  NO WEEKLY LEADERBOARD DATA FOUND');
      console.log('This indicates:');
      console.log('1. Weekly leaderboard cron jobs might not be running');
      console.log('2. No referral activity has been processed');
      console.log('3. Database might need manual population');
      console.log('4. Referral tracking system might not be working');
    }

  } catch (error) {
    console.error('❌ Error checking Redis data:', error);
  }
}

// Run the check
checkRedisData();
