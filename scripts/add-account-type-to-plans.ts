/**
 * Script para adicionar a coluna account_type na tabela subscription_plans
 * Execução: npx tsx scripts/add-account-type-to-plans.ts
 */

import { pool } from '../server/db';

async function addAccountTypeToPlans() {
  console.log("Adicionando coluna account_type na tabela subscription_plans...");
  
  try {
    // Verificar se a coluna já existe
    const checkColumn = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'subscription_plans' 
      AND column_name = 'account_type'
    `);
    
    if (checkColumn.rows.length > 0) {
      console.log("Coluna account_type já existe na tabela subscription_plans.");
      return;
    }
    
    // Adicionar a coluna account_type
    await pool.query(`
      ALTER TABLE subscription_plans 
      ADD COLUMN account_type TEXT NOT NULL DEFAULT 'individual'
    `);
    
    console.log("Coluna account_type adicionada com sucesso!");
    
    // Verificar se existem planos e mostrar status
    const plans = await pool.query(`
      SELECT id, name, account_type 
      FROM subscription_plans 
      ORDER BY id
    `);
    
    console.log(`\nPlanos existentes (${plans.rows.length} total):`);
    plans.rows.forEach((plan: any) => {
      console.log(`- ID ${plan.id}: ${plan.name} (${plan.account_type})`);
    });
    
    console.log("\nMigração concluída com sucesso!");
    
  } catch (error) {
    console.error("Erro ao adicionar coluna account_type:", error);
  } finally {
    await pool.end();
  }
}

// Executar a migração
addAccountTypeToPlans(); 