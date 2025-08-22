// pages/api/leaderboard/weekly-winners.js
// API to get previous weeks' winners and leaderboard history

import { Redis } from '@upstash/redis';

// Competition specific constants (separate from project launch)
const COMPETITION_LAUNCH_TIMESTAMP = 1755118800; // August 14, 2025 07:00 AEST - Weekly Challenge Competition Launch
const WEEK_DURATION = 7 * 24 * 60 * 60; // 7 days in seconds

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

export default async function handler(req, res) {
  try {
    const { week } = req.query;
    
    // Calculate current week index
    const nowTs = Math.floor(Date.now() / 1000);
    const currentWeekIndex = Math.floor((nowTs - COMPETITION_LAUNCH_TIMESTAMP) / WEEK_DURATION);
    
    // If specific week requested
    if (week !== undefined) {
      const weekNum = parseInt(week);
      
      if (weekNum < 0 || weekNum > currentWeekIndex) {
        return res.status(400).json({
          success: false,
          error: `Invalid week. Must be between 0 and ${currentWeekIndex}`,
          currentWeek: currentWeekIndex
        });
      }
      
      // Get specific week data
      const weekKey = `weekly:leaderboard:${weekNum}`;
      const weekData = await redis.get(weekKey);
      
      if (!weekData) {
        return res.status(404).json({
          success: false,
          error: `No data found for week ${weekNum}`,
          currentWeek: currentWeekIndex
        });
      }
      
      return res.status(200).json({
        success: true,
        data: {
          weekIndex: weekNum,
          leaderboard: weekData.leaderboard || [],
          winner: weekData.leaderboard?.[0] || null,
          totalEntries: weekData.totalEntries || 0,
          weekPeriod: {
            start: new Date((COMPETITION_LAUNCH_TIMESTAMP + weekNum * WEEK_DURATION) * 1000).toISOString(),
            end: new Date((COMPETITION_LAUNCH_TIMESTAMP + (weekNum + 1) * WEEK_DURATION) * 1000).toISOString()
          },
          isCompleted: weekNum < currentWeekIndex
        }
      });
    }
    
    // Get all available weeks summary
    const weeksSummary = [];
    
    for (let i = 0; i <= currentWeekIndex; i++) {
      const weekKey = `weekly:leaderboard:${i}`;
      const weekData = await redis.get(weekKey);
      
      const weekSummary = {
        weekIndex: i,
        hasData: !!weekData,
        winner: weekData?.leaderboard?.[0] || null,
        totalEntries: weekData?.totalEntries || 0,
        weekPeriod: {
          start: new Date((COMPETITION_LAUNCH_TIMESTAMP + i * WEEK_DURATION) * 1000).toISOString(),
          end: new Date((COMPETITION_LAUNCH_TIMESTAMP + (i + 1) * WEEK_DURATION) * 1000).toISOString()
        },
        isCompleted: i < currentWeekIndex,
        isCurrent: i === currentWeekIndex
      };
      
      weeksSummary.push(weekSummary);
    }
    
    return res.status(200).json({
      success: true,
      data: {
        currentWeek: currentWeekIndex,
        totalWeeks: currentWeekIndex + 1,
        weeks: weeksSummary,
        availableWeeks: weeksSummary.filter(w => w.hasData).length
      }
    });
    
  } catch (error) {
    console.error('❌ Error fetching weekly winners:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch weekly winners data',
      details: error.message
    });
  }
}
