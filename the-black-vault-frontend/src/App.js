"use client"

import { useEffect, useState } from "react"
import { Contract, formatEther, parseEther } from "ethers"
import { connectInjected, getReferralFromURL } from "./connectWallet"
import { useToast, ToastContainer } from "./components/Toast"
import BlackVaultAbi from "./contract/BlackVaultABI.json"
import logo from "./logo.svg"
import "./App.css"

const CONTRACT_ADDRESS = process.env.REACT_APP_CONTRACT_ADDRESS || "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9"

export default function App() {
  const [provider, setProvider] = useState(null)
  const [signer, setSigner] = useState(null)
  const [account, setAccount] = useState("")
  const [contract, setContract] = useState(null)

  const [balance, setBalance] = useState("0")
  const [depositAmount, setDepositAmount] = useState("")
  const [rewards, setRewards] = useState("0")
  const [referralRewards, setReferralRewards] = useState("0")
  const [referralAddress, setReferralAddress] = useState("")
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(false)
  const [txLoading, setTxLoading] = useState(false)

  const { toasts, addToast, removeToast } = useToast()

  // Get referral from URL on component mount
  useEffect(() => {
    const refFromURL = getReferralFromURL()
    setReferralAddress(refFromURL)
  }, [])

  // Initialize contract when wallet connects
  useEffect(() => {
    if (signer && account && provider) {
      initializeContract()
    }
  }, [signer, account, provider])

  // Listen for account changes
  useEffect(() => {
    if (window.ethereum) {
      const handleAccountsChanged = (accounts) => {
        if (accounts.length === 0) {
          disconnect()
        } else if (account && accounts[0] !== account) {
          setAccount(accounts[0])
          addToast("Account switched", "info")
        }
      }

      const handleChainChanged = () => {
        window.location.reload()
      }

      window.ethereum.on("accountsChanged", handleAccountsChanged)
      window.ethereum.on("chainChanged", handleChainChanged)

      return () => {
        if (window.ethereum.removeListener) {
          window.ethereum.removeListener("accountsChanged", handleAccountsChanged)
          window.ethereum.removeListener("chainChanged", handleChainChanged)
        }
      }
    }
  }, [account, addToast])

  const initializeContract = async () => {
    try {
      const vault = new Contract(CONTRACT_ADDRESS, BlackVaultAbi, signer)
      setContract(vault)
      await loadContractData(vault)
    } catch (error) {
      console.error("Error initializing contract:", error)
      addToast("Error connecting to contract", "error")
    }
  }

  const loadContractData = async (vault = contract) => {
    if (!vault || !provider || !account) return

    try {
      // Load balance
      const userBalance = await provider.getBalance(account)
      setBalance(formatEther(userBalance))

      // Load vault rewards
      try {
        const vaultData = await vault.vault(account)
        setRewards(formatEther(vaultData.rewards || vaultData))
      } catch (error) {
        console.log("No vault data found for user")
        setRewards("0")
      }

      // Load referral rewards
      try {
        const refRewards = await vault.referralRewards(account)
        setReferralRewards(formatEther(refRewards))
      } catch (error) {
        console.log("No referral rewards found")
        setReferralRewards("0")
      }

      // Load transaction history
      await loadTransactionHistory(vault)
    } catch (error) {
      console.error("Error loading contract data:", error)
      addToast("Error loading data from contract", "error")
    }
  }

  const loadTransactionHistory = async (vault = contract) => {
    if (!vault || !provider || !account) return

    try {
      const [deposits, withdrawals] = await Promise.all([
        vault.queryFilter(vault.filters.Deposited(account), -10000).catch(() => []),
        vault.queryFilter(vault.filters.Withdrawn(account), -10000).catch(() => []),
      ])

      const events = []

      // Process deposits
      for (const event of deposits) {
        try {
          const block = await provider.getBlock(event.blockNumber)
          if (block && event.args) {
            events.push({
              type: "Deposit",
              amount: formatEther(event.args.amount || event.args[1]),
              time: new Date(block.timestamp * 1000),
              txHash: event.transactionHash,
            })
          }
        } catch (err) {
          console.log("Error processing deposit event:", err)
        }
      }

      // Process withdrawals
      for (const event of withdrawals) {
        try {
          const block = await provider.getBlock(event.blockNumber)
          if (block && event.args) {
            events.push({
              type: "Withdrawal",
              amount: formatEther(event.args.amount || event.args[1]),
              time: new Date(block.timestamp * 1000),
              txHash: event.transactionHash,
            })
          }
        } catch (err) {
          console.log("Error processing withdrawal event:", err)
        }
      }

      events.sort((a, b) => b.time - a.time)
      setHistory(events)
    } catch (error) {
      console.error("Error loading transaction history:", error)
    }
  }

  const connectWallet = async () => {
    if (loading) return

    setLoading(true)
    try {
      const conn = await connectInjected()
      setProvider(conn.provider)
      setSigner(conn.signer)
      setAccount(conn.account)
      addToast("Wallet connected successfully!", "success")
    } catch (error) {
      console.error("Connection failed:", error)
      addToast(error.message || "Failed to connect wallet", "error")
    } finally {
      setLoading(false)
    }
  }

  const deposit = async () => {
    if (!contract || !depositAmount || txLoading) return

    setTxLoading(true)
    try {
      addToast("Processing deposit...", "info")
      const tx = await contract.deposit(referralAddress, {
        value: parseEther(depositAmount),
      })

      addToast("Transaction submitted. Waiting for confirmation...", "info")
      await tx.wait()

      addToast("Deposit successful!", "success")
      setDepositAmount("")
      await loadContractData()
    } catch (error) {
      console.error("Deposit failed:", error)
      if (error.code === 4001) {
        addToast("Transaction cancelled by user", "warning")
      } else {
        addToast("Deposit failed. Please try again.", "error")
      }
    } finally {
      setTxLoading(false)
    }
  }

  const withdraw = async () => {
    if (!contract || txLoading) return

    setTxLoading(true)
    try {
      addToast("Processing withdrawal...", "info")
      const tx = await contract.withdraw()

      addToast("Transaction submitted. Waiting for confirmation...", "info")
      await tx.wait()

      addToast("Rewards withdrawn successfully!", "success")
      await loadContractData()
    } catch (error) {
      console.error("Withdraw failed:", error)
      if (error.code === 4001) {
        addToast("Transaction cancelled by user", "warning")
      } else {
        addToast("Withdrawal failed. Please try again.", "error")
      }
    } finally {
      setTxLoading(false)
    }
  }

  const withdrawReferral = async () => {
    if (!contract || txLoading) return

    setTxLoading(true)
    try {
      addToast("Processing referral withdrawal...", "info")
      const tx = await contract.withdrawReferralEarnings()

      addToast("Transaction submitted. Waiting for confirmation...", "info")
      await tx.wait()

      addToast("Referral rewards withdrawn successfully!", "success")
      await loadContractData()
    } catch (error) {
      console.error("Referral withdraw failed:", error)
      if (error.code === 4001) {
        addToast("Transaction cancelled by user", "warning")
      } else {
        addToast("Referral withdrawal failed. Please try again.", "error")
      }
    } finally {
      setTxLoading(false)
    }
  }

  const disconnect = () => {
    setProvider(null)
    setSigner(null)
    setAccount("")
    setContract(null)
    setBalance("0")
    setRewards("0")
    setReferralRewards("0")
    setHistory([])
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
    return num.toFixed(6)
  }

  if (!account) {
    return (
      <div className="app-container">
        {/* Premium Background */}
        <div className="premium-background">
          <div className="bg-grid"></div>
          <div className="bg-gradient-1"></div>
          <div className="bg-gradient-2"></div>
          <div className="bg-particles"></div>
        </div>

        <ToastContainer toasts={toasts} removeToast={removeToast} />

        <div className="connect-screen">
          <div className="connect-content">
            {/* Your Logo */}
            <div className="logo-container">
              <div className="premium-logo-wrapper">
                <img src={logo || "/placeholder.svg"} alt="Black Vault Logo" className="premium-logo-img" />
                <div className="logo-glow"></div>
              </div>
            </div>

            {/* Premium Title */}
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
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="app-container">
      {/* Premium Background */}
      <div className="premium-background">
        <div className="bg-grid"></div>
        <div className="bg-gradient-1"></div>
        <div className="bg-gradient-2"></div>
        <div className="bg-particles"></div>
      </div>

      <ToastContainer toasts={toasts} removeToast={removeToast} />

      <div className="main-interface">
        {/* Header */}
        <div className="header">
          <div className="header-logo">
            <img src={logo || "/placeholder.svg"} alt="Black Vault" className="mini-logo-img" />
            <span className="header-title">BLACK VAULT</span>
          </div>
          <div className="header-account">
            <span className="account-label">Connected</span>
            <span className="account-address">{formatAddress(account)}</span>
          </div>
        </div>

        {/* Main Content */}
        <div className="vault-interface">
          {/* Balance Card */}
          <div className="vault-card premium-card">
            <h3 className="card-title">Account Balance</h3>
            <div className="balance-grid">
              <div className="balance-item">
                <span className="balance-label">BNB Balance</span>
                <span className="balance-value">{formatAmount(balance)} BNB</span>
              </div>
            </div>
          </div>

          {/* Deposit Card */}
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

            <div className="input-group">
              <input
                type="number"
                className="vault-input premium-input"
                placeholder="0.0"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                step="0.001"
                min="0"
              />
              <button
                className="vault-button premium-button primary"
                onClick={deposit}
                disabled={txLoading || !depositAmount || Number.parseFloat(depositAmount) <= 0}
              >
                {txLoading ? (
                  <>
                    <div className="loading-spinner"></div>
                    Processing...
                  </>
                ) : (
                  "Deposit BNB"
                )}
              </button>
            </div>
          </div>

          {/* Vault Rewards */}
          <div className="vault-card premium-card">
            <h3 className="card-title">
              <span className="card-icon">🎁</span>
              Vault Rewards
            </h3>
            <div className="reward-display">
              <span className="reward-amount">{formatAmount(rewards)} BNB</span>
              <span className="reward-label">Available to withdraw</span>
            </div>
            <button
              className="vault-button premium-button success"
              onClick={withdraw}
              disabled={txLoading || Number.parseFloat(rewards) === 0}
            >
              {txLoading ? "Processing..." : "Withdraw Rewards"}
            </button>
          </div>

          {/* Referral Rewards */}
          <div className="vault-card premium-card">
            <h3 className="card-title">
              <span className="card-icon">👥</span>
              Referral Rewards
            </h3>
            <div className="reward-display">
              <span className="reward-amount purple">{formatAmount(referralRewards)} BNB</span>
              <span className="reward-label">From referrals</span>
            </div>
            <button
              className="vault-button premium-button purple"
              onClick={withdrawReferral}
              disabled={txLoading || Number.parseFloat(referralRewards) === 0}
            >
              {txLoading ? "Processing..." : "Withdraw Referral"}
            </button>
          </div>

          {/* Transaction History */}
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
                      <div className={`history-dot ${item.type.toLowerCase()}`}></div>
                      <div className="history-details">
                        <span className="history-type">{item.type}</span>
                        <span className="history-time">
                          {item.time.toLocaleDateString()} {item.time.toLocaleTimeString()}
                        </span>
                      </div>
                    </div>
                    <div className="history-amount">
                      <span className="amount-value">{formatAmount(item.amount)} BNB</span>
                      <a
                        href={`${process.env.REACT_APP_BLOCK_EXPLORER}/tx/${item.txHash}`}
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

          {/* Disconnect Button */}
          <div className="disconnect-section">
            <button onClick={disconnect} className="disconnect-button">
              Disconnect Wallet
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
