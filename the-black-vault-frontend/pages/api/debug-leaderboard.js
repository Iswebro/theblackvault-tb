// pages/api/debug-leaderboard.js
// Debug endpoint to test leaderboard functionality

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false, 
      error: 'Method not allowed. Use POST.' 
    });
  }

  try {
    // Calculate current week
    const COMPETITION_LAUNCH_TIMESTAMP = 1755118800; // August 14, 2025 07:00 AEST - Weekly Challenge Competition Launch
    const WEEK_DURATION = 7 * 24 * 60 * 60;
    const nowTs = Math.floor(Date.now() / 1000);
    const weekIndex = Math.floor((nowTs - COMPETITION_LAUNCH_TIMESTAMP) / WEEK_DURATION);
    
    console.log('🔍 DEBUG: Current timestamp:', nowTs);
    console.log('🔍 DEBUG: Competition launch timestamp:', COMPETITION_LAUNCH_TIMESTAMP);
    console.log('🔍 DEBUG: Calculated week index:', weekIndex);
    console.log('🔍 DEBUG: Current date:', new Date());
    console.log('🔍 DEBUG: Competition launch date:', new Date(COMPETITION_LAUNCH_TIMESTAMP * 1000));
    
    // Try to trigger the cron function
    const baseUrl = req.headers.host?.includes('localhost') 
      ? `http://${req.headers.host}` 
      : `https://${req.headers.host}`;
    
    console.log('🔍 DEBUG: Attempting to call cron endpoint...');
    
    const cronResponse = await fetch(`${baseUrl}/api/cron/weeklyleaderboard`, {
      method: 'POST',
      headers: {
        'authorization': `Bearer ${process.env.CRON_SECRET || 'test'}`,
        'content-type': 'application/json'
      }
    });
    
    const cronData = cronResponse.ok ? await cronResponse.json() : null;
    
    console.log('🔍 DEBUG: Cron response status:', cronResponse.status);
    console.log('🔍 DEBUG: Cron response data:', cronData);
    
    return res.status(200).json({
      success: true,
      debug: {
        currentTimestamp: nowTs,
        competitionLaunchTimestamp: COMPETITION_LAUNCH_TIMESTAMP,
        weekIndex: weekIndex,
        currentDate: new Date().toISOString(),
        competitionLaunchDate: new Date(COMPETITION_LAUNCH_TIMESTAMP * 1000).toISOString(),
        cronResponse: {
          status: cronResponse.status,
          ok: cronResponse.ok,
          data: cronData
        }
      }
    });
    
  } catch (error) {
    console.error('❌ Debug error:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
}
