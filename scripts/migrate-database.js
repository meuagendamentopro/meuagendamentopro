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
    name TEXT NOT NULL,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'provider',
    avatar_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_email_verified BOOLEAN NOT NULL DEFAULT false,
    verification_token TEXT,
    verification_token_expiry TIMESTAMP,
    subscription_expiry TIMESTAMP,
    never_expires BOOLEAN DEFAULT false,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    account_type TEXT NOT NULL DEFAULT 'individual'
  )`,

  // Tabela de providers
  `CREATE TABLE IF NOT EXISTS providers (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    booking_link TEXT,
    avatar_url TEXT,
    working_hours_start INTEGER DEFAULT 8,
    working_hours_end INTEGER DEFAULT 18,
    working_days TEXT NOT NULL DEFAULT '1,2,3,4,5',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    pix_enabled BOOLEAN NOT NULL DEFAULT false,
    pix_key_type TEXT,
    pix_key TEXT,
    pix_require_payment BOOLEAN NOT NULL DEFAULT false,
    pix_payment_percentage INTEGER DEFAULT 100,
    pix_company_name TEXT,
    pix_merchant_id TEXT,
    pix_webhook_secret TEXT,
    pix_mercadopago_token TEXT,
    pix_identification_number TEXT,
    whatsapp_template_appointment TEXT
  )`,

  // Tabela de clientes
  `CREATE TABLE IF NOT EXISTS clients (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,

  // Tabela de serviços
  `CREATE TABLE IF NOT EXISTS services (
    id SERIAL PRIMARY KEY,
    provider_id INTEGER NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    duration INTEGER NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,

  // Tabela de agendamentos
  `CREATE TABLE IF NOT EXISTS appointments (
    id SERIAL PRIMARY KEY,
    provider_id INTEGER NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
    client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    service_id INTEGER REFERENCES services(id) ON DELETE SET NULL,
    employee_id INTEGER,
    date DATE NOT NULL,
    time TIME NOT NULL,
    duration INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'scheduled',
    notes TEXT,
    cancellation_reason TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,

  // Tabela de notificações
  `CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'info',
    is_read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,

  // Tabela de associação provider-client
  `CREATE TABLE IF NOT EXISTS provider_clients (
    id SERIAL PRIMARY KEY,
    provider_id INTEGER NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
    client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(provider_id, client_id)
  )`,

  // Tabela de planos de assinatura
  `CREATE TABLE IF NOT EXISTS subscription_plans (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    duration_days INTEGER NOT NULL,
    features TEXT[],
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,

  // Tabela de transações de assinatura
  `CREATE TABLE IF NOT EXISTS subscription_transactions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan_id INTEGER NOT NULL REFERENCES subscription_plans(id),
    amount DECIMAL(10,2) NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    payment_method TEXT,
    transaction_id TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,

  // Tabela de configurações do sistema
  `CREATE TABLE IF NOT EXISTS system_settings (
    id SERIAL PRIMARY KEY,
    site_name TEXT NOT NULL DEFAULT 'Meu Agendamento PRO',
    trial_period_days INTEGER NOT NULL DEFAULT 3,
    maintenance_mode BOOLEAN NOT NULL DEFAULT false,
    maintenance_message TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,

  // Tabela de tokens de sessão de usuário
  `CREATE TABLE IF NOT EXISTS user_session_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token TEXT NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,

  // Tabela de exclusões de tempo
  `CREATE TABLE IF NOT EXISTS time_exclusions (
    id SERIAL PRIMARY KEY,
    provider_id INTEGER NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
    day_of_week INTEGER NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,

  // Tabela de notas clínicas
  `CREATE TABLE IF NOT EXISTS clinical_notes (
    id SERIAL PRIMARY KEY,
    appointment_id INTEGER NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
    provider_id INTEGER NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
    client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    notes TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,

  // Tabela de funcionários
  `CREATE TABLE IF NOT EXISTS employees (
    id SERIAL PRIMARY KEY,
    company_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    role TEXT NOT NULL DEFAULT 'employee',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,

  // Tabela de serviços dos funcionários
  `CREATE TABLE IF NOT EXISTS employee_services (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(employee_id, service_id)
  )`,

  // Tabela de sessões ativas
  `CREATE TABLE IF NOT EXISTS active_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_id TEXT NOT NULL,
    user_email TEXT NOT NULL,
    last_activity TIMESTAMP NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`
];

// Índices para melhor performance
const createIndexesQueries = [
  'CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)',
  'CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)',
  'CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(date)',
  'CREATE INDEX IF NOT EXISTS idx_appointments_provider_date ON appointments(provider_id, date)',
  'CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, is_read)',
  'CREATE INDEX IF NOT EXISTS idx_active_sessions_user ON active_sessions(user_id)',
  'CREATE INDEX IF NOT EXISTS idx_active_sessions_session ON active_sessions(session_id)',
  'CREATE INDEX IF NOT EXISTS idx_provider_clients_provider ON provider_clients(provider_id)'
];

// Dados iniciais dos planos de assinatura
const subscriptionPlansData = [
  {
    name: 'Gratuito',
    description: 'Plano básico gratuito',
    price: 0.00,
    duration_days: 30,
    features: ['Até 50 agendamentos por mês', 'Suporte básico']
  },
  {
    name: 'Básico',
    description: 'Plano básico para pequenos negócios',
    price: 29.90,
    duration_days: 30,
    features: ['Agendamentos ilimitados', 'Suporte por email', 'Relatórios básicos']
  },
  {
    name: 'Profissional',
    description: 'Plano profissional para médias empresas',
    price: 59.90,
    duration_days: 30,
    features: ['Agendamentos ilimitados', 'Suporte prioritário', 'Relatórios avançados', 'Integração com calendário']
  },
  {
    name: 'Premium',
    description: 'Plano premium para grandes empresas',
    price: 99.90,
    duration_days: 30,
    features: ['Agendamentos ilimitados', 'Suporte 24/7', 'Relatórios completos', 'API personalizada', 'White label']
  },
  {
    name: 'Anual Básico',
    description: 'Plano básico anual com desconto',
    price: 299.00,
    duration_days: 365,
    features: ['Agendamentos ilimitados', 'Suporte por email', 'Relatórios básicos', '2 meses grátis']
  },
  {
    name: 'Anual Profissional',
    description: 'Plano profissional anual com desconto',
    price: 599.00,
    duration_days: 365,
    features: ['Agendamentos ilimitados', 'Suporte prioritário', 'Relatórios avançados', 'Integração com calendário', '2 meses grátis']
  },
  {
    name: 'Anual Premium',
    description: 'Plano premium anual com desconto',
    price: 999.00,
    duration_days: 365,
    features: ['Agendamentos ilimitados', 'Suporte 24/7', 'Relatórios completos', 'API personalizada', 'White label', '2 meses grátis']
  },
  {
    name: 'Teste 3 Dias',
    description: 'Período de teste gratuito',
    price: 0.00,
    duration_days: 3,
    features: ['Acesso completo por 3 dias', 'Todos os recursos disponíveis']
  }
];

async function checkTableStructure(tableName) {
  try {
    const result = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = $1 AND table_schema = 'public'
      ORDER BY ordinal_position
    `, [tableName]);
    
    return result.rows;
  } catch (error) {
    console.log(`⚠️ Erro ao verificar estrutura da tabela ${tableName}:`, error.message);
    return [];
  }
}

async function insertSystemSettings() {
  console.log('⚙️ Verificando configurações do sistema...');
  
  try {
    // Verificar se a tabela existe e sua estrutura
    const structure = await checkTableStructure('system_settings');
    console.log(`📋 Estrutura da tabela system_settings:`, structure.map(col => col.column_name));
    
    // Verificar se já existem configurações
    const existingSettings = await client.query('SELECT COUNT(*) FROM system_settings');
    const settingsCount = parseInt(existingSettings.rows[0].count);

    if (settingsCount === 0) {
      console.log('⚙️ Inserindo configurações do sistema...');
      
      // Verificar quais colunas existem
      const hasNewStructure = structure.some(col => col.column_name === 'site_name');
      
      if (hasNewStructure) {
        // Nova estrutura
        await client.query(`
          INSERT INTO system_settings (site_name, trial_period_days, maintenance_mode)
          VALUES ($1, $2, $3)
        `, ['Meu Agendamento PRO', 3, false]);
      } else {
        // Estrutura antiga - inserir dados compatíveis
        console.log('📝 Detectada estrutura antiga da tabela system_settings');
        
        // Verificar se tem as colunas antigas
        const hasOldStructure = structure.some(col => col.column_name === 'setting_key');
        
        if (hasOldStructure) {
          // Inserir configurações no formato antigo
          await client.query(`
            INSERT INTO system_settings (provider_id, setting_key, setting_value)
            VALUES (NULL, 'site_name', 'Meu Agendamento PRO')
          `);
          await client.query(`
            INSERT INTO system_settings (provider_id, setting_key, setting_value)
            VALUES (NULL, 'trial_period_days', '3')
          `);
          await client.query(`
            INSERT INTO system_settings (provider_id, setting_key, setting_value)
            VALUES (NULL, 'maintenance_mode', 'false')
          `);
        } else {
          console.log('⚠️ Estrutura da tabela system_settings não reconhecida, pulando inserção');
        }
      }
      
      console.log('✅ Configurações do sistema inseridas');
    } else {
      console.log(`⚙️ Configurações do sistema já existem (${settingsCount} registros)`);
    }
  } catch (error) {
    console.log(`⚠️ Erro ao inserir configurações do sistema: ${error.message}`);
    // Não falhar a migração por causa das configurações
  }
}

async function createTestUsers() {
  console.log('\n👥 Criando usuários de teste...');
  
  try {
    // Verificar se já existem usuários de teste
    const adminCheck = await client.query("SELECT id FROM users WHERE email = 'admin@meuagendamentopro.com.br'");
    const testCheck = await client.query("SELECT id FROM users WHERE email = 'teste@meuagendamentopro.com.br'");
    
    if (adminCheck.rows.length === 0) {
      console.log('🔧 Criando usuário administrador...');
      
      const hashedPassword = await bcrypt.hash('admin123', 10);
      
      const adminResult = await client.query(`
        INSERT INTO users (name, username, email, password, role, is_email_verified, never_expires) 
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id
      `, [
        'Administrador',
        'admin',
        'admin@meuagendamentopro.com.br',
        hashedPassword,
        'admin',
        true,
        true
      ]);

      console.log('✅ Usuário administrador criado!');
      console.log('📧 Email: admin@meuagendamentopro.com.br');
      console.log('🔑 Senha: admin123');
    } else {
      console.log('✅ Usuário administrador já existe');
    }

    if (testCheck.rows.length === 0) {
      console.log('🔧 Criando usuário de teste...');
      
      const hashedPassword = await bcrypt.hash('teste123', 10);
      
      // Calcular data de expiração (30 dias a partir de agora)
      const subscriptionExpiry = new Date();
      subscriptionExpiry.setDate(subscriptionExpiry.getDate() + 30);
      
      const testResult = await client.query(`
        INSERT INTO users (name, username, email, password, role, is_email_verified, subscription_expiry) 
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id
      `, [
        'Usuário Teste',
        'teste',
        'teste@meuagendamentopro.com.br',
        hashedPassword,
        'provider',
        true,
        subscriptionExpiry
      ]);

      const userId = testResult.rows[0].id;

      // Criar provider para o usuário teste
      await client.query(`
        INSERT INTO providers (user_id, name, email, booking_link) 
        VALUES ($1, $2, $3, $4)
      `, [
        userId,
        'Clínica Teste',
        'teste@meuagendamentopro.com.br',
        'clinica-teste'
      ]);

      console.log('✅ Usuário de teste criado!');
      console.log('📧 Email: teste@meuagendamentopro.com.br');
      console.log('🔑 Senha: teste123');
    } else {
      console.log('✅ Usuário de teste já existe');
    }

    console.log('\n🎉 Usuários de teste configurados com sucesso!');
    console.log('\n🔑 Credenciais para acesso:');
    console.log('👨‍💼 Admin: admin@meuagendamentopro.com.br / admin123');
    console.log('🧪 Teste: teste@meuagendamentopro.com.br / teste123');
    
  } catch (error) {
    console.error('❌ Erro ao criar usuários de teste:', error);
    // Não falhar a migração por causa dos usuários de teste
  }
}

async function runMigration() {
  try {
    await client.connect();
    console.log('✅ Conectado ao banco de dados');

    console.log('📝 Criando tabelas...');
    for (let i = 0; i < createTablesQueries.length; i++) {
      try {
        await client.query(createTablesQueries[i]);
        console.log(`  ✓ Tabela ${i + 1}/${createTablesQueries.length} criada/verificada`);
      } catch (error) {
        console.log(`  ❌ Erro na tabela ${i + 1}: ${error.message}`);
      }
    }

    console.log('📝 Criando índices...');
    for (let i = 0; i < createIndexesQueries.length; i++) {
      try {
        await client.query(createIndexesQueries[i]);
        console.log(`  ✓ Índice ${i + 1}/${createIndexesQueries.length} criado/verificado`);
      } catch (error) {
        console.log(`  ⚠️ Erro no índice ${i + 1}: ${error.message}`);
      }
    }

    // Verificar se os planos já existem
    const existingPlans = await client.query('SELECT COUNT(*) FROM subscription_plans');
    const planCount = parseInt(existingPlans.rows[0].count);

    if (planCount === 0) {
      console.log('📦 Inserindo planos de assinatura...');
      for (const plan of subscriptionPlansData) {
        try {
          await client.query(`
            INSERT INTO subscription_plans (name, description, price, duration_days, features)
            VALUES ($1, $2, $3, $4, $5)
          `, [plan.name, plan.description, plan.price, plan.duration_days, plan.features]);
        } catch (error) {
          console.log(`  ⚠️ Erro ao inserir plano ${plan.name}: ${error.message}`);
        }
      }
      console.log(`✅ Planos de assinatura inseridos`);
    } else {
      console.log(`📦 Planos de assinatura já existem (${planCount} planos)`);
    }

    // Inserir configurações do sistema (com verificação de estrutura)
    await insertSystemSettings();

    // Criar usuários de teste
    await createTestUsers();

    // Verificar tabelas criadas
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
    console.error('❌ Erro durante a migração:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration(); 