const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { PrismaNeon } = require('@prisma/adapter-neon');
const { neonConfig } = require('@neondatabase/serverless');
const ws = require('ws');

neonConfig.webSocketConstructor = ws;
const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const router = express.Router();

// GET /db/notifications?userId=XYZ&role=RECRUITER
router.get('/', async (req, res) => {
  try {
    const { userId, role } = req.query;
    if (!userId || !role) {
      return res.status(400).json({ success: false, error: 'userId and role are required' });
    }

    // 1. Find user by ID to get their email
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const email = user.email;

    // 2. Fetch notifications for this email and role
    const notifications = await prisma.notification.findMany({
      where: {
        recipientEmail: email,
        role: role.toUpperCase()
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 50
    });

    // 3. Count unread
    const unreadCount = await prisma.notification.count({
      where: {
        recipientEmail: email,
        role: role.toUpperCase(),
        isRead: false
      }
    });

    res.json({ success: true, notifications, unreadCount });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// PUT /db/notifications/:id/read
router.put('/:id/read', async (req, res) => {
  try {
    const { id } = req.params;
    
    await prisma.notification.update({
      where: { id },
      data: { isRead: true }
    });

    res.json({ success: true });
  } catch (error) {
    console.error("Error marking notification read:", error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// PUT /db/notifications/read-all
router.put('/read-all', async (req, res) => {
  try {
    const { userId, role } = req.body;
    if (!userId || !role) {
      return res.status(400).json({ success: false, error: 'userId and role are required' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) return res.status(404).json({ success: false, error: 'User not found' });

    await prisma.notification.updateMany({
      where: {
        recipientEmail: user.email,
        role: role.toUpperCase(),
        isRead: false
      },
      data: { isRead: true }
    });

    res.json({ success: true });
  } catch (error) {
    console.error("Error marking all read:", error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

module.exports = router;
