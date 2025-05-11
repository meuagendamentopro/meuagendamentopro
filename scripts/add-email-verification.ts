import { pool, db } from "../server/db";
import { users } from "../shared/schema";
import { sql } from "drizzle-orm";

/**
 * Este script adiciona os campos necessários para a verificação de email no banco de dados
 * - is_email_verified
 * - verification_token
 * - verification_token_expiry
 */
async function addEmailVerificationColumns() {
  console.log('Iniciando migração: Adicionando campos para verificação de email...');

  try {
    // Verifica se a coluna is_email_verified já existe
    const checkEmailVerifiedResult = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'users' AND column_name = 'is_email_verified';
    `);

    if (checkEmailVerifiedResult.rows.length === 0) {
      console.log('Adicionando coluna is_email_verified...');
      await pool.query(`
        ALTER TABLE users
        ADD COLUMN is_email_verified BOOLEAN NOT NULL DEFAULT FALSE;
      `);
      console.log('Coluna is_email_verified adicionada com sucesso!');
    } else {
      console.log('Coluna is_email_verified já existe. Pulando...');
    }

    // Verifica se a coluna verification_token já existe
    const checkVerificationTokenResult = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'users' AND column_name = 'verification_token';
    `);

    if (checkVerificationTokenResult.rows.length === 0) {
      console.log('Adicionando coluna verification_token...');
      await pool.query(`
        ALTER TABLE users
        ADD COLUMN verification_token TEXT;
      `);
      console.log('Coluna verification_token adicionada com sucesso!');
    } else {
      console.log('Coluna verification_token já existe. Pulando...');
    }

    // Verifica se a coluna verification_token_expiry já existe
    const checkVerificationTokenExpiryResult = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'users' AND column_name = 'verification_token_expiry';
    `);

    if (checkVerificationTokenExpiryResult.rows.length === 0) {
      console.log('Adicionando coluna verification_token_expiry...');
      await pool.query(`
        ALTER TABLE users
        ADD COLUMN verification_token_expiry TIMESTAMP;
      `);
      console.log('Coluna verification_token_expiry adicionada com sucesso!');
    } else {
      console.log('Coluna verification_token_expiry já existe. Pulando...');
    }

    // Define todos os usuários existentes como verificados
    console.log('Definindo usuários existentes como verificados...');
    await db.update(users)
      .set({ isEmailVerified: true })
      .where(sql`is_email_verified IS NULL OR is_email_verified = FALSE`);
    
    console.log('✅ Migração concluída com sucesso!');
  } catch (error) {
    console.error('Erro durante a migração:', error);
    throw error;
  } finally {
    console.log('Encerrando conexão com o banco de dados...');
  }
}

// Executa a migração
addEmailVerificationColumns()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Erro ao executar a migração:', error);
    process.exit(1);
  });