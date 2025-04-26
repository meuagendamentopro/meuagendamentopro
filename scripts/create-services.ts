import { db, pool } from "../server/db";
import { providers, services } from "@shared/schema";
import { eq } from "drizzle-orm";

async function createServices() {
  try {
    console.log("Buscando todos os providers no banco de dados...");
    
    // Buscar todos os providers
    const allProviders = await db
      .select()
      .from(providers);
      
    if (allProviders.length === 0) {
      console.error("Nenhum provider encontrado no banco de dados!");
      return;
    }
    
    console.log(`Encontrados ${allProviders.length} providers.`);
    
    // Para cada provider, criar serviços
    for (const provider of allProviders) {
      console.log(`Criando serviços para provider ID ${provider.id} (${provider.name})`);
      
      // Verificar se já existem serviços para este provider
      const existingServices = await db
        .select()
        .from(services)
        .where(eq(services.providerId, provider.id));
        
      if (existingServices.length > 0) {
        console.log(`Provider ID ${provider.id} já possui ${existingServices.length} serviços cadastrados. Pulando...`);
        continue;
      }
      
      // Criar serviços para o provider
      const servicesToCreate = [
        {
          providerId: provider.id,
          name: "Corte de Cabelo",
          description: "Corte de cabelo masculino",
          duration: 60,
          price: 50,
          active: true
        },
        {
          providerId: provider.id,
          name: "Barba",
          description: "Modelagem e acabamento de barba",
          duration: 45,
          price: 35,
          active: true
        },
        {
          providerId: provider.id,
          name: "Corte + Barba",
          description: "Combo de corte de cabelo e barba",
          duration: 90,
          price: 75,
          active: true
        }
      ];
      
      for (const serviceData of servicesToCreate) {
        const [service] = await db
          .insert(services)
          .values(serviceData)
          .returning();
          
        console.log(`Serviço criado: ID ${service.id} - ${service.name}`);
      }
      
      console.log(`Serviços criados com sucesso para provider ID ${provider.id}`);
    }
    
    console.log("Processo de criação de serviços concluído com sucesso!");
    
  } catch (error) {
    console.error("Erro:", error);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

createServices();