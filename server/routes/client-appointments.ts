import { Router } from "express";
import { db } from "../db";
import { appointments, services } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";

// Importar tipos
import { Request, Response, NextFunction } from "express";

// Middleware de autenticação
const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Não autorizado" });
  }
  next();
};

const router = Router();

// Rota para buscar o histórico de atendimentos de um cliente específico
router.get("/clients/:clientId/appointments", authenticateToken, async (req: Request & { user?: any }, res: Response) => {
  try {
    const { clientId } = req.params;
    const providerId = req.user?.providerId;

    if (!providerId) {
      return res.status(401).json({ error: "Não autorizado" });
    }

    // Buscar todos os agendamentos do cliente para este provedor
    const clientAppointments = await db
      .select({
        id: appointments.id,
        date: appointments.date,
        status: appointments.status,
        notes: appointments.notes,
        serviceId: appointments.serviceId,
        paymentAmount: appointments.paymentAmount,
        paymentStatus: appointments.paymentStatus,
        paymentPercentage: appointments.paymentPercentage,
      })
      .from(appointments)
      .where(
        and(
          eq(appointments.clientId, parseInt(clientId)),
          eq(appointments.providerId, providerId)
        )
      )
      .orderBy(desc(appointments.date));

    // Buscar os detalhes dos serviços relacionados
    const serviceIds = Array.from(new Set(clientAppointments.map(app => app.serviceId)));
    
    const serviceDetails = await db
      .select({
        id: services.id,
        name: services.name,
        price: services.price,
      })
      .from(services)
      .where(eq(services.providerId, providerId));

    // Mapear os serviços por ID para facilitar o acesso
    const servicesMap = serviceDetails.reduce<Record<number, typeof serviceDetails[0]>>((acc, service) => {
      acc[service.id] = service;
      return acc;
    }, {});

    // Adicionar os detalhes do serviço a cada agendamento
    const appointmentsWithDetails = clientAppointments.map(appointment => {
      const service = servicesMap[appointment.serviceId];
      return {
        ...appointment,
        serviceName: service?.name,
        servicePrice: service?.price,
      };
    });

    res.json(appointmentsWithDetails);
  } catch (error) {
    console.error("Erro ao buscar histórico de atendimentos:", error);
    res.status(500).json({ error: "Erro ao buscar histórico de atendimentos" });
  }
});

export default router;
