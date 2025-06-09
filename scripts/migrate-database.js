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

console.log('🚀 Iniciando migração do banco de dados...');

const client = new Client({
  connectionString: DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Queries separadas para melhor controle de erros
const createTablesQueries = [
  // Tabela de usuários
  `CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'user',
    is_verified BOOLEAN DEFAULT false,
    verification_token VARCHAR(255),
    reset_token VARCHAR(255),
    reset_token_expires TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,

  // Tabela de provedores/profissionais
  `CREATE TABLE IF NOT EXISTS providers (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    business_name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    address TEXT,
    subscription_plan VARCHAR(50) DEFAULT 'free',
    subscription_status VARCHAR(50) DEFAULT 'active',
    subscription_expires_at TIMESTAMP,
    trial_ends_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,

  // Tabela de clientes
  `CREATE TABLE IF NOT EXISTS clients (
    id SERIAL PRIMARY KEY,
    provider_id INTEGER REFERENCES providers(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(20),
    address TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,

  // Tabela de serviços
  `CREATE TABLE IF NOT EXISTS services (
    id SERIAL PRIMARY KEY,
    provider_id INTEGER REFERENCES providers(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    duration INTEGER NOT NULL,
    price DECIMAL(10,2),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,

  // Tabela de funcionários
  `CREATE TABLE IF NOT EXISTS employees (
    id SERIAL PRIMARY KEY,
    provider_id INTEGER REFERENCES providers(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(20),
    role VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,

  // Tabela de serviços por funcionário
  `CREATE TABLE IF NOT EXISTS employee_services (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
    service_id INTEGER REFERENCES services(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(employee_id, service_id)
  )`,

  // Tabela de agendamentos
  `CREATE TABLE IF NOT EXISTS appointments (
    id SERIAL PRIMARY KEY,
    provider_id INTEGER REFERENCES providers(id) ON DELETE CASCADE,
    client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
    service_id INTEGER REFERENCES services(id) ON DELETE CASCADE,
    employee_id INTEGER REFERENCES employees(id) ON DELETE SET NULL,
    appointment_date DATE NOT NULL,
    appointment_time TIME NOT NULL,
    duration INTEGER NOT NULL,
    status VARCHAR(50) DEFAULT 'scheduled',
    notes TEXT,
    price DECIMAL(10,2),
    payment_status VARCHAR(50) DEFAULT 'pending',
    payment_method VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,

  // Tabela de exclusões de horário
  `CREATE TABLE IF NOT EXISTS time_exclusions (
    id SERIAL PRIMARY KEY,
    provider_id INTEGER REFERENCES providers(id) ON DELETE CASCADE,
    employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    start_time TIME,
    end_time TIME,
    reason VARCHAR(255),
    is_recurring BOOLEAN DEFAULT false,
    recurrence_pattern VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,

  // Tabela de notificações
  `CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    provider_id INTEGER REFERENCES providers(id) ON DELETE CASCADE,
    client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
    appointment_id INTEGER REFERENCES appointments(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    message TEXT,
    scheduled_for TIMESTAMP,
    sent_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,

  // Tabela de sessões
  `CREATE TABLE IF NOT EXISTS session (
    sid VARCHAR NOT NULL COLLATE "default",
    sess JSON NOT NULL,
    expire TIMESTAMP(6) NOT NULL,
    PRIMARY KEY (sid)
  )`,

  // Tabela de sessões ativas
  `CREATE TABLE IF NOT EXISTS active_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    session_id VARCHAR(255) NOT NULL,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, session_id)
  )`,

  // Tabela de tokens de sessão de usuário
  `CREATE TABLE IF NOT EXISTS user_session_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(token)
  )`,

  // Tabela de planos de assinatura
  `CREATE TABLE IF NOT EXISTS subscription_plans (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    billing_cycle VARCHAR(20) NOT NULL,
    features JSON,
    max_appointments INTEGER,
    max_clients INTEGER,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,

  // Tabela de transações de assinatura
  `CREATE TABLE IF NOT EXISTS subscription_transactions (
    id SERIAL PRIMARY KEY,
    provider_id INTEGER REFERENCES providers(id) ON DELETE CASCADE,
    plan_id INTEGER REFERENCES subscription_plans(id),
    amount DECIMAL(10,2) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    payment_method VARCHAR(50),
    transaction_id VARCHAR(255),
    paid_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,

  // Tabela de configurações do sistema
  `CREATE TABLE IF NOT EXISTS system_settings (
    id SERIAL PRIMARY KEY,
    provider_id INTEGER REFERENCES providers(id) ON DELETE CASCADE,
    setting_key VARCHAR(100) NOT NULL,
    setting_value TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(provider_id, setting_key)
  )`,

  // Tabela de notas clínicas
  `CREATE TABLE IF NOT EXISTS clinical_notes (
    id SERIAL PRIMARY KEY,
    appointment_id INTEGER REFERENCES appointments(id) ON DELETE CASCADE,
    provider_id INTEGER REFERENCES providers(id) ON DELETE CASCADE,
    client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
    notes TEXT NOT NULL,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,

  // Tabela de relacionamento provider-client
  `CREATE TABLE IF NOT EXISTS provider_clients (
    id SERIAL PRIMARY KEY,
    provider_id INTEGER REFERENCES providers(id) ON DELETE CASCADE,
    client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(provider_id, client_id)
  )`
];

// Índices para melhor performance
const createIndexesQueries = [
  'CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(appointment_date)',
  'CREATE INDEX IF NOT EXISTS idx_appointments_provider ON appointments(provider_id)',
  'CREATE INDEX IF NOT EXISTS idx_appointments_client ON appointments(client_id)',
  'CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status)',
  'CREATE INDEX IF NOT EXISTS idx_session_expire ON session(expire)',
  'CREATE INDEX IF NOT EXISTS idx_active_sessions_user ON active_sessions(user_id)',
  'CREATE INDEX IF NOT EXISTS idx_notifications_provider ON notifications(provider_id)',
  'CREATE INDEX IF NOT EXISTS idx_time_exclusions_provider ON time_exclusions(provider_id)'
];

async function runMigration() {
  try {
    await client.connect();
    console.log('✅ Conectado ao banco de dados');

    console.log('📝 Criando tabelas...');
    for (const [index, query] of createTablesQueries.entries()) {
      try {
        await client.query(query);
        console.log(`  ✓ Tabela ${index + 1}/${createTablesQueries.length} criada/verificada`);
      } catch (error) {
        console.log(`  ⚠️ Erro na tabela ${index + 1}: ${error.message}`);
      }
    }

    console.log('📝 Criando índices...');
    for (const [index, query] of createIndexesQueries.entries()) {
      try {
        await client.query(query);
        console.log(`  ✓ Índice ${index + 1}/${createIndexesQueries.length} criado/verificado`);
      } catch (error) {
        console.log(`  ⚠️ Erro no índice ${index + 1}: ${error.message}`);
      }
    }

    // Verificar se existem planos de assinatura
    try {
      const plansResult = await client.query('SELECT COUNT(*) FROM subscription_plans');
      const plansCount = parseInt(plansResult.rows[0].count);

      if (plansCount === 0) {
        console.log('📦 Criando planos de assinatura padrão...');
        await client.query(`
          INSERT INTO subscription_plans (name, description, price, billing_cycle, features, max_appointments, max_clients) VALUES
          ('Gratuito', 'Plano básico gratuito', 0.00, 'monthly', '{"basic": true}', 50, 25),
          ('Profissional', 'Plano profissional', 29.90, 'monthly', '{"advanced": true, "reports": true}', 500, 200),
          ('Empresarial', 'Plano para empresas', 99.90, 'monthly', '{"enterprise": true, "unlimited": true}', -1, -1)
        `);
        console.log('✅ Planos de assinatura criados!');
      } else {
        console.log(`📦 Planos de assinatura já existem (${plansCount} planos)`);
      }
    } catch (error) {
      console.log(`⚠️ Erro ao verificar/criar planos: ${error.message}`);
    }

    // Verificar tabelas criadas
    try {
      const tablesResult = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        ORDER BY table_name
      `);

      console.log('\n📋 Tabelas no banco de dados:');
      tablesResult.rows.forEach(row => {
        console.log(`  ✓ ${row.table_name}`);
      });

      console.log(`\n🎉 Migração concluída! Total de tabelas: ${tablesResult.rows.length}`);
    } catch (error) {
      console.log(`⚠️ Erro ao listar tabelas: ${error.message}`);
    }

  } catch (error) {
    console.error('❌ Erro durante a migração:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration(); 