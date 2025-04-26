import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from 'ws';
import * as schema from '../shared/schema';

// Configurar o WebSocket para NeonDB
neonConfig.webSocketConstructor = ws;

// Certificar-se de que a variável de ambiente DATABASE_URL está definida
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL não está definida');
  process.exit(1);
}

async function addActiveColumn() {
  console.log('Adicionando coluna active à tabela clients...');
  
  // Conectar ao banco de dados
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool, { schema });
  
  try {
    // Verificar se a coluna já existe
    const columnExists = await db.execute(`
      SELECT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'clients' AND column_name = 'active'
      );
    `);
    
    const exists = columnExists.rows[0]?.exists === true;
    
    if (exists) {
      console.log('A coluna active já existe na tabela clients.');
    } else {
      // Adicionar a coluna active à tabela clients
      await db.execute(`
        ALTER TABLE clients 
        ADD COLUMN active BOOLEAN NOT NULL DEFAULT TRUE;
      `);
      console.log('Coluna active adicionada com sucesso à tabela clients!');
    }
    
    console.log('Migração concluída com sucesso!');
  } catch (error) {
    console.error('Erro durante a migração:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

addActiveColumn();