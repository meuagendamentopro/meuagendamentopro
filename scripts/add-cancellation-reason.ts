import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function addCancellationReasonColumn() {
  console.log("Adicionando coluna cancellation_reason à tabela appointments...");
  
  try {
    // Verificar se a coluna já existe para evitar erros
    const checkColumn = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'appointments' 
      AND column_name = 'cancellation_reason'
    `);
    
    if (checkColumn.rows.length === 0) {
      // A coluna não existe, vamos adicioná-la
      await db.execute(sql`
        ALTER TABLE appointments 
        ADD COLUMN cancellation_reason TEXT
      `);
      console.log("Coluna cancellation_reason adicionada com sucesso!");
    } else {
      console.log("A coluna cancellation_reason já existe na tabela.");
    }
    
  } catch (error) {
    console.error("Erro ao adicionar coluna cancellation_reason:", error);
    throw error;
  }
}

// Executar a função principal
addCancellationReasonColumn()
  .then(() => {
    console.log("Script concluído com sucesso!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Erro ao executar o script:", error);
    process.exit(1);
  });