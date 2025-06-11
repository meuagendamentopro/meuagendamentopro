import { Client } from 'pg';

// Configurações de conexão
const LOCAL_DB_CONFIG = {
  host: 'localhost',
  port: 5432,
  database: 'agendamento',
  user: 'postgres',
  password: 'linday1818'
};

// Substitua pela URL do Railway
const RAILWAY_DB_URL = 'postgresql://postgres:SmzVnAVExJpuQGUwgspoCVcPowGzRpWG@yamabiko.proxy.rlwy.net:42960/railway';

// Mapeamento correto das colunas baseado no schema do Railway
const COLUMN_MAPPINGS = {
  users: {
    'isEmailVerified': 'is_email_verified',
    'avatarUrl': 'avatar_url',
    'accountType': 'account_type',
    'isActive': 'is_active',
    'verificationToken': 'verification_token',
    'verificationTokenExpiry': 'verification_token_expiry',
    'subscriptionExpiry': 'subscription_expiry',
    'neverExpires': 'never_expires',
    'hideWhatsappPopup': 'hide_whatsapp_popup',
    'createdAt': 'created_at',
    'updatedAt': 'updated_at'
  },
  providers: {
    'userId': 'user_id',
    'bookingLink': 'booking_link',
    'avatarUrl': 'avatar_url',
    'workingHoursStart': 'working_hours_start',
    'workingHoursEnd': 'working_hours_end',
    'workingDays': 'working_days',
    'pixEnabled': 'pix_enabled',
    'pixKeyType': 'pix_key_type',
    'pixKey': 'pix_key',
    'pixRequirePayment': 'pix_require_payment',
    'pixPaymentPercentage': 'pix_payment_percentage',
    'pixCompanyName': 'pix_company_name',
    'pixMerchantId': 'pix_merchant_id',
    'pixWebhookSecret': 'pix_webhook_secret',
    'pixMercadoPagoToken': 'pix_mercadopago_token',
    'pixIdentificationNumber': 'pix_identification_number',
    'whatsappTemplateAppointment': 'whatsapp_template_appointment',
    'createdAt': 'created_at',
    'updatedAt': 'updated_at'
  },
  services: {
    'providerId': 'provider_id'
  },
  clients: {
    'isBlocked': 'is_blocked'
  },
  provider_clients: {
    'providerId': 'provider_id',
    'clientId': 'client_id',
    'createdAt': 'created_at'
  },
  employees: {
    'companyUserId': 'company_user_id',
    'lunchBreakStart': 'lunch_break_start',
    'lunchBreakEnd': 'lunch_break_end',
    'isActive': 'is_active',
    'createdAt': 'created_at',
    'updatedAt': 'updated_at'
  },
  employee_services: {
    'employeeId': 'employee_id',
    'serviceId': 'service_id',
    'createdAt': 'created_at'
  },
  appointments: {
    'providerId': 'provider_id',
    'clientId': 'client_id',
    'serviceId': 'service_id',
    'employeeId': 'employee_id',
    'endTime': 'end_time',
    'cancellationReason': 'cancellation_reason',
    'requiresPayment': 'requires_payment',
    'paymentStatus': 'payment_status',
    'paymentAmount': 'payment_amount',
    'paymentPercentage': 'payment_percentage',
    'pixTransactionId': 'pix_transaction_id',
    'pixQrCode': 'pix_qr_code',
    'pixQrCodeExpiration': 'pix_qr_code_expiration',
    'pixPaymentDate': 'pix_payment_date',
    'createdAt': 'created_at'
  },
  time_exclusions: {
    'providerId': 'provider_id',
    'startTime': 'start_time',
    'endTime': 'end_time',
    'dayOfWeek': 'day_of_week',
    'isActive': 'is_active',
    'createdAt': 'created_at'
  },
  notifications: {
    'userId': 'user_id',
    'isRead': 'is_read',
    'appointmentId': 'appointment_id',
    'createdAt': 'created_at'
  },
  subscription_plans: {
    'durationMonths': 'duration_months',
    'isActive': 'is_active',
    'accountType': 'account_type',
    'createdAt': 'created_at',
    'updatedAt': 'updated_at'
  },
  subscription_transactions: {
    'userId': 'user_id',
    'planId': 'plan_id',
    'transactionId': 'transaction_id',
    'paymentMethod': 'payment_method',
    'pixQrCode': 'pix_qr_code',
    'pixQrCodeBase64': 'pix_qr_code_base64',
    'pixQrCodeExpiration': 'pix_qr_code_expiration',
    'paidAt': 'paid_at',
    'createdAt': 'created_at'
  },
  system_settings: {
    'siteName': 'site_name',
    'logoUrl': 'logo_url',
    'faviconUrl': 'favicon_url',
    'primaryColor': 'primary_color',
    'trialPeriodDays': 'trial_period_days',
    'createdAt': 'created_at',
    'updatedAt': 'updated_at'
  },
  clinical_notes: {
    'appointmentId': 'appointment_id',
    'providerId': 'provider_id',
    'clientId': 'client_id',
    'isPrivate': 'is_private',
    'createdAt': 'created_at',
    'updatedAt': 'updated_at'
  }
};

// Função para mapear colunas
function mapColumns(tableName, data) {
  if (!COLUMN_MAPPINGS[tableName]) {
    return data;
  }
  
  const mapping = COLUMN_MAPPINGS[tableName];
  const mappedData = {};
  
  for (const [key, value] of Object.entries(data)) {
    const mappedKey = mapping[key] || key;
    mappedData[mappedKey] = value;
  }
  
  return mappedData;
}

// Função para gerar placeholders para INSERT
function generatePlaceholders(data) {
  return Object.keys(data).map((_, index) => `$${index + 1}`).join(', ');
}

// Função para migrar uma tabela
async function migrateTable(localClient, railwayClient, tableName) {
  try {
    console.log(`\n📋 Migrando tabela: ${tableName}`);
    
    // Buscar dados da tabela local
    const localResult = await localClient.query(`SELECT * FROM ${tableName} ORDER BY id`);
    const localData = localResult.rows;
    
    if (localData.length === 0) {
      console.log(`   ⚠️  Tabela ${tableName} está vazia no banco local`);
      return;
    }
    
    console.log(`   📊 Encontrados ${localData.length} registros`);
    
    // Verificar se a tabela existe no Railway
    const tableExistsResult = await railwayClient.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = $1
      )
    `, [tableName]);
    
    if (!tableExistsResult.rows[0].exists) {
      console.log(`   ❌ Tabela ${tableName} não existe no Railway`);
      return;
    }
    
    // Limpar tabela no Railway (cuidado!)
    await railwayClient.query(`DELETE FROM ${tableName}`);
    console.log(`   🧹 Tabela ${tableName} limpa no Railway`);
    
    // Inserir dados mapeados
    let insertedCount = 0;
    
    for (const row of localData) {
      try {
        // Mapear colunas
        const mappedRow = mapColumns(tableName, row);
        
        // Gerar query de inserção
        const columns = Object.keys(mappedRow).join(', ');
        const placeholders = generatePlaceholders(mappedRow);
        const values = Object.values(mappedRow);
        
        const insertQuery = `
          INSERT INTO ${tableName} (${columns}) 
          VALUES (${placeholders})
        `;
        
        await railwayClient.query(insertQuery, values);
        insertedCount++;
        
      } catch (error) {
        console.log(`   ❌ Erro ao inserir registro ID ${row.id}:`, error.message);
      }
    }
    
    console.log(`   ✅ ${insertedCount}/${localData.length} registros migrados com sucesso`);
    
    // Resetar sequence se necessário
    if (insertedCount > 0) {
      try {
        await railwayClient.query(`
          SELECT setval(pg_get_serial_sequence('${tableName}', 'id'), 
                       (SELECT MAX(id) FROM ${tableName}))
        `);
        console.log(`   🔄 Sequence da tabela ${tableName} resetada`);
      } catch (error) {
        console.log(`   ⚠️  Não foi possível resetar sequence: ${error.message}`);
      }
    }
    
  } catch (error) {
    console.log(`   ❌ Erro ao migrar tabela ${tableName}:`, error.message);
  }
}

async function main() {
  if (RAILWAY_DB_URL === 'COLE_AQUI_A_URL_DO_RAILWAY') {
    console.log('❌ Por favor, configure a URL do Railway no script!');
    process.exit(1);
  }
  
  const localClient = new Client(LOCAL_DB_CONFIG);
  const railwayClient = new Client({ connectionString: RAILWAY_DB_URL });
  
  try {
    console.log('🔌 Conectando aos bancos de dados...');
    
    await localClient.connect();
    console.log('✅ Conectado ao banco local');
    
    await railwayClient.connect();
    console.log('✅ Conectado ao Railway');
    
    // Ordem de migração respeitando foreign keys
    const migrationOrder = [
      'users',
      'providers', 
      'subscription_plans',
      'subscription_transactions',
      'services',
      'clients',
      'provider_clients',
      'employees',
      'employee_services',
      'appointments',
      'time_exclusions',
      'notifications',
      'system_settings',
      'clinical_notes'
    ];
    
    console.log('\n🚀 Iniciando migração de dados...');
    
    for (const tableName of migrationOrder) {
      await migrateTable(localClient, railwayClient, tableName);
    }
    
    console.log('\n🎉 Migração concluída com sucesso!');
    
  } catch (error) {
    console.error('❌ Erro durante a migração:', error);
  } finally {
    await localClient.end();
    await railwayClient.end();
    console.log('🔌 Conexões fechadas');
  }
}

main().catch(console.error); 