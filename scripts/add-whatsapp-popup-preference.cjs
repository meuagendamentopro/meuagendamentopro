require('dotenv').config();
const { Pool } = require('@neondatabase/serverless');

async function addWhatsappPopupPreference() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  console.log('Conectando ao banco de dados...');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  console.log('Adicionando campo hide_whatsapp_popup na tabela users...');
  
  try {
    // Adicionar o campo hide_whatsapp_popup se não existir
    await pool.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'users' AND column_name = 'hide_whatsapp_popup'
        ) THEN
          ALTER TABLE users ADD COLUMN hide_whatsapp_popup BOOLEAN NOT NULL DEFAULT FALSE;
          COMMENT ON COLUMN users.hide_whatsapp_popup IS 'Preferência do usuário para não mostrar popup do WhatsApp';
        END IF;
      END $$;
    `);

    console.log('Campo hide_whatsapp_popup adicionado com sucesso!');
  } catch (error) {
    console.error('Erro ao adicionar campo:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

addWhatsappPopupPreference(); 