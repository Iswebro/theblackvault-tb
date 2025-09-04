export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    console.log('🏆 Triggering competition leaderboard update...')
    
    // Import and call the competition leaderboard handler directly
    const competitionHandler = await import('./cron/competition-leaderboard')
    
    // Create mock req/res for the cron handler
    const mockReq = {
      headers: {
        authorization: `Bearer ${process.env.CRON_SECRET}`,
        'user-agent': 'vercel-cron/1.0'
      }
    }
    
    const mockRes = {
      status: (code) => ({
        json: (data) => {
          console.log(`Competition handler returned ${code}:`, data)
          return data
        }
      })
    }
    
    const result = await competitionHandler.default(mockReq, mockRes)
    
    return res.status(200).json({
      success: true,
      message: 'Competition leaderboard update triggered successfully',
      result,
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('Error triggering competition update:', error)
    return res.status(500).json({
      error: 'Failed to trigger competition update',
      message: error.message
    })
  }
}
