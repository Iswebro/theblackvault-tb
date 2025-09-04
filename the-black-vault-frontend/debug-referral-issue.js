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

async function debugReferralIssue() {
  try {
    console.log('🔍 DEBUGGING REFERRAL COMPETITION ISSUE');
    console.log('=========================================');
    console.log('Current time:', new Date().toISOString());
    console.log('Current timestamp:', Math.floor(Date.now() / 1000));
    console.log('');

    // Calculate current week info
    const nowTs = Math.floor(Date.now() / 1000);
    const competitionWeekIndex = Math.floor((nowTs - COMPETITION_LAUNCH_TIMESTAMP) / WEEK_DURATION);
    const projectWeekIndex = Math.floor((nowTs - PROJECT_LAUNCH_TIMESTAMP) / WEEK_DURATION);

    console.log('📅 COMPETITION TIMELINE:');
    console.log('Competition started:', new Date(COMPETITION_LAUNCH_TIMESTAMP * 1000).toISOString());
    console.log('Current competition week:', competitionWeekIndex);
    console.log('Project week:', projectWeekIndex);

    // Current competition week bounds
    const currentWeekStart = COMPETITION_LAUNCH_TIMESTAMP + competitionWeekIndex * WEEK_DURATION;
    const currentWeekEnd = currentWeekStart + WEEK_DURATION;
    
    console.log('Current week period:');
    console.log('  Start:', new Date(currentWeekStart * 1000).toISOString());
    console.log('  End:', new Date(currentWeekEnd * 1000).toISOString());
    console.log('');

    // Setup provider and contract
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);

    // Get latest block
    const latestBlock = await provider.getBlockNumber();
    console.log('📊 BLOCKCHAIN INFO:');
    console.log('Latest block:', latestBlock);
    console.log('');

    // Search for recent deposits with referrals
    console.log('🔎 SEARCHING FOR RECENT REFERRAL ACTIVITY...');
    
    // Search in smaller chunks to avoid rate limits
    const searchRanges = [
      { from: latestBlock - 50, to: latestBlock, label: "Last 50 blocks" },
      { from: latestBlock - 200, to: latestBlock - 50, label: "51-200 blocks ago" },
      { from: latestBlock - 500, to: latestBlock - 200, label: "201-500 blocks ago" },
      { from: latestBlock - 1000, to: latestBlock - 500, label: "501-1000 blocks ago" },
      { from: latestBlock - 2000, to: latestBlock - 1000, label: "1001-2000 blocks ago" },
      { from: latestBlock - 5000, to: latestBlock - 2000, label: "2001-5000 blocks ago" },
    ];

    let allReferrals = [];
    let allDeposits = [];

    for (const range of searchRanges) {
      try {
        console.log(`Checking ${range.label}...`);
        
        const filter = contract.filters.Deposit();
        const events = await contract.queryFilter(filter, Math.max(0, range.from), range.to);
        
        console.log(`  Found ${events.length} total deposits`);
        
        for (const event of events) {
          const block = await provider.getBlock(event.blockNumber);
          const eventTimestamp = block.timestamp;
          
          const depositData = {
            user: event.args.user,
            referrer: event.args.referrer,
            amount: ethers.formatEther(event.args.amount),
            timestamp: eventTimestamp,
            date: new Date(eventTimestamp * 1000).toISOString(),
            blockNumber: event.blockNumber,
            txHash: event.transactionHash,
            isReferral: event.args.referrer !== '0x0000000000000000000000000000000000000000'
          };

          allDeposits.push(depositData);
          
          if (depositData.isReferral) {
            allReferrals.push(depositData);
            console.log(`  ✅ REFERRAL FOUND: ${depositData.amount} BNB`);
            console.log(`     Referrer: ${depositData.referrer}`);
            console.log(`     User: ${depositData.user}`);
            console.log(`     Date: ${depositData.date}`);
            console.log(`     TX: ${depositData.txHash}`);
          }
        }
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error) {
        console.log(`  ❌ Error searching ${range.label}:`, error.message);
      }
    }

    console.log('');
    console.log('📈 ANALYSIS RESULTS:');
    console.log('====================');
    console.log('Total deposits found:', allDeposits.length);
    console.log('Total referrals found:', allReferrals.length);
    console.log('');

    if (allReferrals.length > 0) {
      console.log('🎯 REFERRAL DETAILS:');
      allReferrals.forEach((ref, i) => {
        const inCurrentWeek = ref.timestamp >= currentWeekStart && ref.timestamp < currentWeekEnd;
        const weekStatus = inCurrentWeek ? '✅ IN CURRENT COMPETITION WEEK' : '❌ OUTSIDE CURRENT WEEK';
        
        console.log(`${i + 1}. ${ref.amount} BNB - Block ${ref.blockNumber}`);
        console.log(`   Referrer: ${ref.referrer}`);
        console.log(`   User: ${ref.user}`);
        console.log(`   Date: ${ref.date}`);
        console.log(`   Week Status: ${weekStatus}`);
        console.log(`   TX: ${ref.txHash}`);
        console.log('');
      });

      // Count referrals in current competition week
      const currentWeekReferrals = allReferrals.filter(ref => 
        ref.timestamp >= currentWeekStart && ref.timestamp < currentWeekEnd
      );

      console.log('📊 COMPETITION WEEK ANALYSIS:');
      console.log('============================');
      console.log('Referrals in current competition week:', currentWeekReferrals.length);
      
      if (currentWeekReferrals.length > 0) {
        console.log('✅ SHOULD BE ON LEADERBOARD:');
        const leaderboard = {};
        
        currentWeekReferrals.forEach(ref => {
          if (!leaderboard[ref.referrer]) {
            leaderboard[ref.referrer] = {
              referrer: ref.referrer,
              totalAmount: 0,
              referralCount: 0,
              referrals: []
            };
          }
          leaderboard[ref.referrer].totalAmount += parseFloat(ref.amount);
          leaderboard[ref.referrer].referralCount += 1;
          leaderboard[ref.referrer].referrals.push(ref);
        });

        Object.values(leaderboard).forEach((entry, i) => {
          console.log(`${i + 1}. ${entry.referrer}`);
          console.log(`   Total: ${entry.totalAmount.toFixed(4)} BNB`);
          console.log(`   Referrals: ${entry.referralCount}`);
          console.log('');
        });
      } else {
        console.log('❌ No referrals found in current competition week');
        console.log('This explains why the leaderboard is empty.');
      }
    } else {
      console.log('❌ NO REFERRALS FOUND');
      console.log('Possible reasons:');
      console.log('1. No referral activity in the searched timeframe');
      console.log('2. Need to search further back in blockchain history');
      console.log('3. All deposits are direct (no referrer)');
      console.log('4. Referral system might not be working correctly');
    }

    console.log('');
    console.log('🔧 NEXT STEPS TO DEBUG:');
    console.log('========================');
    console.log('1. Check if user provided specific referral transaction');
    console.log('2. Verify the referral transaction is within competition timeframe');
    console.log('3. Check if weekly leaderboard cron job is running');
    console.log('4. Verify Redis database is being updated');
    console.log('5. Test manual trigger of weekly update');

  } catch (error) {
    console.error('❌ Error in referral debugging:', error);
  }
}

// Run the debug
debugReferralIssue();
