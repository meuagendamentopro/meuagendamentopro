import { db, pool } from "../server/db";
import { providers } from "@shared/schema";
import { eq } from "drizzle-orm";

async function updateProviderSettings() {
  try {
    console.log("Atualizando configurações de horários do provider...");
    
    // Buscar todos os providers
    const allProviders = await db
      .select()
      .from(providers);
      
    if (allProviders.length === 0) {
      console.error("Nenhum provider encontrado no banco de dados!");
      return;
    }
    
    console.log(`Encontrados ${allProviders.length} providers.`);
    
    // Para cada provider, atualizar configurações
    for (const provider of allProviders) {
      console.log(`Provider ID ${provider.id} (${provider.name})`);
      console.log(`- Configuração atual: Horário de ${provider.workingHoursStart}h às ${provider.workingHoursEnd}h`);
      
      // Atualizar configurações
      const [updatedProvider] = await db
        .update(providers)
        .set({
          workingHoursStart: 8,  // Começa às 8h
          workingHoursEnd: 21    // Termina às 21h
        })
        .where(eq(providers.id, provider.id))
        .returning();
        
      console.log(`- Nova configuração: Horário de ${updatedProvider.workingHoursStart}h às ${updatedProvider.workingHoursEnd}h`);
    }
    
    console.log("Atualização concluída com sucesso!");
    
  } catch (error) {
    console.error("Erro:", error);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

updateProviderSettings();