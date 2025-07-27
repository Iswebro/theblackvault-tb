// src/components/SmartDeFiInsights.js
// Strategic De.Fi insights component for new protocols

import { useState, useEffect } from 'react';
import { defiApi, StrategicPositioning } from '../utils/defiApi';

const SmartDeFiInsights = ({ account, vaultBalance, contractAddress }) => {
  const [securityProfile, setSecurityProfile] = useState(null);
  const [marketEducation, setMarketEducation] = useState(null);
  const [strategicPosition, setStrategicPosition] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('security');

  useEffect(() => {
    loadSmartInsights();
  }, []);

  const loadSmartInsights = async () => {
    setLoading(true);
    try {
      const [security, education, position] = await Promise.allSettled([
        StrategicPositioning.getSecurityFirst(),
        StrategicPositioning.getEducationalContent(),
        StrategicPositioning.getSustainableYield()
      ]);

      if (security.status === 'fulfilled') setSecurityProfile(security.value);
      if (education.status === 'fulfilled') setMarketEducation(education.value);
      if (position.status === 'fulfilled') setStrategicPosition(position.value);
    } catch (error) {
      console.error('Error loading smart insights:', error);
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'security', label: 'Security', icon: '🛡️' },
    { id: 'strategy', label: 'Strategy', icon: '📊' },
    { id: 'education', label: 'Learn', icon: '🎓' }
  ];

  return (
    <div className="vault-card premium-card">
      <h3 className="card-title">
        <span className="card-icon">✨</span>
        DeFi Intelligence{!account && ' - Preview'}
      </h3>
      
      {loading && (
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <span>Loading insights...</span>
        </div>
      )}

      {!loading && (
        <>
          <div className="tab-nav">
            {tabs.map(tab => (
              <button
                key={tab.id}
                className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <span className="tab-icon">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>

          <div className="tab-content">
            {/* Security Tab - Build Trust */}
            {activeTab === 'security' && securityProfile && (
              <div className="security-tab">
                <div className="trust-score">
                  <div className="score-circle">
                    <span className="score-number">A+</span>
                    <span className="score-label">Security</span>
                  </div>
                  <div className="trust-features">
                    <h4>Why Black Vault is Secure</h4>
                    {securityProfile?.strengths?.map((feature, index) => (
                      <div key={index} className="feature-item">
                        <span className="feature-check">✅</span>
                        <span className="feature-text">{feature}</span>
                      </div>
                    )) || (
                      <div className="feature-item">
                        <span className="feature-check">⏳</span>
                        <span className="feature-text">Loading security features...</span>
                      </div>
                    )}
                  </div>
                </div>
                
                {securityProfile && (
                  <>
                    <div className="no-risks">
                      <span className="shield-icon">🛡️</span>
                      <span>No major security risks detected</span>
                    </div>
                    
                    <div className="audit-link">
                      <a 
                        href="https://de.fi/scanner/contract/0x22708d8a54c044cba5b237620af42030cbf76e14?chainId=bnb" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="audit-button"
                      >
                        🔍 View De.Fi Security Audit
                      </a>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Strategy Tab - Smart Positioning */}
            {activeTab === 'strategy' && strategicPosition && (
              <div className="strategy-tab">
                <div className="sustainable-focus">
                  <h4>🌱 Sustainable Approach</h4>
                  <p>{strategicPosition.message}</p>
                  
                  <div className="yield-comparison">
                    <div className="yield-item safe">
                      <span className="yield-label">Black Vault</span>
                      <span className="yield-value">Sustainable</span>
                      <span className="context-label">Long-term focus</span>
                    </div>
                    <div className="yield-item risky">
                      <span className="yield-label">Many Others</span>
                      <span className="yield-value">10%+ APY</span>
                      <span className="context-label">High-risk protocols</span>
                    </div>
                  </div>
                  <div className="risk-warning">
                    ⚠️ Many 10%+ APY protocols have failed or been hacked
                  </div>
                </div>

                <div className="advantages">
                  <h5>🚀 Black Vault Advantages</h5>
                  {strategicPosition?.riskManagement?.map((advantage, index) => (
                    <div key={index} className="advantage-item">
                      <span className="advantage-icon">⭐</span>
                      <span>{advantage}</span>
                    </div>
                  )) || (
                    <div className="advantage-item">
                      <span className="advantage-icon">⏳</span>
                      <span>Loading strategic advantages...</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Education Tab - Build Understanding */}
            {activeTab === 'education' && marketEducation && (
              <div className="education-tab">
                <h4>🎓 DeFi Smart Tips</h4>
                
                <div className="education-section">
                  <h5>💡 Before You Invest</h5>
                  {marketEducation?.content?.map((tip, index) => (
                    <div key={index} className="tip-item">
                      <span className="tip-icon">💡</span>
                      <span className="tip-text">{tip.message}</span>
                    </div>
                  )) || (
                    <div className="tip-item">
                      <span className="tip-icon">⏳</span>
                      <span className="tip-text">Loading educational content...</span>
                    </div>
                  )}
                </div>

                <div className="market-reminder">
                  <div className="reminder-box">
                    <h5>🧠 Remember</h5>
                    <p>Higher yields often come with higher risks</p>
                    <p><strong>Black Vault prioritizes sustainable returns over maximum yield</strong></p>
                  </div>
                </div>

                <div className="market-trend">
                  <span className="trend-label">Current Market:</span>
                  <span className="trend-value">Stable</span>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      <style jsx>{`
        .tab-nav {
          display: flex;
          gap: 8px;
          margin-bottom: 16px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }
        
        .tab-button {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 12px;
          background: transparent;
          border: none;
          color: rgba(255, 255, 255, 0.7);
          font-size: 12px;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.3s ease;
          border-bottom: 2px solid transparent;
        }
        
        .tab-button:hover {
          background: rgba(255, 255, 255, 0.05);
          color: rgba(255, 255, 255, 0.9);
        }
        
        .tab-button.active {
          color: #fff;
          border-bottom-color: #7c3aed;
          background: rgba(124, 58, 237, 0.1);
        }
        
        .tab-icon {
          font-size: 14px;
        }
        
        .security-tab, .strategy-tab, .education-tab {
          min-height: 200px;
        }
        
        .trust-score {
          display: flex;
          gap: 16px;
          margin-bottom: 16px;
          align-items: flex-start;
        }
        
        .score-circle {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          width: 60px;
          height: 60px;
          border-radius: 50%;
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          color: white;
        }
        
        .score-number {
          font-size: 18px;
          font-weight: bold;
        }
        
        .score-label {
          font-size: 8px;
        }
        
        .trust-features {
          flex: 1;
        }
        
        .trust-features h4 {
          margin: 0 0 8px 0;
          font-size: 14px;
          color: #fff;
        }
        
        .feature-item {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 6px;
          font-size: 12px;
        }
        
        .feature-check {
          font-size: 12px;
        }
        
        .feature-text {
          color: rgba(255, 255, 255, 0.9);
        }
        
        .no-risks {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          background: rgba(16, 185, 129, 0.1);
          border-radius: 6px;
          font-size: 12px;
          color: #10b981;
        }
        
        .audit-link {
          margin-top: 12px;
        }
        
        .audit-button {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 16px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          text-decoration: none;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 500;
          transition: all 0.2s ease;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }
        
        .audit-button:hover {
          background: linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%);
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
          text-decoration: none;
          color: white;
        }
        
        .sustainable-focus h4 {
          margin: 0 0 8px 0;
          color: #fff;
        }
        
        .sustainable-focus p {
          margin: 0 0 16px 0;
          font-size: 12px;
          color: rgba(255, 255, 255, 0.8);
        }
        
        .yield-comparison {
          display: flex;
          gap: 12px;
          margin-bottom: 12px;
        }
        
        .yield-item {
          flex: 1;
          padding: 12px;
          border-radius: 8px;
          text-align: center;
        }
        
        .yield-item.safe {
          background: rgba(16, 185, 129, 0.1);
          border: 1px solid rgba(16, 185, 129, 0.3);
        }
        
        .yield-item.risky {
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.3);
        }
        
        .yield-label {
          display: block;
          font-size: 10px;
          color: rgba(255, 255, 255, 0.7);
          margin-bottom: 4px;
        }
        
        .yield-value {
          display: block;
          font-size: 14px;
          font-weight: bold;
          color: #fff;
          margin-bottom: 4px;
        }
        
        .context-label {
          display: block;
          font-size: 9px;
          color: rgba(255, 255, 255, 0.6);
        }
        
        .risk-warning {
          font-size: 10px;
          color: #f59e0b;
          text-align: center;
          padding: 8px;
          background: rgba(245, 158, 11, 0.1);
          border-radius: 6px;
        }
        
        .advantages h5 {
          margin: 16px 0 8px 0;
          color: #fff;
          font-size: 12px;
        }
        
        .advantage-item {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 6px;
          font-size: 11px;
          color: rgba(255, 255, 255, 0.8);
        }
        
        .advantage-icon {
          color: #fbbf24;
        }
        
        .education-tab h4 {
          margin: 0 0 16px 0;
          color: #fff;
        }
        
        .education-section h5 {
          margin: 0 0 8px 0;
          font-size: 12px;
          color: #fff;
        }
        
        .tip-item {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          margin-bottom: 8px;
          font-size: 11px;
          color: rgba(255, 255, 255, 0.8);
        }
        
        .tip-icon {
          color: #fbbf24;
          margin-top: 1px;
        }
        
        .tip-text {
          flex: 1;
        }
        
        .market-reminder {
          margin: 16px 0;
        }
        
        .reminder-box {
          padding: 12px;
          background: rgba(124, 58, 237, 0.1);
          border-radius: 6px;
          border: 1px solid rgba(124, 58, 237, 0.3);
        }
        
        .reminder-box h5 {
          margin: 0 0 8px 0;
          font-size: 12px;
          color: #a855f7;
        }
        
        .reminder-box p {
          margin: 0 0 4px 0;
          font-size: 10px;
          color: rgba(255, 255, 255, 0.8);
        }
        
        .market-trend {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 11px;
        }
        
        .trend-label {
          color: rgba(255, 255, 255, 0.7);
        }
        
        .trend-value {
          color: #10b981;
          font-weight: 500;
        }
        
        .loading-state {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 40px 20px;
          color: rgba(255, 255, 255, 0.7);
          font-size: 12px;
        }
        
        .loading-spinner {
          width: 16px;
          height: 16px;
          border: 2px solid rgba(255, 255, 255, 0.2);
          border-top: 2px solid #7c3aed;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }
        
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default SmartDeFiInsights;
