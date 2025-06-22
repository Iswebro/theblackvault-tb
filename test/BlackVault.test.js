const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("BlackVault", function () {
  let VaultFactory, vault, owner, user, referrer;

  beforeEach(async function () {
    [owner, user, referrer] = await ethers.getSigners();
    VaultFactory = await ethers.getContractFactory("BlackVault");
    vault = await VaultFactory.deploy();
    await vault.waitForDeployment(); // ✅ FIXED HERE
  });

 it.skip("should accept deposits and record them", async function () {
    await vault.connect(referrer).deposit(ethers.ZeroAddress, { value: ethers.parseEther("1") });
    await vault.connect(user).deposit(referrer.address, { value: ethers.parseEther("1") });

    const referral = await vault.referralRewards(referrer.address);
    expect(referral).to.equal(ethers.parseEther("0.1")); // 10%
  });

  it("should accumulate and withdraw rewards after 2 cycles", async function () {
    await vault.connect(user).deposit(ethers.ZeroAddress, { value: ethers.parseEther("1") });

    // Simulate 2 cycles passed
    await vault.connect(owner)._updateRewards(user.address); // Only works in local testing because it's internal

    await vault.connect(user).withdraw();
    const total = await vault.totalWithdrawn(user.address);
    expect(total).to.be.gt(0);
  });

  it("should allow referral reward withdrawal", async function () {
    await vault.connect(referrer).deposit(ethers.ZeroAddress, { value: ethers.parseEther("1") });
    await vault.connect(user).deposit(referrer.address, { value: ethers.parseEther("1") });

    const balanceBefore = await ethers.provider.getBalance(referrer.address);
    const tx = await vault.connect(referrer).withdrawReferralEarnings();
    await tx.wait();
    const balanceAfter = await ethers.provider.getBalance(referrer.address);

    expect(balanceAfter).to.be.gt(balanceBefore);
  });

  it("should pause and unpause correctly", async function () {
    await vault.connect(owner).togglePause();
    await expect(
      vault.connect(user).deposit(ethers.ZeroAddress, { value: ethers.parseEther("1") })
    ).to.be.revertedWith("Vault is paused");

    await vault.connect(owner).togglePause();
    await expect(
      vault.connect(user).deposit(ethers.ZeroAddress, { value: ethers.parseEther("1") })
    ).to.emit(vault, "Deposited");
  });

  it("should allow only owner to withdraw funds in emergency", async function () {
    await vault.connect(user).deposit(ethers.ZeroAddress, { value: ethers.parseEther("1") });

    await expect(
      vault.connect(user).emergencyWithdraw()
    ).to.be.revertedWith("Not owner");

    await vault.connect(owner).emergencyWithdraw();
  });
});
