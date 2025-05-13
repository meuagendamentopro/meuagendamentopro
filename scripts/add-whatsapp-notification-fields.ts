/**
 * Script para adicionar campos de notificação WhatsApp ao banco de dados
 * - Adiciona configurações do Twilio para envio de mensagens WhatsApp
 * - Adiciona opções de configuração para diferentes tipos de notificação
 */

import { drizzle } from 'drizzle-orm/neon-serverless';
import { Pool } from '@neondatabase/serverless';
import { boolean } from 'drizzle-orm/pg-core';
import { text } from 'drizzle-orm/pg-core';
import { migrate } from 'drizzle-orm/neon-serverless/migrator';
import chalk from 'chalk';

async function addWhatsappNotificationFields() {
  console.log(chalk.blue('Adicionando campos de notificação WhatsApp ao banco de dados...'));

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL não encontrada no ambiente');
  }

  // Conexão com o banco de dados
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool);

  try {
    // Adicionar os campos à tabela providers manualmente
    await pool.query(`
      -- Adiciona campos de configuração do Twilio
      ALTER TABLE providers 
      ADD COLUMN IF NOT EXISTS whatsapp_enabled BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS twilio_account_sid TEXT,
      ADD COLUMN IF NOT EXISTS twilio_auth_token TEXT,
      ADD COLUMN IF NOT EXISTS twilio_phone_number TEXT,
      ADD COLUMN IF NOT EXISTS enable_appointment_confirmation BOOLEAN DEFAULT TRUE,
      ADD COLUMN IF NOT EXISTS enable_appointment_reminder BOOLEAN DEFAULT TRUE,
      ADD COLUMN IF NOT EXISTS enable_cancellation_notice BOOLEAN DEFAULT TRUE;

      -- Adiciona campo para acompanhar lembretes enviados
      ALTER TABLE appointments
      ADD COLUMN IF NOT EXISTS reminder_sent BOOLEAN DEFAULT FALSE;
    `);

    console.log(chalk.green('✅ Campos de notificação WhatsApp adicionados com sucesso!'));
    
    // Exibir informações sobre os novos campos
    console.log(chalk.yellow('\nCampos adicionados à tabela providers:'));
    console.log('- whatsapp_enabled: Se as notificações WhatsApp estão habilitadas');
    console.log('- twilio_account_sid: Account SID do Twilio');
    console.log('- twilio_auth_token: Auth Token do Twilio');
    console.log('- twilio_phone_number: Número de telefone do Twilio (formato +XXXXXXXXXXX)');
    console.log('- enable_appointment_confirmation: Enviar confirmação de agendamento');
    console.log('- enable_appointment_reminder: Enviar lembrete de agendamento');
    console.log('- enable_cancellation_notice: Enviar notificação de cancelamento');
    
    console.log(chalk.yellow('\nCampos adicionados à tabela appointments:'));
    console.log('- reminder_sent: Se o lembrete foi enviado para este agendamento');

  } catch (error) {
    console.error(chalk.red('❌ Erro ao adicionar campos de notificação WhatsApp:'), error);
    throw error;
  } finally {
    await pool.end();
  }
}

addWhatsappNotificationFields().catch(console.error);