// Simple test script to trigger the weekly update and check results
const http = require('http');

async function makeRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });
    
    req.on('error', reject);
    
    if (data) {
      req.write(data);
    }
    req.end();
  });
}

async function runTest() {
  console.log('🔄 Testing the referral system fix...');
  
  try {
    // 1. Check current referrer data
    console.log('\n1. Checking current referrer data...');
    const checkOptions = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/check-referrer?address=0xB98e82C611BFc1b852412268fd300E28fAEE4D48',
      method: 'GET'
    };
    
    const checkResult = await makeRequest(checkOptions);
    console.log('Current referrer data:', JSON.stringify(checkResult.data, null, 2));
    
    // 2. Trigger weekly update
    console.log('\n2. Triggering weekly update...');
    const triggerOptions = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/trigger-weekly-update',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    };
    
    const triggerResult = await makeRequest(triggerOptions);
    console.log('Trigger result:', JSON.stringify(triggerResult.data, null, 2));
    
    // 3. Check weekly leaderboard
    console.log('\n3. Checking weekly leaderboard...');
    const leaderboardOptions = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/leaderboard/weekly',
      method: 'GET'
    };
    
    const leaderboardResult = await makeRequest(leaderboardOptions);
    console.log('Weekly leaderboard entries:', leaderboardResult.data?.data?.leaderboard?.length || 0);
    
    // Check if our target referrer is in the leaderboard
    const targetReferrer = '0xB98e82C611BFc1b852412268fd300E28fAEE4D48';
    const leaderboard = leaderboardResult.data?.data?.leaderboard || [];
    const foundReferrer = leaderboard.find(entry => 
      entry.referrer?.toLowerCase() === targetReferrer.toLowerCase()
    );
    
    if (foundReferrer) {
      console.log('✅ SUCCESS: Target referrer found in leaderboard!');
      console.log('Referrer data:', JSON.stringify(foundReferrer, null, 2));
    } else {
      console.log('❌ Target referrer still not in leaderboard');
      console.log('Top 5 leaderboard entries:');
      leaderboard.slice(0, 5).forEach((entry, i) => {
        console.log(`${i+1}. ${entry.referrer} - ${entry.totalReferrals} referrals`);
      });
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

runTest();
