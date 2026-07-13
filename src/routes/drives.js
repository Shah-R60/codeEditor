const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { PrismaNeon } = require('@prisma/adapter-neon');
const { neonConfig } = require('@neondatabase/serverless');
const ws = require('ws');

neonConfig.webSocketConstructor = ws;

require('dotenv').config();

const router = express.Router();
const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// Middleware to mock a recruiter auth if not provided
const getRecruiterId = async (req) => {
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
router.get('/', async (req, res) => {
  try {
    const recruiterId = await getRecruiterId(req);
    
    const drives = await prisma.hiringDrive.findMany({
      where: { recruiterId },
      include: {
        candidates: true
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
        department: drive.department || "Engineering"
      };
    });

    res.status(200).json({ success: true, data: formattedDrives });
  } catch (error) {
    console.error('Error fetching drives:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /db/drives - Create a new drive
router.post('/', async (req, res) => {
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
router.get('/dashboard/stats', async (req, res) => {
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
        status: true,
      }
    });

    if (!drive) {
      return res.status(404).json({ success: false, error: 'Drive not found' });
    }

    if (drive.status !== 'Active') {
      return res.status(400).json({ success: false, error: 'This hiring drive is not currently accepting applications.' });
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

    // Ensure they haven't already applied
    const existingCandidate = await prisma.candidate.findFirst({
      where: { hiringDriveId: id, email }
    });
    if (existingCandidate) {
      return res.status(400).json({ success: false, error: 'You have already applied for this role.' });
    }

    const firstRound = drive.rounds[0];
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

module.exports = router;
