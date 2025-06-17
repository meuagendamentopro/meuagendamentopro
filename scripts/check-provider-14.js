const { db, pool } = require('../server/db');
const { providers } = require('../shared/schema');
const { eq } = require('drizzle-orm');

async function checkProvider() {
  try {
    const provider = await db.select().from(providers).where(eq(providers.id, 14)).limit(1);
    console.log('Provider 14:', JSON.stringify(provider[0], null, 2));
  } catch (error) {
    console.error('Erro:', error);
  } finally {
    await pool.end();
  }
}

checkProvider(); 