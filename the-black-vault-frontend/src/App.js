"use client"

import { useEffect, useState, useRef } from "react"
import { Contract, formatEther, parseEther } from "ethers"
import { connectInjected, getReferralFromURL } from "./connectWallet"
import { useToast, ToastContainer } from "./components/Toast"
import BlackVaultAbi from "./contract/BlackVaultABI.json"
import ERC20Abi from "./contract/ERC20Abi.json"
import "./App.css"
import HowItWorks from "./components/HowItWorks"
import Leaderboard from "./components/Leaderboard"
import ReferralsModal from "./components/ReferralsModal"

// Configuration is now read directly from environment variables here
const CONTRACT_ADDRESS = process.env.REACT_APP_CONTRACT_ADDRESS
const USDT_ADDRESS = process.env.REACT_APP_USDT_ADDRESS
const BLOCK_EXPLORER = process.env.REACT_APP_BLOCK_EXPLORER

export default function App() {
  // Connection & Account State
  const [provider, setProvider] = useState(null)
  const [signer, setSigner] = useState(null)
  const [account, setAccount] = useState("")

  // Contract State
  const [contract, setContract] = useState(null)
  const [usdtContract, setUsdtContract] = useState(null)

  // UI & Loading State
  const [isInitializing, setIsInitializing] = useState(false)
  const [txLoading, setTxLoading] = useState(false)
  const [showReferralsModal, setShowReferralsModal] = useState(false)
  const { toasts, addToast, removeToast } = useToast()
  const isManuallyDisconnected = useRef(false)

  // Data State
  const [balance, setBalance] = useState("0")
  const [usdtBalance, setUsdtBalance] = useState("0")
  const [depositAmount, setDepositAmount] = useState("")
  const [rewards, setRewards] = useState("0")
  const [referralRewards, setReferralRewards] = useState("0")
  const [referralAddress, setReferralAddress] = useState("")
  const [history, setHistory] = useState([])
  const [referralCount, setReferralCount] = useState(0)
  const [minDeposit, setMinDeposit] = useState("50")
  const [usdtAllowance, setUsdtAllowance] = useState("0")
  const [vaultActiveAmount, setVaultActiveAmount] = useState("0")

  // Get referral from URL on component mount
  useEffect(() => {
    const refFromURL = getReferralFromURL()
    if (refFromURL) {
      setReferralAddress(refFromURL)
    }
  }, [])

  // Main initialization effect. Runs once when the wallet is connected and account is set.
  useEffect(() => {
    const initializeApp = async () => {
      if (signer && account) {
        setIsInitializing(true)
        console.log("Initializing app for account:", account)

        try {
          // 1. Initialize contracts
          console.log("Creating contracts...")
          const vaultContract = new Contract(CONTRACT_ADDRESS, BlackVaultAbi, signer)
          const tokenContract = new Contract(USDT_ADDRESS, ERC20Abi, signer)

          // Test contract connectivity first
          console.log("Testing contract connectivity...")
          await vaultContract.paused() // Simple read call to test connection
          await tokenContract.decimals() // Simple read call to test USDT contract

          setContract(vaultContract)
          setUsdtContract(tokenContract)

          // 2. Load all data from contracts
          console.log("Loading contract data...")
          await loadAllContractData(provider, account, vaultContract, tokenContract)

          console.log("App initialization completed successfully")
        } catch (error) {
          console.error("Initialization failed:", error)

          // More specific error handling
          if (error.code === "NETWORK_ERROR") {
            addToast("Network connection failed. Please check your internet connection.", "error")
          } else if (error.code === "CALL_EXCEPTION") {
            addToast("Contract not found. Please check the contract address.", "error")
          } else if (error.message?.includes("network")) {
            addToast("Wrong network. Please switch to BSC Testnet.", "error")
          } else {
            addToast("Initialization failed. Please refresh and try again.", "error")
          }
        } finally {
          setIsInitializing(false)
        }
      }
    }
    initializeApp()
  }, [signer, account, provider, addToast])

  // Data loading function with better error handling
  const loadAllContractData = async (currentProvider, currentAccount, vault, usdt) => {
    console.log("Loading all contract data...")

    try {
      // Load basic wallet data first (these should always work)
      console.log("Loading wallet balances...")
      const userBnbBalance = await currentProvider.getBalance(currentAccount)
      setBalance(formatEther(userBnbBalance))

      const userUsdtBalance = await usdt.balanceOf(currentAccount)
      setUsdtBalance(formatEther(userUsdtBalance))

      const allowance = await usdt.allowance(currentAccount, CONTRACT_ADDRESS)
      setUsdtAllowance(formatEther(allowance))

      console.log("Wallet balances loaded successfully")

      // Load contract constants
      try {
        const minDepositValue = await vault.MIN_DEPOSIT()
        setMinDeposit(formatEther(minDepositValue))
      } catch (error) {
        console.warn("Could not load min deposit, using default:", error)
        setMinDeposit("50") // Fallback value
      }

      // Load user vault data (might fail for new users)
      try {
        console.log("Loading vault data...")
        const vaultData = await vault.getUserVault(currentAccount)
        setRewards(formatEther(vaultData.pendingRewards))
        setVaultActiveAmount(formatEther(vaultData.activeAmount))
        console.log("Vault data loaded successfully")
      } catch (error) {
        console.warn("Could not load vault data (user might be new):", error)
        setRewards("0")
        setVaultActiveAmount("0")
      }

      // Load referral data (might fail for users with no referrals)
      try {
        console.log("Loading referral data...")
        const refData = await vault.getUserReferralData(currentAccount)
        setReferralRewards(formatEther(refData.availableRewards))
        setReferralCount(refData.referredCount.toString())
        console.log("Referral data loaded successfully")
      } catch (error) {
        console.warn("Could not load referral data:", error)
        setReferralRewards("0")
        setReferralCount("0")
      }

      // Load history separately and don't fail if it doesn't work
      try {
        console.log("Loading transaction history...")
        await loadTransactionHistory(vault, currentProvider, currentAccount)
        console.log("Transaction history loaded successfully")
      } catch (error) {
        console.warn("Could not load transaction history:", error)
        setHistory([])
      }

      console.log("All contract data loaded successfully.")
    } catch (error) {
      console.error("Critical error loading contract data:", error)
      throw error // Re-throw to be caught by initialization
    }
  }

  const loadTransactionHistory = async (vault, currentProvider, userAccount) => {
    try {
      const depositFilter = vault.filters.Deposited(userAccount)
      const rewardsWithdrawFilter = vault.filters.RewardsWithdrawn(userAccount)
      const referralWithdrawFilter = vault.filters.ReferralRewardsWithdrawn(userAccount)

      const [depositEvents, rewardsWithdrawEvents, referralWithdrawEvents] = await Promise.all([
        vault
          .queryFilter(depositFilter, -10000)
          .catch(() => []), // Smaller range, with fallback
        vault.queryFilter(rewardsWithdrawFilter, -10000).catch(() => []),
        vault.queryFilter(referralWithdrawFilter, -10000).catch(() => []),
      ])

      const processEvent = async (event, type) => {
        try {
          const block = await currentProvider.getBlock(event.blockNumber)
          return {
            type,
            amount: formatEther(event.args.amount),
            time: new Date(block.timestamp * 1000),
            txHash: event.transactionHash,
          }
        } catch (error) {
          console.warn("Could not process event:", error)
          return null
        }
      }

      const allEvents = [
        ...depositEvents.map((e) => processEvent(e, "Deposit")),
        ...rewardsWithdrawEvents.map((e) => processEvent(e, "Rewards Withdrawn")),
        ...referralWithdrawEvents.map((e) => processEvent(e, "Referral Withdrawal")),
      ]

      const processedHistory = (await Promise.all(allEvents))
        .filter(Boolean) // Remove null entries
        .sort((a, b) => b.time - a.time)

      setHistory(processedHistory)
    } catch (error) {
      console.error("Error loading transaction history:", error)
      setHistory([])
    }
  }

  const connectWallet = async () => {
    setIsInitializing(true)
    try {
      isManuallyDisconnected.current = false
      console.log("Attempting wallet connection...")
      const conn = await connectInjected()
      console.log("Wallet connection successful, setting state...")
      setProvider(conn.provider)
      setSigner(conn.signer)
      setAccount(conn.account)
      addToast("Wallet connected successfully!", "success")
    } catch (error) {
      console.error("Connection failed:", error)
      addToast(error.message || "Failed to connect wallet", "error")
      setIsInitializing(false)
    }
  }

  const disconnect = () => {
    isManuallyDisconnected.current = true
    setProvider(null)
    setSigner(null)
    setAccount("")
    setContract(null)
    setUsdtContract(null)
    // Reset all data states
    setBalance("0")
    setUsdtBalance("0")
    setDepositAmount("")
    setRewards("0")
    setReferralRewards("0")
    setHistory([])
    setReferralCount(0)
    setMinDeposit("50")
    setUsdtAllowance("0")
    setVaultActiveAmount("0")
    addToast("Wallet disconnected", "info")
  }

  // Listen for account changes
  useEffect(() => {
    const handleAccountsChanged = (accounts) => {
      if (accounts.length === 0 && !isManuallyDisconnected.current) {
        disconnect()
      } else if (account && accounts[0].toLowerCase() !== account.toLowerCase()) {
        // Reset and reconnect with new account
        disconnect()
        connectWallet()
      }
    }
    if (window.ethereum) {
      window.ethereum.on("accountsChanged", handleAccountsChanged)
      return () => window.ethereum.removeListener("accountsChanged", handleAccountsChanged)
    }
  }, [account])

  const handleTransaction = async (txFunction, successMessage, errorMessage) => {
    setTxLoading(true)
    try {
      addToast("Submitting transaction...", "info")
      const tx = await txFunction()
      await tx.wait()
      addToast(successMessage, "success")
      // Reload all data after a successful transaction
      await loadAllContractData(provider, account, contract, usdtContract)
    } catch (error) {
      console.error(errorMessage, error)
      addToast(error.code === 4001 ? "Transaction cancelled" : errorMessage, "error")
    } finally {
      setTxLoading(false)
    }
  }

  const approveUsdt = () => {
    if (!usdtContract || !depositAmount || Number(depositAmount) <= 0) return
    const amountToApprove = parseEther(depositAmount)
    handleTransaction(() => usdtContract.approve(CONTRACT_ADDRESS, amountToApprove), "USDT Approved", "Approval Failed")
  }

  const deposit = () => {
    if (!contract || !depositAmount || Number(depositAmount) <= 0) return
    if (Number(usdtAllowance) < Number(depositAmount)) {
      addToast("Please approve USDT first", "warning")
      return
    }
    const value = parseEther(depositAmount)
    const txFunc =
      referralAddress && referralAddress !== "0x0000000000000000000000000000000000000000"
        ? () => contract.depositWithReferrer(value, referralAddress)
        : () => contract.deposit(value)
    handleTransaction(txFunc, "Deposit Successful", "Deposit Failed").then(() => setDepositAmount(""))
  }

  const withdraw = () => handleTransaction(() => contract.withdrawRewards(), "Rewards Withdrawn", "Withdrawal Failed")
  const withdrawReferral = () =>
    handleTransaction(() => contract.withdrawReferralRewards(), "Referral Rewards Withdrawn", "Withdrawal Failed")

  const formatAddress = (addr) => (addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : "")
  const formatAmount = (amount) => {
    const num = Number.parseFloat(amount)
    return isNaN(num) ? "0.00" : num.toFixed(4)
  }
  const handleMaxDeposit = () => setDepositAmount(usdtBalance)
  const getReferralLink = () => `${window.location.origin}${window.location.pathname}?ref=${account}`
  const copyReferralLink = () => {
    navigator.clipboard.writeText(getReferralLink())
    addToast("Referral link copied!", "success")
  }
  const needsApproval = Number(depositAmount) > 0 && Number(usdtAllowance) < Number(depositAmount)

  // Render logic
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
            <button className="connect-button premium-button" onClick={connectWallet} disabled={isInitializing}>
              {isInitializing ? (
                <>
                  <div className="loading-spinner"></div>Connecting...
                </>
              ) : (
                "Connect Wallet"
              )}
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (isInitializing) {
    return (
      <div className="app-container">
        <ToastContainer toasts={toasts} removeToast={removeToast} />
        <div className="connect-screen">
          <div className="connect-content">
            <div className="loading-spinner" style={{ width: "50px", height: "50px", margin: "0 auto 2rem" }}></div>
            <h2 style={{ color: "#e0e0e0" }}>Initializing App...</h2>
            <p style={{ color: "#a0a0a0" }}>Loading your vault data</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="app-container">
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
                <span className="balance-label">Active Deposit</span>
                <span className="balance-value">{formatAmount(vaultActiveAmount)} USDT</span>
              </div>
            </div>
          </div>

          <div className="vault-card premium-card">
            <h3 className="card-title">
              <span className="card-icon">💰</span>Make Deposit
            </h3>
            {referralAddress && referralAddress !== "0x0000000000000000000000000000000000000000" && (
              <div className="referral-info">
                <span className="referral-label">Referral:</span>
                <span className="referral-address">{formatAddress(referralAddress)}</span>
              </div>
            )}
            <div className="wallet-balance">
              <span className="balance-label">Wallet: {formatAmount(usdtBalance)} USDT</span>
              <button className="max-button" onClick={handleMaxDeposit}>
                Max
              </button>
            </div>
            <div className="input-group">
              <input
                type="number"
                className="vault-input premium-input"
                placeholder={`Min. ${formatAmount(minDeposit)} USDT`}
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
              />
              {needsApproval ? (
                <button className="vault-button premium-button primary" onClick={approveUsdt} disabled={txLoading}>
                  {txLoading ? (
                    <>
                      <div className="loading-spinner" /> Approving...
                    </>
                  ) : (
                    "Approve USDT"
                  )}
                </button>
              ) : (
                <button
                  className="vault-button premium-button primary"
                  onClick={deposit}
                  disabled={txLoading || !depositAmount || Number(depositAmount) <= 0}
                >
                  {txLoading ? (
                    <>
                      <div className="loading-spinner" /> Depositing...
                    </>
                  ) : (
                    "Deposit USDT"
                  )}
                </button>
              )}
            </div>
          </div>

          <div className="vault-card premium-card">
            <h3 className="card-title">
              <span className="card-icon">🎁</span>Vault Rewards
            </h3>
            <div className="reward-display">
              <span className="reward-amount">{formatAmount(rewards)} USDT</span>
              <span className="reward-label">Available to withdraw</span>
            </div>
            <button
              className="vault-button premium-button success"
              onClick={withdraw}
              disabled={txLoading || Number(rewards) === 0}
            >
              {txLoading ? "Processing..." : "Withdraw Rewards"}
            </button>
          </div>

          <div className="vault-card premium-card">
            <h3 className="card-title">
              <span className="card-icon">👥</span>Referral Rewards
            </h3>
            <div className="reward-display">
              <span className="reward-amount purple">{formatAmount(referralRewards)} USDT</span>
              <span className="reward-label">From referrals</span>
            </div>
            <div className="referral-stats">
              <span className="referral-label">Total Referrals:</span>
              <span className="referral-value">{referralCount}</span>
            </div>
            <div className="referral-actions">
              <button className="copy-link-button" onClick={copyReferralLink}>
                Copy Link
              </button>
              <button className="see-referrals-button" onClick={() => setShowReferralsModal(true)}>
                See Referrals
              </button>
            </div>
            <button
              className="vault-button premium-button purple"
              onClick={withdrawReferral}
              disabled={txLoading || Number(referralRewards) === 0}
            >
              {txLoading ? "Processing..." : "Withdraw Referral Rewards"}
            </button>
          </div>

          <div className="vault-card premium-card">
            <h3 className="card-title">
              <span className="card-icon">📊</span>Transaction History
            </h3>
            {history.length === 0 ? (
              <div className="empty-state">
                <p className="empty-message">No transactions yet</p>
              </div>
            ) : (
              <div className="history-list">
                {history.map((item, index) => (
                  <div key={index} className="history-item">
                    <div className="history-info">
                      <div className={`history-dot ${item.type.toLowerCase().replace(/\s+/g, "-")}`}></div>
                      <div className="history-details">
                        <span className="history-type">{item.type}</span>
                        <span className="history-time">{item.time.toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="history-amount">
                      <span className="amount-value">{formatAmount(item.amount)} USDT</span>
                      <a
                        href={`${BLOCK_EXPLORER}/tx/${item.txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="view-tx"
                      >
                        View on Explorer
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
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
