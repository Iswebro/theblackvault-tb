# Frontend Integration Guide - BlackVaultV2

## ⚠️ CRITICAL: Use View Functions, Not Raw Storage

### ✅ CORRECT - Dynamic Calculations
\`\`\`javascript
// Get real-time pending rewards (includes missed cycles)
const vaultData = await contract.getUserVault(userAddress);
const pendingRewards = vaultData.pendingRewards; // ✅ Dynamic calculation

// Get accurate ROI with current pending rewards
const roiData = await contract.getUserROI(userAddress);
const totalEarned = roiData.totalEarned; // ✅ Includes dynamic pending
\`\`\`

### ❌ WRONG - Stale Storage Data
\`\`\`javascript
// DON'T do this - raw storage doesn't include missed cycles
const rawVault = await contract.vaults(userAddress);
const stalePending = rawVault.pendingRewards; // ❌ Missing accrued rewards

// This will show LESS rewards than user actually has!
\`\`\`

## Key Integration Points

### 1. Balance Display
\`\`\`javascript
const loadUserBalance = async () => {
  // ✅ Always use getUserVault for balance display
  const vaultData = await contract.getUserVault(account);
  
  setActiveAmount(formatEther(vaultData.activeAmount));
  setPendingRewards(formatEther(vaultData.pendingRewards)); // Real-time calculation
  setLastAccrualCycle(vaultData.lastAccrualCycle.toString());
};
\`\`\`

### 2. ROI Calculation
\`\`\`javascript
const loadUserROI = async () => {
  // ✅ Always use getUserROI for accurate ROI
  const roiData = await contract.getUserROI(account);
  
  setTotalInvested(formatEther(roiData.totalInvested));
  setTotalEarned(formatEther(roiData.totalEarned)); // Includes dynamic pending
  setROIPercentage((roiData.roiPercentage / 100).toString()); // Convert from basis points
};
\`\`\`

### 3. Real-time Updates
\`\`\`javascript
// Update rewards every 10 seconds for active users
useEffect(() => {
  let interval;
  if (account && parseFloat(activeAmount) > 0) {
    interval = setInterval(async () => {
      const vaultData = await contract.getUserVault(account);
      setPendingRewards(formatEther(vaultData.pendingRewards));
    }, 10000);
  }
  return () => clearInterval(interval);
}, [account, activeAmount]);
\`\`\`

## Why This Matters

**V1 Problem**: Raw storage showed stale `pendingRewards` that didn't include missed cycles
**V2 Solution**: View functions calculate `pendingRewards + missed_cycles` dynamically

### Example Scenario:
- User deposits 1000 USDT
- 5 cycles pass without interaction
- Raw storage: `pendingRewards = 0` ❌
- getUserVault(): `pendingRewards = 125 USDT` ✅ (5 cycles × 25 USDT)
