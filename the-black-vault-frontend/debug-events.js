// debug-events.js - Calculate correct event signatures
const { ethers } = require('ethers');
const BlackVaultABI = require('./src/contract/BlackVaultABI.json');

// Use .abi if present (Hardhat artifact), else use as array
const abi = BlackVaultABI.abi || BlackVaultABI;

// Create interface to get event signatures
const iface = new ethers.Interface(abi);

console.log('=== Event Signatures ===');

// Get all events
const events = abi.filter(item => item.type === 'event');
events.forEach(event => {
  const signature = iface.getEvent(event.name);
  const topic = signature.topicHash;
  console.log(`${event.name}: ${topic}`);
  console.log(`  Inputs:`, event.inputs.map(input => `${input.name} (${input.type}${input.indexed ? ' indexed' : ''})`));
  console.log('');
});

console.log('=== Looking for specific events ===');
try {
  const deposited = iface.getEvent('Deposited');
  console.log('Deposited signature:', deposited.topicHash);
} catch (e) {
  console.log('Deposited event not found');
}

try {
  const withdrawn = iface.getEvent('Withdrawn');
  console.log('Withdrawn signature:', withdrawn.topicHash);
} catch (e) {
  console.log('Withdrawn event not found');
}

try {
  const referralReward = iface.getEvent('ReferralRewardPaid');
  console.log('ReferralRewardPaid signature:', referralReward.topicHash);
} catch (e) {
  console.log('ReferralRewardPaid event not found');
}
