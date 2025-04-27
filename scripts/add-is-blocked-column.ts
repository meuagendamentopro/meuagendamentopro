import { pool, db, closeDb } from "../server/db";
import { clients } from "../shared/schema";
import { sql } from "drizzle-orm";

async function addIsBlockedColumn() {
  try {
    console.log("Verificando se a coluna is_blocked já existe...");
    
    // Verificar se a coluna já existe
    const checkResult = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'clients' AND column_name = 'is_blocked'
    `);
    
    if (checkResult.rows.length === 0) {
      console.log("Adicionando coluna is_blocked à tabela clients...");
      
      // Adicionar a coluna is_blocked se não existir
      await pool.query(`
        ALTER TABLE clients 
        ADD COLUMN is_blocked BOOLEAN NOT NULL DEFAULT false
      `);
      
      console.log("Coluna is_blocked adicionada com sucesso!");
    } else {
      console.log("A coluna is_blocked já existe na tabela clients.");
    }
    
  } catch (error) {
    console.error("Erro ao adicionar coluna is_blocked:", error);
  } finally {
    await closeDb();
  }
}

addIsBlockedColumn();