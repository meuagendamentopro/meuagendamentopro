/**
 * Script para adicionar a tabela message_templates ao banco de dados
 * Executar: npx tsx scripts/add-message-templates.ts
 */

import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { migrate } from 'drizzle-orm/neon-serverless/migrator';
import { messageTemplates } from '../shared/schema';
import { sql } from 'drizzle-orm';
import chalk from 'chalk';
import ws from "ws";

// Configurar WebSocket para conexão com Neon
neonConfig.webSocketConstructor = ws;

async function addMessageTemplates() {
  // Verificar se a variável DATABASE_URL está definida
  if (!process.env.DATABASE_URL) {
    console.error(chalk.red('❌ Variável DATABASE_URL não encontrada. Defina-a antes de executar este script.'));
    process.exit(1);
  }

  console.log(chalk.blue('📊 Conectando ao banco de dados...'));
  
  // Conectar ao banco de dados
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool);

  try {
    console.log(chalk.yellow('🔍 Verificando se a tabela message_templates já existe...'));

    // Verificar se a tabela message_templates já existe
    const tableExists = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'message_templates'
      );
    `);
    
    const exists = tableExists[0]?.exists === true;

    if (exists) {
      console.log(chalk.green('✅ A tabela message_templates já existe no banco de dados.'));
    } else {
      console.log(chalk.yellow('⚠️ A tabela message_templates não existe. Criando...'));

      // Criar tabela message_templates
      await db.execute(sql`
        CREATE TABLE message_templates (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          templates TEXT NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        );
      `);

      console.log(chalk.green('✅ Tabela message_templates criada com sucesso!'));
    }

    // Fechar a conexão com o banco de dados
    await pool.end();
    
    console.log(chalk.green('✅ Script executado com sucesso!'));
  } catch (error) {
    console.error(chalk.red('❌ Erro ao executar o script:'), error);
    
    // Fechar a conexão com o banco de dados
    await pool.end();
    
    process.exit(1);
  }
}

// Executar a função principal
addMessageTemplates().catch(console.error);