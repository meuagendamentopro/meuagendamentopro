/**
 * Script para criar planos de assinatura padrão
 * Execução: npx tsx scripts/create-subscription-plans.ts
 */

import { db } from '../server/db';
import { subscriptionPlans } from '../shared/schema';
import { eq } from 'drizzle-orm';
import { pool } from '../server/db';

async function createSubscriptionPlans() {
  console.log("Criando planos de assinatura padrão...");
  
  // Planos padrão
  const defaultPlans = [
    {
      name: "Mensal",
      description: "Acesso a todas as funcionalidades por 1 mês",
      durationMonths: 1,
      price: 4990, // R$ 49,90
      isActive: true
    },
    {
      name: "Trimestral",
      description: "Acesso a todas as funcionalidades por 3 meses com desconto",
      durationMonths: 3,
      price: 12900, // R$ 129,00
      isActive: true
    },
    {
      name: "Anual",
      description: "Acesso a todas as funcionalidades por 12 meses com maior desconto",
      durationMonths: 12,
      price: 39900, // R$ 399,00
      isActive: true
    }
  ];
  
  try {
    // Verificar quais planos já existem
    const existingPlans = await db.select().from(subscriptionPlans);
    console.log(`Encontrados ${existingPlans.length} planos existentes.`);
    
    // Criar apenas os planos que não existem (baseando-se no nome)
    for (const plan of defaultPlans) {
      const exists = existingPlans.some(p => p.name === plan.name);
      if (!exists) {
        const [inserted] = await db.insert(subscriptionPlans).values(plan).returning();
        console.log(`Plano criado: ${inserted.name} (ID: ${inserted.id})`);
      } else {
        console.log(`Plano "${plan.name}" já existe, pulando.`);
      }
    }
    
    // Exibir todos os planos disponíveis
    console.log("\nPlanos de assinatura disponíveis:");
    const allPlans = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.isActive, true));
    
    allPlans.forEach(plan => {
      console.log(`- ${plan.name}: R$ ${(plan.price / 100).toFixed(2)} por ${plan.durationMonths} mês(es)`);
    });
    
    console.log("\nCriação de planos concluída com sucesso!");
  } catch (error) {
    console.error("Erro ao criar planos de assinatura:", error);
  } finally {
    await pool.end();
  }
}

// Executar a função
createSubscriptionPlans();