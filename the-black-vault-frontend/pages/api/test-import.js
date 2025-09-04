// Test import of cron functions
export default async function handler(req, res) {
  try {
    console.log('Testing import of cron functions...');
    
    // Try importing the functions
    const cronModule = await import('./cron/weeklyleaderboard.js');
    console.log('Import successful, available exports:', Object.keys(cronModule));
    
    // Check if the function exists
    const { aggregateWeeklyLeaderboard, aggregateLifetimeLeaderboard } = cronModule;
    
    const results = {
      success: true,
      importedModule: !!cronModule,
      availableExports: Object.keys(cronModule),
      aggregateWeeklyLeaderboard: typeof aggregateWeeklyLeaderboard,
      aggregateLifetimeLeaderboard: typeof aggregateLifetimeLeaderboard,
      timestamp: new Date().toISOString()
    };
    
    console.log('Import test results:', results);
    
    res.status(200).json(results);
    
  } catch (error) {
    console.error('Import test failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
  }
}
