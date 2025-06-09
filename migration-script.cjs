const { Pool } = require('pg');
const readline = require('readline');

// Configuração do banco de dados
// IMPORTANTE: Configure estas variáveis com os dados do seu ambiente de produção
const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'seu_banco_producao',
  user: process.env.DB_USER || 'seu_usuario',
  password: process.env.DB_PASSWORD || 'sua_senha',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
};

const pool = new Pool(DB_CONFIG);

// Interface para confirmação do usuário
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Função para fazer perguntas ao usuário
function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

// Definição das tabelas e colunas necessárias
const REQUIRED_SCHEMA = {
  users: {
    columns: {
      id: 'SERIAL PRIMARY KEY',
      name: 'VARCHAR(255) NOT NULL',
      username: 'VARCHAR(100) UNIQUE NOT NULL',
      email: 'VARCHAR(255) UNIQUE NOT NULL',
      password: 'VARCHAR(255) NOT NULL',
      phone: 'VARCHAR(20)',
      createdAt: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
      updatedAt: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
      accountType: 'VARCHAR(20) DEFAULT \'individual\' CHECK (accountType IN (\'individual\', \'company\'))'
    },
    indexes: [
      'CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)',
      'CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)',
      'CREATE INDEX IF NOT EXISTS idx_users_account_type ON users(accountType)'
    ]
  },
  
  employees: {
    columns: {
      id: 'SERIAL PRIMARY KEY',
      companyUserId: 'INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE',
      name: 'VARCHAR(255) NOT NULL',
      email: 'VARCHAR(255)',
      phone: 'VARCHAR(20)',
      position: 'VARCHAR(100)',
      specialty: 'VARCHAR(255)',
      lunchBreakStart: 'VARCHAR(5) DEFAULT \'12:00\'',
      lunchBreakEnd: 'VARCHAR(5) DEFAULT \'13:00\'',
      isActive: 'BOOLEAN DEFAULT true',
      createdAt: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
      updatedAt: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP'
    },
    indexes: [
      'CREATE INDEX IF NOT EXISTS idx_employees_company_user_id ON employees(companyUserId)',
      'CREATE INDEX IF NOT EXISTS idx_employees_active ON employees(isActive)'
    ]
  },
  
  employeeServices: {
    columns: {
      id: 'SERIAL PRIMARY KEY',
      employeeId: 'INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE',
      serviceId: 'INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE',
      createdAt: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP'
    },
    indexes: [
      'CREATE UNIQUE INDEX IF NOT EXISTS idx_employee_services_unique ON employeeServices(employeeId, serviceId)',
      'CREATE INDEX IF NOT EXISTS idx_employee_services_employee ON employeeServices(employeeId)',
      'CREATE INDEX IF NOT EXISTS idx_employee_services_service ON employeeServices(serviceId)'
    ]
  },
  
  appointments: {
    columns: {
      employeeId: 'INTEGER REFERENCES employees(id) ON DELETE SET NULL'
    }
  }
};

// Função para verificar se uma tabela existe
async function tableExists(tableName) {
  try {
    const result = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = $1
      )
    `, [tableName]);
    
    return result.rows[0].exists;
  } catch (error) {
    console.error(`Erro ao verificar tabela ${tableName}:`, error.message);
    return false;
  }
}

// Função para verificar se uma coluna existe
async function columnExists(tableName, columnName) {
  try {
    const result = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = $1 
        AND column_name = $2
      )
    `, [tableName, columnName]);
    
    return result.rows[0].exists;
  } catch (error) {
    console.error(`Erro ao verificar coluna ${columnName} na tabela ${tableName}:`, error.message);
    return false;
  }
}

// Função para criar uma tabela
async function createTable(tableName, columns) {
  try {
    const columnDefinitions = Object.entries(columns)
      .map(([name, definition]) => `${name} ${definition}`)
      .join(',\n  ');
    
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS ${tableName} (
        ${columnDefinitions}
      )
    `;
    
    await pool.query(createTableSQL);
    console.log(`✅ Tabela '${tableName}' criada com sucesso`);
    return true;
  } catch (error) {
    console.error(`❌ Erro ao criar tabela '${tableName}':`, error.message);
    return false;
  }
}

// Função para adicionar uma coluna
async function addColumn(tableName, columnName, columnDefinition) {
  try {
    const addColumnSQL = `ALTER TABLE ${tableName} ADD COLUMN IF NOT EXISTS ${columnName} ${columnDefinition}`;
    await pool.query(addColumnSQL);
    console.log(`✅ Coluna '${columnName}' adicionada à tabela '${tableName}'`);
    return true;
  } catch (error) {
    console.error(`❌ Erro ao adicionar coluna '${columnName}' à tabela '${tableName}':`, error.message);
    return false;
  }
}

// Função para criar índices
async function createIndexes(tableName, indexes) {
  for (const indexSQL of indexes) {
    try {
      await pool.query(indexSQL);
      console.log(`✅ Índice criado: ${indexSQL.split(' ')[5] || 'índice'}`);
    } catch (error) {
      console.error(`❌ Erro ao criar índice:`, error.message);
    }
  }
}

// Função principal de migração
async function runMigration() {
  console.log('🚀 INICIANDO MIGRAÇÃO DO BANCO DE DADOS');
  console.log('=====================================');
  console.log();
  
  // Mostrar configuração do banco
  console.log('📋 Configuração do banco de dados:');
  console.log(`   Host: ${DB_CONFIG.host}`);
  console.log(`   Port: ${DB_CONFIG.port}`);
  console.log(`   Database: ${DB_CONFIG.database}`);
  console.log(`   User: ${DB_CONFIG.user}`);
  console.log();
  
  // Confirmar antes de prosseguir
  const confirm = await askQuestion('⚠️  Deseja prosseguir com a migração? (s/N): ');
  if (confirm.toLowerCase() !== 's' && confirm.toLowerCase() !== 'sim') {
    console.log('❌ Migração cancelada pelo usuário');
    rl.close();
    return;
  }
  
  console.log();
  console.log('🔍 Verificando estrutura do banco de dados...');
  console.log();
  
  let totalChanges = 0;
  
  try {
    // Testar conexão
    await pool.query('SELECT NOW()');
    console.log('✅ Conexão com o banco de dados estabelecida');
    console.log();
    
    // Processar cada tabela
    for (const [tableName, tableSchema] of Object.entries(REQUIRED_SCHEMA)) {
      console.log(`📋 Verificando tabela: ${tableName}`);
      
      const exists = await tableExists(tableName);
      
      if (!exists) {
        console.log(`   ⚠️  Tabela '${tableName}' não existe - criando...`);
        const success = await createTable(tableName, tableSchema.columns);
        if (success) {
          totalChanges++;
          
          // Criar índices se a tabela foi criada
          if (tableSchema.indexes) {
            await createIndexes(tableName, tableSchema.indexes);
          }
        }
      } else {
        console.log(`   ✅ Tabela '${tableName}' existe`);
        
        // Verificar colunas
        for (const [columnName, columnDefinition] of Object.entries(tableSchema.columns)) {
          const columnExistsResult = await columnExists(tableName, columnName);
          
          if (!columnExistsResult) {
            console.log(`   ⚠️  Coluna '${columnName}' não existe - adicionando...`);
            const success = await addColumn(tableName, columnName, columnDefinition);
            if (success) totalChanges++;
          } else {
            console.log(`   ✅ Coluna '${columnName}' existe`);
          }
        }
        
        // Criar índices (se não existirem)
        if (tableSchema.indexes) {
          await createIndexes(tableName, tableSchema.indexes);
        }
      }
      
      console.log();
    }
    
    // Verificações especiais para tabelas existentes
    console.log('🔧 Verificações adicionais...');
    
    // Verificar se a tabela appointments tem a coluna employeeId
    const appointmentsExists = await tableExists('appointments');
    if (appointmentsExists) {
      const employeeIdExists = await columnExists('appointments', 'employeeId');
      if (!employeeIdExists) {
        console.log('   ⚠️  Adicionando coluna employeeId à tabela appointments...');
        const success = await addColumn('appointments', 'employeeId', 'INTEGER REFERENCES employees(id) ON DELETE SET NULL');
        if (success) totalChanges++;
      } else {
        console.log('   ✅ Coluna employeeId já existe na tabela appointments');
      }
    }
    
    // Verificar se a tabela users tem a coluna accountType
    const usersExists = await tableExists('users');
    if (usersExists) {
      const accountTypeExists = await columnExists('users', 'accountType');
      if (!accountTypeExists) {
        console.log('   ⚠️  Adicionando coluna accountType à tabela users...');
        const success = await addColumn('users', 'accountType', 'VARCHAR(20) DEFAULT \'individual\' CHECK (accountType IN (\'individual\', \'company\'))');
        if (success) totalChanges++;
      } else {
        console.log('   ✅ Coluna accountType já existe na tabela users');
      }
    }
    
    console.log();
    console.log('🎉 MIGRAÇÃO CONCLUÍDA!');
    console.log('=====================');
    console.log(`📊 Total de alterações realizadas: ${totalChanges}`);
    
    if (totalChanges > 0) {
      console.log();
      console.log('✅ Seu banco de dados foi atualizado com sucesso!');
      console.log('✅ Todas as tabelas e colunas necessárias estão disponíveis');
      console.log('✅ O sistema de gerenciamento de equipe está pronto para uso');
    } else {
      console.log();
      console.log('✅ Seu banco de dados já estava atualizado!');
      console.log('✅ Nenhuma alteração foi necessária');
    }
    
  } catch (error) {
    console.error('❌ Erro durante a migração:', error.message);
    console.error('Stack trace:', error.stack);
  } finally {
    await pool.end();
    rl.close();
  }
}

// Executar migração se o script for chamado diretamente
if (require.main === module) {
  runMigration().catch(console.error);
}

module.exports = { runMigration }; 