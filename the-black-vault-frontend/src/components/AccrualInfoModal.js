"use client"

export default function AccrualInfoModal({ isOpen, onClose }) {
  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">
            <span className="modal-icon">⏰</span>
            Reward Accrual Timing
          </h3>
          <button className="modal-close" onClick={onClose} aria-label="Close modal">
            ×
          </button>
        </div>

        <div className="modal-body">
          <div
            style={{
              background: "#2a2a2a",
              border: "1px solid #404040",
              borderRadius: "12px",
              padding: "1rem",
              marginBottom: "1rem",
            }}
          >
            <h4 style={{ color: "#ffd700", fontSize: "1rem", fontWeight: "600", marginBottom: "0.75rem" }}>
              ⚡ Why Haven't I Received Rewards Yet?
            </h4>
            <p style={{ color: "#e0e0e0", fontSize: "0.9rem", lineHeight: "1.5", marginBottom: "0.75rem" }}>
              <strong>Rewards begin accruing 48 hours after your initial deposit.</strong> This delay is built into the smart contract to ensure system stability and prevent gaming.
            </p>
            <p style={{ color: "#e0e0e0", fontSize: "0.9rem", lineHeight: "1.5", marginBottom: "0.75rem" }}>
              Once the 48-hour period has passed, you'll earn rewards daily based on your total deposited amount.
            </p>
          </div>

          <div
            style={{
              background: "#2a2a2a",
              border: "1px solid #404040",
              borderRadius: "12px",
              padding: "1rem",
              marginBottom: "1rem",
            }}
          >
            <h4 style={{ color: "#00d4aa", fontSize: "1rem", fontWeight: "600", marginBottom: "0.75rem" }}>
              📊 Understanding Projected Daily Rewards
            </h4>
            <p style={{ color: "#e0e0e0", fontSize: "0.9rem", lineHeight: "1.5", marginBottom: "0.75rem" }}>
              The "Projected Daily Rewards" shown is calculated based on your <strong>total deposited amount</strong> and the current daily return rate (2.5% per day).
            </p>
            <p style={{ color: "#e0e0e0", fontSize: "0.9rem", lineHeight: "1.5", marginBottom: "0.75rem" }}>
              This is a <strong>projection</strong> of what you'll earn per day once rewards start accruing, not your current daily earnings.
            </p>
          </div>

          <div
            style={{
              background: "#2a2a2a",
              border: "1px solid #404040",
              borderRadius: "12px",
              padding: "1rem",
              marginBottom: "1rem",
            }}
          >
            <h4 style={{ color: "#ff6b6b", fontSize: "1rem", fontWeight: "600", marginBottom: "0.75rem" }}>
              🎯 ROI Calculation
            </h4>
            <p style={{ color: "#e0e0e0", fontSize: "0.9rem", lineHeight: "1.5", marginBottom: "0.75rem" }}>
              Your ROI percentage includes rewards from both your deposits <strong>and referral bonuses</strong>. This gives you a complete picture of your total returns.
            </p>
          </div>

          <div
            style={{
              background: "linear-gradient(135deg, rgba(255, 215, 0, 0.1), rgba(0, 212, 170, 0.1))",
              border: "1px solid rgba(255, 215, 0, 0.3)",
              borderRadius: "12px",
              padding: "1rem",
            }}
          >
            <h4 style={{ color: "#ffd700", fontSize: "1rem", fontWeight: "600", marginBottom: "0.75rem" }}>
              💡 Quick Summary
            </h4>
            <ul style={{ color: "#e0e0e0", fontSize: "0.9rem", lineHeight: "1.5", paddingLeft: "1.2rem" }}>
              <li style={{ marginBottom: "0.5rem" }}>Wait 48 hours after deposit for rewards to begin</li>
              <li style={{ marginBottom: "0.5rem" }}>Projected rewards are based on your total deposited amount</li>
              <li style={{ marginBottom: "0.5rem" }}>ROI includes both deposit rewards and referral bonuses</li>
              <li style={{ marginBottom: "0.5rem" }}>Rewards accrue daily once the delay period ends</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
