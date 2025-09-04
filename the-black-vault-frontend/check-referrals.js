const { ethers } = require('ethers');

// Contract configuration
const CONTRACT_ADDRESS = "0x22708D8a54c044CbA5B237620Af42030cbf76E14";
const RPC_URL = "https://rpc.ankr.com/bsc/608da03fc0a1cb8d5a5a6df34cb8bc598dfa27f71213d822afb470aaf0018ee4";

// ABI for the Deposit event
const CONTRACT_ABI = [
  "event Deposit(address indexed user, address indexed referrer, uint256 amount, uint256 timestamp)"
];

// Timestamp constants
const PROJECT_LAUNCH_TIMESTAMP = 1751490000; // July 3, 2025 07:00 AEST
const COMPETITION_LAUNCH_TIMESTAMP = 1755118800; // August 14, 2025 07:00 AEST
const WEEK_DURATION = 7 * 24 * 60 * 60; // 1 week in seconds

async function checkReferralData() {
  try {
    console.log('🔍 Checking referral data from blockchain...');
    console.log('Current time:', new Date().toISOString());
    console.log('');

    // Calculate current week info
    const nowTs = Math.floor(Date.now() / 1000);
    const competitionWeekIndex = Math.floor((nowTs - COMPETITION_LAUNCH_TIMESTAMP) / WEEK_DURATION);
    const projectWeekIndex = Math.floor((nowTs - PROJECT_LAUNCH_TIMESTAMP) / WEEK_DURATION);

    console.log('📅 Week Calculations:');
    console.log('Current timestamp:', nowTs);
    console.log('Competition week index:', competitionWeekIndex);
    console.log('Project week index:', projectWeekIndex);
    console.log('');

    // Current competition week bounds
    const currentWeekStart = COMPETITION_LAUNCH_TIMESTAMP + competitionWeekIndex * WEEK_DURATION;
    const currentWeekEnd = currentWeekStart + WEEK_DURATION;
    
    // Previous competition week bounds
    const previousWeekIndex = competitionWeekIndex - 1;
    const previousWeekStart = COMPETITION_LAUNCH_TIMESTAMP + previousWeekIndex * WEEK_DURATION;
    const previousWeekEnd = previousWeekStart + WEEK_DURATION;

    console.log('📊 Current Competition Week:', competitionWeekIndex);
    console.log('Start:', new Date(currentWeekStart * 1000).toISOString());
    console.log('End:', new Date(currentWeekEnd * 1000).toISOString());
    console.log('');

    console.log('📊 Previous Competition Week:', previousWeekIndex);
    console.log('Start:', new Date(previousWeekStart * 1000).toISOString());
    console.log('End:', new Date(previousWeekEnd * 1000).toISOString());
    console.log('');

    // Setup provider and contract
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);

    // Get latest block to determine search range
    const latestBlock = await provider.getBlockNumber();
    console.log('Latest block:', latestBlock);

    // Since we need to search by timestamp, let's get recent blocks and check
    // We'll search the last 100 blocks to cover recent activity (smaller range)
    const fromBlock = Math.max(0, latestBlock - 100);
    
    console.log('🔎 Searching for Deposit events from block', fromBlock, 'to', latestBlock);
    
    // Get all Deposit events in recent blocks
    const filter = contract.filters.Deposit();
    const events = await contract.queryFilter(filter, fromBlock, latestBlock);
    
    console.log('📈 Found', events.length, 'total deposit events in recent blocks');
    console.log('');

    if (events.length === 0) {
      console.log('❌ No deposit events found in recent blocks');
      console.log('This might indicate:');
      console.log('1. No recent deposits');
      console.log('2. Need to search more blocks');
      console.log('3. Contract address or RPC might be incorrect');
      return;
    }

    // Process events and categorize by week
    let currentWeekReferrals = [];
    let previousWeekReferrals = [];
    let allTimeReferrals = [];

    for (const event of events) {
      const block = await provider.getBlock(event.blockNumber);
      const eventTimestamp = block.timestamp;
      
      // Only process events with referrers (non-zero address)
      if (event.args.referrer !== '0x0000000000000000000000000000000000000000') {
        const referralData = {
          user: event.args.user,
          referrer: event.args.referrer,
          amount: ethers.formatEther(event.args.amount),
          timestamp: eventTimestamp,
          date: new Date(eventTimestamp * 1000).toISOString(),
          blockNumber: event.blockNumber,
          txHash: event.transactionHash
        };

        allTimeReferrals.push(referralData);

        // Check if it's in current competition week
        if (eventTimestamp >= currentWeekStart && eventTimestamp < currentWeekEnd) {
          currentWeekReferrals.push(referralData);
        }

        // Check if it's in previous competition week
        if (eventTimestamp >= previousWeekStart && eventTimestamp < previousWeekEnd) {
          previousWeekReferrals.push(referralData);
        }
      }
    }

    console.log('📊 REFERRAL ANALYSIS RESULTS:');
    console.log('================================');
    console.log('');

    console.log('🏆 CURRENT COMPETITION WEEK (' + competitionWeekIndex + '):');
    console.log('Referrals found:', currentWeekReferrals.length);
    if (currentWeekReferrals.length > 0) {
      currentWeekReferrals.forEach((ref, i) => {
        console.log(`${i + 1}. ${ref.amount} BNB - ${ref.referrer} referred ${ref.user}`);
        console.log(`   Date: ${ref.date}`);
        console.log(`   TX: ${ref.txHash}`);
      });
    } else {
      console.log('❌ No referrals found in current competition week');
    }
    console.log('');

    console.log('📅 PREVIOUS COMPETITION WEEK (' + previousWeekIndex + '):');
    console.log('Referrals found:', previousWeekReferrals.length);
    if (previousWeekReferrals.length > 0) {
      previousWeekReferrals.forEach((ref, i) => {
        console.log(`${i + 1}. ${ref.amount} BNB - ${ref.referrer} referred ${ref.user}`);
        console.log(`   Date: ${ref.date}`);
        console.log(`   TX: ${ref.txHash}`);
      });
    } else {
      console.log('❌ No referrals found in previous competition week');
    }
    console.log('');

    console.log('📈 ALL RECENT REFERRALS (last 100 blocks):');
    console.log('Total referrals found:', allTimeReferrals.length);
    if (allTimeReferrals.length > 0) {
      console.log('Most recent referrals:');
      allTimeReferrals.slice(-5).forEach((ref, i) => {
        console.log(`${i + 1}. ${ref.amount} BNB - ${ref.referrer} referred ${ref.user}`);
        console.log(`   Date: ${ref.date}`);
        console.log(`   TX: ${ref.txHash}`);
      });
    }

    // Summary
    console.log('');
    console.log('🎯 SUMMARY:');
    console.log('===========');
    console.log('Current week has referrals:', currentWeekReferrals.length > 0 ? 'YES ✅' : 'NO ❌');
    console.log('Previous week had referrals:', previousWeekReferrals.length > 0 ? 'YES ✅' : 'NO ❌');
    console.log('Recent activity detected:', allTimeReferrals.length > 0 ? 'YES ✅' : 'NO ❌');

  } catch (error) {
    console.error('❌ Error checking referral data:', error);
  }
}

// Run the check
checkReferralData();

