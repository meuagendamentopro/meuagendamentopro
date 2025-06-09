#!/usr/bin/env node

import pkg from 'pg';
const { Client } = pkg;
import dotenv from 'dotenv';

// Carrega variáveis de ambiente
dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL não está definida!');
  process.exit(1);
}

console.log('🔍 Verificando estrutura das tabelas...');

const client = new Client({
  connectionString: DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function checkTableStructure() {
  try {
    await client.connect();
    console.log('✅ Conectado ao banco de dados');

    // Verificar estrutura da tabela users
    const usersStructure = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      ORDER BY ordinal_position;
    `);

    console.log('\n📋 Estrutura da tabela USERS:');
    if (usersStructure.rows.length > 0) {
      usersStructure.rows.forEach(col => {
        console.log(`  • ${col.column_name} (${col.data_type}) - Nullable: ${col.is_nullable} - Default: ${col.column_default || 'N/A'}`);
      });
    } else {
      console.log('  ❌ Tabela users não encontrada');
    }

    // Verificar estrutura da tabela providers
    const providersStructure = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'providers' 
      ORDER BY ordinal_position;
    `);

    console.log('\n📋 Estrutura da tabela PROVIDERS:');
    if (providersStructure.rows.length > 0) {
      providersStructure.rows.forEach(col => {
        console.log(`  • ${col.column_name} (${col.data_type}) - Nullable: ${col.is_nullable} - Default: ${col.column_default || 'N/A'}`);
      });
    } else {
      console.log('  ❌ Tabela providers não encontrada');
    }

    // Listar todas as tabelas
    const allTables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);

    console.log('\n📋 Todas as tabelas no banco:');
    allTables.rows.forEach(table => {
      console.log(`  • ${table.table_name}`);
    });

    console.log(`\n📊 Total de tabelas: ${allTables.rows.length}`);

  } catch (error) {
    console.error('❌ Erro:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

checkTableStructure(); 