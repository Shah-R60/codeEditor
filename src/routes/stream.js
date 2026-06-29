const express = require('express');
const { StreamClient } = require('@stream-io/node-sdk');
const router = express.Router();

// POST /stream/token - Generate a Stream.io token for a given user
router.post('/token', (req, res) => {
  const { userId, callId } = req.body;
  if (!userId) {
    return res.status(400).json({ success: false, error: 'userId is required' });
  }

  // Use the API key provided in the frontend env, or a backend one if needed.
  // We will assume the backend also has STREAM_API_KEY if they put it there,
  // but for safety we will default to the one from the screenshot.
  const STREAM_API_KEY = process.env.STREAM_API_KEY || "ph2q2ydnaz6d";
  const STREAM_API_SECRET = process.env.STREAM_API_SECRET;
  
  if (!STREAM_API_KEY || !STREAM_API_SECRET) {
    return res.status(500).json({ success: false, error: 'STREAM_API_KEY or STREAM_API_SECRET environment variables are not set on the server' });
  }

  try {
    const client = new StreamClient(STREAM_API_KEY, STREAM_API_SECRET);
    
    // Generate a user token (valid for 1 hour by default)
    const token = client.generateUserToken({ user_id: userId });

    return res.status(200).json({ success: true, token, apiKey: STREAM_API_KEY });
  } catch (error) {
    console.error('Error with Stream API:', error);
    return res.status(500).json({ success: false, error: 'Internal server error communicating with Stream.io' });
  }
});

module.exports = router;
