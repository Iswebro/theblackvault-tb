const { ethers } = require('ethers');
const fs = require('fs');

const DEFAULT_REFERRER = '0x706961C676FE743C34A867437661D13E16ADCbEc';
const CONTRACT_ADDRESS = '0x22708D8a54c044CbA5B237620Af42030cbf76E14';
const YOUR_WALLET = '0xdeE2027D2d42f11822f8BF448eD9e41556F360b3';
const LOG_FILE = 'referral-monitoring.json';

const ABI = [
  'function getReferralBonusInfo(address referrer, address referee) external view returns (uint256 used, uint256 remaining)',
  'function getUserReferralData(address user) view returns (uint256 totalRewards, uint256 availableRewards, uint256 referredCount, uint256 totalVolume, uint256 totalWithdrawn)'
];

async function monitorReferralStats() {
  try {
    const timestamp = new Date().toISOString();
    console.log('🕐 Monitoring at:', timestamp);
    console.log('=' .repeat(60));
    
    const provider = new ethers.JsonRpcProvider('https://bsc-dataseed.binance.org/');
    const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);
    
    // Get current block for reference
    const currentBlock = await provider.getBlockNumber();
    
    // Check your bonus usage
    const bonusInfo = await contract.getReferralBonusInfo(DEFAULT_REFERRER, YOUR_WALLET);
    
    // Check default referrer stats
    const defaultStats = await contract.getUserReferralData(DEFAULT_REFERRER);
    
    const currentSnapshot = {
      timestamp,
      blockNumber: currentBlock,
      yourBonusUsage: {
        used: parseInt(bonusInfo.used.toString()),
        remaining: parseInt(bonusInfo.remaining.toString())
      },
      defaultReferrerStats: {
        totalRewards: ethers.formatEther(defaultStats[0]),
        availableRewards: ethers.formatEther(defaultStats[1]),
        totalReferrals: parseInt(defaultStats[2].toString()),
        totalVolume: ethers.formatEther(defaultStats[3]),
        totalWithdrawn: ethers.formatEther(defaultStats[4])
      }
    };
    
    // Load previous data
    let historicalData = [];
    if (fs.existsSync(LOG_FILE)) {
      try {
        const fileContent = fs.readFileSync(LOG_FILE, 'utf8');
        historicalData = JSON.parse(fileContent);
      } catch (error) {
        console.log('⚠️  Could not read previous data, starting fresh');
        historicalData = [];
      }
    }
    
    // Compare with previous reading
    const previousSnapshot = historicalData.length > 0 ? historicalData[historicalData.length - 1] : null;
    
    console.log('📊 CURRENT STATUS:');
    console.log('   Your Bonus Usage:', currentSnapshot.yourBonusUsage.used, '/ 3');
    console.log('   Default Referrer Available Rewards:', currentSnapshot.defaultReferrerStats.availableRewards, 'USDT');
    console.log('   Default Referrer Total Referrals:', currentSnapshot.defaultReferrerStats.totalReferrals);
    console.log('   Default Referrer Total Volume:', currentSnapshot.defaultReferrerStats.totalVolume, 'USDT');
    console.log('   Block Number:', currentSnapshot.blockNumber);
    
    if (previousSnapshot) {
      console.log('\n🔄 CHANGES SINCE LAST CHECK:');
      console.log('   Previous Check:', previousSnapshot.timestamp);
      
      const rewardsChange = parseFloat(currentSnapshot.defaultReferrerStats.availableRewards) - parseFloat(previousSnapshot.defaultReferrerStats.availableRewards);
      const referralsChange = currentSnapshot.defaultReferrerStats.totalReferrals - previousSnapshot.defaultReferrerStats.totalReferrals;
      const volumeChange = parseFloat(currentSnapshot.defaultReferrerStats.totalVolume) - parseFloat(previousSnapshot.defaultReferrerStats.totalVolume);
      const bonusChange = currentSnapshot.yourBonusUsage.used - previousSnapshot.yourBonusUsage.used;
      
      console.log('   Available Rewards Change:', rewardsChange > 0 ? `+${rewardsChange}` : rewardsChange, 'USDT');
      console.log('   Total Referrals Change:', referralsChange > 0 ? `+${referralsChange}` : referralsChange);
      console.log('   Total Volume Change:', volumeChange > 0 ? `+${volumeChange}` : volumeChange, 'USDT');
      console.log('   Your Bonus Usage Change:', bonusChange > 0 ? `+${bonusChange}` : bonusChange);
      
      // Detect significant changes
      if (rewardsChange > 0) {
        console.log('\n🚨 ALERT: Default referrer received new rewards!');
        console.log('   Amount:', rewardsChange, 'USDT');
        if (currentSnapshot.yourBonusUsage.used > 3) {
          console.log('   ⚠️  Your bonus counter exceeded 3 - this could indicate the bug!');
        }
      }
      
      if (bonusChange > 0) {
        console.log('\n🚨 ALERT: Your bonus usage increased!');
        console.log('   New Usage:', currentSnapshot.yourBonusUsage.used, '/ 3');
        if (currentSnapshot.yourBonusUsage.used > 3) {
          console.log('   🚨 BUG DETECTED: Bonus counter exceeded maximum!');
        }
      }
    }
    
    // Add current snapshot to history
    historicalData.push(currentSnapshot);
    
    // Keep only last 50 entries to prevent file from growing too large
    if (historicalData.length > 50) {
      historicalData = historicalData.slice(-50);
    }
    
    // Save updated data
    fs.writeFileSync(LOG_FILE, JSON.stringify(historicalData, null, 2));
    
    console.log('\n💾 Data saved to', LOG_FILE);
    console.log('📈 Total snapshots recorded:', historicalData.length);
    
    console.log('\n🎯 NEXT STEPS FOR YOUR TESTING:');
    console.log('   1. Run this script regularly to establish baseline');
    console.log('   2. Before making test deposits, run: node monitor-referrals.js');
    console.log('   3. Make your test deposit');
    console.log('   4. Run script again to see changes');
    console.log('   5. Look for alerts about reward/bonus changes');
    
    console.log('\n🔬 TEST SCENARIOS TO TRY:');
    console.log('   A) Deposit WITHOUT referral code (should be fine if rewards increase)');
    console.log('   B) Deposit WITH default referral link (should NOT increase rewards if at 3/3)');
    console.log('   C) Monitor if bonus counter goes beyond 3 (would confirm bug)');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Run monitoring
monitorReferralStats();
