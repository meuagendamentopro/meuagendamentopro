import { db, pool } from "../server/db";
import { sql } from "drizzle-orm";

async function addIsActiveColumn() {
  try {
    console.log("Adicionando coluna isActive à tabela users...");
    
    // Verificar se a coluna já existe
    const checkColumnQuery = sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'is_active';
    `;
    
    const result = await db.execute(checkColumnQuery);
    
    if (result.length > 0) {
      console.log("A coluna isActive já existe na tabela users.");
      return;
    }
    
    // Adicionar a coluna isActive à tabela users
    const alterTableQuery = sql`
      ALTER TABLE users ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE;
    `;
    
    await db.execute(alterTableQuery);
    
    console.log("Coluna isActive adicionada com sucesso à tabela users.");
    
  } catch (error) {
    console.error("Erro ao adicionar coluna isActive:", error);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

addIsActiveColumn();