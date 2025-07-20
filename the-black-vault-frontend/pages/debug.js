// pages/debug.js
// Debug page to manually trigger jobs and check Redis data

import { useState } from 'react';
import { useRouter } from 'next/router';

export default function DebugPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [redisData, setRedisData] = useState(null);
  const router = useRouter();

  const triggerReferralJob = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/trigger-referral-job', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      const data = await response.json();
      setResult(data);
    } catch (error) {
      setResult({ error: error.message });
    } finally {
      setLoading(false);
    }
  };

  const checkRedisData = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/debug-redis');
      const data = await response.json();
      setRedisData(data);
    } catch (error) {
      setRedisData({ error: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ 
      padding: '20px', 
      fontFamily: 'Arial, sans-serif',
      backgroundColor: '#0a0a0a',
      color: '#fff',
      minHeight: '100vh'
    }}>
      <h1>🔧 Debug Panel - Black Vault</h1>
      
      <div style={{ marginBottom: '20px' }}>
        <button 
          onClick={() => router.push('/')}
          style={{
            padding: '10px 20px',
            backgroundColor: '#333',
            color: '#fff',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
            marginRight: '10px'
          }}
        >
          ← Back to App
        </button>
      </div>

      <div style={{ marginBottom: '30px' }}>
        <h2>Manual Job Triggers</h2>
        <button 
          onClick={triggerReferralJob}
          disabled={loading}
          style={{
            padding: '10px 20px',
            backgroundColor: loading ? '#666' : '#4CAF50',
            color: '#fff',
            border: 'none',
            borderRadius: '5px',
            cursor: loading ? 'not-allowed' : 'pointer',
            marginRight: '10px'
          }}
        >
          {loading ? 'Running...' : 'Trigger Referral Stats Job'}
        </button>
        
        <button 
          onClick={checkRedisData}
          disabled={loading}
          style={{
            padding: '10px 20px',
            backgroundColor: loading ? '#666' : '#2196F3',
            color: '#fff',
            border: 'none',
            borderRadius: '5px',
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? 'Loading...' : 'Check Redis Data'}
        </button>
      </div>

      {result && (
        <div style={{ marginBottom: '30px' }}>
          <h3>Job Result:</h3>
          <pre style={{ 
            backgroundColor: '#222', 
            padding: '15px', 
            borderRadius: '5px',
            overflow: 'auto',
            maxHeight: '400px'
          }}>
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}

      {redisData && (
        <div style={{ marginBottom: '30px' }}>
          <h3>Redis Data:</h3>
          <pre style={{ 
            backgroundColor: '#222', 
            padding: '15px', 
            borderRadius: '5px',
            overflow: 'auto',
            maxHeight: '600px'
          }}>
            {JSON.stringify(redisData, null, 2)}
          </pre>
        </div>
      )}

      <div style={{ marginTop: '30px', padding: '15px', backgroundColor: '#333', borderRadius: '5px' }}>
        <h3>Debug Information:</h3>
        <p><strong>Contract Address:</strong> 0x22708D8a54c044CbA5B237620Af42030cbf76E14</p>
        <p><strong>Default Referrer:</strong> 0x706961C676FE743C34A867437661D13E16ADCbEc</p>
        <p><strong>Time:</strong> {new Date().toISOString()}</p>
        <p><strong>Purpose:</strong> This page helps manually trigger background jobs and debug Redis cache data.</p>
      </div>
    </div>
  );
}
