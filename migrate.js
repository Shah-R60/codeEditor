const { Pool, neonConfig } = require('@neondatabase/serverless');
const ws = require('ws');
require('dotenv').config();

neonConfig.webSocketConstructor = ws;

async function migrate() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "DemoQuestion" (
        "id" TEXT NOT NULL,
        "title" TEXT NOT NULL,
        "description" TEXT NOT NULL,
        "difficulty" TEXT NOT NULL,
        "boilerplate" JSONB,
        CONSTRAINT "DemoQuestion_pkey" PRIMARY KEY ("id")
      );
    `);
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "DemoTestCase" (
        "id" TEXT NOT NULL,
        "demoQuestionId" TEXT NOT NULL,
        "input" TEXT NOT NULL,
        "expectedOutput" TEXT NOT NULL,
        "isHidden" BOOLEAN NOT NULL DEFAULT false,
        CONSTRAINT "DemoTestCase_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "DemoTestCase_demoQuestionId_fkey" FOREIGN KEY ("demoQuestionId") REFERENCES "DemoQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE
      );
    `);
    
    console.log("Migration successful");
  } catch (err) {
    console.error("Migration failed", err);
  } finally {
    await pool.end();
  }
}

migrate();
