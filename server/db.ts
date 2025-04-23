import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from 'ws';
import * as schema from '@shared/schema';

// Configuração para WebSockets
neonConfig.webSocketConstructor = ws;

// Verifica se a URL do banco de dados está definida
if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL deve ser definida. Você esqueceu de provisionar um banco de dados?"
  );
}

// Cria o pool de conexão
export const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Exporta a instância do Drizzle ORM
export const db = drizzle(pool, { schema });

// Função de limpeza para encerrar o pool quando o servidor for desligado
export async function closeDb() {
  await pool.end();
}