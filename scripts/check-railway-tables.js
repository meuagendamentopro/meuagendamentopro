import { Client } from 'pg';

async function checkTables() {
  const databaseUrl = process.argv[2];

  if (!databaseUrl) {
    console.error('❌ URL do banco não fornecida!');
    console.log('💡 Uso: tsx scripts/check-railway-tables.js \"postgresql://...\"');
    return;
  }

  const client = new Client({ connectionString: databaseUrl });

  try {
    console.log('🔌 Conectando ao banco Railway...');
    await client.connect();
    console.log('✅ Conectado!');

    // Verificar tabelas existentes
    const result = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);

    console.log('\n📊 Tabelas encontradas no Railway:');
    console.log('=====================================');

    if (result.rows.length === 0) {
      console.log('❌ Nenhuma tabela encontrada!');
    } else {
      result.rows.forEach((row, index) => {
        console.log(`${index + 1}. ${row.table_name}`);
      });
      console.log(`\n✅ Total: ${result.rows.length} tabelas`);
    }

    // Verificar se as tabelas principais existem
    const expectedTables = [
      'users', 'providers', 'clients', 'services', 'appointments',
      'employees', 'notifications', 'system_settings'
    ];

    console.log('\n🔍 Verificando tabelas principais:');
    console.log('===================================');

    const existingTables = result.rows.map(row => row.table_name);

    expectedTables.forEach(table => {
      const exists = existingTables.includes(table);
      console.log(`${exists ? '✅' : '❌'} ${table}`);
    });

  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await client.end();
  }
}

checkTables();
 