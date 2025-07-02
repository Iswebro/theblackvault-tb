"use client"

export default function TroubleshootingModal({ isOpen, onClose }) {
  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">
            <span className="modal-icon">💡</span>
            Troubleshooting & Network Info
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
            <p style={{ color: "#e0e0e0", fontSize: "0.9rem", fontWeight: "600", marginBottom: "0.5rem" }}>
              📱 For Trust Wallet Users:
            </p>
            <p style={{ color: "#a0a0a0", fontSize: "0.8rem", lineHeight: "1.4" }}>
              1. Open Trust Wallet app
              <br />
              2. Tap "Browser" tab at bottom
              <br />
              3. Enter this website URL
              <br />
              4. Ensure BSC Mainnet is selected
              <br />
              5. Tap "Connect Wallet"
            </p>
          </div>

          <div
            style={{
              background: "#2a2a2a",
              border: "1px solid #404040",
              borderRadius: "12px",
              padding: "1rem",
            }}
          >
            <p style={{ color: "#e0e0e0", fontSize: "0.9rem", fontWeight: "600", marginBottom: "0.5rem" }}>
              🌐 BSC Network Settings:
            </p>
            <p style={{ color: "#a0a0a0", fontSize: "0.8rem", lineHeight: "1.4" }}>
              Network: Smart Chain
              <br />
              Chain ID: 56
              <br />
              RPC: https://bsc-dataseed.binance.org/
              <br />
              Symbol: BNB
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
