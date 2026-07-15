require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { PrismaNeon } = require('@prisma/adapter-neon');
const { neonConfig } = require('@neondatabase/serverless');
const ws = require('ws');
neonConfig.webSocketConstructor = ws;
const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function run() {
  const round = await prisma.round.findUnique({ where: { id: 'dbb4f7d7-097b-412e-a82d-11a8b9f86997' } });
  console.log(round);
}

run().catch(console.error).finally(()=>prisma.$disconnect());
