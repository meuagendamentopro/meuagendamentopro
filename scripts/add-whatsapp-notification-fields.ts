#!/usr/bin/env tsx
/**
 * Script para adicionar campos necessários para notificações WhatsApp
 * - Adiciona campo reminderSent à tabela appointments
 * 
 * Uso: npx tsx scripts/add-whatsapp-notification-fields.ts
 */

import { db } from '../server/db';
import { sql } from 'drizzle-orm';
import chalk from 'chalk';

// Cores para console
const colors = {
  success: chalk.green,
  error: chalk.red,
  warning: chalk.yellow,
  info: chalk.blue,
  bold: chalk.bold,
};

async function addWhatsappNotificationFields() {
  console.log(colors.info('Adicionando campos para notificações WhatsApp...'));
  
  try {
    // Verificar se o campo reminderSent já existe
    const columnExists = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'appointments' AND column_name = 'reminder_sent'
      ) as exists
    `);
    
    const exists = columnExists[0]?.exists === true;
    
    if (exists) {
      console.log(colors.warning('O campo reminder_sent já existe na tabela appointments. Nenhuma alteração realizada.'));
      return;
    }
    
    // Adicionar campo reminderSent
    await db.execute(sql`
      ALTER TABLE appointments 
      ADD COLUMN reminder_sent BOOLEAN NOT NULL DEFAULT false
    `);
    
    console.log(colors.success('✓ Campo reminder_sent adicionado com sucesso à tabela appointments'));
    
    // Atualizar valores existentes
    await db.execute(sql`
      UPDATE appointments 
      SET reminder_sent = true 
      WHERE appointment_date < NOW()
    `);
    
    console.log(colors.success('✓ Valores atualizados para agendamentos passados'));
    
    console.log(colors.bold('\n=== Migração concluída com sucesso ==='));
    
  } catch (error: any) {
    console.error(colors.error('Erro durante a migração:'), error.message);
    throw error;
  }
}

// Executar o script
addWhatsappNotificationFields()
  .then(() => {
    console.log('Migração concluída com sucesso.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Erro durante a migração:', error);
    process.exit(1);
  });