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
    // For development, find the first recruiter or create one
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

// GET /db/jobs - Fetch all jobs for a recruiter
router.get('/', async (req, res) => {
  try {
    const recruiterId = await getRecruiterId(req);
    
    const jobs = await prisma.job.findMany({
      where: { recruiterId },
      include: {
        candidates: true
      },
      orderBy: { createdAt: 'desc' }
    });

    // Format response to match frontend expectations
    const formattedJobs = jobs.map(job => {
      const candidatesCount = job.candidates.length;
      const passedCount = job.candidates.filter(c => c.status === 'Passed').length;
      const passRate = candidatesCount > 0 ? Math.round((passedCount / candidatesCount) * 100) + '%' : '-';

      return {
        id: job.id,
        title: job.title,
        status: job.status,
        candidates: candidatesCount,
        passRate: passRate,
        date: job.createdAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        department: job.department || "Engineering"
      };
    });

    res.status(200).json({ success: true, data: formattedJobs });
  } catch (error) {
    console.error('Error fetching jobs:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /db/jobs - Create a new job
router.post('/', async (req, res) => {
  try {
    const recruiterId = await getRecruiterId(req);
    const { title, department } = req.body;

    if (!title) {
      return res.status(400).json({ success: false, error: 'Title is required' });
    }

    const job = await prisma.job.create({
      data: {
        title,
        department,
        recruiterId,
        // Create default stages
        stages: {
          create: [
            { name: "Online Assessment", type: "Automated", duration: "90 mins", description: "Initial screening with 2 algorithmic questions.", order: 1 },
            { name: "Technical Interview", type: "Live Coding", duration: "60 mins", description: "Pair programming session assessing system design.", order: 2 },
            { name: "HR Interview", type: "Video Call", duration: "30 mins", description: "Culture fit and behavioral questions.", order: 3 }
          ]
        }
      },
      include: { stages: true }
    });

    res.status(201).json({ success: true, data: job });
  } catch (error) {
    console.error('Error creating job:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /db/jobs/:id - Fetch job details
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const recruiterId = await getRecruiterId(req);

    const job = await prisma.job.findFirst({
      where: { id, recruiterId },
      include: {
        stages: { orderBy: { order: 'asc' } },
        candidates: { orderBy: { createdAt: 'desc' } }
      }
    });

    if (!job) {
      return res.status(404).json({ success: false, error: 'Job not found' });
    }

    res.status(200).json({ success: true, data: job });
  } catch (error) {
    console.error('Error fetching job details:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /db/jobs/:id/stages - Add a stage
router.post('/:id/stages', async (req, res) => {
  try {
    const { id } = req.params;
    const recruiterId = await getRecruiterId(req);
    const { name, type, duration, description } = req.body;

    // Verify job belongs to recruiter
    const job = await prisma.job.findFirst({ where: { id, recruiterId } });
    if (!job) return res.status(404).json({ success: false, error: 'Job not found' });

    const count = await prisma.stage.count({ where: { jobId: id } });

    const stage = await prisma.stage.create({
      data: {
        jobId: id,
        name,
        type,
        duration,
        description,
        order: count + 1
      }
    });

    res.status(201).json({ success: true, data: stage });
  } catch (error) {
    console.error('Error adding stage:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /db/jobs/:id/candidates - Add a candidate (For testing/mocking)
router.post('/:id/candidates', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, stage, status } = req.body;

    const candidate = await prisma.candidate.create({
      data: {
        jobId: id,
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
