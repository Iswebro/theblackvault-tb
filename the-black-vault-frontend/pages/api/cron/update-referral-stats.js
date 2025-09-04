// pages/api/cron/update-referral-stats.js
// Background cron job to update referral statistics in Upstash
// This prevents expensive RPC calls on the frontend

import { Redis } from '@upstash/redis';
import { ethers } from 'ethers';

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

// RPC configuration - use the proper Ankr endpoint with API key from env
const RPC_URL = process.env.BSC_RPC_URL || process.env.NEXT_PUBLIC_RPC_URL || 'https://bsc-dataseed.binance.org/';
const CONTRACT_ADDRESS = '0x22708D8a54c044CbA5B237620Af42030cbf76E14';
const DEFAULT_REFERRER = '0x706961C676FE743C34A867437661D13E16ADCbEc';

// BlackVault ABI - only the parts we need
const BLACK_VAULT_ABI = [
  "event Deposited(address indexed user, uint256 amount, address indexed referrer, uint256 cycle)",
  "event DepositWithReferrer(address indexed user, uint256 amount, address indexed referrer)", // Alternative event name
  "function getUserReferralData(address user) view returns (uint256 totalRewards, uint256 availableRewards, uint256 referredCount, uint256 totalVolume, uint256 totalWithdrawn)",
  "function getReferralBonusInfo(address referrer, address referee) view returns (uint256 used, uint256 remaining)"
];

// Helper function to query events with aggressive rate limiting - focusing on recent blocks
const queryEventsWithRetry = async (contract, filter, blockRanges = [-5000, -10000, -25000]) => {
  console.log(`🔍 CRON: Starting queryEventsWithRetry with filter:`, filter);
  console.log(`🔍 CRON: Block ranges to try:`, blockRanges);
  
  for (let i = 0; i < blockRanges.length; i++) {
    const blockRange = blockRanges[i];
    try {
      console.log(`🔍 CRON: Trying event query with ${Math.abs(blockRange)} block range...`);
      if (i > 0) {
        // Add short delays between retries
        console.log(`🔍 CRON: Adding delay of ${500 * i}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, 500 * i));
      }
      
      const events = await contract.queryFilter(filter, blockRange);
      console.log(`🔍 CRON: Successfully found ${events.length} events with ${Math.abs(blockRange)} range`);
      
      if (events.length > 0) {
        // Log some sample events for debugging
        console.log(`🔍 CRON: Sample event data:`, events.slice(0, 1).map(e => ({
          blockNumber: e.blockNumber,
          transactionHash: e.transactionHash,
          eventName: e.fragment?.name || 'Unknown',
          args: e.args ? {
            user: e.args.user,
            amount: e.args.amount?.toString(),
            referrer: e.args.referrer,
            cycle: e.args.cycle?.toString()
          } : 'No args'
        })));
      }
      return events;
    } catch (error) {
      console.warn(`⚠️ CRON: Event query failed with ${Math.abs(blockRange)} range:`, error.message);
      if (i === blockRanges.length - 1) {
        console.error("❌ CRON: All event query attempts failed");
        return [];
      }
    }
  }
  return [];
};

// Get recent deposits and update existing data incrementally
const getRecentDepositsAndUpdate = async (contract) => {
  try {
    console.log("🔍 CRON: Getting recent deposits for incremental updates...");
    const depositFilter = contract.filters.Deposited();
    
    // Get last processed block from Redis (if any)
    let lastProcessedBlock;
    try {
      const lastBlockData = await redis.get('referral-stats:last-processed-block');
      lastProcessedBlock = lastBlockData ? parseInt(lastBlockData) : null;
      console.log("🔍 CRON: Last processed block from Redis:", lastProcessedBlock);
    } catch (error) {
      console.warn("⚠️ CRON: Could not get last processed block from Redis:", error.message);
      lastProcessedBlock = null;
    }
    
    // If no last processed block, do a full sync from deployment
    if (!lastProcessedBlock) {
      console.log("🔍 CRON: No last processed block found, doing full historical sync...");
      try {
        const allEvents = await contract.queryFilter(depositFilter, 42296467); // From deployment
        console.log(`🔍 CRON: Found ${allEvents.length} total historical deposit events for full sync`);
        
        // Update last processed block to current block
        const currentBlock = await contract.provider.getBlockNumber();
        await redis.set('referral-stats:last-processed-block', currentBlock.toString());
        console.log("🔍 CRON: Set last processed block to:", currentBlock);
        
        return { events: allEvents, isFullSync: true };
      } catch (error) {
        console.warn("⚠️ CRON: Full historical sync failed, falling back to recent blocks:", error.message);
        lastProcessedBlock = null;
      }
    }
    
    // Get events since last processed block
    let recentEvents = [];
    if (lastProcessedBlock) {
      console.log(`🔍 CRON: Getting deposits since block ${lastProcessedBlock}...`);
      try {
        recentEvents = await contract.queryFilter(depositFilter, lastProcessedBlock + 1);
        console.log(`🔍 CRON: Found ${recentEvents.length} new deposit events since last sync`);
      } catch (error) {
        console.warn("⚠️ CRON: Incremental sync failed, falling back to recent blocks:", error.message);
      }
    }
    
    // If incremental sync failed or no recent events, fall back to recent blocks
    if (recentEvents.length === 0 && !lastProcessedBlock) {
      console.log("🔍 CRON: Falling back to recent blocks approach...");
      recentEvents = await queryEventsWithRetry(contract, depositFilter, [-5000, -10000]);
    }
    
    // Update last processed block
    if (recentEvents.length > 0) {
      const latestBlock = Math.max(...recentEvents.map(e => e.blockNumber));
      await redis.set('referral-stats:last-processed-block', latestBlock.toString());
      console.log("🔍 CRON: Updated last processed block to:", latestBlock);
    }
    
    return { events: recentEvents, isFullSync: false };
  } catch (error) {
    console.error("❌ CRON: Error in getRecentDepositsAndUpdate:", error);
    return { events: [], isFullSync: false };
  }
};

// Process deposits and update existing user data in Upstash
const updateUserDataFromDeposits = async (contract, depositEvents, isFullSync = false) => {
  try {
    console.log(`🔍 CRON: Processing ${depositEvents.length} deposit events (fullSync: ${isFullSync})...`);
    
    // Get all unique referrers from the events
    const referrersFromEvents = [...new Set(
      depositEvents
        .map(event => event.args.referrer.toLowerCase())
        .filter(referrer => 
          referrer !== ethers.ZeroAddress.toLowerCase() && 
          referrer !== DEFAULT_REFERRER.toLowerCase()
        )
    )];
    
    console.log(`🔍 CRON: Found ${referrersFromEvents.length} unique referrers in ${isFullSync ? 'full sync' : 'incremental'} events`);
    
    // If it's not a full sync, also get existing referrers from Redis to maintain their data
    let existingReferrers = [];
    if (!isFullSync) {
      try {
        const existingData = await redis.get('referral-stats:users');
        if (existingData && typeof existingData === 'object') {
          existingReferrers = Object.keys(existingData).map(addr => addr.toLowerCase());
          console.log(`🔍 CRON: Found ${existingReferrers.length} existing referrers in Redis`);
        }
      } catch (error) {
        console.warn("⚠️ CRON: Could not get existing referrers from Redis:", error.message);
      }
    }
    
    // Also check for known active referrers from direct contract calls
    let knownActiveReferrers = [];
    try {
      // Try to get a list of known referrers who have significant activity
      // This helps populate users who might not appear in recent blockchain events
      const testKnownUsers = [
        '0xdee2027d2d42f11822f8bf448ed9e41556f360b3', // Known active referrer
        // Add more known active users here as needed
      ];
      
      for (const userAddr of testKnownUsers) {
        try {
          // Quick test: does this user have referral data?
          const referralData = await contract.getUserReferralData(userAddr);
          const referredCount = parseInt(referralData[2].toString());
          if (referredCount > 0) {
            knownActiveReferrers.push(userAddr.toLowerCase());
            console.log(`🔍 CRON: Added known active referrer ${userAddr} (${referredCount} referrals)`);
          }
        } catch (error) {
          console.warn(`⚠️ CRON: Could not check known user ${userAddr}:`, error.message);
        }
      }
    } catch (error) {
      console.warn("⚠️ CRON: Error checking known active referrers:", error.message);
    }
    
    // Combine all referrers: from events, existing in Redis, and known active
    const allReferrers = [...new Set([...referrersFromEvents, ...existingReferrers, ...knownActiveReferrers])];
    console.log(`🔍 CRON: Total referrers to process: ${allReferrers.length} (${referrersFromEvents.length} from events + ${existingReferrers.length} existing + ${knownActiveReferrers.length} known active)`);
    
    return allReferrers.slice(0, 100); // Limit to prevent timeout
  } catch (error) {
    console.error("❌ CRON: Error in updateUserDataFromDeposits:", error);
    return [];
  }
};

// Update default referrer stats
const updateDefaultReferrerStats = async (contract) => {
    // Helper: get event signature topics with null check
    const getEventTopic = (eventName) => {
      try {
        if (contract?.interface?.getEventTopic) {
          return contract.interface.getEventTopic(eventName);
        }
        console.warn(`⚠️ CRON: Cannot get event topic for ${eventName} - interface not available`);
        return null;
      } catch (error) {
        console.warn(`⚠️ CRON: Error getting event topic for ${eventName}:`, error.message);
        return null;
      }
    };

  try {
    console.log("🔍 CRON: Updating default referrer stats...");
    
    // Get default referrer's contract data
    const defaultReferralData = await contract.getUserReferralData(DEFAULT_REFERRER);
    
    // Get ALL deposit events to analyze which ones used default referrer
    console.log("🔍 CRON: Getting all deposit events to analyze default referrer usage...");
    console.log("🔍 CRON: Contract address:", CONTRACT_ADDRESS);
    console.log("🔍 CRON: Default referrer:", DEFAULT_REFERRER);
    
    // Test provider connection - create a new provider instance if needed
    let provider = contract.provider;
    if (!provider) {
      console.warn("⚠️ CRON: Contract provider undefined, creating new provider");
      provider = new ethers.JsonRpcProvider(RPC_URL);
      // Recreate contract with new provider
      contract = new ethers.Contract(CONTRACT_ADDRESS, BLACK_VAULT_ABI, provider);
    }
    
    // First test - get current block number to verify connection
    const currentBlock = await provider.getBlockNumber();
    console.log("🔍 CRON: Current block number:", currentBlock);
    console.log("🔍 CRON: Network:", await provider.getNetwork());
    
    // Test contract connection by calling a simple view function
    try {
      const testCall = await contract.getUserReferralData(DEFAULT_REFERRER);
      console.log("🔍 CRON: Contract connection test successful - default referrer data:", {
        totalRewards: ethers.formatEther(testCall[0]),
        totalReferrals: testCall[2].toString()
      });
    } catch (contractError) {
      console.error("❌ CRON: Contract connection test failed:", contractError.message);
    }
    
    // Query both Deposited and DepositWithReferrer events, merge results
    console.log("🔍 CRON: Creating event filters...");
    console.log("🔍 CRON: Contract instance:", !!contract);
    console.log("🔍 CRON: Contract interface:", !!contract.interface);
    console.log("🔍 CRON: Contract filters:", !!contract.filters);
    
    let depositedFilter, depositWithRefFilter;
    try {
      if (contract.filters && contract.filters.Deposited) {
        depositedFilter = contract.filters.Deposited();
        console.log("✅ CRON: Deposited filter created successfully:", depositedFilter);
      } else {
        console.error("❌ CRON: Deposited filter method not available on contract");
        depositedFilter = null;
      }
    } catch (filterError) {
      console.error("❌ CRON: Failed to create Deposited filter:", filterError.message);
      depositedFilter = null;
    }
    
    try {
      if (contract.filters && contract.filters.DepositWithReferrer) {
        depositWithRefFilter = contract.filters.DepositWithReferrer();
        console.log("✅ CRON: DepositWithReferrer filter created successfully:", depositWithRefFilter);
      } else {
        console.error("❌ CRON: DepositWithReferrer filter method not available on contract");
        depositWithRefFilter = null;
      }
    } catch (filterError) {
      console.error("❌ CRON: Failed to create DepositWithReferrer filter:", filterError.message);
      depositWithRefFilter = null;
    }
    
    console.log("🔍 CRON: Contract interface events:", contract.interface?.events ? Object.keys(contract.interface.events) : "No events found");
    console.log("🔍 CRON: Available contract filter methods:", contract.filters ? Object.keys(contract.filters) : "No filters found");
    
    // Debug: Let's see the exact event signatures in our ABI
    console.log("🔍 CRON: ABI event signatures:");
    BLACK_VAULT_ABI.filter(item => item.startsWith('event')).forEach(event => {
      console.log(`  - ${event}`);
    });

    // Query both event types in recent blocks (simplified approach)
    console.log("🔍 CRON: Starting simplified event queries...");
    let depositedEvents = [];
    let depositWithRefEvents = [];
    
    if (depositedFilter) {
      try {
        depositedEvents = await queryEventsWithRetry(contract, depositedFilter, [-5000, -10000]);
        console.log(`🔍 CRON: Deposited events query completed: ${depositedEvents.length} events`);
      } catch (error) {
        console.warn("⚠️ CRON: Deposited events query failed:", error.message);
      }
    } else {
      console.warn("⚠️ CRON: Skipping Deposited events query - filter creation failed");
    }
    
    if (depositWithRefFilter) {
      try {
        depositWithRefEvents = await queryEventsWithRetry(contract, depositWithRefFilter, [-5000, -10000]);
        console.log(`🔍 CRON: DepositWithReferrer events query completed: ${depositWithRefEvents.length} events`);
      } catch (error) {
        console.warn("⚠️ CRON: DepositWithReferrer events query failed:", error.message);
      }
    } else {
      console.warn("⚠️ CRON: Skipping DepositWithReferrer events query - filter creation failed");
    }

    // Merge all events
    let allDepositEvents = [...depositedEvents, ...depositWithRefEvents];
    console.log(`🔍 CRON: Found ${depositedEvents.length} Deposited events, ${depositWithRefEvents.length} DepositWithReferrer events, merged total: ${allDepositEvents.length}`);

    // If no events found in recent blocks, try a broader range to get ALL historical data
    if (allDepositEvents.length === 0) {
      console.log("🔍 CRON: No events in recent blocks, trying FULL historical range from contract deployment...");
      try {
        // Try multiple potential deployment blocks
        const deploymentBlocks = [42296467, 42000000, 41000000]; // Try different blocks
        let foundAnyEvents = false;
        
        for (const deploymentBlock of deploymentBlocks) {
          if (foundAnyEvents) break;
          
          console.log(`🔍 CRON: Trying deployment block ${deploymentBlock}...`);
          
          // First, try to get ANY events from the contract to see if events exist at all
          console.log("🔍 CRON: Checking for ANY events from this contract...");
          try {
            const allContractLogs = await provider.getLogs({
              address: CONTRACT_ADDRESS,
              fromBlock: deploymentBlock,
              toBlock: 'latest'
            });
            console.log(`🔍 CRON: Found ${allContractLogs.length} total contract events from block ${deploymentBlock}`);
            
            if (allContractLogs.length > 0) {
              foundAnyEvents = true;
              // Try to parse the logs to see what events we have
              console.log("🔍 CRON: Sample contract events:");
              allContractLogs.slice(0, 5).forEach((log, index) => {
                try {
                  const parsed = contract.interface.parseLog(log);
                  console.log(`Event ${index + 1}: ${parsed.name}`, {
                    args: parsed.args,
                    blockNumber: log.blockNumber,
                    transactionHash: log.transactionHash.slice(0, 10) + '...'
                  });
                } catch (error) {
                  console.log(`Event ${index + 1}: Unable to parse - Topic: ${log.topics[0]}`);
                }
              });
              
              // Now try our specific event queries from this successful block
              if (depositedFilter) {
                console.log("🔍 CRON: Querying ALL Deposited events from deployment...");
                depositedEvents = await contract.queryFilter(depositedFilter, deploymentBlock);
                console.log(`🔍 CRON: Found ${depositedEvents.length} Deposited events from deployment block`);
              }
              
              if (depositWithRefFilter) {
                console.log("🔍 CRON: Querying ALL DepositWithReferrer events from deployment...");
                depositWithRefEvents = await contract.queryFilter(depositWithRefFilter, deploymentBlock);
                console.log(`🔍 CRON: Found ${depositWithRefEvents.length} DepositWithReferrer events from deployment block`);
              }
              break; // Found events, stop trying other blocks
            }
          } catch (blockError) {
            console.warn(`⚠️ CRON: Failed to query from block ${deploymentBlock}:`, blockError.message);
          }
        }
        
        allDepositEvents = [...depositedEvents, ...depositWithRefEvents];
        console.log(`🔍 CRON: Found ${allDepositEvents.length} total historical events`);
      } catch (broadError) {
        console.warn("⚠️ CRON: Historical range query failed:", broadError.message);
      }
    }

    // Process ALL deposit events (both Deposited and DepositWithReferrer)
    console.log(`🔍 CRON: Processing all ${allDepositEvents.length} deposit events...`);
    
    // Separate events by type for analysis
    const depositedEventsByType = allDepositEvents.filter(event => 
      event.fragment?.name === 'Deposited' || event.eventName === 'Deposited'
    );
    const depositWithRefEventsByType = allDepositEvents.filter(event => 
      event.fragment?.name === 'DepositWithReferrer' || event.eventName === 'DepositWithReferrer'
    );
    
    console.log(`🔍 CRON: Event breakdown - Deposited: ${depositedEventsByType.length}, DepositWithReferrer: ${depositWithRefEventsByType.length}`);

    // Process BOTH event types for default referrer analysis with CORRECTED logic
    // For default referrer: find users who deposited WITHOUT referrals (zero address or default referrer assigned)
    const noReferralEvents = allDepositEvents.filter(event => {
      if (!event.args || !event.args.referrer) return false;
      
      const referrer = event.args.referrer.toLowerCase();
      const isNoReferral = referrer === ethers.ZeroAddress.toLowerCase() || 
                          referrer === "0x0000000000000000000000000000000000000000" ||
                          referrer === DEFAULT_REFERRER.toLowerCase();
      
      console.log(`🔍 CRON: Event referrer: ${referrer}, isNoReferral: ${isNoReferral}`);
      return isNoReferral;
    });
    
    console.log(`🔍 CRON: Found ${noReferralEvents.length} events where users deposited without referrals`);
    
    // Get unique users who deposited without referrals (these earn rewards for the default referrer)
    const usersWithoutReferrals = [...new Set(noReferralEvents.map(event => event.args.user.toLowerCase()))];
    console.log(`🔍 CRON: Found ${usersWithoutReferrals.length} unique users who deposited without referrals`);
    
    // Log details of no-referral deposit events
    if (noReferralEvents.length > 0) {
      console.log("🔍 CRON: No-referral deposit events details:", noReferralEvents.map(e => ({
        eventType: e.fragment?.name || e.eventName || 'Unknown',
        blockNumber: e.blockNumber,
        user: e.args?.user, // This user deposited without a referral
        referrer: e.args?.referrer, // This is zero address or default referrer
        amount: e.args?.amount?.toString(),
        transactionHash: e.transactionHash.slice(0, 10) + '...'
      })));
    }
    
    // For debugging: also show the breakdown
    console.log("🔍 CRON: Users who deposited without referrals:", usersWithoutReferrals);

    // Use the corrected unique count - users who deposited without referrals
    let uniqueDefaultReferrals = usersWithoutReferrals;
    
    // If we couldn't get any events due to rate limiting but we have contract data showing referrals exist,
    // use a reasonable estimate based on the contract data
    if (allDepositEvents.length === 0 && parseInt(defaultReferralData[2]?.toString() || "0") > 0) {
      console.log("🔄 CRON: No events found due to rate limiting, but contract shows referrals exist. Using contract data as fallback.");
      // Create fallback users based on contract data
      const totalReferrals = parseInt(defaultReferralData[2]?.toString() || "0");
      uniqueDefaultReferrals = Array.from({length: Math.min(totalReferrals, 2)}, (_, i) => `fallback-user-${i}`);
      console.log("🔄 CRON: Using fallback referral list based on contract data");
    }

    // Print comprehensive debug information
    console.log(`🔍 CRON: Found ${allDepositEvents.length} total deposit events`);
    console.log(`🔍 CRON: Found ${noReferralEvents.length} events where users deposited without referrals`);
    console.log(`🔍 CRON: Found ${uniqueDefaultReferrals.length} unique users who deposited without referrals`);
    if (uniqueDefaultReferrals.length > 0) {
      console.log(`🔍 CRON: Users who deposited without referrals:`, uniqueDefaultReferrals);
    }
    if (allDepositEvents.length === 0) {
      console.warn("⚠️ CRON: No deposit events found. This might indicate an ABI issue or the contract has no deposits yet.");
    }

    // Get detailed information for users who deposited without referrals (for the modal)
    let noReferralUserData = [];
    if (uniqueDefaultReferrals.length > 0 && !uniqueDefaultReferrals[0]?.startsWith('fallback-user-')) {
      console.log("🔍 CRON: Getting detailed bonus info for users who deposited without referrals...");
      const maxUsersToProcess = Math.min(uniqueDefaultReferrals.length, 20);
      const usersToProcess = uniqueDefaultReferrals.slice(0, maxUsersToProcess);
      
      noReferralUserData = await Promise.all(
        usersToProcess.map(async (userAddress) => {
          try {
            // For users who deposited without referrals, check their bonus info with the default referrer
            const bonusInfo = await contract.getReferralBonusInfo(DEFAULT_REFERRER, userAddress);
            return {
              address: userAddress,
              bonusesUsed: parseInt(bonusInfo.used.toString()),
              bonusesRemaining: parseInt(bonusInfo.remaining.toString()),
            };
          } catch (error) {
            console.warn(`⚠️ CRON: Error getting bonus info for no-referral user ${userAddress}:`, error.message);
            return {
              address: userAddress,
              bonusesUsed: 0,
              bonusesRemaining: 3,
            };
          }
        })
      );
      console.log(`🔍 CRON: Got detailed info for ${noReferralUserData.length} users who deposited without referrals`);
    }

    const stats = {
      contractAddress: DEFAULT_REFERRER,
      totalRewards: ethers.formatEther(defaultReferralData[0] || 0),
      availableRewards: ethers.formatEther(defaultReferralData[1] || 0),
      totalReferrals: defaultReferralData[2]?.toString() || "0",
      uniqueReferrals: uniqueDefaultReferrals.length,
      totalVolume: ethers.formatEther(defaultReferralData[3] || 0),
      totalWithdrawn: ethers.formatEther(defaultReferralData[4] || 0),
      referrals: noReferralUserData, // Add the detailed list of users who deposited without referrals
      lastUpdated: new Date().toISOString(),
      eventCount: noReferralEvents.length,
      debugInfo: {
        totalEvents: allDepositEvents.length,
        noReferralEvents: noReferralEvents.length,
        uniqueUsers: uniqueDefaultReferrals.length,
        contractData: {
          totalRewards: ethers.formatEther(defaultReferralData[0] || 0),
          totalReferrals: defaultReferralData[2]?.toString() || "0"
        }
      }
    };

    // Store in Redis with 25 hour expiry (longer than daily cron interval)
    // Write to both lowercase and original-case keys for compatibility
    const keyOriginal = `user-referrals:${DEFAULT_REFERRER}`;
    const keyLower = `user-referrals:${DEFAULT_REFERRER.toLowerCase()}`;
    await redis.set('referral-stats:default', stats, { ex: 90000 });
    await redis.set(keyOriginal, stats, { ex: 90000 });
    await redis.set(keyLower, stats, { ex: 90000 });
    console.log("✅ CRON: Default referrer stats updated for both cases");
    return stats;
  } catch (error) {
    console.error("❌ CRON: Error updating default referrer stats:", error);
    return null;
  }
};

// Update individual user stats
const updateUserStats = async (contract, users) => {
  const userStats = {};
  const batchSize = 10; // Process users in batches to avoid overwhelming RPC
  
  // Ensure users is an array
  if (!Array.isArray(users) || users.length === 0) {
    console.log("🔍 CRON: No users to process for user stats");
    return userStats;
  }
  
  for (let i = 0; i < users.length; i += batchSize) {
    const batch = users.slice(i, i + batchSize);
    console.log(`🔍 CRON: Processing user batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(users.length/batchSize)}`);
    
    await Promise.all(batch.map(async (user) => {
      try {
        // Get user's referral data from contract
        const referralData = await contract.getUserReferralData(user);
        
        // Only process users who have referrals
        if (parseInt(referralData[2].toString()) > 0) {
          console.log(`🔍 CRON: Processing user ${user} with ${referralData[2].toString()} referrals`);
          
          // Try to get existing detailed data from our Upstash cache first
          let refereeData = [];
          let totalEvents = 0;
          let uniqueReferees = [];
          
          // For known active users, we know they have referral data, so try broader blockchain search
          console.log(`🔍 CRON: Falling back to blockchain query for ${user}`);
          try {
            // Get deposit events where this user is the referrer - try broader ranges for known users
            const depositFilter = contract.filters.Deposited(null, null, user);
            let depositEvents = [];
            
            // For known active referrers, try historical data
            const isKnownActiveUser = user.toLowerCase() === '0xdee2027d2d42f11822f8bf448ed9e41556f360b3';
            if (isKnownActiveUser) {
              console.log(`🔍 CRON: Using historical query for known active user ${user}`);
              try {
                depositEvents = await contract.queryFilter(depositFilter, 42296467); // From deployment
                console.log(`🔍 CRON: Found ${depositEvents.length} historical events for ${user}`);
              } catch (histError) {
                console.warn(`⚠️ CRON: Historical query failed for ${user}, trying recent blocks:`, histError.message);
                depositEvents = await queryEventsWithRetry(contract, depositFilter, [-100000, -50000, -25000]);
              }
            } else {
              // For other users, use recent blocks
              depositEvents = await queryEventsWithRetry(contract, depositFilter, [-50000, -25000, -10000]);
            }
            
            uniqueReferees = [...new Set(depositEvents.map(event => event.args.user.toLowerCase()))];
            totalEvents = depositEvents.length;
            
            // Get detailed referee information with bonus data (limit to prevent too many RPC calls)
            const maxRefereesToProcess = Math.min(uniqueReferees.length, 20);
            const refereesToProcess = uniqueReferees.slice(0, maxRefereesToProcess);
            
            refereeData = await Promise.all(
              refereesToProcess.map(async (refereeAddress) => {
                try {
                  const bonusInfo = await contract.getReferralBonusInfo(user, refereeAddress);
                  return {
                    address: refereeAddress,
                    bonusesUsed: parseInt(bonusInfo.used.toString()),
                    bonusesRemaining: parseInt(bonusInfo.remaining.toString()),
                  };
                } catch (error) {
                  console.warn(`⚠️ CRON: Error getting bonus info for ${refereeAddress}:`, error.message);
                  return {
                    address: refereeAddress,
                    bonusesUsed: 0,
                    bonusesRemaining: 3,
                  };
                }
              })
            );
            
            console.log(`🔍 CRON: Got ${refereeData.length} referees from blockchain for ${user} (${uniqueReferees.length} total unique)`);
          } catch (blockchainError) {
            console.warn(`⚠️ CRON: Blockchain fallback failed for ${user}:`, blockchainError.message);
          }
          
          userStats[user] = {
            contractData: {
              totalRewards: ethers.formatEther(referralData[0] || 0),
              availableRewards: ethers.formatEther(referralData[1] || 0),
              referredCount: referralData[2]?.toString() || "0",
              totalVolume: ethers.formatEther(referralData[3] || 0),
              totalWithdrawn: ethers.formatEther(referralData[4] || 0),
            },
            events: {
              totalEvents: totalEvents,
              uniqueReferees: uniqueReferees.length,
              processedReferees: refereeData.length,
              truncated: uniqueReferees.length > refereeData.length
            },
            referrals: refereeData, // Add the detailed referrals array that the modal needs
            stats: {
              totalReferralCount: referralData[2]?.toString() || "0",
              uniqueReferrals: uniqueReferees.length,
            },
            lastUpdated: new Date().toISOString()
          };
        }
        
        // Small delay between users to be gentle on RPC
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.warn(`⚠️ CRON: Error processing user ${user}:`, error.message);
      }
    }));
    
    // Delay between batches
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Store all user stats in Redis with 25 hour expiry (longer than daily cron interval)
  if (userStats && Object.keys(userStats).length > 0) {
    // Store individual user data in separate keys (what the frontend API expects)
    for (const [userAddress, userData] of Object.entries(userStats)) {
      const keyOriginal = `user-referrals:${userAddress}`;
      const keyLower = `user-referrals:${userAddress.toLowerCase()}`;
      
      // Store the same data in both formats
      await redis.set(keyOriginal, userData, { ex: 90000 });
      await redis.set(keyLower, userData, { ex: 90000 });
    }
    
    // Also store aggregate data for reference
    await redis.set('referral-stats:users', userStats, { ex: 90000 });
    console.log(`✅ CRON: Updated individual user data for ${Object.keys(userStats).length} users`);
  } else {
    console.log("🔍 CRON: No user stats to store");
  }
  
  return userStats;
};

export default async function handler(req, res) {
  const { method } = req;
  
  if (method !== 'POST' && method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify cron secret (optional security)
  // For Vercel cron jobs, check if the request is coming from Vercel's cron system
  const authHeader = req.headers.authorization;
  const userAgent = req.headers['user-agent'];
  const isVercelCron = userAgent && userAgent.includes('vercel-cron');
  
  if (process.env.CRON_SECRET && !isVercelCron && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    console.log("❌ CRON: Unauthorized access attempt");
    console.log("- User-Agent:", userAgent);
    console.log("- Authorization header:", authHeader ? "present" : "missing");
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  console.log("✅ CRON: Authorization check passed", { isVercelCron, hasAuth: !!authHeader });

  try {
    console.log("🚀 CRON: Starting referral stats update job...");
    const startTime = Date.now();
    
    // Validate required environment variables
    if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
      throw new Error("Redis environment variables not configured");
    }
    
    if (!RPC_URL) {
      throw new Error("RPC URL not configured");
    }
    
    console.log("✅ CRON: Environment variables validated");
    
    // Initialize provider and contract with error handling
    console.log("🔗 CRON: Initializing provider and contract...");
    console.log("🔗 CRON: Using RPC URL:", RPC_URL.substring(0, 50) + "...");
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    
    // Test provider connection first
    try {
      const network = await provider.getNetwork();
      const blockNumber = await provider.getBlockNumber();
      console.log(`🔗 CRON: Connected to network ${network.name} (chainId: ${network.chainId}), block: ${blockNumber}`);
    } catch (providerError) {
      console.error("❌ CRON: Provider connection failed:", providerError.message);
      throw new Error(`Provider connection failed: ${providerError.message}`);
    }
    
    const contract = new ethers.Contract(CONTRACT_ADDRESS, BLACK_VAULT_ABI, provider);
    
    // Get recent deposits and update data incrementally
    const { events: depositEvents, isFullSync } = await getRecentDepositsAndUpdate(contract);
    console.log(`🔍 CRON: Processing ${depositEvents.length} deposit events (${isFullSync ? 'full sync' : 'incremental update'})`);
    
    // Get referrers to update from the deposit events and existing data
    const referrersToUpdate = await updateUserDataFromDeposits(contract, depositEvents, isFullSync);
    console.log(`🔍 CRON: Will update ${referrersToUpdate.length} referrers`);
    
    // Update default referrer stats (with error handling)
    let defaultStats = null;
    try {
      defaultStats = await updateDefaultReferrerStats(contract);
      console.log("✅ CRON: Default referrer stats updated successfully");
    } catch (defaultError) {
      console.error("❌ CRON: Failed to update default referrer stats:", defaultError.message);
      // Don't fail the entire job, continue with user stats
    }
    
    // Update user stats for referrers found in recent deposits and existing data
    let userStats = {};
    try {
      userStats = await updateUserStats(contract, referrersToUpdate);
      console.log(`✅ CRON: User stats updated for ${Object.keys(userStats).length} users`);
    } catch (userError) {
      console.error("❌ CRON: Failed to update user stats:", userError.message);
      // Don't fail the entire job if user stats fail
    }
    
    // Store summary stats with more details for debugging
    const summary = {
      totalDeposits: depositEvents.length,
      isFullSync,
      totalReferrers: referrersToUpdate.length,
      processedUsers: userStats ? Object.keys(userStats).length : 0,
      defaultReferrerProcessed: !!defaultStats,
      defaultReferrerSuccess: defaultStats !== null,
      userStatsSuccess: Object.keys(userStats).length > 0,
      lastRun: new Date().toISOString(),
      executionTime: Date.now() - startTime,
      rpcUrl: RPC_URL ? "configured" : "missing",
      redisConnection: "working" // If we get here, Redis is working
    };
    
    // Always store the summary, even if some parts failed
    try {
      await redis.set('referral-stats:summary', summary, { ex: 7200 }); // 2 hours
      console.log("✅ CRON: Summary stats stored successfully");
    } catch (summaryError) {
      console.error("❌ CRON: Failed to store summary:", summaryError.message);
    }
    
    console.log("✅ CRON: Referral stats update completed");
    console.log(`📊 CRON: Summary:`, summary);
    
    return res.status(200).json({
      success: true,
      summary,
      message: 'Referral stats updated successfully'
    });
    
  } catch (error) {
    console.error("❌ CRON: Error in referral stats update:", error);
    return res.status(500).json({
      error: 'Failed to update referral stats',
      details: error.message
    });
  }
}
