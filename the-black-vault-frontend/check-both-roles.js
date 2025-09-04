const { ethers } = require('ethers');

// Contract configuration
const CONTRACT_ADDRESS = "0x22708D8a54c044CbA5B237620Af42030cbf76E14";
const RPC_URL = "https://rpc.ankr.com/bsc/608da03fc0a1cb8d5a5a6df34cb8bc598dfa27f71213d822afb470aaf0018ee4";

// Target wallet address
const TARGET_ADDRESS = "0xB98e82C611BFc1b852412268fd300E28fAEE4D48";

// ABI for events
const CONTRACT_ABI = [
  "event Deposit(address indexed user, address indexed referrer, uint256 amount, uint256 timestamp)",
  "event Deposited(address indexed user, uint256 amount, address indexed referrer, uint256 cycle)"
];

// Timestamp constants
const COMPETITION_LAUNCH_TIMESTAMP = 1755118800; // August 14, 2025 07:00 AEST
const WEEK_DURATION = 7 * 24 * 60 * 60; // 1 week in seconds

async function checkBothRoles() {
  try {
    console.log('🔍 CHECKING TARGET ADDRESS IN BOTH ROLES');
    console.log('==========================================');
    console.log('Target address:', TARGET_ADDRESS);
    console.log('Checking as both REFERRER and REFERRED USER');
    console.log('');

    // Calculate current week info
    const nowTs = Math.floor(Date.now() / 1000);
    const competitionWeekIndex = Math.floor((nowTs - COMPETITION_LAUNCH_TIMESTAMP) / WEEK_DURATION);

    console.log('📅 COMPETITION INFO:');
    console.log('Competition started:', new Date(COMPETITION_LAUNCH_TIMESTAMP * 1000).toISOString());
    console.log('Current competition week:', competitionWeekIndex);
    console.log('Current timestamp:', nowTs);
    
    // Current week bounds
    const currentWeekStart = COMPETITION_LAUNCH_TIMESTAMP + competitionWeekIndex * WEEK_DURATION;
    const currentWeekEnd = currentWeekStart + WEEK_DURATION;
    console.log('Current week bounds:');
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

    // Use very small block ranges to avoid RPC limits
    const searchRanges = [
      { from: latestBlock - 10, to: latestBlock, label: "Last 10 blocks" },
      { from: latestBlock - 50, to: latestBlock - 10, label: "11-50 blocks ago" },
      { from: latestBlock - 100, to: latestBlock - 50, label: "51-100 blocks ago" },
      { from: latestBlock - 200, to: latestBlock - 100, label: "101-200 blocks ago" },
      { from: latestBlock - 500, to: latestBlock - 200, label: "201-500 blocks ago" },
    ];

    let foundAsReferrer = [];
    let foundAsUser = [];

    for (const range of searchRanges) {
      try {
        console.log(`🔎 Searching ${range.label}...`);
        
        // Check as referrer (this address referring others)
        try {
          const referrerFilter = contract.filters.Deposit(null, TARGET_ADDRESS);
          const referrerEvents = await contract.queryFilter(referrerFilter, Math.max(0, range.from), range.to);
          
          if (referrerEvents.length > 0) {
            console.log(`  ✅ Found ${referrerEvents.length} events where ${TARGET_ADDRESS} is REFERRER`);
            for (const event of referrerEvents) {
              const block = await provider.getBlock(event.blockNumber);
              foundAsReferrer.push({
                role: 'referrer',
                user: event.args.user,
                referrer: event.args.referrer,
                amount: ethers.formatEther(event.args.amount),
                timestamp: block.timestamp,
                date: new Date(block.timestamp * 1000).toISOString(),
                blockNumber: event.blockNumber,
                txHash: event.transactionHash
              });
            }
          }
        } catch (err) {
          console.log(`  ❌ Error checking as referrer: ${err.message.substring(0, 100)}...`);
        }

        // Check as user (this address being referred by someone)
        try {
          const userFilter = contract.filters.Deposit(TARGET_ADDRESS, null);
          const userEvents = await contract.queryFilter(userFilter, Math.max(0, range.from), range.to);
          
          if (userEvents.length > 0) {
            console.log(`  ✅ Found ${userEvents.length} events where ${TARGET_ADDRESS} is REFERRED USER`);
            for (const event of userEvents) {
              const block = await provider.getBlock(event.blockNumber);
              foundAsUser.push({
                role: 'referred_user',
                user: event.args.user,
                referrer: event.args.referrer,
                amount: ethers.formatEther(event.args.amount),
                timestamp: block.timestamp,
                date: new Date(block.timestamp * 1000).toISOString(),
                blockNumber: event.blockNumber,
                txHash: event.transactionHash
              });
            }
          }
        } catch (err) {
          console.log(`  ❌ Error checking as user: ${err.message.substring(0, 100)}...`);
        }

        // Small delay
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (rangeError) {
        console.log(`❌ Error searching ${range.label}:`, rangeError.message);
      }
    }

    console.log('');
    console.log('📈 COMPREHENSIVE ANALYSIS:');
    console.log('==========================');
    console.log('Found as REFERRER (referring others):', foundAsReferrer.length);
    console.log('Found as REFERRED USER (being referred):', foundAsUser.length);
    console.log('');

    if (foundAsReferrer.length > 0) {
      console.log('🎯 AS REFERRER (Should appear on leaderboard):');
      let currentWeekAsReferrer = 0;
      foundAsReferrer.forEach((ref, i) => {
        const inCurrentWeek = ref.timestamp >= currentWeekStart && ref.timestamp < currentWeekEnd;
        console.log(`${i + 1}. Referred ${ref.user} for ${ref.amount} BNB`);
        console.log(`   Date: ${ref.date}`);
        console.log(`   TX: ${ref.txHash}`);
        console.log(`   In Current Week: ${inCurrentWeek ? '✅ YES' : '❌ NO'}`);
        if (inCurrentWeek) currentWeekAsReferrer++;
        console.log('');
      });
      
      if (currentWeekAsReferrer > 0) {
        console.log(`✅ SHOULD BE ON LEADERBOARD! (${currentWeekAsReferrer} referrals in current week)`);
      } else {
        console.log('❌ Not in current competition week - won\'t appear on leaderboard');
      }
    }

    if (foundAsUser.length > 0) {
      console.log('👤 AS REFERRED USER (Was referred by someone):');
      foundAsUser.forEach((ref, i) => {
        console.log(`${i + 1}. Was referred by ${ref.referrer} for ${ref.amount} BNB`);
        console.log(`   Date: ${ref.date}`);
        console.log(`   TX: ${ref.txHash}`);
        console.log('');
      });
      console.log('ℹ️  Being a referred user doesn\'t put you on the leaderboard');
    }

    if (foundAsReferrer.length === 0 && foundAsUser.length === 0) {
      console.log('❌ NO ACTIVITY FOUND');
      console.log('Possible reasons:');
      console.log('1. Address has not participated in referral system');
      console.log('2. Activity is older than searched blocks');
      console.log('3. Activity is in different time period');
      console.log('4. RPC limitations preventing full search');
      console.log('');
      console.log('💡 RECOMMENDATION: Check BSCScan directly for this address');
      console.log(`   https://bscscan.com/address/${TARGET_ADDRESS}`);
    }

  } catch (error) {
    console.error('❌ Error in comprehensive check:', error);
  }
}

// Run the comprehensive check
checkBothRoles();
