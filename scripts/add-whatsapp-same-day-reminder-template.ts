import { db } from "../server/db";
import { sql } from "drizzle-orm";
import logger from "../server/logger";

/**
 * Este script adiciona uma coluna para o template de lembretes no mesmo dia
 * na tabela providers do banco de dados
 */
async function addWhatsAppSameDayReminderTemplate() {
  try {
    // Adicionar a coluna diretamente com IF NOT EXISTS
    const addColumnQuery = sql`
      ALTER TABLE providers 
      ADD COLUMN IF NOT EXISTS whatsapp_template_same_day_reminder TEXT;
    `;
    
    await db.execute(addColumnQuery);
    logger.info("Coluna 'whatsapp_template_same_day_reminder' adicionada com sucesso à tabela providers.");
    
    return true;
  } catch (error) {
    logger.error(`Erro ao adicionar coluna 'whatsapp_template_same_day_reminder': ${error}`);
    return false;
  }
}

// Executar a migração
(async () => {
  logger.info("Iniciando migração para adicionar template de lembretes no mesmo dia...");
  
  const result = await addWhatsAppSameDayReminderTemplate();
  
  if (result) {
    logger.info("Migração concluída com sucesso!");
  } else {
    logger.info("Migração não foi necessária ou encontrou erros.");
  }
  
  process.exit(0);
})();