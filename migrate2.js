const { Pool, neonConfig } = require('@neondatabase/serverless');
const ws = require('ws');
require('dotenv').config();

neonConfig.webSocketConstructor = ws;

async function migrate() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  try {
    console.log("Adding location and announcements to HiringDrive...");
    await pool.query(`ALTER TABLE "HiringDrive" ADD COLUMN IF NOT EXISTS "location" TEXT DEFAULT 'Online'`);
    await pool.query(`ALTER TABLE "HiringDrive" ADD COLUMN IF NOT EXISTS "announcements" JSONB`);
    
    console.log("Adding rank to Candidate...");
    await pool.query(`ALTER TABLE "Candidate" ADD COLUMN IF NOT EXISTS "rank" INTEGER`);
    
    console.log("Seeding test data into HiringDrive b56ace51-5557-4833-9936-74cfb9c1c772...");
    
    const announcements = [
      { title: "Interview timings updated", description: "Please check the technical round schedule.", date: new Date().toISOString() },
      { title: "HR round shifted to 21 July", description: "Rescheduled due to panel availability.", date: new Date().toISOString() }
    ];
    
    await pool.query(`
      UPDATE "HiringDrive" 
      SET "location" = 'ABC Institute Main Campus',
          "announcements" = $1
      WHERE "id" = 'b56ace51-5557-4833-9936-74cfb9c1c772'
    `, [JSON.stringify(announcements)]);

    console.log("Updating Rounds with dynamic config data...");
    
    const config1 = {
      format: "4 Coding, 20 MCQs",
      allowedLanguages: ["C++", "Java", "Python"],
      rules: [
        "Stable internet required for the duration of the test.",
        "Full-screen mode will be enforced.",
        "Webcam access is required for proctoring.",
        "Tab switching is strictly monitored and flagged."
      ]
    };
    
    await pool.query(`
      UPDATE "Round"
      SET "config" = $1
      WHERE "hiringDriveId" = 'b56ace51-5557-4833-9936-74cfb9c1c772' AND "name" = 'Online Assessment'
    `, [JSON.stringify(config1)]);
    
    console.log("Updating rank for the specific user...");
    await pool.query(`
      UPDATE "Candidate"
      SET "rank" = 12, "score" = '88%', "status" = 'Passed'
      WHERE "email" = 'student@example.com' AND "hiringDriveId" = 'b56ace51-5557-4833-9936-74cfb9c1c772'
    `);

    console.log("Migration successful");
  } catch (err) {
    console.error("Migration failed", err);
  } finally {
    await pool.end();
  }
}

migrate();
