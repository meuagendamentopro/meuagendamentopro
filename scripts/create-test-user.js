#!/usr/bin/env node

import pkg from 'pg';
const { Client } = pkg;
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';

// Carrega variáveis de ambiente
dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL não está definida!');
  process.exit(1);
}

console.log('🔍 Verificando usuários no banco de dados...');

const client = new Client({
  connectionString: DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function checkAndCreateTestUser() {
  try {
    await client.connect();
    console.log('✅ Conectado ao banco de dados');

    // Verificar se a tabela users existe
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'users'
      );
    `);

    if (!tableCheck.rows[0].exists) {
      console.log('❌ Tabela users não existe! Execute a migração primeiro.');
      process.exit(1);
    }

    console.log('✅ Tabela users encontrada');

    // Verificar usuários existentes
    const usersResult = await client.query('SELECT id, email, name, role FROM users ORDER BY id');
    
    console.log(`\n📊 Total de usuários: ${usersResult.rows.length}`);
    
    if (usersResult.rows.length > 0) {
      console.log('\n👥 Usuários existentes:');
      usersResult.rows.forEach(user => {
        console.log(`  • ID: ${user.id} | Email: ${user.email} | Nome: ${user.name} | Role: ${user.role}`);
      });
    } else {
      console.log('\n⚠️ Nenhum usuário encontrado no banco!');
    }

    // Verificar se existe usuário admin
    const adminCheck = await client.query("SELECT * FROM users WHERE email = 'admin@meuagendamentopro.com.br'");
    
    if (adminCheck.rows.length === 0) {
      console.log('\n🔧 Criando usuário administrador de teste...');
      
      const hashedPassword = await bcrypt.hash('admin123', 10);
      
      // Usar a estrutura correta da tabela users existente
      await client.query(`
        INSERT INTO users (name, username, email, password, role, is_email_verified) 
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        'Administrador Teste',
        'admin_teste',
        'admin@meuagendamentopro.com.br',
        hashedPassword,
        'admin',
        true
      ]);

      console.log('✅ Usuário administrador criado!');
      console.log('📧 Email: admin@meuagendamentopro.com.br');
      console.log('🔑 Senha: admin123');
    } else {
      console.log('\n✅ Usuário administrador já existe');
      console.log('📧 Email: admin@meuagendamentopro.com.br');
    }

    // Verificar se existe usuário teste
    const testCheck = await client.query("SELECT * FROM users WHERE email = 'teste@meuagendamentopro.com.br'");
    
    if (testCheck.rows.length === 0) {
      console.log('\n🔧 Criando usuário de teste...');
      
      const hashedPassword = await bcrypt.hash('teste123', 10);
      
              const userResult = await client.query(`
          INSERT INTO users (name, username, email, password, role, is_email_verified) 
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING id
        `, [
          'Usuário Teste',
          'usuario_teste',
          'teste@meuagendamentopro.com.br',
          hashedPassword,
          'provider',
          true
        ]);

      const userId = userResult.rows[0].id;

      // Criar provider para o usuário teste usando a estrutura correta
      await client.query(`
        INSERT INTO providers (user_id, name, email) 
        VALUES ($1, $2, $3)
      `, [
        userId,
        'Clínica Teste',
        'teste@meuagendamentopro.com.br'
      ]);

      console.log('✅ Usuário de teste criado!');
      console.log('📧 Email: teste@meuagendamentopro.com.br');
      console.log('🔑 Senha: teste123');
    } else {
      console.log('\n✅ Usuário de teste já existe');
      console.log('📧 Email: teste@meuagendamentopro.com.br');
    }

    // Verificar providers
    const providersResult = await client.query(`
      SELECT p.id, p.name as business_name, u.email, u.name 
      FROM providers p 
      JOIN users u ON p.user_id = u.id
    `);

    console.log(`\n🏢 Total de providers: ${providersResult.rows.length}`);
    if (providersResult.rows.length > 0) {
      console.log('\n🏢 Providers existentes:');
      providersResult.rows.forEach(provider => {
        console.log(`  • ID: ${provider.id} | Empresa: ${provider.business_name} | Usuário: ${provider.email}`);
      });
    }

    console.log('\n🎉 Verificação concluída!');
    console.log('\n🔑 Credenciais para teste:');
    console.log('📧 Admin: admin@meuagendamentopro.com.br / admin123');
    console.log('📧 Teste: teste@meuagendamentopro.com.br / teste123');

  } catch (error) {
    console.error('❌ Erro:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

checkAndCreateTestUser(); 