// Adiciona a tabela time_exclusions ao banco de dados
import { drizzle } from "drizzle-orm/neon-serverless";
import { neon, neonConfig } from '@neondatabase/serverless';
import { migrate } from "drizzle-orm/neon-serverless/migrator";
import ws from 'ws';

neonConfig.webSocketConstructor = ws;

// Função para executar a migração
async function addTimeExclusionsTable() {
  try {
    console.log("Iniciando script para adicionar a tabela time_exclusions...");
    
    // Verifica se DATABASE_URL existe
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL não encontrada nas variáveis de ambiente");
    }
    
    // Conectar ao banco de dados
    const sql = neon(process.env.DATABASE_URL!);
    const db = drizzle(sql);
    
    // Criar a tabela time_exclusions
    await sql`
      CREATE TABLE IF NOT EXISTS time_exclusions (
        id SERIAL PRIMARY KEY,
        provider_id INTEGER NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        day_of_week INTEGER,
        name TEXT,
        is_active BOOLEAN DEFAULT TRUE NOT NULL,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      );
    `;
    
    console.log("Tabela time_exclusions criada com sucesso!");
    
    return { success: true };
  } catch (error) {
    console.error("Erro ao criar tabela time_exclusions:", error);
    throw error;
  }
}

// Executar a migração
addTimeExclusionsTable()
  .then(() => {
    console.log("Script concluído com sucesso!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Erro na execução do script:", error);
    process.exit(1);
  });