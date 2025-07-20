"use client";
// src/App.js
import { useEffect, useState, useRef } from "react";
import { ethers, Contract, formatEther, parseEther } from "ethers";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { getUserInfo as fetchVaultInfo } from "./useBlackVault";
import { useToast, ToastContainer, ToastProvider } from "./components/Toast";
import { connectInjected, getReferralFromURL } from "./connectWallet";
import BlackVaultArtifact from "./contract/BlackVaultABI.json";
import ERC20Artifact from "./contract/ERC20Abi.json";
import BlackVaultV1Abi from "./contract/BlackVaultV1ABI.json";
import HowItWorks from "./components/HowItWorks";
import Leaderboard from "./components/Leaderboard";
import ReferralsModal from "./components/ReferralsModal";
import TroubleshootingModal from "./components/TroubleshootingModal";
import { config } from "./lib/config.js";

// Use .abi if present (Hardhat/Truffle artifact), else use as array
const BlackVaultAbi = BlackVaultArtifact.abi || BlackVaultArtifact;
const ERC20Abi = ERC20Artifact.abi || ERC20Artifact;


const CONTRACT_ADDRESS = config.contractAddress;
const OLD_CONTRACT_ADDRESS = config.oldContractAddress;
const USDT_ADDRESS = config.usdtAddress;
const DEFAULT_REFERRER = config.defaultReferrer;

export default function App() {

  // All state hooks first
  const [history, setHistory] = useState([]);
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  const [showActivationModal, setShowActivationModal] = useState(false);
  const [roi, setRoi] = useState({ invested: "0", earned: "0", roiBP: "0" });
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [account, setAccount] = useState("");
  const [contract, setContract] = useState(null);
  const [usdtContract, setUsdtContract] = useState(null);
  const [oldVaultContract, setOldVaultContract] = useState(null);
  const [balance, setBalance] = useState("0");
  const [usdtBalance, setUsdtBalance] = useState("0");
  // Removed: queuedBalance (no longer used in V2)
  const [depositAmount, setDepositAmount] = useState("");
  const [rewards, setRewards] = useState("0");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [referralRewards, setReferralRewards] = useState("0");
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
  const pageSize = 10;
  const totalPages = Math.ceil(history.length / pageSize);
  const paginatedHistory = history.slice((historyPage - 1) * pageSize, historyPage * pageSize);
  const closeHistoryToast = () => {
    setShowAllHistory(false);
    setHistoryPage(1);
  };
  const handlePrevPage = () => {
    setHistoryPage((p) => (p > 1 ? p - 1 : p));
  };
  const handleNextPage = () => {
    setHistoryPage((p) => (p < totalPages ? p + 1 : p));
  };

  const { toasts, addToast, removeToast } = useToast();
  const isManuallyDisconnected = useRef(false);
  const [showDisclaimer, setShowDisclaimer] = useState(true);

  // Get referral from URL on component mount
  useEffect(() => {
    const refFromURL = getReferralFromURL()
    setReferralAddress(refFromURL)
  }, [])

  // Initialize contracts when wallet connects
  useEffect(() => {
    if (signer && account && provider) {
      console.log("Initializing contracts for account:", account)
      initializeContracts()
    }
  }, [signer, account, provider])

  // Listen for account changes
  useEffect(() => {
    if (!window.ethereum) return;

    const handleChainChanged = () => {
      console.log("Chain changed, reloading page.");
      window.location.reload();
    };

    const handleAccountsChanged = async (accounts) => {
      console.log("Accounts changed event received:", accounts);

      // no accounts → disconnect
      if (accounts.length === 0) {
        console.log("No accounts found, disconnecting.");
        if (!isManuallyDisconnected.current) {
          disconnect();
        }
        return;
      }

      // if account differs from current, reconnect
      if (accounts[0] !== account) {
        try {
          // grab provider + signer + account in one go
          const { provider: p, signer: s, account: a } = await connectInjected();
          setProvider(p);
          setSigner(s);
          setAccount(a);
          addToast("Wallet connected successfully!", "success");
        } catch (err) {
          console.error("Auto-connect failed:", err);
          addToast(err.message || "Failed to connect wallet", "error");
        }
      }
    };

    window.ethereum.on("accountsChanged", handleAccountsChanged);
    window.ethereum.on("chainChanged", handleChainChanged);

    // trigger once on mount to pick up any already-connected wallet
    window.ethereum
      .request({ method: "eth_accounts" })
      .then(handleAccountsChanged)
      .catch((err) => console.error("Error getting initial accounts:", err));
  if (!window.ethereum) return;
    return () => {
      if (window.ethereum.removeListener) {
        window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
        window.ethereum.removeListener("chainChanged", handleChainChanged);
      }
    };
  }, [signer, account, provider])

  const initializeContracts = async () => {
    if (!signer || !account) {
      console.log("Cannot initialize contracts: missing signer or account")
      return
    }

    try {
      // ─────────── CONTRACTS ───────────
      const vault = new Contract(CONTRACT_ADDRESS, BlackVaultAbi, signer)
      setContract(vault)
      console.log("BlackVault Contract initialized:", vault)

      const usdt = new Contract(USDT_ADDRESS, ERC20Abi, signer)
      setUsdtContract(usdt)
      console.log("USDT Contract initialized:", usdt)

      if (OLD_CONTRACT_ADDRESS) {
        const oldVault = new Contract(OLD_CONTRACT_ADDRESS, BlackVaultV1Abi, signer);
        setOldVaultContract(oldVault);
        console.log("BlackVault V1 Contract initialized:", oldVault);
      } else {
        console.warn("OLD_CONTRACT_ADDRESS is undefined. Skipping old vault contract initialization.");
      }

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

      await loadContractData(vault, usdt)
    } catch (error) {
      console.error("❌ Error initializing contracts:", error)
      addToast("Error connecting to contracts", "error")
    }
  }

  // Fetch transaction history from BscScan API proxy (with Redis cache)
  const loadTransactionHistory = async (vault, usdt) => {
    if (!vault || !account) {
      console.log("Skipping loadTransactionHistory: missing vault or account")
      return;
    }

    try {
      console.log("🔍 DEBUG: Loading transaction history for account:", account);
      console.log("🔍 DEBUG: Using contract address:", CONTRACT_ADDRESS);
      
      const res = await fetch(`/api/bscscan?wallet=${account}&vault=${CONTRACT_ADDRESS}`)
      if (!res.ok) {
        console.error("Transaction history API error:", res.status, res.statusText);
        addToast("Failed to load transaction history.", "error");
        setHistory([]);
        return;
      }
      const text = await res.text();
      if (!text.trim()) {
        console.error("Transaction history API returned empty response");
        addToast("Transaction history API returned empty response.", "error");
        setHistory([]);
        return;
      }
      let isJson = false;
      try {
        JSON.parse(text);
        isJson = true;
      } catch {
        // not JSON
      }
      if (!isJson) {
        console.error("Transaction history API did not return JSON. Response:", text);
        // addToast("Transaction history API error. See console for details.", "error"); // Suppressed until leaderboard work resumes
        setHistory([]);
        return;
      }
      let data;
      try {
        data = JSON.parse(text);
      } catch (jsonError) {
        console.error("Transaction history API returned invalid JSON:", jsonError);
        addToast("Transaction history API returned invalid JSON.", "error");
        setHistory([]);
        return;
      }
      
      console.log("🔍 DEBUG: BscScan API response:", data);
      
      if (!data.result) {
        console.log("🔍 DEBUG: No transaction results found");
        setHistory([]);
        return;
      }
      
      console.log("🔍 DEBUG: Found transactions:", data.result.length);
      
      // Map BscScan txs to history format
      const processedEvents = data.result.map(tx => {
        console.log("🔍 DEBUG: Processing transaction:", {
          hash: tx.hash,
          from: tx.from,
          to: tx.to,
          value: tx.value,
          tokenSymbol: tx.tokenSymbol,
          timeStamp: tx.timeStamp
        });
        
        // Determine transaction type based on direction
        let type = 'Transfer';
        if (tx.to.toLowerCase() === CONTRACT_ADDRESS.toLowerCase()) {
          type = 'Deposit';
        } else if (tx.from.toLowerCase() === CONTRACT_ADDRESS.toLowerCase()) {
          type = 'Withdrawal';
        }
        
        return {
          type: type,
          amount: (parseFloat(tx.value) / Math.pow(10, parseInt(tx.tokenDecimal || 18))).toString(),
          time: new Date(parseInt(tx.timeStamp) * 1000),
          txHash: tx.hash,
        };
      });
      
      processedEvents.sort((a, b) => b.time.getTime() - a.time.getTime());
      console.log("🔍 DEBUG: Processed events:", processedEvents);
      setHistory(processedEvents);
    } catch (error) {
      console.error("Error loading transaction history:", error);
      addToast("Error loading transaction history.", "error");
      setHistory([]);
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
      if (response.ok) {
        const apiData = await response.json();
        console.log("🔍 DEBUG: Cached referral stats API response:", apiData);
        
        if (apiData.result && apiData.result.stats) {
          const stats = apiData.result.stats;
          console.log("🔍 DEBUG: Using cached background job data:", stats);
          console.log("🔍 DEBUG: Data source: background job");
          console.log("🔍 DEBUG: Last updated:", apiData.result.lastUpdated);
          
          setDefaultReferrerStats({
            totalReferrals: stats.totalReferrals || "0",
            uniqueReferrals: stats.uniqueReferrals || 0,
            totalRewards: stats.totalRewards || "0",
            availableRewards: stats.availableRewards || "0"
          });
          return;
        }
      } else {
        console.warn("⚠️ Cached referral stats not available (API returned status:", response.status, "), using fallback");
        // Log more details about the API failure
        try {
          const errorData = await response.text();
          console.warn("⚠️ API error details:", errorData);
        } catch (e) {
          console.warn("⚠️ Could not read error response");
        }
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
          
          // Helper function for event queries with retry (same as user referrals)
          const queryEventsWithRetry = async (contract, filter, blockRanges = [-20000, -8000, -3000]) => {
            for (let i = 0; i < blockRanges.length; i++) {
              const blockRange = blockRanges[i];
              try {
                console.log(`🔍 DEBUG: Default referrer - trying event query with ${Math.abs(blockRange)}k block range...`);
                if (i > 0) {
                  await new Promise(resolve => setTimeout(resolve, 1000 * i));
                }
                const events = await contract.queryFilter(filter, blockRange);
                console.log(`🔍 DEBUG: Default referrer - found ${events.length} events with ${Math.abs(blockRange)}k range`);
                return events;
              } catch (error) {
                console.warn(`⚠️ Default referrer event query failed with ${Math.abs(blockRange)}k range:`, error.message);
                if (i === blockRanges.length - 1) {
                  console.error("❌ Default referrer - all event query attempts failed");
                  return [];
                }
              }
            }
            return [];
          };
          
          // Get ALL deposit events
          const depositFilter = vault.filters.Deposited();
          const depositEvents = await queryEventsWithRetry(vault, depositFilter, [-20000, -8000, -3000]);
          console.log("🔍 DEBUG: Default referrer - total deposit events found:", depositEvents.length);
          
          // Filter for deposits that benefited the default referrer
          // This includes: deposits without referral (auto-assigned to default) AND explicit default referrer usage
          const defaultReferrerEvents = depositEvents.filter(event => {
            const referrer = event.args?.referrer;
            const isDefaultReferrer = referrer && referrer.toLowerCase() === DEFAULT_REFERRER.toLowerCase();
            const isZeroAddress = referrer && (referrer === ethers.ZeroAddress || referrer.toLowerCase() === "0x0000000000000000000000000000000000000000");
            return isDefaultReferrer || isZeroAddress;
          });
          
          console.log("🔍 DEBUG: Default referrer - events using default referrer or zero address:", defaultReferrerEvents.length);
          
          // More importantly: find ALL deposits and identify which users made deposits without using ANY referral
          // We need to find users who have made deposits where the referrer was assigned as default (not chosen by user)
          console.log("🔍 DEBUG: Analyzing deposit patterns to find no-referral users...");
          
          // Group deposits by user to analyze their referral patterns
          const userDepositPatterns = {};
          depositEvents.forEach(event => {
            const user = event.args?.user?.toLowerCase();
            const referrer = event.args?.referrer?.toLowerCase();
            
            if (user && referrer) {
              if (!userDepositPatterns[user]) {
                userDepositPatterns[user] = {
                  totalDeposits: 0,
                  defaultReferrerDeposits: 0,
                  otherReferrerDeposits: 0,
                  referrers: new Set()
                };
              }
              
              userDepositPatterns[user].totalDeposits++;
              userDepositPatterns[user].referrers.add(referrer);
              
              const isDefaultOrZero = referrer === DEFAULT_REFERRER.toLowerCase() || 
                                     referrer === ethers.ZeroAddress.toLowerCase() || 
                                     referrer === "0x0000000000000000000000000000000000000000";
              
              if (isDefaultOrZero) {
                userDepositPatterns[user].defaultReferrerDeposits++;
              } else {
                userDepositPatterns[user].otherReferrerDeposits++;
              }
            }
          });
          
          // Find users who made deposits without referrals (deposits that used default referrer)
          const usersWithoutReferralDeposits = Object.keys(userDepositPatterns).filter(user => 
            userDepositPatterns[user].defaultReferrerDeposits > 0
          );
          
          console.log("🔍 DEBUG: Users who made deposits without referral links:", usersWithoutReferralDeposits.length);
          console.log("🔍 DEBUG: User deposit patterns:", Object.fromEntries(
            Object.entries(userDepositPatterns).slice(0, 3).map(([user, pattern]) => [
              user.slice(0, 10) + '...', 
              {
                total: pattern.totalDeposits,
                defaultRef: pattern.defaultReferrerDeposits,
                otherRef: pattern.otherReferrerDeposits,
                referrerCount: pattern.referrers.size
              }
            ])
          ));
          
          setDefaultReferrerStats({
            ...basicStats,
            uniqueReferrals: usersWithoutReferralDeposits.length
          });
          
          console.log("✅ Successfully used event querying for default referrer stats");
          
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

  const loadContractData = async (vault = contract, usdt = usdtContract) => {
    if (!vault || !provider || !account || !usdt) {
      console.log("Skipping loadContractData: missing dependencies", { vault, provider, account, usdt })
      return
    }

    try {
      // ─────────── WALLET BALANCES ───────────
      let ethBal, usdtBal, allowance;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          [ethBal, usdtBal, allowance] = await Promise.all([
            provider.getBalance(account),
            usdt.balanceOf(account),
            usdt.allowance(account, CONTRACT_ADDRESS),
          ])
          setBalance      (formatEther(ethBal))
          setUsdtBalance  (formatEther(usdtBal))
          setUsdtAllowance(formatEther(allowance))
          console.log("Wallet ETH balance:",   formatEther(ethBal))
          console.log("Wallet USDT balance:",  formatEther(usdtBal))
          console.log("USDT allowance:",       formatEther(allowance))
          break; // Success, exit retry loop
        } catch (balanceError) {
          console.warn(`Error fetching wallet balances (attempt ${attempt}/3):`, balanceError)
          if (attempt === 3) {
            console.error("Failed to fetch wallet balances after 3 attempts")
            // Set fallback values
            setBalance("0")
            setUsdtBalance("0")
            setUsdtAllowance("0")
          } else {
            // Wait before retry
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          }
        }
      }

      // ─────────── REFERRAL REWARDS ───────────
      try {
        if (vault && account) {
          console.log("🔍 DEBUG: Loading user referral data for account:", account);
          
          // Try to use cached background job data first (fast and reliable)
          let userReferralDataFetched = false;
          try {
            const userResponse = await fetch(`/api/referral-stats?user=${account}`);
            if (userResponse.ok) {
              const userApiData = await userResponse.json();
              console.log("🔍 DEBUG: Cached user referral API response:", userApiData);
              
              if (userApiData.result && userApiData.result.stats) {
                const { contractData, stats } = userApiData.result;
                
                console.log("🔍 DEBUG: Using cached background job data for user referrals:", {
                  availableRewards: contractData.availableRewards,
                  totalReferrals: stats.totalReferralCount,
                  uniqueReferrals: stats.uniqueReferrals,
                  dataSource: "background-job"
                });
                
                setReferralRewards(contractData.availableRewards || "0");
                setReferralCount(stats.totalReferralCount || "0");
                setUniqueReferralCount(stats.uniqueReferrals || 0);
                
                console.log("Referral rewards (available) from cache:", contractData.availableRewards);
                console.log("Referral count from cache:", stats.totalReferralCount);
                console.log("Unique referral count from cache:", stats.uniqueReferrals);
                
                userReferralDataFetched = true;
              }
            } else {
              console.warn("⚠️ User not found in cached data (API returned status:", userResponse.status, "), using direct contract call");
              // Log API error details
              try {
                const errorData = await userResponse.text();
                console.warn("⚠️ User API error details:", errorData);
              } catch (e) {
                console.warn("⚠️ Could not read user API error response");
              }
            }
          } catch (userApiError) {
            console.warn("⚠️ Cached user referral API error, using direct contract call:", userApiError.message);
          }
          
          // Fallback to direct contract call WITH event queries (same as ReferralsModal)
          if (!userReferralDataFetched) {
            console.log("🔍 DEBUG: Fallback - using direct contract call WITH events (same as modal)...");
            
            const referralData = await vault.getUserReferralData(account);
            console.log("🔍 DEBUG: Raw referralData:", referralData);
            
            // Set basic rewards and total count from contract
            setReferralRewards(formatEther(referralData[1])); // _availableRewards
            const contractReferralCount = referralData[2]?.toString() || "0";
            setReferralCount(contractReferralCount);
            
            console.log("Referral rewards (available) from contract:", formatEther(referralData[1]));
            console.log("Referral count from contract:", contractReferralCount);
            
            // Now do event queries to get unique count (same logic as ReferralsModal)
            try {
              console.log("🔍 DEBUG: Querying deposit events for unique referral count...");
              
              // Helper function for event queries with retry (same as ReferralsModal)
              const queryEventsWithRetry = async (contract, filter, blockRanges = [-20000, -8000, -3000]) => {
                for (let i = 0; i < blockRanges.length; i++) {
                  const blockRange = blockRanges[i];
                  try {
                    console.log(`🔍 DEBUG: Trying event query with ${Math.abs(blockRange)}k block range...`);
                    if (i > 0) {
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
              
              // Get deposit events where this user is the referrer (same as ReferralsModal)
              const depositFilter = vault.filters.Deposited(null, null, account);
              const depositEvents = await queryEventsWithRetry(vault, depositFilter, [-20000, -8000, -3000]);
              console.log("🔍 DEBUG: Deposit events found:", depositEvents.length);
              
              // Extract unique referee addresses
              const uniqueReferees = [...new Set(depositEvents.map((event) => event.args.user.toLowerCase()))];
              setUniqueReferralCount(uniqueReferees.length);
              
              console.log("🔍 DEBUG: Unique referees found:", uniqueReferees.length);
              console.log("✅ Successfully used same logic as ReferralsModal");
              
            } catch (eventError) {
              console.warn("⚠️ Event queries failed, setting unique count to 0:", eventError.message);
              setUniqueReferralCount(0);
            }
          }
        }
      } catch (e) {
        console.error("Error fetching referral rewards:", e);
        setReferralRewards("0");
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
      let totalDeposited, pendingRewards, totalRewardsWithdrawn;
      
      for (let attempt = 1; attempt <= 3; attempt++) {
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
          // Removed: setQueuedBalance (no longer used in V2)
          setRewards(formatEther(pendingRewards));

          console.log("Total Deposited (Gross):", formatEther(totalDeposited));
          console.log("Net Earning Amount:", netEarningAmount);
          console.log("Pending Rewards:", formatEther(pendingRewards));
          break; // Success, exit retry loop
        } catch (error) {
          console.warn(`Error loading vault data (attempt ${attempt}/3):`, error);
          if (attempt === 3) {
            console.error("Failed to load vault data after 3 attempts");
            // Set fallback values
            totalDeposited = 0;
            pendingRewards = 0;
            setVaultActiveAmount("0");
            setRewards("0");
          } else {
            // Wait before retry
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          }
        }
      }

      // ─────────── ALL-TIME ROI ───────────
      try {
        const invested = parseFloat(formatEther(totalDeposited));
        const earned = parseFloat(formatEther(pendingRewards)) + parseFloat(formatEther(totalRewardsWithdrawn));
        const roiBP = invested > 0 ? ((earned / invested) * 10000).toFixed(0) : "0";
        setRoi({
          invested: invested.toString(),
          earned: earned.toString(),
          roiBP: roiBP,
        });
      } catch (error) {
        console.error("Error calculating ROI:", error);
        setRoi({
          invested: "0",
          earned: "0",
          roiBP: "0",
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
      if ((Number(vaultActiveAmount) > 0) && cycleStart > 0 && cycleDur > 0) {
        // Get current block timestamp with retry logic for RPC issues
        let now = 0;
        try {
          const block = await provider.getBlock("latest");
          now = block.timestamp;
        } catch (e) {
          console.warn("Failed to get latest block timestamp, using local time:", e);
          now = Math.floor(Date.now() / 1000);
        }
        // How many cycles since launch?
        const cyclesSinceLaunch = Math.floor((now - cycleStart) / cycleDur);
        const nextCycleTime = cycleStart + (cyclesSinceLaunch + 1) * cycleDur;
        const secondsLeft = nextCycleTime - now;
        setTimeUntilNextCycle(secondsLeft > 0 ? secondsLeft : 0);
      } else {
        setTimeUntilNextCycle(0);
      }

      // ─────────── YOUR REFERRAL + CONSTANTS + TIMING + HISTORY FOLLOWS ───────────
      // Load default referrer statistics
      await loadDefaultReferrerData(vault);
      
      await loadTransactionHistory(vault, usdt)
    } catch (error) {
      console.error("Error loading contract data:", error)
      addToast("Error loading data from contract", "error")
      // reset just these three so UI doesn’t hang
      setVaultActiveAmount("0")
      setRewards          ("0")
      setTimeUntilNextCycle(0)
    }
  }
 
  // ─── Re-load whenever provider or account changes ───
  useEffect(() => {
    if (provider && account) {
      loadContractData();
    }
  }, [provider, account]);
 
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
            // Optionally reload contract data here if needed
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      setTimeUntilNextCycle(0);
    }
    return () => clearInterval(timer);
  }, [account, provider, vaultActiveAmount, cycleStartTime, cycleDuration]);

  const formatAddress = (addr) => {
    if (!addr) return ""
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`
  }

  const formatAmount = (amount) => {
    const num = Number.parseFloat(amount)
    if (num === 0 || isNaN(num) || num < 0.0001) return "0"
    return Number.parseFloat(num.toFixed(6)).toString()
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
      setDepositAmount(maxAmount.toString())
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
 
       // ─── Insert wallet/contract action handlers here ────────────────────────────
  const connectWallet = async () => {
     if (loading) return
 
     setLoading(true)
     try {
       isManuallyDisconnected.current = false
       // small delay to let metamask UI settle
       await new Promise(r => setTimeout(r, 100))
       console.log("Attempting to connect wallet…")
       const { provider: p, signer: s, account: a } = await connectInjected()
       setProvider(p)
       setSigner(s)
       setAccount(a)
       addToast("Wallet connected successfully!", "success")
     } catch (error) {
       console.error("Connection failed:", error)
       let msg = error?.message || "Failed to connect wallet"
       if (msg.includes("chainId")) {
         msg = "BSC Mainnet not configured. Please add BSC or use MetaMask."
       } else if (msg.includes("No wallet found")) {
         msg = "Please install MetaMask or use Trust Wallet's in-app browser."
       } else if (msg.includes("rejected")) {
         msg = "Connection cancelled. Please approve the request."
       }
       addToast(msg, "error")
     } finally {
       setLoading(false)
     }
   }
 
   const approveUsdt = async () => {
     if (!usdtContract || txLoading || Number.parseFloat(depositAmount) <= 0) return
     setTxLoading(true)
     try {
       addToast("Approving USDT…", "info")
       const tx = await usdtContract.approve(CONTRACT_ADDRESS, parseEther(depositAmount))
       await tx.wait()
       addToast("USDT approved!", "success")
       await loadContractData(contract, usdtContract)
     } catch (error) {
       console.error("Approval failed:", error)
       addToast(error.code === 4001 ? "Transaction cancelled" : "Approval failed", error.code === 4001 ? "warning" : "error")
     } finally {
       setTxLoading(false)
     }
   }
 
   const deposit = async () => {
     if (!contract || txLoading || Number.parseFloat(depositAmount) <= 0) return
     if (Number.parseFloat(usdtAllowance) < Number.parseFloat(depositAmount)) {
       return addToast("Please approve USDT first", "error")
     }
     setTxLoading(true)
     try {
       addToast("Processing deposit…", "info")
       const value = parseEther(depositAmount)
       let tx
       // Always use depositWithReferrer, with defaultReferrer if no referralAddress
       const referrerToUse = (referralAddress && referralAddress !== ethers.ZeroAddress)
         ? referralAddress
         : DEFAULT_REFERRER;
       tx = await contract.depositWithReferrer(value, referrerToUse)
       const receipt = await tx.wait()
       if (receipt.status === 1) {
         addToast("Deposit successful!", "success")
         setDepositAmount("")
         // Update leaderboard if referral used (optional, can keep as is)
         if (referralAddress && referralAddress !== ethers.ZeroAddress) {
           fetch("/api/leaderboard/update", {
             method: "POST",
             headers: { "Content-Type": "application/json" },
             body: JSON.stringify({
               referrer: referralAddress,
               amount: value.toString(), // value is already in wei
             }),
           })
             .then(() => {
               addToast("Leaderboard updated!", "success")
             })
             .catch(() => {
               addToast("Failed to update leaderboard", "warning")
             })
         }
         // Always call poke after deposit
         try {
           await contract.poke();
           console.log("poke() called after deposit");
         } catch (e) {
           console.warn("poke() failed after deposit", e);
         }
         await loadContractData(contract, usdtContract)
       } else {
         addToast("Deposit failed on-chain", "error")
       }
     } catch (error) {
       console.error("Deposit error:", error)
       const msg = error.data?.message || error.message || "Deposit failed"
       addToast(msg, error.code === 4001 ? "warning" : "error")
     } finally {
       setTxLoading(false)
     }
   }
 
   const withdraw = async () => {
     if (!contract || txLoading) {
       if (!contract) addToast("Contract not initialized", "error")
       return
     }
     const amount = Number.parseFloat(withdrawAmount);
     if (!withdrawAmount || isNaN(amount) || amount <= 0) {
       addToast("Enter a valid amount to withdraw", "warning");
       return;
     }
     if (amount > Number.parseFloat(rewards)) {
       addToast("Cannot withdraw more than available rewards", "warning");
       return;
     }
     setTxLoading(true)
     try {
       addToast("Withdrawing rewards…", "info")
       const tx = await contract.withdrawRewards(parseEther(withdrawAmount));
       await tx.wait();
       // Always call poke after withdraw
       try {
         await contract.poke();
         console.log("poke() called after withdraw");
       } catch (e) {
         console.warn("poke() failed after withdraw", e);
       }
       addToast("Rewards withdrawn!", "success")
       setWithdrawAmount("");
       await loadContractData(contract, usdtContract)
     } catch (error) {
       console.error("Withdraw error:", error)
       const msg = error.message?.includes("CALL_EXCEPTION") ? "No rewards available" : error.reason || "Withdrawal failed"
       addToast(msg, error.code === 4001 ? "warning" : "error")
     } finally {
       setTxLoading(false)
     }
   }
 
   const withdrawOldVaultRewards = async () => {
     if (!oldVaultContract || txLoading) return
     setTxLoading(true)
     try {
       addToast("Withdrawing V1 vault rewards…", "info")
       await oldVaultContract.withdrawRewards()
       // Always call poke after old vault withdraw
       try {
         await contract.poke();
         console.log("poke() called after old vault withdraw");
       } catch (e) {
         console.warn("poke() failed after old vault withdraw", e);
       }
       addToast("V1 vault rewards withdrawn!", "success")
       await loadContractData(contract, usdtContract)
     } catch (error) {
       console.error("V1 vault withdraw error:", error)
       const msg = error.message.includes("CALL_EXCEPTION") ? "No V1 rewards" : error.reason || "V1 withdrawal failed"
       addToast(msg, error.code === 4001 ? "warning" : "error")
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
     setTxLoading(true)
     try {
       addToast("Withdrawing referral rewards…", "info")
       await contract.withdrawReferralRewards()
       // Always call poke after referral withdraw
       try {
         await contract.poke();
         console.log("poke() called after referral withdraw");
       } catch (e) {
         console.warn("poke() failed after referral withdraw", e);
       }
       addToast("Referral rewards withdrawn!", "success")
       await loadContractData(contract, usdtContract)
     } catch (error) {
       console.error("Referral withdraw error:", error)
       const msg = error.message.includes("CALL_EXCEPTION") ? "No referral rewards" : error.reason || "Referral withdrawal failed"
       addToast(msg, error.code === 4001 ? "warning" : "error")
     } finally {
       setTxLoading(false)
     }
   }
 
   const withdrawOldReferralRewards = async () => {
     if (!oldVaultContract || txLoading) return
     setTxLoading(true)
     try {
       addToast("Withdrawing V1 referral rewards…", "info")
       await oldVaultContract.withdrawReferralRewards()
       addToast("V1 referral rewards withdrawn!", "success")
       await loadContractData(contract, usdtContract)
     } catch (error) {
       console.error("V1 referral withdraw error:", error)
       const msg = error.message.includes("CALL_EXCEPTION") ? "No V1 referral rewards" : error.reason || "V1 referral withdrawal failed"
       addToast(msg, error.code === 4001 ? "warning" : "error")
     } finally {
       setTxLoading(false)
     }
   }
 
   const disconnect = () => {
     isManuallyDisconnected.current = true
     setProvider(null)
     setSigner(null)
     setAccount("")
     setContract(null)
     setUsdtContract(null)
     setOldVaultContract(null)
     setBalance("0")
     setUsdtBalance("0")
     setUsdtAllowance("0")
     setRewards("0")
     setReferralRewards("0")
     setHistory([])
     setReferralCount("0")
     setUniqueReferralCount(0)
     setMinDeposit("0")
     setVaultActiveAmount("0")
     setReferralBonusesRemaining("3")
     addToast("Wallet disconnected", "info")
   }
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

            <button className="connect-button premium-button" onClick={connectWallet} disabled={loading}>
              {loading ? (
                <>
                  <div className="loading-spinner"></div>
                  Connecting...
                </>
              ) : (
                "Connect Wallet"
              )}
            </button>

            <button className="discreet-button" onClick={() => setShowTroubleshootingModal(true)}>
              Troubleshooting & Network Info
            </button>
          </div>
        </div>

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
          </div>
          <div className="header-account">
            <span className="account-label">Connected</span>
            <span className="account-address">{formatAddress(account)}</span>
          </div>
        </div>

        <div className="vault-interface">
          <div className="vault-card premium-card">
            <h3 className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Vault Balance</span>
              <span style={{ fontWeight: 400, fontSize: 14, color: '#888', marginLeft: 'auto' }}>
                All-time ROI: {roi && roi.invested !== "0" ? ((parseFloat(roi.earned) / parseFloat(roi.invested) * 100).toFixed(2)) : "0.00"}%
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
                  {formatAmount(((parseFloat(vaultActiveAmount) * parseFloat(dailyRate)) / 1000).toString())} USDT
                </span>
              </div>

              <div className="balance-item">
                <span className="balance-label">Next Accrual In</span>
                <span className="balance-value">{timeUntilNextCycle > 0 ? formatCountdown(timeUntilNextCycle) : "00:00:00"}</span>
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
                  will result in permanent loss of funds. Ensure your wallet is connected to the BSC Mainnet and you are
                  depositing BEP-20 USDT.
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
                onChange={(e) => setDepositAmount(e.target.value)}
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
              <span className="reward-amount">{formatAmount(rewards)} USDT</span>
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
                onChange={e => setWithdrawAmount(e.target.value)}
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
            <button
              className="vault-button premium-button warning"
              onClick={withdrawOldVaultRewards}
              disabled={!oldVaultContract || txLoading}
            >
              {txLoading ? "Processing..." : "Withdraw V1 Vault Rewards"}
            </button>
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
            <div className="referral-stats">
              <span className="referral-label">Your Referrals:</span>
              <span className="referral-value">{uniqueReferralCount}</span>
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
                <div style={{ fontSize: '10px', color: '#666', marginTop: '8px', fontStyle: 'italic' }}>
                  Debug: Connected as {formatAddress(account)} | Default: {formatAddress(DEFAULT_REFERRER)} | Match: {account?.toLowerCase() === DEFAULT_REFERRER?.toLowerCase() ? 'YES' : 'NO'}
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
            <button
              className="vault-button premium-button warning"
              onClick={withdrawOldReferralRewards}
              disabled={!oldVaultContract || txLoading}
            >
              {txLoading ? "Processing..." : "Withdraw V1 Referral Rewards"}
            </button>
          </div>


          <div className="vault-card premium-card">
            <h3 className="card-title">
              <span className="card-icon">📊</span>
              Transaction History
            </h3>
            {history.length === 0 ? (
              <div className="empty-state">
                <p className="empty-message">No transactions yet</p>
                <p className="empty-submessage">Your deposits and withdrawals will appear here</p>
              </div>
            ) : (
              <>
                <div className="history-list">
                  {history.slice(0, 3).map((item) => (
                    <div key={`${item.txHash}-${item.time.getTime()}`} className="history-item">
                      <div className="history-info">
                        <div className={`history-dot ${item.type.toLowerCase().replace(/\s+/g, "-")}`}></div>
                        <div className="history-details">
                          <span className="history-type">{item.type}</span>
                          <span className="history-time">
                            {item.time.toLocaleDateString()} {item.time.toLocaleTimeString()}
                          </span>
                        </div>
                      </div>
                      <div className="history-amount">
                        <span className="amount-value">{formatAmount(item.amount)} USDT</span>
                        <a
                          href={`${config.blockExplorer}/tx/${item.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="view-tx"
                        >
                          View
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
                {history.length > 3 && (
                  <button
                    className="see-all-button premium-button"
                    style={{ marginTop: "12px", width: "100%" }}
                    onClick={() => setShowAllHistory(true)}
                  >
                    See All
                  </button>
                )}
              </>
            )}
          </div>

          {/* Toast pop-up for all transactions (paginated) */}
          {showAllHistory && (
            <div className="toast-overlay" style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div className="toast-popup" style={{ background: "#181818", borderRadius: 12, padding: 24, minWidth: 350, maxWidth: 420, maxHeight: "80vh", overflowY: "auto", boxShadow: "0 8px 32px rgba(0,0,0,0.4)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <h3 style={{ margin: 0 }}>All Transactions</h3>
                  <button onClick={closeHistoryToast} style={{ background: "none", border: "none", color: "#fff", fontSize: 22, cursor: "pointer" }}>&times;</button>
                </div>
                {history.length === 0 ? (
                  <div className="empty-state">
                    <p className="empty-message">No transactions yet</p>
                  </div>
                ) : (
                  <div className="history-list">
                    {paginatedHistory.map((item) => (
                      <div key={`${item.txHash}-${item.time.getTime()}`} className="history-item" style={{ borderBottom: "1px solid #333", paddingBottom: 8, marginBottom: 8 }}>
                        <div className="history-info">
                          <div className={`history-dot ${item.type.toLowerCase().replace(/\s+/g, "-")}`}></div>
                          <div className="history-details">
                            <span className="history-type">{item.type}</span>
                            <span className="history-time">
                              {item.time.toLocaleDateString()} {item.time.toLocaleTimeString()}
                            </span>
                          </div>
                        </div>
                        <div className="history-amount">
                          <span className="amount-value">{formatAmount(item.amount)} USDT</span>
                          <a
                            href={`${config.blockExplorer}/tx/${item.txHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="view-tx"
                          >
                            View
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {/* Pagination controls */}
                {totalPages > 1 && (
                  <div style={{ display: "flex", justifyContent: "center", alignItems: "center", marginTop: 12, gap: 12 }}>
                    <button
                      onClick={handlePrevPage}
                      disabled={historyPage === 1}
                      style={{ padding: "6px 14px", borderRadius: 6, border: "none", background: historyPage === 1 ? "#444" : "#222", color: "#fff", cursor: historyPage === 1 ? "not-allowed" : "pointer" }}
                    >
                      Prev
                    </button>
                    <span style={{ color: "#fff" }}>
                      Page {historyPage} of {totalPages}
                    </span>
                    <button
                      onClick={handleNextPage}
                      disabled={historyPage === totalPages}
                      style={{ padding: "6px 14px", borderRadius: 6, border: "none", background: historyPage === totalPages ? "#444" : "#222", color: "#fff", cursor: historyPage === totalPages ? "not-allowed" : "pointer" }}
                    >
                      Next
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="vault-card premium-card">
            <div className="text-center p-4 bg-gradient-to-r from-yellow-400 to-yellow-600 text-black rounded-lg mb-4">
              🎉 Weekly USDT Giveaway for Top 3 referrers is coming soon! Stay Tuned.
            </div>
          </div>

          <Leaderboard />

          <HowItWorks />

          <div className="disconnect-section">
            <button onClick={disconnect} className="disconnect-button">
              Disconnect Wallet
            </button>
          </div>
        </div>
      </div>

      <ReferralsModal
        isOpen={showReferralsModal}
        onClose={() => setShowReferralsModal(false)}
        contract={contract}
        account={account}
        formatAddress={formatAddress}
        isDefaultReferrer={account?.toLowerCase() === DEFAULT_REFERRER?.toLowerCase()}
      />

      {/* Activation Help Modal removed: no longer needed in V2 */}
    </div>
    <SpeedInsights />
    </>
  );
}
