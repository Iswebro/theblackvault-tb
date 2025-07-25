const { ethers } = require('ethers');

const DEFAULT_REFERRER = '0x706961C676FE743C34A867437661D13E16ADCbEc';
const CONTRACT_ADDRESS = '0x22708D8a54c044CbA5B237620Af42030cbf76E14';
const YOUR_WALLET = '0xdeE2027D2d42f11822f8BF448eD9e41556F360b3';

const ABI = [
  'function getReferralBonusInfo(address referrer, address referee) external view returns (uint256 used, uint256 remaining)',
  'function getUserReferralData(address user) view returns (uint256 totalRewards, uint256 availableRewards, uint256 referredCount, uint256 totalVolume, uint256 totalWithdrawn)'
];

async function checkBonusStatus() {
  try {
    console.log('🔍 Checking bonus status for:', YOUR_WALLET);
    console.log('Default Referrer:', DEFAULT_REFERRER);
    
    const provider = new ethers.JsonRpcProvider('https://bsc-dataseed.binance.org/');
    const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);
    
    // Check your bonus usage
    const bonusInfo = await contract.getReferralBonusInfo(DEFAULT_REFERRER, YOUR_WALLET);
    console.log('\n📊 YOUR BONUS USAGE WITH DEFAULT REFERRER:');
    console.log('   Bonuses Used:', bonusInfo.used.toString());
    console.log('   Bonuses Remaining:', bonusInfo.remaining.toString());
    
    // Check default referrer stats BEFORE vs AFTER your latest deposit
    const defaultStats = await contract.getUserReferralData(DEFAULT_REFERRER);
    console.log('\n📈 DEFAULT REFERRER CURRENT STATS:');
    console.log('   Total Rewards:', ethers.formatEther(defaultStats[0]), 'USDT');
    console.log('   Available Rewards:', ethers.formatEther(defaultStats[1]), 'USDT'); 
    console.log('   Total Referrals:', defaultStats[2].toString());
    console.log('   Total Volume:', ethers.formatEther(defaultStats[3]), 'USDT');
    
    console.log('\n🧠 YOUR THEORY ANALYSIS:');
    console.log('   📝 Your deposit history:');
    console.log('      • 1 deposit WITH default referral link');
    console.log('      • 2 deposits WITHOUT referral (auto-assigned to default)');
    console.log('      • 1 recent deposit WITHOUT referral (4th total)');
    console.log('');
    console.log('   🤔 Key Question: Does the contract differentiate between:');
    console.log('      A) Deposits using default referral link directly');
    console.log('      B) Deposits without referral (auto-assigned to default)');
    console.log('');
    
    const used = parseInt(bonusInfo.used.toString());
    if (used >= 3) {
      console.log('   📊 Contract State: 3/3 bonuses used');
      console.log('   ❓ Testing Your Theory:');
      console.log('      - If bug: Would continue giving bonuses');
      console.log('      - If correct: Should stop after 3 total deposits involving default referrer');
      console.log('');
      console.log('   🎯 TO VERIFY:');
      console.log('      1. Check if default referrer rewards increased after your 4th deposit');
      console.log('      2. Make a 5th deposit using DEFAULT REFERRAL LINK specifically');
      console.log('      3. See if bonus counter goes beyond 3 (would prove bug)');
    } else {
      console.log(`   ✅ You have used ${used}/3 bonuses`);
      console.log(`   ✅ You can receive ${3-used} more bonuses`);
    }
    
    console.log('\n💡 NEXT TEST STEPS:');
    console.log('   1. Note current default referrer available rewards:', ethers.formatEther(defaultStats[1]), 'USDT');
    console.log('   2. Make a deposit WITHOUT referral code');
    console.log('   3. Check if available rewards increase by 5 USDT');
    console.log('   4. If YES = bug confirmed');
    console.log('   5. If NO = your theory is correct');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkBonusStatus();
