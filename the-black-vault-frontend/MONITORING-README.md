# Referral Monitoring Tools

## Quick Start

### Monitor Current Status
```bash
node monitor-referrals.js
```

### Check Bonus Status
```bash  
node check-bonus.js
```

## Files Created

- `monitor-referrals.js` - Main monitoring script with change detection
- `check-bonus.js` - Simple bonus status checker
- `referral-monitoring.json` - Historical data storage (auto-created)

## Monitoring Strategy

### Baseline Establishment
Run `monitor-referrals.js` daily to establish normal patterns before testing.

### Pre-Test Monitoring  
1. Run monitoring script
2. Note current values
3. Make test deposit
4. Run monitoring script again
5. Check for alerts and changes

## Test Scenarios

### Scenario A: Deposit WITHOUT Referral Code
**Expected**: Default referrer rewards may increase (acceptable)
**Command**: Use regular deposit() function in your dApp
**Alert**: Look for reward increases without bonus counter changes

### Scenario B: Deposit WITH Default Referral Link  
**Expected**: Should NOT increase rewards if already at 3/3 bonuses
**Command**: Use depositWithReferrer() with default referrer address
**Alert**: Look for bonus counter exceeding 3 (bug detection)

## Key Metrics to Watch

- **Your Bonus Usage**: Should not exceed 3 for explicit referral usage
- **Available Rewards**: Track increases to detect new bonuses awarded  
- **Total Referrals**: General activity counter
- **Total Volume**: Overall deposit tracking

## Alerts

The monitor will alert you when:
- Default referrer receives new rewards
- Your bonus usage changes
- Bonus counter exceeds 3 (potential bug)
- Significant volume changes

## Historical Data

All snapshots are saved to `referral-monitoring.json` with:
- Timestamps
- Block numbers  
- Your bonus usage stats
- Default referrer stats
- Change detection

## Usage Tips

1. **Regular Monitoring**: Run daily to catch any unexpected changes
2. **Pre/Post Testing**: Always check before and after test deposits
3. **Change Detection**: Script automatically highlights differences
4. **Data Persistence**: All data is saved for trend analysis

## Emergency Checks

If you suspect a bug:
1. Run monitoring script immediately
2. Check for bonus usage > 3
3. Verify reward increases match expected behavior
4. Review historical data for patterns

This monitoring setup will help you track the referral behavior and detect any anomalies during your testing phase.
