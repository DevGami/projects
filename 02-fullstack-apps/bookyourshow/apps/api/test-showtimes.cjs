const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_ACCESS_SECRET || 'bys_access_secret_change_in_production_2026';

async function run() {
  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  if (!admin) {
    console.log("No admin found");
    return;
  }
  const token = jwt.sign({ id: admin.id, role: admin.role, email: admin.email }, JWT_SECRET, { expiresIn: '1h' });
  
  const fetch = (await import('node-fetch')).default;
  const res = await fetch('http://localhost:5000/api/v1/admin/showtimes?limit=5', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await res.json();
  console.log("Status:", res.status);
  console.log(JSON.stringify(data, null, 2));
}

run().finally(() => prisma.$disconnect());
