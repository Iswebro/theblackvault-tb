// src/components/ProjectIntroduction.js
import { ConnectButton } from '@rainbow-me/rainbowkit';

export default function ProjectIntroduction({ globalStats = null, onShowTroubleshooting, middleContent = null }) {
  // Use dynamic stats if available, otherwise fall back to defaults
  const totalVolume = globalStats?.totalDeposited || "2000+";
  const userCount = globalStats?.totalUsers || "10+";

  return (
    <div className="project-intro">
      {/* Quick Access Buttons for Regular Users */}
      <div className="quick-access-buttons">
        <div className="connect-button-top">
          <ConnectButton />
        </div>
        <button className="discreet-button" onClick={onShowTroubleshooting}>
          Troubleshooting & Network Info
        </button>
      </div>

      <div className="intro-hero">
        <h2 className="intro-title">
          The Future of <span className="text-gradient">USDT Staking</span> is Here
        </h2>
        <p className="intro-subtitle">
          Join <strong>Premium investors</strong> earning <strong>2.5% daily rewards</strong> on the most trusted DeFi platform on Binance Smart Chain
        </p>
      </div>

      <div className="intro-features">
        <div className="feature-highlight">
          <div className="feature-icon">🚀</div>
          <div className="feature-content">
            <h3>2.5% Daily Returns</h3>
            <p>Consistent, reliable rewards every 24 hours. No market volatility, no guesswork.</p>
          </div>
        </div>

        <div className="feature-highlight">
          <div className="feature-icon">🔐</div>
          <div className="feature-content">
            <h3>Smart Contract Security</h3>
            <p>Audited, transparent, and immutable. Your funds are protected by blockchain technology.</p>
          </div>
        </div>

        <div className="feature-highlight">
          <div className="feature-icon">💎</div>
          <div className="feature-content">
            <h3>Premium Referral System</h3>
            <p>Earn 10% bonus on referrals. Build passive income streams that compound over time.</p>
          </div>
        </div>
      </div>

      <div className="intro-stats">
        <div className="stat-item">
          <div className="stat-number">${totalVolume} USDT</div>
          <div className="stat-label">Total Volume</div>
        </div>
        <div className="stat-item">
          <div className="stat-number">2.5%</div>
          <div className="stat-label">Daily Rate</div>
        </div>
        <div className="stat-item">
          <div className="stat-number">50 USDT</div>
          <div className="stat-label">Min. Deposit</div>
        </div>
        <div className="stat-item">
          <div className="stat-number">24/7</div>
          <div className="stat-label">Availability</div>
        </div>
      </div>

      <div className="intro-benefits">
        <h3 className="benefits-title">What Makes Black Vault Different?</h3>
        <div className="benefits-grid">
          <div className="benefit-item">
            <span className="benefit-icon">✅</span>
            <span className="benefit-text">No hidden fees or complex mechanics</span>
          </div>
          <div className="benefit-item">
            <span className="benefit-icon">✅</span>
            <span className="benefit-text">Instant reward withdrawals anytime</span>
          </div>
          <div className="benefit-item">
            <span className="benefit-icon">✅</span>
            <span className="benefit-text">Transparent smart contract operations</span>
          </div>
          <div className="benefit-item">
            <span className="benefit-icon">✅</span>
            <span className="benefit-text">Built for long-term sustainability</span>
          </div>
          <div className="benefit-item">
            <span className="benefit-icon">✅</span>
            <span className="benefit-text">Community-driven development</span>
          </div>
          <div className="benefit-item">
            <span className="benefit-icon">✅</span>
            <span className="benefit-text">BSC network for low transaction costs</span>
          </div>
        </div>
      </div>

      <div className="intro-timeline">
        <h3 className="timeline-title">Your Journey to Financial Freedom</h3>
        <div className="timeline-steps">
          <div className="timeline-step">
            <div className="step-number">1</div>
            <div className="step-content">
              <h4>Connect & Deposit</h4>
              <p>Connect your wallet and deposit minimum 50 USDT to get started</p>
            </div>
          </div>
          <div className="timeline-step">
            <div className="step-number">2</div>
            <div className="step-content">
              <h4>Wait 2 Days (Cycles)</h4>
              <p>Your deposit activates after 2 complete cycles for fair distribution</p>
            </div>
          </div>
          <div className="timeline-step">
            <div className="step-number">3</div>
            <div className="step-content">
              <h4>Earn Daily Rewards</h4>
              <p>Receive 2.5% daily returns on your active balance, every 24 hours</p>
            </div>
          </div>
          <div className="timeline-step">
            <div className="step-number">4</div>
            <div className="step-content">
              <h4>Withdraw Anytime</h4>
              <p>Access your rewards instantly, whenever you need them</p>
            </div>
          </div>
        </div>
      </div>

      {/* Inject middle content here (e.g., DeFi Intelligence) */}
      {middleContent}

      <div className="intro-cta">
        <h3 className="cta-title">Ready to Start Earning?</h3>
        <p className="cta-subtitle">
          Join our community of smart investors and start building your passive income today.
          <br />
          <strong>Connect your wallet below to begin your journey!</strong>
        </p>
      </div>
    </div>
  );
}
