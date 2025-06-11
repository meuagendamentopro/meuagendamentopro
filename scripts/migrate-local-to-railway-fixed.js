import { Client } from 'pg';
import readline from 'readline';

const LOCAL_CONFIG = {
  host: 'localhost',
  port: 5432,
  database: 'agendamento',
  user: 'postgres',
  password: 'linday1818'
};

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
}

// Mapeamento de colunas do banco local para o Railway
const COLUMN_MAPPING = {
  users: {
    'isEmailVerified': 'is_email_verified',
    'avatarUrl': 'avatar_url',
    'verificationToken': 'verification_token',
    'verificationTokenExpiry': 'verification_token_expiry',
    'subscriptionExpiry': 'subscription_expiry',
    'neverExpires': 'never_expires',
    'createdAt': 'created_at',
    'updatedAt': 'updated_at',
    'subscriptionPlanId': 'subscription_plan_id',
    'subscriptionStartDate': 'subscription_start_date',
    'subscriptionEndDate': 'subscription_end_date',
    'subscriptionStatus': 'subscription_status',
    'trialEndDate': 'trial_end_date',
    'isActive': 'is_active',
    'accountType': 'account_type'
  },
  providers: {
    'userId': 'user_id',
    'bookingLink': 'booking_link',
    'avatarUrl': 'avatar_url',
    'workingHoursStart': 'working_hours_start',
    'workingHoursEnd': 'working_hours_end',
    'workingDays': 'working_days',
    'createdAt': 'created_at',
    'updatedAt': 'updated_at',
    'pixEnabled': 'pix_enabled',
    'pixKeyType': 'pix_key_type',
    'pixKey': 'pix_key',
    'pixRequirePayment': 'pix_require_payment',
    'pixPaymentPercentage': 'pix_payment_percentage',
    'pixCompanyName': 'pix_company_name',
    'pixMerchantId': 'pix_merchant_id',
    'pixWebhookSecret': 'pix_webhook_secret',
    'pixMercadopagoToken': 'pix_mercadopago_token',
    'pixIdentificationNumber': 'pix_identification_number',
    'whatsappTemplateAppointment': 'whatsapp_template_appointment'
  },
  clients: {
    'isBlocked': 'is_blocked'
  },
  services: {
    'providerId': 'provider_id'
  },
  employees: {
    'companyUserId': 'company_user_id',
    'lunchBreakStart': 'lunch_break_start',
    'lunchBreakEnd': 'lunch_break_end',
    'isActive': 'is_active',
    'createdAt': 'created_at',
    'updatedAt': 'updated_at',
    'workingHoursStart': 'working_hours_start',
    'workingHoursEnd': 'working_hours_end',
    'workingDays': 'working_days'
  },
  appointments: {
    'providerId': 'provider_id',
    'clientId': 'client_id',
    'serviceId': 'service_id',
    'employeeId': 'employee_id',
    'endTime': 'end_time',
    'cancellationReason': 'cancellation_reason',
    'createdAt': 'created_at',
    'requiresPayment': 'requires_payment',
    'paymentStatus': 'payment_status',
    'paymentAmount': 'payment_amount',
    'paymentPercentage': 'payment_percentage',
    'pixTransactionId': 'pix_transaction_id',
    'pixQrCode': 'pix_qr_code',
    'pixQrCodeExpiration': 'pix_qr_code_expiration',
    'pixPaymentDate': 'pix_payment_date',
    'paymentMethod': 'payment_method',
    'paymentDate': 'payment_date',
    'pixQrCodeBase64': 'pix_qr_code_base64'
  },
  notifications: {
    'userId': 'user_id',
    'isRead': 'is_read',
    'appointmentId': 'appointment_id',
    'createdAt': 'created_at'
  },
  provider_clients: {
    'providerId': 'provider_id',
    'clientId': 'client_id',
    'createdAt': 'created_at'
  },
  employee_services: {
    'employeeId': 'employee_id',
    'serviceId': 'service_id',
    'createdAt': 'created_at'
  },
  subscription_plans: {
    'durationMonths': 'duration_months',
    'isActive': 'is_active',
    'createdAt': 'created_at',
    'updatedAt': 'updated_at',
    'accountType': 'account_type'
  },
  subscription_transactions: {
    'userId': 'user_id',
    'subscriptionPlanId': 'subscription_plan_id',
    'paymentMethod': 'payment_method',
    'transactionId': 'transaction_id',
    'createdAt': 'created_at',
    'updatedAt': 'updated_at'
  },
  system_settings: {
    'siteName': 'site_name',
    'logoUrl': 'logo_url',
    'faviconUrl': 'favicon_url',
    'primaryColor': 'primary_color',
    'createdAt': 'created_at',
    'updatedAt': 'updated_at',
    'trialPeriodDays': 'trial_period_days'
  },
  user_session_tokens: {
    'userId': 'user_id',
    'expiresAt': 'expires_at',
    'createdAt': 'created_at'
  },
  time_exclusions: {
    'providerId': 'provider_id',
    'employeeId': 'employee_id',
    'startTime': 'start_time',
    'endTime': 'end_time',
    'createdAt': 'created_at'
  },
  clinical_notes: {
    'appointmentId': 'appointment_id',
    'providerId': 'provider_id',
    'clientId': 'client_id',
    'createdAt': 'created_at',
    'updatedAt': 'updated_at'
  }
};

const TABLES_ORDER = [
  'users',
  'subscription_plans',
  'providers',
  'clients',
  'services',
  'employees',
  'appointments',
  'notifications',
  'provider_clients',
  'employee_services',
  'subscription_transactions',
  'system_settings',
  'user_session_tokens',
  'time_exclusions',
  'clinical_notes'
];

function mapColumns(tableName, data) {
  const mapping = COLUMN_MAPPING[tableName] || {};
  
  return data.map(row => {
    const mappedRow = {};
    
    for (const [key, value] of Object.entries(row)) {
      const mappedKey = mapping[key] || key;
      mappedRow[mappedKey] = value;
    }
    
    return mappedRow;
  });
}

async function exportTableData(localClient, tableName) {
  try {
    console.log(`Exportando dados da tabela: ${tableName}`);
    const result = await localClient.query(`SELECT * FROM "${tableName}"`);
    
    if (result.rows.length === 0) {
      console.log(`   Tabela ${tableName} esta vazia`);
      return null;
    }

    console.log(`   ${result.rows.length} registros encontrados`);
    
    // Mapear colunas para o formato do Railway
    const mappedData = mapColumns(tableName, result.rows);
    console.log(`   Colunas mapeadas para formato Railway`);
    
    return mappedData;
  } catch (error) {
    console.log(`   Erro ao exportar ${tableName}:`, error.message);
    return null;
  }
}

async function importTableData(railwayClient, tableName, data) {
  if (!data || data.length === 0) {
    return;
  }

  try {
    console.log(`Importando dados para a tabela: ${tableName}`);
    await railwayClient.query(`DELETE FROM "${tableName}"`);

    const columns = Object.keys(data[0]);
    const placeholders = columns.map((_, index) => `$${index + 1}`).join(', ');
    const columnNames = columns.map(col => `"${col}"`).join(', ');
    
    const insertQuery = `INSERT INTO "${tableName}" (${columnNames}) VALUES (${placeholders})`;

    let imported = 0;
    for (const row of data) {
      const values = columns.map(col => row[col]);
      await railwayClient.query(insertQuery, values);
      imported++;
      
      if (imported % 50 === 0) {
        console.log(`   Progresso: ${imported}/${data.length} registros`);
      }
    }

    console.log(`   ${imported} registros importados com sucesso`);

    if (columns.includes('id')) {
      const maxIdResult = await railwayClient.query(`SELECT MAX(id) as max_id FROM "${tableName}"`);
      const maxId = maxIdResult.rows[0].max_id;
      
      if (maxId) {
        await railwayClient.query(`SELECT setval(pg_get_serial_sequence('"${tableName}"', 'id'), ${maxId})`);
        console.log(`   Sequence atualizada para ${maxId}`);
      }
    }

  } catch (error) {
    console.log(`   Erro ao importar ${tableName}:`, error.message);
    throw error;
  }
}

async function createTablesIfNotExist(railwayClient) {
  console.log('Verificando/criando estrutura das tabelas...');
  
  const createTablesSQL = `
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

    CREATE TABLE IF NOT EXISTS "clients" (
      "id" SERIAL PRIMARY KEY,
      "name" VARCHAR(255) NOT NULL,
      "phone" VARCHAR(20),
      "email" VARCHAR(255),
      "notes" TEXT,
      "active" BOOLEAN DEFAULT true,
      "is_blocked" BOOLEAN DEFAULT false
    );

    CREATE TABLE IF NOT EXISTS "services" (
      "id" SERIAL PRIMARY KEY,
      "provider_id" INTEGER REFERENCES "providers"("id") ON DELETE CASCADE,
      "name" VARCHAR(255) NOT NULL,
      "description" TEXT,
      "duration" INTEGER NOT NULL,
      "price" INTEGER NOT NULL,
      "active" BOOLEAN DEFAULT true
    );

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

    CREATE TABLE IF NOT EXISTS "provider_clients" (
      "id" SERIAL PRIMARY KEY,
      "provider_id" INTEGER REFERENCES "providers"("id") ON DELETE CASCADE,
      "client_id" INTEGER REFERENCES "clients"("id") ON DELETE CASCADE,
      "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE("provider_id", "client_id")
    );

    CREATE TABLE IF NOT EXISTS "employee_services" (
      "id" SERIAL PRIMARY KEY,
      "employee_id" INTEGER REFERENCES "employees"("id") ON DELETE CASCADE,
      "service_id" INTEGER REFERENCES "services"("id") ON DELETE CASCADE,
      "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE("employee_id", "service_id")
    );

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

    CREATE TABLE IF NOT EXISTS "user_session_tokens" (
      "id" SERIAL PRIMARY KEY,
      "user_id" INTEGER REFERENCES "users"("id") ON DELETE CASCADE,
      "token" VARCHAR(255) UNIQUE NOT NULL,
      "expires_at" TIMESTAMP NOT NULL,
      "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

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

    CREATE TABLE IF NOT EXISTS "clinical_notes" (
      "id" SERIAL PRIMARY KEY,
      "appointment_id" INTEGER REFERENCES "appointments"("id") ON DELETE CASCADE,
      "provider_id" INTEGER REFERENCES "providers"("id") ON DELETE CASCADE,
      "client_id" INTEGER REFERENCES "clients"("id") ON DELETE CASCADE,
      "notes" TEXT NOT NULL,
      "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS "session" (
      "sid" varchar NOT NULL COLLATE "default",
      "sess" json NOT NULL,
      "expire" timestamp(6) NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "active_sessions" (
      "id" SERIAL PRIMARY KEY,
      "user_id" INTEGER REFERENCES "users"("id") ON DELETE CASCADE,
      "session_id" VARCHAR(255) NOT NULL,
      "ip_address" VARCHAR(45),
      "user_agent" TEXT,
      "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      "last_activity" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  await railwayClient.query(createTablesSQL);
  console.log('Estrutura das tabelas verificada/criada');
}

async function migrateData() {
  console.log('Iniciando migracao do banco local para o Railway (VERSAO CORRIGIDA)...\n');

  const railwayUrl = await askQuestion('Digite a URL de conexao do Railway: ');
  
  if (!railwayUrl.trim()) {
    console.log('URL do Railway e obrigatoria!');
    rl.close();
    return;
  }

  console.log('\nATENCAO: Esta operacao ira:');
  console.log('   • Conectar ao banco local');
  console.log('   • Conectar ao banco Railway');
  console.log('   • Criar/verificar estrutura das tabelas no Railway');
  console.log('   • Mapear colunas camelCase para snake_case');
  console.log('   • Limpar dados existentes no Railway');
  console.log('   • Importar todos os dados do banco local');
  
  const confirm = await askQuestion('\nDeseja continuar? (sim/nao): ');
  
  if (confirm.toLowerCase() !== 'sim' && confirm.toLowerCase() !== 's') {
    console.log('Operacao cancelada pelo usuario');
    rl.close();
    return;
  }

  const localClient = new Client(LOCAL_CONFIG);
  const railwayClient = new Client({ connectionString: railwayUrl.trim() });

  try {
    console.log('\nConectando ao banco local...');
    await localClient.connect();
    console.log('Conectado ao banco local!');

    console.log('Conectando ao banco Railway...');
    await railwayClient.connect();
    console.log('Conectado ao banco Railway!');

    await createTablesIfNotExist(railwayClient);

    console.log('\nIniciando migracao de dados...\n');
    
    for (const tableName of TABLES_ORDER) {
      console.log(`\nProcessando tabela: ${tableName}`);
      console.log('='.repeat(50));
      
      const data = await exportTableData(localClient, tableName);
      
      if (data) {
        await importTableData(railwayClient, tableName, data);
      }
    }

    console.log('\nVerificando dados migrados...');
    console.log('='.repeat(50));
    
    for (const tableName of TABLES_ORDER) {
      try {
        const result = await railwayClient.query(`SELECT COUNT(*) as count FROM "${tableName}"`);
        const count = result.rows[0].count;
        console.log(`${tableName}: ${count} registros`);
      } catch (error) {
        console.log(`${tableName}: Erro ao verificar - ${error.message}`);
      }
    }

    console.log('\nMIGRACAO CONCLUIDA COM SUCESSO!');
    console.log('Todos os dados foram migrados do banco local para o Railway');
    console.log('Colunas foram mapeadas corretamente de camelCase para snake_case');

  } catch (error) {
    console.error('\nErro durante a migracao:', error.message);
    console.error('\nDetalhes do erro:');
    console.error(error);
  } finally {
    try {
      await localClient.end();
      await railwayClient.end();
    } catch (error) {
      // Ignorar erros de fechamento
    }
    
    rl.close();
  }
}

migrateData(); 