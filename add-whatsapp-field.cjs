const { Pool } = require('pg');

async function addWhatsappPopupField() {
  // Usar a mesma configuração do projeto
  const connectionString = 'postgres://postgres:linday1818@localhost:5432/agendamento';
  
  console.log('Conectando ao banco de dados...');
  const pool = new Pool({ connectionString });

  console.log('Adicionando campo hide_whatsapp_popup na tabela users...');
  
  try {
    // Verificar se o campo já existe
    const checkColumn = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'hide_whatsapp_popup'
    `);

    if (checkColumn.rows.length > 0) {
      console.log('Campo hide_whatsapp_popup já existe na tabela users!');
    } else {
      // Adicionar o campo hide_whatsapp_popup se não existir
      await pool.query(`
        ALTER TABLE users ADD COLUMN hide_whatsapp_popup BOOLEAN NOT NULL DEFAULT FALSE;
      `);
      
      console.log('Campo hide_whatsapp_popup adicionado com sucesso!');
    }
  } catch (error) {
    console.error('Erro ao adicionar campo:', error);
    process.exit(1);
  } finally {
    await pool.end();
    console.log('Conexão fechada.');
  }
}

addWhatsappPopupField(); 