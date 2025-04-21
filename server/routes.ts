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
      const data = insertAppointmentSchema.parse(req.body);
      
      // Check if the time slot is available
      const service = await storage.getService(data.serviceId);
      if (!service) {
        return res.status(404).json({ message: "Service not found" });
      }
      
      const isAvailable = await storage.checkAvailability(
        data.providerId, 
        data.date, 
        service.duration
      );
      
      if (!isAvailable) {
        return res.status(409).json({ message: "Time slot is not available" });
      }
      
      const appointment = await storage.createAppointment(data);
      
      // Here we would send a WhatsApp notification
      // For now, we'll just log it
      console.log(`Would send WhatsApp message to client for appointment ${appointment.id}`);
      
      res.status(201).json(appointment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid appointment data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create appointment" });
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
      const bookingData = bookingFormSchema.parse(req.body);
      
      // Parse the datetime
      const [year, month, day] = bookingData.date.split('-').map(Number);
      const [hour, minute] = bookingData.time.split(':').map(Number);
      
      const appointmentDate = new Date(year, month - 1, day, hour, minute);
      
      // Get the service to calculate end time
      const service = await storage.getService(bookingData.serviceId);
      if (!service) {
        return res.status(404).json({ message: "Service not found" });
      }
      
      // Calculate end time
      const endTime = new Date(appointmentDate.getTime() + service.duration * 60000);
      
      // Check availability
      const isAvailable = await storage.checkAvailability(
        service.providerId,
        appointmentDate,
        service.duration
      );
      
      if (!isAvailable) {
        return res.status(409).json({ message: "Time slot is not available" });
      }
      
      // Create or get existing client
      let client = await storage.getClientByPhone(bookingData.phone);
      
      if (!client) {
        client = await storage.createClient({
          name: bookingData.name,
          phone: bookingData.phone,
          email: "",
          notes: bookingData.notes || ""
        });
      }
      
      // Create the appointment
      const appointment = await storage.createAppointment({
        providerId: service.providerId,
        clientId: client.id,
        serviceId: bookingData.serviceId,
        date: appointmentDate,
        endTime: endTime,
        status: AppointmentStatus.PENDING,
        notes: bookingData.notes || ""
      });
      
      // Here we would send a WhatsApp confirmation
      console.log(`Would send WhatsApp confirmation to ${client.phone} for appointment ${appointment.id}`);
      
      res.status(201).json({
        success: true,
        appointment,
        message: "Agendamento realizado com sucesso! Você receberá uma confirmação por WhatsApp em breve."
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid booking data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create booking" });
    }
  });

  return httpServer;
}
