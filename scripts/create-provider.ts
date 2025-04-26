import { db, pool } from "../server/db";
import { users, providers, services } from "@shared/schema";
import { eq } from "drizzle-orm";

async function createProvider() {
  try {
    console.log("Buscando usuário com username 'leandro'...");
    
    // Buscar o usuário
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.username, 'leandro'));
      
    if (!user) {
      console.error("Usuário 'leandro' não encontrado!");
      return;
    }
    
    console.log(`Usuário encontrado: ID ${user.id}, Nome: ${user.name}`);
    
    // Verificar se o provider já existe
    const [existingProvider] = await db
      .select()
      .from(providers)
      .where(eq(providers.userId, user.id));
      
    if (existingProvider) {
      console.log(`Provider já existe para o usuário ${user.id}: ID ${existingProvider.id}`);
      return;
    }
    
    // Criar provider
    const [provider] = await db
      .insert(providers)
      .values({
        userId: user.id,
        name: user.name,
        email: "leandro@example.com",
        phone: "11999999999",
        specialties: "Corte de cabelo",
        workingHoursStart: 10,
        workingHoursEnd: 21,
        bookingLink: "leandro"
      })
      .returning();
      
    console.log(`Provider criado com sucesso: ID ${provider.id}`);
    
    // Criar um serviço para o provider
    const [service] = await db
      .insert(services)
      .values({
        providerId: provider.id,
        name: "Corte de Cabelo",
        description: "Corte de cabelo masculino",
        duration: 60,
        price: 50,
        active: true
      })
      .returning();
      
    console.log(`Serviço criado com sucesso: ID ${service.id}`);
  } catch (error) {
    console.error("Erro:", error);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

createProvider();