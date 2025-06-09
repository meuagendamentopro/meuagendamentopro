import { Request, Response } from "express";
import { db } from "../db";
import { appointments, AppointmentStatus, users } from "@shared/schema";
import { eq } from "drizzle-orm";

// Função helper para obter o ID do usuário correto (simulado ou real)
const getCurrentUserId = (req: Request): number => {
  // Se há simulação ativa, usar o ID do usuário simulado
  if (req.session.impersonatedUserId && req.session.originalAdminId) {
    return req.session.impersonatedUserId;
  }
  // Caso contrário, usar o ID do usuário real
  if (!req.user) {
    throw new Error("Usuário não autenticado");
  }
  return req.user.id;
};

// Middleware para verificar se o usuário está autenticado e é um provider
const loadUserProvider = async (req: Request, res: Response, next: Function) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Não autenticado" });
  }
  
  try {
    // Obter ID do usuário correto (considerando simulação)
    const userId = getCurrentUserId(req);
    
    // Verificar se o usuário é um provider
    const provider = await db.query.providers.findFirst({
      where: (providers, { eq }) => eq(providers.userId, userId)
    });
    
    if (!provider) {
      return res.status(403).json({ error: "Acesso não autorizado" });
    }
    
    // Adicionar o provider ao objeto de requisição
    (req as any).provider = provider;
    next();
  } catch (error) {
    console.error("Erro ao carregar provider:", error);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
};

// Função para registrar a rota de exclusão de agendamentos
export function registerAppointmentDeleteRoute(app: any, storage?: any) {
  // Excluir um agendamento cancelado
  app.delete("/api/appointments/:id", loadUserProvider, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      
      if (isNaN(id)) {
        return res.status(400).json({ error: "ID inválido" });
      }
      
      // Verificar se o agendamento existe
      const appointment = await db
        .select()
        .from(appointments)
        .where(eq(appointments.id, id))
        .limit(1);
      
      if (!appointment.length) {
        return res.status(404).json({ error: "Agendamento não encontrado" });
      }
      
      // Verificar se está em modo de simulação
      const isImpersonating = req.session.impersonatedUserId && req.session.originalAdminId;
      
      // Verificar se o agendamento pertence ao provider atual
      const provider = (req as any).provider;
      
      console.log("Debug exclusão agendamento:", {
        appointmentId: id,
        appointmentProviderId: appointment[0].providerId,
        currentProviderId: provider.id,
        isImpersonating,
        originalAdminId: req.session.originalAdminId,
        impersonatedUserId: req.session.impersonatedUserId
      });
      
      // Durante simulação, permitir exclusão de qualquer agendamento do usuário simulado
      // Fora da simulação, verificar propriedade normal
      if (!isImpersonating && appointment[0].providerId !== provider.id) {
        return res.status(403).json({ error: "Você não tem permissão para excluir este agendamento" });
      }
      
      // Se não estiver em modo de simulação, verificar se o agendamento está cancelado
      if (!isImpersonating && appointment[0].status !== AppointmentStatus.CANCELLED) {
        return res.status(400).json({ 
          error: "Apenas agendamentos cancelados podem ser excluídos",
          status: appointment[0].status
        });
      }
      
      // Excluir o agendamento do banco de dados
      await db
        .delete(appointments)
        .where(eq(appointments.id, id));
      
      // Excluir o agendamento da memória do storage
      if (storage && typeof storage.deleteAppointment === 'function') {
        await storage.deleteAppointment(id);
      }
      
      console.log(`Agendamento ${id} excluído com sucesso do banco e da memória`);
      res.json({ 
        success: true, 
        message: "Agendamento excluído com sucesso" 
      });
      
    } catch (error) {
      console.error("Erro ao excluir agendamento:", error);
      res.status(500).json({ error: "Falha ao excluir agendamento" });
    }
  });
}
