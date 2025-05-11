import { db } from '../server/db';
import { sql } from 'drizzle-orm';

async function addSubscriptionFields() {
  try {
    console.log('Adicionando campos de assinatura à tabela users...');
    
    // Verificando se a coluna email já existe
    const checkEmailColumn = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='users' AND column_name='email'
    `);
    
    if (checkEmailColumn.rowCount === 0) {
      // Adicionar a coluna de email
      await db.execute(sql`
        ALTER TABLE users 
        ADD COLUMN email TEXT;
      `);
      console.log('Coluna email adicionada');
      
      // Atualizar emails para valores únicos baseados no username
      await db.execute(sql`
        UPDATE users 
        SET email = username || '@temp.com' 
        WHERE email IS NULL;
      `);
      console.log('Emails temporários definidos para usuários existentes');
      
      // Tornar coluna NOT NULL
      await db.execute(sql`
        ALTER TABLE users 
        ALTER COLUMN email SET NOT NULL;
      `);
      
      // Criar índice único para email
      await db.execute(sql`
        CREATE UNIQUE INDEX email_idx ON users (email);
      `);
      console.log('Índice único criado para email');
    } else {
      console.log('Coluna email já existe');
    }
    
    // Verificando se a coluna subscription_expiry já existe
    const checkSubscriptionColumn = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='users' AND column_name='subscription_expiry'
    `);
    
    if (checkSubscriptionColumn.rowCount === 0) {
      // Adicionar a coluna de expiração de assinatura
      await db.execute(sql`
        ALTER TABLE users 
        ADD COLUMN subscription_expiry TIMESTAMP;
      `);
      console.log('Coluna subscription_expiry adicionada');
    } else {
      console.log('Coluna subscription_expiry já existe');
    }
    
    // Verificando se a coluna never_expires já existe
    const checkNeverExpiresColumn = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='users' AND column_name='never_expires'
    `);
    
    if (checkNeverExpiresColumn.rowCount === 0) {
      // Adicionar a coluna never_expires
      await db.execute(sql`
        ALTER TABLE users 
        ADD COLUMN never_expires BOOLEAN NOT NULL DEFAULT false;
      `);
      console.log('Coluna never_expires adicionada');
    } else {
      console.log('Coluna never_expires já existe');
    }
    
    // Configurando os usuários administradores para nunca expirarem
    await db.execute(sql`
      UPDATE users
      SET never_expires = true
      WHERE role = 'admin';
    `);
    console.log('Usuários admin definidos para nunca expirar');
    
    console.log('Migração concluída com sucesso!');
  } catch (error) {
    console.error('Erro ao realizar migração:', error);
  } finally {
    process.exit(0);
  }
}

// Executar a função principal
addSubscriptionFields();