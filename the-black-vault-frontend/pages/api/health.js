// pages/api/health.js
// Simple health check endpoint

export default function handler(req, res) {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    message: 'API is working correctly'
  });
}
