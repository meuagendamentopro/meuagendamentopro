import { db } from "../db";
import { systemSettings } from "../../shared/schema";

async function main() {
  console.log("Iniciando migração para adicionar campo de período de teste nas configurações do sistema...");
  
  try {
    // Adicionar a coluna trial_period_days à tabela system_settings
    await db.execute(`
      ALTER TABLE system_settings 
      ADD COLUMN IF NOT EXISTS trial_period_days INTEGER NOT NULL DEFAULT 3;
    `);
    
    console.log("Coluna trial_period_days adicionada com sucesso!");
    
    // Atualizar as configurações existentes para definir o valor padrão
    await db.execute(`
      UPDATE system_settings 
      SET trial_period_days = 3 
      WHERE trial_period_days IS NULL;
    `);
    
    console.log("Migração concluída com sucesso!");
  } catch (error) {
    console.error("Erro durante a migração:", error);
    process.exit(1);
  }
  
  process.exit(0);
}

main();
