// pages/api/trigger-referral-update.js
// Manual trigger to populate referral stats cache
// This can be called to manually run the background job

export default async function handler(req, res) {
  const { method } = req;
  
  if (method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('🔄 Manually triggering referral stats update...');
    
    // Import and run the cron job logic
    const cronHandler = require('./cron/update-referral-stats.js');
    
    // Create a mock request/response for the cron job
    const mockReq = { method: 'POST' };
    const mockRes = {
      status: (code) => ({
        json: (data) => {
          console.log(`Cron job response ${code}:`, data);
          return data;
        }
      })
    };
    
    await cronHandler.default(mockReq, mockRes);
    
    return res.status(200).json({
      success: true,
      message: 'Referral stats update triggered successfully'
    });
    
  } catch (error) {
    console.error('❌ Error triggering referral stats update:', error);
    return res.status(500).json({
      error: 'Failed to trigger update',
      details: error.message
    });
  }
}
