const { Pool } = require('pg');

// Usar a mesma URL de conexão que está no arquivo local-config.ts
const pool = new Pool({
  connectionString: 'postgres://postgres:linday1818@localhost:5432/agendamento'
});

async function testConnection() {
  try {
    console.log('Tentando conectar ao PostgreSQL...');
    const result = await pool.query('SELECT 1 as test');
    console.log('Conexão bem-sucedida!', result.rows);
    
    // Verificar se o banco de dados 'agendamento_dev' existe
    console.log('Verificando se o banco de dados "agendamento_dev" existe...');
    
    // Verificar tabelas no banco de dados
    console.log('Verificando tabelas no banco de dados...');
    const tables = await pool.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"
    );
    console.log('Tabelas encontradas:', tables.rows.map(row => row.table_name));
    
    await pool.end();
  } catch (error) {
    console.error('Erro ao conectar ao PostgreSQL:', error);
    process.exit(1);
  }
}

testConnection();
