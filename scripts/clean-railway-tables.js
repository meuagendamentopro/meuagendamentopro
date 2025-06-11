import { Client } from 'pg';

// URL do Railway
const RAILWAY_DB_URL = 'postgresql://postgres:SmzVnAVExJpuQGUwgspoCVcPowGzRpWG@yamabiko.proxy.rlwy.net:42960/railway';

async function cleanAllTables() {
  const railwayClient = new Client({ connectionString: RAILWAY_DB_URL });
  
  try {
    console.log('🔌 Conectando ao Railway...');
    await railwayClient.connect();
    console.log('✅ Conectado ao Railway');
    
    console.log('\n🧹 Limpando todas as tabelas...');
    
    // Lista de tabelas na ordem correta para evitar problemas de foreign key
    const tables = [
      'clinical_notes',
      'notifications', 
      'employee_services',
      'appointments',
      'time_exclusions',
      'employees',
      'provider_clients',
      'services',
      'clients',
      'subscription_transactions',
      'providers',
      'subscription_plans',
      'users',
      'system_settings',
      'session',
      'active_sessions',
      'user_session_tokens'
    ];
    
    // Desabilitar foreign key checks temporariamente
    await railwayClient.query('SET session_replication_role = replica;');
    
    for (const table of tables) {
      try {
        const result = await railwayClient.query(`DELETE FROM ${table}`);
        console.log(`   ✅ Tabela ${table} limpa (${result.rowCount} registros removidos)`);
      } catch (error) {
        console.log(`   ⚠️  Erro ao limpar tabela ${table}: ${error.message}`);
      }
    }
    
    // Reabilitar foreign key checks
    await railwayClient.query('SET session_replication_role = DEFAULT;');
    
    console.log('\n🎉 Todas as tabelas foram limpas com sucesso!');
    console.log('✨ Agora você pode executar o script de migração normalmente.');
    
  } catch (error) {
    console.error('❌ Erro durante a limpeza:', error);
  } finally {
    await railwayClient.end();
    console.log('🔌 Conexão fechada');
  }
}

cleanAllTables().catch(console.error); 