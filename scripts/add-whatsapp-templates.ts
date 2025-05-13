import { db } from "../server/db";
import { sql } from "drizzle-orm";
import logger from "../server/logger";
import { DEFAULT_TEMPLATES } from "../server/whatsapp-templates";

/**
 * Este script adiciona campos para armazenar templates personalizados 
 * de mensagens do WhatsApp na tabela providers.
 */
async function addWhatsappTemplateFields() {
  try {
    logger.info("Adicionando campos de templates WhatsApp à tabela providers...");

    // Verifica se a coluna já existe
    const checkColumnQuery = sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'providers' 
      AND column_name = 'whatsapp_template_confirmation'
    `;
    
    const columnExists = await db.execute(checkColumnQuery);
    
    if ((columnExists as any).rows && (columnExists as any).rows.length > 0) {
      logger.info("Campos de templates WhatsApp já existem na tabela providers");
      return;
    }

    // Adiciona colunas para cada tipo de template
    await db.execute(sql`
      ALTER TABLE providers
      ADD COLUMN whatsapp_template_confirmation TEXT,
      ADD COLUMN whatsapp_template_reminder TEXT,
      ADD COLUMN whatsapp_template_cancellation TEXT,
      ADD COLUMN whatsapp_template_reschedule TEXT
    `);

    // Define valores padrão para os templates
    await db.execute(sql`
      UPDATE providers 
      SET 
        whatsapp_template_confirmation = ${DEFAULT_TEMPLATES.confirmation},
        whatsapp_template_reminder = ${DEFAULT_TEMPLATES.reminder},
        whatsapp_template_cancellation = ${DEFAULT_TEMPLATES.cancellation},
        whatsapp_template_reschedule = ${DEFAULT_TEMPLATES.reschedule}
      WHERE 
        whatsapp_enabled = TRUE
    `);

    logger.info("Campos de templates WhatsApp adicionados com sucesso!");
  } catch (error) {
    logger.error(`Erro ao adicionar campos de templates WhatsApp: ${error}`);
    throw error;
  }
}

// Executa a função principal
addWhatsappTemplateFields()
  .then(() => {
    logger.info("Script concluído com sucesso");
    process.exit(0);
  })
  .catch((error) => {
    logger.error(`Erro ao executar script: ${error}`);
    process.exit(1);
  });