import { drizzle } from "drizzle-orm/neon-serverless";
import { neon, NeonQueryFunction } from "@neondatabase/serverless";
import { pgTable, boolean, text } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/**
 * Script para adicionar campos necessários para notificações WhatsApp
 * - Adiciona campo reminderSent à tabela appointments
 * 
 * Uso: npx tsx scripts/add-whatsapp-notification-fields.ts
 */

// Conexão com o banco de dados
const URI = process.env.DATABASE_URL;
if (!URI) {
  throw new Error("DATABASE_URL não definida");
}

const sql_query = neon(URI);
const db = drizzle(sql_query);

async function addWhatsappNotificationFields() {
  try {
    console.log("Verificando se a coluna 'reminder_sent' já existe na tabela 'appointments'...");

    // Verificar se a coluna já existe
    const checkColumn = await sql_query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='appointments' AND column_name='reminder_sent'
    `);

    if (checkColumn.length === 0) {
      console.log("Adicionando coluna 'reminder_sent' à tabela 'appointments'...");
      
      // Adicionar a coluna
      await sql_query(`
        ALTER TABLE appointments 
        ADD COLUMN reminder_sent BOOLEAN NOT NULL DEFAULT false
      `);
      
      console.log("✅ Coluna 'reminder_sent' adicionada com sucesso!");
    } else {
      console.log("✅ Coluna 'reminder_sent' já existe na tabela 'appointments'.");
    }

    // Verificar e adicionar os campos de credenciais do Twilio ao .env se necessário
    console.log("Verificando variáveis de ambiente para notificações WhatsApp...");
    
    if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_PHONE_NUMBER) {
      console.log(`
        ⚠️ Aviso: Variáveis de ambiente necessárias para notificações WhatsApp não estão configuradas.
        
        Para ativar notificações WhatsApp, adicione as seguintes variáveis ao arquivo .env:
        
        TWILIO_ACCOUNT_SID=seu_account_sid_do_twilio
        TWILIO_AUTH_TOKEN=seu_auth_token_do_twilio
        TWILIO_PHONE_NUMBER=seu_numero_whatsapp_twilio (formato: whatsapp:+5511999999999)
        
        Você pode obter essas credenciais no painel do Twilio (https://console.twilio.com/).
      `);
    } else {
      console.log("✅ Variáveis de ambiente para notificações WhatsApp já configuradas.");
    }

    console.log("Operação concluída com sucesso!");
  } catch (error) {
    console.error("❌ Erro ao adicionar campos para notificações WhatsApp:", error);
    process.exit(1);
  }
}

// Executar a função principal
addWhatsappNotificationFields()
  .then(() => {
    console.log("Script finalizado.");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Erro fatal:", error);
    process.exit(1);
  });