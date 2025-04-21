import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { 
  insertServiceSchema, 
  insertClientSchema, 
  insertAppointmentSchema, 
  bookingFormSchema,
  AppointmentStatus
} from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

  // Provider routes
  app.get("/api/providers", async (req: Request, res: Response) => {
    const providers = await storage.getProviders();
    res.json(providers);
  });

  app.get("/api/providers/:id", async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid provider ID" });
    }
    
    const provider = await storage.getProvider(id);
    if (!provider) {
      return res.status(404).json({ message: "Provider not found" });
    }
    
    res.json(provider);
  });

  // Service routes
  app.get("/api/providers/:providerId/services", async (req: Request, res: Response) => {
    const providerId = parseInt(req.params.providerId);
    if (isNaN(providerId)) {
      return res.status(400).json({ message: "Invalid provider ID" });
    }
    
    const services = await storage.getServices(providerId);
    res.json(services);
  });

  app.post("/api/services", async (req: Request, res: Response) => {
    try {
      const data = insertServiceSchema.parse(req.body);
      const service = await storage.createService(data);
      res.status(201).json(service);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid service data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create service" });
    }
  });

  app.put("/api/services/:id", async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid service ID" });
    }
    
    try {
      const data = insertServiceSchema.partial().parse(req.body);
      const service = await storage.updateService(id, data);
      
      if (!service) {
        return res.status(404).json({ message: "Service not found" });
      }
      
      res.json(service);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid service data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update service" });
    }
  });

  app.delete("/api/services/:id", async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid service ID" });
    }
    
    const success = await storage.deleteService(id);
    if (!success) {
      return res.status(404).json({ message: "Service not found" });
    }
    
    res.status(204).send();
  });

  // Client routes
  app.get("/api/clients", async (req: Request, res: Response) => {
    const clients = await storage.getClients();
    res.json(clients);
  });

  app.get("/api/clients/:id", async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid client ID" });
    }
    
    const client = await storage.getClient(id);
    if (!client) {
      return res.status(404).json({ message: "Client not found" });
    }
    
    res.json(client);
  });

  app.post("/api/clients", async (req: Request, res: Response) => {
    try {
      const data = insertClientSchema.parse(req.body);
      
      // Check if client already exists with this phone number
      const existingClient = await storage.getClientByPhone(data.phone);
      if (existingClient) {
        return res.json(existingClient);
      }
      
      const client = await storage.createClient(data);
      res.status(201).json(client);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid client data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create client" });
    }
  });

  // Appointment routes
  app.get("/api/providers/:providerId/appointments", async (req: Request, res: Response) => {
    const providerId = parseInt(req.params.providerId);
    if (isNaN(providerId)) {
      return res.status(400).json({ message: "Invalid provider ID" });
    }
    
    // Parse date filter parameters
    const dateParam = req.query.date as string;
    const startDateParam = req.query.startDate as string;
    const endDateParam = req.query.endDate as string;
    
    let appointments;
    
    if (dateParam) {
      const date = new Date(dateParam);
      if (isNaN(date.getTime())) {
        return res.status(400).json({ message: "Invalid date format" });
      }
      appointments = await storage.getAppointmentsByDate(providerId, date);
    } else if (startDateParam && endDateParam) {
      const startDate = new Date(startDateParam);
      const endDate = new Date(endDateParam);
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return res.status(400).json({ message: "Invalid date format" });
      }
      appointments = await storage.getAppointmentsByDateRange(providerId, startDate, endDate);
    } else {
      appointments = await storage.getAppointments(providerId);
    }
    
    res.json(appointments);
  });

  app.get("/api/appointments/:id", async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid appointment ID" });
    }
    
    const appointment = await storage.getAppointment(id);
    if (!appointment) {
      return res.status(404).json({ message: "Appointment not found" });
    }
    
    res.json(appointment);
  });

  app.post("/api/appointments", async (req: Request, res: Response) => {
    try {
      console.log("Criando agendamento com dados:", JSON.stringify(req.body, null, 2));
      
      // Tenta processar os dados com o esquema com transformações
      const data = insertAppointmentSchema.parse(req.body);
      console.log("Dados após processamento do schema:", JSON.stringify(data, null, 2));
      
      // Verifica se as datas são válidas
      if (!(data.date instanceof Date) || isNaN(data.date.getTime())) {
        return res.status(400).json({ 
          message: "Data de início inválida",
          details: `Valor recebido: ${JSON.stringify(req.body.date)}`
        });
      }
      
      if (!(data.endTime instanceof Date) || isNaN(data.endTime.getTime())) {
        return res.status(400).json({ 
          message: "Data de término inválida",
          details: `Valor recebido: ${JSON.stringify(req.body.endTime)}`
        });
      }
      
      // Verifica se o serviço existe
      const service = await storage.getService(data.serviceId);
      if (!service) {
        return res.status(404).json({ message: "Serviço não encontrado" });
      }
      
      // Verifica disponibilidade
      const isAvailable = await storage.checkAvailability(
        data.providerId, 
        data.date, 
        service.duration
      );
      
      if (!isAvailable) {
        return res.status(409).json({ message: "Horário indisponível" });
      }
      
      // Cria o agendamento
      const appointment = await storage.createAppointment(data);
      
      // Aqui enviaríamos uma notificação via WhatsApp
      // Por enquanto, apenas logamos
      console.log(`Agendamento ${appointment.id} criado com sucesso! Notificação seria enviada.`);
      
      res.status(201).json(appointment);
    } catch (error) {
      console.error("Erro ao criar agendamento:", error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Dados de agendamento inválidos", 
          errors: error.errors 
        });
      }
      
      if (error instanceof Error) {
        return res.status(400).json({ 
          message: "Erro ao processar agendamento", 
          details: error.message
        });
      }
      
      res.status(500).json({ message: "Falha ao criar agendamento" });
    }
  });

  app.patch("/api/appointments/:id/status", async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid appointment ID" });
    }
    
    try {
      const statusSchema = z.object({
        status: z.enum([
          AppointmentStatus.PENDING,
          AppointmentStatus.CONFIRMED,
          AppointmentStatus.CANCELLED,
          AppointmentStatus.COMPLETED
        ])
      });
      
      const { status } = statusSchema.parse(req.body);
      const appointment = await storage.updateAppointmentStatus(id, status);
      
      if (!appointment) {
        return res.status(404).json({ message: "Appointment not found" });
      }
      
      // Here we would send a WhatsApp notification for status change
      // For now, we'll just log it
      console.log(`Would send WhatsApp status update for appointment ${id} to ${status}`);
      
      res.json(appointment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid status", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update appointment status" });
    }
  });

  // Check availability
  app.get("/api/providers/:providerId/availability", async (req: Request, res: Response) => {
    const providerId = parseInt(req.params.providerId);
    if (isNaN(providerId)) {
      return res.status(400).json({ message: "Invalid provider ID" });
    }
    
    const dateParam = req.query.date as string;
    const serviceIdParam = req.query.serviceId as string;
    
    if (!dateParam || !serviceIdParam) {
      return res.status(400).json({ message: "Date and serviceId are required" });
    }
    
    const date = new Date(dateParam);
    const serviceId = parseInt(serviceIdParam);
    
    if (isNaN(date.getTime()) || isNaN(serviceId)) {
      return res.status(400).json({ message: "Invalid date or service ID" });
    }
    
    const service = await storage.getService(serviceId);
    if (!service) {
      return res.status(404).json({ message: "Service not found" });
    }
    
    const isAvailable = await storage.checkAvailability(providerId, date, service.duration);
    res.json({ available: isAvailable });
  });

  // Booking endpoint (for clients)
  app.post("/api/booking", async (req: Request, res: Response) => {
    try {
      console.log("Recebendo dados de agendamento:", JSON.stringify(req.body, null, 2));
      
      // Valida os dados do formulário
      const bookingData = bookingFormSchema.parse(req.body);
      
      let appointmentDate: Date;
      
      try {
        // Tenta analisar a data e hora com tratamento de erro
        if (bookingData.date.includes('-')) {
          // Formato ISO (YYYY-MM-DD)
          const [year, month, day] = bookingData.date.split('-').map(Number);
          const [hour, minute] = bookingData.time.split(':').map(Number);
        
          if (isNaN(year) || isNaN(month) || isNaN(day) || isNaN(hour) || isNaN(minute)) {
            throw new Error(`Valores inválidos: ano=${year}, mês=${month}, dia=${day}, hora=${hour}, minuto=${minute}`);
          }
        
          appointmentDate = new Date(year, month - 1, day, hour, minute);
        } else if (bookingData.date.includes('/')) {
          // Formato BR (DD/MM/YYYY)
          const [day, month, year] = bookingData.date.split('/').map(Number);
          const [hour, minute] = bookingData.time.split(':').map(Number);
        
          if (isNaN(year) || isNaN(month) || isNaN(day) || isNaN(hour) || isNaN(minute)) {
            throw new Error(`Valores inválidos: ano=${year}, mês=${month}, dia=${day}, hora=${hour}, minuto=${minute}`);
          }
        
          appointmentDate = new Date(year, month - 1, day, hour, minute);
        } else {
          // Tentar como timestamp ou outro formato
          appointmentDate = new Date(bookingData.date);
          const [hour, minute] = bookingData.time.split(':').map(Number);
          appointmentDate.setHours(hour, minute, 0, 0);
        }
        
        if (isNaN(appointmentDate.getTime())) {
          throw new Error(`Data inválida após conversão: ${appointmentDate}`);
        }
        
        console.log("Data processada:", appointmentDate.toISOString());
      } catch (error) {
        console.error("Erro ao processar data e hora:", error);
        return res.status(400).json({ 
          message: "Formato de data ou hora inválido", 
          details: error instanceof Error ? error.message : String(error)
        });
      }
      
      // Busca o serviço para calcular horário de término
      const service = await storage.getService(bookingData.serviceId);
      if (!service) {
        return res.status(404).json({ message: "Serviço não encontrado" });
      }
      
      // Calcula o horário de término
      const endTime = new Date(appointmentDate.getTime() + service.duration * 60000);
      
      // Verifica disponibilidade
      const isAvailable = await storage.checkAvailability(
        service.providerId,
        appointmentDate,
        service.duration
      );
      
      if (!isAvailable) {
        return res.status(409).json({ message: "Horário indisponível" });
      }
      
      // Cria ou obtém cliente existente
      let client = await storage.getClientByPhone(bookingData.phone);
      
      if (!client) {
        client = await storage.createClient({
          name: bookingData.name,
          phone: bookingData.phone,
          email: "",
          notes: bookingData.notes || ""
        });
      }
      
      // Cria o agendamento
      const appointment = await storage.createAppointment({
        providerId: service.providerId,
        clientId: client.id,
        serviceId: bookingData.serviceId,
        date: appointmentDate,
        endTime: endTime,
        status: AppointmentStatus.PENDING,
        notes: bookingData.notes || ""
      });
      
      // Aqui enviaríamos uma confirmação via WhatsApp
      console.log(`Agendamento ${appointment.id} criado com sucesso! Confirmação seria enviada para ${client.phone}.`);
      
      res.status(201).json({
        success: true,
        appointment,
        message: "Agendamento realizado com sucesso! Você receberá uma confirmação por WhatsApp em breve."
      });
    } catch (error) {
      console.error("Erro ao processar agendamento do cliente:", error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Dados de agendamento inválidos", 
          errors: error.errors 
        });
      }
      
      if (error instanceof Error) {
        return res.status(400).json({ 
          message: "Erro ao processar agendamento", 
          details: error.message
        });
      }
      
      res.status(500).json({ message: "Falha ao criar agendamento" });
    }
  });

  return httpServer;
}
