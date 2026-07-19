const express = require('express');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const { PrismaNeon } = require('@prisma/adapter-neon');
const { neonConfig } = require('@neondatabase/serverless');
const ws = require('ws');
const { app } = require('../config/firebase');
const { getAuth } = require('firebase-admin/auth');
const redisClient = require('../config/redis');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cloudinary = require('cloudinary').v2;
const { parseResumeFile } = require('../utils/resumeParser');
const emailService = require('../utils/emailService');

const upload = multer({ dest: path.join(__dirname, '../../uploads/') });

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
      
      // Send Welcome Email
      if (user.role === 'RECRUITER') {
        emailService.sendRecruiterWelcomeEmail(user.email, user.name);
      } else {
        emailService.sendCandidateWelcomeEmail(user.email, user.name);
      }
    }

    // Generate our own JWT for subsequent API requests
    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '1d' });

    // Store session in Redis with 24 hours expiration (86400 seconds)
    try {
      await redisClient.setEx(`auth:${token}`, 86400, user.id);
    } catch (redisErr) {
      console.error('Failed to store session in Redis:', redisErr);
    }

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

// POST /db/users/:id/resume - Upload and parse resume
router.post('/:id/resume', upload.single('resume'), async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    let resumeFile = null;
    let cloudUploadSuccess = false;

    try {
      // Upload to Cloudinary
      const uploadResult = await cloudinary.uploader.upload(req.file.path, {
        resource_type: "image", // Using 'image' allows Cloudinary to serve the PDF correctly in browsers
        format: "pdf"
      });
      resumeFile = uploadResult.secure_url;
      cloudUploadSuccess = true;
    } catch (uploadError) {
      console.error("Cloudinary upload error:", uploadError);
      resumeFile = req.file.filename; // fallback to local if cloud fails
    }

    let parsedData = null;
    try {
      // Parse the resume
      parsedData = await parseResumeFile(req.file.path);
    } catch (parseError) {
      console.error("Resume parsing error:", parseError);
    }

    // Cleanup the temporary local file ONLY if it was safely uploaded to the cloud
    if (cloudUploadSuccess && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    // Save parsed data and file URL into the database
    const updatedUser = await prisma.user.update({
      where: { id },
      data: { 
        resumeData: parsedData || user.resumeData,
        resumeFile: resumeFile 
      }
    });

    res.status(200).json({ success: true, data: parsedData || user.resumeData, resumeFile });
  } catch (error) {
    console.error('Error parsing resume:', error);
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ success: false, error: 'Internal server error or failed to parse resume' });
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
        createdAt: true,
        resumeData: true,
        resumeFile: true
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
    const { score, timeTaken, submissions, stageId, isFinal = true } = req.body;

    let user = null;
    if (id !== "null") {
      user = await prisma.user.findUnique({ where: { id } });
    }
    if (!user && id !== "null") {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const currentCandidate = await prisma.candidate.findUnique({ 
      where: { id: candidateId },
      include: { hiringDrive: true }
    });
    if (!currentCandidate) {
      return res.status(404).json({ success: false, error: 'Candidate not found' });
    }

    let stageData = {};
    if (currentCandidate.stageData) {
      try {
        stageData = typeof currentCandidate.stageData === 'string' ? JSON.parse(currentCandidate.stageData) : currentCandidate.stageData;
      } catch (e) {
        stageData = {};
      }
    }

    if (stageId) {
      stageData[stageId] = {
        score,
        timeTaken,
        submissions: submissions ? submissions : undefined,
      };
    }

    const candidate = await prisma.candidate.update({
      where: { id: candidateId },
      data: {
        score, // Keeping global for backward compatibility for now
        timeTaken,
        submissions: submissions ? submissions : undefined,
        stageData,
        ...(isFinal ? { status: "In Review" } : {})
      }
    });

    // Send Round Result Email to candidate
    if (score) {
      emailService.sendRoundResultEmail(currentCandidate.email, currentCandidate.name, currentCandidate.hiringDrive?.title || 'Hiring Drive', score);
    }

    res.status(200).json({ success: true, data: candidate });
  } catch (error) {
    console.error('Error submitting assessment:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});


// POST /db/users/logout
router.post('/logout', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      await redisClient.del(`auth:${token}`);
    }
    res.status(200).json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

module.exports = router;
