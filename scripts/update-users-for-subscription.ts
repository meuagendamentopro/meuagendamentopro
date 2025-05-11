import { db } from "../server/db";
import { users } from "../shared/schema";
import { eq, isNull } from "drizzle-orm";
import { addMonths } from "date-fns";

/**
 * Este script atualiza os usuários existentes para incluir os novos campos de assinatura
 * 1. Define subscriptionExpiry para daqui a 3 meses para todos os usuários regulares
 * 2. Define neverExpires como true para admin
 * 3. Garante que todos os usuários possuam um email
 */
async function updateUsersForSubscription() {
  console.log("Iniciando atualização de usuários para o sistema de assinatura...");
  
  try {
    // 1. Buscar todos os usuários
    const allUsers = await db.select().from(users);
    console.log(`Encontrados ${allUsers.length} usuários para atualizar.`);
    
    for (const user of allUsers) {
      console.log(`Processando usuário: ${user.username} (${user.id})`);
      
      const updates: any = {};
      
      // 2. Garantir que todos os usuários tenham email
      if (!user.email) {
        updates.email = `${user.username}@temp.com`;
        console.log(`- Adicionando email temporário: ${updates.email}`);
      }
      
      // 3. Configurar assinatura conforme o tipo de usuário
      if (user.role === 'admin') {
        // Administradores têm assinatura sem expiração
        if (user.neverExpires === null || user.neverExpires === undefined) {
          updates.neverExpires = true;
          console.log('- Configurando assinatura sem expiração para admin');
        }
      } else {
        // Usuários regulares têm assinatura com validade de 3 meses
        if (!user.subscriptionExpiry && !user.neverExpires) {
          const expiryDate = addMonths(new Date(), 3);
          updates.subscriptionExpiry = expiryDate;
          console.log(`- Configurando expiração da assinatura para: ${expiryDate.toISOString()}`);
        }
      }
      
      // 4. Garantir que o campo isActive esteja definido (padrão: true)
      if (user.isActive === null || user.isActive === undefined) {
        updates.isActive = true;
        console.log('- Definindo usuário como ativo');
      }
      
      // 5. Atualizar o usuário no banco de dados se houver campos para atualizar
      if (Object.keys(updates).length > 0) {
        await db.update(users)
          .set(updates)
          .where(eq(users.id, user.id));
        console.log(`✅ Usuário ${user.username} atualizado com sucesso`);
      } else {
        console.log(`- Usuário ${user.username} já está atualizado, nenhuma alteração necessária`);
      }
    }
    
    console.log("\nAtualização de usuários concluída com sucesso!");
  } catch (error) {
    console.error("Erro ao atualizar usuários:", error);
  } finally {
    // Encerrar a conexão com o banco de dados
    process.exit(0);
  }
}

// Executar o script
updateUsersForSubscription();