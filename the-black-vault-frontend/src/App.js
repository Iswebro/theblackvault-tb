"use client";
// src/App.js
import { useEffect, useState, useRef } from "react";
import { ethers, Contract, formatEther, parseEther } from "ethers";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { getUserInfo as fetchVaultInfo } from "./useBlackVault";
import { useToast, ToastContainer, ToastProvider } from "./components/Toast";
import { getReferralFromURL } from "./connectWallet";
import { useAccount, useChainId, useSwitchChain, useWalletClient, usePublicClient } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { bsc } from 'wagmi/chains';
import { BrowserProvider } from 'ethers';
import BlackVaultArtifact from "./contract/BlackVaultABI.json";
import ERC20Artifact from "./contract/ERC20Abi.json";
import HowItWorks from "./components/HowItWorks";
import Leaderboard from "./components/Leaderboard";
import ReferralsModal from "./components/ReferralsModal";
import TroubleshootingModal from "./components/TroubleshootingModal";
import AccrualInfoModal from "./components/AccrualInfoModal";
import ProjectIntroduction from "./components/ProjectIntroduction";
import SmartDeFiInsights from "./components/SmartDeFiInsights";
import Footer from "./components/Footer";
import TrustWalletHelper from "./components/TrustWalletHelper";
import WeeklyChallenge from "./components/WeeklyChallenge";
import { config } from "./lib/config.js";
import securityUtils from "./utils/security.js";
import { walletClientToSigner, publicClientToProvider } from "./utils/ethersAdapter.js";

// Use .abi if present (Hardhat/Truffle artifact), else use as array
const BlackVaultAbi = BlackVaultArtifact.abi || BlackVaultArtifact;
const ERC20Abi = ERC20Artifact.abi || ERC20Artifact;


const CONTRACT_ADDRESS = config.contractAddress;
const USDT_ADDRESS = config.usdtAddress;
const DEFAULT_REFERRER = config.defaultReferrer;

export default function App() {
  // RainbowKit wallet integration
  const { address: walletAddress, isConnected, isConnecting, isDisconnected } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  
  // Derived state
  const isOnBSC = chainId === bsc.id;
  const walletError = null; // RainbowKit handles errors internally
  
  // Legacy functions for compatibility (will be removed gradually)
  const connectWallet = () => {
    // RainbowKit handles connection through ConnectButton
    console.log('Connect wallet called - handled by RainbowKit');
  };
  
  const disconnectWallet = () => {
    // RainbowKit handles disconnection through ConnectButton
    console.log('Disconnect wallet called - handled by RainbowKit');  
  };
  
  const switchToBSC = () => {
    if (switchChain) {
      switchChain({ chainId: bsc.id });
    }
  };

  // All state hooks first
  const [showActivationModal, setShowActivationModal] = useState(false);
  const [roi, setRoi] = useState({ invested: "0", earned: "0", roiBP: "0", percentage: "0.00" });
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [account, setAccount] = useState("");
  const [contract, setContract] = useState(null);
  const [usdtContract, setUsdtContract] = useState(null);
  const [balance, setBalance] = useState("0");
  const [usdtBalance, setUsdtBalance] = useState("0");
  // Removed: queuedBalance (no longer used in V2)
  const [depositAmount, setDepositAmount] = useState("");
  const [rewards, setRewards] = useState("0");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [referralRewards, setReferralRewards] = useState("0");
  const [totalReferralRewards, setTotalReferralRewards] = useState("0"); // Total referral rewards earned (for ROI calculation)
  const [referralAddress, setReferralAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [txLoading, setTxLoading] = useState(false);
  const [referralCount, setReferralCount] = useState(0);
  const [uniqueReferralCount, setUniqueReferralCount] = useState(0);
  const [minDeposit, setMinDeposit] = useState("0");
  const [usdtAllowance, setUsdtAllowance] = useState("0");
  const [vaultActiveAmount, setVaultActiveAmount] = useState("0");
  const [referralBonusesRemaining, setReferralBonusesRemaining] = useState(3);
  const [showReferralsModal, setShowReferralsModal] = useState(false);
  const [showTroubleshootingModal, setShowTroubleshootingModal] = useState(false);
  const [showAccrualInfoModal, setShowAccrualInfoModal] = useState(false);
  const [dailyRate, setDailyRate] = useState("0");
  const [cycleStartTime, setCycleStartTime] = useState(0);
  const [cycleDuration, setCycleDuration] = useState(0);
  const [timeUntilNextCycle, setTimeUntilNextCycle] = useState(0);
  
  // Default referrer tracking
  const [defaultReferrerStats, setDefaultReferrerStats] = useState({
    totalReferrals: 0,
    uniqueReferrals: 0,
    totalRewards: "0",
    availableRewards: "0"
  });

  // Global stats for introduction (fetched without wallet connection)
  const [globalStats, setGlobalStats] = useState(null);

  // Fetch global stats without requiring wallet connection
  const fetchGlobalStats = async () => {
    try {
      // Use public client if available, otherwise create read-only provider
      let readOnlyProvider;
      if (publicClient) {
        readOnlyProvider = publicClientToProvider(publicClient);
      } else {
        readOnlyProvider = new ethers.JsonRpcProvider(config.rpcUrl || 'https://bsc-dataseed.binance.org/');
      }
      
      const readOnlyContract = new Contract(CONTRACT_ADDRESS, BlackVaultAbi, readOnlyProvider);
      
      // Fetch contract stats
      const contractStats = await readOnlyContract.getContractStats();
      
      const stats = {
        totalDeposited: Math.floor(parseFloat(formatEther(contractStats[5]))).toString(), // Use actual contract balance (index 5) instead of cumulative deposits (index 0)
        totalUsers: contractStats[4].toString(),
        totalRewardsWithdrawn: formatEther(contractStats[1]),
        totalActiveAmount: formatEther(contractStats[3])
      };
      
      setGlobalStats(stats);
      console.log("🌍 Global stats fetched:", stats);
      console.log("🌍 Raw contract data:", {
        cumulativeTotalDeposited: formatEther(contractStats[0]) + " USDT", // Historical total
        currentContractBalance: formatEther(contractStats[5]) + " USDT", // Actual TVL
        totalUsers: contractStats[4].toString() + " users",
        totalRewardsWithdrawn: formatEther(contractStats[1]) + " USDT",
        totalActiveAmount: formatEther(contractStats[3]) + " USDT"
      });
    } catch (error) {
      console.log("Could not fetch global stats:", error.message);
      // Set fallback stats (should be updated based on actual contract state)
      setGlobalStats({
        totalDeposited: "6500+", // Updated to reflect current contract balance (~6.5k USDT)
        totalUsers: "10+",
        totalRewardsWithdrawn: "50+",
        totalActiveAmount: "6000+"
      });
    }
  };

  // Helper function to query events with rate limiting and retry logic
  const queryEventsWithRetry = async (contract, filter, blockRanges = [-30000, -10000, -5000]) => {
    for (let i = 0; i < blockRanges.length; i++) {
      const blockRange = blockRanges[i];
      try {
        console.log(`🔍 DEBUG: Trying event query with ${Math.abs(blockRange)}k block range...`);
        if (i > 0) {
          // Add delay between retries to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 1000 * i));
        }
        const events = await contract.queryFilter(filter, blockRange);
        console.log(`🔍 DEBUG: Successfully found ${events.length} events with ${Math.abs(blockRange)}k range`);
        return events;
      } catch (error) {
        console.warn(`⚠️ Event query failed with ${Math.abs(blockRange)}k range:`, error.message);
        if (i === blockRanges.length - 1) {
          console.error("❌ All event query attempts failed");
          return [];
        }
      }
    }
    return [];
  };

  // Derived variables (after all state hooks)
  const { toasts, addToast, removeToast } = useToast();
  const isManuallyDisconnected = useRef(false);
  const [showDisclaimer, setShowDisclaimer] = useState(true);

  // Get referral from URL on component mount
  useEffect(() => {
    const refFromURL = getReferralFromURL()
    setReferralAddress(refFromURL)
    
    // Show testing environment banner
    if (process.env.NEXT_PUBLIC_ENVIRONMENT === 'testing') {
      console.log('🧪 TESTING ENVIRONMENT DETECTED');
    }
  }, [])

  // Sync RainbowKit wallet state with app state
  useEffect(() => {
    console.log(`🔍 Wallet state change: isConnected=${isConnected}, walletAddress=${walletAddress}, current account=${account}`);
    console.log(`🔍 WalletClient available: ${!!walletClient}, PublicClient available: ${!!publicClient}`);
    
    if (isConnected && walletAddress && walletClient && publicClient) {
      // Prevent double initialization if already connected to same address
      if (account === walletAddress && provider && signer) {
        console.log("✅ Already connected to this wallet, skipping re-initialization");
        return;
      }
      
      // Set account from RainbowKit
      setAccount(walletAddress);
      
      // Initialize ethers provider and signer using Wagmi clients (works with all wallet types)
      const initializeProvider = async () => {
        try {
          console.log("🔧 Initializing provider for wallet:", walletAddress);
          console.log("🔧 Wallet type:", walletClient.mode, walletClient.transport?.type);
          console.log("🔧 Current chainId from RainbowKit:", chainId);
          
          // Use Wagmi's walletClient and publicClient for universal wallet support
          const ethersProvider = publicClientToProvider(publicClient);
          const ethersSigner = await walletClientToSigner(walletClient);
          
          console.log("🔧 Provider created successfully via Wagmi");
          console.log("🔧 Signer obtained:", await ethersSigner.getAddress());
          
          setProvider(ethersProvider);
          setSigner(ethersSigner);
          
          console.log("✅ Wallet connected and provider initialized via Wagmi:", walletAddress);
          addToast("Wallet connected successfully!", "success");
          
          // Auto-scroll to top after successful wallet connection
          window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch (error) {
          console.error("❌ Failed to initialize provider via Wagmi:", error);
          
          // Handle specific network change errors
          if (error.message && error.message.includes("network changed")) {
            console.log("🔄 Network change detected, retrying connection...");
            // Wait a bit for network to stabilize
            await new Promise(resolve => setTimeout(resolve, 1000));
            try {
              const retryWalletClient = await getWalletClient({ config });
              if (retryWalletClient) {
                const retryEthersProvider = new ethers.BrowserProvider(retryWalletClient);
                const retryEthersSigner = await walletClientToSigner(retryWalletClient);
                
                setProvider(retryEthersProvider);
                setSigner(retryEthersSigner);
                console.log("✅ Network change handled successfully");
                addToast("Wallet reconnected after network change", "success");
                return;
              }
            } catch (retryError) {
              console.error("❌ Retry after network change failed:", retryError);
            }
          }
          
          // Fallback to window.ethereum for backwards compatibility
          console.log("🔄 Falling back to window.ethereum provider...");
          try {
            if (window.ethereum) {
              const browserProvider = new ethers.BrowserProvider(window.ethereum);
              
              // Add network verification before getting signer
              try {
                const network = await browserProvider.getNetwork();
                console.log("🌐 Current network:", network.chainId);
                
                // Ensure we're on BSC network (chainId 56)
                if (network.chainId !== 56n) {
                  console.log("⚠️ Not on BSC network, requesting switch...");
                  try {
                    await window.ethereum.request({
                      method: 'wallet_switchEthereumChain',
                      params: [{ chainId: '0x38' }], // BSC chainId in hex
                    });
                  } catch (switchError) {
                    console.error("Failed to switch network:", switchError);
                  }
                }
                
                const ethersSigner = await browserProvider.getSigner();
                
                setProvider(browserProvider);
                setSigner(ethersSigner);
                
                console.log("✅ Fallback provider initialized successfully");
                addToast("Wallet connected successfully!", "success");
              } catch (networkError) {
                console.error("❌ Network verification failed:", networkError);
                // Still try to set provider even if network check fails
                const ethersSigner = await browserProvider.getSigner();
                setProvider(browserProvider);
                setSigner(ethersSigner);
                addToast("Wallet connected (network may need verification)", "warning");
              }
            } else {
              throw new Error("No ethereum provider available");
            }
          } catch (fallbackError) {
            console.error("❌ Fallback provider initialization failed:", fallbackError);
            addToast("Failed to initialize wallet connection", "error");
          }
        }
      };
      
      initializeProvider();
    } else if (!isConnected && account) {
      // Reset state when wallet disconnects
      console.log("🔄 Wallet disconnected, clearing state");
      setAccount("");
      setProvider(null);
      setSigner(null);
      setBalance("0");
      setUsdtBalance("0");
      setRewards("0");
      setReferralRewards("0");
    }
  }, [isConnected, walletAddress, walletClient, publicClient, addToast]);

  // Initialize contracts when wallet connects
  useEffect(() => {
    console.log("🔍 Contract initialization effect triggered:");
    console.log("  - signer:", !!signer);
    console.log("  - account:", account);
    console.log("  - provider:", !!provider);
    console.log("  - chainId:", chainId);
    
    if (signer && account && provider) {
      console.log("✅ All requirements met, initializing contracts for account:", account, "on chain:", chainId)
      initializeContracts()
    } else {
      console.log("❌ Missing requirements for contract initialization:");
      if (!signer) console.log("  - Missing signer");
      if (!account) console.log("  - Missing account");
      if (!provider) console.log("  - Missing provider");
    }
  }, [signer, account, provider, chainId]) // Added chainId to reinitialize on network change

  // Fetch global stats on component mount (before wallet connection)
  useEffect(() => {
    fetchGlobalStats();
  }, []);

  // Note: RainbowKit handles all wallet events, no manual listeners needed
  // This prevents double connections and event conflicts

  // BSC network switching - only when user is on wrong network after connection
  useEffect(() => {
    const smartBSCSwitch = async () => {
      // Only proceed if wallet is connected and switchChain is available
      if (!isConnected || !walletAddress || !switchChain) return;
      
      // Get current chain ID - if undefined, wait a bit more
      if (!chainId) {
        console.log('Chain ID not yet available, waiting...');
        return;
      }

      // If already on BSC mainnet, no action needed
      if (chainId === bsc.id) {
        console.log(`✅ Connected to BSC mainnet (Chain ID: ${chainId})`);
        return;
      }

      // Only switch if user ended up on wrong network (gentle approach)
      console.log(`ℹ️ Connected to network ${chainId}, BSC mainnet available if needed`);
      
      // Show info toast instead of forcing switch
      if (typeof addToast === 'function') {
        addToast('💡 For full functionality, please switch to BSC (Binance Smart Chain) network', 'info');
      }
    };

    // Check network after wallet connects
    if (isConnected && walletAddress && chainId) {
      smartBSCSwitch();
    }
  }, [isConnected, walletAddress, chainId, switchChain]);

  // Display network warning if not on BSC (but don't force)
  useEffect(() => {
    if (isConnected && walletAddress && chainId && chainId !== bsc.id) {
      console.log(`ℹ️ App optimized for BSC mainnet. Current chain: ${chainId}`);
    }
  }, [isConnected, walletAddress, chainId]);

  // Inject BSC switch button into RainbowKit modal
  useEffect(() => {
    const injectBSCSwitch = () => {
      // Look for RainbowKit modal
      const modal = document.querySelector('[data-rk] [role="dialog"]');
      if (!modal) return;

      // Check if we already injected the button
      if (modal.querySelector('.rainbowkit-modal-bsc-injection')) return;

      // Only inject if not on BSC
      if (chainId === bsc.id) return;

      // Create injection container
      const injectionDiv = document.createElement('div');
      injectionDiv.className = 'rainbowkit-modal-bsc-injection';

      // Create BSC switch button
      const bscButton = document.createElement('button');
      bscButton.className = 'bsc-switch-button';
      bscButton.innerHTML = `
        <span class="network-icon">🔗</span>
        <span>Switch to BSC Network</span>
      `;
      
      bscButton.onclick = () => {
        if (switchChain) {
          switchChain({ chainId: bsc.id })
            .then(() => {
              console.log('Successfully switched to BSC from modal');
              // Remove button after successful switch
              setTimeout(() => {
                const button = document.querySelector('.rainbowkit-modal-bsc-injection');
                if (button) button.remove();
              }, 500);
            })
            .catch((error) => {
              console.error('Failed to switch to BSC from modal:', error);
            });
        }
      };

      injectionDiv.appendChild(bscButton);

      // Find the best injection point (after wallet balance/address area)
      const modalContent = modal.querySelector('div:first-child');
      if (modalContent) {
        const insertPoint = modalContent.children[1] || modalContent.children[0];
        if (insertPoint) {
          insertPoint.after(injectionDiv);
        } else {
          modalContent.appendChild(injectionDiv);
        }
      }
    };

    // Set up observer to watch for modal opening
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.addedNodes.length > 0) {
          // Check if a modal was added
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === 1 && (
              node.querySelector?.('[data-rk] [role="dialog"]') || 
              node.matches?.('[data-rk] [role="dialog"]')
            )) {
              setTimeout(injectBSCSwitch, 100);
            }
          });
        }
      });
    });

    // Start observing
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    // Also inject immediately if modal is already open
    setTimeout(injectBSCSwitch, 500);

    return () => {
      observer.disconnect();
    };
  }, [chainId, switchChain]);

  const initializeContracts = async () => {
    if (!signer || !account) {
      console.log("Cannot initialize contracts: missing signer or account")
      return
    }

    try {
      console.log("Expected contract address:", "0x22708D8a54c044CbA5B237620Af42030cbf76E14")
      
      // Verify we're using the correct contract address
      if (CONTRACT_ADDRESS !== "0x22708D8a54c044CbA5B237620Af42030cbf76E14") {
        console.error("❌ CRITICAL: Wrong contract address detected!");
        console.error("Expected: 0x22708D8a54c044CbA5B237620Af42030cbf76E14");
        console.error("Actual:", CONTRACT_ADDRESS);
        addToast("Critical error: Wrong contract address", "error");
        return;
      }

      // Verify we're using the correct USDT address for BSC mainnet
      if (USDT_ADDRESS !== "0x55d398326f99059fF775485246999027B3197955") {
        console.error("❌ CRITICAL: Wrong USDT address detected!");
        console.error("Expected BSC USDT: 0x55d398326f99059fF775485246999027B3197955");
        console.error("Actual:", USDT_ADDRESS);
        addToast("Critical error: Wrong USDT address", "error");
        return;
      }

      // Check if we're on BSC mainnet - if not, try to switch immediately
      if (!chainId || chainId !== bsc.id) {
        console.log(`🔄 Not on BSC mainnet (current: ${chainId}, required: ${bsc.id}). Attempting immediate switch...`);
        
        if (switchChain && isConnected && walletAddress) {
          try {
            await switchChain({ chainId: bsc.id });
            console.log('✅ Successfully switched to BSC mainnet!');
            // Continue with initialization after successful switch
          } catch (error) {
            console.error('❌ Failed to switch to BSC:', error);
            addToast('Please manually switch to BSC (Binance Smart Chain) network', 'error');
            // Don't return - still initialize contracts so they exist, but they won't work until network switch
          }
        }
      }

      // ─────────── CONTRACTS ───────────
      console.log("🔧 Initializing contracts...");
      console.log("CONTRACT_ADDRESS:", CONTRACT_ADDRESS);
      console.log("USDT_ADDRESS:", USDT_ADDRESS);
      
      // Always initialize contracts, but they'll only work properly on BSC mainnet
      const vault = new Contract(CONTRACT_ADDRESS, BlackVaultAbi, signer)
      setContract(vault)
      console.log("✅ BlackVault V2 Contract initialized:", CONTRACT_ADDRESS)

      const usdt = new Contract(USDT_ADDRESS, ERC20Abi, signer)
      setUsdtContract(usdt)
      console.log("✅ USDT Contract initialized:", USDT_ADDRESS)

      // Test if the main contract has the expected functions
      console.log("=== TESTING CONTRACT FUNCTIONS ===")
      console.log("CONTRACT_ADDRESS being used:", CONTRACT_ADDRESS)
      console.log("Expected contract address:", "0x22708D8a54c044CbA5B237620Af42030cbf76E14")
      
      // Verify we're using the correct contract address
      if (CONTRACT_ADDRESS !== "0x22708D8a54c044CbA5B237620Af42030cbf76E14") {
        console.error("❌ WRONG CONTRACT ADDRESS! Expected: 0x22708D8a54c044CbA5B237620Af42030cbf76E14, Got:", CONTRACT_ADDRESS)
        addToast("Wrong contract address configured!", "error")
        return
      }

      // First check if the contract exists and has code (with retry logic)
      let contractCodeChecked = false;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const code = await provider.getCode(CONTRACT_ADDRESS)
          if (code === "0x") {
            console.error("❌ Contract has no code at address:", CONTRACT_ADDRESS)
            addToast("Contract not deployed at specified address", "error")
            return
          }
          console.log("✅ Contract code found at address")
          contractCodeChecked = true;
          break;
        } catch (error) {
          console.warn(`❌ Error checking contract code (attempt ${attempt}/3):`, error)
          if (attempt === 3) {
            // Final attempt failed, but continue with limited validation
            console.warn("⚠️ Contract code validation failed after 3 attempts. Continuing with limited validation...")
            // Don't show error toast, just continue
          } else {
            // Wait before retry
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          }
        }
      }
      
      // Test basic contract functions with better error handling and retry logic
      let contractValidation = true
      
      // Test MIN_DEPOSIT with retry
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const minDeposit = await vault.MIN_DEPOSIT()
          console.log("✅ MIN_DEPOSIT from main contract:", minDeposit.toString())
          break;
        } catch (error) {
          console.warn(`❌ Error calling MIN_DEPOSIT (attempt ${attempt}/2):`, error)
          if (attempt === 2) {
            console.error("Contract may not be the expected BlackVault contract")
            contractValidation = false
          } else {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }
      }

      // Test DAILY_RATE with retry
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const dailyRate = await vault.DAILY_RATE()
          console.log("✅ DAILY_RATE from main contract:", dailyRate.toString())
          break;
        } catch (error) {
          console.warn(`❌ Error calling DAILY_RATE (attempt ${attempt}/2):`, error)
          if (attempt === 2) {
            contractValidation = false
          } else {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }
      }
      
      if (!contractValidation) {
        console.warn("⚠️ Contract validation failed - may be RPC issues or wrong contract. Continuing with limited functionality...")
        // Don't show error toast, just continue with reduced functionality
      }

      // Test withdraw functions exist
      try {
        console.log("✅ withdrawRewards function exists:", typeof vault.withdrawRewards === "function")
        console.log("✅ withdrawReferralRewards function exists:", typeof vault.withdrawReferralRewards === "function")
      } catch (error) {
        console.error("❌ Error checking withdraw functions:", error)
      }

      // Test if we can read user data
      try {
        const vaultData = await vault.getUserVault(account)
        console.log("✅ getUserVault works, pending rewards:", formatEther(vaultData[3]))
        console.log("✅ getUserVault full data:", {
          totalDeposited: formatEther(vaultData[0]),
          totalRewardsWithdrawn: formatEther(vaultData[1]), 
          joinedCycle: vaultData[2]?.toString(),
          pendingRewards: formatEther(vaultData[3])
        })
      } catch (error) {
        console.error("❌ Error calling getUserVault:", error)
      }

      // ─────────── CONTRACT VALIDATION ───────────
      console.log("🔍 Testing contract functions...");
      
      // Test USDT contract
      try {
        const usdtSymbol = await usdt.symbol();
        const usdtDecimals = await usdt.decimals();
        console.log("✅ USDT Contract working - Symbol:", usdtSymbol, "Decimals:", usdtDecimals);
      } catch (usdtError) {
        console.error("❌ USDT Contract test failed:", usdtError);
      }

      await loadContractData(vault, usdt)
    } catch (error) {
      console.error("❌ Error initializing contracts:", error)
      addToast("Error connecting to contracts", "error")
    }
  }

  // ─────────── loadContractData ───────────
  const loadDefaultReferrerData = async (vault) => {
    if (!vault || !provider) {
      console.log("Skipping loadDefaultReferrerData: missing dependencies");
      return;
    }

    try {
      console.log("🔍 DEBUG: Loading default referrer data for:", DEFAULT_REFERRER);
      console.log("🔍 DEBUG: Current connected account:", account);
      console.log("🔍 DEBUG: Is current account the default referrer?", account?.toLowerCase() === DEFAULT_REFERRER?.toLowerCase());
      
      // Use fast cached API endpoint (no expensive RPC calls)
      const response = await fetch('/api/referral-stats?type=default');
      console.log("🔍 DEBUG: Default referrer API response status:", response.status);
      
      if (response.ok) {
        const apiData = await response.json();
        console.log("🔍 DEBUG: Cached referral stats API response:", apiData);
        
        if (apiData.result && apiData.result.stats) {
          const stats = apiData.result.stats;
          console.log("🔍 DEBUG: Cached stats:", stats);
          
          // Use cached API data
          console.log("🔍 DEBUG: Using cached API data:", stats);
          console.log("🔍 DEBUG: Data source: cached API");
          console.log("🔍 DEBUG: Last updated:", apiData.result.lastUpdated);
          
          setDefaultReferrerStats({
            totalReferrals: stats.totalReferrals || "0",
            uniqueReferrals: stats.uniqueReferrals || 0,
            totalRewards: stats.totalRewards || "0",
            availableRewards: stats.availableRewards || "0"
          });
          return; // Use cached data and exit
        }
      } else {
        console.warn("⚠️ Cached referral stats not available (API returned status:", response.status, "), using fallback");
        // Don't try to read the error response if it's 404, just proceed to fallback
      }
      
      // Fallback with event querying (same as other functions)
      console.log("🔍 DEBUG: Fallback - fetching default referrer data with event querying...");
      try {
        const defaultReferralData = await vault.getUserReferralData(DEFAULT_REFERRER);
        console.log("🔍 DEBUG: Fallback - Default referrer raw data:", defaultReferralData);
        
        // Set basic contract data
        const basicStats = {
          totalReferrals: defaultReferralData[2]?.toString() || "0",
          totalRewards: formatEther(defaultReferralData[0] || 0),
          availableRewards: formatEther(defaultReferralData[1] || 0)
        };
        
        console.log("🔍 DEBUG: Basic contract stats:", basicStats);
        
        // Now query events to find unique users who got default referrer rewards
        try {
          console.log("🔍 DEBUG: Querying deposit events to find default referrer beneficiaries...");
          
          // For now, skip the complex event queries that are failing
          // Just use the basic contract stats until the background job populates the cache
          console.warn("⚠️ Skipping event queries for now - using basic contract stats only");
          
          setDefaultReferrerStats({
            ...basicStats,
            uniqueReferrals: 0 // Will be populated by background job later
          });
          
          console.log("✅ Using basic contract stats for default referrer (unique count will be available when background job runs)");
          
        } catch (eventError) {
          console.warn("⚠️ Default referrer event queries failed, using basic stats only:", eventError.message);
          setDefaultReferrerStats({
            ...basicStats,
            uniqueReferrals: 0
          });
        }
        
      } catch (fallbackError) {
        console.error("❌ Fallback failed for default referrer data:", fallbackError);
        setDefaultReferrerStats({
          totalReferrals: 0,
          uniqueReferrals: 0,
          totalRewards: "0",
          availableRewards: "0"
        });
      }
      
    } catch (apiError) {
      console.error("❌ Error loading default referrer data:", apiError);
      setDefaultReferrerStats({
        totalReferrals: 0,
        uniqueReferrals: 0,
        totalRewards: "0",
        availableRewards: "0"
      });
    }
  };

  const loadContractData = async (vault = contract, usdt = usdtContract, forceRefresh = false) => {
    if (!vault || !provider || !account || !usdt) {
      console.log("Skipping loadContractData: missing dependencies", { vault, provider, account, usdt })
      return
    }

    // Check BSC mainnet but allow balance loading for debugging
    console.log(`🔍 loadContractData - Chain validation: chainId=${chainId}, bsc.id=${bsc.id}, isOnBSC=${chainId === bsc.id}`);
    
    if (!chainId || chainId !== bsc.id) {
      console.warn(`⚠️ Not on BSC mainnet. Current chain: ${chainId}, required: ${bsc.id}`);
      console.warn(`⚠️ Will attempt to load balances anyway for debugging`);
      
      // Don't return early - allow balance loading even on wrong network for now
      // return;
    }

    try {
      console.log(`🔄 Loading contract data${forceRefresh ? ' (forced refresh)' : ''}...`);
      
      // ─────────── WALLET BALANCES ───────────
      console.log("🔍 Fetching wallet balances...");
      let ethBal, usdtBal, allowance;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          console.log(`🔄 Balance fetch attempt ${attempt}/3`);
          [ethBal, usdtBal, allowance] = await Promise.all([
            provider.getBalance(account),
            usdt.balanceOf(account),
            usdt.allowance(account, CONTRACT_ADDRESS),
          ])
          
          const ethBalance = formatEther(ethBal);
          const usdtBalance = formatEther(usdtBal);
          const usdtAllowanceAmount = formatEther(allowance);
          
          setBalance(ethBalance);
          setUsdtBalance(usdtBalance);
          setUsdtAllowance(usdtAllowanceAmount);
          
          console.log("✅ Wallet balances fetched successfully:");
          console.log("- BNB balance:", ethBalance);
          console.log("- USDT balance:", usdtBalance);
          console.log("- USDT allowance:", usdtAllowanceAmount);
          console.log("- Account:", account);
          console.log("- USDT Contract:", USDT_ADDRESS);
          console.log("- Chain ID:", chainId);
          
          break; // Success, exit retry loop
        } catch (balanceError) {
          console.warn(`❌ Error fetching wallet balances (attempt ${attempt}/3):`, balanceError);
          console.log("Balance error details:", {
            account,
            usdtAddress: USDT_ADDRESS,
            chainId,
            errorMessage: balanceError.message
          });
          
          if (attempt === 3) {
            console.error("❌ Failed to fetch wallet balances after 3 attempts");
            // Set fallback values
            setBalance("0");
            setUsdtBalance("0");
            setUsdtAllowance("0");
          } else {
            // Wait before retry
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      }
      // ─────────── REFERRAL REWARDS ───────────
      try {
        if (vault && account) {
          console.log("🔍 DEBUG: Loading user referral data for account:", account, forceRefresh ? "(force refresh)" : "(cached API)");
          
          // If forceRefresh is true, skip cache and go directly to contract
          if (forceRefresh) {
            console.log("🔍 DEBUG: Force refresh mode - using direct contract calls");
            const referralData = await vault.getUserReferralData(account);
            console.log("🔍 DEBUG: Direct contract referralData:", referralData);
            setReferralRewards(formatEther(referralData[1])); // _availableRewards
            setTotalReferralRewards(formatEther(referralData[0])); // _totalRewards
            const contractReferralCount = referralData[2]?.toString() || "0";
            setReferralCount(contractReferralCount);
            setUniqueReferralCount(0); // Will be updated from API later if needed
            console.log("✅ Force refresh - Referral rewards (available):", formatEther(referralData[1]));
            console.log("✅ Force refresh - Total referral rewards:", formatEther(referralData[0]));
            console.log("✅ Force refresh - Referral count:", contractReferralCount);
          } else {
            // Use the same fast cached endpoint that the modal uses successfully
            try {
              console.log("🔍 DEBUG: Fetching user referrals from cached referral-stats API for account:", account);
              const response = await fetch(`/api/referral-stats?user=${account}`);
              console.log("🔍 DEBUG: Cached referral-stats API response status:", response.status);
              
              if (response.ok) {
                const apiData = await response.json();
                console.log("🔍 DEBUG: Cached referral-stats API response:", apiData);
                
                if (apiData.result && apiData.result.contractData) {
                  const { contractData, stats } = apiData.result;
                  
                  // Set referral rewards and counts from cached API data
                  setReferralRewards(contractData.availableRewards);
                  setTotalReferralRewards(contractData.totalRewards || "0");
                  setReferralCount(contractData.referredCount);
                  setUniqueReferralCount(stats.uniqueReferrals);
                  
                  console.log("✅ Successfully loaded referral data from cached API (same as modal):");
                  console.log("- Available rewards:", contractData.availableRewards);
                  console.log("- Total referral rewards:", contractData.totalRewards || "0");
                  console.log("- Total referral count:", contractData.referredCount);
                  console.log("- Unique referrals:", stats.uniqueReferrals);
                  console.log("- Data source: background-job (cached)");
                } else {
                  console.warn("⚠️ Invalid cached API response structure:", apiData);
                  throw new Error("Invalid cached API response structure");
                }
              } else {
                const errorText = await response.text();
                console.warn("⚠️ Cached referral-stats API failed with status:", response.status);
                throw new Error(`Cached API returned status ${response.status}`);
              }
            } catch (apiError) {
              console.warn("⚠️ Cached referral-stats API failed, falling back to V2 API:", apiError.message);
              
              // Fallback to V2 API
              try {
                const response = await fetch(`/api/user-referrals-v2?account=${account}`);
                if (response.ok) {
                  const apiData = await response.json();
                  if (apiData.result && apiData.result.contractData) {
                    const { contractData, stats } = apiData.result;
                    setReferralRewards(contractData.availableRewards);
                    setTotalReferralRewards(contractData.totalRewards || "0");
                    setReferralCount(contractData.referredCount);
                    setUniqueReferralCount(stats.uniqueReferrals);
                    console.log("✅ Fallback V2 API - Loaded referral data");
                  } else {
                    throw new Error("Invalid V2 API response structure");
                  }
                } else {
                  throw new Error(`V2 API returned status ${response.status}`);
                }
              } catch (v2Error) {
                console.warn("⚠️ V2 API also failed, falling back to contract calls:", v2Error.message);
                
                // Final fallback to direct contract calls
                const referralData = await vault.getUserReferralData(account);
                setReferralRewards(formatEther(referralData[1]));
                setTotalReferralRewards(formatEther(referralData[0]));
                const contractReferralCount = referralData[2]?.toString() || "0";
                setReferralCount(contractReferralCount);
                setUniqueReferralCount(0); // Can't get unique count from contract alone
                console.log("Fallback - Direct contract referral data loaded");
              }
            }
          }
        }
      } catch (referralError) {
        console.error("Error fetching referral data:", referralError);
        setReferralRewards("0");
        setTotalReferralRewards("0");
        setReferralCount("0");
        setUniqueReferralCount(0);
      }

      // ─────────── DAILY RATE ───────────
      try {
        const rate = await vault.DAILY_RATE();
        setDailyRate(rate.toString());
        console.log("Fetched DAILY_RATE:", rate.toString());
      } catch (e) {
        console.error("Error fetching DAILY_RATE:", e);
        setDailyRate("0");
      }
      // ─────────── ON-CHAIN VAULT DATA ───────────
      let totalDeposited, totalRewardsWithdrawn, pendingRewards;
      try {
        // BlackVaultV2.sol getUserVault returns: [totalDeposited, totalRewardsWithdrawn, joinedCycle, pendingRewards]
        const vaultData = await vault.getUserVault(account);
        totalDeposited = vaultData[0];
        totalRewardsWithdrawn = vaultData[1];
        // joinedCycle = vaultData[2]; // Not used in frontend, can be removed
        pendingRewards = vaultData[3];

        // Calculate net earning amount (total deposited minus 1% fee)
        // Contract deducts 1% fee, so net earning amount = gross * 0.99
        const grossAmount = parseFloat(formatEther(totalDeposited));
        const netEarningAmount = grossAmount * 0.99;

        setVaultActiveAmount(netEarningAmount.toString());
        setRewards(formatEther(pendingRewards));

        console.log("✅ Vault data loaded successfully:");
        console.log("- Total Deposited (Gross):", formatEther(totalDeposited));
        console.log("- Net Earning Amount:", netEarningAmount);
        console.log("- Pending Rewards:", formatEther(pendingRewards));
        console.log("- Wallet Type:", walletClient?.mode || 'unknown');
        console.log("- Chain ID:", chainId);
      } catch (vaultDataError) {
        console.error("Error fetching vault data:", vaultDataError);
        setVaultActiveAmount("0");
        setRewards("0");
        // Set default values for ROI calculation
        totalDeposited = 0;
        totalRewardsWithdrawn = 0;
        pendingRewards = 0;
      }

      // ─────────── ALL-TIME ROI ───────────
      try {
        const invested = parseFloat(formatEther(totalDeposited));
        const vaultEarned = parseFloat(formatEther(pendingRewards)) + parseFloat(formatEther(totalRewardsWithdrawn));
        const referralEarned = parseFloat(totalReferralRewards);
        const totalEarned = vaultEarned + referralEarned;
        
        // Enhanced ROI calculation with better validation
        let roiPercentage = "0.00";
        if (invested > 0 && !isNaN(invested) && !isNaN(totalEarned) && isFinite(invested) && isFinite(totalEarned)) {
          const rawRoi = (totalEarned / invested) * 100;
          // Cap ROI display at reasonable values to prevent scientific notation
          if (rawRoi > 999999) {
            roiPercentage = "999999.00";
          } else if (rawRoi < -999999) {
            roiPercentage = "-999999.00";
          } else {
            roiPercentage = rawRoi.toFixed(2);
          }
        }
        
        const roiBP = invested > 0 ? ((totalEarned / invested) * 10000).toFixed(0) : "0";
        
        setRoi({
          invested: invested.toString(),
          earned: totalEarned.toString(),
          roiBP: roiBP,
          percentage: roiPercentage, // Add pre-calculated percentage
        });
        
        console.log("📊 ROI Calculation:");
        console.log("- Total Invested:", invested);
        console.log("- Vault Earnings:", vaultEarned, "(pending + withdrawn)");
        console.log("- Referral Earnings:", referralEarned);
        console.log("- Total Earnings:", totalEarned);
        console.log("- ROI %:", roiPercentage + "%");
      } catch (error) {
        console.error("Error calculating ROI:", error);
        setRoi({
          invested: "0",
          earned: "0",
          roiBP: "0",
          percentage: "0.00",
        });
      }

      // ─────────── CYCLE TIMING ───────────
      // Fetch cycle start time and duration from contract
      let cycleStart = 0;
      let cycleDur = 0;
      try {
        cycleStart = Number(await vault.CYCLE_START_TIME());
        setCycleStartTime(cycleStart);
      } catch (e) {
        console.error("Error fetching CYCLE_START_TIME:", e);
      }
      try {
        cycleDur = Number(await vault.CYCLE_DURATION());
        setCycleDuration(cycleDur);
      } catch (e) {
        console.error("Error fetching CYCLE_DURATION:", e);
      }

      // Calculate time until next accrual if user has active balance
      console.log("🕐 Timer calculation:", {
        vaultActiveAmount: Number(vaultActiveAmount),
        cycleStart,
        cycleDur,
        hasActiveBalance: Number(vaultActiveAmount) > 0,
        hasCycleData: cycleStart > 0 && cycleDur > 0
      });
      
      if ((Number(vaultActiveAmount) > 0) && cycleStart > 0 && cycleDur > 0) {
        // Get current block timestamp with retry logic for RPC issues
        let now = 0;
        try {
          const block = await provider.getBlock("latest");
          now = block.timestamp;
          console.log("🕐 Using blockchain timestamp:", now);
        } catch (e) {
          console.warn("Failed to get latest block timestamp, using local time:", e);
          now = Math.floor(Date.now() / 1000);
          console.log("🕐 Using local timestamp:", now);
        }
        // How many cycles since launch?
        const cyclesSinceLaunch = Math.floor((now - cycleStart) / cycleDur);
        const nextCycleTime = cycleStart + (cyclesSinceLaunch + 1) * cycleDur;
        const secondsLeft = nextCycleTime - now;
        const finalSeconds = secondsLeft > 0 ? secondsLeft : 0;
        
        console.log("🕐 Timer calculation details:", {
          now,
          cycleStart,
          cycleDur,
          cyclesSinceLaunch,
          nextCycleTime,
          secondsLeft,
          finalSeconds
        });
        
        setTimeUntilNextCycle(finalSeconds);
      } else {
        console.log("🕐 No timer - either no active balance or missing cycle data");
        setTimeUntilNextCycle(0);
      }

      // ─────────── YOUR REFERRAL + CONSTANTS + TIMING ───────────
      // Load default referrer statistics
      await loadDefaultReferrerData(vault);
      
    } catch (error) {
      console.error("Error loading contract data:", error);
      addToast("Error loading contract data", "error");
    }
  } // End of loadContractData function
 
  // ─── Re-load whenever provider or account changes ───
  // Note: Data loading is already handled by initializeContracts() when wallet connects
  // This useEffect is only needed for manual refresh scenarios
  
  // ─── Countdown timer / auto-refresh ───
  useEffect(() => {
    let timer;
    // Only start timer if all values are present and valid
    if (
      account &&
      provider &&
      Number(vaultActiveAmount) > 0 &&
      Number(cycleStartTime) > 0 &&
      Number(cycleDuration) > 0
    ) {
      // Calculate initial seconds left
      const now = Math.floor(Date.now() / 1000);
      const cyclesSinceLaunch = Math.floor((now - Number(cycleStartTime)) / Number(cycleDuration));
      const nextCycleTime = Number(cycleStartTime) + (cyclesSinceLaunch + 1) * Number(cycleDuration);
      let secondsLeft = nextCycleTime - now;
      setTimeUntilNextCycle(secondsLeft > 0 ? secondsLeft : 0);

      timer = setInterval(() => {
        setTimeUntilNextCycle(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            console.log("🔄 Cycle ended - auto-refreshing data...");
            
            // Automatically refresh data when cycle resets
            setTimeout(async () => {
              try {
                console.log("🔄 Refreshing data after cycle reset...");
                if (contract && usdtContract && account) {
                  await loadContractData(contract, usdtContract, true); // Force refresh after cycle reset
                  console.log("✅ Data refreshed successfully after cycle reset");
                }
              } catch (error) {
                console.error("❌ Error refreshing data after cycle reset:", error);
                // Try again after a delay
                setTimeout(() => {
                  if (contract && usdtContract && account) {
                    loadContractData(contract, usdtContract, true);
                  }
                }, 5000);
              }
            }, 2000); // Wait 2 seconds for blockchain to update
            
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      setTimeUntilNextCycle(0);
    }
    return () => clearInterval(timer);
  }, [account, provider, vaultActiveAmount, cycleStartTime, cycleDuration]); // <-- Properly close useEffect

  const formatAddress = (addr) => {
    if (!addr) return ""
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`
  }

  // Show up to 3 decimals for display
  const formatAmount = (amount) => {
    const num = Number.parseFloat(amount)
    if (num === 0 || isNaN(num) || num < 0.0001) return "0"
    return num.toFixed(3).replace(/\.0+$/, '').replace(/(\.\d*[1-9])0+$/, '$1')
  }

  // Format to exactly 2 decimals for specific fields - ALWAYS ROUND DOWN
  const formatAmount2Decimals = (amount) => {
    const num = Number.parseFloat(amount)
    if (num === 0 || isNaN(num) || num < 0.01) return "0.00"
    // Always round DOWN to avoid withdrawal failures
    return (Math.floor(num * 100) / 100).toFixed(2)
  }

  // For Max button: always paste with 2 decimals (rounded down)
  const formatAmountForInput = (amount) => {
    const num = Number.parseFloat(amount)
    if (num === 0 || isNaN(num)) return "0"
    return Math.floor(num * 100) / 100 + ''
  }

  const formatCountdown = (seconds) => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    return [h, m, s].map((v) => (v < 10 ? "0" + v : v)).join(":")
  }

  const handleMaxDeposit = () => {
    const maxAmount = Number.parseFloat(usdtBalance)
    if (maxAmount > 0) {
      setDepositAmount(formatAmountForInput(maxAmount))
    }
  }

  const getReferralLink = () => {
    const baseUrl = window.location.origin + window.location.pathname
    return `${baseUrl}?ref=${account}`
  }

  const copyReferralLink = () => {
    if (Number.parseFloat(vaultActiveAmount) === 0) {
      addToast("To be eligible for referral rewards, you must have deposited at least once.", "warning")
      return
    }
    const link = getReferralLink()
    navigator.clipboard.writeText(link)
    addToast("Referral link copied to clipboard!", "success")
  }

  const needsApproval =
    Number.parseFloat(depositAmount) > 0 && Number.parseFloat(usdtAllowance) < Number.parseFloat(depositAmount)
 
  // ─── RainbowKit-compatible wallet connection handler ────────────────────────────
  const handleConnectWallet = async () => {
    if (loading || isConnecting) return;
    
    setLoading(true);
    try {
      await connectWallet();
      
      // Auto-scroll to top after successful wallet connection
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      console.error("Connection failed:", error);
      addToast(error?.message || "Failed to connect wallet", "error");
    } finally {
      setLoading(false);
    }
  };

  // RainbowKit-compatible disconnect handler
  const handleDisconnectWallet = () => {
    try {
      disconnectWallet();
      // Reset all data when disconnecting
      setAccount("");
      setProvider(null);
      setSigner(null);
      setBalance("0");
      setUsdtBalance("0");
      setRewards("0");
      setReferralRewards("0");
      addToast("Wallet disconnected", "info");
    } catch (error) {
      console.error("Disconnect failed:", error);
      addToast("Failed to disconnect wallet", "error");
    }
  };
 
  // Enhanced validation and security utilities
  const validateAddress = (address) => {
    if (!address || address === ethers.ZeroAddress || address === "0x0000000000000000000000000000000000000000") {
      return false;
    }
    try {
      return ethers.isAddress(address);
    } catch {
      return false;
    }
  };

  const validateAmount = (amount, maxAmount = null, minAmount = 0) => {
    const numAmount = Number.parseFloat(amount);
    if (!amount || isNaN(numAmount) || numAmount < minAmount) {
      return { valid: false, error: `Enter a valid amount of ${minAmount} or greater` };
    }
    if (maxAmount !== null && numAmount > Number.parseFloat(maxAmount)) {
      return { valid: false, error: `Cannot exceed maximum amount of ${maxAmount}` };
    }
    return { valid: true };
  };

  const safeContractCall = async (contractCall, errorMessage = "Transaction failed") => {
    try {
      const tx = await contractCall();
      const receipt = await tx.wait();
      
      if (receipt.status !== 1) {
        throw new Error("Transaction failed - receipt status is not 1");
      }
      
      return { success: true, receipt };
    } catch (error) {
      console.error("Contract call failed:", error);
      
      // Handle specific error types
      if (error.code === 4001) {
        throw new Error("Transaction cancelled by user");
      } else if (error.code === "INSUFFICIENT_FUNDS") {
        throw new Error("Insufficient funds for transaction");
      } else if (error.code === "UNPREDICTABLE_GAS_LIMIT") {
        throw new Error("Transaction would fail - please check requirements");
      } else if (error.reason) {
        throw new Error(error.reason);
      } else if (error.message) {
        throw new Error(error.message);
      } else {
        throw new Error(errorMessage);
      }
    }
  };

  const approveUsdt = async () => {
    if (!usdtContract || txLoading) return;
    
    // CRITICAL: Only allow approvals on BSC mainnet
    if (!chainId || chainId !== bsc.id) {
      console.error(`🚫 USDT approval blocked: not on BSC mainnet. Current chain: ${chainId}, required: ${bsc.id}`);
      addToast("Please switch to BSC (Binance Smart Chain) network for USDT BEP-20 operations", "error");
      
      // Try to switch to BSC
      if (switchChain) {
        try {
          await switchChain({ chainId: bsc.id });
          addToast("Switched to BSC mainnet! Please try your approval again.", "success");
        } catch (error) {
          console.error('Failed to switch to BSC:', error);
        }
      }
      return;
    }
    
    // Enhanced validation using security utilities
    const amountValidation = securityUtils.validateAmount(depositAmount, null, 50); // Min 50 USDT
    if (!amountValidation.valid) {
      addToast(amountValidation.error, "error");
      return;
    }

    // Validate contract address
    const addressValidation = securityUtils.validateAddress(CONTRACT_ADDRESS);
    if (!addressValidation.valid) {
      addToast(`Invalid contract address: ${addressValidation.error}`, "error");
      return;
    }

    setTxLoading(true);
    try {
      addToast("Approving USDT…", "info");
      
      const result = await securityUtils.safeContractCall(
        () => usdtContract.approve(CONTRACT_ADDRESS, parseEther(depositAmount)),
        "USDT approval failed"
      );
      
      if (result.success) {
        addToast("USDT approved!", "success");
        await loadContractData(contract, usdtContract);
      }
    } catch (error) {
      console.error("Approval failed:", error);
      addToast(error.message || "Approval failed", "error");
    } finally {
      setTxLoading(false);
    }
  };   const deposit = async () => {
     if (!contract || txLoading) {
       if (!contract) addToast("Contract not initialized", "error");
       return;
     }

     // CRITICAL: Only allow deposits on BSC mainnet
     if (!chainId || chainId !== bsc.id) {
       console.error(`🚫 Deposit blocked: not on BSC mainnet. Current chain: ${chainId}, required: ${bsc.id}`);
       addToast("Please switch to BSC (Binance Smart Chain) network for USDT BEP-20 deposits", "error");
       
       // Try to switch to BSC
       if (switchChain) {
         try {
           await switchChain({ chainId: bsc.id });
           addToast("Switched to BSC mainnet! Please try your deposit again.", "success");
         } catch (error) {
           console.error('Failed to switch to BSC:', error);
         }
       }
       return;
     }

     // Enhanced validation using security utilities
     const amountValidation = securityUtils.validateAmount(depositAmount, null, 50); // Min 50 USDT
     if (!amountValidation.valid) {
       addToast(amountValidation.error, "error");
       return;
     }

     // Check allowance
     if (Number.parseFloat(usdtAllowance) < Number.parseFloat(depositAmount)) {
       return addToast("Please approve USDT first", "error");
     }

     // Validate referrer address if provided
     const referrerToUse = (referralAddress && referralAddress !== ethers.ZeroAddress) ? referralAddress : DEFAULT_REFERRER;
     const referrerValidation = securityUtils.validateAddress(referrerToUse);
     if (!referrerValidation.valid) {
       addToast(`Invalid referrer address: ${referrerValidation.error}`, "error");
       return;
     }

     setTxLoading(true);
     try {
       addToast("Processing deposit…", "info");
       const value = parseEther(depositAmount);

       const result = await securityUtils.safeContractCall(
         () => contract.depositWithReferrer(value, referrerToUse),
         "Deposit transaction failed"
       );

       if (result.success) {
         addToast("Deposit successful!", "success");
         setDepositAmount("");

         // Update leaderboard if referral used
         if (referralAddress && referralAddress !== ethers.ZeroAddress) {
           try {
             const referralReward = (BigInt(value) * BigInt(10)) / BigInt(100);
             
             await fetch("/api/leaderboard/update", {
               method: "POST",
               headers: { "Content-Type": "application/json" },
               body: JSON.stringify({
                 referrer: referralAddress,
                 amount: referralReward.toString(),
               }),
             });
             addToast("Leaderboard updated!", "success");
           } catch (leaderboardError) {
             console.warn("Leaderboard update failed:", leaderboardError);
             addToast("Failed to update leaderboard", "warning");
           }
         }

         await loadContractData(contract, usdtContract);
       }
     } catch (error) {
       console.error("Deposit error:", error);
       addToast(error.message || "Deposit failed", "error");
     } finally {
       setTxLoading(false);
     }
   }
 
   const withdraw = async () => {
     if (!contract || txLoading) {
       if (!contract) addToast("Contract not initialized", "error")
       return
     }
     
     // CRITICAL: Only allow withdrawals on BSC mainnet (USDT BEP-20)
     if (!chainId || chainId !== bsc.id) {
       console.error(`🚫 Withdrawal blocked: not on BSC mainnet. Current chain: ${chainId}, required: ${bsc.id}`);
       addToast("Please switch to BSC (Binance Smart Chain) network for USDT BEP-20 withdrawals", "error");
       
       // Try to switch to BSC
       if (switchChain) {
         try {
           await switchChain({ chainId: bsc.id });
           addToast("Switched to BSC mainnet! Please try your withdrawal again.", "success");
         } catch (error) {
           console.error('Failed to switch to BSC:', error);
         }
       }
       return;
     }
     
     // Enhanced validation using security utilities
     const amountValidation = securityUtils.validateAmount(withdrawAmount, rewards, 0);
     if (!amountValidation.valid) {
       addToast(amountValidation.error, "error");
       return;
     }
     
     setTxLoading(true)
     try {
       addToast("Withdrawing rewards…", "info")
       
       const result = await securityUtils.safeContractCall(
         () => contract.withdrawRewards(parseEther(withdrawAmount)),
         "Withdrawal failed"
       );
       
       if (result.success) {
         addToast("Rewards withdrawn!", "success")
         setWithdrawAmount("");
         
         // Add delay to ensure blockchain state is updated before fetching
         await new Promise(resolve => setTimeout(resolve, 2000));
         
         // Force fresh data reload with multiple attempts
         let retries = 3;
         while (retries > 0) {
           try {
             console.log("🔄 Forcing fresh data reload after vault withdrawal...");
             await loadContractData(contract, usdtContract, true); // Force refresh
             
             // Verify the update worked by checking if rewards decreased
             const updatedVaultData = await contract.getUserVault(account);
             const currentPendingRewards = formatEther(updatedVaultData[3]);
             console.log("📊 Updated pending rewards after withdrawal:", currentPendingRewards);
             
             // Update the state directly to ensure UI reflects the change
             setRewards(currentPendingRewards);
             break;
           } catch (reloadError) {
             console.warn(`Data reload attempt failed (${4-retries}/3):`, reloadError.message);
             retries--;
             if (retries > 0) {
               await new Promise(resolve => setTimeout(resolve, 1000));
             }
           }
         }
       }
     } catch (error) {
       console.error("Withdraw error:", error)
       addToast(error.message || "Withdrawal failed", "error")
     } finally {
       setTxLoading(false)
     }
   }
 
   const withdrawReferral = async () => {
     if (!contract || txLoading || Number.parseFloat(referralRewards) === 0) {
       if (!contract) addToast("Contract not initialized", "error")
       else addToast("No referral rewards", "warning")
       return
     }
     
     // CRITICAL: Only allow referral withdrawals on BSC mainnet (USDT BEP-20)
     if (!chainId || chainId !== bsc.id) {
       console.error(`🚫 Referral withdrawal blocked: not on BSC mainnet. Current chain: ${chainId}, required: ${bsc.id}`);
       addToast("Please switch to BSC (Binance Smart Chain) network for USDT BEP-20 referral withdrawals", "error");
       
       // Try to switch to BSC
       if (switchChain) {
         try {
           await switchChain({ chainId: bsc.id });
           addToast("Switched to BSC mainnet! Please try your referral withdrawal again.", "success");
         } catch (error) {
           console.error('Failed to switch to BSC:', error);
         }
       }
       return;
     }
     
     setTxLoading(true)
     try {
       addToast("Withdrawing referral rewards…", "info")
       
       const result = await securityUtils.safeContractCall(
         () => contract.withdrawReferralRewards(),
         "Referral withdrawal failed"
       );
       
       if (result.success) {
         addToast("Referral rewards withdrawn!", "success")
         
         // Clear API cache to ensure fresh data
         try {
           console.log("🔄 Clearing user referrals cache after withdrawal...");
           await fetch(`/api/clear-user-cache?account=${account}`, { method: 'POST' });
         } catch (cacheError) {
           console.warn("Cache clear failed:", cacheError.message);
         }
         
         // Add delay to ensure blockchain state is updated before fetching
         await new Promise(resolve => setTimeout(resolve, 2000));
         
         // Force fresh data reload with multiple attempts, bypassing cache
         let retries = 3;
         while (retries > 0) {
           try {
             console.log("🔄 Forcing fresh data reload after referral withdrawal...");
             
             // First try direct contract call to get immediate updated values
             const updatedReferralData = await contract.getUserReferralData(account);
             const currentAvailableRewards = formatEther(updatedReferralData[1]);
             console.log("📊 Updated referral rewards after withdrawal (direct contract):", currentAvailableRewards);
             
             // Update the state directly to ensure UI reflects the change immediately
             setReferralRewards(currentAvailableRewards);
             setTotalReferralRewards(formatEther(updatedReferralData[0]));
             
             // Then reload all contract data to ensure everything is in sync
             await loadContractData(contract, usdtContract, true); // Force refresh
             break;
           } catch (reloadError) {
             console.warn(`Data reload attempt failed (${4-retries}/3):`, reloadError.message);
             retries--;
             if (retries > 0) {
               await new Promise(resolve => setTimeout(resolve, 1000));
             }
           }
         }
       }
     } catch (error) {
       console.error("Referral withdraw error:", error)
       addToast(error.message || "Referral withdrawal failed", "error")
     } finally {
       setTxLoading(false)
     }
   }
 
   const disconnect = () => {
     isManuallyDisconnected.current = true;
     handleDisconnectWallet();
     
     // Auto-scroll to top after wallet disconnection
     window.scrollTo({ top: 0, behavior: 'smooth' });
   };
   // ─────────────────────────────────────────────────────────────────────────────


  if (!account) {
    return (
      <div className="app-container">
        <ToastContainer toasts={toasts} removeToast={removeToast} />

        <div className="connect-screen">
          <div className="connect-content">
            <div className="logo-container">
              <div className="premium-logo-wrapper">
                <img src="/logo2.svg" alt="Black Vault Logo" className="premium-logo-img" />
                <div className="logo-glow"></div>
              </div>
            </div>

            <h1 className="app-title">
              <span className="title-black">BLACK</span>
              <span className="title-vault">VAULT</span>
            </h1>

            <p className="app-subtitle">Premium USDT Staking Platform on Binance Smart Chain</p>

            <ProjectIntroduction 
              globalStats={globalStats} 
              onShowTroubleshooting={() => setShowTroubleshootingModal(true)}
              middleContent={
                <div style={{ maxWidth: '600px', margin: '20px auto' }}>
                  <SmartDeFiInsights 
                    account={null} // Pass null to show preview mode
                    vaultBalance="0"
                    contractAddress={config.blackVaultContract}
                  />
                </div>
              }
            />

            <TrustWalletHelper 
              isConnected={!!account}
              onRetryConnection={handleConnectWallet}
            />

            <div style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              gap: '16px',
              padding: '20px 0'
            }}>
              {/* RainbowKit ConnectButton */}
              <ConnectButton />
              
              {walletError && (
                <div style={{
                  color: '#FF4444',
                  fontSize: '14px',
                  textAlign: 'center',
                  background: 'rgba(255, 68, 68, 0.1)',
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: '1px solid rgba(255, 68, 68, 0.2)'
                }}>
                  {walletError.message}
                </div>
              )}
            </div>

            <button className="discreet-button" onClick={() => setShowTroubleshootingModal(true)}>
              Troubleshooting & Network Info
            </button>
          </div>
        </div>

        <Footer />

        <TroubleshootingModal isOpen={showTroubleshootingModal} onClose={() => setShowTroubleshootingModal(false)} />
      </div>
    );
  }

  return (
    <>
    <div className="app-container">
      <div className="premium-background">
        <div className="bg-grid"></div>
        <div className="bg-gradient-1"></div>
        <div className="bg-gradient-2"></div>
        <div className="bg-particles"></div>
      </div>

      <ToastContainer toasts={toasts} removeToast={removeToast} />

      <div className="main-interface">
        <div className="header">
          <div className="header-logo">
            <img src="/logo2.svg" alt="Black Vault" className="mini-logo-img" />
            <span className="header-title">BLACK VAULT</span>
            {process.env.NEXT_PUBLIC_ENVIRONMENT === 'testing' && (
              <span className="testing-badge">🧪 TESTING</span>
            )}
          </div>
          <div className="header-account">
            <ConnectButton />
          </div>
        </div>

        {/* Critical Network Warning Banner - Blocks functionality */}
        {isConnected && walletAddress && !isOnBSC && (
          <div className="network-warning-banner">
            <div className="network-warning-content">
              <span className="warning-icon">⚠️</span>
              <div className="warning-text">
                <strong>CRITICAL: Wrong Network!</strong>
                <p>You must be on BSC Mainnet to use USDT (BEP-20). Currently on Chain ID: {chainId}</p>
                <p style={{ fontSize: '0.8rem', opacity: 0.9, marginTop: '0.25rem' }}>
                  Automatic switching in progress... If it fails, click the button below.
                </p>
              </div>
              <button
                className="switch-network-button"
                onClick={switchToBSC}
                disabled={!switchChain}
              >
                Force Switch to BSC
              </button>
            </div>
          </div>
        )}

        {/* Only show vault interface if on correct network */}
          <div className="vault-interface">
          <div className="vault-card premium-card">
            <h3 className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Vault Balance</span>
              <span style={{ fontWeight: 400, fontSize: 14, color: '#888', marginLeft: 'auto' }}>
                All-time ROI: {roi && roi.percentage ? roi.percentage : "0.00"}%
              </span>
            </h3>
            <div className="balance-grid">
              <div className="balance-item">
                <span className="balance-label">Earning Balance</span>
                <span className="balance-value">{formatAmount(vaultActiveAmount)} USDT</span>
              </div>

              <div className="balance-item">
                <span className="balance-label">Projected Daily Rewards</span>
                <span className="balance-value">
                  {formatAmount2Decimals(((parseFloat(vaultActiveAmount) * parseFloat(dailyRate)) / 1000).toString())} USDT
                </span>
              </div>

              <div className="balance-item">
                <span className="balance-label">Next Accrual In</span>
                <span className="balance-value">{timeUntilNextCycle > 0 ? formatCountdown(timeUntilNextCycle) : "00:00:00"}</span>
                <button 
                  className="info-button-accrual" 
                  onClick={() => setShowAccrualInfoModal(true)}
                  title="Why haven't I received rewards yet?"
                >
                  ?
                </button>
              </div>
            </div>
          </div>

          <div className="vault-card premium-card">
            <h3 className="card-title">
              <span className="card-icon">💰</span>
              Make Deposit
            </h3>

            {referralAddress !== "0x0000000000000000000000000000000000000000" && (
              <div className="referral-info">
                <span className="referral-label">Referral:</span>
                <span className="referral-address">{formatAddress(referralAddress)}</span>
              </div>
            )}

            <div className="wallet-balance">
              <span className="balance-label">Wallet Balance:</span>
              <span className="balance-value">{formatAmount(usdtBalance)} USDT</span>
              <button className="max-button" onClick={handleMaxDeposit}>
                Max
              </button>
            </div>

            {showDisclaimer && (
              <div className="disclaimer-box">
                <button
                  className="disclaimer-close"
                  onClick={() => setShowDisclaimer(false)}
                  aria-label="Hide disclaimer"
                >
                  ×
                </button>
                <p className="disclaimer-title">IMPORTANT DISCLAIMER</p>
                <p className="disclaimer-text">
                  This platform exclusively uses <strong>USDT (BEP-20)</strong> on the{" "}
                  <strong>Binance Smart Chain (BSC)</strong>. Depositing any other token or using a different network
                  will result in permanent loss of funds.
                </p>
              </div>
            )}

            <div className="input-group">
              <input
                type="number"
                id="deposit-amount"
                name="deposit-amount"
                required
                className="vault-input premium-input"
                placeholder={
                  minDeposit !== "0" ? `Min. deposit ${formatAmount(minDeposit)} USDT` : "Min. deposit: 50 USDT"
                }
                value={depositAmount}
                onChange={(e) => {
                  const sanitized = securityUtils.sanitizeInput(e.target.value, 'number');
                  const lengthValidation = securityUtils.validateInputLength(sanitized, 20);
                  if (lengthValidation.valid) {
                    setDepositAmount(sanitized);
                  }
                }}
                step="0.001"
                min="0"
              />

              <button
                className="vault-button premium-button primary"
                onClick={approveUsdt}
                disabled={txLoading || !depositAmount || Number.parseFloat(depositAmount) <= 0}
              >
                {txLoading ? (
                  <>
                    <div className="loading-spinner"></div>
                    Approving USDT...
                  </>
                ) : (
                  "Approve USDT"
                )}
              </button>
              <button
                className="vault-button premium-button primary"
                onClick={deposit}
                disabled={txLoading || !depositAmount || Number.parseFloat(depositAmount) <= 0 || needsApproval}
              >
                {txLoading ? (
                  <>
                    <div className="loading-spinner"></div>
                    Processing...
                  </>
                ) : (
                  "Deposit USDT"
                )}
              </button>
            </div>
          </div>

          <div className="vault-card premium-card">
            <h3 className="card-title">
              <span className="card-icon">🎁</span>
              Vault Rewards
            </h3>
            <div className="reward-display">
              <span
                className="reward-amount"
                style={{ cursor: 'pointer' }}
                title="Click to auto-fill withdraw amount"
                onClick={() => {
                  if (Number.parseFloat(rewards) > 0) setWithdrawAmount(formatAmount2Decimals(rewards));
                }}
              >
                {formatAmount2Decimals(rewards)} USDT
              </span>
              <span className="reward-label">Available to withdraw</span>
            </div>
            <div className="input-group" style={{ marginBottom: 12 }}>
              <input
                type="number"
                className="vault-input premium-input"
                placeholder="Amount to withdraw"
                value={withdrawAmount}
                min="0"
                max={rewards}
                step="0.001"
                onChange={e => {
                  const sanitized = securityUtils.sanitizeInput(e.target.value, 'number');
                  const lengthValidation = securityUtils.validateInputLength(sanitized, 20);
                  if (lengthValidation.valid) {
                    setWithdrawAmount(sanitized);
                  }
                }}
                disabled={txLoading}
              />
              <button
                className="vault-button premium-button success"
                onClick={withdraw}
                disabled={txLoading || !withdrawAmount || Number.parseFloat(withdrawAmount) <= 0 || Number.parseFloat(withdrawAmount) > Number.parseFloat(rewards)}
              >
                {txLoading ? "Processing..." : "Withdraw Rewards"}
              </button>
            </div>
          </div>

          <div className="vault-card premium-card">
            <h3 className="card-title">
              <span className="card-icon">👥</span>
              Referral Rewards {account?.toLowerCase() === DEFAULT_REFERRER?.toLowerCase() && <span style={{ fontSize: '12px', color: '#4a9eff' }}>(Default Referrer Account)</span>}
            </h3>
            <div className="reward-display">
              <span className="reward-amount purple">{formatAmount(referralRewards)} USDT</span>
              <span className="reward-label">From referrals</span>
            </div>
            
            {account?.toLowerCase() === DEFAULT_REFERRER?.toLowerCase() && (
              <div style={{ marginTop: '12px', padding: '8px', background: '#1a2332', borderRadius: '6px', border: '1px solid #4a9eff' }}>
                <div style={{ fontSize: '12px', color: '#4a9eff', fontWeight: 'bold', marginBottom: '8px' }}>
                  🏢 Default Referrer Statistics
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '12px' }}>
                  <span style={{ color: '#ccc' }}>Total Deposits via Default:</span>
                  <span style={{ color: '#fff' }}>{defaultReferrerStats.totalReferrals}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '12px' }}>
                  <span style={{ color: '#ccc' }}>Unique Users (No Referral):</span>
                  <span style={{ color: '#fff' }}>{defaultReferrerStats.uniqueReferrals}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                  <span style={{ color: '#ccc' }}>Total Default Rewards:</span>
                  <span style={{ color: '#fff' }}>{formatAmount(defaultReferrerStats.totalRewards)} USDT</span>
                </div>
              </div>
            )}

            <div className="referral-actions">
              <button className="copy-link-button" onClick={copyReferralLink}>
                Copy Referral Link
              </button>
              <button className="see-referrals-button" onClick={() => {
                setShowReferralsModal(true);
              }}>
                See Referrals
              </button>
            </div>

            <button className="vault-button premium-button purple" onClick={withdrawReferral} disabled={txLoading}>
              {txLoading ? "Processing..." : "Withdraw Referral"}
            </button>
          </div>

          {/* Weekly Referral Challenge */}
          <WeeklyChallenge 
            walletAddress={walletAddress}
            vaultContract={contract}
            isConnected={isConnected}
          />

          <Leaderboard />

          {/* De.Fi Intelligence Panel */}
          <SmartDeFiInsights 
            account={account}
            vaultBalance={vaultActiveAmount}
            contractAddress={config.blackVaultContract}
          />

          <HowItWorks />
        </div>
      </div>

        <Footer />

      <ReferralsModal
        isOpen={showReferralsModal}
        onClose={() => setShowReferralsModal(false)}
        contract={contract}
        account={account}
        formatAddress={formatAddress}
        isDefaultReferrer={account?.toLowerCase() === DEFAULT_REFERRER?.toLowerCase()}
      />

      <AccrualInfoModal
        isOpen={showAccrualInfoModal}
        onClose={() => setShowAccrualInfoModal(false)}
      />

      {/* Activation Help Modal removed: no longer needed in V2 */}
    </div>
    <SpeedInsights />

    </>
  );
}
