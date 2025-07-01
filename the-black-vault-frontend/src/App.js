"use client"

import { useEffect, useState, useRef } from "react"
import { Contract, formatEther, parseEther } from "ethers"
import { connectInjected, getReferralFromURL } from "./connectWallet"
// Configuration object - inline to avoid import issues
const config = {
  CONTRACT_ADDRESS: process.env.REACT_APP_CONTRACT_ADDRESS || "0x08b7fCcb9c92cB3C6A3279Bc377F461fD6fD97A1",
  USDT_ADDRESS: process.env.REACT_APP_USDT_ADDRESS || "0x337610d27c682E347C9cD60BD4b3b107C9d34dDd",
  CHAIN_ID: Number.parseInt(process.env.REACT_APP_CHAIN_ID || "97"),
  CHAIN_NAME: process.env.REACT_APP_CHAIN_NAME || "BSC Testnet",
  RPC_URL: process.env.REACT_APP_RPC_URL || "https://data-seed-prebsc-1-s1.binance.org:8545",
  BLOCK_EXPLORER: process.env.REACT_APP_BLOCK_EXPLORER || "https://testnet.bscscan.com",
}
import { useToast, ToastContainer } from "./components/Toast"
import BlackVaultAbi from "./contract/BlackVaultABI.json"
import ERC20Abi from "./contract/ERC20Abi.json"
import "./App.css"
import HowItWorks from "./components/HowItWorks"
import Leaderboard from "./components/Leaderboard"
import ReferralsModal from "./components/ReferralsModal"

export default function App() {
  // Connection & Account State
  const [provider, setProvider] = useState(null)
  const [signer, setSigner] = useState(null)
  const [account, setAccount] = useState("")

  // Contract State
  const [contract, setContract] = useState(null)
  const [usdtContract, setUsdtContract] = useState(null)

  // UI & Loading State
  const [connecting, setConnecting] = useState(false)
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
  const [minDeposit, setMinDeposit] = useState("0")
  const [usdtAllowance, setUsdtAllowance] = useState("0")
  const [vaultActiveAmount, setVaultActiveAmount] = useState("0")

  // Get referral from URL on component mount
  useEffect(() => {
    const refFromURL = getReferralFromURL()
    if (refFromURL) {
      setReferralAddress(refFromURL)
    }
  }, [])

  // Initialize contracts and load data when wallet is connected
  useEffect(() => {
    if (signer && account) {
      initializeContracts()
    }
  }, [signer, account])

  const initializeContracts = async () => {
    try {
      console.log("Initializing contracts...")
      const vaultContract = new Contract(config.CONTRACT_ADDRESS, BlackVaultAbi, signer)
      const tokenContract = new Contract(config.USDT_ADDRESS, ERC20Abi, signer)

      setContract(vaultContract)
      setUsdtContract(tokenContract)

      // Load all data
      await loadContractData(vaultContract, tokenContract)
    } catch (error) {
      console.error("Contract initialization failed:", error)
      addToast("Failed to initialize contracts", "error")
    }
  }

  const loadContractData = async (vaultContract, tokenContract) => {
    try {
      console.log("Loading contract data...")

      // Load wallet balances
      const userBnbBalance = await provider.getBalance(account)
      const userUsdtBalance = await tokenContract.balanceOf(account)
      const allowance = await tokenContract.allowance(account, config.CONTRACT_ADDRESS)

      setBalance(formatEther(userBnbBalance))
      setUsdtBalance(formatEther(userUsdtBalance))
      setUsdtAllowance(formatEther(allowance))

      // Load contract constants
      try {
        const minDepositValue = await vaultContract.MIN_DEPOSIT()
        setMinDeposit(formatEther(minDepositValue))
      } catch (error) {
        console.warn("Could not load min deposit:", error)
        setMinDeposit("50")
      }

      // Load user vault data
      try {
        const vaultData = await vaultContract.getUserVault(account)
        setRewards(formatEther(vaultData.pendingRewards))
        setVaultActiveAmount(formatEther(vaultData.activeAmount))
      } catch (error) {
        console.warn("Could not load vault data:", error)
        setRewards("0")
        setVaultActiveAmount("0")
      }

      // Load referral data
      try {
        const refData = await vaultContract.getUserReferralData(account)
        setReferralRewards(formatEther(refData.availableRewards))
        setReferralCount(refData.referredCount.toString())
      } catch (error) {
        console.warn("Could not load referral data:", error)
        setReferralRewards("0")
        setReferralCount("0")
      }

      // Load transaction history
      loadTransactionHistory(vaultContract)

      console.log("Contract data loaded successfully")
    } catch (error) {
      console.error("Error loading contract data:", error)
      addToast("Error loading data", "error")
    }
  }

  const loadTransactionHistory = async (vaultContract) => {
    try {
      const depositFilter = vaultContract.filters.Deposited(account)
      const rewardsWithdrawFilter = vaultContract.filters.RewardsWithdrawn(account)
      const referralWithdrawFilter = vaultContract.filters.ReferralRewardsWithdrawn(account)

      const [depositEvents, rewardsWithdrawEvents, referralWithdrawEvents] = await Promise.all([
        vaultContract.queryFilter(depositFilter, -50000),
        vaultContract.queryFilter(rewardsWithdrawFilter, -50000),
        vaultContract.queryFilter(referralWithdrawFilter, -50000),
      ])

      const processEvent = async (event, type) => {
        const block = await provider.getBlock(event.blockNumber)
        return {
          type,
          amount: formatEther(event.args.amount),
          time: new Date(block.timestamp * 1000),
          txHash: event.transactionHash,
        }
      }

      const allEvents = [
        ...depositEvents.map((e) => processEvent(e, "Deposit")),
        ...rewardsWithdrawEvents.map((e) => processEvent(e, "Rewards Withdrawn")),
        ...referralWithdrawEvents.map((e) => processEvent(e, "Referral Withdrawal")),
      ]

      const processedHistory = (await Promise.all(allEvents)).sort((a, b) => b.time - a.time)
      setHistory(processedHistory)
    } catch (error) {
      console.error("Error loading transaction history:", error)
    }
  }

  const connectWallet = async () => {
    setConnecting(true)
    try {
      isManuallyDisconnected.current = false
      const conn = await connectInjected()
      setProvider(conn.provider)
      setSigner(conn.signer)
      setAccount(conn.account)
      addToast("Wallet connected successfully!", "success")
    } catch (error) {
      console.error("Connection failed:", error)
      addToast(error.message || "Failed to connect wallet", "error")
    } finally {
      setConnecting(false)
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
    setMinDeposit("0")
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
      // Reload data after successful transaction
      await loadContractData(contract, usdtContract)
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
    handleTransaction(
      () => usdtContract.approve(config.CONTRACT_ADDRESS, amountToApprove),
      "USDT Approved",
      "Approval Failed",
    )
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
            <button className="connect-button premium-button" onClick={connectWallet} disabled={connecting}>
              {connecting ? (
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
                        href={`${config.BLOCK_EXPLORER}/tx/${item.txHash}`}
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
