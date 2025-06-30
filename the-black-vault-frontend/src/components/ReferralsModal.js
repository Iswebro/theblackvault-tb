"use client"

import { useState, useEffect } from "react"

export default function ReferralsModal({ isOpen, onClose, contract, account, formatAddress }) {
  const [referrals, setReferrals] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isOpen && contract && account) {
      loadReferrals()
    }
  }, [isOpen, contract, account])

  const loadReferrals = async () => {
    if (!contract || !account) return

    setLoading(true)
    try {
      // Get all deposit events where this user is the referrer
      const depositFilter = contract.filters.Deposited(null, null, account)
      const depositEvents = await contract.queryFilter(depositFilter, -50000) // Last 50k blocks

      // Extract unique referee addresses
      const uniqueReferees = [...new Set(depositEvents.map((event) => event.args.user.toLowerCase()))]

      // Get bonus info for each referee
      const referralData = await Promise.all(
        uniqueReferees.map(async (refereeAddress) => {
          try {
            const bonusInfo = await contract.getReferralBonusInfo(account, refereeAddress)
            return {
              address: refereeAddress,
              bonusesUsed: bonusInfo.bonusesUsed.toString(),
              bonusesRemaining: bonusInfo.bonusesRemaining.toString(),
            }
          } catch (error) {
            console.error(`Error getting bonus info for ${refereeAddress}:`, error)
            return {
              address: refereeAddress,
              bonusesUsed: "0",
              bonusesRemaining: "3",
            }
          }
        }),
      )

      setReferrals(referralData)
    } catch (error) {
      console.error("Error loading referrals:", error)
      setReferrals([])
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">
            <span className="modal-icon">👥</span>
            Your Referrals
          </h3>
          <button className="modal-close" onClick={onClose} aria-label="Close modal">
            ×
          </button>
        </div>

        <div className="modal-body">
          {loading ? (
            <div className="modal-loading">
              <div className="loading-spinner"></div>
              <p>Loading referrals...</p>
            </div>
          ) : referrals.length === 0 ? (
            <div className="modal-empty">
              <p className="empty-message">No referrals yet</p>
              <p className="empty-submessage">Share your referral link to start earning bonuses!</p>
            </div>
          ) : (
            <div className="referrals-list">
              <div className="referrals-header">
                <span className="referral-col-address">Address</span>
                <span className="referral-col-bonuses">Bonuses Remaining</span>
              </div>
              {referrals.map((referral, index) => (
                <div key={index} className="referral-row">
                  <span className="referral-address">{formatAddress(referral.address)}</span>
                  <span className="referral-bonuses">{referral.bonusesRemaining}/3</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
