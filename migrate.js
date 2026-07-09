const { Pool, neonConfig } = require('@neondatabase/serverless');
const ws = require('ws');
require('dotenv').config();

neonConfig.webSocketConstructor = ws;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function migrate() {
  console.log("Starting manual migration over WebSocket...");
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "Job" (
        "id" TEXT NOT NULL,
        "title" TEXT NOT NULL,
        "department" TEXT,
        "status" TEXT NOT NULL DEFAULT 'Active',
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "recruiterId" TEXT NOT NULL,
        CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
      );
    `);
    console.log("Job table created.");

    await pool.query(`
      CREATE TABLE IF NOT EXISTS "Stage" (
        "id" TEXT NOT NULL,
        "jobId" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "type" TEXT NOT NULL,
        "duration" TEXT NOT NULL,
        "description" TEXT,
        "order" INTEGER NOT NULL DEFAULT 0,
        CONSTRAINT "Stage_pkey" PRIMARY KEY ("id")
      );
    `);
    console.log("Stage table created.");

    await pool.query(`
      CREATE TABLE IF NOT EXISTS "Candidate" (
        "id" TEXT NOT NULL,
        "jobId" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "email" TEXT NOT NULL,
        "stage" TEXT NOT NULL DEFAULT 'Applied',
        "status" TEXT NOT NULL DEFAULT 'In Review',
        "score" TEXT,
        "timeTaken" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "Candidate_pkey" PRIMARY KEY ("id")
      );
    `);
    console.log("Candidate table created.");

    // Add foreign keys (Ignore errors if they already exist, by wrapping in try/catch)
    try {
      await pool.query(`ALTER TABLE "Job" ADD CONSTRAINT "Job_recruiterId_fkey" FOREIGN KEY ("recruiterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;`);
      console.log("FK Job -> User added.");
    } catch (e) { console.log("FK Job -> User might already exist."); }

    try {
      await pool.query(`ALTER TABLE "Stage" ADD CONSTRAINT "Stage_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;`);
      console.log("FK Stage -> Job added.");
    } catch (e) { console.log("FK Stage -> Job might already exist."); }

    try {
      await pool.query(`ALTER TABLE "Candidate" ADD CONSTRAINT "Candidate_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;`);
      console.log("FK Candidate -> Job added.");
    } catch (e) { console.log("FK Candidate -> Job might already exist."); }

    console.log("Migration finished.");
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    pool.end();
  }
}

migrate();
