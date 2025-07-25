// scripts/test-insights-component.js
// Test the SmartDeFiInsights component data loading

const { StrategicPositioning } = require('../src/utils/defiApi');

async function testComponentData() {
  console.log('🧪 Testing SmartDeFiInsights Component Data...');
  console.log('');

  try {
    console.log('📊 Test 1: Security Profile Data');
    const securityData = await StrategicPositioning.getSecurityFirst();
    console.log('Security data properties:', Object.keys(securityData));
    console.log('Strengths available:', securityData.strengths ? securityData.strengths.length : 'undefined');
    console.log('');

    console.log('💰 Test 2: Strategic Position Data');
    const strategicData = await StrategicPositioning.getSustainableYield();
    console.log('Strategic data properties:', Object.keys(strategicData));
    console.log('Risk management available:', strategicData.riskManagement ? strategicData.riskManagement.length : 'undefined');
    console.log('');

    console.log('🎓 Test 3: Education Data');
    const educationData = await StrategicPositioning.getEducationalContent();
    console.log('Education data properties:', Object.keys(educationData));
    console.log('Content available:', educationData.content ? educationData.content.length : 'undefined');
    
    if (educationData.content && educationData.content.length > 0) {
      console.log('First content item:', educationData.content[0]);
    }
    console.log('');

    console.log('✅ All component data loaded successfully!');
    console.log('🎯 Component should now render without errors');

  } catch (error) {
    console.error('❌ Error testing component data:', error);
  }
}

testComponentData();
