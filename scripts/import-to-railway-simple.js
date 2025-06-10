import { Client } from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function importToRailway() {
  // Pegar URL do argumento da linha de comando
  const databaseUrl = process.argv[2];
  
  if (!databaseUrl) {
    console.error('❌ URL do banco não fornecida!');
    console.log('💡 Uso correto:');
    console.log('tsx scripts/import-to-railway-simple.js "postgresql://user:pass@host:port/db"');
    console.log('');
    console.log('📋 Para obter a URL correta:');
    console.log('1. Railway Dashboard → PostgreSQL → Data');
    console.log('2. Clique em "Connect"');
    console.log('3. Mude para "Public Network"');
    console.log('4. Copie a URL que aparecer');
    process.exit(1);
  }

  console.log('🚀 Iniciando importação para o Railway...');
  console.log('🔗 URL:', databaseUrl.replace(/:[^:@]*@/, ':***@')); // Ocultar senha
  
  try {
    // Conectar ao banco Railway
    const client = new Client({
      connectionString: databaseUrl,
      ssl: {
        rejectUnauthorized: false
      }
    });

    console.log('🔌 Conectando ao banco...');
    await client.connect();
    console.log('✅ Conectado ao banco Railway!');

    // Ler o arquivo de migração
    const sqlPath = path.join(__dirname, '..', 'railway-migration.sql');
    
    if (!fs.existsSync(sqlPath)) {
      throw new Error(`Arquivo não encontrado: ${sqlPath}`);
    }
    
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('📄 Arquivo de migração carregado...');
    console.log(`📊 Tamanho: ${(sqlContent.length / 1024).toFixed(2)} KB`);

    // Executar o SQL
    console.log('⚡ Executando migração...');
    await client.query(sqlContent);
    
    console.log('🎉 Migração concluída com sucesso!');
    
    // Verificar tabelas criadas
    const result = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    console.log('📋 Tabelas criadas:');
    result.rows.forEach(row => {
      console.log(`  ✓ ${row.table_name}`);
    });
    
    // Verificar alguns dados
    const userCount = await client.query('SELECT COUNT(*) FROM users');
    const clientCount = await client.query('SELECT COUNT(*) FROM clients');
    const appointmentCount = await client.query('SELECT COUNT(*) FROM appointments');
    
    console.log('📊 Dados importados:');
    console.log(`  👥 Usuários: ${userCount.rows[0].count}`);
    console.log(`  🧑‍💼 Clientes: ${clientCount.rows[0].count}`);
    console.log(`  📅 Agendamentos: ${appointmentCount.rows[0].count}`);
    
    await client.end();
    console.log('✅ Importação finalizada com sucesso!');
    
  } catch (error) {
    console.error('❌ Erro durante a importação:', error.message);
    
    if (error.message.includes('ENOTFOUND') || error.message.includes('ECONNREFUSED')) {
      console.log('');
      console.log('🔍 Problema de conexão detectado!');
      console.log('💡 Possíveis soluções:');
      console.log('1. Verifique se a URL está correta');
      console.log('2. Use a URL "Public Network" (não "Private Network")');
      console.log('3. Confirme se o serviço PostgreSQL está rodando no Railway');
    }
    
    process.exit(1);
  }
}

importToRailway(); 