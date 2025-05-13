/**
 * Script para migrar os dados do banco atual para um banco PostgreSQL local
 * 
 * Este script:
 * 1. Extrai todos os dados do banco de dados atual (Neon ou outro)
 * 2. Cria as tabelas necessárias em um banco PostgreSQL local
 * 3. Insere os dados extraídos no banco local
 * 
 * Pré-requisitos:
 * - PostgreSQL instalado localmente
 * - Banco de dados chamado "agendadb" já criado (ou altere o nome abaixo)
 * - Variáveis de ambiente configuradas (ou configure o objeto localDbConfig abaixo)
 * 
 * Uso:
 * $ npx tsx scripts/migrate-to-local-db.ts
 */

import { db as sourceDb, pool as sourcePool } from '../server/db';
import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { sql } from 'drizzle-orm';
import * as schema from '../shared/schema';
import { hashPassword } from '../server/auth';
import chalk from 'chalk';
import readline from 'readline';

// Carregar variáveis de ambiente
dotenv.config();

// Cores para console
const colors = {
  success: chalk.green,
  error: chalk.red,
  warning: chalk.yellow,
  info: chalk.blue,
  bold: chalk.bold,
};

// Configuração do banco de dados local
// Se não quiser usar variáveis de ambiente, configure diretamente aqui
const localDbConfig = {
  host: process.env.LOCAL_DB_HOST || 'localhost',
  port: parseInt(process.env.LOCAL_DB_PORT || '5432'),
  database: process.env.LOCAL_DB_NAME || 'agendadb',
  user: process.env.LOCAL_DB_USER || 'postgres',
  password: process.env.LOCAL_DB_PASSWORD || 'postgres'
};

// Criar pool de conexão para o banco local
const localPool = new Pool(localDbConfig);

// Interface para leitura de input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Função para perguntar ao usuário
const ask = (question: string): Promise<string> => {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
};

// 1. Extrair dados do banco atual
async function extractData() {
  console.log(colors.info('Extraindo dados do banco de dados atual...'));
  
  const data: Record<string, any[]> = {};
  
  try {
    // Extrair dados de todas as tabelas
    data.users = await sourceDb.select().from(schema.users);
    data.providers = await sourceDb.select().from(schema.providers);
    data.clients = await sourceDb.select().from(schema.clients);
    data.services = await sourceDb.select().from(schema.services);
    data.appointments = await sourceDb.select().from(schema.appointments);
    data.notifications = await sourceDb.select().from(schema.notifications);
    data.providerClients = await sourceDb.select().from(schema.providerClients);
    data.timeExclusions = await sourceDb.select().from(schema.timeExclusions);
    data.subscriptionPlans = await sourceDb.select().from(schema.subscriptionPlans);
    data.subscriptionTransactions = await sourceDb.select().from(schema.subscriptionTransactions);
    
    console.log(colors.success('✓ Dados extraídos com sucesso'));
    
    // Mostrar resumo
    for (const [table, rows] of Object.entries(data)) {
      console.log(`  - ${table}: ${rows.length} registros`);
    }
    
    return data;
  } catch (error: any) {
    console.error(colors.error(`Erro ao extrair dados: ${error.message}`));
    throw error;
  }
}

// 2. Criar tabelas no banco local
async function createTables() {
  console.log(colors.info('\nCriando tabelas no banco de dados local...'));
  
  try {
    // Verificar se o banco já tem tabelas
    const existingTablesResult = await localPool.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    
    const existingTables = existingTablesResult.rows.map(row => row.table_name);
    
    if (existingTables.length > 0) {
      console.log(colors.warning(`Encontradas ${existingTables.length} tabelas existentes no banco local:`));
      console.log(`  ${existingTables.join(', ')}`);
      
      const shouldDrop = (await ask(colors.warning('Deseja excluir todas as tabelas existentes e criar novas? (s/N): '))).toLowerCase() === 's';
      
      if (shouldDrop) {
        console.log(colors.info('Excluindo tabelas existentes...'));
        await localPool.query(`DROP SCHEMA public CASCADE; CREATE SCHEMA public;`);
        console.log(colors.success('✓ Tabelas existentes excluídas'));
      } else {
        console.log(colors.info('Mantendo tabelas existentes. A migração pode falhar se a estrutura for incompatível.'));
      }
    }
    
    // Ler e executar script SQL de criação das tabelas
    const sqlPath = path.join(__dirname, 'schema.sql');
    
    // Se não temos o arquivo schema.sql, vamos criar um
    if (!fs.existsSync(sqlPath)) {
      console.log(colors.info('Criando script de schema.sql...'));
      
      // Usar o Drizzle para gerar o schema
      const schemaSql = await sourceDb.execute(sql`
        SELECT 
          'CREATE TABLE IF NOT EXISTS ' || tablename || ' (' ||
          array_to_string(
            array_agg(
              column_name || ' ' || 
              data_type || 
              CASE WHEN character_maximum_length IS NOT NULL 
                THEN '(' || character_maximum_length || ')' 
                ELSE '' 
              END || 
              CASE WHEN is_nullable = 'NO' THEN ' NOT NULL' ELSE '' END
            ), 
            ', '
          ) || ');' as create_statement
        FROM pg_tables
        JOIN information_schema.columns ON tablename = table_name
        WHERE schemaname = 'public'
        GROUP BY tablename;
      `);
      
      let schemaContent = '';
      for (const row of schemaSql) {
        schemaContent += row.create_statement + '\n\n';
      }
      
      fs.writeFileSync(sqlPath, schemaContent);
      console.log(colors.success('✓ Arquivo schema.sql criado'));
    }
    
    // Executar o script SQL
    const schemaSql = fs.readFileSync(sqlPath, 'utf8');
    await localPool.query(schemaSql);
    
    console.log(colors.success('✓ Tabelas criadas com sucesso no banco local'));
    return true;
  } catch (error: any) {
    console.error(colors.error(`Erro ao criar tabelas: ${error.message}`));
    throw error;
  }
}

// 3. Inserir dados no banco local
async function insertData(data: any) {
  console.log(colors.info('\nInserindo dados no banco local...'));
  
  try {
    const client = await localPool.connect();
    
    try {
      // Iniciar transação
      await client.query('BEGIN');
      
      // Inserir dados em cada tabela
      for (const [table, rows] of Object.entries(data)) {
        if (rows.length === 0) {
          console.log(`  - ${table}: Nenhum dado para inserir`);
          continue;
        }
        
        console.log(`  - ${table}: Inserindo ${rows.length} registros...`);
        
        // Obter colunas da primeira linha para construir a query
        const columns = Object.keys(rows[0]);
        
        // Processar cada linha
        for (const row of rows) {
          // Construir valores parametrizados
          const values = columns.map((col, i) => `$${i + 1}`).join(', ');
          const query = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${values})`;
          
          // Extrair valores na ordem das colunas
          const params = columns.map(col => row[col]);
          
          // Executar insert
          await client.query(query, params);
        }
      }
      
      // Commit da transação
      await client.query('COMMIT');
      
      console.log(colors.success('✓ Dados inseridos com sucesso no banco local'));
      return true;
    } catch (e) {
      // Rollback em caso de erro
      await client.query('ROLLBACK');
      throw e;
    } finally {
      // Liberar cliente
      client.release();
    }
  } catch (error: any) {
    console.error(colors.error(`Erro ao inserir dados: ${error.message}`));
    throw error;
  }
}

// 4. Atualizar sequências
async function updateSequences() {
  console.log(colors.info('\nAtualizando sequências de IDs...'));
  
  try {
    // Obter todas as sequências
    const sequencesResult = await localPool.query(`
      SELECT sequence_name 
      FROM information_schema.sequences 
      WHERE sequence_schema = 'public'
    `);
    
    const sequences = sequencesResult.rows.map(row => row.sequence_name);
    
    for (const sequence of sequences) {
      // Extrair nome da tabela e coluna da sequência (assumindo nomenclatura padrão)
      const match = sequence.match(/(.+)_(.+)_seq/);
      
      if (match) {
        const tableName = match[1];
        const columnName = match[2];
        
        // Encontrar o valor máximo na coluna
        const maxResult = await localPool.query(`
          SELECT COALESCE(MAX(${columnName}), 0) + 1 as max_value 
          FROM ${tableName}
        `);
        
        const maxValue = maxResult.rows[0].max_value;
        
        // Atualizar a sequência
        await localPool.query(`
          ALTER SEQUENCE ${sequence} RESTART WITH ${maxValue}
        `);
        
        console.log(`  - ${sequence}: Reiniciada em ${maxValue}`);
      }
    }
    
    console.log(colors.success('✓ Sequências atualizadas com sucesso'));
    return true;
  } catch (error: any) {
    console.error(colors.error(`Erro ao atualizar sequências: ${error.message}`));
    return false;
  }
}

// 5. Criar credenciais de teste
async function createTestCredentials() {
  console.log(colors.info('\nVerificando credenciais de teste...'));
  
  try {
    // Verificar se já existe usuário admin
    const adminResult = await localPool.query(`
      SELECT * FROM users WHERE role = 'admin' LIMIT 1
    `);
    
    if (adminResult.rows.length > 0) {
      console.log(colors.info(`Já existe um usuário admin: ${adminResult.rows[0].username}`));
      
      const resetPassword = (await ask(colors.warning('Deseja resetar a senha do admin? (s/N): '))).toLowerCase() === 's';
      
      if (resetPassword) {
        const hashedPassword = await hashPassword('password123');
        
        await localPool.query(`
          UPDATE users SET password = $1 WHERE id = $2
        `, [hashedPassword, adminResult.rows[0].id]);
        
        console.log(colors.success(`✓ Senha do usuário admin resetada para: password123`));
      }
    } else {
      // Criar usuário admin
      const hashedPassword = await hashPassword('password123');
      
      await localPool.query(`
        INSERT INTO users (
          name, username, email, password, role, is_active, never_expires,
          is_email_verified, created_at, updated_at
        ) VALUES (
          'Admin', 'admin', 'admin@example.com', $1, 'admin', true, true,
          true, NOW(), NOW()
        )
      `, [hashedPassword]);
      
      console.log(colors.success('✓ Usuário admin criado com sucesso'));
      console.log(colors.info('   Credenciais: admin / password123'));
    }
    
    // Verificar se já existe usuário link
    const linkResult = await localPool.query(`
      SELECT * FROM users WHERE username = 'link' LIMIT 1
    `);
    
    if (linkResult.rows.length > 0) {
      console.log(colors.info(`Já existe um usuário link: ${linkResult.rows[0].username}`));
      
      const resetPassword = (await ask(colors.warning('Deseja resetar a senha do usuário link? (s/N): '))).toLowerCase() === 's';
      
      if (resetPassword) {
        const hashedPassword = await hashPassword('password123');
        
        await localPool.query(`
          UPDATE users SET password = $1 WHERE id = $2
        `, [hashedPassword, linkResult.rows[0].id]);
        
        console.log(colors.success(`✓ Senha do usuário link resetada para: password123`));
      }
    } else {
      // Criar usuário link
      const hashedPassword = await hashPassword('password123');
      
      // Inserir usuário link
      const userResult = await localPool.query(`
        INSERT INTO users (
          name, username, email, password, role, is_active, never_expires,
          is_email_verified, created_at, updated_at
        ) VALUES (
          'Lincoln', 'link', 'link@example.com', $1, 'provider', true, false,
          true, NOW(), NOW()
        ) RETURNING id
      `, [hashedPassword]);
      
      const userId = userResult.rows[0].id;
      
      // Inserir provider para o usuário link
      await localPool.query(`
        INSERT INTO providers (
          user_id, name, email, phone, bio, website, business_hours,
          booking_link, is_active, created_at, updated_at
        ) VALUES (
          $1, 'Lincoln', 'link@example.com', '+5511999999999', 
          'Prestador de serviços teste', 'https://example.com',
          '{"Segunda":"09:00-18:00","Terça":"09:00-18:00","Quarta":"09:00-18:00","Quinta":"09:00-18:00","Sexta":"09:00-18:00"}',
          'link', true, NOW(), NOW()
        )
      `, [userId]);
      
      console.log(colors.success('✓ Usuário link e provider criados com sucesso'));
      console.log(colors.info('   Credenciais: link / password123'));
    }
    
    return true;
  } catch (error: any) {
    console.error(colors.error(`Erro ao criar credenciais de teste: ${error.message}`));
    return false;
  }
}

// Função principal
async function migrateToLocalDb() {
  console.log(colors.bold('\n=== MIGRAÇÃO PARA BANCO DE DADOS LOCAL ===\n'));
  
  try {
    // Verificar conexão com o banco local
    try {
      await localPool.query('SELECT 1');
      console.log(colors.success('✓ Conexão com banco de dados local estabelecida'));
    } catch (error: any) {
      console.error(colors.error(`Erro ao conectar ao banco local: ${error.message}`));
      console.error(colors.warning('Verifique se:'));
      console.error('  1. O PostgreSQL está instalado e rodando');
      console.error('  2. O banco de dados existe (crie com: CREATE DATABASE agendadb)');
      console.error('  3. As credenciais estão corretas');
      process.exit(1);
    }
    
    // Extrair dados do banco atual
    const data = await extractData();
    
    // Criar tabelas no banco local
    await createTables();
    
    // Inserir dados no banco local
    await insertData(data);
    
    // Atualizar sequências
    await updateSequences();
    
    // Criar credenciais de teste
    await createTestCredentials();
    
    console.log(colors.bold('\n=== MIGRAÇÃO CONCLUÍDA COM SUCESSO ===\n'));
    console.log(colors.success('O banco de dados foi migrado com sucesso para o ambiente local.'));
    console.log('Você pode agora:');
    console.log('  1. Iniciar a aplicação com `npm run dev`');
    console.log('  2. Fazer login com as credenciais:');
    console.log('     - Admin: admin / password123');
    console.log('     - Provider: link / password123');
    
  } catch (error: any) {
    console.error(colors.error('\nErro durante a migração:'), error.message);
    console.error(colors.warning('A migração foi interrompida devido a erros.'));
  } finally {
    // Fechar conexões
    await sourcePool.end();
    await localPool.end();
    rl.close();
  }
}

// Iniciar migração
migrateToLocalDb().catch(error => {
  console.error(colors.error('Erro fatal durante a migração:'), error);
  process.exit(1);
});