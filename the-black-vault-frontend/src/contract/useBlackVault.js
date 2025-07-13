// src/useBlackVault.js
import { ethers } from "ethers";
import BlackVaultJSON from "./BlackVaultABI.json";

const CONTRACT_ADDRESS = "0xDe58F2cb3Bc62dfb9963f422d0DB079B2407a719";

export const getContract = (providerOrSigner) => {
  return new ethers.Contract(CONTRACT_ADDRESS, BlackVaultJSON.abi, providerOrSigner);
};

/**
 * Deposit USDT into the vault.
 * @param {ethers.Signer} signer 
 * @param {string} amountInUsdt — string like "100.0"
 */
export const deposit = async (signer, amountInUsdt) => {
  const contract = getContract(signer);
  const amount = ethers.utils.parseUnits(amountInUsdt, 18);
  const tx = await contract.deposit(amount);
  await tx.wait();
  return tx;
};

/**
 * Withdraw your accrued rewards (not principal).
 * @param {ethers.Signer} signer 
 */
export const withdrawRewards = async (signer) => {
  const contract = getContract(signer);
  const tx = await contract.withdrawRewards();
  await tx.wait();
  return tx;
};

/**
 * Withdraw your referral rewards.
 * @param {ethers.Signer} signer 
 */
export const withdrawReferralRewards = async (signer) => {
  const contract = getContract(signer);
  const tx = await contract.withdrawReferralRewards();
  await tx.wait();
  return tx;
};

/**
 * Fetches the on-chain vault state for a user.
 * @param {ethers.Provider} provider 
 * @param {string} address 
 */
export const getUserInfo = async (provider, address) => {
  const contract = getContract(provider);

  // getUserVault returns:
  // [ totalDeposited, activeAmt, queuedAmt, pending, withdrawn, lastCycle, joined ]
  const vaultData = await contract.getUserVault(address);

  const totalDeposited       = vaultData.totalDep     ?? vaultData[0];
  const activeAmt            = vaultData.activeAmt   ?? vaultData[1];
  const queuedAmt            = vaultData.queuedAmt   ?? vaultData[2];
  const pendingRewards       = vaultData.pending     ?? vaultData[3];
  const totalRewardsWithdrawn= vaultData.withdrawn   ?? vaultData[4];
  const lastCycle            = vaultData.lastCycle   ?? vaultData[5];
  const joinedCycle          = vaultData.joined      ?? vaultData[6];

  return {
    totalDeposited:        ethers.utils.formatUnits(totalDeposited,       18),
    activeAmount:          ethers.utils.formatUnits(activeAmt,            18),
    queuedAmount:          ethers.utils.formatUnits(queuedAmt,            18),
    pendingRewards:        ethers.utils.formatUnits(pendingRewards,       18),
    totalRewardsWithdrawn: ethers.utils.formatUnits(totalRewardsWithdrawn,18),
    lastCycle:             lastCycle.toString(),
    joinedCycle:           joinedCycle.toString(),
  };
};
