require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { PrismaNeon } = require('@prisma/adapter-neon');
const { neonConfig } = require('@neondatabase/serverless');
const ws = require('ws');
neonConfig.webSocketConstructor = ws;
const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const drives = await prisma.hiringDrive.findMany({
    include: { rounds: true }
  });
  
  for (const d of drives) {
    for (const r of d.rounds) {
      console.log(`Drive: ${d.title}, Round: ${r.name}`);
      console.log(`Config type:`, typeof r.config);
      console.log(`Config value:`, JSON.stringify(r.config, null, 2));
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
