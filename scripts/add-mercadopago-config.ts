/**
 * Este script adiciona campos de configuração específicos do Mercado Pago ao banco de dados
 * - Token de acesso individual do Mercado Pago por provider
 * - Número de CPF/CNPJ para identificação no Mercado Pago
 */

import { db, pool, closeDb } from "../server/db";
import { sql } from "drizzle-orm";

async function addMercadoPagoConfig() {
  console.log("Iniciando adição de campos para configuração do Mercado Pago...");

  try {
    // Adicionando campos à tabela providers
    await db.execute(sql`
      ALTER TABLE "providers" 
      ADD COLUMN IF NOT EXISTS "pix_mercadopago_token" TEXT,
      ADD COLUMN IF NOT EXISTS "pix_identification_number" TEXT;
    `);
    console.log("Campos de configuração do Mercado Pago adicionados à tabela providers com sucesso!");

    return true;
  } catch (error) {
    console.error("Erro ao adicionar campos para configuração do Mercado Pago:", error);
    return false;
  } finally {
    await closeDb();
  }
}

// Executar o script
addMercadoPagoConfig().then((success) => {
  if (success) {
    console.log("Script concluído com sucesso!");
    process.exit(0);
  } else {
    console.error("Falha ao executar o script.");
    process.exit(1);
  }
});