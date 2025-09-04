import { Redis } from '@upstash/redis';
import { ethers } from 'ethers';

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

// Contract configuration
const CONTRACT_ADDRESS = "0x22708D8a54c044CbA5B237620Af42030cbf76E14";
const RPC_URL = "https://rpc.ankr.com/bsc/608da03fc0a1cb8d5a5a6df34cb8bc598dfa27f71213d822afb470aaf0018ee4";

// Timestamp constants
const COMPETITION_LAUNCH_TIMESTAMP = 1755118800; // August 14, 2025 07:00 AEST
const WEEK_DURATION = 7 * 24 * 60 * 60; // 1 week in seconds

// ABI for both possible event types
const CONTRACT_ABI = [
  "event Deposit(address indexed user, address indexed referrer, uint256 amount, uint256 timestamp)",
  "event Deposited(address indexed user, uint256 amount, address indexed referrer, uint256 cycle)"
];

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  try {
    console.log('🔧 Manual leaderboard fix started...');
    
    // Calculate current week
    const nowTs = Math.floor(Date.now() / 1000);
    const competitionWeekIndex = Math.floor((nowTs - COMPETITION_LAUNCH_TIMESTAMP) / WEEK_DURATION);
    
    const currentWeekStart = COMPETITION_LAUNCH_TIMESTAMP + competitionWeekIndex * WEEK_DURATION;
    const currentWeekEnd = currentWeekStart + WEEK_DURATION;
    
    console.log(`Processing week ${competitionWeekIndex}:`);
    console.log(`Start: ${new Date(currentWeekStart * 1000).toISOString()}`);
    console.log(`End: ${new Date(currentWeekEnd * 1000).toISOString()}`);

    // Setup blockchain connection
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
    
    // Get latest block
    const latestBlock = await provider.getBlockNumber();
    console.log('Latest block:', latestBlock);

    // Search for referral events in smaller chunks
    let allReferrals = [];
    const searchRanges = [
      { from: latestBlock - 100, to: latestBlock },
      { from: latestBlock - 500, to: latestBlock - 100 },
      { from: latestBlock - 1000, to: latestBlock - 500 },
      { from: latestBlock - 2000, to: latestBlock - 1000 },
      { from: latestBlock - 5000, to: latestBlock - 2000 },
    ];

    for (const range of searchRanges) {
      try {
        console.log(`Searching blocks ${range.from} to ${range.to}...`);
        
        // Try Deposit events first
        try {
          const depositFilter = contract.filters.Deposit();
          const depositEvents = await contract.queryFilter(depositFilter, Math.max(0, range.from), range.to);
          
          for (const event of depositEvents) {
            if (event.args.referrer !== '0x0000000000000000000000000000000000000000') {
              const block = await provider.getBlock(event.blockNumber);
              const eventTimestamp = block.timestamp;
              
              // Check if in current competition week
              if (eventTimestamp >= currentWeekStart && eventTimestamp < currentWeekEnd) {
                allReferrals.push({
                  referrer: event.args.referrer,
                  user: event.args.user,
                  amount: parseFloat(ethers.formatEther(event.args.amount)),
                  timestamp: eventTimestamp,
                  txHash: event.transactionHash,
                  blockNumber: event.blockNumber,
                  eventType: 'Deposit'
                });
                
                console.log(`Found referral: ${event.args.referrer} -> ${ethers.formatEther(event.args.amount)} BNB`);
              }
            }
          }
        } catch (err) {
          console.log('Deposit events error:', err.message.substring(0, 100));
        }

        // Also try Deposited events
        try {
          const depositedFilter = contract.filters.Deposited();
          const depositedEvents = await contract.queryFilter(depositedFilter, Math.max(0, range.from), range.to);
          
          for (const event of depositedEvents) {
            if (event.args.referrer !== '0x0000000000000000000000000000000000000000') {
              const block = await provider.getBlock(event.blockNumber);
              const eventTimestamp = block.timestamp;
              
              // Check if in current competition week
              if (eventTimestamp >= currentWeekStart && eventTimestamp < currentWeekEnd) {
                allReferrals.push({
                  referrer: event.args.referrer,
                  user: event.args.user,
                  amount: parseFloat(ethers.formatEther(event.args.amount)),
                  timestamp: eventTimestamp,
                  txHash: event.transactionHash,
                  blockNumber: event.blockNumber,
                  eventType: 'Deposited'
                });
                
                console.log(`Found referral: ${event.args.referrer} -> ${ethers.formatEther(event.args.amount)} BNB`);
              }
            }
          }
        } catch (err) {
          console.log('Deposited events error:', err.message.substring(0, 100));
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (rangeError) {
        console.log(`Range error:`, rangeError.message.substring(0, 100));
      }
    }

    console.log(`Found ${allReferrals.length} referrals in current week`);

    // Aggregate by referrer
    const leaderboard = {};
    
    allReferrals.forEach(ref => {
      const referrer = ref.referrer.toLowerCase();
      
      if (!leaderboard[referrer]) {
        leaderboard[referrer] = {
          referrer: ref.referrer, // Keep original case
          totalAmount: 0,
          referralCount: 0,
          referrals: []
        };
      }
      
      leaderboard[referrer].totalAmount += ref.amount;
      leaderboard[referrer].referralCount += 1;
      leaderboard[referrer].referrals.push(ref);
    });

    // Convert to sorted array
    const sortedLeaderboard = Object.values(leaderboard)
      .sort((a, b) => b.totalAmount - a.totalAmount);

    // Save to Redis
    const weeklyData = {
      weekIndex: competitionWeekIndex,
      leaderboard: sortedLeaderboard,
      totalEntries: sortedLeaderboard.length,
      generatedAt: nowTs,
      manuallyFixed: true,
      fixedAt: new Date().toISOString()
    };

    const weekKey = `leaderboard:weekly:${competitionWeekIndex}`;
    await redis.set(weekKey, weeklyData);

    console.log(`Saved ${sortedLeaderboard.length} entries to ${weekKey}`);

    // Check if target address is now in leaderboard
    const targetAddress = "0xB98e82C611BFc1b852412268fd300E28fAEE4D48";
    const targetEntry = sortedLeaderboard.find(entry => 
      entry.referrer.toLowerCase() === targetAddress.toLowerCase()
    );

    return res.status(200).json({
      success: true,
      message: "Manual leaderboard fix completed",
      data: {
        weekIndex: competitionWeekIndex,
        totalReferralsFound: allReferrals.length,
        leaderboardEntries: sortedLeaderboard.length,
        targetAddressFound: !!targetEntry,
        targetEntry: targetEntry || null,
        leaderboard: sortedLeaderboard
      }
    });

  } catch (error) {
    console.error("Error in manual fix:", error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
