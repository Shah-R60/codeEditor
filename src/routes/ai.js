const express = require('express');
const Groq = require('groq-sdk');
const router = express.Router();

const groq = process.env.GROQ_API_KEY ? new Groq({ apiKey: process.env.GROQ_API_KEY }) : null;

// POST /ai/chat - Stream an AI chat response
router.post('/chat', async (req, res) => {
  const { messages } = req.body;
  
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Messages array is required' });
  }

  if (!groq) {
    return res.status(500).json({ error: 'GROQ_API_KEY is not configured on the server.' });
  }

  // Inject system prompt to enforce conciseness and context awareness
  const systemPrompt = {
    role: "system",
    content: "You are an expert technical interviewer and AI coding assistant. Your primary goal is to help the interviewer evaluate the candidate, understand the code, and identify bugs. You are given the context of the interview (code, question, compile output) invisibly in the user's prompt. ALWAYS keep your answers extremely concise and to the point. Do not be overly chatty."
  };

  const fullMessages = [systemPrompt, ...messages];

  try {
    // Set up SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders(); // flush the headers to establish SSE

    const stream = await groq.chat.completions.create({
      messages: fullMessages,
      model: "llama-3.1-8b-instant", // Use a fast and capable model
      stream: true,
      temperature: 0.5,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || "";
      if (content) {
        // Send the chunk data formatted for SSE
        res.write(`data: ${JSON.stringify({ text: content })}\n\n`);
      }
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error) {
    console.error('AI Chat Error:', error);
    if (!res.headersSent) {
      return res.status(500).json({ error: 'Failed to generate AI response' });
    } else {
      res.write(`data: ${JSON.stringify({ error: 'Generation failed' })}\n\n`);
      res.end();
    }
  }
});

module.exports = router;
