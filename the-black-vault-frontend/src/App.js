"use client"

import { useEffect, useState, useRef } from "react"
import { Contract, formatEther, parseEther } from "ethers"
import { connectInjected, getReferralFromURL } from "./connectWallet"
import { useToast, ToastContainer } from "./components/Toast"
import BlackVaultJSON   from "./contract/BlackVaultABI.json"
import ERC20JSON        from "./contract/ERC20Abi.json"
import "./App.css"
import { config } from "./lib/config.ts"
import HowItWorks from "./components/HowItWorks"
import Leaderboard from "./components/Leaderboard"
import ReferralsModal from "./components/ReferralsModal"
import TroubleshootingModal from "./components/TroubleshootingModal"
import BlackVaultV1JSON from "./contract/BlackVaultV1ABI.json"

// pull out the `.abi` arrays
const BlackVaultAbi   = BlackVaultJSON.abi
const ERC20Abi        = ERC20JSON.abi
const BlackVaultV1Abi = BlackVaultV1JSON.abi
const CONTRACT_ADDRESS = config.contractAddress
const USDT_ADDRESS = config.usdtAddress

export default function App() {
  const [provider, setProvider] = useState(null)
  const [signer, setSigner] = useState(null)
  const [account, setAccount] = useState("")
  const [contract, setContract] = useState(null)
  const [usdtContract, setUsdtContract] = useState(null)
  const [oldVaultContract, setOldVaultContract] = useState(null)

  const [balance, setBalance] = useState("0")
  const [usdtBalance, setUsdtBalance] = useState("0")
  const [queuedBalance, setQueuedBalance] = useState("0")
  const [depositAmount, setDepositAmount] = useState("")
  const [rewards, setRewards] = useState("0")
  const [referralRewards, setReferralRewards] = useState("0")
  const [referralAddress, setReferralAddress] = useState("")
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(false)
  const [txLoading, setTxLoading] = useState(false)
  const [referralCount, setReferralCount] = useState(0)
  const [minDeposit, setMinDeposit] = useState("0")
  const [usdtAllowance, setUsdtAllowance] = useState("0")
  const [vaultActiveAmount, setVaultActiveAmount] = useState("0")
  const [referralBonusesRemaining, setReferralBonusesRemaining] = useState(3)
  const [showReferralsModal, setShowReferralsModal] = useState(false)
  const [showTroubleshootingModal, setShowTroubleshootingModal] = useState(false)
  const [dailyRate, setDailyRate] = useState("0")
  const [timeUntilNextCycle, setTimeUntilNextCycle] = useState(0)

  const { toasts, addToast, removeToast } = useToast()
  const isManuallyDisconnected = useRef(false)
  const [showDisclaimer, setShowDisclaimer] = useState(true)

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

    // got an account
    const newAccount = accounts[0];

    // if it’s a different account (or initial connect) AND we're not manually disconnected:
    if (!isManuallyDisconnected.current && newAccount.toLowerCase() !== account.toLowerCase()) {
      console.log("Connecting to account:", newAccount);
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

  return () => {
    if (window.ethereum.removeListener) {
      window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
      window.ethereum.removeListener("chainChanged", handleChainChanged);
    }
  };
}, [account, addToast, disconnect]);

  const initializeContracts = async () => {
    if (!signer) return
    try {
      console.log("=== CONTRACT DEBUGGING ===")
      console.log("CONTRACT_ADDRESS:", CONTRACT_ADDRESS)
      console.log("USDT_ADDRESS:", USDT_ADDRESS)
      console.log("OLD_CONTRACT_ADDRESS:", process.env.REACT_APP_OLD_CONTRACT_ADDRESS)
      console.log("Expected new contract:", "0xDe58F2cb3Bc62dfb9963f422d0DB079B2407a719")
      console.log("Expected old contract:", "0x08b7fCcb9c92cB3C6A3279Bc377F461fD6fD97A1")

      // Check if CONTRACT_ADDRESS is correct
      if (CONTRACT_ADDRESS !== "0xDe58F2cb3Bc62dfb9963f422d0DB079B2407a719") {
        console.error(
          "❌ WRONG CONTRACT ADDRESS! Expected: 0xDe58F2cb3Bc62dfb9963f422d0DB079B2407a719, Got:",
          CONTRACT_ADDRESS,
        )
        addToast("Wrong contract address configured!", "error")
      }

      const vault = new Contract(CONTRACT_ADDRESS, BlackVaultAbi, signer)
      setContract(vault)
      console.log("BlackVault Contract initialized:", vault)

      const usdt = new Contract(USDT_ADDRESS, ERC20Abi, signer)
      setUsdtContract(usdt)
      console.log("USDT Contract initialized:", usdt)

      const oldVault = new Contract(process.env.REACT_APP_OLD_CONTRACT_ADDRESS, BlackVaultV1Abi, signer)
      setOldVaultContract(oldVault)
      console.log("BlackVault V1 Contract initialized:", oldVault)

      // Test if the main contract has the expected functions
      console.log("=== TESTING CONTRACT FUNCTIONS ===")
      try {
        const minDeposit = await vault.MIN_DEPOSIT()
        console.log("✅ MIN_DEPOSIT from main contract:", minDeposit.toString())
      } catch (error) {
        console.error("❌ Error calling MIN_DEPOSIT on main contract:", error)
      }

      try {
        const dailyRate = await vault.DAILY_RATE()
        console.log("✅ DAILY_RATE from main contract:", dailyRate.toString())
      } catch (error) {
        console.error("❌ Error calling DAILY_RATE on main contract:", error)
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
        console.log("✅ getUserVault works, pending rewards:", formatEther(vaultData.pendingRewards))
      } catch (error) {
        console.error("❌ Error calling getUserVault:", error)
      }

      await loadContractData(vault, usdt)
    } catch (error) {
      console.error("❌ Error initializing contracts:", error)
      addToast("Error connecting to contracts", "error")
    }
  }

  const loadTransactionHistory = async (vault, usdt) => {
    if (!vault || !provider || !account) {
      console.log("Skipping loadTransactionHistory: missing vault, provider, or account")
      return
    }

    try {
      const depositEvents = await vault.queryFilter(vault.filters.Deposited(account), -10000)
      const rewardsWithdrawEvents = await vault.queryFilter(vault.filters.RewardsWithdrawn(account), -10000)
      const referralWithdrawEvents = await vault.queryFilter(vault.filters.ReferralRewardsWithdrawn(account), -10000)

      const processEvent = async (event, type) => {
        const block = await provider.getBlock(event.blockNumber)
        return {
          type: type,
          amount: formatEther(event.args.amount),
          time: new Date(block.timestamp * 1000),
          txHash: event.transactionHash,
        }
      }

      const allEventsPromises = [
        ...depositEvents.map((event) => processEvent(event, "Deposit")),
        ...rewardsWithdrawEvents.map((event) => processEvent(event, "Rewards Withdrawn")),
        ...referralWithdrawEvents.map((event) => processEvent(event, "Referral Withdrawal")),
      ]

      const processedEvents = await Promise.all(allEventsPromises)

      processedEvents.sort((a, b) => b.time.getTime() - a.time.getTime())
      setHistory(processedEvents)
    } catch (error) {
      console.error("Error loading transaction history:", error)
      setHistory([])
    }
  }

  const loadContractData = async (vault = contract, usdt = usdtContract) => {
  if (!vault || !provider || !account || !usdt) {
    console.log("Skipping loadContractData: missing dependencies", { vault, provider, account, usdt })
    return
  }

  console.log("Loading contract data for account:", account)
  console.log("▶ loadContractData:", { vault, provider, account, usdt })
    try {
          // ←── A: old vaultData fetch starts here
    try {
         // getUserVault returns [ totalDep, activeAmt, queuedAmt, pending, withdrawn, lastCycle, joined ]
      const vaultData = await vault.getUserVault(account)

  // ethers.js returns: [ totalDep, activeAmt, queuedAmt, pending, withdrawn, lastCycle, joined ]
      const active  = vaultData.activeAmt
      const queued  = vaultData.queuedAmt
      const pending = vaultData.pending

      setVaultActiveAmount(formatEther(active))
      setQueuedBalance   (formatEther(queued))
      setRewards         (formatEther(pending))

      console.log("Fetched vault active amount:",   formatEther(active))
      console.log("Fetched queued for accrual:",     formatEther(queued))
      console.log("Fetched pending rewards:",        formatEther(pending))
    } catch (error) {
      console.log("No vault data found for user", error)
      setVaultActiveAmount("0")
      setQueuedBalance("0")
      setRewards("0")
    }
  // ── B: old vaultData fetch ends here

      try {
        const refData = await vault.getUserReferralData(account)
        setReferralRewards(formatEther(refData.availableRewards))
        setReferralCount(refData.referredCount.toString())
        console.log("Fetched referral data:", {
          availableRewards: formatEther(refData.availableRewards),
          referredCount: refData.referredCount.toString(),
        })
      } catch (error) {
        console.log("No referral rewards found for user", error)
        setReferralRewards("0")
        setReferralCount("0")
      }

      if (referralAddress && referralAddress !== "0x0000000000000000000000000000000000000000") {
        try {
          const bonusInfo = await vault.getReferralBonusInfo(referralAddress, account)
          setReferralBonusesRemaining(bonusInfo.bonusesRemaining.toString())
          console.log("Fetched referral bonus info:", {
            bonusesUsed: bonusInfo.bonusesUsed.toString(),
            bonusesRemaining: bonusInfo.bonusesRemaining.toString(),
          })
        } catch (error) {
          console.log("No referral bonus info found", error)
          setReferralBonusesRemaining("3")
        }
      }

      try {
        const minDepositValue = await vault.MIN_DEPOSIT()
        setMinDeposit(formatEther(minDepositValue))
        console.log("Fetched MIN_DEPOSIT:", formatEther(minDepositValue), "USDT")
      } catch (error) {
        console.error("Error fetching MIN_DEPOSIT:", error)
        setMinDeposit("0")
      }

      try {
        const dailyRateValue = await vault.DAILY_RATE()
        setDailyRate(dailyRateValue.toString())
        console.log("Fetched DAILY_RATE:", dailyRateValue.toString())
      } catch (error) {
        console.error("Error fetching DAILY_RATE:", error)
        setDailyRate("0")
      }

      try {
        const timeRemaining = await vault.getTimeUntilNextCycle()
        setTimeUntilNextCycle(Number(timeRemaining.toString()))
        console.log("Fetched time until next cycle:", timeRemaining.toString(), "seconds")
      } catch (error) {
        console.error("Error fetching time until next cycle:", error)
        setTimeUntilNextCycle(0)
      }

      await loadTransactionHistory(vault, usdt)
    } catch (error) {
      console.error("Error loading contract data:", error)
      addToast("Error loading data from contract", "error")
    }
  }

  useEffect(() => {
  let timerInterval
  if (account && timeUntilNextCycle > 0) {
    timerInterval = setInterval(() => {
      setTimeUntilNextCycle((prev) => {
        if (prev <= 1) {
          clearInterval(timerInterval)
          // only call after both contracts are initialised
          if (contract && usdtContract) {
            loadContractData(contract, usdtContract)
          }
          return 0
        }
        return prev - 1
      })
    }, 1000)
  } else if (timeUntilNextCycle === 0 && account && contract && usdtContract) {
    // first-time fetch, now that contract & usdtContract are set
    loadContractData(contract, usdtContract)
  }

  return () => clearInterval(timerInterval)
}, [account, timeUntilNextCycle, contract, usdtContract])

  const connectWallet = async () => {
    if (loading) return

    setLoading(true)
    try {
      isManuallyDisconnected.current = false

      await new Promise((resolve) => setTimeout(resolve, 100))

      console.log("Attempting to connect wallet...")
      const conn = await connectInjected()

      console.log("Connection successful:", conn.account)
      setProvider(conn.provider)
      setSigner(conn.signer)
      setAccount(conn.account)

      addToast("Wallet connected successfully!", "success")
    } catch (error) {
      console.error("Connection failed:", error)

      let errorMessage = "Failed to connect wallet"

      if (error) {
        if (typeof error === "string") {
          errorMessage = error
        } else if (error.message) {
          errorMessage = error.message
        } else if (error.code) {
          errorMessage = `Wallet error (code: ${error.code})`
        }
      }

      if (errorMessage.includes("not supported chainID") || errorMessage.includes("chainId")) {
        errorMessage = "BSC Mainnet not configured. Please add BSC network manually or try MetaMask."
      } else if (errorMessage.includes("No wallet found")) {
        errorMessage = "Please use Trust Wallet's in-app browser or install MetaMask"
      } else if (errorMessage.includes("rejected") || errorMessage.includes("cancelled")) {
        errorMessage = "Connection cancelled. Please try again and approve the connection."
      } else if (errorMessage.includes("pending")) {
        errorMessage = "Connection already in progress. Please check your wallet app."
      }

      addToast(errorMessage, "error")
    } finally {
      setLoading(false)
    }
  }

  const approveUsdt = async () => {
    if (!usdtContract || txLoading || Number.parseFloat(depositAmount) <= 0) return

    setTxLoading(true)
    try {
      addToast("Approving USDT...", "info")
      const amountToApprove = parseEther(depositAmount)

      const tx = await usdtContract.approve(CONTRACT_ADDRESS, amountToApprove)
      addToast("Approval transaction submitted. Waiting for confirmation...", "info")
      await tx.wait()
      addToast("USDT approved successfully!", "success")
      await loadContractData(contract, usdtContract)
    } catch (error) {
      console.error("USDT approval failed:", error)
      if (error && error.code === 4001) {
        addToast("Transaction cancelled by user", "warning")
      } else {
        addToast("USDT approval failed. Please try again.", "error")
      }
    } finally {
      setTxLoading(false)
    }
  }

  const deposit = async () => {
    if (!contract || !depositAmount || txLoading || Number.parseFloat(depositAmount) <= 0) return

    if (Number.parseFloat(usdtAllowance) < Number.parseFloat(depositAmount)) {
      addToast("Please approve USDT first.", "error")
      return
    }

    setTxLoading(true)
    try {
      addToast("Processing deposit...", "info")

      const value = parseEther(depositAmount)
      console.log("Attempting to deposit amount (wei):", value.toString())

      let tx

      if (referralAddress && referralAddress !== "0x0000000000000000000000000000000000000000") {
        console.log("Calling depositWithReferrer with:", value.toString(), referralAddress)
        tx = await contract.depositWithReferrer(value, referralAddress)
      } else {
        console.log("Calling deposit with:", value.toString())
        tx = await contract.deposit(value)
      }

      console.log("Transaction sent, hash:", tx.hash)
      addToast("Transaction submitted. Waiting for confirmation...", "info")

      const receipt = await tx.wait()
      console.log("Transaction receipt:", receipt)

      if (receipt.status === 1) {
        addToast("Deposit successful!", "success")
        setDepositAmount("")
        await loadContractData(contract, usdtContract)
      } else {
        console.error("Transaction failed on-chain:", receipt)
        addToast("Deposit transaction failed on-chain. Check explorer for details.", "error")
      }
    } catch (error) {
      console.error("Deposit failed during submission or confirmation:", error)
      if (error && error.code === 4001) {
        addToast("Transaction cancelled by user", "warning")
      } else if (error && error.data && error.data.message) {
        addToast(`Deposit failed: ${error.data.message}`, "error")
      } else if (error && error.message) {
        addToast(`Deposit failed: ${error.message}`, "error")
      } else {
        addToast("Deposit failed. Please try again.", "error")
      }
    } finally {
      setTxLoading(false)
    }
  }

  const withdraw = async () => {
    console.log("=== WITHDRAW BUTTON CLICKED ===")
    console.log("Contract exists:", !!contract)
    console.log("txLoading:", txLoading)
    console.log("Rewards value:", rewards)
    console.log("Rewards parsed:", Number.parseFloat(rewards))

    if (!contract) {
      console.log("❌ No contract available")
      addToast("Contract not initialized", "error")
      return
    }

    if (txLoading) {
      console.log("❌ Transaction already in progress")
      return
    }

    // Check if user has rewards before attempting withdrawal
    if (Number.parseFloat(rewards) === 0) {
      addToast("No rewards available to withdraw", "warning")
      return
    }

    console.log("✅ Proceeding with withdrawal...")

    setTxLoading(true)
    try {
      addToast("Processing withdrawal...", "info")

      console.log("Calling withdrawRewards on contract...")
      console.log("Contract address:", contract.address)

      // Check if function exists
      if (!contract.withdrawRewards) {
        throw new Error("withdrawRewards function not found on contract")
      }

      // First try to estimate gas to catch revert early
      try {
        await contract.withdrawRewards.estimateGas()
      } catch (estimateError) {
        console.error("Gas estimation failed:", estimateError)

        // Handle common revert reasons
        if (
          estimateError.message.includes("missing revert data") ||
          estimateError.message.includes("CALL_EXCEPTION") ||
          estimateError.code === "CALL_EXCEPTION"
        ) {
          throw new Error("No rewards available to withdraw")
        } else if (estimateError.reason) {
          throw new Error(estimateError.reason)
        } else {
          throw new Error("Transaction would fail - likely no rewards available")
        }
      }

      const tx = await contract.withdrawRewards()
      console.log("✅ Transaction created:", tx)

      addToast("Transaction submitted. Waiting for confirmation...", "info")
      const receipt = await tx.wait()
      console.log("✅ Transaction receipt:", receipt)

      addToast("Rewards withdrawn successfully!", "success")
      await loadContractData(contract, usdtContract)
    } catch (error) {
      console.error("❌ Withdraw failed:", error)
      console.error("Error details:", {
        code: error.code,
        message: error.message,
        data: error.data,
        reason: error.reason,
      })

      // User-friendly error handling
      if (error && error.code === 4001) {
        addToast("Transaction cancelled by user", "warning")
      } else if (
        error.message.includes("No rewards available") ||
        error.message.includes("missing revert data") ||
        error.message.includes("CALL_EXCEPTION")
      ) {
        addToast("No rewards available to withdraw", "warning")
      } else if (error.reason) {
        addToast(`Withdrawal failed: ${error.reason}`, "error")
      } else if (error.message) {
        // Clean up technical error messages for mobile
        let cleanMessage = error.message
        if (cleanMessage.includes("missing revert data")) {
          cleanMessage = "No rewards available to withdraw"
        } else if (cleanMessage.includes("CALL_EXCEPTION")) {
          cleanMessage = "Transaction failed - likely no rewards available"
        } else if (cleanMessage.length > 100) {
          cleanMessage = "Withdrawal failed - please try again"
        }
        addToast(`Withdrawal failed: ${cleanMessage}`, "error")
      } else {
        addToast("Withdrawal failed. Please try again.", "error")
      }
    } finally {
      setTxLoading(false)
    }
  }

  const withdrawReferral = async () => {
    console.log("=== REFERRAL WITHDRAW BUTTON CLICKED ===")
    console.log("Contract exists:", !!contract)
    console.log("txLoading:", txLoading)
    console.log("Referral rewards value:", referralRewards)
    console.log("Referral rewards parsed:", Number.parseFloat(referralRewards))

    if (!contract) {
      console.log("❌ No contract available")
      addToast("Contract not initialized", "error")
      return
    }

    if (txLoading) {
      console.log("❌ Transaction already in progress")
      return
    }

    // Check if user has referral rewards before attempting withdrawal
    if (Number.parseFloat(referralRewards) === 0) {
      addToast("No referral rewards available to withdraw", "warning")
      return
    }

    console.log("✅ Proceeding with referral withdrawal...")

    setTxLoading(true)
    try {
      addToast("Processing referral withdrawal...", "info")

      console.log("Calling withdrawReferralRewards on contract...")
      console.log("Contract address:", contract.address)

      // Check if function exists
      if (!contract.withdrawReferralRewards) {
        throw new Error("withdrawReferralRewards function not found on contract")
      }

      // First try to estimate gas to catch revert early
      try {
        await contract.withdrawReferralRewards.estimateGas()
      } catch (estimateError) {
        console.error("Gas estimation failed:", estimateError)

        // Handle common revert reasons
        if (
          estimateError.message.includes("missing revert data") ||
          estimateError.message.includes("CALL_EXCEPTION") ||
          estimateError.code === "CALL_EXCEPTION"
        ) {
          throw new Error("No referral rewards available to withdraw")
        } else if (estimateError.reason) {
          throw new Error(estimateError.reason)
        } else {
          throw new Error("Transaction would fail - likely no referral rewards available")
        }
      }

      const tx = await contract.withdrawReferralRewards()
      console.log("✅ Transaction created:", tx)

      addToast("Transaction submitted. Waiting for confirmation...", "info")
      const receipt = await tx.wait()
      console.log("✅ Transaction receipt:", receipt)

      addToast("Referral rewards withdrawn successfully!", "success")
      await loadContractData(contract, usdtContract)
    } catch (error) {
      console.error("❌ Referral withdraw failed:", error)
      console.error("Error details:", {
        code: error.code,
        message: error.message,
        data: error.data,
        reason: error.reason,
      })

      // User-friendly error handling
      if (error && error.code === 4001) {
        addToast("Transaction cancelled by user", "warning")
      } else if (
        error.message.includes("No referral rewards available") ||
        error.message.includes("missing revert data") ||
        error.message.includes("CALL_EXCEPTION")
      ) {
        addToast("No referral rewards available to withdraw", "warning")
      } else if (error.reason) {
        addToast(`Referral withdrawal failed: ${error.reason}`, "error")
      } else if (error.message) {
        // Clean up technical error messages for mobile
        let cleanMessage = error.message
        if (cleanMessage.includes("missing revert data")) {
          cleanMessage = "No referral rewards available to withdraw"
        } else if (cleanMessage.includes("CALL_EXCEPTION")) {
          cleanMessage = "Transaction failed - likely no referral rewards available"
        } else if (cleanMessage.length > 100) {
          cleanMessage = "Referral withdrawal failed - please try again"
        }
        addToast(`Referral withdrawal failed: ${cleanMessage}`, "error")
      } else {
        addToast("Referral withdrawal failed. Please try again.", "error")
      }
    } finally {
      setTxLoading(false)
    }
  }

  const withdrawOldVaultRewards = async () => {
    if (!oldVaultContract || txLoading) return

    setTxLoading(true)
    try {
      addToast("Withdrawing V1 vault rewards...", "info")

      // First try to estimate gas to catch revert early
      try {
        await oldVaultContract.withdrawRewards.estimateGas()
      } catch (estimateError) {
        console.error("V1 vault gas estimation failed:", estimateError)

        // Handle common revert reasons
        if (
          estimateError.message.includes("missing revert data") ||
          estimateError.message.includes("CALL_EXCEPTION") ||
          estimateError.code === "CALL_EXCEPTION"
        ) {
          throw new Error("No V1 vault rewards available to withdraw")
        } else if (estimateError.reason) {
          throw new Error(estimateError.reason)
        } else {
          throw new Error("Transaction would fail - likely no V1 vault rewards available")
        }
      }

      const tx = await oldVaultContract.withdrawRewards()

      addToast("Transaction submitted. Waiting for confirmation...", "info")
      await tx.wait()

      addToast("V1 vault rewards withdrawn!", "success")
      await loadContractData(contract, usdtContract)
    } catch (error) {
      console.error("V1 vault withdraw failed:", error)

      // User-friendly error handling
      if (error && error.code === 4001) {
        addToast("Transaction cancelled by user", "warning")
      } else if (
        error.message.includes("No V1 vault rewards available") ||
        error.message.includes("missing revert data") ||
        error.message.includes("CALL_EXCEPTION")
      ) {
        addToast("No V1 vault rewards available to withdraw", "warning")
      } else if (error.reason) {
        addToast(`V1 vault withdrawal failed: ${error.reason}`, "error")
      } else if (error.message) {
        // Clean up technical error messages for mobile
        let cleanMessage = error.message
        if (cleanMessage.includes("missing revert data")) {
          cleanMessage = "No V1 vault rewards available to withdraw"
        } else if (cleanMessage.includes("CALL_EXCEPTION")) {
          cleanMessage = "Transaction failed - likely no V1 vault rewards available"
        } else if (cleanMessage.length > 100) {
          cleanMessage = "V1 vault withdrawal failed - please try again"
        }
        addToast(`V1 vault withdrawal failed: ${cleanMessage}`, "error")
      } else {
        addToast("V1 vault withdrawal failed. Please try again.", "error")
      }
    } finally {
      setTxLoading(false)
    }
  }

  const withdrawOldReferralRewards = async () => {
    if (!oldVaultContract || txLoading) return

    setTxLoading(true)
    try {
      addToast("Withdrawing V1 referral rewards...", "info")

      // First try to estimate gas to catch revert early
      try {
        await oldVaultContract.withdrawReferralRewards.estimateGas()
      } catch (estimateError) {
        console.error("V1 referral gas estimation failed:", estimateError)

        // Handle common revert reasons
        if (
          estimateError.message.includes("missing revert data") ||
          estimateError.message.includes("CALL_EXCEPTION") ||
          estimateError.code === "CALL_EXCEPTION"
        ) {
          throw new Error("No V1 referral rewards available to withdraw")
        } else if (estimateError.reason) {
          throw new Error(estimateError.reason)
        } else {
          throw new Error("Transaction would fail - likely no V1 referral rewards available")
        }
      }

      const tx = await oldVaultContract.withdrawReferralRewards()

      addToast("Transaction submitted. Waiting for confirmation...", "info")
      await tx.wait()

      addToast("V1 referral rewards withdrawn!", "success")
      await loadContractData(contract, usdtContract)
    } catch (error) {
      console.error("V1 referral withdraw failed:", error)

      // User-friendly error handling
      if (error && error.code === 4001) {
        addToast("Transaction cancelled by user", "warning")
      } else if (
        error.message.includes("No V1 referral rewards available") ||
        error.message.includes("missing revert data") ||
        error.message.includes("CALL_EXCEPTION")
      ) {
        addToast("No V1 referral rewards available to withdraw", "warning")
      } else if (error.reason) {
        addToast(`V1 referral withdrawal failed: ${error.reason}`, "error")
      } else if (error.message) {
        // Clean up technical error messages for mobile
        let cleanMessage = error.message
        if (cleanMessage.includes("missing revert data")) {
          cleanMessage = "No V1 referral rewards available to withdraw"
        } else if (cleanMessage.includes("CALL_EXCEPTION")) {
          cleanMessage = "Transaction failed - likely no V1 referral rewards available"
        } else if (cleanMessage.length > 100) {
          cleanMessage = "V1 referral withdrawal failed - please try again"
        }
        addToast(`V1 referral withdrawal failed: ${cleanMessage}`, "error")
      } else {
        addToast("V1 referral withdrawal failed. Please try again.", "error")
      }
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
    setShowReferralsModal(false)
    addToast("Wallet disconnected", "info")
  }

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
    )
  }

  return (
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
            <h3 className="card-title">Vault Balance</h3>
            <div className="balance-grid">
              <div className="balance-item">
                <span className="balance-label">Active Balance</span>
                <span className="balance-value">{formatAmount(vaultActiveAmount)} USDT</span>
              </div>
              <div className="balance-item">
                <span className="balance-label">Queued for Accrual</span>
                <span className="balance-value">{formatAmount(queuedBalance)} USDT</span>
              </div>

              {Number.parseFloat(vaultActiveAmount) > 0 && dailyRate !== "0" && (
                <div className="balance-item">
                  <span className="balance-label">Projected Daily Rewards</span>
                  <span className="balance-value">
                    {formatAmount(
                      ((Number.parseFloat(vaultActiveAmount) * Number.parseFloat(dailyRate)) / 1000).toString(),
                    )}{" "}
                    USDT
                  </span>
                </div>
              )}
              {Number.parseFloat(vaultActiveAmount) > 0 && timeUntilNextCycle > 0 && (
                <div className="balance-item">
                  <span className="balance-label">Next Accrual In</span>
                  <span className="balance-value">{formatCountdown(timeUntilNextCycle)}</span>
                </div>
              )}
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
              <div className="history-list">
                {history.map((item, index) => (
                  <div key={index} className="history-item">
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
          </div>

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
    </div>
  )
}
