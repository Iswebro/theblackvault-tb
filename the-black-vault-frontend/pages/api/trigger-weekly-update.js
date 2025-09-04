// pages/api/trigger-weekly-update.js
// Manual trigger to force update weekly leaderboard data

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false, 
      error: 'Method not allowed. Use POST.' 
    });
  }

  try {
    console.log('🔄 Manual trigger: Starting weekly leaderboard update...');
    
    // Instead of importing functions, call the cron job directly
    const cronModule = await import('./cron/weeklyleaderboard.js');
    const cronHandler = cronModule.default;
    
    // Create mock req/res for the cron job but bypass auth
    const mockReq = {
      headers: {
        authorization: `Bearer ${process.env.CRON_SECRET}` // Use the proper cron secret
      }
    };
    
    // Create a response wrapper to capture the cron job output
    let cronResult = null;
    const mockRes = {
      status: (code) => ({
        json: (data) => {
          cronResult = { statusCode: code, data };
          return mockRes;
        }
      })
    };
    
    // Call the cron job handler
    await cronHandler(mockReq, mockRes);
    
    return res.status(200).json({
      success: true,
      message: 'Weekly leaderboard update triggered successfully via cron handler',
      cronResult: cronResult,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error in manual trigger:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}
