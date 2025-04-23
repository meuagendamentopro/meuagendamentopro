import type { Express, Request, Response, NextFunction } from "express";
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
import { setupAuth, hashPassword } from "./auth";
import { WebSocketServer, WebSocket } from "ws";

export async function registerRoutes(app: Express): Promise<Server> {
  // Configurar autenticação
  setupAuth(app);
  
  const httpServer = createServer(app);
  
  // Configuração do WebSocket para atualizações em tempo real
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  
  // Armazenar conexões ativas
  const connectedClients = new Map<WebSocket, { userId?: number }>();
  
  wss.on('connection', (ws: WebSocket) => {
    console.log('Nova conexão WebSocket estabelecida');
    
    // Adicionar cliente à lista de conexões
    connectedClients.set(ws, {});
    
    ws.on('message', (message: string) => {
      try {
        const data = JSON.parse(message.toString());
        
        // Se a mensagem contém uma identificação de usuário, associamos à conexão
        if (data.type === 'identify' && data.userId) {
          console.log(`Cliente WebSocket identificado: usuário ${data.userId}`);
          connectedClients.set(ws, { userId: data.userId });
        }
      } catch (error) {
        console.error('Erro ao processar mensagem WebSocket:', error);
      }
    });
    
    ws.on('close', () => {
      // Remover cliente da lista quando a conexão é fechada
      connectedClients.delete(ws);
      console.log('Conexão WebSocket fechada');
    });
  });
  
  // Função auxiliar para enviar atualizações em tempo real
  const broadcastUpdate = (type: string, data: any) => {
    const message = JSON.stringify({ type, data });
    
    connectedClients.forEach((client, ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      }
    });
  };
  
  // Middleware para verificar se o usuário é administrador
  const isAdmin = (req: Request, res: Response, next: NextFunction) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Não autenticado" });
    }
    
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: "Acesso não autorizado. Apenas administradores podem acessar esta rota." });
    }
    
    next();
  };
  
  // Rotas de administração
  app.get("/api/admin/users", isAdmin, async (req: Request, res: Response) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      console.error("Erro ao buscar usuários:", error);
      res.status(500).json({ error: "Erro ao buscar usuários" });
    }
  });
  
  app.post("/api/admin/users", isAdmin, async (req: Request, res: Response) => {
    try {
      const { name, username, password, role } = req.body;
      
      // Validar dados
      if (!name || !username || !password || !role) {
        return res.status(400).json({ error: "Todos os campos são obrigatórios" });
      }
      
      // Verificar se o usuário já existe
      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).json({ error: "Nome de usuário já existe" });
      }
      
      // Criar o usuário com senha hasheada
      const hashedPassword = await hashPassword(password);
      const user = await storage.createUser({
        name,
        username,
        password: hashedPassword,
        role,
      });
      
      // Retornar o usuário criado (sem a senha)
      const { password: _, ...userWithoutPassword } = user;
      res.status(201).json(userWithoutPassword);
    } catch (error) {
      console.error("Erro ao criar usuário:", error);
      res.status(500).json({ error: "Erro ao criar usuário" });
    }
  });

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
  
  // Rota para atualizar as configurações do provedor
  app.patch("/api/providers/:id/settings", async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid provider ID" });
    }
    
    const provider = await storage.getProvider(id);
    if (!provider) {
      return res.status(404).json({ message: "Provider not found" });
    }
    
    try {
      // Validar os campos de horário de trabalho
      const { workingHoursStart, workingHoursEnd } = req.body;
      
      if (workingHoursStart === undefined || workingHoursEnd === undefined) {
        return res.status(400).json({ 
          message: "Missing required fields",
          errors: ["workingHoursStart and workingHoursEnd are required"]
        });
      }
      
      if (typeof workingHoursStart !== 'number' || typeof workingHoursEnd !== 'number') {
        return res.status(400).json({ 
          message: "Invalid data types",
          errors: ["workingHoursStart and workingHoursEnd must be numbers"]
        });
      }
      
      if (workingHoursStart < 0 || workingHoursStart > 23 || workingHoursEnd < 1 || workingHoursEnd > 24) {
        return res.status(400).json({ 
          message: "Invalid hour range",
          errors: ["workingHoursStart must be between 0-23 and workingHoursEnd must be between 1-24"]
        });
      }
      
      if (workingHoursEnd <= workingHoursStart) {
        return res.status(400).json({ 
          message: "Invalid hour range",
          errors: ["workingHoursEnd must be greater than workingHoursStart"]
        });
      }
      
      // Agora temos um método específico no storage para atualizar o provedor
      const providerData = {
        workingHoursStart,
        workingHoursEnd
      };
      
      const updatedProvider = await storage.updateProvider(id, providerData);
      if (!updatedProvider) {
        return res.status(500).json({ message: "Falha ao atualizar as configurações do provedor" });
      }
      
      res.json(updatedProvider);
    } catch (error) {
      console.error("Error updating provider settings:", error);
      res.status(500).json({ message: "Failed to update provider settings" });
    }
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
      // Cria uma data no formato local (baseada no fuso horário do servidor)
      // usando apenas o ano, mês e dia da data recebida
      const [year, month, day] = dateParam.split('-').map(Number);
      const date = new Date(year, month - 1, day, 0, 0, 0);
      
      if (isNaN(date.getTime())) {
        return res.status(400).json({ message: "Invalid date format" });
      }
      
      console.log(`Buscando agendamentos para a data: ${date.toISOString()} (data local: ${date.toString()})`);
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
      
      // Enviar atualização em tempo real via WebSocket
      broadcastUpdate('appointment_created', appointment);
      
      // Criar uma notificação para o prestador de serviço
      const provider = await storage.getProvider(appointment.providerId);
      if (provider && provider.userId) {
        try {
          await storage.createNotification({
            userId: provider.userId,
            title: "Novo agendamento",
            message: `Um novo agendamento foi criado para o serviço #${appointment.serviceId}`,
            type: 'appointment',
            appointmentId: appointment.id
          });
          console.log(`Notificação criada para o usuário ${provider.userId}`);
        } catch (error) {
          console.error("Erro ao criar notificação:", error);
        }
      }
      
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
      
      // Enviar atualização em tempo real via WebSocket
      broadcastUpdate('appointment_updated', appointment);
      
      // Aqui enviaríamos uma notificação via WhatsApp sobre a mudança de status
      // Por enquanto, apenas logamos
      console.log(`Enviando atualização em tempo real e notificação WhatsApp para agendamento ${id}: ${status}`);
      
      // Criar uma notificação no sistema para o usuário associado ao prestador
      const provider = await storage.getProvider(appointment.providerId);
      if (provider && provider.userId) {
        try {
          // Determinar mensagem apropriada baseada no status
          let titleMsg = "Agendamento atualizado";
          let message = `O agendamento #${appointment.id} foi atualizado para ${status}`;
          
          if (status === AppointmentStatus.CONFIRMED) {
            titleMsg = "Agendamento confirmado";
            message = `O agendamento #${appointment.id} foi confirmado`;
          } else if (status === AppointmentStatus.CANCELLED) {
            titleMsg = "Agendamento cancelado";
            message = `O agendamento #${appointment.id} foi cancelado`;
          } else if (status === AppointmentStatus.COMPLETED) {
            titleMsg = "Agendamento concluído";
            message = `O agendamento #${appointment.id} foi marcado como concluído`;
          }
          
          // Criar a notificação para o usuário
          await storage.createNotification({
            userId: provider.userId,
            title: titleMsg,
            message,
            type: 'appointment',
            appointmentId: appointment.id
          });
          
          console.log(`Notificação criada para o usuário ${provider.userId}`);
        } catch (error) {
          console.error("Erro ao criar notificação:", error);
        }
      }
      
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
          // Formato ISO (YYYY-MM-DD) - usando Date.UTC para garantir consistência no fuso horário
          const [year, month, day] = bookingData.date.split('-').map(Number);
          const [hour, minute] = bookingData.time.split(':').map(Number);
        
          if (isNaN(year) || isNaN(month) || isNaN(day) || isNaN(hour) || isNaN(minute)) {
            throw new Error(`Valores inválidos: ano=${year}, mês=${month}, dia=${day}, hora=${hour}, minuto=${minute}`);
          }
          
          // Usando UTC E compensando o fuso horário (Brasil GMT-3)
          // Verificamos se o horário cruza para o dia seguinte
          let adjustedHour = hour + 3;  // Adicionamos 3 horas (fuso GMT-3)
          if (adjustedHour >= 24) {
            adjustedHour -= 24;  // Se passar de 24h, ajustamos para o formato correto
          }
          
          appointmentDate = new Date(Date.UTC(year, month - 1, day, adjustedHour, minute, 0));
          console.log(`Horário ajustado: ${hour}:${minute} -> ${adjustedHour}:${minute} (dia ${day}/${month}/${year})`);
        } else if (bookingData.date.includes('/')) {
          // Formato BR (DD/MM/YYYY) - usando Date.UTC para garantir consistência no fuso horário
          const [day, month, year] = bookingData.date.split('/').map(Number);
          const [hour, minute] = bookingData.time.split(':').map(Number);
        
          if (isNaN(year) || isNaN(month) || isNaN(day) || isNaN(hour) || isNaN(minute)) {
            throw new Error(`Valores inválidos: ano=${year}, mês=${month}, dia=${day}, hora=${hour}, minuto=${minute}`);
          }
        
          // Usando UTC E compensando o fuso horário (Brasil GMT-3)
          // Verificamos se o horário cruza para o dia seguinte
          let adjustedHour = hour + 3;  // Adicionamos 3 horas (fuso GMT-3)
          if (adjustedHour >= 24) {
            adjustedHour -= 24;  // Se passar de 24h, ajustamos para o formato correto
          }
          
          appointmentDate = new Date(Date.UTC(year, month - 1, day, adjustedHour, minute, 0));
          console.log(`Horário ajustado: ${hour}:${minute} -> ${adjustedHour}:${minute} (dia ${day}/${month}/${year})`);
        } else {
          // Tentar como timestamp ou outro formato - usando UTC para consistência
          const baseDate = new Date(bookingData.date);
          const [hour, minute] = bookingData.time.split(':').map(Number);
          // Criar uma nova data usando UTC com os componentes extraídos da data
          // Compensando o fuso horário (Brasil GMT-3) adicionando 3 horas
          // Verificamos se o horário cruza para o dia seguinte
          let adjustedHour = hour + 3;  // Adicionamos 3 horas (fuso GMT-3)
          if (adjustedHour >= 24) {
            adjustedHour -= 24;  // Se passar de 24h, ajustamos para o formato correto
          }
          
          appointmentDate = new Date(Date.UTC(
            baseDate.getFullYear(),
            baseDate.getMonth(),
            baseDate.getDate(),
            adjustedHour, minute, 0
          ));
          console.log(`Horário ajustado: ${hour}:${minute} -> ${adjustedHour}:${minute} (dia ${baseDate.getDate()}/${baseDate.getMonth()+1}/${baseDate.getFullYear()})`);
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
      
      // Obtém cliente existente pelo telefone ou cria um novo
      let client = await storage.getClientByPhone(bookingData.phone);
      
      if (!client) {
        // Se o cliente não existe, cria um novo
        client = await storage.createClient({
          name: bookingData.name,
          phone: bookingData.phone,
          email: "",
          notes: bookingData.notes || ""
        });
      } else {
        // Se o cliente já existe mas enviou um nome diferente ou notas diferentes,
        // atualiza os dados do cliente para manter o cadastro atualizado
        if (client.name !== bookingData.name || 
            (bookingData.notes && client.notes !== bookingData.notes)) {
          
          console.log(`Cliente já existente com telefone ${bookingData.phone}.`);
          console.log(`Nome no sistema: "${client.name}" - Nome informado: "${bookingData.name}"`);
          
          // Manteremos o telefone original, mas atualizaremos as notas se forem enviadas
          await storage.updateClient(client.id, {
            // Não atualizamos o nome para manter consistência com o cadastro original
            notes: bookingData.notes || client.notes
          });
          
          // Adicionamos uma nota sobre o nome diferente para referência futura
          if (client.name !== bookingData.name) {
            const notaAdicional = client.notes 
              ? `${client.notes}. Cliente também conhecido como: ${bookingData.name}`
              : `Cliente também conhecido como: ${bookingData.name}`;
            
            await storage.updateClient(client.id, {
              notes: notaAdicional
            });
          }
        }
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
      
      // Enviar atualização em tempo real via WebSocket
      broadcastUpdate('appointment_created', appointment);
      
      // Criar uma notificação para o prestador de serviço
      const provider = await storage.getProvider(service.providerId);
      if (provider && provider.userId) {
        try {
          await storage.createNotification({
            userId: provider.userId,
            title: "Novo agendamento",
            message: `${client.name} agendou ${service.name} para ${appointmentDate.toLocaleString('pt-BR')}`,
            type: 'appointment',
            appointmentId: appointment.id
          });
          console.log(`Notificação criada para o usuário ${provider.userId}`);
        } catch (error) {
          console.error("Erro ao criar notificação:", error);
        }
      }
      
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
