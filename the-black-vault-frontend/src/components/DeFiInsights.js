// src/components/DeFiInsights.js
// Enhanced analytics component using De.Fi API

import { useState, useEffect } from 'react';
import { blackVaultDefiUtils } from '../utils/defiApi';

const DeFiInsights = ({ account, vaultBalance, contractAddress }) => {
  const [insights, setInsights] = useState(null);
  const [security, setSecurity] = useState(null);
  const [marketComparison, setMarketComparison] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showInsights, setShowInsights] = useState(false);

  useEffect(() => {
    if (account && showInsights) {
      loadDeFiInsights();
    }
  }, [account, showInsights, vaultBalance]);

  const loadDeFiInsights = async () => {
    if (loading) return;
    setLoading(true);

    try {
      // Load multiple insights in parallel
      const [portfolioData, securityData, marketData] = await Promise.allSettled([
        blackVaultDefiUtils.getEnhancedPortfolio(account, vaultBalance),
        blackVaultDefiUtils.getVaultSecurityScore(contractAddress),
        blackVaultDefiUtils.getMarketComparison()
      ]);

      if (portfolioData.status === 'fulfilled') {
        setInsights(portfolioData.value);
      }

      if (securityData.status === 'fulfilled') {
        setSecurity(securityData.value);
      }

      if (marketData.status === 'fulfilled') {
        setMarketComparison(marketData.value);
      }
    } catch (error) {
      console.error('Error loading De.Fi insights:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!showInsights) {
    return (
      <div className="vault-card premium-card">
        <h3 className="card-title">
          <span className="card-icon">📈</span>
          DeFi Analytics
        </h3>
        <div className="empty-state">
          <p className="empty-message">Enhanced Portfolio Analytics</p>
          <p className="empty-submessage">Get insights powered by De.Fi API</p>
          <button
            className="vault-button premium-button"
            onClick={() => setShowInsights(true)}
            style={{ marginTop: "12px" }}
          >
            Load DeFi Insights
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="vault-card premium-card">
      <h3 className="card-title">
        <span className="card-icon">📈</span>
        DeFi Analytics
        <button 
          className="minimize-button"
          onClick={() => setShowInsights(false)}
          style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#888', cursor: 'pointer' }}
        >
          ×
        </button>
      </h3>

      {loading ? (
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <span>Loading De.Fi insights...</span>
        </div>
      ) : (
        <div className="defi-insights">
          {/* Security Score */}
          {security && (
            <div className="insight-section">
              <h4 className="insight-title">🛡️ Security Analysis</h4>
              <div className="security-score">
                <div className="score-display">
                  <span className="score-value">{security.score}/100</span>
                  <span className="score-label">Security Score</span>
                </div>
                <div className="risk-level">
                  <span className={`risk-badge ${security.riskLevel}`}>
                    {security.riskLevel.toUpperCase()}
                  </span>
                </div>
              </div>
              {security.warnings.length > 0 && (
                <div className="warnings">
                  {security.warnings.map((warning, index) => (
                    <div key={index} className="warning-item">
                      ⚠️ {warning}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Market Comparison */}
          {marketComparison && (
            <div className="insight-section">
              <h4 className="insight-title">📊 Market Position</h4>
              <div className="market-stats">
                <div className="stat-item">
                  <span className="stat-label">Market Ranking</span>
                  <span className="stat-value">
                    #{marketComparison.blackVaultRanking} of {marketComparison.totalOpportunities}
                  </span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Better Opportunities</span>
                  <span className="stat-value">{marketComparison.betterOpportunities}</span>
                </div>
              </div>
            </div>
          )}

          {/* Portfolio Overview */}
          {insights && (
            <div className="insight-section">
              <h4 className="insight-title">💼 Portfolio Insights</h4>
              <div className="portfolio-overview">
                <div className="portfolio-item black-vault">
                  <span className="protocol-name">Black Vault</span>
                  <span className="protocol-value">${parseFloat(vaultBalance).toFixed(2)}</span>
                </div>
                {insights.external.slice(0, 3).map((position, index) => (
                  <div key={index} className="portfolio-item">
                    <span className="protocol-name">{position.protocol}</span>
                    <span className="protocol-value">${position.value.toFixed(2)}</span>
                  </div>
                ))}
                {insights.external.length > 3 && (
                  <div className="portfolio-item more">
                    <span className="protocol-name">+{insights.external.length - 3} more</span>
                  </div>
                )}
              </div>
              <div className="diversification-score">
                <span className="score-label">Diversification Score:</span>
                <span className="score-value">{insights.diversificationScore}/10</span>
              </div>
            </div>
          )}

          {/* Refresh Button */}
          <button
            className="vault-button premium-button secondary"
            onClick={loadDeFiInsights}
            disabled={loading}
            style={{ width: '100%', marginTop: '12px' }}
          >
            {loading ? 'Refreshing...' : 'Refresh Insights'}
          </button>
        </div>
      )}

      <style jsx>{`
        .defi-insights {
          margin-top: 12px;
        }
        
        .insight-section {
          margin-bottom: 16px;
          padding: 12px;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 8px;
        }
        
        .insight-title {
          margin: 0 0 8px 0;
          font-size: 14px;
          color: #fff;
          font-weight: 600;
        }
        
        .security-score {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }
        
        .score-display {
          display: flex;
          flex-direction: column;
        }
        
        .score-value {
          font-size: 24px;
          font-weight: bold;
          color: #4CAF50;
        }
        
        .score-label {
          font-size: 12px;
          color: #ccc;
        }
        
        .risk-badge {
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: bold;
        }
        
        .risk-badge.low {
          background: #4CAF50;
          color: white;
        }
        
        .risk-badge.medium {
          background: #FF9800;
          color: white;
        }
        
        .risk-badge.high {
          background: #f44336;
          color: white;
        }
        
        .warnings {
          margin-top: 8px;
        }
        
        .warning-item {
          font-size: 12px;
          color: #FF9800;
          margin-bottom: 4px;
        }
        
        .market-stats {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }
        
        .stat-item {
          display: flex;
          flex-direction: column;
        }
        
        .stat-label {
          font-size: 12px;
          color: #ccc;
        }
        
        .stat-value {
          font-size: 16px;
          font-weight: bold;
          color: #fff;
        }
        
        .portfolio-overview {
          margin-bottom: 8px;
        }
        
        .portfolio-item {
          display: flex;
          justify-content: space-between;
          margin-bottom: 4px;
          font-size: 12px;
        }
        
        .portfolio-item.black-vault {
          font-weight: bold;
          color: #4a9eff;
        }
        
        .protocol-name {
          color: #ccc;
        }
        
        .protocol-value {
          color: #fff;
        }
        
        .diversification-score {
          padding-top: 8px;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
          font-size: 12px;
        }
        
        .loading-state {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 20px;
          text-align: center;
          color: #ccc;
        }
      `}</style>
    </div>
  );
};

export default DeFiInsights;
