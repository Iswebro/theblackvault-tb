import { kv } from '@vercel/kv'

const COMPETITION_LAUNCH_TIMESTAMP = 1725408000 // September 4, 2025 00:00:00 UTC
const WEEK_DURATION = 7 * 24 * 60 * 60 // 7 days in seconds

export default async function handler(req, res) {
  try {
    const { week } = req.query
    
    // Get current week if not specified
    const currentTime = Math.floor(Date.now() / 1000)
    const currentWeekIndex = Math.floor((currentTime - COMPETITION_LAUNCH_TIMESTAMP) / WEEK_DURATION)
    const requestedWeek = week ? parseInt(week) : currentWeekIndex
    
    // Get competition data for the requested week
    const weeklyData = await kv.get(`competition:week:${requestedWeek}`)
    
    if (!weeklyData) {
      return res.status(404).json({
        error: 'No data found for this week',
        week: requestedWeek,
        currentWeek: currentWeekIndex
      })
    }
    
    // Also get summary of all weeks
    const allWeeks = []
    for (let w = 0; w <= currentWeekIndex; w++) {
      const weekData = await kv.get(`competition:week:${w}`)
      if (weekData) {
        allWeeks.push({
          weekIndex: w,
          totalParticipants: weekData.totalParticipants,
          topReferrer: weekData.leaderboard[0]?.referrer || null,
          topReferrals: weekData.leaderboard[0]?.referralCount || 0,
          lastUpdated: weekData.lastUpdated
        })
      }
    }
    
    return res.status(200).json({
      success: true,
      currentWeek: requestedWeek,
      currentWeekIndex,
      data: weeklyData,
      allWeeks,
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('Error fetching competition leaderboard:', error)
    return res.status(500).json({
      error: 'Failed to fetch competition leaderboard',
      message: error.message
    })
  }
}
