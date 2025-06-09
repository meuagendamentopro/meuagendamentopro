// Script de migração para adicionar o campo trial_period_days à tabela system_settings
import pg from 'pg';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const { Pool } = pg;

// Configurações locais para desenvolvimento
const localConfig = {
  database: {
    url: 'postgres://postgres:linday1818@localhost:5432/agendamento'
  }
};

// Obter o diretório atual
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function main() {
  console.log("Iniciando migração para adicionar campo de período de teste nas configurações do sistema...");
  
  // Criar conexão com o banco de dados
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || localConfig.database.url,
  });
  
  try {
    // Adicionar a coluna trial_period_days à tabela system_settings
    await pool.query(`
      ALTER TABLE system_settings 
      ADD COLUMN IF NOT EXISTS trial_period_days INTEGER NOT NULL DEFAULT 3;
    `);
    
    console.log("Coluna trial_period_days adicionada com sucesso!");
    
    // Atualizar as configurações existentes para definir o valor padrão
    await pool.query(`
      UPDATE system_settings 
      SET trial_period_days = 3 
      WHERE trial_period_days IS NULL;
    `);
    
    console.log("Migração concluída com sucesso!");
  } catch (error) {
    console.error("Erro durante a migração:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
  
  process.exit(0);
}

main();
