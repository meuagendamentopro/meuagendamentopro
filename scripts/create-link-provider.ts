import { db, pool } from "../server/db";
import { users, providers, services } from "@shared/schema";
import { eq } from "drizzle-orm";

async function createLinkProvider() {
  try {
    console.log("Buscando usuário com username 'link'...");
    
    // Buscar o usuário
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.username, 'link'));
      
    if (!user) {
      console.error("Usuário 'link' não encontrado!");
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
        name: "Lincoln's Services",
        email: "lincoln@example.com",
        phone: "11999999999",
        specialties: "Serviços variados",
        workingHoursStart: 8,
        workingHoursEnd: 22,
        bookingLink: "link"
      })
      .returning();
      
    console.log(`Provider criado com sucesso: ID ${provider.id}`);
    
    // Criar serviços para o provider
    const servicesData = [
      {
        name: "Corte de Cabelo",
        description: "Corte de cabelo com estilo personalizado",
        duration: 45,
        price: 60,
        active: true
      },
      {
        name: "Barba",
        description: "Modelagem e acabamento de barba",
        duration: 30,
        price: 40,
        active: true
      },
      {
        name: "Corte + Barba",
        description: "Combo de corte de cabelo e barba",
        duration: 75,
        price: 90,
        active: true
      }
    ];
    
    for (const serviceData of servicesData) {
      const [service] = await db
        .insert(services)
        .values({
          providerId: provider.id,
          ...serviceData
        })
        .returning();
        
      console.log(`Serviço '${service.name}' criado com sucesso: ID ${service.id}`);
    }
    
  } catch (error) {
    console.error("Erro:", error);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

createLinkProvider();