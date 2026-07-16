const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { PrismaNeon } = require('@prisma/adapter-neon');
const { neonConfig } = require('@neondatabase/serverless');
const ws = require('ws');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { parseResumeFile } = require('../utils/resumeParser');
const cloudinary = require('cloudinary').v2;
const { apiLimiter } = require('../middleware/rateLimiter');
const { requireAuth } = require('../middleware/auth');
const { cache } = require('../middleware/cache');
// Cloudinary config will automatically pick up CLOUDINARY_URL from process.env

neonConfig.webSocketConstructor = ws;

require('dotenv').config();

const router = express.Router();
const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const upload = multer({ dest: path.join(__dirname, '../../uploads/') });

// Middleware to mock a recruiter auth if not provided
const getRecruiterId = async (req) => {
  if (req.user && req.user.id) {
    return req.user.id;
  }
  let userId = req.headers['x-user-id'];
  if (!userId) {
    let recruiter = await prisma.user.findFirst({ where: { role: 'RECRUITER' } });
    if (!recruiter) {
      recruiter = await prisma.user.create({
        data: {
          email: 'admin@recruiter.com',
          password: 'password',
          name: 'Admin Recruiter',
          role: 'RECRUITER'
        }
      });
    }
    userId = recruiter.id;
  }
  return userId;
};

// GET /db/drives - Fetch all hiring drives for a recruiter
router.get('/', requireAuth, apiLimiter, cache(60), async (req, res) => {
  try {
    const recruiterId = await getRecruiterId(req);
    
    const drives = await prisma.hiringDrive.findMany({
      where: { recruiterId },
      include: {
        candidates: true,
        rounds: {
          orderBy: { order: 'asc' }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const formattedDrives = drives.map(drive => {
      const candidatesCount = drive.candidates.length;
      const passedCount = drive.candidates.filter(c => c.status === 'Passed').length;
      const passRate = candidatesCount > 0 ? Math.round((passedCount / candidatesCount) * 100) + '%' : '-';

      return {
        id: drive.id,
        title: drive.title,
        status: drive.status,
        candidates: candidatesCount,
        passRate: passRate,
        date: drive.createdAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        createdAt: drive.createdAt,
        department: drive.department || "Engineering",
        rounds: drive.rounds || []
      };
    });

    res.status(200).json({ success: true, data: formattedDrives });
  } catch (error) {
    console.error('Error fetching drives:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /db/drives - Create a new drive
router.post('/', requireAuth, apiLimiter, async (req, res) => {
  try {
    const recruiterId = await getRecruiterId(req);
    const { title, department, rounds } = req.body;

    if (!title) {
      return res.status(400).json({ success: false, error: 'Title is required' });
    }

    const drive = await prisma.hiringDrive.create({
      data: {
        title,
        department,
        recruiterId,
        rounds: {
          create: rounds && rounds.length > 0 ? rounds.map((r, i) => ({
            name: r.name,
            type: r.type,
            duration: r.duration || null,
            description: r.description || null,
            order: i + 1,
            startDate: r.startDate ? new Date(r.startDate) : null,
            endDate: r.endDate ? new Date(r.endDate) : null,
            timeZone: r.timeZone || null,
            deadline: r.deadline ? new Date(r.deadline) : null,
            config: r.config || null
          })) : []
        }
      },
      include: { rounds: true }
    });

    res.status(201).json({ success: true, data: drive });
  } catch (error) {
    console.error('Error creating drive:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /db/drives/dashboard/stats - Fetch aggregated stats for the dashboard
router.get('/dashboard/stats', requireAuth, apiLimiter, cache(60), async (req, res) => {
  try {
    const recruiterId = await getRecruiterId(req);
    
    const drives = await prisma.hiringDrive.findMany({
      where: { recruiterId },
      include: {
        candidates: true
      }
    });

    let totalCandidates = 0;
    let passedCandidates = 0;
    let activeAssessments = 0;
    let completedAssessments = 0;
    let allCandidates = [];

    drives.forEach(drive => {
      if (drive.status === 'Active') activeAssessments++;
      if (drive.status === 'Closed' || drive.status === 'Completed') completedAssessments++;

      drive.candidates.forEach(candidate => {
        totalCandidates++;
        if (candidate.status === 'Passed') passedCandidates++;
        allCandidates.push({
          id: candidate.id,
          candidate: candidate.name,
          test: drive.title,
          score: candidate.score || '-',
          time: candidate.createdAt,
          status: candidate.status
        });
      });
    });

    const passRate = totalCandidates > 0 ? Math.round((passedCandidates / totalCandidates) * 100) : 0;
    
    allCandidates.sort((a, b) => b.time - a.time);
    const recentActivity = allCandidates.slice(0, 5).map(c => ({
      ...c,
      time: new Date(c.time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    }));

    res.status(200).json({
      success: true,
      data: {
        stats: {
          totalCandidates,
          activeAssessments,
          completedAssessments,
          passRate: `${passRate}%`
        },
        recentActivity
      }
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// PUT /db/drives/:jobId/rounds/:roundId - Update a specific round
router.put('/:jobId/rounds/:roundId', async (req, res) => {
  try {
    const recruiterId = await getRecruiterId(req);
    const { jobId, roundId } = req.params;
    const { config, startDate, endDate, duration, timeZone, deadline, name, type } = req.body;

    // Verify the drive belongs to the recruiter
    const drive = await prisma.hiringDrive.findFirst({
      where: {
        id: jobId,
        recruiterId: recruiterId
      }
    });

    if (!drive) {
      return res.status(404).json({ success: false, error: 'Hiring drive not found or unauthorized' });
    }

    const dataPayload = {};
    if (name !== undefined) dataPayload.name = name;
    if (type !== undefined) dataPayload.type = type;
    if (config !== undefined) dataPayload.config = config;
    if (startDate !== undefined) dataPayload.startDate = startDate ? new Date(startDate) : null;
    if (endDate !== undefined) dataPayload.endDate = endDate ? new Date(endDate) : null;
    if (duration !== undefined) dataPayload.duration = duration;
    if (timeZone !== undefined) dataPayload.timeZone = timeZone;
    if (deadline !== undefined) dataPayload.deadline = deadline ? new Date(deadline) : null;

    const updatedRound = await prisma.round.update({
      where: {
        id: roundId
      },
      data: dataPayload
    });

    res.status(200).json({ success: true, data: updatedRound });
  } catch (error) {
    console.error('Error updating round:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /db/drives/:id/public - Fetch basic drive details for public application page
router.get('/:id/public', async (req, res) => {
  try {
    const { id } = req.params;
    const drive = await prisma.hiringDrive.findUnique({
      where: { id },
      select: {
        title: true,
        department: true,
        location: true,
        status: true,
        rounds: {
          orderBy: { order: 'asc' },
          select: { id: true, name: true, type: true, deadline: true }
        }
      }
    });

    if (!drive) {
      return res.status(404).json({ success: false, error: 'Drive not found' });
    }

    if (drive.status !== 'Active') {
      return res.status(400).json({ success: false, error: 'This hiring drive is not currently accepting applications.' });
    }

    if (drive.rounds[0]?.deadline && new Date() > new Date(drive.rounds[0].deadline)) {
      return res.status(400).json({ success: false, error: 'The registration deadline for this drive has passed.' });
    }

    res.status(200).json({ success: true, data: drive });
  } catch (error) {
    console.error('Error fetching public drive details:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /db/drives/:id/apply - Submit a public application
router.post('/:id/apply', async (req, res) => {
  try {
    const { id } = req.params;
    let { name, email, phone } = req.body;

    if (!name || !email) {
      return res.status(400).json({ success: false, error: 'Name and email are required.' });
    }
    
    email = email.toLowerCase().trim();

    const drive = await prisma.hiringDrive.findUnique({
      where: { id },
      include: {
        rounds: { orderBy: { order: 'asc' } }
      }
    });

    if (!drive) return res.status(404).json({ success: false, error: 'Drive not found' });
    if (drive.status !== 'Active') return res.status(400).json({ success: false, error: 'This hiring drive is closed.' });

    // Ensure the user actually has a registered account
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });
    if (!existingUser) {
      return res.status(400).json({ success: false, error: 'You must have a registered student account to apply. Please login or register first.' });
    }

    const firstRound = drive.rounds[0];
    if (firstRound?.deadline && new Date() > new Date(firstRound.deadline)) {
      return res.status(400).json({ success: false, error: 'The registration deadline for this drive has passed.' });
    }

    // Ensure they haven't already applied
    const existingCandidate = await prisma.candidate.findFirst({
      where: { hiringDriveId: id, email }
    });
    if (existingCandidate) {
      return res.status(400).json({ success: false, error: 'You have already applied for this role.' });
    }

    const initialStage = firstRound ? firstRound.name : 'Applied';

    const candidate = await prisma.candidate.create({
      data: {
        hiringDriveId: id,
        name,
        email,
        stage: initialStage,
        status: 'In Review'
      }
    });

    res.status(201).json({ success: true, data: { candidateId: candidate.id } });
  } catch (error) {
    console.error('Error submitting application:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /db/drives/:id/apply-with-resume - Submit application with resume parsing
router.post('/:id/apply-with-resume', upload.single('resume'), async (req, res) => {
  try {
    const { id } = req.params;
    let { name, email, phone } = req.body;

    if (!name || !email) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(400).json({ success: false, error: 'Name and email are required.' });
    }
    
    email = email.toLowerCase().trim();

    const drive = await prisma.hiringDrive.findUnique({
      where: { id },
      include: {
        rounds: { orderBy: { order: 'asc' } }
      }
    });

    if (!drive) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(404).json({ success: false, error: 'Drive not found' });
    }
    if (drive.status !== 'Active') {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(400).json({ success: false, error: 'This hiring drive is closed.' });
    }

    const existingUser = await prisma.user.findUnique({
      where: { email }
    });
    if (!existingUser) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(400).json({ success: false, error: 'You must have a registered student account to apply. Please login or register first.' });
    }

    const firstRound = drive.rounds[0];
    if (firstRound?.deadline && new Date() > new Date(firstRound.deadline)) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(400).json({ success: false, error: 'The registration deadline for this drive has passed.' });
    }

    const existingCandidate = await prisma.candidate.findFirst({
      where: { hiringDriveId: id, email }
    });
    if (existingCandidate) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(400).json({ success: false, error: 'You have already applied for this role.' });
    }

    let resumeData = null;
    let resumeFile = null;

    if (req.file) {
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

      try {
        resumeData = await parseResumeFile(req.file.path);
      } catch (parseError) {
        console.error("Resume parsing error:", parseError);
        // We still let them apply even if AI parsing fails
      }
      
      // Cleanup the temporary local file ONLY if it was safely uploaded to the cloud
      if (cloudUploadSuccess && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
    }

    const initialStage = firstRound ? firstRound.name : 'Applied';

    const candidate = await prisma.candidate.create({
      data: {
        hiringDriveId: id,
        name,
        email,
        stage: initialStage,
        status: 'In Review',
        resumeFile,
        resumeData
      }
    });

    // --- NOTIFICATION FOR RECRUITER ---
    const driveWithRecruiter = await prisma.hiringDrive.findUnique({
      where: { id },
      include: { recruiter: true }
    });
    
    if (driveWithRecruiter && driveWithRecruiter.recruiter) {
      await prisma.notification.create({
        data: {
          recipientEmail: driveWithRecruiter.recruiter.email,
          role: 'RECRUITER',
          type: 'APPLICATION_SUBMITTED',
          title: 'New Candidate Application',
          message: `${name} has applied for ${driveWithRecruiter.title}.`,
          actionLink: `/recruiter/drives/${driveWithRecruiter.id}/candidates/${candidate.id}`
        }
      });
    }
    // ------------------------------------

    res.status(201).json({ success: true, data: { candidateId: candidate.id, parsed: !!resumeData } });
  } catch (error) {
    console.error('Error submitting application with resume:', error);
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});


// GET /db/drives/:id - Fetch drive details
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const recruiterId = await getRecruiterId(req);

    const drive = await prisma.hiringDrive.findFirst({
      where: { id, recruiterId },
      include: {
        rounds: { orderBy: { order: 'asc' } },
        candidates: { orderBy: { createdAt: 'desc' } }
      }
    });

    if (!drive) {
      return res.status(404).json({ success: false, error: 'Drive not found' });
    }

    res.status(200).json({ success: true, data: drive });
  } catch (error) {
    console.error('Error fetching drive details:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /db/drives/:id/rounds - Add a round manually
router.post('/:id/rounds', async (req, res) => {
  try {
    const { id } = req.params;
    const recruiterId = await getRecruiterId(req);
    const { name, type, duration, description, startDate, endDate, timeZone, deadline, config } = req.body;

    const drive = await prisma.hiringDrive.findFirst({ where: { id, recruiterId } });
    if (!drive) return res.status(404).json({ success: false, error: 'Drive not found' });

    const count = await prisma.round.count({ where: { hiringDriveId: id } });

    const round = await prisma.round.create({
      data: {
        hiringDriveId: id,
        name,
        type,
        duration,
        description,
        order: count + 1,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        timeZone: timeZone || null,
        deadline: deadline ? new Date(deadline) : null,
        config: config || null
      }
    });

    res.status(201).json({ success: true, data: round });
  } catch (error) {
    console.error('Error adding round:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /db/drives/:id/candidates - Add a candidate (For testing/mocking)
router.post('/:id/candidates', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, stage, status } = req.body;

    const candidate = await prisma.candidate.create({
      data: {
        hiringDriveId: id,
        name,
        email,
        stage: stage || 'Applied',
        status: status || 'In Review'
      }
    });

    res.status(201).json({ success: true, data: candidate });
  } catch (error) {
    console.error('Error adding candidate:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /db/drives/:id/candidates/:candidateId - Fetch a single candidate
router.get('/:id/candidates/:candidateId', async (req, res) => {
  try {
    const { candidateId } = req.params;
    const candidate = await prisma.candidate.findUnique({
      where: { id: candidateId }
    });
    
    if (!candidate) {
      return res.status(404).json({ success: false, error: 'Candidate not found' });
    }
    
    res.status(200).json({ success: true, data: candidate });
  } catch (error) {
    console.error('Error fetching candidate:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});
// PUT /db/drives/:id/candidates/:candidateId - Update a candidate's status/stage
router.put('/:id/candidates/:candidateId', async (req, res) => {
  try {
    const { candidateId } = req.params;
    const { status, stage } = req.body;

    const dataToUpdate = {};
    if (status) dataToUpdate.status = status;
    if (stage) dataToUpdate.stage = stage;

    const candidate = await prisma.candidate.update({
      where: { id: candidateId },
      data: dataToUpdate,
      include: { hiringDrive: true }
    });

    // --- NOTIFICATION FOR STUDENT ---
    if (stage || status) {
      const title = stage ? 'Interview Stage Updated' : 'Application Status Updated';
      const detail = stage ? `moved to ${stage}` : `status changed to ${status}`;
      await prisma.notification.create({
        data: {
          recipientEmail: candidate.email,
          role: 'STUDENT',
          type: 'STATUS_UPDATE',
          title: title,
          message: `Your application for ${candidate.hiringDrive.title} was ${detail}.`,
          actionLink: `/student`
        }
      });
    }
    // --------------------------------

    res.status(200).json({ success: true, data: candidate });
  } catch (error) {
    console.error('Error updating candidate:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

module.exports = router;
