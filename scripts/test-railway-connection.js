#!/usr/bin/env node

import pkg from 'pg';
const { Client } = pkg;
import dotenv from 'dotenv';

// Carrega variáveis de ambiente
dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL || process.env.RAILWAY_DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL não está definida!');
  console.log('Variáveis disponíveis:', Object.keys(process.env).filter(key => key.includes('DATABASE')));
  process.exit(1);
}

console.log('🔍 Testando conexão com o Railway...');
console.log('🔗 URL do banco (mascarada):', DATABASE_URL.replace(/:[^:@]*@/, ':***@'));

const client = new Client({
  connectionString: DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function testConnection() {
  try {
    console.log('🔌 Conectando ao banco...');
    await client.connect();
    console.log('✅ Conexão estabelecida!');

    // Testar query básica
    console.log('🧪 Testando query básica...');
    const result = await client.query('SELECT NOW() as timestamp, version() as version');
    console.log('✅ Query básica funcionou:', result.rows[0]);

    // Verificar tabelas existentes
    console.log('📋 Verificando tabelas...');
    const tables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    console.log(`📊 Total de tabelas: ${tables.rows.length}`);
    tables.rows.forEach(row => {
      console.log(`  ✓ ${row.table_name}`);
    });

    // Verificar estrutura da tabela users
    console.log('\n👤 Verificando estrutura da tabela users...');
    const userTableExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'users'
      );
    `);

    if (userTableExists.rows[0].exists) {
      console.log('✅ Tabela users existe');
      
      const userColumns = await client.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_name = 'users' AND table_schema = 'public'
        ORDER BY ordinal_position
      `);
      
      console.log('📋 Colunas da tabela users:');
      userColumns.rows.forEach(col => {
        console.log(`  - ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? '(NOT NULL)' : '(NULLABLE)'}`);
      });

      // Verificar se existem usuários
      const userCount = await client.query('SELECT COUNT(*) FROM users');
      console.log(`👥 Total de usuários: ${userCount.rows[0].count}`);

      if (parseInt(userCount.rows[0].count) > 0) {
        const users = await client.query('SELECT id, name, username, email, role FROM users LIMIT 5');
        console.log('👤 Usuários existentes:');
        users.rows.forEach(user => {
          console.log(`  - ID: ${user.id}, Nome: ${user.name}, Email: ${user.email}, Role: ${user.role}`);
        });
      }
    } else {
      console.log('❌ Tabela users NÃO existe!');
    }

    // Testar inserção de usuário de teste
    console.log('\n🧪 Testando inserção de usuário...');
    try {
      const testResult = await client.query(`
        INSERT INTO users (name, username, email, password, role, is_email_verified) 
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (email) DO NOTHING
        RETURNING id
      `, [
        'Teste Conexão',
        'teste_conexao_' + Date.now(),
        'teste_conexao_' + Date.now() + '@test.com',
        '$2b$10$test.hash.password',
        'provider',
        true
      ]);

      if (testResult.rows.length > 0) {
        console.log('✅ Inserção de usuário funcionou! ID:', testResult.rows[0].id);
        
        // Remover usuário de teste
        await client.query('DELETE FROM users WHERE id = $1', [testResult.rows[0].id]);
        console.log('🗑️ Usuário de teste removido');
      } else {
        console.log('⚠️ Inserção não retornou ID (possível conflito)');
      }
    } catch (insertError) {
      console.error('❌ Erro ao inserir usuário de teste:', insertError.message);
      console.error('📋 Detalhes do erro:', insertError);
    }

  } catch (error) {
    console.error('❌ Erro de conexão:', error.message);
    console.error('📋 Detalhes completos:', error);
  } finally {
    await client.end();
    console.log('🔌 Conexão fechada');
  }
}

testConnection(); 