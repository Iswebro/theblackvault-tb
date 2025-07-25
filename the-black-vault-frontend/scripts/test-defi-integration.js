// scripts/test-defi-integration.js
// Test the corrected De.Fi API integration

const { DeFiApiClient, StrategicPositioning } = require('../src/utils/defiApi.js');
require('dotenv').config({ path: '.env.local' });

async function testDeFiIntegration() {
  console.log('🧪 Testing De.Fi Integration with Fallback Data...');
  console.log('');

  // Test 1: Security First Approach
  console.log('🛡️ Test 1: Security First Approach');
  try {
    const securityData = await StrategicPositioning.getSecurityFirst();
    console.log('✅ Security data:', {
      approach: securityData.approach,
      score: securityData.score,
      source: securityData.source,
      strengthsCount: securityData.strengths?.length || 0
    });
  } catch (error) {
    console.log('❌ Security test failed:', error.message);
  }
  console.log('');

  // Test 2: Sustainable Yield
  console.log('💰 Test 2: Sustainable Yield Strategy');
  try {
    const yieldData = await StrategicPositioning.getSustainableYield();
    console.log('✅ Yield strategy:', {
      approach: yieldData.approach,
      philosophy: yieldData.philosophy,
      managementCount: yieldData.riskManagement?.length || 0,
      source: yieldData.source
    });
  } catch (error) {
    console.log('❌ Yield test failed:', error.message);
  }
  console.log('');

  // Test 3: Educational Content
  console.log('🎓 Test 3: Educational Content');
  try {
    const educationData = await StrategicPositioning.getEducationalContent();
    console.log('✅ Educational content:', {
      approach: educationData.approach,
      contentCount: educationData.content?.length || 0,
      source: educationData.source
    });
  } catch (error) {
    console.log('❌ Education test failed:', error.message);
  }
  console.log('');

  // Test 4: Direct API Instance
  console.log('🔌 Test 4: Direct API Instance');
  try {
    const apiKey = process.env.NEXT_PUBLIC_DEFI_API_KEY;
    const defiClient = new DeFiApiClient(apiKey);
    
    console.log('API Client created with key:', apiKey ? `${apiKey.substring(0, 8)}...` : 'None');
    
    // Test contract security (will use fallback)
    const contractSecurity = await defiClient.getContractSecurity('0x22708D8a54c044CbA5B237620Af42030cbf76E14');
    console.log('✅ Contract security:', {
      score: contractSecurity.securityScore,
      status: contractSecurity.auditStatus,
      source: contractSecurity.source
    });
  } catch (error) {
    console.log('❌ API test failed:', error.message);
  }

  console.log('');
  console.log('🏁 De.Fi integration test completed!');
  console.log('📋 Summary: All functions should return fallback data since API is not accessible');
  console.log('🎯 This provides a working framework for when the API becomes available');
}

// Run the test
testDeFiIntegration().catch(console.error);
