import { db, pool } from "../server/db";
import { providers, providerWorkingDays } from "@shared/schema";
import { eq } from "drizzle-orm";

async function setLinkProviderHours() {
  try {
    // Buscar o provider do usuário link
    const [provider] = await db
      .select()
      .from(providers)
      .where(eq(providers.bookingLink, 'link'));
      
    if (!provider) {
      console.error("Provider 'link' não encontrado!");
      return;
    }
    
    console.log(`Provider encontrado: ID ${provider.id}, Nome: ${provider.name}`);
    
    // Definir dias de trabalho
    const workingDays = [
      { day: 0, active: false }, // Domingo
      { day: 1, active: true },  // Segunda
      { day: 2, active: true },  // Terça
      { day: 3, active: true },  // Quarta
      { day: 4, active: true },  // Quinta
      { day: 5, active: true },  // Sexta
      { day: 6, active: true },  // Sábado
    ];
    
    // Excluir configurações existentes
    await db.delete(providerWorkingDays).where(eq(providerWorkingDays.providerId, provider.id));
    console.log("Configurações anteriores removidas");
    
    // Inserir novos dias de trabalho
    for (const { day, active } of workingDays) {
      await db.insert(providerWorkingDays).values({
        providerId: provider.id,
        dayOfWeek: day,
        active
      });
      
      console.log(`Dia ${day} configurado com status: ${active ? 'ativo' : 'inativo'}`);
    }
    
    console.log("Dias de trabalho configurados com sucesso!");
    
  } catch (error) {
    console.error("Erro:", error);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

setLinkProviderHours();