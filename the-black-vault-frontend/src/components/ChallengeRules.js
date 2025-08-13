// src/components/ChallengeRules.js
import React from 'react';

const ChallengeRules = ({ onClose, currentWeek }) => {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content rules-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>
            <span className="header-icon">📋</span>
            Weekly Referral Challenge Rules
          </h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          <div className="rules-section">
            <div className="rule-item">
              <div className="rule-icon">🏆</div>
              <div className="rule-content">
                <h3>Weekly Prizes</h3>
                <div className="prize-list">
                  <div className="prize-row gold">
                    <span className="prize-rank">🥇 1st Place:</span>
                    <span className="prize-amount">$25 USDT</span>
                  </div>
                  <div className="prize-row silver">
                    <span className="prize-rank">🥈 2nd Place:</span>
                    <span className="prize-amount">$15 USDT</span>
                  </div>
                  <div className="prize-row bronze">
                    <span className="prize-rank">🥉 3rd Place:</span>
                    <span className="prize-amount">$10 USDT</span>
                  </div>
                </div>
                <p className="total-pool">Total weekly prize pool: <strong>$50 USDT</strong></p>
              </div>
            </div>

            <div className="rule-item">
              <div className="rule-icon">📊</div>
              <div className="rule-content">
                <h3>How Rankings Work</h3>
                <ul>
                  <li>Your rank is based on <strong>total USDT earned in referral rewards</strong> during the week</li>
                  <li>Only rewards from actual deposits count — no empty signups</li>
                  <li>Referral rewards are calculated as 10% of your referrals' vault earnings</li>
                  <li>Rankings update every 5 minutes automatically</li>
                </ul>
              </div>
            </div>

            <div className="rule-item">
              <div className="rule-icon">📅</div>
              <div className="rule-content">
                <h3>Challenge Period</h3>
                <div className="period-info">
                  <div className="period-row">
                    <span className="period-label">Current Week:</span>
                    <span className="period-value">
                      {currentWeek?.start.toLocaleDateString()} - {currentWeek?.end.toLocaleDateString()}
                    </span>
                  </div>
                  <div className="period-row">
                    <span className="period-label">Reset Time:</span>
                    <span className="period-value">Every Sunday at 00:00 UTC</span>
                  </div>
                </div>
                <p>Each week is a fresh start with new opportunities to win!</p>
              </div>
            </div>

            <div className="rule-item">
              <div className="rule-icon">✅</div>
              <div className="rule-content">
                <h3>Qualification Requirements</h3>
                <ul>
                  <li>Must have at least 1 qualifying referral deposit during the week</li>
                  <li>Minimum $10 USDT deposit required from referrals to qualify</li>
                  <li>Your wallet must be connected to participate</li>
                  <li>Only legitimate referrals count (no self-referrals or fake accounts)</li>
                </ul>
              </div>
            </div>

            <div className="rule-item">
              <div className="rule-icon">💰</div>
              <div className="rule-content">
                <h3>Prize Distribution</h3>
                <ul>
                  <li>Prizes are distributed automatically every Monday</li>
                  <li>Winners receive USDT directly to their connected wallet</li>
                  <li>Prize distribution happens within 24 hours after week end</li>
                  <li>You must maintain wallet connection to receive prizes</li>
                </ul>
              </div>
            </div>

            <div className="rule-item">
              <div className="rule-icon">⚖️</div>
              <div className="rule-content">
                <h3>Fair Play Policy</h3>
                <ul>
                  <li>One wallet address per participant</li>
                  <li>No manipulation of referral systems</li>
                  <li>Suspicious activity may result in disqualification</li>
                  <li>BlackVault reserves the right to verify referrals</li>
                  <li>Decisions on rule violations are final</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="rules-footer">
            <div className="footer-note">
              <span className="note-icon">💡</span>
              <p>
                <strong>Pro Tip:</strong> Focus on bringing quality referrals who will make substantial deposits. 
                A few high-value referrals often outperform many small ones!
              </p>
            </div>
            
            <div className="good-luck">
              <span className="luck-icon">🍀</span>
              <h3>Good Luck and Happy Referring!</h3>
              <p>May the best referrer win the weekly prizes!</p>
            </div>
          </div>
        </div>

        <div className="modal-actions">
          <button className="primary-btn" onClick={onClose}>
            Got It! Let's Start
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChallengeRules;
