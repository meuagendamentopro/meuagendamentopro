import { Client } from 'pg';

// Configuração do banco local
const LOCAL_CONFIG = {
  host: 'localhost',
  port: 5432,
  database: 'agendamento',
  user: 'postgres',
  password: 'linday1818'
};

async function testLocalConnection() {
  console.log('🔍 Testando conexão com o banco local...\n');
  
  const client = new Client(LOCAL_CONFIG);

  try {
    console.log('🔌 Conectando ao banco local...');
    await client.connect();
    console.log('✅ Conectado ao banco local com sucesso!');

    // Verificar tabelas existentes
    const tablesResult = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);

    console.log(`\n📊 Tabelas encontradas: ${tablesResult.rows.length}`);
    tablesResult.rows.forEach((row, index) => {
      console.log(`  ${index + 1}. ${row.table_name}`);
    });

    // Verificar dados em cada tabela
    console.log('\n📋 Contagem de registros por tabela:');
    console.log('='.repeat(50));
    
    for (const row of tablesResult.rows) {
      try {
        const countResult = await client.query(`SELECT COUNT(*) as count FROM "${row.table_name}"`);
        const count = countResult.rows[0].count;
        console.log(`${row.table_name}: ${count} registros`);
      } catch (error) {
        console.log(`${row.table_name}: Erro ao contar - ${error.message}`);
      }
    }

    console.log('\n✅ Teste de conexão concluído com sucesso!');

  } catch (error) {
    console.error('\n❌ Erro ao conectar ao banco local:', error.message);
    console.error('\n🔍 Verifique se:');
    console.error('   • PostgreSQL está rodando');
    console.error('   • Banco "agendamento" existe');
    console.error('   • Usuário "postgres" tem acesso');
    console.error('   • Senha está correta');
  } finally {
    await client.end();
  }
}

testLocalConnection(); 