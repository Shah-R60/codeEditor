const { Pool, neonConfig } = require('@neondatabase/serverless');
const ws = require('ws');
require('dotenv').config();

neonConfig.webSocketConstructor = ws;

async function renameTables() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  try {
    // Check if "Job" exists before renaming to avoid crashing if already run
    const res = await pool.query(`SELECT to_regclass('public."Job"')`);
    if (res.rows[0].to_regclass !== null) {
      console.log("Renaming Job -> HiringDrive...");
      await pool.query(`ALTER TABLE "Job" RENAME TO "HiringDrive"`);
      await pool.query(`ALTER TABLE "HiringDrive" RENAME CONSTRAINT "Job_pkey" TO "HiringDrive_pkey"`);
      await pool.query(`ALTER TABLE "HiringDrive" RENAME CONSTRAINT "Job_recruiterId_fkey" TO "HiringDrive_recruiterId_fkey"`);
    } else {
      console.log("Job table not found, perhaps already renamed.");
    }

    const res2 = await pool.query(`SELECT to_regclass('public."Stage"')`);
    if (res2.rows[0].to_regclass !== null) {
      console.log("Renaming Stage -> Round...");
      await pool.query(`ALTER TABLE "Stage" RENAME TO "Round"`);
      await pool.query(`ALTER TABLE "Round" RENAME COLUMN "jobId" TO "hiringDriveId"`);
      await pool.query(`ALTER TABLE "Round" RENAME CONSTRAINT "Stage_pkey" TO "Round_pkey"`);
      await pool.query(`ALTER TABLE "Round" RENAME CONSTRAINT "Stage_jobId_fkey" TO "Round_hiringDriveId_fkey"`);
      
      // Add new fields
      console.log("Adding new fields to Round...");
      await pool.query(`ALTER TABLE "Round" ADD COLUMN IF NOT EXISTS "startDate" TIMESTAMP(3)`);
      await pool.query(`ALTER TABLE "Round" ADD COLUMN IF NOT EXISTS "endDate" TIMESTAMP(3)`);
      await pool.query(`ALTER TABLE "Round" ADD COLUMN IF NOT EXISTS "timeZone" TEXT`);
      await pool.query(`ALTER TABLE "Round" ADD COLUMN IF NOT EXISTS "deadline" TIMESTAMP(3)`);
      await pool.query(`ALTER TABLE "Round" ADD COLUMN IF NOT EXISTS "config" JSONB`);
    }

    const res3 = await pool.query(`SELECT to_regclass('public."Candidate"')`);
    if (res3.rows[0].to_regclass !== null) {
      // Check if candidate still has jobId
      const colRes = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name='Candidate' and column_name='jobId'
      `);
      if (colRes.rows.length > 0) {
        console.log("Updating Candidate table relations...");
        await pool.query(`ALTER TABLE "Candidate" RENAME COLUMN "jobId" TO "hiringDriveId"`);
        await pool.query(`ALTER TABLE "Candidate" RENAME CONSTRAINT "Candidate_jobId_fkey" TO "Candidate_hiringDriveId_fkey"`);
      }
    }

    console.log("Migration successful");
  } catch (err) {
    console.error("Migration failed", err);
  } finally {
    await pool.end();
  }
}

renameTables();
