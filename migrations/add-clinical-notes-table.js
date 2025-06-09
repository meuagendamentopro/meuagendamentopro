// Migração para adicionar a tabela de anotações clínicas
import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Configurar __dirname em ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://postgres:linday1818@localhost:5432/agendamento'
});

async function createClinicalNotesTable() {
  try {
    console.log('Iniciando migração para criar tabela de anotações clínicas...');
    
    // Verificar se a tabela já existe
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'clinical_notes'
      );
    `);
    
    if (tableCheck.rows[0].exists) {
      console.log('A tabela clinical_notes já existe. Pulando criação.');
    } else {
      // Criar a tabela de anotações clínicas
      await pool.query(`
        CREATE TABLE clinical_notes (
          id SERIAL PRIMARY KEY,
          appointment_id INTEGER NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
          provider_id INTEGER NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
          client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
          content TEXT NOT NULL,
          is_private BOOLEAN NOT NULL DEFAULT TRUE,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        );
      `);
      
      console.log('Tabela clinical_notes criada com sucesso!');
      
      // Criar índices para melhorar a performance das consultas
      await pool.query(`
        CREATE INDEX idx_clinical_notes_appointment_id ON clinical_notes(appointment_id);
        CREATE INDEX idx_clinical_notes_provider_id ON clinical_notes(provider_id);
        CREATE INDEX idx_clinical_notes_client_id ON clinical_notes(client_id);
      `);
      
      console.log('Índices criados com sucesso!');
    }
    
    console.log('Migração concluída com sucesso!');
  } catch (error) {
    console.error('Erro durante a migração:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Executar a migração como uma função auto-invocada
(async () => {
  try {
    await createClinicalNotesTable();
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
})();
