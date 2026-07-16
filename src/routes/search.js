const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { PrismaNeon } = require('@prisma/adapter-neon');
const redisClient = require('../config/redis');

const router = express.Router();
const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

router.get('/', async (req, res) => {
  try {
    const { q, userId, role } = req.query;

    if (!q || !userId) {
      return res.status(400).json({ success: false, error: 'Query (q) and userId are required' });
    }

    if (role !== 'RECRUITER') {
      return res.status(403).json({ success: false, error: 'Only recruiters can search currently' });
    }

    const cacheKey = `search:${userId}:${q.toLowerCase().trim()}`;
    
    // Check Redis Cache
    try {
      const cachedData = await redisClient.get(cacheKey);
      if (cachedData) {
        return res.json(JSON.parse(cachedData));
      }
    } catch (redisErr) {
      console.warn("Redis get error:", redisErr);
      // fallback to DB on redis failure
    }

    // Query Database
    const [hiringDrives, candidates] = await Promise.all([
      prisma.hiringDrive.findMany({
        where: {
          recruiterId: userId,
          title: { contains: q, mode: 'insensitive' }
        },
        select: { id: true, title: true, status: true },
        take: 5
      }),
      prisma.candidate.findMany({
        where: {
          hiringDrive: { recruiterId: userId },
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { email: { contains: q, mode: 'insensitive' } }
          ]
        },
        select: { 
          id: true, 
          name: true, 
          email: true, 
          hiringDrive: { select: { id: true, title: true } }
        },
        take: 10
      })
    ]);

    const result = { success: true, drives: hiringDrives, candidates };

    // Update Redis Cache (60 seconds expiry)
    try {
      await redisClient.setEx(cacheKey, 60, JSON.stringify(result));
    } catch (redisErr) {
      console.warn("Redis set error:", redisErr);
    }

    return res.json(result);
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

module.exports = router;
