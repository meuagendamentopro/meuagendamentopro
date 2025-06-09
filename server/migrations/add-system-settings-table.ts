import { db } from "../db";
import { systemSettings } from "../../shared/schema";

async function main() {
  console.log("Iniciando migração para adicionar tabela de configurações do sistema...");
  
  try {
    // Criar a tabela system_settings
    await db.execute(`
      CREATE TABLE IF NOT EXISTS system_settings (
        id SERIAL PRIMARY KEY,
        site_name TEXT DEFAULT 'Meu Agendamento PRO',
        logo_url TEXT,
        favicon_url TEXT,
        primary_color TEXT DEFAULT '#0891b2',
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    
    // Inserir configurações padrão se a tabela estiver vazia
    const existingSettings = await db.select().from(systemSettings);
    
    if (existingSettings.length === 0) {
      await db.insert(systemSettings).values({
        siteName: "Meu Agendamento PRO",
        logoUrl: null,
        faviconUrl: null,
        primaryColor: "#0891b2",
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      console.log("Configurações padrão inseridas com sucesso!");
    }
    
    console.log("Migração concluída com sucesso!");
  } catch (error) {
    console.error("Erro durante a migração:", error);
    process.exit(1);
  }
  
  process.exit(0);
}

main();
