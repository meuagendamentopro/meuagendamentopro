import { Client } from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// SQL para criar todas as tabelas
const createTablesSQL = `
-- Criar tabelas se não existirem

-- Tabela users
CREATE TABLE IF NOT EXISTS "users" (
  "id" SERIAL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "username" TEXT NOT NULL UNIQUE,
  "email" TEXT NOT NULL,
  "password" TEXT NOT NULL,
  "role" TEXT DEFAULT 'provider' NOT NULL,
  "account_type" TEXT DEFAULT 'individual' NOT NULL,
  "avatar_url" TEXT,
  "is_active" BOOLEAN DEFAULT true NOT NULL,
  "is_email_verified" BOOLEAN DEFAULT false NOT NULL,
  "verification_token" TEXT,
  "verification_token_expiry" TIMESTAMP,
  "subscription_expiry" TIMESTAMP,
  "never_expires" BOOLEAN DEFAULT false,
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "subscription_plan_id" INTEGER,
  "subscription_start_date" TIMESTAMP,
  "subscription_end_date" TIMESTAMP,
  "subscription_status" VARCHAR(20) DEFAULT 'trial',
  "trial_end_date" TIMESTAMP
);

-- Tabela providers
CREATE TABLE IF NOT EXISTS "providers" (
  "id" SERIAL PRIMARY KEY,
  "user_id" INTEGER REFERENCES "users"("id") ON DELETE CASCADE,
  "name" VARCHAR(255) NOT NULL,
  "email" VARCHAR(255),
  "phone" VARCHAR(20),
  "booking_link" VARCHAR(255),
  "avatar_url" TEXT,
  "working_hours_start" INTEGER DEFAULT 8,
  "working_hours_end" INTEGER DEFAULT 18,
  "working_days" TEXT DEFAULT '1,2,3,4,5',
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "pix_enabled" BOOLEAN DEFAULT false,
  "pix_key_type" VARCHAR(20),
  "pix_key" VARCHAR(255),
  "pix_require_payment" BOOLEAN DEFAULT false,
  "pix_payment_percentage" INTEGER DEFAULT 100,
  "pix_company_name" VARCHAR(255),
  "pix_merchant_id" VARCHAR(255),
  "pix_webhook_secret" VARCHAR(255),
  "pix_mercadopago_token" TEXT,
  "pix_identification_number" VARCHAR(50),
  "whatsapp_template_appointment" TEXT
);

-- Tabela clients
CREATE TABLE IF NOT EXISTS "clients" (
  "id" SERIAL PRIMARY KEY,
  "name" VARCHAR(255) NOT NULL,
  "phone" VARCHAR(20),
  "email" VARCHAR(255),
  "notes" TEXT,
  "active" BOOLEAN DEFAULT true,
  "is_blocked" BOOLEAN DEFAULT false
);

-- Tabela services
CREATE TABLE IF NOT EXISTS "services" (
  "id" SERIAL PRIMARY KEY,
  "provider_id" INTEGER REFERENCES "providers"("id") ON DELETE CASCADE,
  "name" VARCHAR(255) NOT NULL,
  "description" TEXT,
  "duration" INTEGER NOT NULL,
  "price" INTEGER NOT NULL,
  "active" BOOLEAN DEFAULT true
);

-- Tabela employees
CREATE TABLE IF NOT EXISTS "employees" (
  "id" SERIAL PRIMARY KEY,
  "company_user_id" INTEGER REFERENCES "users"("id") ON DELETE CASCADE,
  "name" VARCHAR(255) NOT NULL,
  "specialty" VARCHAR(255),
  "lunch_break_start" VARCHAR(5),
  "lunch_break_end" VARCHAR(5),
  "is_active" BOOLEAN DEFAULT true,
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "working_hours_start" VARCHAR(5),
  "working_hours_end" VARCHAR(5),
  "working_days" TEXT
);

-- Tabela appointments
CREATE TABLE IF NOT EXISTS "appointments" (
  "id" SERIAL PRIMARY KEY,
  "provider_id" INTEGER REFERENCES "providers"("id") ON DELETE CASCADE,
  "client_id" INTEGER REFERENCES "clients"("id") ON DELETE CASCADE,
  "service_id" INTEGER REFERENCES "services"("id") ON DELETE CASCADE,
  "employee_id" INTEGER REFERENCES "employees"("id") ON DELETE SET NULL,
  "date" TIMESTAMP NOT NULL,
  "end_time" TIMESTAMP NOT NULL,
  "status" VARCHAR(20) DEFAULT 'scheduled',
  "notes" TEXT,
  "cancellation_reason" TEXT,
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "requires_payment" BOOLEAN DEFAULT false,
  "payment_status" VARCHAR(20) DEFAULT 'not_required',
  "payment_amount" INTEGER,
  "payment_percentage" INTEGER,
  "pix_transaction_id" VARCHAR(255),
  "pix_qr_code" TEXT,
  "pix_qr_code_expiration" TIMESTAMP,
  "pix_payment_date" TIMESTAMP,
  "payment_method" VARCHAR(20),
  "payment_date" TIMESTAMP,
  "pix_qr_code_base64" TEXT
);

-- Tabela notifications
CREATE TABLE IF NOT EXISTS "notifications" (
  "id" SERIAL PRIMARY KEY,
  "user_id" INTEGER REFERENCES "users"("id") ON DELETE CASCADE,
  "title" VARCHAR(255) NOT NULL,
  "message" TEXT NOT NULL,
  "type" VARCHAR(50) NOT NULL,
  "is_read" BOOLEAN DEFAULT false,
  "appointment_id" INTEGER REFERENCES "appointments"("id") ON DELETE SET NULL,
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "link" VARCHAR(255)
);

-- Tabela provider_clients
CREATE TABLE IF NOT EXISTS "provider_clients" (
  "id" SERIAL PRIMARY KEY,
  "provider_id" INTEGER REFERENCES "providers"("id") ON DELETE CASCADE,
  "client_id" INTEGER REFERENCES "clients"("id") ON DELETE CASCADE,
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE("provider_id", "client_id")
);

-- Tabela employee_services
CREATE TABLE IF NOT EXISTS "employee_services" (
  "id" SERIAL PRIMARY KEY,
  "employee_id" INTEGER REFERENCES "employees"("id") ON DELETE CASCADE,
  "service_id" INTEGER REFERENCES "services"("id") ON DELETE CASCADE,
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE("employee_id", "service_id")
);

-- Tabela subscription_plans
CREATE TABLE IF NOT EXISTS "subscription_plans" (
  "id" SERIAL PRIMARY KEY,
  "name" VARCHAR(255) NOT NULL,
  "description" TEXT,
  "duration_months" INTEGER NOT NULL,
  "price" INTEGER NOT NULL,
  "is_active" BOOLEAN DEFAULT true,
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "account_type" VARCHAR(20) DEFAULT 'individual'
);

-- Tabela subscription_transactions
CREATE TABLE IF NOT EXISTS "subscription_transactions" (
  "id" SERIAL PRIMARY KEY,
  "user_id" INTEGER REFERENCES "users"("id") ON DELETE CASCADE,
  "subscription_plan_id" INTEGER REFERENCES "subscription_plans"("id") ON DELETE CASCADE,
  "amount" INTEGER NOT NULL,
  "status" VARCHAR(20) DEFAULT 'pending',
  "payment_method" VARCHAR(50),
  "transaction_id" VARCHAR(255),
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela system_settings
CREATE TABLE IF NOT EXISTS "system_settings" (
  "id" SERIAL PRIMARY KEY,
  "site_name" VARCHAR(255) DEFAULT 'Meu Agendamento PRO',
  "logo_url" TEXT,
  "favicon_url" TEXT,
  "primary_color" VARCHAR(7) DEFAULT '#0891b2',
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "trial_period_days" INTEGER DEFAULT 15
);

-- Tabela user_session_tokens
CREATE TABLE IF NOT EXISTS "user_session_tokens" (
  "id" SERIAL PRIMARY KEY,
  "user_id" INTEGER REFERENCES "users"("id") ON DELETE CASCADE,
  "token" VARCHAR(255) UNIQUE NOT NULL,
  "expires_at" TIMESTAMP NOT NULL,
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela time_exclusions
CREATE TABLE IF NOT EXISTS "time_exclusions" (
  "id" SERIAL PRIMARY KEY,
  "provider_id" INTEGER REFERENCES "providers"("id") ON DELETE CASCADE,
  "employee_id" INTEGER REFERENCES "employees"("id") ON DELETE CASCADE,
  "date" DATE NOT NULL,
  "start_time" TIME NOT NULL,
  "end_time" TIME NOT NULL,
  "reason" VARCHAR(255),
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela clinical_notes
CREATE TABLE IF NOT EXISTS "clinical_notes" (
  "id" SERIAL PRIMARY KEY,
  "appointment_id" INTEGER REFERENCES "appointments"("id") ON DELETE CASCADE,
  "provider_id" INTEGER REFERENCES "providers"("id") ON DELETE CASCADE,
  "client_id" INTEGER REFERENCES "clients"("id") ON DELETE CASCADE,
  "notes" TEXT NOT NULL,
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabelas de sessão já existem, não precisam ser recriadas
`;

async function createAndImport() {
  let databaseUrl = process.argv[2];
  
  // Se não fornecida via argumento, tentar ler do arquivo temporário
  if (!databaseUrl) {
    try {
      const urlPath = path.resolve(__dirname, '..', 'temp-railway-url.txt');
      if (fs.existsSync(urlPath)) {
        databaseUrl = fs.readFileSync(urlPath, 'utf8').trim();
        console.log('📄 URL lida do arquivo temp-railway-url.txt');
      }
    } catch (error) {
      // Ignorar erro de leitura
    }
  }
  
  if (!databaseUrl) {
    console.error('❌ URL do banco não fornecida!');
    console.log('💡 Uso: tsx scripts/create-and-import-railway.js "postgresql://..."');
    console.log('💡 Ou coloque a URL no arquivo temp-railway-url.txt');
    return;
  }

  const client = new Client({ connectionString: databaseUrl });

  try {
    console.log('🚀 Iniciando criação de tabelas e importação para o Railway...');
    console.log('🔗 URL:', databaseUrl.replace(/:\/\/[^:]+:[^@]+@/, '://***:***@'));

    console.log('🔌 Conectando ao banco...');
    await client.connect();
    console.log('✅ Conectado ao banco Railway!');

    // Passo 1: Criar todas as tabelas
    console.log('\n📋 Passo 1: Criando tabelas...');
    await client.query(createTablesSQL);
    console.log('✅ Todas as tabelas criadas com sucesso!');

    // Verificar tabelas criadas
    const tablesResult = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);

    console.log(`\n📊 Tabelas disponíveis: ${tablesResult.rows.length}`);
    tablesResult.rows.forEach((row, index) => {
      console.log(`  ${index + 1}. ${row.table_name}`);
    });

    // Passo 2: Importar dados
    console.log('\n📋 Passo 2: Importando dados...');
    const migrationPath = path.resolve(__dirname, '..', 'railway-migration.sql');

    if (!fs.existsSync(migrationPath)) {
      throw new Error(`Arquivo de migração não encontrado: ${migrationPath}`);
    }

    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    console.log('📄 Arquivo de migração carregado...');
    console.log(`📊 Tamanho: ${(migrationSQL.length / 1024).toFixed(2)} KB`);

    console.log('⚡ Executando migração...');
    await client.query(migrationSQL);

    console.log('\n🎉 SUCESSO! Todas as tabelas e dados foram importados!');

    // Verificar dados importados
    const dataCheck = await client.query(`
      SELECT
        'users' as table_name, COUNT(*) as count FROM users
      UNION ALL
      SELECT 'providers', COUNT(*) FROM providers
      UNION ALL
      SELECT 'clients', COUNT(*) FROM clients
      UNION ALL
      SELECT 'services', COUNT(*) FROM services
      UNION ALL
      SELECT 'appointments', COUNT(*) FROM appointments
      UNION ALL
      SELECT 'employees', COUNT(*) FROM employees
      UNION ALL
      SELECT 'notifications', COUNT(*) FROM notifications
      ORDER BY table_name;
    `);

    console.log('\n📊 Dados importados:');
    console.log('====================');
    dataCheck.rows.forEach(row => {
      console.log(`${row.table_name}: ${row.count} registros`);
    });

  } catch (error) {
    console.error('❌ Erro durante a criação/importação:', error.message);
    console.error('\n🔍 Detalhes do erro:');
    console.error(error);
  } finally {
    await client.end();
  }
}

createAndImport();
 