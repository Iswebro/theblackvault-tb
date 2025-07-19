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
import "./App.css";
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
  const [queuedBalance, setQueuedBalance] = useState("0");
  const [depositAmount, setDepositAmount] = useState("");
  const [rewards, setRewards] = useState("0");
  const [referralRewards, setReferralRewards] = useState("0");
  const [referralAddress, setReferralAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [txLoading, setTxLoading] = useState(false);
  const [referralCount, setReferralCount] = useState(0);
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

      // First check if the contract exists and has code
      try {
        const code = await provider.getCode(CONTRACT_ADDRESS)
        if (code === "0x") {
          console.error("❌ Contract has no code at address:", CONTRACT_ADDRESS)
          addToast("Contract not deployed at specified address", "error")
          return
        }
        console.log("✅ Contract code found at address")
      } catch (error) {
        console.error("❌ Error checking contract code:", error)
        addToast("Failed to verify contract deployment", "error")
        return
      }
      
      // Test basic contract functions with better error handling
      let contractValidation = true
      
      try {
        const minDeposit = await vault.MIN_DEPOSIT()
        console.log("✅ MIN_DEPOSIT from main contract:", minDeposit.toString())
      } catch (error) {
        console.error("❌ Error calling MIN_DEPOSIT on main contract:", error)
        console.error("Contract may not be the expected BlackVault contract")
        contractValidation = false
      }

      try {
        const dailyRate = await vault.DAILY_RATE()
        console.log("✅ DAILY_RATE from main contract:", dailyRate.toString())
      } catch (error) {
        console.error("❌ Error calling DAILY_RATE on main contract:", error)
        contractValidation = false
      }
      
      if (!contractValidation) {
        addToast("Contract validation failed - may be wrong contract or ABI mismatch", "error")
        console.error("Contract validation failed. Please check:")
        console.error("1. Contract address is correct")
        console.error("2. Contract is deployed and verified")
        console.error("3. ABI matches the deployed contract")
        // Don't return here - allow the app to continue with limited functionality
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
        console.log("✅ getUserVault works, pending rewards:", formatEther(vaultData[3])) // _pendingRewards is at index 3
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
      const res = await fetch(`/api/transaction-history?address=${account}`)
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
        addToast("Transaction history API error. See console for details.", "error");
        setHistory([]);
        return;
      }
      let data;
      try {
        data = await res.json();
      } catch (jsonError) {
        console.error("Transaction history API returned invalid JSON:", jsonError);
        addToast("Transaction history API returned invalid JSON.", "error");
        setHistory([]);
        return;
      }
      if (!data.result) {
        setHistory([]);
        return;
      }
      // Map BscScan txs to history format
      const processedEvents = data.result.map(tx => ({
        type: tx.methodId === '0xa9059cbb' ? 'Deposit' : 'Transfer', // You may want to improve this logic
        amount: (parseFloat(tx.value) / Math.pow(10, 18)).toString(),
        time: new Date(parseInt(tx.timeStamp) * 1000),
        txHash: tx.hash,
      }));
      processedEvents.sort((a, b) => b.time.getTime() - a.time.getTime());
      setHistory(processedEvents);
    } catch (error) {
      console.error("Error loading transaction history:", error);
      addToast("Error loading transaction history.", "error");
      setHistory([]);
    }
  }

  // ─────────── loadContractData ───────────
  const loadContractData = async (vault = contract, usdt = usdtContract) => {
    if (!vault || !provider || !account || !usdt) {
      console.log("Skipping loadContractData: missing dependencies", { vault, provider, account, usdt })
      return
    }

    try {
      // ─────────── WALLET BALANCES ───────────
      let ethBal, usdtBal, allowance;
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
      } catch (balanceError) {
        console.error("Error fetching wallet balances:", balanceError)
        addToast("Error fetching wallet balances. Check network connection.", "error")
        // Set fallback values
        setBalance("0")
        setUsdtBalance("0")
        setUsdtAllowance("0")
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
      let totalDeposited, activeAmount, queuedAmount, pendingRewards, totalRewardsWithdrawn;
      
      try {
        // BlackVault.sol getUserVault returns: [_totalDeposited, _totalRewardsWithdrawn, _joinedCycle, _pendingRewards]
        const vaultData = await vault.getUserVault(account);
        totalDeposited = vaultData[0];           // _totalDeposited
        totalRewardsWithdrawn = vaultData[1];    // _totalRewardsWithdrawn  
        const joinedCycle = vaultData[2];        // _joinedCycle
        pendingRewards = vaultData[3];           // _pendingRewards
        
        // Set default values for fields not returned by this contract version
        activeAmount = totalDeposited;  // Use totalDeposited as activeAmount
        queuedAmount = 0;               // Not available in this contract version

        setVaultActiveAmount(formatEther(activeAmount));
        setQueuedBalance(formatEther(queuedAmount));
        setRewards(formatEther(pendingRewards));

        console.log("Total Deposited:", formatEther(totalDeposited));
        console.log("Active Amount (using totalDeposited):", formatEther(activeAmount));
        console.log("Pending Rewards:", formatEther(pendingRewards));
        console.log("Total Rewards Withdrawn:", formatEther(totalRewardsWithdrawn));
        console.log("Joined Cycle:", joinedCycle.toString());
      } catch (error) {
        console.error("Error loading vault data:", error);
        addToast("Failed to load vault data from contract", "warning");
        // Set fallback values
        totalDeposited = 0;
        activeAmount = 0;
        queuedAmount = 0;
        pendingRewards = 0;
        totalRewardsWithdrawn = 0;
        setVaultActiveAmount("0");
        setQueuedBalance("0");
        setRewards("0");
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
      if ((Number(activeAmount) > 0 || Number(queuedAmount) > 0) && cycleStart > 0 && cycleDur > 0) {
        // Get current block timestamp
        let now = 0;
        try {
          const block = await provider.getBlock("latest");
          now = block.timestamp;
        } catch (e) {
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
      // …leave your existing code here unchanged…
      await loadTransactionHistory(vault, usdt)
    } catch (error) {
      console.error("Error loading contract data:", error)
      addToast("Error loading data from contract", "error")
      // reset just these three so UI doesn’t hang
      setVaultActiveAmount("0")
      setQueuedBalance    ("0")
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
    if (account && timeUntilNextCycle > 0) {
      timer = setInterval(() => {
        setTimeUntilNextCycle(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            if (provider && account) loadContractData();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else if (timeUntilNextCycle === 0 && provider && account) {
      loadContractData();
      // No automation needed: contract now handles queued-to-active in view logic
    }
    return () => clearInterval(timer);
  }, [provider, account, timeUntilNextCycle]);

  const formatAddress = (addr) => {
    if (!addr) return ""
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`
  }

  const formatAmount = (amount) => {
    const num = Number.parseFloat(amount)
    if (num === 0) return "0"
    if (num < 0.0001) return "< 0.0001"
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
       if (referralAddress && referralAddress !== ethers.ZeroAddress) {
         tx = await contract.depositWithReferrer(value, referralAddress)
       } else {
         tx = await contract.deposit(value)
       }
       const receipt = await tx.wait()
       if (receipt.status === 1) {
         addToast("Deposit successful!", "success")
         setDepositAmount("")
         // Update leaderboard if referral used
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
     if (!contract || txLoading || Number.parseFloat(rewards) === 0) {
       if (!contract) addToast("Contract not initialized", "error")
       else if (Number.parseFloat(rewards) === 0) addToast("No rewards to withdraw", "warning")
       return
     }
     setTxLoading(true)
     try {
       addToast("Withdrawing rewards…", "info")
       await contract.withdrawRewards()
       // Always call poke after withdraw
       try {
         await contract.poke();
         console.log("poke() called after withdraw");
       } catch (e) {
         console.warn("poke() failed after withdraw", e);
       }
       addToast("Rewards withdrawn!", "success")
       await loadContractData(contract, usdtContract)
     } catch (error) {
       console.error("Withdraw error:", error)
       const msg = error.message.includes("CALL_EXCEPTION") ? "No rewards available" : error.reason || "Withdrawal failed"
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
                <span className="balance-label">Active Balance</span>
                <span className="balance-value">{formatAmount(vaultActiveAmount)} USDT</span>
              </div>

              <div className="balance-item">
                <span className="balance-label">Queued for Accrual</span>
                <span className="balance-value">{formatAmount(queuedBalance)} USDT</span>
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
              {/* Discreet help button for cycle/activation issues (moved below Next Accrual In) */}
              <div style={{ textAlign: 'center', margin: '0px 0 0px 0' }}>
                <button
                  className="discreet-button"
                  style={{ fontSize: 12, color: '#888', background: 'none', border: 'none', textDecoration: 'underline', cursor: 'pointer', padding: 0 }}
                  onClick={() => setShowActivationModal(true)}
                >
                  Did cycle reset and Queued balance wasn't activated?
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
              <span className="reward-amount">{(Number(vaultActiveAmount) === 0 && Number(queuedBalance) > 0) ? "0" : formatAmount(rewards)} USDT</span>
              <span className="reward-label">Available to withdraw</span>
            </div>
            <button className="vault-button premium-button success" onClick={withdraw} disabled={txLoading}>
              {txLoading ? "Processing..." : "Withdraw Rewards"}
            </button>
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
              Referral Rewards
            </h3>
            <div className="reward-display">
              <span className="reward-amount purple">{formatAmount(referralRewards)} USDT</span>
              <span className="reward-label">From referrals</span>
            </div>
            <div className="referral-stats">
              <span className="referral-label">Referrals:</span>
              <span className="referral-value">{referralCount}</span>
            </div>

            <div className="referral-actions">
              <button className="copy-link-button" onClick={copyReferralLink}>
                Copy Referral Link
              </button>
              <button className="see-referrals-button" onClick={() => setShowReferralsModal(true)}>
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
      />

      {/* Activation Help Modal - styled to match premium frontend */}
      {showActivationModal && (
        <div className="premium-modal-overlay" style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(30,30,40,0.85)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="premium-card premium-modal" style={{ background: 'linear-gradient(135deg, #181824 0%, #232336 100%)', borderRadius: 18, padding: 32, maxWidth: 420, width: '95%', boxShadow: '0 4px 32px rgba(0,0,0,0.25)', position: 'relative', color: '#fff', border: '1px solid #222' }}>
            <button
              style={{ position: 'absolute', top: 18, right: 22, background: 'none', border: 'none', fontSize: 28, color: '#888', cursor: 'pointer', fontWeight: 600 }}
              onClick={() => setShowActivationModal(false)}
              aria-label="Close"
            >×</button>
            <div style={{ fontWeight: 700, fontSize: 22, marginBottom: 16, color: '#FFD700', textShadow: '0 1px 8px #222' }}>Why wasn't my Queued balance activated?</div>
            <ul style={{ fontSize: 15, color: '#eee', marginBottom: 18, paddingLeft: 22, lineHeight: 1.7 }}>
              <li>Cycle may not have reset yet (wait for <b>Next Accrual In</b> countdown).</li>
              <li>Network congestion or delayed block updates.</li>
              <li>Queued balance will activate automatically at the next cycle.</li>
              <li>If it still doesn't activate after the countdown, you can force activation below.</li>
            </ul>
            <button
              className="vault-button premium-button primary"
              style={{ fontSize: 15, padding: '8px 20px', marginTop: 10, marginBottom: 10, fontWeight: 600, borderRadius: 8, boxShadow: '0 2px 8px #FFD70044' }}
              onClick={async () => {
                if (!contract) return;
                try {
                  await contract.poke();
                  setShowActivationModal(false);
                  addToast("Deposit activation requested. Please wait for confirmation.", "info");
                  await loadContractData(contract, usdtContract);
                } catch (e) {
                  addToast("Activation failed or rejected.", "error");
                }
              }}
            >
              Force Activate Deposit
            </button>
            <div style={{ fontSize: 13, color: '#FFD700', marginTop: 10, textAlign: 'center', fontWeight: 500 }}>
              This will manually trigger the contract to activate your queued deposit.<br />
              <span style={{ color: '#fff', fontWeight: 400 }}>Only use if the automatic process fails after a cycle reset, and you're sure your deposit was made before current cycle.</span>
            </div>
          </div>
        </div>
      )}
    </div>
    <SpeedInsights />
    </>
  );
}
