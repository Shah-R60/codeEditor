const express = require('express');
const { AccessToken } = require('livekit-server-sdk');
const router = express.Router();

// POST /livekit/token - Generate a LiveKit token for a given user
router.post('/token', async (req, res) => {
  const { userId, roomId } = req.body;
  if (!userId || !roomId) {
    return res.status(400).json({ success: false, error: 'userId and roomId are required' });
  }

  const API_KEY = process.env.LIVEKIT_API_KEY || "devkey";
  const API_SECRET = process.env.LIVEKIT_API_SECRET || "secret";
  const SERVER_URL = process.env.LIVEKIT_SERVER_URL || "ws://10.127.10.160:7880";

  try {
    const at = new AccessToken(API_KEY, API_SECRET, {
      identity: userId,
      name: userId,
    });
    
    at.addGrant({ 
      roomJoin: true, 
      room: roomId, 
      canPublish: true, 
      canSubscribe: true 
    });

    const token = await at.toJwt();

    return res.status(200).json({ success: true, token, serverUrl: SERVER_URL });
  } catch (error) {
    console.error('Error with LiveKit SDK:', error);
    return res.status(500).json({ success: false, error: 'Internal server error generating LiveKit token' });
  }
});

module.exports = router;
