/**
 * Script para criar planos de assinatura específicos para contas empresa
 * Execução: npx tsx scripts/create-company-plans.ts teste
 */

import { db } from '../server/db';
import { subscriptionPlans } from '../shared/schema';
import { eq, and } from 'drizzle-orm';
import { pool } from '../server/db';

async function createCompanyPlans() {
  console.log("Criando planos de assinatura para contas empresa...");
  
  // Planos específicos para empresas
  const companyPlans = [
    {
      name: "Empresa Mensal",
      description: "Plano mensal para empresas com múltiplos funcionários e recursos avançados",
      durationMonths: 1,
      price: 9990, // R$ 99,90
      accountType: "company",
      isActive: true
    },
    {
      name: "Empresa Trimestral",
      description: "Plano trimestral para empresas com desconto especial",
      durationMonths: 3,
      price: 26970, // R$ 269,70 (10% desconto)
      accountType: "company",
      isActive: true
    },
    {
      name: "Empresa Semestral",
      description: "Plano semestral para empresas com maior economia",
      durationMonths: 6,
      price: 47940, // R$ 479,40 (20% desconto)
      accountType: "company",
      isActive: true
    },
    {
      name: "Empresa Anual",
      description: "Plano anual para empresas com máximo desconto e recursos premium",
      durationMonths: 12,
      price: 83916, // R$ 839,16 (30% desconto)
      accountType: "company",
      isActive: true
    }
  ];
  
  try {
    // Verificar quais planos já existem
    const existingPlans = await db.select().from(subscriptionPlans);
    console.log(`Encontrados ${existingPlans.length} planos existentes.`);
    
    // Criar apenas os planos que não existem (baseando-se no nome)
    for (const plan of companyPlans) {
      const exists = existingPlans.some(p => p.name === plan.name);
      if (!exists) {
        const [inserted] = await db.insert(subscriptionPlans).values(plan).returning();
        console.log(`Plano criado: ${inserted.name} (ID: ${inserted.id}) - ${inserted.accountType}`);
      } else {
        console.log(`Plano "${plan.name}" já existe, pulando.`);
      }
    }
    
    // Exibir todos os planos disponíveis por tipo
    console.log("\n=== PLANOS INDIVIDUAIS ===");
    const individualPlans = await db.select().from(subscriptionPlans)
      .where(and(
        eq(subscriptionPlans.accountType, 'individual'),
        eq(subscriptionPlans.isActive, true)
      ));
    
    individualPlans.forEach(plan => {
      console.log(`- ${plan.name}: R$ ${(plan.price / 100).toFixed(2)} por ${plan.durationMonths} mês(es)`);
    });
    
    console.log("\n=== PLANOS EMPRESA ===");
    const businessPlans = await db.select().from(subscriptionPlans)
      .where(and(
        eq(subscriptionPlans.accountType, 'company'),
        eq(subscriptionPlans.isActive, true)
      ));
    
    businessPlans.forEach(plan => {
      console.log(`- ${plan.name}: R$ ${(plan.price / 100).toFixed(2)} por ${plan.durationMonths} mês(es)`);
    });
    
    console.log("\nCriação de planos para empresas concluída com sucesso!");
  } catch (error) {
    console.error("Erro ao criar planos de assinatura para empresas:", error);
  } finally {
    await pool.end();
  }
}

// Executar a criação
createCompanyPlans(); 