// scripts/test-defi-api-v2.js
// Updated test script with different authentication methods

const fetch = require('node-fetch');
require('dotenv').config({ path: '.env.local' });

const DEFI_API_KEY = process.env.NEXT_PUBLIC_DEFI_API_KEY;

async function testDeFiAPIAlternatives() {
  console.log('🔍 Testing De.Fi API Integration - Alternative Methods...');
  console.log('API Key:', DEFI_API_KEY ? `${DEFI_API_KEY.substring(0, 8)}...` : 'Not found');
  console.log('');

  // Test different base URLs and auth methods
  const testConfigs = [
    {
      name: 'Method 1: Header Authorization',
      baseUrl: 'https://api.de.fi',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEFI_API_KEY}`,
        'User-Agent': 'BlackVault/1.0'
      }
    },
    {
      name: 'Method 2: X-API-Key Header',
      baseUrl: 'https://api.de.fi',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': DEFI_API_KEY,
        'User-Agent': 'BlackVault/1.0'
      }
    },
    {
      name: 'Method 3: Query Parameter',
      baseUrl: 'https://api.de.fi',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'BlackVault/1.0'
      },
      keyParam: true
    },
    {
      name: 'Method 4: Public API',
      baseUrl: 'https://public-api.de.fi',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': DEFI_API_KEY,
        'User-Agent': 'BlackVault/1.0'
      }
    }
  ];

  for (const config of testConfigs) {
    console.log(`🧪 ${config.name}`);
    
    // Test simple endpoint
    try {
      const url = config.keyParam 
        ? `${config.baseUrl}/status?api_key=${DEFI_API_KEY}`
        : `${config.baseUrl}/status`;
        
      const response = await fetch(url, { headers: config.headers });
      console.log(`Status endpoint: ${response.status}`);
      
      if (response.ok) {
        const data = await response.text();
        console.log('✅ Response received:', data.substring(0, 200));
      } else {
        const errorText = await response.text();
        console.log('❌ Error:', errorText.substring(0, 200));
      }
    } catch (error) {
      console.log('❌ Request failed:', error.message);
    }
    console.log('');
  }

  // Test without authentication (public endpoints)
  console.log('🌐 Testing Public Endpoints (no auth)');
  const publicUrls = [
    'https://de.fi/api/status',
    'https://api.de.fi/v1/status',
    'https://public-api.de.fi/v1/status',
    'https://de.fi/api/health'
  ];

  for (const url of publicUrls) {
    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': 'BlackVault/1.0' }
      });
      console.log(`${url}: ${response.status}`);
      
      if (response.ok) {
        const data = await response.text();
        console.log('✅ Public response:', data.substring(0, 100));
      }
    } catch (error) {
      console.log(`${url}: Failed - ${error.message}`);
    }
  }

  console.log('');
  console.log('🏁 Alternative API test completed!');
}

// Run the test
testDeFiAPIAlternatives().catch(console.error);
