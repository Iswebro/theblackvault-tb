// Simple script to trigger manual leaderboard update
async function triggerUpdate() {
  try {
    const response = await fetch('http://localhost:3000/api/trigger-weekly-update', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    const result = await response.json();
    console.log('Trigger result:', result);
    
    // Wait a moment then check the leaderboard
    setTimeout(async () => {
      const leaderboardResponse = await fetch('http://localhost:3000/api/leaderboard/weekly');
      const leaderboardData = await leaderboardResponse.json();
      console.log('Updated leaderboard:', leaderboardData);
    }, 2000);
    
  } catch (error) {
    console.error('Error:', error);
  }
}

triggerUpdate();
