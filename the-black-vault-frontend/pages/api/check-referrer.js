import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

// Timestamp constants
const COMPETITION_LAUNCH_TIMESTAMP = 1755118800; // August 14, 2025 07:00 AEST
const WEEK_DURATION = 7 * 24 * 60 * 60; // 1 week in seconds

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const targetAddress = req.query.address || "0xB98e82C611BFc1b852412268fd300E28fAEE4D48";
    
    console.log('🔍 Checking referrer data for:', targetAddress);
    
    // Calculate current week info
    const nowTs = Math.floor(Date.now() / 1000);
    const competitionWeekIndex = Math.floor((nowTs - COMPETITION_LAUNCH_TIMESTAMP) / WEEK_DURATION);

    const result = {
      targetAddress,
      currentTime: new Date().toISOString(),
      competitionWeek: competitionWeekIndex,
      competitionStarted: new Date(COMPETITION_LAUNCH_TIMESTAMP * 1000).toISOString(),
      foundInWeeks: {},
      allWeeklyKeys: [],
      userKeys: [],
      referralKeys: [],
      addressRelatedKeys: []
    };

    // Check current week leaderboard
    const currentWeekKey = `leaderboard:weekly:${competitionWeekIndex}`;
    const currentWeekData = await redis.get(currentWeekKey);
    
    if (currentWeekData && currentWeekData.leaderboard) {
      const targetEntry = currentWeekData.leaderboard.find(entry => 
        entry.referrer.toLowerCase() === targetAddress.toLowerCase()
      );
      
      if (targetEntry) {
        result.foundInWeeks[competitionWeekIndex] = {
          ...targetEntry,
          isCurrentWeek: true
        };
      }
      
      result.currentWeekLeaderboard = {
        totalEntries: currentWeekData.leaderboard.length,
        entries: currentWeekData.leaderboard.map(entry => ({
          referrer: entry.referrer,
          totalAmount: entry.totalAmount,
          referralCount: entry.referralCount
        }))
      };
    }

    // Check all weekly leaderboard keys
    const allWeeklyKeys = await redis.keys('leaderboard:weekly:*');
    result.allWeeklyKeys = allWeeklyKeys;
    
    for (const key of allWeeklyKeys) {
      const weekData = await redis.get(key);
      const weekIndex = parseInt(key.split(':')[2]);
      
      if (weekData && weekData.leaderboard) {
        const targetEntry = weekData.leaderboard.find(entry => 
          entry.referrer.toLowerCase() === targetAddress.toLowerCase()
        );
        
        if (targetEntry) {
          result.foundInWeeks[weekIndex] = {
            ...targetEntry,
            isCurrentWeek: weekIndex === competitionWeekIndex
          };
        }
      }
    }

    // Check user-specific keys
    const userKeys = await redis.keys(`user:${targetAddress.toLowerCase()}*`);
    result.userKeys = userKeys;
    
    for (const key of userKeys) {
      const userData = await redis.get(key);
      result[`userData_${key}`] = userData;
    }

    // Check referral-specific keys
    const referralKeys = await redis.keys(`referral:*${targetAddress.toLowerCase()}*`);
    result.referralKeys = referralKeys;
    
    for (const key of referralKeys) {
      const referralData = await redis.get(key);
      result[`referralData_${key}`] = referralData;
    }

    // Search all keys for the target address
    const addressPattern = targetAddress.toLowerCase().substring(2); // Remove 0x
    const allKeys = await redis.keys('*');
    
    const relevantKeys = allKeys.filter(key => 
      key.toLowerCase().includes(addressPattern)
    );
    
    result.addressRelatedKeys = relevantKeys;
    
    for (const key of relevantKeys.slice(0, 10)) { // Limit to first 10 to avoid too much data
      const data = await redis.get(key);
      result[`relatedData_${key}`] = data;
    }

    // Analysis
    const weeksFound = Object.keys(result.foundInWeeks);
    result.analysis = {
      foundInAnyWeek: weeksFound.length > 0,
      foundInCurrentWeek: result.foundInWeeks[competitionWeekIndex] ? true : false,
      totalWeeksActive: weeksFound.length,
      weekNumbers: weeksFound.map(w => parseInt(w)),
      shouldBeOnLeaderboard: result.foundInWeeks[competitionWeekIndex] ? true : false
    };

    return res.status(200).json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error("Error checking referrer data:", error);
    return res.status(500).json({ 
      success: false,
      error: "Failed to check referrer data",
      details: error.message 
    });
  }
}
