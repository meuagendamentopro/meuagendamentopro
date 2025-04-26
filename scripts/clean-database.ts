import { db, pool } from "../server/db";
import { 
  appointments, 
  clients, 
  notifications, 
  providerClients, 
  providers, 
  services 
} from "@shared/schema";

async function cleanDatabase() {
  console.log("Iniciando limpeza do banco de dados...");
  
  try {
    // Excluir todas as notificações
    console.log("Excluindo notificações...");
    await db.delete(notifications);
    
    // Excluir todos os agendamentos
    console.log("Excluindo agendamentos...");
    await db.delete(appointments);
    
    // Excluir todas as relações entre providers e clients
    console.log("Excluindo relações provider-client...");
    await db.delete(providerClients);
    
    // Excluir todos os clientes
    console.log("Excluindo clientes...");
    await db.delete(clients);
    
    // Excluir todos os serviços
    console.log("Excluindo serviços...");
    await db.delete(services);
    
    // Excluir todos os providers
    console.log("Excluindo providers...");
    await db.delete(providers);
    
    console.log("Limpeza concluída com sucesso!");
    
    // Importante: Não excluímos os usuários conforme solicitado
    console.log("Os usuários foram mantidos no banco de dados conforme solicitado.");
    
  } catch (error) {
    console.error("Erro durante a limpeza do banco de dados:", error);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

cleanDatabase();