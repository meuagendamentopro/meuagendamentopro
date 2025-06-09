// Script para testar a conexão com o PostgreSQL
const { Pool } = require('pg');

// Usar a mesma URL de conexão do arquivo .env
const pool = new Pool({
  connectionString: 'postgres://postgres:linday1818@localhost:5432/agendamento'
});

async function testDatabase() {
  try {
    console.log('Tentando conectar ao PostgreSQL...');
    const result = await pool.query('SELECT 1 as test');
    console.log('Conexão bem-sucedida!', result.rows);
    
    // Verificar tabelas no banco de dados
    console.log('Verificando tabelas no banco de dados...');
    const tables = await pool.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"
    );
    console.log('Tabelas encontradas:', tables.rows.map(row => row.table_name));
    
    // Verificar se a tabela de sessões existe
    console.log('Verificando tabela de sessões...');
    const sessionTable = await pool.query(
      "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'session')"
    );
    
    if (sessionTable.rows[0].exists) {
      console.log('Tabela de sessões existe!');
      
      // Verificar estrutura da tabela de sessões
      try {
        await pool.query('SELECT sid, sess, expire FROM "session" LIMIT 0');
        console.log('Estrutura da tabela de sessões está correta.');
      } catch (err) {
        console.error('Erro ao verificar estrutura da tabela de sessões:', err);
        
        // Tentar recriar a tabela
        console.log('Tentando recriar a tabela de sessões...');
        await pool.query('DROP TABLE IF EXISTS "session"');
        await pool.query(`
          CREATE TABLE "session" (
            "sid" varchar NOT NULL COLLATE "default",
            "sess" json NOT NULL,
            "expire" timestamp(6) NOT NULL,
            CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
          )
        `);
        console.log('Tabela de sessões recriada com sucesso!');
      }
    } else {
      console.log('Tabela de sessões não existe. Criando...');
      await pool.query(`
        CREATE TABLE "session" (
          "sid" varchar NOT NULL COLLATE "default",
          "sess" json NOT NULL,
          "expire" timestamp(6) NOT NULL,
          CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
        )
      `);
      console.log('Tabela de sessões criada com sucesso!');
    }
    
    await pool.end();
    console.log('Teste concluído com sucesso!');
  } catch (error) {
    console.error('Erro ao testar banco de dados:', error);
    process.exit(1);
  }
}

testDatabase();
