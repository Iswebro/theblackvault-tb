// src/useBlackVault.js
import { Contract, formatEther } from "ethers";
import BlackVaultABI from "./contract/BlackVaultABI.json";

import { contractAddress } from "./lib/config.js";
const CONTRACT_ADDRESS = contractAddress;

/**
 * @param {import("ethers").Provider|import("ethers").Signer} providerOrSigner
 */
export const getContract = (providerOrSigner) =>
  new Contract(CONTRACT_ADDRESS, BlackVaultABI.abi, providerOrSigner);

/**
 * Fetches the user’s vault data from chain and returns already‐formatted strings.
 * @param {import("ethers").Provider} provider
 * @param {string} address
 */
export const getUserInfo = async (provider, address) => {
  const contract = getContract(provider);
  // getUserVault returns [ totalDep, activeAmt, queuedAmt, pending, withdrawn, lastCycle, joined ]
  const data = await contract.getUserVault(address);
  return {
    activeAmount: formatEther(data.activeAmt),
    queuedAmount: formatEther(data.queuedAmt),
    pendingRewards: formatEther(data.pending),
  };
};
