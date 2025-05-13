/**
 * Script para verificar a conexão com o banco de dados
 * Uso: node scripts/check-database-connection.js [DATABASE_URL]
 * 
 * Este script:
 * 1. Tenta conectar-se ao banco de dados
 * 2. Verifica se as tabelas principais existem
 * 3. Realiza consultas básicas para verificar a integridade dos dados
 * 4. Exibe um relatório detalhado do estado do banco de dados
 */

const { Pool } = require('@neondatabase/serverless');
require('dotenv').config();

// Função para mascarar a URL do banco de dados por motivos de segurança
function maskDatabaseUrl(url) {
  try {
    const dbUrl = new URL(url);
    if (dbUrl.password) {
      dbUrl.password = '****';
    }
    return dbUrl.toString();
  } catch (e) {
    return 'URL inválida';
  }
}

// Função principal
async function checkDatabaseConnection() {
  // Obter a URL do banco de dados
  let databaseUrl = process.argv[2] || process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    console.error('Erro: DATABASE_URL não definida. Forneça a URL como argumento ou defina a variável de ambiente.');
    process.exit(1);
  }
  
  console.log(`\n=== VERIFICAÇÃO DA CONEXÃO COM O BANCO DE DADOS ===`);
  console.log(`URL do banco de dados: ${maskDatabaseUrl(databaseUrl)}\n`);
  
  // Criar pool de conexão
  const pool = new Pool({ connectionString: databaseUrl });
  
  try {
    // 1. Testar conexão básica
    console.log('1. Testando conexão básica...');
    const connResult = await pool.query('SELECT 1 as test');
    
    if (connResult?.rows?.[0]?.test === 1) {
      console.log('✅ Conexão estabelecida com sucesso!');
    } else {
      console.log('❌ A conexão foi aceita, mas a resposta não é a esperada.');
    }
    
    // 2. Verificar se as tabelas principais existem
    console.log('\n2. Verificando tabelas principais...');
    
    const tables = [
      'users', 'providers', 'clients', 'services', 
      'appointments', 'notifications', 'subscription_plans'
    ];
    
    for (const table of tables) {
      try {
        const tableQuery = await pool.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_name = $1
          ) as exists
        `, [table]);
        
        const exists = tableQuery.rows[0]?.exists;
        
        if (exists) {
          // Contar registros na tabela
          const countQuery = await pool.query(`SELECT COUNT(*) as count FROM ${table}`);
          const count = countQuery.rows[0]?.count || 0;
          
          console.log(`✅ Tabela '${table}' existe (${count} registros)`);
        } else {
          console.log(`❌ Tabela '${table}' não encontrada`);
        }
      } catch (error) {
        console.log(`❌ Erro ao verificar tabela '${table}': ${error.message}`);
      }
    }
    
    // 3. Verificar usuários
    console.log('\n3. Verificando usuários...');
    
    try {
      const usersQuery = await pool.query(`
        SELECT id, username, role, subscription_expiry, never_expires 
        FROM users 
        LIMIT 5
      `);
      
      if (usersQuery.rows.length > 0) {
        console.log(`✅ Encontrados ${usersQuery.rows.length} usuários:`);
        
        // Formatar a data de expiração da assinatura
        usersQuery.rows.forEach(user => {
          const expiryDate = user.subscription_expiry 
            ? new Date(user.subscription_expiry).toLocaleDateString()
            : 'N/A';
          
          console.log(`   - ID: ${user.id}, Usuário: ${user.username}, Função: ${user.role}, Expiração: ${expiryDate}`);
        });
      } else {
        console.log('⚠️ Nenhum usuário encontrado no sistema');
      }
    } catch (error) {
      console.log(`❌ Erro ao verificar usuários: ${error.message}`);
    }
    
    // 4. Testar consulta JOIN para verificar integridade referencial
    console.log('\n4. Verificando integridade referencial...');
    
    try {
      const joinQuery = await pool.query(`
        SELECT p.id, p.name, u.username
        FROM providers p
        JOIN users u ON p.user_id = u.id
        LIMIT 3
      `);
      
      if (joinQuery.rows.length > 0) {
        console.log(`✅ Integridade referencial verificada (providers -> users):`);
        joinQuery.rows.forEach(row => {
          console.log(`   - Provider: ${row.name} (ID: ${row.id}), Usuário: ${row.username}`);
        });
      } else {
        console.log('⚠️ Nenhum provider encontrado ou problema na relação entre tabelas');
      }
    } catch (error) {
      console.log(`❌ Erro ao verificar integridade referencial: ${error.message}`);
    }
    
    console.log('\n=== VERIFICAÇÃO CONCLUÍDA ===');
    console.log('Resumo:');
    console.log('- Conexão com o banco de dados: ✅');
    console.log(`- Tabelas verificadas: ${tables.length}`);
    
  } catch (error) {
    console.error(`\n❌ ERRO DE CONEXÃO: ${error.message}`);
    console.error('Verifique se:');
    console.error('1. A URL do banco de dados está correta');
    console.error('2. O banco de dados está acessível na rede');
    console.error('3. As credenciais estão corretas');
  } finally {
    // Fechar conexão
    await pool.end();
  }
}

// Executar o script
checkDatabaseConnection().catch(error => {
  console.error('Erro fatal:', error);
  process.exit(1);
});