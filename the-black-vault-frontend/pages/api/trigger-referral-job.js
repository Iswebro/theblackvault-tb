// pages/api/trigger-referral-job.js
// Simple endpoint to manually trigger the referral stats background job

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      error: 'Method not allowed - use POST',
      hint: 'Send a POST request to manually trigger the referral stats job'
    });
  }

  try {
    console.log("🔧 TRIGGER: Manually triggering referral stats job...");
    
    // Import the cron job function
    const cronHandler = await import('./cron/update-referral-stats.js');
    
    // Create a mock request object for the cron job
    const mockReq = {
      method: 'POST',
      headers: {
        'authorization': `Bearer ${process.env.CRON_SECRET}`
      }
    };
    
    // Create a response object to capture the cron job result
    let cronResult = {};
    const mockRes = {
      status: (code) => ({
        json: (data) => {
          cronResult = { statusCode: code, data };
          return mockRes;
        }
      }),
      json: (data) => {
        cronResult = { statusCode: 200, data };
        return mockRes;
      }
    };
    
    // Run the cron job
    await cronHandler.default(mockReq, mockRes);
    
    console.log("🔧 TRIGGER: Cron job completed with result:", cronResult);
    
    return res.status(200).json({
      success: true,
      message: 'Referral stats job triggered successfully',
      cronResult,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error("❌ TRIGGER: Error triggering referral stats job:", error);
    return res.status(500).json({
      error: 'Failed to trigger referral stats job',
      details: error.message
    });
  }
}
