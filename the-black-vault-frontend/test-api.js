// Simple test script to check the deployed API
const https = require('https');

async function testAPI() {
  console.log("🧪 Testing deployed referral stats API...");
  
  // Test the cron job trigger
  const cronData = JSON.stringify({});
  const cronOptions = {
    hostname: 'theblackvault.xyz',
    port: 443,
    path: '/api/cron/update-referral-stats',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': cronData.length
    }
  };

  console.log("🚀 Triggering cron job...");
  
  return new Promise((resolve, reject) => {
    const req = https.request(cronOptions, (res) => {
      console.log(`✅ Cron job response status: ${res.statusCode}`);
      
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          console.log("📊 Cron job result:", result);
          
          // Now test the referral stats API
          setTimeout(() => {
            const statsOptions = {
              hostname: 'theblackvault.xyz',
              port: 443,
              path: '/api/referral-stats?type=default',
              method: 'GET'
            };
            
            console.log("🔍 Checking referral stats...");
            
            const statsReq = https.request(statsOptions, (statsRes) => {
              console.log(`✅ Stats API response status: ${statsRes.statusCode}`);
              
              let statsData = '';
              statsRes.on('data', (chunk) => {
                statsData += chunk;
              });
              
              statsRes.on('end', () => {
                try {
                  const statsResult = JSON.parse(statsData);
                  console.log("📈 Referral stats result:", JSON.stringify(statsResult, null, 2));
                  resolve(statsResult);
                } catch (error) {
                  console.error("❌ Error parsing stats response:", error);
                  console.log("Raw stats response:", statsData);
                  reject(error);
                }
              });
            });
            
            statsReq.on('error', (error) => {
              console.error("❌ Stats API request error:", error);
              reject(error);
            });
            
            statsReq.end();
          }, 5000); // Wait 5 seconds for cron job to complete
          
        } catch (error) {
          console.error("❌ Error parsing cron response:", error);
          console.log("Raw cron response:", data);
          reject(error);
        }
      });
    });

    req.on('error', (error) => {
      console.error("❌ Cron job request error:", error);
      reject(error);
    });

    req.write(cronData);
    req.end();
  });
}

testAPI().catch(console.error);
