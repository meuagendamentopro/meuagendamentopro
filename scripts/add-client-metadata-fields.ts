/**
 * Esse script adiciona os campos de metadados de cliente temporário na tabela appointments
 * para permitir armazenar informações de clientes até que o pagamento seja confirmado
 */

import { db, pool, closeDb } from "../server/db";
import { appointments } from "../shared/schema";
import { sql } from "drizzle-orm";

async function addClientMetadataFields() {
  console.log("Iniciando adição de campos para metadados de cliente temporário...");

  try {
    // Adicionando campos de metadados de cliente à tabela appointments
    await db.execute(sql`
      ALTER TABLE "appointments" 
      ADD COLUMN IF NOT EXISTS "client_name" TEXT,
      ADD COLUMN IF NOT EXISTS "client_phone" TEXT,
      ADD COLUMN IF NOT EXISTS "client_email" TEXT,
      ADD COLUMN IF NOT EXISTS "client_notes" TEXT;
    `);
    console.log("Campos de metadados de cliente adicionados à tabela appointments");
    
    console.log("Migração concluída com sucesso!");
  } catch (error) {
    console.error("Erro durante a migração:", error);
  } finally {
    await closeDb();
  }
}

// Executar o script
addClientMetadataFields();