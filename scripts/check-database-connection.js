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

const { Pool } = require('pg');
require('dotenv').config();

// Cores para o console
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

// Tabelas para verificar
const REQUIRED_TABLES = [
  'users',
  'providers',
  'clients',
  'provider_clients',
  'services',
  'appointments',
  'notifications',
  'time_exclusions'
];

// Obter a URL do banco de dados
let databaseUrl = process.argv[2] || process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error(`${colors.red}Erro: DATABASE_URL não fornecida.${colors.reset}`);
  console.log(`Por favor, passe a URL como argumento ou defina DATABASE_URL no arquivo .env:`);
  console.log(`  node scripts/check-database-connection.js "postgres://usuario:senha@host:porta/banco"`);
  process.exit(1);
}

// Mascara a senha na URL para exibição
function maskDatabaseUrl(url) {
  return url.replace(/\/\/([^:]+):([^@]+)@/, '//\\1:********@');
}

// Função principal
async function checkDatabaseConnection() {
  console.log(`\n${colors.bright}${colors.blue}=== VERIFICAÇÃO DE CONEXÃO COM BANCO DE DADOS ===${colors.reset}\n`);
  console.log(`${colors.cyan}Conectando ao banco de dados: ${colors.yellow}${maskDatabaseUrl(databaseUrl)}${colors.reset}\n`);
  
  // Criar pool de conexão
  const pool = new Pool({ connectionString: databaseUrl });
  
  try {
    // Testar conexão
    console.log(`${colors.cyan}Testando conexão...${colors.reset}`);
    const connectionStart = Date.now();
    const connectionResult = await pool.query('SELECT NOW()');
    const connectionTime = Date.now() - connectionStart;
    
    console.log(`${colors.green}✓ Conexão bem-sucedida!${colors.reset}`);
    console.log(`${colors.cyan}  Tempo de resposta: ${colors.yellow}${connectionTime}ms${colors.reset}`);
    console.log(`${colors.cyan}  Horário do servidor: ${colors.yellow}${connectionResult.rows[0].now}${colors.reset}\n`);
    
    // Verificar versão do PostgreSQL
    console.log(`${colors.cyan}Verificando versão do PostgreSQL...${colors.reset}`);
    const versionResult = await pool.query('SELECT version()');
    console.log(`${colors.green}✓ Versão do PostgreSQL: ${colors.yellow}${versionResult.rows[0].version.split(',')[0]}${colors.reset}\n`);
    
    // Verificar tabelas
    console.log(`${colors.cyan}Verificando tabelas...${colors.reset}`);
    
    const tablesResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    `);
    
    const existingTables = tablesResult.rows.map(row => row.table_name);
    
    console.log(`${colors.cyan}  Tabelas encontradas: ${colors.yellow}${existingTables.length}${colors.reset}`);
    
    let allTablesExist = true;
    
    for (const table of REQUIRED_TABLES) {
      if (existingTables.includes(table)) {
        console.log(`${colors.green}  ✓ Tabela ${colors.yellow}${table}${colors.green} encontrada${colors.reset}`);
      } else {
        console.log(`${colors.red}  ✗ Tabela ${colors.yellow}${table}${colors.red} não encontrada${colors.reset}`);
        allTablesExist = false;
      }
    }
    
    if (!allTablesExist) {
      console.log(`\n${colors.yellow}Aviso: Algumas tabelas necessárias não foram encontradas.${colors.reset}`);
      console.log(`${colors.yellow}Execute o script de migração para criar as tabelas:${colors.reset}`);
      console.log(`  npm run db:push`);
    } else {
      console.log(`\n${colors.green}✓ Todas as tabelas necessárias existem.${colors.reset}\n`);
      
      // Verificar contagem de registros
      console.log(`${colors.cyan}Verificando dados...${colors.reset}`);
      
      const counts = {};
      
      for (const table of REQUIRED_TABLES) {
        const countResult = await pool.query(`SELECT COUNT(*) FROM ${table}`);
        counts[table] = parseInt(countResult.rows[0].count, 10);
        
        if (counts[table] > 0) {
          console.log(`${colors.green}  ✓ Tabela ${colors.yellow}${table}${colors.green} contém ${colors.yellow}${counts[table]}${colors.green} registros${colors.reset}`);
        } else {
          console.log(`${colors.yellow}  ! Tabela ${colors.yellow}${table}${colors.yellow} está vazia${colors.reset}`);
        }
      }
      
      // Verificar relações
      if (counts.users > 0 && counts.providers > 0) {
        console.log(`\n${colors.cyan}Verificando relações entre usuários e provedores...${colors.reset}`);
        
        const relationResult = await pool.query(`
          SELECT u.id as user_id, u.username, p.id as provider_id, p.name
          FROM users u
          LEFT JOIN providers p ON u.id = p.user_id
          LIMIT 5
        `);
        
        if (relationResult.rows.length > 0) {
          console.log(`${colors.green}  ✓ Relações usuário-provedor estão intactas${colors.reset}`);
          console.log(`${colors.cyan}  Amostra de dados:${colors.reset}`);
          
          relationResult.rows.forEach(row => {
            console.log(`    Usuário: ${colors.yellow}${row.username}${colors.reset} → Provedor: ${colors.yellow}${row.name || 'Nenhum'}${colors.reset}`);
          });
        } else {
          console.log(`${colors.yellow}  ! Não foi possível encontrar relações entre usuários e provedores${colors.reset}`);
        }
      }
      
      // Verificar conexões ativas
      console.log(`\n${colors.cyan}Verificando conexões ativas no banco de dados...${colors.reset}`);
      
      const connectionsResult = await pool.query(`
        SELECT count(*) FROM pg_stat_activity 
        WHERE datname = current_database()
      `);
      
      console.log(`${colors.green}  ✓ Conexões ativas: ${colors.yellow}${connectionsResult.rows[0].count}${colors.reset}\n`);
    }
    
    // Verificar configurações
    console.log(`${colors.cyan}Verificando configurações...${colors.reset}`);
    
    const settings = [
      { name: 'max_connections', description: 'Máximo de conexões' },
      { name: 'timezone', description: 'Fuso horário' },
      { name: 'work_mem', description: 'Memória de trabalho' },
      { name: 'statement_timeout', description: 'Timeout de consultas' }
    ];
    
    for (const setting of settings) {
      try {
        const settingResult = await pool.query(`SHOW ${setting.name}`);
        console.log(`${colors.green}  ✓ ${setting.description}: ${colors.yellow}${settingResult.rows[0][setting.name]}${colors.reset}`);
      } catch (err) {
        console.log(`${colors.yellow}  ! Não foi possível verificar ${setting.description}${colors.reset}`);
      }
    }
    
    // Resumo
    console.log(`\n${colors.bright}${colors.green}=== RESUMO DA VERIFICAÇÃO ===${colors.reset}\n`);
    console.log(`${colors.green}✓ Conexão com o banco de dados: ${colors.bright}SUCESSO${colors.reset}`);
    console.log(`${colors.green}✓ Estrutura das tabelas: ${allTablesExist ? colors.bright + 'COMPLETA' : colors.yellow + 'INCOMPLETA'}${colors.reset}`);
    
    const hasData = Object.values(counts).some(count => count > 0);
    console.log(`${colors.green}✓ Dados presentes: ${hasData ? colors.bright + 'SIM' : colors.yellow + 'NÃO'}${colors.reset}\n`);
    
    console.log(`${colors.blue}Recomendações:${colors.reset}`);
    
    if (!allTablesExist) {
      console.log(`${colors.yellow}• Execute "npm run db:push" para criar as tabelas necessárias${colors.reset}`);
    } else if (!hasData) {
      console.log(`${colors.yellow}• Execute "node scripts/migrate-to-local-db.js" para popular o banco com dados iniciais${colors.reset}`);
    } else {
      console.log(`${colors.green}• O banco de dados está pronto para uso!${colors.reset}`);
    }
    
    console.log(`\n${colors.blue}Para iniciar o servidor de desenvolvimento:${colors.reset}`);
    console.log(`  npm run dev\n`);
    
  } catch (err) {
    console.error(`\n${colors.red}Erro ao conectar ao banco de dados:${colors.reset}`);
    console.error(`${colors.red}${err.message}${colors.reset}\n`);
    
    console.log(`${colors.yellow}Possíveis causas:${colors.reset}`);
    
    if (err.message.includes('connect ECONNREFUSED')) {
      console.log(`${colors.yellow}• O servidor PostgreSQL não está em execução no host especificado${colors.reset}`);
      console.log(`${colors.yellow}• O host ou porta estão incorretos${colors.reset}`);
    } else if (err.message.includes('password authentication failed')) {
      console.log(`${colors.yellow}• Credenciais (usuário/senha) incorretas${colors.reset}`);
    } else if (err.message.includes('database') && err.message.includes('does not exist')) {
      console.log(`${colors.yellow}• O banco de dados especificado não existe${colors.reset}`);
      console.log(`${colors.yellow}• Você precisa criar o banco de dados:${colors.reset}`);
      console.log(`    createdb -h ${databaseUrl.match(/@([^:]+):/)[1]} -U <usuário> <nome_do_banco>`);
    }
    
    console.log(`\n${colors.yellow}Para mais informações, consulte:${colors.reset}`);
    console.log(`  docs/postgresql-troubleshooting.md\n`);
  } finally {
    // Fechar a conexão
    await pool.end();
  }
}

// Executar função principal
checkDatabaseConnection()
  .catch(err => {
    console.error(`\n${colors.red}Erro fatal:${colors.reset}`, err);
    process.exit(1);
  });