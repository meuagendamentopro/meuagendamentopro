/**
 * Script para configurar o sistema de assinatura
 * - Cria as tabelas necessárias
 * - Adiciona os planos padrão
 */

import { pool, db } from '../server/db';
import { sql } from 'drizzle-orm';
import { subscriptionPlans } from '../shared/schema';

async function setupSubscriptionSystem() {
  console.log('Configurando sistema de assinaturas...');
  
  try {
    // 1. Criar as tabelas necessárias se não existirem
    console.log('Verificando e criando tabelas...');
    
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS subscription_plans (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        duration_months INTEGER NOT NULL,
        price INTEGER NOT NULL,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS subscription_transactions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        plan_id INTEGER NOT NULL REFERENCES subscription_plans(id) ON DELETE RESTRICT,
        transaction_id TEXT,
        payment_method TEXT NOT NULL DEFAULT 'pix',
        status TEXT NOT NULL DEFAULT 'pending',
        amount INTEGER NOT NULL,
        pix_qr_code TEXT,
        pix_qr_code_base64 TEXT,
        pix_qr_code_expiration TIMESTAMP,
        paid_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    
    console.log('Tabelas criadas com sucesso!');

    // 2. Inserir planos padrão
    console.log('Inserindo planos padrão...');
    
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
    
    // Adicionar cada plano padrão se não existir
    for (const plan of defaultPlans) {
      const existingPlan = await db.execute(sql`
        SELECT * FROM subscription_plans WHERE name = ${plan.name};
      `);
      
      if (existingPlan.rowCount === 0) {
        await db.execute(sql`
          INSERT INTO subscription_plans (name, description, duration_months, price, is_active)
          VALUES (${plan.name}, ${plan.description}, ${plan.durationMonths}, ${plan.price}, ${plan.isActive})
        `);
        console.log(`Plano "${plan.name}" criado com sucesso!`);
      } else {
        console.log(`Plano "${plan.name}" já existe, pulando.`);
      }
    }
    
    // 3. Listar planos disponíveis
    const plans = await db.execute(sql`
      SELECT * FROM subscription_plans WHERE is_active = true ORDER BY price ASC;
    `);
    
    console.log('\nPlanos de assinatura disponíveis:');
    plans.rows.forEach((plan: any) => {
      console.log(`- ${plan.name}: R$ ${(plan.price / 100).toFixed(2)} por ${plan.duration_months} mês(es)`);
    });
    
    console.log('\nConfiguração do sistema de assinaturas concluída com sucesso!');
  } catch (error) {
    console.error('Erro ao configurar sistema de assinaturas:', error);
  }
}

// Executar a função
setupSubscriptionSystem()
  .then(() => {
    console.log('Script finalizado.');
    process.exit(0);
  })
  .catch(error => {
    console.error('Erro fatal:', error);
    process.exit(1);
  });