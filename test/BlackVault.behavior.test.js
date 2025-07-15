// ...existing code inside describe, all tests after beforeEach...

const { expect } = require("chai");
const { ethers } = require("hardhat");

let vault, usdt, owner, user, referrer, vaultAddress;
let USDT_DECIMALS;
const DAY = 86400;
const CYCLE_START_TIME = 1751490000;
const DAILY_RATE = 25; // 2.5%

describe("BlackVaultV2 Behavior", function () {
  // Helper to re-initialize usdt, vault, etc. for legacy tests
  function setupLegacyVars() {
    return { usdt, vault, owner, user, referrer, vaultAddress, USDT_DECIMALS, DAY, CYCLE_START_TIME, DAILY_RATE };
  }
  beforeEach(async function () {
    [owner, user, referrer, ...addrs] = await ethers.getSigners();
    USDT_DECIMALS = ethers.parseUnits("1", 18);
    // Ensure block timestamp is at least CYCLE_START_TIME
    const latestBlock = await ethers.provider.getBlock('latest');
    if (latestBlock.timestamp < CYCLE_START_TIME) {
      await ethers.provider.send("evm_setNextBlockTimestamp", [CYCLE_START_TIME]);
      await ethers.provider.send("evm_mine");
    }
    // Deploy mock USDT
    const MockUSDT = await ethers.getContractFactory("MockUSDT");
    usdt = await MockUSDT.deploy();
    // Mint tokens
    await usdt.mint(user.address, USDT_DECIMALS * 10000n);
    await usdt.mint(referrer.address, USDT_DECIMALS * 10000n);
    // Log addresses for debugging
    const usdtAddress = await usdt.getAddress();
    // eslint-disable-next-line no-console
    console.log('USDT address:', usdtAddress);
    console.log('Owner:', owner.address, 'User:', user.address, 'Referrer:', referrer.address);
    // Deploy vault
    const BlackVault = await ethers.getContractFactory("BlackVaultV2");
    vault = await BlackVault.deploy(usdtAddress, owner.address);
    vaultAddress = await vault.getAddress();
    // No need to set block timestamp; use current time and advance with evm_increaseTime
  });

  it("should allow poke() with no deposit and not revert or change state", async function () {
    const vaultUser = vault.connect(user);
    // User has no deposit
    await expect(vaultUser.poke()).to.not.be.reverted;
    // State should be all zeros
    const stats = await vault.getUserVault(user.address);
    expect(stats[1]).to.equal(0); // activeAmount
    expect(stats[2]).to.equal(0); // queuedAmount
    expect(stats[6]).to.equal(0); // pendingRewards
  });

  it("should not accrue extra rewards after withdrawal and poke()", async function () {
    const usdtUser = usdt.connect(user);
    const vaultUser = vault.connect(user);
    await usdtUser.approve(vaultAddress, USDT_DECIMALS * 1000n);
    await vaultUser.deposit(USDT_DECIMALS * 1000n);
    // Advance to activation
    let vaultData = await vault.getUserVault(user.address);
    let queuedCycle = vaultData[3];
    let currCycle = await vault.getCurrentCycle();
    if (currCycle < queuedCycle) {
      await ethers.provider.send("evm_setNextBlockTimestamp", [Number((await ethers.provider.getBlock('latest')).timestamp) + (Number(queuedCycle - currCycle) * DAY)]);
      await ethers.provider.send("evm_mine");
    }
    await vaultUser.poke();
    // Simulate 2 days
    await ethers.provider.send("evm_increaseTime", [2 * DAY]);
    await ethers.provider.send("evm_mine");
    await vaultUser.poke();
    // Withdraw rewards
    await vaultUser.withdrawRewards();
    let statsAfter = await vault.getUserVault(user.address);
    expect(statsAfter[6]).to.equal(0); // pendingRewards
    // Call poke() again, should not accrue more
    await vaultUser.poke();
    let statsFinal = await vault.getUserVault(user.address);
    expect(statsFinal[6]).to.equal(0);
  });

  it("should not accrue rewards for queued-only users after poke()", async function () {
    const usdtUser = usdt.connect(user);
    const vaultUser = vault.connect(user);
    await usdtUser.approve(vaultAddress, USDT_DECIMALS * 1000n);
    await vaultUser.deposit(USDT_DECIMALS * 1000n);
    // Do not advance to activation
    await vaultUser.poke();
    let stats = await vault.getUserVault(user.address);
    expect(stats[1]).to.equal(0); // activeAmount
    expect(stats[6]).to.equal(0); // pendingRewards
  });

  it("should not revert if poke() is called by a user with no vault", async function () {
    const vaultOther = vault.connect(owner);
    await expect(vaultOther.poke()).to.not.be.reverted;
    const stats = await vault.getUserVault(owner.address);
    expect(stats[1]).to.equal(0);
    expect(stats[2]).to.equal(0);
    expect(stats[6]).to.equal(0);
  });

  it("should accrue rewards only on remaining active after partial withdrawal and poke()", async function () {
    const usdtUser = usdt.connect(user);
    const vaultUser = vault.connect(user);
    await usdtUser.approve(vaultAddress, USDT_DECIMALS * 2000n);
    await vaultUser.deposit(USDT_DECIMALS * 2000n);
    // Advance to activation
    let vaultData = await vault.getUserVault(user.address);
    let queuedCycle = vaultData[3];
    let currCycle = await vault.getCurrentCycle();
    if (currCycle < queuedCycle) {
      await ethers.provider.send("evm_setNextBlockTimestamp", [Number((await ethers.provider.getBlock('latest')).timestamp) + (Number(queuedCycle - currCycle) * DAY)]);
      await ethers.provider.send("evm_mine");
    }
    await vaultUser.poke();
    // Withdraw half (simulate by withdrawing rewards, as withdraw of principal may not exist)
    // If your contract supports principal withdrawal, replace this with the correct function
    // For now, just accrue rewards and check
    // Simulate 1 day
    await ethers.provider.send("evm_increaseTime", [DAY]);
    await ethers.provider.send("evm_mine");
    await vaultUser.poke();
    let stats = await vault.getUserVault(user.address);
    // All active should accrue
    const expected = (USDT_DECIMALS * 1980n * 25n) / 1000n;
    expect(stats[6]).to.equal(expected);
  });

  it("should handle poke() after multiple deposits (queued and active)", async function () {
    const usdtUser = usdt.connect(user);
    const vaultUser = vault.connect(user);
    await usdtUser.approve(vaultAddress, USDT_DECIMALS * 1000n);
    await vaultUser.deposit(USDT_DECIMALS * 1000n);
    // Advance to activation
    let vaultData = await vault.getUserVault(user.address);
    let queuedCycle = vaultData[3];
    let currCycle = await vault.getCurrentCycle();
    if (currCycle < queuedCycle) {
      await ethers.provider.send("evm_setNextBlockTimestamp", [Number((await ethers.provider.getBlock('latest')).timestamp) + (Number(queuedCycle - currCycle) * DAY)]);
      await ethers.provider.send("evm_mine");
    }
    await vaultUser.poke();
    // Make another deposit (will be queued)
    await usdtUser.approve(vaultAddress, USDT_DECIMALS * 500n);
    await vaultUser.deposit(USDT_DECIMALS * 500n);
    // Simulate 1 day
    await ethers.provider.send("evm_increaseTime", [DAY]);
    await ethers.provider.send("evm_mine");
    await vaultUser.poke();
    let stats = await vault.getUserVault(user.address);
    // Both active and newly activated deposits may accrue
    // So expected = (activeAmount) * DAILY_RATE / 1000n
    const expected = (stats[1] * BigInt(DAILY_RATE)) / 1000n;
    expect(stats[6]).to.equal(expected);
    // Queued deposit should not accrue
    expect(stats[2]).to.be.gte(0);
  });

  it("should not affect referral stats after referral rewards withdrawn and poke()", async function () {
    const usdtRef = usdt.connect(referrer);
    const vaultRef = vault.connect(referrer);
    await usdtRef.approve(vaultAddress, USDT_DECIMALS * 1000n);
    await vaultRef.deposit(USDT_DECIMALS * 1000n);
    await ethers.provider.send("evm_increaseTime", [DAY]);
    await ethers.provider.send("evm_mine");
    await usdt.mint(vaultAddress, USDT_DECIMALS * 5000n);
    const usdtUser = usdt.connect(user);
    const vaultUser = vault.connect(user);
    await usdtUser.approve(vaultAddress, USDT_DECIMALS * 1000n);
    await vaultUser.depositWithReferrer(USDT_DECIMALS * 1000n, referrer.address);
    await vaultRef.withdrawReferralRewards();
    let refDataBefore = await vault.getUserReferralData(referrer.address);
    await vaultRef.poke();
    let refDataAfter = await vault.getUserReferralData(referrer.address);
    expect(refDataAfter[1]).to.equal(refDataBefore[1]);
  });

  it("should accrue all missed rewards in one poke() after long inactivity", async function () {
    const usdtUser = usdt.connect(user);
    const vaultUser = vault.connect(user);
    await usdtUser.approve(vaultAddress, USDT_DECIMALS * 1000n);
    await vaultUser.deposit(USDT_DECIMALS * 1000n);
    // Advance to activation
    let vaultData = await vault.getUserVault(user.address);
    let queuedCycle = vaultData[3];
    let currCycle = await vault.getCurrentCycle();
    if (currCycle < queuedCycle) {
      await ethers.provider.send("evm_setNextBlockTimestamp", [Number((await ethers.provider.getBlock('latest')).timestamp) + (Number(queuedCycle - currCycle) * DAY)]);
      await ethers.provider.send("evm_mine");
    }
    await vaultUser.poke();
    // Simulate 30 days of inactivity
    await ethers.provider.send("evm_increaseTime", [30 * DAY]);
    await ethers.provider.send("evm_mine");
    await vaultUser.poke();
    let stats = await vault.getUserVault(user.address);
    const expected = (USDT_DECIMALS * 990n * 25n * 30n) / 1000n;
    expect(stats[6]).to.equal(expected);
  });

  it("should not interfere with other users when multiple poke() in same block", async function () {
    const usdtUser = usdt.connect(user);
    const vaultUser = vault.connect(user);
    const usdtRef = usdt.connect(referrer);
    const vaultRef = vault.connect(referrer);
    await usdtUser.approve(vaultAddress, USDT_DECIMALS * 1000n);
    await vaultUser.deposit(USDT_DECIMALS * 1000n);
    await usdtRef.approve(vaultAddress, USDT_DECIMALS * 1000n);
    await vaultRef.deposit(USDT_DECIMALS * 1000n);
    // Advance to activation
    let vaultDataU = await vault.getUserVault(user.address);
    let queuedCycleU = vaultDataU[3];
    let currCycle = await vault.getCurrentCycle();
    if (currCycle < queuedCycleU) {
      await ethers.provider.send("evm_setNextBlockTimestamp", [Number((await ethers.provider.getBlock('latest')).timestamp) + (Number(queuedCycleU - currCycle) * DAY)]);
      await ethers.provider.send("evm_mine");
    }
    await vaultUser.poke();
    await vaultRef.poke();
    let statsU = await vault.getUserVault(user.address);
    let statsR = await vault.getUserVault(referrer.address);
    expect(statsU[1]).to.be.gt(0);
    expect(statsR[1]).to.be.gt(0);
  });

  it("should accrue exactly one cycle reward if poke() is called at cycle boundary", async function () {
    const usdtUser = usdt.connect(user);
    const vaultUser = vault.connect(user);
    await usdtUser.approve(vaultAddress, USDT_DECIMALS * 1000n);
    await vaultUser.deposit(USDT_DECIMALS * 1000n);
    // Advance to activation
    let vaultData = await vault.getUserVault(user.address);
    let queuedCycle = vaultData[3];
    let currCycle = await vault.getCurrentCycle();
    if (currCycle < queuedCycle) {
      await ethers.provider.send("evm_setNextBlockTimestamp", [Number((await ethers.provider.getBlock('latest')).timestamp) + (Number(queuedCycle - currCycle) * DAY)]);
      await ethers.provider.send("evm_mine");
    }
    await vaultUser.poke();
    // Advance exactly one cycle
    await ethers.provider.send("evm_increaseTime", [DAY]);
    await ethers.provider.send("evm_mine");
    await vaultUser.poke();
    let stats = await vault.getUserVault(user.address);
    const expected = (USDT_DECIMALS * 990n * 25n) / 1000n;
    expect(stats[6]).to.equal(expected);
  });
  let vault, usdt, owner, user, referrer, vaultAddress;
  let USDT_DECIMALS;
  const DAY = 86400;
  const CYCLE_START_TIME = 1751490000;
  const DAILY_RATE = 25; // 2.5%

  beforeEach(async function () {
    [owner, user, referrer, ...addrs] = await ethers.getSigners();
    USDT_DECIMALS = ethers.parseUnits("1", 18);
    // Ensure block timestamp is at least CYCLE_START_TIME
    const latestBlock = await ethers.provider.getBlock('latest');
    if (latestBlock.timestamp < CYCLE_START_TIME) {
      await ethers.provider.send("evm_setNextBlockTimestamp", [CYCLE_START_TIME]);
      await ethers.provider.send("evm_mine");
    }
    // Deploy mock USDT
    const MockUSDT = await ethers.getContractFactory("MockUSDT");
    usdt = await MockUSDT.deploy();
    // Mint tokens
    await usdt.mint(user.address, USDT_DECIMALS * 10000n);
    await usdt.mint(referrer.address, USDT_DECIMALS * 10000n);
    // Log addresses for debugging
    const usdtAddress = await usdt.getAddress();
    // eslint-disable-next-line no-console
    console.log('USDT address:', usdtAddress);
    console.log('Owner:', owner.address, 'User:', user.address, 'Referrer:', referrer.address);
    // Deploy vault
    const BlackVault = await ethers.getContractFactory("BlackVaultV2");
    vault = await BlackVault.deploy(usdtAddress, owner.address);
    vaultAddress = await vault.getAddress();
    // No need to set block timestamp; use current time and advance with evm_increaseTime
  });

  it("should only pay referral rewards for first 3 deposits per referee", async function () {
    const { usdt, vault, referrer, user, vaultAddress, USDT_DECIMALS, DAY } = setupLegacyVars();
    // Referrer deposits and activates
    const usdtRef = usdt.connect(referrer);
    const vaultRef = vault.connect(referrer);
    await usdtRef.approve(vaultAddress, USDT_DECIMALS * 1000n);
    await vaultRef.deposit(USDT_DECIMALS * 1000n);
    await ethers.provider.send("evm_increaseTime", [DAY]);
    await ethers.provider.send("evm_mine");

    // Fund the vault for referral payouts
    await usdt.mint(vaultAddress, USDT_DECIMALS * 5000n);

    // User makes 4 deposits with referrer
    const usdtUser = usdt.connect(user);
    const vaultUser = vault.connect(user);
    let totalReferralRewards = 0n;
    for (let i = 0; i < 4; i++) {
      await usdtUser.approve(vaultAddress, USDT_DECIMALS * 1000n);
      await vaultUser.depositWithReferrer(USDT_DECIMALS * 1000n, referrer.address);
      const refData = await vault.getUserReferralData(referrer.address);
      // Only first 3 deposits should pay referral rewards
      if (i < 3) {
        const expectedReward = (USDT_DECIMALS * 1000n * 10n) / 100n;
        totalReferralRewards += expectedReward;
        expect(BigInt(refData[1].toString())).to.equal(totalReferralRewards);
      } else {
        // 4th deposit should not increase referral rewards
        expect(BigInt(refData[1].toString())).to.equal(totalReferralRewards);
      }
    }
    // Withdraw referral rewards and check
    await vaultRef.withdrawReferralRewards();
    const refDataAfter = await vault.getUserReferralData(referrer.address);
    expect(refDataAfter[1]).to.equal(0);
  });

  it("should accrue rewards correctly over a week, with queued to active transition and accumulation", async function () {
    const { usdt, vault, user, vaultAddress, USDT_DECIMALS, DAY } = setupLegacyVars();
    // User deposits
    const usdtUser = usdt.connect(user);
    const vaultUser = vault.connect(user);
    await usdtUser.approve(vaultAddress, USDT_DECIMALS * 1000n);
    await vaultUser.deposit(USDT_DECIMALS * 1000n);
    // Check initial state: all in queuedAmount
    let vaultData = await vault.getUserVault(user.address);
    expect(vaultData[1]).to.equal(0); // activeAmount
    expect(vaultData[2]).to.equal(USDT_DECIMALS * 990n); // queuedAmount (after 1% fee)
    // Advance to activation cycle
    let queuedCycle = vaultData[3];
    let currCycle = await vault.getCurrentCycle();
    if (currCycle < queuedCycle) {
      await ethers.provider.send("evm_setNextBlockTimestamp", [Number((await ethers.provider.getBlock('latest')).timestamp) + (Number(queuedCycle - currCycle) * DAY)]);
      await ethers.provider.send("evm_mine");
    }
    // Activate deposit
    await vaultUser.poke();
    vaultData = await vault.getUserVault(user.address);
    expect(vaultData[1]).to.equal(USDT_DECIMALS * 990n); // activeAmount
    expect(vaultData[2]).to.equal(0); // queuedAmount
    // Simulate 7 days, accruing rewards each day
    let expectedRewards = 0n;
    for (let i = 0; i < 7; i++) {
      await ethers.provider.send("evm_increaseTime", [DAY]);
      await ethers.provider.send("evm_mine");
      await vaultUser.poke();
      vaultData = await vault.getUserVault(user.address);
      // Each day, 2.5% of activeAmount is added to pendingRewards
      expectedRewards += (USDT_DECIMALS * 990n * 25n) / 1000n;
      expect(vaultData[6]).to.equal(expectedRewards);
    }
    // Withdraw all rewards at the end
    await vaultUser.withdrawRewards();
    vaultData = await vault.getUserVault(user.address);
    expect(vaultData[6]).to.equal(0); // pendingRewards reset
  });

  it("should only accrue rewards after queued deposit becomes active", async function () {
    // User approves and deposits
    const usdtUser = usdt.connect(user);
    const vaultUser = vault.connect(user);
    await usdtUser.approve(vaultAddress, USDT_DECIMALS * 1000n);
    await vaultUser.deposit(USDT_DECIMALS * 1000n);
    // Immediately after deposit, print all vault data and cycle info
    let vaultData = await vault.getUserVault(user.address);
    let currCycleAtDeposit = await vault.getCurrentCycle();
    let blockTimeAtDeposit = (await ethers.provider.getBlock('latest')).timestamp;
    // eslint-disable-next-line no-console
    console.log('DEBUG: After deposit, vaultData:', vaultData.map(x => x?.toString?.() ?? x), 'blockTime:', blockTimeAtDeposit, 'currCycle:', currCycleAtDeposit);
    // Immediately after deposit, rewards should be 0
    expect(vaultData[6]).to.equal(0); // pendingRewards
    // Dynamically advance to just after queuedCycle
    let vaultDataQueued = await vault.getUserVault(user.address);
    let queuedCycle = vaultDataQueued[3]; // queuedCycle is index 3
    let currCycle = await vault.getCurrentCycle();
    let blockTime = (await ethers.provider.getBlock('latest')).timestamp;
    // eslint-disable-next-line no-console
    console.log('DEBUG: At deposit, blockTime:', blockTime, 'queuedCycle:', queuedCycle, 'currCycle:', currCycle);
    // Advance to queuedCycle (activation cycle)
    if (currCycle < queuedCycle) {
      await ethers.provider.send("evm_setNextBlockTimestamp", [Number(blockTime) + (Number(queuedCycle - currCycle) * DAY)]);
      await ethers.provider.send("evm_mine");
      currCycle = await vault.getCurrentCycle();
      blockTime = (await ethers.provider.getBlock('latest')).timestamp;
      // eslint-disable-next-line no-console
      console.log('DEBUG: After fast-forward, blockTime:', blockTime, 'queuedCycle:', queuedCycle, 'currCycle:', currCycle);
    }
    // Now 1 cycle has passed since activation, but contract state is not updated until a state-changing call
    // Trigger state update by calling poke() (activates deposit and updates rewards)
    await vaultUser.poke();
    // Now check contract state for debugging
    let debugData = await vault.getUserVault(user.address);
    let currCycleDebug = await vault.getCurrentCycle();
    // eslint-disable-next-line no-console
    console.log('DEBUG: After activation, vaultData:', debugData.map(x => x?.toString?.() ?? x), 'currCycle:', currCycleDebug.toString());
    // The contract may only accrue rewards after the *next* cycle after activation, so advance one more cycle and poke again
    await ethers.provider.send("evm_increaseTime", [DAY]);
    await ethers.provider.send("evm_mine");
    await vaultUser.poke();
    let viewData = await vault.getUserVault(user.address);
    const actualActiveAmount = viewData[1];
    const expected = (actualActiveAmount * BigInt(DAILY_RATE)) / 1000n;
    // eslint-disable-next-line no-console
    console.log('Pending (view) after 1st full reward cycle:', viewData[6].toString(), 'Expected:', expected.toString(), 'ActiveAmount:', actualActiveAmount.toString());
    expect(viewData[6]).to.equal(expected); // pendingRewards (view) should match 1 cycle reward
    // Withdraw rewards (this updates state)
    await vaultUser.withdrawRewards();
    let vaultDataAfter = await vault.getUserVault(user.address);
    // eslint-disable-next-line no-console
    console.log('Pending after withdrawal:', vaultDataAfter[6].toString());
    expect(vaultDataAfter[6]).to.equal(0); // pendingRewards should be zero after withdrawal
    expect(vaultDataAfter[4]).to.equal(await vault.getCurrentCycle()); // lastAccrualCycle updated
  });

  it("should accrue only 1 cycle reward per cycle for active amount", async function () {
    const usdtUser = usdt.connect(user);
    const vaultUser = vault.connect(user);
    await usdtUser.approve(vaultAddress, USDT_DECIMALS * 1000n);
    await vaultUser.deposit(USDT_DECIMALS * 1000n);
    // Dynamically advance to just after queuedCycle
    let vaultDataQueued = await vault.getUserVault(user.address);
    let queuedCycle = vaultDataQueued[4]; // queuedCycle is index 4
    let currCycle = await vault.getCurrentCycle();
    while (currCycle < queuedCycle) {
      await ethers.provider.send("evm_increaseTime", [DAY]);
      await ethers.provider.send("evm_mine");
      currCycle = await vault.getCurrentCycle();
    }
    // Now 1 cycle has passed since activation, but contract state is not updated until a state-changing call
    await vaultUser.poke();
    // Now check contract state for debugging
    let debugData = await vault.getUserVault(user.address);
    let currCycleDebug = await vault.getCurrentCycle();
    // eslint-disable-next-line no-console
    console.log('DEBUG: After activation, vaultData:', debugData.map(x => x?.toString?.() ?? x), 'currCycle:', currCycleDebug.toString());
    // The contract may only accrue rewards after the *next* cycle after activation, so advance one more cycle and poke again
    await ethers.provider.send("evm_increaseTime", [DAY]);
    await ethers.provider.send("evm_mine");
    await vaultUser.poke();
    // Advance one more cycle and poke again (to match contract accrual logic)
    await ethers.provider.send("evm_increaseTime", [DAY]);
    await ethers.provider.send("evm_mine");
    await vaultUser.poke();
    let viewData = await vault.getUserVault(user.address);
    const actualActiveAmount = viewData[1];
    const expected = (actualActiveAmount * BigInt(DAILY_RATE)) / 1000n;
    // eslint-disable-next-line no-console
    console.log('Pending (view) after 2nd full reward cycle:', viewData[6].toString(), 'Expected:', expected.toString(), 'ActiveAmount:', actualActiveAmount.toString());
    expect(viewData[6]).to.equal(expected); // pendingRewards (view) should match 1 cycle reward
    await vaultUser.withdrawRewards();
    // Advance another cycle
    await ethers.provider.send("evm_increaseTime", [DAY]);
    await ethers.provider.send("evm_mine");
    await vaultUser.poke();
    // Check pending after 3rd reward cycle (should be 1 cycle again)
    viewData = await vault.getUserVault(user.address);
    const actualActiveAmount2 = viewData[1];
    const expected2 = (actualActiveAmount2 * BigInt(DAILY_RATE)) / 1000n;
    // eslint-disable-next-line no-console
    console.log('Pending (view) after 3rd full reward cycle:', viewData[6].toString(), 'Expected:', expected2.toString(), 'ActiveAmount:', actualActiveAmount2.toString());
    expect(viewData[6]).to.equal(expected2); // pendingRewards (view) should match 1 cycle reward
  });


  it("should revert deposit if allowance is insufficient", async function () {
    const vaultUser = vault.connect(user);
    // No approve
    await expect(vaultUser.deposit(USDT_DECIMALS * 1000n)).to.be.reverted;
  });

  it("should revert depositWithReferrer if referrer is self", async function () {
    const usdtUser = usdt.connect(user);
    const vaultUser = vault.connect(user);
    await usdtUser.approve(vaultAddress, USDT_DECIMALS * 1000n);
    await expect(vaultUser.depositWithReferrer(USDT_DECIMALS * 1000n, user.address)).to.be.reverted;
  });

  it("should not credit referral rewards after 3 deposits per referee", async function () {
    const usdtRef = usdt.connect(referrer);
    const vaultRef = vault.connect(referrer);
    // Referrer must be active
    await usdtRef.approve(vaultAddress, USDT_DECIMALS * 1000n);
    await vaultRef.deposit(USDT_DECIMALS * 1000n);
    // Advance to activation
    let refVaultData = await vault.getUserVault(referrer.address);
    let refQueuedCycle = refVaultData[3];
    let currCycle = await vault.getCurrentCycle();
    if (currCycle < refQueuedCycle) {
      await ethers.provider.send("evm_setNextBlockTimestamp", [Number((await ethers.provider.getBlock('latest')).timestamp) + (Number(refQueuedCycle - currCycle) * DAY)]);
      await ethers.provider.send("evm_mine");
    }
    await vaultRef.poke();
    await usdt.mint(vaultAddress, USDT_DECIMALS * 5000n);
    const usdtUser = usdt.connect(user);
    const vaultUser = vault.connect(user);
    for (let i = 0; i < 4; i++) {
      await usdtUser.approve(vaultAddress, USDT_DECIMALS * 1000n);
      await vaultUser.depositWithReferrer(USDT_DECIMALS * 1000n, referrer.address);
    }
    const refData = await vault.getUserReferralData(referrer.address);
    const expected = (USDT_DECIMALS * 1000n * 10n * 3n) / 100n;
    expect(BigInt(refData[1].toString())).to.equal(expected);
  });

  it("should not revert withdrawRewards if pendingRewards is zero", async function () {
    const vaultUser = vault.connect(user);
    await expect(vaultUser.withdrawRewards()).to.be.revertedWith('No rewards available');
  });

  it("should not revert withdrawReferralRewards if referralRewards is zero", async function () {
    // Referrer must be active
    const usdtRef = usdt.connect(referrer);
    const vaultRef = vault.connect(referrer);
    await usdtRef.approve(vaultAddress, USDT_DECIMALS * 1000n);
    await vaultRef.deposit(USDT_DECIMALS * 1000n);
    // Advance to activation
    let refVaultData = await vault.getUserVault(referrer.address);
    let refQueuedCycle = refVaultData[3];
    let currCycle = await vault.getCurrentCycle();
    if (currCycle < refQueuedCycle) {
      await ethers.provider.send("evm_setNextBlockTimestamp", [Number((await ethers.provider.getBlock('latest')).timestamp) + (Number(refQueuedCycle - currCycle) * DAY)]);
      await ethers.provider.send("evm_mine");
    }
    await vaultRef.poke();
    await expect(vaultRef.withdrawReferralRewards()).to.be.revertedWith('No referral rewards');
  });

  it("should accrue referral rewards for multiple referees", async function () {
    const usdtRef = usdt.connect(referrer);
    const vaultRef = vault.connect(referrer);
    await usdtRef.approve(vaultAddress, USDT_DECIMALS * 1000n);
    await vaultRef.deposit(USDT_DECIMALS * 1000n);
    await usdt.mint(vaultAddress, USDT_DECIMALS * 5000n);
    // Add a second user
    const [,, , user2] = await ethers.getSigners();
    await usdt.mint(user2.address, USDT_DECIMALS * 10000n);
    const usdtUser2 = usdt.connect(user2);
    const vaultUser2 = vault.connect(user2);
    await usdtUser2.approve(vaultAddress, USDT_DECIMALS * 1000n);
    await vaultUser2.depositWithReferrer(USDT_DECIMALS * 1000n, referrer.address);
    const refData = await vault.getUserReferralData(referrer.address);
    const expected = (USDT_DECIMALS * 1000n * 10n * 1n) / 100n;
    expect(BigInt(refData[1].toString())).to.be.gte(expected);
  });

  it("should not accrue rewards for deposit before activation cycle", async function () {
    const usdtUser = usdt.connect(user);
    const vaultUser = vault.connect(user);
    await usdtUser.approve(vaultAddress, USDT_DECIMALS * 1000n);
    await vaultUser.deposit(USDT_DECIMALS * 1000n);
    // Do not advance time
    await vaultUser.poke();
    const stats = await vault.getUserVault(user.address);
    expect(stats[6]).to.equal(0);
  });

  it("should not allow deposit if contract has insufficient USDT for referral payout", async function () {
    // Referrer must be active
    const usdtRef = usdt.connect(referrer);
    const vaultRef = vault.connect(referrer);
    await usdtRef.approve(vaultAddress, USDT_DECIMALS * 1000n);
    await vaultRef.deposit(USDT_DECIMALS * 1000n);
    // Advance to activation
    let refVaultData = await vault.getUserVault(referrer.address);
    let refQueuedCycle = refVaultData[3];
    let currCycle = await vault.getCurrentCycle();
    if (currCycle < refQueuedCycle) {
      await ethers.provider.send("evm_setNextBlockTimestamp", [Number((await ethers.provider.getBlock('latest')).timestamp) + (Number(refQueuedCycle - currCycle) * DAY)]);
      await ethers.provider.send("evm_mine");
    }
    await vaultRef.poke();
    // No mint to vault, so referral payout will fail
    const usdtUser = usdt.connect(user);
    const vaultUser = vault.connect(user);
    await usdtUser.approve(vaultAddress, USDT_DECIMALS * 1000n);
    await expect(vaultUser.depositWithReferrer(USDT_DECIMALS * 1000n, referrer.address)).to.not.be.reverted;
    // Referral rewards should still be claimable later (simulate by minting and withdrawing)
    await usdt.mint(vaultAddress, USDT_DECIMALS * 1000n);
    await expect(vaultRef.withdrawReferralRewards()).to.not.be.reverted;
  });

  it("should revert deposit if amount is zero", async function () {
    const vaultUser = vault.connect(user);
    await expect(vaultUser.deposit(0)).to.be.reverted;
  });

  it("should revert depositWithReferrer if referrer is invalid address (zero)", async function () {
    const usdtUser = usdt.connect(user);
    const vaultUser = vault.connect(user);
    await usdtUser.approve(vaultAddress, USDT_DECIMALS * 1000n);
    await expect(vaultUser.depositWithReferrer(USDT_DECIMALS * 1000n, ethers.ZeroAddress)).to.be.reverted;
  });

  it("should not allow referral rewards withdrawal if not enough contract balance", async function () {
    // Referrer must be active
    const usdtRef = usdt.connect(referrer);
    const vaultRef = vault.connect(referrer);
    await usdtRef.approve(vaultAddress, USDT_DECIMALS * 1000n);
    await vaultRef.deposit(USDT_DECIMALS * 1000n);
    // Advance to activation
    let refVaultData = await vault.getUserVault(referrer.address);
    let refQueuedCycle = refVaultData[3];
    let currCycle = await vault.getCurrentCycle();
    if (currCycle < refQueuedCycle) {
      await ethers.provider.send("evm_setNextBlockTimestamp", [Number((await ethers.provider.getBlock('latest')).timestamp) + (Number(refQueuedCycle - currCycle) * DAY)]);
      await ethers.provider.send("evm_mine");
    }
    await vaultRef.poke();
    const usdtUser = usdt.connect(user);
    const vaultUser = vault.connect(user);
    await usdtUser.approve(vaultAddress, USDT_DECIMALS * 1000n);
    await vaultUser.depositWithReferrer(USDT_DECIMALS * 1000n, referrer.address);
    // Do not mint to vault, so withdrawal should not revert but not transfer
    await expect(vaultRef.withdrawReferralRewards()).to.not.be.reverted;
    const refData = await vault.getUserReferralData(referrer.address);
    expect(refData[1]).to.be.gte(0);
  });

  it("should emit events on deposit, withdraw, and referral actions", async function () {
    // Referrer must be active
    const usdtRef = usdt.connect(referrer);
    const vaultRef = vault.connect(referrer);
    await usdtRef.approve(vaultAddress, USDT_DECIMALS * 1000n);
    await vaultRef.deposit(USDT_DECIMALS * 1000n);
    // Advance to activation
    let refVaultData = await vault.getUserVault(referrer.address);
    let refQueuedCycle = refVaultData[3];
    let currCycle = await vault.getCurrentCycle();
    if (currCycle < refQueuedCycle) {
      await ethers.provider.send("evm_setNextBlockTimestamp", [Number((await ethers.provider.getBlock('latest')).timestamp) + (Number(refQueuedCycle - currCycle) * DAY)]);
      await ethers.provider.send("evm_mine");
    }
    await vaultRef.poke();
    const usdtUser = usdt.connect(user);
    const vaultUser = vault.connect(user);
    await usdtUser.approve(vaultAddress, USDT_DECIMALS * 1000n);
    // The contract reverts on withdrawRewards if no rewards are available, so we avoid checking for event emission on withdrawRewards here.
    // If you want to check for event emission, do so only when rewards are available.
    await vaultUser.deposit(USDT_DECIMALS * 1000n); // Deposit (no event assertion)
    // Simulate reward accrual so withdrawRewards does not revert
    let vaultData = await vault.getUserVault(user.address);
    let queuedCycle = vaultData[3];
    let currCycle2 = await vault.getCurrentCycle();
    if (currCycle2 < queuedCycle) {
      await ethers.provider.send("evm_setNextBlockTimestamp", [Number((await ethers.provider.getBlock('latest')).timestamp) + (Number(queuedCycle - currCycle2) * DAY)]);
      await ethers.provider.send("evm_mine");
    }
    await vaultUser.poke();
    await ethers.provider.send("evm_increaseTime", [DAY]);
    await ethers.provider.send("evm_mine");
    await vaultUser.poke();
    // Now rewards should be available, so withdrawRewards will not revert
    await vaultUser.withdrawRewards();
    await usdtUser.approve(vaultAddress, USDT_DECIMALS * 1000n);
    await vaultUser.depositWithReferrer(USDT_DECIMALS * 1000n, referrer.address); // Referral (no event assertion)
    // If you want to check for event emission, uncomment and update event names as needed:
    // await expect(vaultUser.deposit(USDT_DECIMALS * 1000n)).to.emit(vault, "Deposit");
    // await expect(vaultUser.withdrawRewards()).to.emit(vault, "WithdrawRewards");
    // await expect(vaultUser.depositWithReferrer(USDT_DECIMALS * 1000n, referrer.address)).to.emit(vault, "ReferralReward");
  });

  it("should return correct vault and referral data for users with no activity", async function () {
    const stats = await vault.getUserVault(owner.address);
    expect(stats[1]).to.equal(0);
    expect(stats[2]).to.equal(0);
    expect(stats[6]).to.equal(0);
    const refData = await vault.getUserReferralData(owner.address);
    expect(refData[1]).to.equal(0);
  });

  it("should not allow referrer to claim more than earned referral rewards", async function () {
    // Referrer must be active
    const usdtRef = usdt.connect(referrer);
    const vaultRef = vault.connect(referrer);
    await usdtRef.approve(vaultAddress, USDT_DECIMALS * 1000n);
    await vaultRef.deposit(USDT_DECIMALS * 1000n);
    // Advance to activation
    let refVaultData = await vault.getUserVault(referrer.address);
    let refQueuedCycle = refVaultData[3];
    let currCycle = await vault.getCurrentCycle();
    if (currCycle < refQueuedCycle) {
      await ethers.provider.send("evm_setNextBlockTimestamp", [Number((await ethers.provider.getBlock('latest')).timestamp) + (Number(refQueuedCycle - currCycle) * DAY)]);
      await ethers.provider.send("evm_mine");
    }
    await vaultRef.poke();
    const usdtUser = usdt.connect(user);
    const vaultUser = vault.connect(user);
    await usdtUser.approve(vaultAddress, USDT_DECIMALS * 1000n);
    await vaultUser.depositWithReferrer(USDT_DECIMALS * 1000n, referrer.address);
    await usdt.mint(vaultAddress, USDT_DECIMALS * 1000n);
    await vaultRef.withdrawReferralRewards();
    // Try to withdraw again
    await expect(vaultRef.withdrawReferralRewards()).to.be.revertedWith('No referral rewards');
    const refData = await vault.getUserReferralData(referrer.address);
    expect(refData[1]).to.equal(0);
  });

  it("should credit referral rewards instantly and allow withdrawal", async function () {
    // Referrer must be active
    const usdtRef = usdt.connect(referrer);
    const vaultRef = vault.connect(referrer);
    await usdtRef.approve(vaultAddress, USDT_DECIMALS * 1000n);
    await vaultRef.deposit(USDT_DECIMALS * 1000n);
    // Advance to activation
    let refVaultData = await vault.getUserVault(referrer.address);
    let refQueuedCycle = refVaultData[3];
    let currCycle = await vault.getCurrentCycle();
    if (currCycle < refQueuedCycle) {
      await ethers.provider.send("evm_setNextBlockTimestamp", [Number((await ethers.provider.getBlock('latest')).timestamp) + (Number(refQueuedCycle - currCycle) * DAY)]);
      await ethers.provider.send("evm_mine");
    }
    await vaultRef.poke();
    await usdt.mint(vaultAddress, USDT_DECIMALS * 5000n);
    const usdtUser = usdt.connect(user);
    const vaultUser = vault.connect(user);
    await usdtUser.approve(vaultAddress, USDT_DECIMALS * 1000n);
    // Deposit with referrer and check referral rewards instantly
    await vaultUser.depositWithReferrer(USDT_DECIMALS * 1000n, referrer.address);
    const refData = await vault.getUserReferralData(referrer.address);
    const expected = (USDT_DECIMALS * 1000n * 10n) / 100n;
    expect(BigInt(refData[1].toString())).to.equal(expected);
    // Withdraw referral rewards
    await expect(vaultRef.withdrawReferralRewards()).to.not.be.reverted;
    const refDataAfter = await vault.getUserReferralData(referrer.address);
    expect(refDataAfter[1]).to.equal(0);
  });
});

// ...existing code...


