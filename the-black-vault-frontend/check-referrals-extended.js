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

async function searchBlockRange(contract, provider, fromBlock, toBlock, label) {
  console.log(`🔎 Searching ${label}: blocks ${fromBlock} to ${toBlock}`);
  
  try {
    const filter = contract.filters.Deposit();
    const events = await contract.queryFilter(filter, fromBlock, toBlock);
    
    console.log(`📈 Found ${events.length} deposit events in ${label}`);
    
    if (events.length > 0) {
      let referralCount = 0;
      for (const event of events) {
        if (event.args.referrer !== '0x0000000000000000000000000000000000000000') {
          referralCount++;
          const block = await provider.getBlock(event.blockNumber);
          console.log(`✅ Referral found: ${ethers.formatEther(event.args.amount)} BNB`);
          console.log(`   Referrer: ${event.args.referrer}`);
          console.log(`   User: ${event.args.user}`);
          console.log(`   Time: ${new Date(block.timestamp * 1000).toISOString()}`);
          console.log(`   TX: ${event.transactionHash}`);
          console.log('');
        }
      }
      console.log(`Total referrals in ${label}: ${referralCount}`);
    }
    
    return events;
  } catch (error) {
    console.log(`❌ Error searching ${label}:`, error.message);
    return [];
  }
}

async function checkReferralDataExtended() {
  try {
    console.log('🔍 Extended referral data check from blockchain...');
    console.log('Current time:', new Date().toISOString());
    console.log('');

    // Calculate current week info
    const nowTs = Math.floor(Date.now() / 1000);
    const competitionWeekIndex = Math.floor((nowTs - COMPETITION_LAUNCH_TIMESTAMP) / WEEK_DURATION);

    console.log('📅 Week Calculations:');
    console.log('Current timestamp:', nowTs);
    console.log('Competition week index:', competitionWeekIndex);
    console.log('Competition started:', new Date(COMPETITION_LAUNCH_TIMESTAMP * 1000).toISOString());
    console.log('');

    // Setup provider and contract
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);

    // Get latest block
    const latestBlock = await provider.getBlockNumber();
    console.log('Latest block:', latestBlock);
    console.log('');

    // Search different ranges to find activity
    const ranges = [
      { from: latestBlock - 50, to: latestBlock, label: "Last 50 blocks" },
      { from: latestBlock - 200, to: latestBlock - 50, label: "Blocks 51-200 ago" },
      { from: latestBlock - 500, to: latestBlock - 200, label: "Blocks 201-500 ago" },
      { from: latestBlock - 1000, to: latestBlock - 500, label: "Blocks 501-1000 ago" },
      { from: latestBlock - 2000, to: latestBlock - 1000, label: "Blocks 1001-2000 ago" },
    ];

    let allEvents = [];
    for (const range of ranges) {
      const events = await searchBlockRange(
        contract, 
        provider, 
        Math.max(0, range.from), 
        range.to, 
        range.label
      );
      allEvents = allEvents.concat(events);
      
      // Add a small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('📊 SUMMARY:');
    console.log('===========');
    console.log('Total deposit events found:', allEvents.length);

    // Count referrals
    let totalReferrals = 0;
    let currentWeekReferrals = 0;
    let previousWeekReferrals = 0;

    const currentWeekStart = COMPETITION_LAUNCH_TIMESTAMP + competitionWeekIndex * WEEK_DURATION;
    const currentWeekEnd = currentWeekStart + WEEK_DURATION;
    const previousWeekStart = COMPETITION_LAUNCH_TIMESTAMP + (competitionWeekIndex - 1) * WEEK_DURATION;
    const previousWeekEnd = previousWeekStart + WEEK_DURATION;

    for (const event of allEvents) {
      if (event.args.referrer !== '0x0000000000000000000000000000000000000000') {
        totalReferrals++;
        
        const block = await provider.getBlock(event.blockNumber);
        const eventTimestamp = block.timestamp;
        
        if (eventTimestamp >= currentWeekStart && eventTimestamp < currentWeekEnd) {
          currentWeekReferrals++;
        }
        if (eventTimestamp >= previousWeekStart && eventTimestamp < previousWeekEnd) {
          previousWeekReferrals++;
        }
      }
    }

    console.log('Total referrals found:', totalReferrals);
    console.log('Current competition week referrals:', currentWeekReferrals);
    console.log('Previous competition week referrals:', previousWeekReferrals);
    console.log('');

    console.log('🎯 ANALYSIS:');
    console.log('============');
    console.log('Current week has referrals:', currentWeekReferrals > 0 ? 'YES ✅' : 'NO ❌');
    console.log('Previous week had referrals:', previousWeekReferrals > 0 ? 'YES ✅' : 'NO ❌');
    console.log('Overall activity detected:', totalReferrals > 0 ? 'YES ✅' : 'NO ❌');

    if (totalReferrals === 0) {
      console.log('');
      console.log('⚠️  POSSIBLE REASONS FOR NO REFERRALS:');
      console.log('1. No deposits with referrers in the searched time period');
      console.log('2. Users are depositing without using referral links');
      console.log('3. Need to search further back in blockchain history');
      console.log('4. Contract might have different event structure');
      console.log('5. Most activity might be older than the searched blocks');
    }

  } catch (error) {
    console.error('❌ Error in extended referral check:', error);
  }
}

// Run the extended check
checkReferralDataExtended();
