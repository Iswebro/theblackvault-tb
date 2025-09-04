const { ethers } = require('ethers');

// Contract configuration
const CONTRACT_ADDRESS = "0x22708D8a54c044CbA5B237620Af42030cbf76E14";
const RPC_URL = "https://rpc.ankr.com/bsc/608da03fc0a1cb8d5a5a6df34cb8bc598dfa27f71213d822afb470aaf0018ee4";

// Target wallet address
const TARGET_REFERRER = "0xB98e82C611BFc1b852412268fd300E28fAEE4D48";

// ABI for events - checking both possible event names
const CONTRACT_ABI = [
  "event Deposit(address indexed user, address indexed referrer, uint256 amount, uint256 timestamp)",
  "event Deposited(address indexed user, uint256 amount, address indexed referrer, uint256 cycle)"
];

// Timestamp constants
const COMPETITION_LAUNCH_TIMESTAMP = 1755118800; // August 14, 2025 07:00 AEST
const WEEK_DURATION = 7 * 24 * 60 * 60; // 1 week in seconds

async function debugSpecificReferrer() {
  try {
    console.log('🔍 DEBUGGING SPECIFIC REFERRER');
    console.log('===============================');
    console.log('Target referrer:', TARGET_REFERRER);
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

    // Setup provider and contract
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);

    // Get latest block
    const latestBlock = await provider.getBlockNumber();
    console.log('📊 BLOCKCHAIN INFO:');
    console.log('Latest block:', latestBlock);
    console.log('');

    // Search for events involving this specific referrer
    console.log('🔎 SEARCHING FOR REFERRALS BY TARGET WALLET...');
    
    let allReferrals = [];
    
    // Search through multiple block ranges
    const searchRanges = [
      { from: latestBlock - 1000, to: latestBlock, blocks: 1000 },
      { from: latestBlock - 5000, to: latestBlock - 1000, blocks: 4000 },
      { from: latestBlock - 10000, to: latestBlock - 5000, blocks: 5000 },
      { from: latestBlock - 20000, to: latestBlock - 10000, blocks: 10000 },
    ];

    for (const range of searchRanges) {
      try {
        console.log(`Searching last ${range.blocks} blocks (${range.from} to ${range.to})...`);
        
        // Try both event types
        const eventTypes = [
          { name: "Deposit", filter: contract.filters.Deposit(null, TARGET_REFERRER) },
          { name: "Deposited", filter: contract.filters.Deposited(null, null, TARGET_REFERRER) }
        ];

        for (const eventType of eventTypes) {
          try {
            console.log(`  Checking ${eventType.name} events...`);
            const events = await contract.queryFilter(eventType.filter, Math.max(0, range.from), range.to);
            
            console.log(`  Found ${events.length} ${eventType.name} events for this referrer`);
            
            if (events.length > 0) {
              for (const event of events) {
                const block = await provider.getBlock(event.blockNumber);
                
                let referralData;
                if (eventType.name === "Deposit") {
                  referralData = {
                    eventType: "Deposit",
                    user: event.args.user,
                    referrer: event.args.referrer,
                    amount: ethers.formatEther(event.args.amount),
                    timestamp: event.args.timestamp || block.timestamp,
                    blockNumber: event.blockNumber,
                    txHash: event.transactionHash
                  };
                } else {
                  referralData = {
                    eventType: "Deposited",
                    user: event.args.user,
                    referrer: event.args.referrer,
                    amount: ethers.formatEther(event.args.amount),
                    cycle: event.args.cycle?.toString(),
                    timestamp: block.timestamp,
                    blockNumber: event.blockNumber,
                    txHash: event.transactionHash
                  };
                }
                
                referralData.date = new Date(referralData.timestamp * 1000).toISOString();
                allReferrals.push(referralData);
                
                console.log(`  ✅ REFERRAL FOUND!`);
                console.log(`     Event Type: ${referralData.eventType}`);
                console.log(`     Amount: ${referralData.amount} BNB`);
                console.log(`     User: ${referralData.user}`);
                console.log(`     Date: ${referralData.date}`);
                console.log(`     Block: ${referralData.blockNumber}`);
                console.log(`     TX: ${referralData.txHash}`);
                if (referralData.cycle) console.log(`     Cycle: ${referralData.cycle}`);
                console.log('');
              }
            }
          } catch (eventError) {
            console.log(`  ❌ Error checking ${eventType.name} events:`, eventError.message);
          }
        }
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (rangeError) {
        console.log(`❌ Error searching range:`, rangeError.message);
      }
    }

    console.log('📈 ANALYSIS RESULTS:');
    console.log('====================');
    console.log('Total referrals found for this address:', allReferrals.length);
    console.log('');

    if (allReferrals.length > 0) {
      console.log('🎯 DETAILED REFERRAL ANALYSIS:');
      
      // Calculate current week bounds
      const currentWeekStart = COMPETITION_LAUNCH_TIMESTAMP + competitionWeekIndex * WEEK_DURATION;
      const currentWeekEnd = currentWeekStart + WEEK_DURATION;
      
      console.log('Current competition week bounds:');
      console.log('  Start:', new Date(currentWeekStart * 1000).toISOString());
      console.log('  End:', new Date(currentWeekEnd * 1000).toISOString());
      console.log('');

      let currentWeekReferrals = 0;
      let totalAmount = 0;

      allReferrals.forEach((ref, i) => {
        const inCurrentWeek = ref.timestamp >= currentWeekStart && ref.timestamp < currentWeekEnd;
        const inCompetitionPeriod = ref.timestamp >= COMPETITION_LAUNCH_TIMESTAMP;
        
        console.log(`${i + 1}. ${ref.amount} BNB (${ref.eventType})`);
        console.log(`   User: ${ref.user}`);
        console.log(`   Date: ${ref.date}`);
        console.log(`   Block: ${ref.blockNumber}`);
        console.log(`   TX: ${ref.txHash}`);
        console.log(`   In Competition Period: ${inCompetitionPeriod ? '✅ YES' : '❌ NO'}`);
        console.log(`   In Current Week: ${inCurrentWeek ? '✅ YES' : '❌ NO'}`);
        
        if (inCurrentWeek) {
          currentWeekReferrals++;
          totalAmount += parseFloat(ref.amount);
        }
        console.log('');
      });

      console.log('📊 LEADERBOARD STATUS:');
      console.log('======================');
      console.log('Referrals in current competition week:', currentWeekReferrals);
      console.log('Total amount in current week:', totalAmount.toFixed(4), 'BNB');
      
      if (currentWeekReferrals > 0) {
        console.log('✅ THIS REFERRER SHOULD BE ON THE LEADERBOARD!');
        console.log('');
        console.log('🔧 POSSIBLE ISSUES:');
        console.log('1. Cron job not running or has errors');
        console.log('2. Event name mismatch in aggregation script');
        console.log('3. Redis database not being updated');
        console.log('4. Manual trigger needed');
      } else {
        console.log('❌ No referrals in current competition week');
        console.log('This explains why they are not on the leaderboard');
      }
    } else {
      console.log('❌ NO REFERRALS FOUND FOR THIS ADDRESS');
      console.log('Possible reasons:');
      console.log('1. Address has not made any referrals yet');
      console.log('2. Referrals are older than searched timeframe');
      console.log('3. Different event structure than expected');
      console.log('4. Address might be a referred user, not a referrer');
    }

  } catch (error) {
    console.error('❌ Error in specific referrer debug:', error);
  }
}

// Run the debug
debugSpecificReferrer();
