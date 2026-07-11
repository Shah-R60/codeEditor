const express = require('express');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const { PrismaNeon } = require('@prisma/adapter-neon');
const { neonConfig } = require('@neondatabase/serverless');
const ws = require('ws');
const { app } = require('../config/firebase');
const { getAuth } = require('firebase-admin/auth');

neonConfig.webSocketConstructor = ws;
const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_for_code_editor';

// POST /db/users/google-login
router.post('/google-login', async (req, res) => {
  try {
    const { idToken, role } = req.body;

    if (!idToken || !role) {
      return res.status(400).json({ success: false, error: 'idToken and role are required' });
    }

    if (!app) {
        return res.status(500).json({ success: false, error: 'Firebase Admin not initialized on backend' });
    }

    // Verify Google ID Token
    let decodedToken;
    try {
      decodedToken = await getAuth(app).verifyIdToken(idToken);
    } catch (verifyError) {
      console.error('Firebase token verification failed:', verifyError);
      return res.status(401).json({ success: false, error: 'Invalid authentication token' });
    }

    const { email, name, uid } = decodedToken;

    if (!email) {
      return res.status(400).json({ success: false, error: 'Email not found in token' });
    }

    // Find or Create user in our PostgreSQL database
    let user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          password: 'GOOGLE_AUTH_PLACEHOLDER_' + uid, // Placeholder
          name: name || null,
          role: role === 'RECRUITER' ? 'RECRUITER' : 'STUDENT'
        }
      });
    }

    // Generate our own JWT for subsequent API requests
    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '1d' });

    res.status(200).json({
      success: true,
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role }
    });
  } catch (error) {
    console.error('Google login error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

module.exports = router;
