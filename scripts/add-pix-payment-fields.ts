/**
 * Esse script adiciona os campos necessários para a funcionalidade de pagamento PIX
 * - Adiciona campos de configuração PIX na tabela providers
 * - Adiciona campos de pagamento na tabela appointments
 */

import { db, pool, closeDb } from "../server/db";
import { providers, appointments } from "../shared/schema";
import { sql } from "drizzle-orm";

async function addPixPaymentFields() {
  console.log("Iniciando adição de campos para pagamento PIX...");

  try {
    // Adicionando campos PIX à tabela providers
    await db.execute(sql`
      ALTER TABLE "providers" 
      ADD COLUMN IF NOT EXISTS "pix_enabled" BOOLEAN DEFAULT FALSE NOT NULL,
      ADD COLUMN IF NOT EXISTS "pix_key_type" TEXT,
      ADD COLUMN IF NOT EXISTS "pix_key" TEXT,
      ADD COLUMN IF NOT EXISTS "pix_require_payment" BOOLEAN DEFAULT FALSE NOT NULL,
      ADD COLUMN IF NOT EXISTS "pix_payment_percentage" INTEGER DEFAULT 100,
      ADD COLUMN IF NOT EXISTS "pix_company_name" TEXT,
      ADD COLUMN IF NOT EXISTS "pix_merchant_id" TEXT,
      ADD COLUMN IF NOT EXISTS "pix_webhook_secret" TEXT;
    `);
    console.log("Campos PIX adicionados à tabela providers");

    // Adicionando campos de pagamento à tabela appointments
    await db.execute(sql`
      ALTER TABLE "appointments" 
      ADD COLUMN IF NOT EXISTS "requires_payment" BOOLEAN DEFAULT FALSE NOT NULL,
      ADD COLUMN IF NOT EXISTS "payment_status" TEXT DEFAULT 'not_required',
      ADD COLUMN IF NOT EXISTS "payment_amount" INTEGER,
      ADD COLUMN IF NOT EXISTS "payment_percentage" INTEGER,
      ADD COLUMN IF NOT EXISTS "pix_transaction_id" TEXT,
      ADD COLUMN IF NOT EXISTS "pix_qr_code" TEXT,
      ADD COLUMN IF NOT EXISTS "pix_qr_code_expiration" TIMESTAMP,
      ADD COLUMN IF NOT EXISTS "pix_payment_date" TIMESTAMP;
    `);
    console.log("Campos de pagamento adicionados à tabela appointments");

    console.log("Migração concluída com sucesso!");
  } catch (error) {
    console.error("Erro durante a migração:", error);
  } finally {
    await closeDb();
  }
}

// Executar o script
addPixPaymentFields();