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

// GET /db/users/:id/assessments - Fetch active assessments for a student
router.get('/:id/assessments', async (req, res) => {
  try {
    const { id } = req.params;
    
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const email = user.email.toLowerCase().trim();

    // Find candidates associated with this email
    const candidates = await prisma.candidate.findMany({
      where: { email },
      include: {
        hiringDrive: {
          include: {
            rounds: { orderBy: { order: 'asc' } }
          }
        }
      }
    });

    res.status(200).json({ success: true, data: candidates });
  } catch (error) {
    console.error('Error fetching assessments:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /db/users/:id/profile - Fetch user profile and assessment history
router.get('/:id/profile', async (req, res) => {
  try {
    const { id } = req.params;
    
    const user = await prisma.user.findUnique({ 
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true
      }
    });
    
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const email = user.email.toLowerCase().trim();

    // Find candidates associated with this email
    const candidates = await prisma.candidate.findMany({
      where: { email },
      include: {
        hiringDrive: {
          select: {
            title: true,
            status: true,
            department: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.status(200).json({ 
      success: true, 
      data: {
        user,
        assessments: candidates
      }
    });
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /db/users/:id/assessments/:candidateId/submit - Submit an assessment
router.post('/:id/assessments/:candidateId/submit', async (req, res) => {
  try {
    const { id, candidateId } = req.params;
    const { score, timeTaken } = req.body;

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const candidate = await prisma.candidate.update({
      where: { id: candidateId },
      data: {
        score,
        timeTaken,
        status: "In Review"
      }
    });

    res.status(200).json({ success: true, data: candidate });
  } catch (error) {
    console.error('Error submitting assessment:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

module.exports = router;
