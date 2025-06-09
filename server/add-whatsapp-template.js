// Script para adicionar a coluna whatsapp_template_appointment à tabela providers
import pg from 'pg';
const { Pool } = pg;
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// Configurar o path para o arquivo .env
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, '../.env') });

// Usa a URL do banco de dados do ambiente
const databaseUrl = process.env.DATABASE_URL;

// Verifica se a URL do banco de dados está definida
if (!databaseUrl) {
  console.error("DATABASE_URL deve ser definida no arquivo .env");
  process.exit(1);
}

async function addWhatsappTemplateColumn() {
  const pool = new Pool({ connectionString: databaseUrl });
  
  try {
    console.log('Iniciando migração: Adicionando coluna whatsapp_template_appointment à tabela providers');
    
    // Verificar se a coluna já existe
    const checkColumnExists = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'providers' 
      AND column_name = 'whatsapp_template_appointment'
    `);
    
    // Se a coluna não existir, adicioná-la
    if (checkColumnExists.rows.length === 0) {
      await pool.query(`
        ALTER TABLE providers 
        ADD COLUMN IF NOT EXISTS whatsapp_template_appointment TEXT
      `);
      console.log('Coluna whatsapp_template_appointment adicionada com sucesso à tabela providers');
    } else {
      console.log('Coluna whatsapp_template_appointment já existe na tabela providers');
    }
    
    console.log('Migração concluída com sucesso');
  } catch (error) {
    console.error('Erro ao executar migração:', error);
  } finally {
    await pool.end();
  }
}

// Executar a migração
addWhatsappTemplateColumn();
