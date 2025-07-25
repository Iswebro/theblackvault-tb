// scripts/test-defi-api.js
// Test script to verify De.Fi API integration

const fetch = require('node-fetch');
require('dotenv').config({ path: '.env.local' });

const DEFI_API_KEY = process.env.NEXT_PUBLIC_DEFI_API_KEY;
const BASE_URL = 'https://public-api.de.fi';
const TEST_CONTRACT_ADDRESS = '0x22708D8a54c044CbA5B237620Af42030cbf76E14'; // Black Vault
const TEST_WALLET_ADDRESS = '0x742d35Cc6634C0532925a3b8D6D0d4F1C44a6c2e'; // Default referrer

async function testDeFiAPI() {
  console.log('🔍 Testing De.Fi API Integration...');
  console.log('API Key:', DEFI_API_KEY ? `${DEFI_API_KEY.substring(0, 8)}...` : 'Not found');
  console.log('');

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${DEFI_API_KEY}`,
    'User-Agent': 'BlackVault/1.0'
  };

  // Test 1: Portfolio Overview
  console.log('📊 Test 1: Portfolio Overview');
  try {
    const portfolioResponse = await fetch(`${BASE_URL}/portfolio/${TEST_WALLET_ADDRESS}`, { headers });
    console.log('Status:', portfolioResponse.status);
    
    if (portfolioResponse.ok) {
      const portfolioData = await portfolioResponse.json();
      console.log('✅ Portfolio data received:', Object.keys(portfolioData));
    } else {
      const errorText = await portfolioResponse.text();
      console.log('❌ Portfolio error:', errorText);
    }
  } catch (error) {
    console.log('❌ Portfolio request failed:', error.message);
  }
  console.log('');

  // Test 2: Contract Security
  console.log('🛡️ Test 2: Contract Security Analysis');
  try {
    const securityResponse = await fetch(`${BASE_URL}/security/contract/${TEST_CONTRACT_ADDRESS}?chain=56`, { headers });
    console.log('Status:', securityResponse.status);
    
    if (securityResponse.ok) {
      const securityData = await securityResponse.json();
      console.log('✅ Security data received:', Object.keys(securityData));
    } else {
      const errorText = await securityResponse.text();
      console.log('❌ Security error:', errorText);
    }
  } catch (error) {
    console.log('❌ Security request failed:', error.message);
  }
  console.log('');

  // Test 3: Yield Opportunities
  console.log('💰 Test 3: Yield Opportunities');
  try {
    const yieldResponse = await fetch(`${BASE_URL}/yield?chain=56&min_apr=0`, { headers });
    console.log('Status:', yieldResponse.status);
    
    if (yieldResponse.ok) {
      const yieldData = await yieldResponse.json();
      console.log('✅ Yield data received:', Object.keys(yieldData));
      if (yieldData.data && Array.isArray(yieldData.data)) {
        console.log('📈 Found', yieldData.data.length, 'yield opportunities');
      }
    } else {
      const errorText = await yieldResponse.text();
      console.log('❌ Yield error:', errorText);
    }
  } catch (error) {
    console.log('❌ Yield request failed:', error.message);
  }
  console.log('');

  // Test 4: Market Sentiment
  console.log('📈 Test 4: Market Sentiment');
  try {
    const sentimentResponse = await fetch(`${BASE_URL}/market/sentiment?timeframe=24h`, { headers });
    console.log('Status:', sentimentResponse.status);
    
    if (sentimentResponse.ok) {
      const sentimentData = await sentimentResponse.json();
      console.log('✅ Sentiment data received:', Object.keys(sentimentData));
    } else {
      const errorText = await sentimentResponse.text();
      console.log('❌ Sentiment error:', errorText);
    }
  } catch (error) {
    console.log('❌ Sentiment request failed:', error.message);
  }
  console.log('');

  // Test 5: API Info/Status
  console.log('ℹ️ Test 5: API Status');
  try {
    const statusResponse = await fetch(`${BASE_URL}/info`, { headers });
    console.log('Status:', statusResponse.status);
    
    if (statusResponse.ok) {
      const statusData = await statusResponse.json();
      console.log('✅ API info received:', Object.keys(statusData));
    } else {
      const errorText = await statusResponse.text();
      console.log('❌ Status error:', errorText);
    }
  } catch (error) {
    console.log('❌ Status request failed:', error.message);
  }

  console.log('');
  console.log('🏁 De.Fi API test completed!');
}

// Run the test
testDeFiAPI().catch(console.error);
