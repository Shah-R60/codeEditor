const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { PrismaNeon } = require('@prisma/adapter-neon');
const { Pool, neonConfig } = require('@neondatabase/serverless');
const ws = require('ws');

neonConfig.webSocketConstructor = ws; // Uses WebSocket on port 443 which bypasses firewalls

// Load environment variables
require('dotenv').config();
console.log("DATABASE_URL IS:", process.env.DATABASE_URL);

const router = express.Router();

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// POST /db/questions - Creates a question with its test cases
router.post('/questions', async (req, res) => {
  try {
    const { title, description, difficulty, type, marks, tags, boilerplate, testCases } = req.body;

    if (!title || !description || !difficulty || !Array.isArray(testCases)) {
      return res.status(400).json({ success: false, error: 'Invalid payload' });
    }

    const question = await prisma.question.create({
      data: {
        title,
        description,
        difficulty,
        boilerplate: {
          ...(boilerplate || {}),
          type: type || "Coding",
          marks: marks || 10,
          tags: tags || []
        },
        testCases: {
          create: testCases.map(tc => ({
            input: tc.input,
            expectedOutput: tc.expectedOutput,
            isHidden: tc.isHidden || false
          }))
        }
      },
      include: {
        testCases: true
      }
    });

    res.status(201).json({ success: true, data: question });
  } catch (error) {
    console.error('Error creating question:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /db/questions - Fetches all questions
router.get('/questions', async (req, res) => {
  try {
    const questions = await prisma.question.findMany({
      include: {
        testCases: true
      },
      orderBy: {
        title: 'asc'
      }
    });
    res.status(200).json({ success: true, data: questions });
  } catch (error) {
    console.error('Error fetching questions:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /db/questions/random - Fetches a random question with test cases
router.get('/questions/random', async (req, res) => {
  try {
    const count = await prisma.question.count();
    
    if (count === 0) {
      return res.status(404).json({ success: false, error: 'No questions found' });
    }

    const skip = Math.floor(Math.random() * count);

    const questions = await prisma.question.findMany({
      take: 1,
      skip: skip,
      include: {
        testCases: true
      }
    });

    res.status(200).json({ success: true, data: questions[0] });
  } catch (error) {
    console.error('Error fetching random question:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /db/questions/demo/random - Fetches a random demo question with test cases
router.get('/questions/demo/random', async (req, res) => {
  try {
    const count = await prisma.demoQuestion.count();
    
    if (count === 0) {
      return res.status(404).json({ success: false, error: 'No demo questions found' });
    }

    const skip = Math.floor(Math.random() * count);

    const questions = await prisma.demoQuestion.findMany({
      take: 1,
      skip: skip,
      include: {
        testCases: true
      }
    });

    res.status(200).json({ success: true, data: questions[0] });
  } catch (error) {
    console.error('Error fetching random demo question:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /db/sessions - Creates a new session
router.post('/sessions', async (req, res) => {
  try {
    const { questionId, type } = req.body;

    if (!questionId || !type) {
      return res.status(400).json({ success: false, error: 'Missing questionId or type' });
    }

    const session = await prisma.session.create({
      data: {
        questionId,
        type
      }
    });

    res.status(201).json({ success: true, sessionId: session.id });
  } catch (error) {
    console.error('Error creating session:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

module.exports = router;
