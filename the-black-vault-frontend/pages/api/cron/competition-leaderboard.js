import { kv } from '@vercel/kv'

/**
 * Competition-specific leaderboard that uses existing referral data
 * No blockchain scanning needed - works with cached referral stats
 */

const COMPETITION_LAUNCH_TIMESTAMP = 1725408000 // September 4, 2025 00:00:00 UTC
const WEEK_DURATION = 7 * 24 * 60 * 60 // 7 days in seconds

export default async function handler(req, res) {
  // Verify this is a cron request
  const authHeader = req.headers.authorization
  const isVercelCron = authHeader === `Bearer ${process.env.CRON_SECRET}`
  
  if (!isVercelCron && req.headers['user-agent'] !== 'vercel-cron/1.0') {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    console.log('[COMP] 🏆 Starting competition leaderboard update...')
    
    // Get current week index
    const currentTime = Math.floor(Date.now() / 1000)
    const weekIndex = Math.floor((currentTime - COMPETITION_LAUNCH_TIMESTAMP) / WEEK_DURATION)
    
    console.log(`[COMP] 📅 Current week: ${weekIndex}`)
    
    // Get all referral stats from existing data
    const referralStats = await kv.get('referral:summary') || {}
    const allReferrers = await kv.keys('referral:user:*')
    
    console.log(`[COMP] 📊 Found ${allReferrers.length} referrers in database`)
    
    // Process each week (current and previous)
    for (let week = 0; week <= weekIndex; week++) {
      await processWeekFromReferralData(week, allReferrers)
    }
    
    console.log('[COMP] ✅ Competition leaderboard update completed')
    
    return res.status(200).json({
      success: true,
      message: 'Competition leaderboard updated successfully',
      weeksProcessed: weekIndex + 1,
      referrersFound: allReferrers.length,
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('[COMP] ❌ Error updating competition leaderboard:', error)
    return res.status(500).json({
      error: 'Failed to update competition leaderboard',
      message: error.message
    })
  }
}

async function processWeekFromReferralData(weekIndex, allReferrers) {
  console.log(`[COMP] 🔄 Processing week ${weekIndex}...`)
  
  const weeklyLeaderboard = []
  let totalParticipants = 0
  
  // Process each referrer
  for (const referrerKey of allReferrers) {
    const referrerAddress = referrerKey.replace('referral:user:', '')
    
    // Skip if invalid address format
    if (!referrerAddress.startsWith('0x') || referrerAddress.length !== 42) {
      continue
    }
    
    // Get referrer data
    const referrerData = await kv.get(referrerKey)
    if (!referrerData || !referrerData.referees) {
      continue
    }
    
    // Count referrals (use total referrals as proxy for competition performance)
    const referralCount = referrerData.referees.length || 0
    const totalRewards = parseFloat(referrerData.totalRewards || '0')
    
    if (referralCount > 0) {
      weeklyLeaderboard.push({
        referrer: referrerAddress,
        referralCount: referralCount,
        totalRewards: totalRewards,
        score: calculateCompetitionScore(referralCount, totalRewards)
      })
      totalParticipants++
    }
  }
  
  // Sort by competition score (referrals weighted with rewards)
  weeklyLeaderboard.sort((a, b) => b.score - a.score)
  
  // Take top 10 for leaderboard
  const top10 = weeklyLeaderboard.slice(0, 10)
  
  // Store the weekly leaderboard
  const weeklyData = {
    weekIndex,
    weekStart: new Date((COMPETITION_LAUNCH_TIMESTAMP + weekIndex * WEEK_DURATION) * 1000).toISOString(),
    weekEnd: new Date((COMPETITION_LAUNCH_TIMESTAMP + (weekIndex + 1) * WEEK_DURATION) * 1000).toISOString(),
    totalParticipants,
    leaderboard: top10,
    lastUpdated: new Date().toISOString()
  }
  
  await kv.set(`competition:week:${weekIndex}`, weeklyData)
  
  console.log(`[COMP] ✅ Week ${weekIndex}: ${totalParticipants} participants, top referrer: ${top10[0]?.referrer || 'none'} (${top10[0]?.referralCount || 0} referrals)`)
  
  return weeklyData
}

function calculateCompetitionScore(referralCount, totalRewards) {
  // Competition scoring: referrals are primary, rewards are secondary
  return (referralCount * 100) + (totalRewards * 0.1)
}
