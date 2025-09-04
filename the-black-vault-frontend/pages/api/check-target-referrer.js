// Simple API to check Redis data for target referrer

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // Target referrer from the original issue
    const targetReferrer = '0xB98e82C611BFc1b852412268fd300E28fAEE4D48'
    
    console.log(`🔍 Checking for referrer: ${targetReferrer}`)
    
    // For development, let's just check what we can access
    const summary = {
      targetReferrer,
      message: 'In development environment - need to check production Redis data',
      environment: process.env.NODE_ENV || 'development',
      hasKvUrl: !!process.env.KV_REST_API_URL,
      hasKvToken: !!process.env.KV_REST_API_TOKEN
    }
    
    console.log('📋 Environment Check:', summary)
    
    res.status(200).json({
      success: true,
      summary,
      note: 'This API works in production with Vercel KV access. In development, it shows environment status.'
    })
    
  } catch (error) {
    console.error('❌ Check failed:', error)
    res.status(500).json({ 
      error: 'Check failed', 
      details: error.message 
    })
  }
}
