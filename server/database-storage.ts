import { IStorage } from "./storage";
import { 
  users, User, InsertUser,
  providers, Provider, InsertProvider,
  services, Service, InsertService,
  clients, Client, InsertClient,
  appointments, Appointment, InsertAppointment,
  AppointmentStatus,
  notifications, Notification, InsertNotification
} from "@shared/schema";
import { db } from "./db";
import { and, eq, gte, lte, sql } from "drizzle-orm";
import connectPg from "connect-pg-simple";
import session from "express-session";
import { pool } from "./db";

export class DatabaseStorage implements IStorage {
  public sessionStore: session.Store;

  constructor() {
    const PostgresSessionStore = connectPg(session);
    this.sessionStore = new PostgresSessionStore({
      pool, 
      createTableIfMissing: true,
    });
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(userData: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(userData).returning();
    return user;
  }
  
  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  // Provider methods
  async getProviders(): Promise<Provider[]> {
    return await db.select().from(providers);
  }

  async getProvider(id: number): Promise<Provider | undefined> {
    const [provider] = await db.select().from(providers).where(eq(providers.id, id));
    return provider;
  }

  async getProviderByUserId(userId: number): Promise<Provider | undefined> {
    const [provider] = await db.select().from(providers).where(eq(providers.userId, userId));
    return provider;
  }
  
  async getProviderByUsername(username: string): Promise<Provider | undefined> {
    // Encontrar primeiro o usuário pelo username
    const [user] = await db.select().from(users).where(eq(users.username, username));
    if (!user) return undefined;
    
    // Depois encontrar o provider associado ao usuário
    return this.getProviderByUserId(user.id);
  }

  async createProvider(providerData: InsertProvider): Promise<Provider> {
    const [provider] = await db.insert(providers).values(providerData).returning();
    return provider;
  }
  
  async updateProvider(id: number, providerData: Partial<InsertProvider>): Promise<Provider | undefined> {
    const [updatedProvider] = await db
      .update(providers)
      .set(providerData)
      .where(eq(providers.id, id))
      .returning();
    return updatedProvider;
  }

  // Service methods
  async getServices(providerId: number): Promise<Service[]> {
    return await db.select().from(services).where(eq(services.providerId, providerId));
  }

  async getService(id: number): Promise<Service | undefined> {
    const [service] = await db.select().from(services).where(eq(services.id, id));
    return service;
  }

  async createService(serviceData: InsertService): Promise<Service> {
    const [service] = await db.insert(services).values(serviceData).returning();
    return service;
  }

  async updateService(id: number, serviceData: Partial<InsertService>): Promise<Service | undefined> {
    const [updatedService] = await db
      .update(services)
      .set(serviceData)
      .where(eq(services.id, id))
      .returning();
    return updatedService;
  }

  async deleteService(id: number): Promise<boolean> {
    const result = await db.delete(services).where(eq(services.id, id));
    return true;
  }

  // Client methods
  async getClients(): Promise<Client[]> {
    return await db.select().from(clients);
  }
  
  async getClientsByProvider(providerId: number): Promise<Client[]> {
    // Encontra todos os clientes que têm agendamentos com este provider
    const clientsWithAppointments = await db
      .select({
        clientId: appointments.clientId
      })
      .from(appointments)
      .where(eq(appointments.providerId, providerId))
      .groupBy(appointments.clientId);
      
    if (clientsWithAppointments.length === 0) {
      return [];
    }
    
    // Extrai os IDs dos clientes
    const clientIds = clientsWithAppointments.map(result => result.clientId);
    
    // Busca os detalhes completos dos clientes
    return await db
      .select()
      .from(clients)
      .where(sql`${clients.id} IN (${clientIds.join(', ')})`);
  }

  async getClient(id: number): Promise<Client | undefined> {
    const [client] = await db.select().from(clients).where(eq(clients.id, id));
    return client;
  }

  async getClientByPhone(phone: string): Promise<Client | undefined> {
    const [client] = await db.select().from(clients).where(eq(clients.phone, phone));
    return client;
  }

  async createClient(clientData: InsertClient): Promise<Client> {
    const [client] = await db.insert(clients).values(clientData).returning();
    return client;
  }

  async updateClient(id: number, clientData: Partial<InsertClient>): Promise<Client | undefined> {
    const [updatedClient] = await db
      .update(clients)
      .set(clientData)
      .where(eq(clients.id, id))
      .returning();
    return updatedClient;
  }

  // Appointment methods
  async getAppointments(providerId: number): Promise<Appointment[]> {
    return await db
      .select()
      .from(appointments)
      .where(
        and(
          eq(appointments.providerId, providerId),
          sql`${appointments.status} != ${AppointmentStatus.CANCELLED}`
        )
      )
      .orderBy(appointments.date);
  }

  async getAppointment(id: number): Promise<Appointment | undefined> {
    const [appointment] = await db
      .select()
      .from(appointments)
      .where(eq(appointments.id, id));
    return appointment;
  }

  async getAppointmentsByDate(providerId: number, date: Date): Promise<Appointment[]> {
    console.log(`Buscando agendamentos para a data: ${date.toISOString()} (data local: ${date.toString()})`);

    // Obter o ano, mês e dia da data fornecida em hora local
    const year = date.getFullYear();
    const month = date.getMonth();
    const day = date.getDate();
    
    console.log(`Filtrando agendamentos para data local: ${date.toLocaleDateString()} (${year}-${month+1}-${day})`);

    // Filtrar por data usando SQL para garantir que é feito no fuso horário correto
    const startOfDay = new Date(Date.UTC(year, month, day, 0, 0, 0));
    const endOfDay = new Date(Date.UTC(year, month, day, 23, 59, 59, 999));

    // Registra as datas para debug
    console.log(`Início do dia: ${startOfDay.toISOString()}, Fim do dia: ${endOfDay.toISOString()}`);

    const result = await db
      .select()
      .from(appointments)
      .where(
        and(
          eq(appointments.providerId, providerId),
          gte(appointments.date, startOfDay),
          lte(appointments.date, endOfDay),
          sql`${appointments.status} != ${AppointmentStatus.CANCELLED}`
        )
      )
      .orderBy(appointments.date);

    console.log(`Total de ${result.length} agendamentos encontrados para ${date.toLocaleDateString()}`);
    return result;
  }

  async getAppointmentsByDateRange(
    providerId: number, 
    startDate: Date, 
    endDate: Date
  ): Promise<Appointment[]> {
    return await db
      .select()
      .from(appointments)
      .where(
        and(
          eq(appointments.providerId, providerId),
          gte(appointments.date, startDate),
          lte(appointments.date, endDate),
          sql`${appointments.status} != ${AppointmentStatus.CANCELLED}`
        )
      )
      .orderBy(appointments.date);
  }

  async createAppointment(appointmentData: InsertAppointment): Promise<Appointment> {
    const [appointment] = await db.insert(appointments).values(appointmentData).returning();
    return appointment;
  }

  async updateAppointmentStatus(id: number, status: string): Promise<Appointment | undefined> {
    const [updatedAppointment] = await db
      .update(appointments)
      .set({ status })
      .where(eq(appointments.id, id))
      .returning();
    return updatedAppointment;
  }

  async checkAvailability(providerId: number, date: Date, duration: number): Promise<boolean> {
    // Calcula o tempo de término do agendamento solicitado
    const requestEndTime = new Date(date.getTime() + duration * 60000);
    
    // Debug
    console.log(`Verificando disponibilidade para ${date.toISOString()} (${date.toLocaleTimeString()}) até ${requestEndTime.toISOString()} (${requestEndTime.toLocaleTimeString()})`);
    
    // Seleciona todos os agendamentos para o provedor na mesma data
    const appointmentsOnDay = await this.getAppointmentsByDate(providerId, date);
    
    // Para cada agendamento, verifica se há conflito de horário
    for (const appointment of appointmentsOnDay) {
      // Seleciona o serviço para obter a duração
      const [service] = await db
        .select()
        .from(services)
        .where(eq(services.id, appointment.serviceId));
      
      if (!service) {
        console.log(`Serviço ${appointment.serviceId} não encontrado para verificação.`);
        continue;
      }
      
      const appointmentDate = appointment.date;
      const appointmentDuration = service.duration;
      const appointmentEndTime = new Date(appointmentDate.getTime() + appointmentDuration * 60000);
      
      // Exibir mais informações de depuração
      console.log(`Comparando slot ${date.toLocaleTimeString()} com agendamento às ${appointmentDate.getHours()}:${appointmentDate.getMinutes()} (${appointmentDate.toLocaleDateString()}, ${appointmentDate.toLocaleTimeString()})`);
      
      // Apenas agendamentos pendentes ou confirmados bloqueiam o horário
      // Agendamentos cancelados ou concluídos permitem reagendamento 
      const isPendingOrConfirmed = 
        appointment.status === AppointmentStatus.CONFIRMED || 
        appointment.status === AppointmentStatus.PENDING;
        
      // Verificar se há sobreposição de horários
      const hasOverlap = 
        (date >= appointmentDate && date < appointmentEndTime) || 
        (requestEndTime > appointmentDate && requestEndTime <= appointmentEndTime) ||
        (date <= appointmentDate && requestEndTime >= appointmentEndTime);
      
      if (isPendingOrConfirmed && hasOverlap) {
        console.log(`Conflito detectado com agendamento ${appointment.id} (${appointmentDate.toLocaleTimeString()} - ${appointmentEndTime.toLocaleTimeString()})`);
        return false; // Não está disponível
      }
    }
    
    return true; // Está disponível
  }

  // Notification methods
  async getNotifications(userId: number): Promise<Notification[]> {
    return await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(sql`${notifications.createdAt} DESC`);
  }

  async getUnreadNotifications(userId: number): Promise<Notification[]> {
    return await db
      .select()
      .from(notifications)
      .where(and(
        eq(notifications.userId, userId),
        eq(notifications.isRead, false)
      ))
      .orderBy(sql`${notifications.createdAt} DESC`);
  }

  async createNotification(notificationData: InsertNotification): Promise<Notification> {
    const [notification] = await db
      .insert(notifications)
      .values(notificationData)
      .returning();
    return notification;
  }

  async markNotificationAsRead(id: number): Promise<Notification | undefined> {
    const [notification] = await db
      .update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.id, id))
      .returning();
    return notification;
  }

  async markAllNotificationsAsRead(userId: number): Promise<void> {
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(and(
        eq(notifications.userId, userId),
        eq(notifications.isRead, false)
      ));
  }
}