const { Redis } = require('@upstash/redis');

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

// Target wallet address
const TARGET_ADDRESS = "0xB98e82C611BFc1b852412268fd300E28fAEE4D48";

// Timestamp constants
const COMPETITION_LAUNCH_TIMESTAMP = 1755118800; // August 14, 2025 07:00 AEST
const WEEK_DURATION = 7 * 24 * 60 * 60; // 1 week in seconds

async function checkUpstashData() {
  try {
    console.log('🔍 CHECKING UPSTASH REDIS DATA');
    console.log('==============================');
    console.log('Target address:', TARGET_ADDRESS);
    console.log('Current time:', new Date().toISOString());
    console.log('');

    // Calculate current week info
    const nowTs = Math.floor(Date.now() / 1000);
    const competitionWeekIndex = Math.floor((nowTs - COMPETITION_LAUNCH_TIMESTAMP) / WEEK_DURATION);

    console.log('📅 COMPETITION INFO:');
    console.log('Competition started:', new Date(COMPETITION_LAUNCH_TIMESTAMP * 1000).toISOString());
    console.log('Current competition week:', competitionWeekIndex);
    console.log('Current timestamp:', nowTs);
    console.log('');

    // Check current week leaderboard
    const currentWeekKey = `leaderboard:weekly:${competitionWeekIndex}`;
    console.log('🔍 Checking current week leaderboard:', currentWeekKey);
    
    const currentWeekData = await redis.get(currentWeekKey);
    console.log('Current week data exists:', !!currentWeekData);
    
    if (currentWeekData && currentWeekData.leaderboard) {
      console.log('Current week leaderboard entries:', currentWeekData.leaderboard.length);
      
      // Check if target address is in current week leaderboard
      const targetEntry = currentWeekData.leaderboard.find(entry => 
        entry.referrer.toLowerCase() === TARGET_ADDRESS.toLowerCase()
      );
      
      if (targetEntry) {
        console.log('✅ FOUND IN CURRENT WEEK LEADERBOARD!');
        console.log('Entry details:', targetEntry);
      } else {
        console.log('❌ NOT FOUND in current week leaderboard');
        console.log('Leaderboard entries:');
        currentWeekData.leaderboard.forEach((entry, i) => {
          console.log(`${i + 1}. ${entry.referrer} - ${entry.totalAmount} BNB (${entry.referralCount} referrals)`);
        });
      }
    } else {
      console.log('❌ No current week leaderboard data');
    }
    console.log('');

    // Check previous weeks
    console.log('🔍 Checking previous weeks...');
    for (let weekIndex = 0; weekIndex < competitionWeekIndex; weekIndex++) {
      const weekKey = `leaderboard:weekly:${weekIndex}`;
      const weekData = await redis.get(weekKey);
      
      if (weekData && weekData.leaderboard) {
        const targetEntry = weekData.leaderboard.find(entry => 
          entry.referrer.toLowerCase() === TARGET_ADDRESS.toLowerCase()
        );
        
        if (targetEntry) {
          console.log(`✅ FOUND in week ${weekIndex}:`, targetEntry);
        } else {
          console.log(`❌ NOT FOUND in week ${weekIndex} (${weekData.leaderboard.length} entries)`);
        }
      } else {
        console.log(`❌ No data for week ${weekIndex}`);
      }
    }
    console.log('');

    // Check user-specific referral data
    console.log('🔍 Checking user-specific referral data...');
    const userKeys = await redis.keys(`user:${TARGET_ADDRESS.toLowerCase()}*`);
    console.log('User keys found:', userKeys);
    
    for (const key of userKeys) {
      const userData = await redis.get(key);
      console.log(`${key}:`, userData);
    }
    console.log('');

    // Check referral stats for this user
    console.log('🔍 Checking referral stats...');
    const referralKeys = await redis.keys(`referral:*${TARGET_ADDRESS.toLowerCase()}*`);
    console.log('Referral keys found:', referralKeys);
    
    for (const key of referralKeys) {
      const referralData = await redis.get(key);
      console.log(`${key}:`, referralData);
    }
    console.log('');

    // Check all weekly leaderboard keys
    console.log('🔍 Checking all weekly leaderboard keys...');
    const allWeeklyKeys = await redis.keys('leaderboard:weekly:*');
    console.log('All weekly leaderboard keys:', allWeeklyKeys);
    
    for (const key of allWeeklyKeys) {
      const weekData = await redis.get(key);
      if (weekData && weekData.leaderboard) {
        const targetEntry = weekData.leaderboard.find(entry => 
          entry.referrer.toLowerCase() === TARGET_ADDRESS.toLowerCase()
        );
        
        if (targetEntry) {
          console.log(`✅ FOUND in ${key}:`, targetEntry);
        }
      }
    }
    console.log('');

    // Search all keys for the target address
    console.log('🔍 Searching all keys containing target address...');
    const addressPattern = TARGET_ADDRESS.toLowerCase().substring(2); // Remove 0x
    const allKeys = await redis.keys('*');
    
    const relevantKeys = allKeys.filter(key => 
      key.toLowerCase().includes(addressPattern)
    );
    
    console.log('Keys containing target address:', relevantKeys);
    
    for (const key of relevantKeys) {
      const data = await redis.get(key);
      console.log(`${key}:`, data);
    }

    console.log('');
    console.log('🎯 SUMMARY:');
    console.log('===========');
    console.log('If no data found, possible reasons:');
    console.log('1. User has not made any referrals yet');
    console.log('2. Referrals were made outside competition timeframe');
    console.log('3. Cron job has not processed the referrals yet');
    console.log('4. There might be case sensitivity issues');
    console.log('5. The weekly aggregation system needs to be triggered manually');

  } catch (error) {
    console.error('❌ Error checking Upstash data:', error);
  }
}

// Run the check
checkUpstashData();
