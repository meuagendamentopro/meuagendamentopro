import { db, pool } from "../server/db";
import { providers } from "@shared/schema";
import { eq } from "drizzle-orm";

async function setProviderHours() {
  try {
    console.log("Atualizando horários de trabalho do provider...");
    
    // Horários específicos para configurar
    const workingHoursStart = 10; // 10h
    const workingHoursEnd = 20;   // 20h
    
    // Atualizar todos os providers (ou filtrar por ID caso necessário)
    const result = await db
      .update(providers)
      .set({
        workingHoursStart: workingHoursStart,
        workingHoursEnd: workingHoursEnd
      })
      .returning();
    
    console.log(`Providers atualizados: ${result.length}`);
    
    for (const provider of result) {
      console.log(`\nProvider ID ${provider.id} (${provider.name})`);
      console.log(`- Novo horário de trabalho: ${provider.workingHoursStart}h às ${provider.workingHoursEnd}h`);
    }
    
    console.log("\nHorários atualizados com sucesso!");
    
  } catch (error) {
    console.error("Erro ao atualizar horários:", error);
  } finally {
    await pool.end();
  }
}

setProviderHours();