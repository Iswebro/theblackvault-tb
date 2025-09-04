// Simple internal test to check if our fix works
const { Redis } = require('@upstash/redis');

async function testReferralFix() {
  try {
    console.log('🔍 Testing referral fix internally...');
    
    // Create Redis connection
    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
    
    // Check current week data
    const COMPETITION_LAUNCH_TIMESTAMP = 1755118800;
    const WEEK_DURATION = 7 * 24 * 60 * 60;
    const nowTs = Math.floor(Date.now() / 1000);
    const weekIndex = Math.floor((nowTs - COMPETITION_LAUNCH_TIMESTAMP) / WEEK_DURATION);
    
    console.log(`📅 Current week index: ${weekIndex}`);
    
    // Check existing data
    const weeklyData = await redis.get(`leaderboard:weekly:${weekIndex}`);
    console.log('📊 Existing weekly data entries:', weeklyData?.leaderboard?.length || 0);
    
    // Check for our target referrer
    const targetReferrer = '0xB98e82C611BFc1b852412268fd300E28fAEE4D48';
    const foundInWeekly = weeklyData?.leaderboard?.find(entry => 
      entry.referrer?.toLowerCase() === targetReferrer.toLowerCase()
    );
    
    if (foundInWeekly) {
      console.log('✅ Target referrer found in current weekly data!');
      console.log('📈 Referral count:', foundInWeekly.totalReferrals);
    } else {
      console.log('❌ Target referrer not found in weekly data');
    }
    
    // Check lifetime data
    const lifetimeData = await redis.get('leaderboard:lifetime');
    const foundInLifetime = lifetimeData?.leaderboard?.find(entry => 
      entry.referrer?.toLowerCase() === targetReferrer.toLowerCase()
    );
    
    if (foundInLifetime) {
      console.log('✅ Target referrer found in lifetime data!');
      console.log('📈 Lifetime referral count:', foundInLifetime.totalReferrals);
    } else {
      console.log('❌ Target referrer not found in lifetime data');
    }
    
    console.log('\n🔧 Fix Status Summary:');
    console.log(`Weekly leaderboard entries: ${weeklyData?.leaderboard?.length || 0}`);
    console.log(`Lifetime leaderboard entries: ${lifetimeData?.leaderboard?.length || 0}`);
    console.log(`Target referrer in weekly: ${foundInWeekly ? 'YES' : 'NO'}`);
    console.log(`Target referrer in lifetime: ${foundInLifetime ? 'YES' : 'NO'}`);
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testReferralFix();
