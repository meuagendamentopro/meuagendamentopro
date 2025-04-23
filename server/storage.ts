import { 
  providers, type Provider, type InsertProvider,
  services, type Service, type InsertService,
  clients, type Client, type InsertClient,
  appointments, type Appointment, type InsertAppointment,
  AppointmentStatus,
  notifications, type Notification, type InsertNotification,
  users, type User, type InsertUser
} from "@shared/schema";
import session from "express-session";
import createMemoryStore from "memorystore";

export interface IStorage {
  // Propriedade para armazenar sessões
  sessionStore: session.Store;

  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Provider methods
  getProviders(): Promise<Provider[]>;
  getProvider(id: number): Promise<Provider | undefined>;
  getProviderByUserId(userId: number): Promise<Provider | undefined>;
  createProvider(provider: InsertProvider): Promise<Provider>;
  
  // Service methods
  getServices(providerId: number): Promise<Service[]>;
  getService(id: number): Promise<Service | undefined>;
  createService(service: InsertService): Promise<Service>;
  updateService(id: number, service: Partial<InsertService>): Promise<Service | undefined>;
  deleteService(id: number): Promise<boolean>;
  
  // Client methods
  getClients(): Promise<Client[]>;
  getClient(id: number): Promise<Client | undefined>;
  getClientByPhone(phone: string): Promise<Client | undefined>;
  createClient(client: InsertClient): Promise<Client>;
  updateClient(id: number, client: Partial<InsertClient>): Promise<Client | undefined>;
  
  // Appointment methods
  getAppointments(providerId: number): Promise<Appointment[]>;
  getAppointment(id: number): Promise<Appointment | undefined>;
  getAppointmentsByDate(providerId: number, date: Date): Promise<Appointment[]>;
  getAppointmentsByDateRange(providerId: number, startDate: Date, endDate: Date): Promise<Appointment[]>;
  createAppointment(appointment: InsertAppointment): Promise<Appointment>;
  updateAppointmentStatus(id: number, status: string): Promise<Appointment | undefined>;
  checkAvailability(providerId: number, date: Date, duration: number): Promise<boolean>;
  
  // Notification methods
  getNotifications(userId: number): Promise<Notification[]>;
  getUnreadNotifications(userId: number): Promise<Notification[]>;
  createNotification(notification: InsertNotification): Promise<Notification>;
  markNotificationAsRead(id: number): Promise<Notification | undefined>;
  markAllNotificationsAsRead(userId: number): Promise<void>;
}

export class MemStorage implements IStorage {
  // Expondo providers como público para permitir atualizações diretas do provedor
  public providers: Map<number, Provider>;
  private services: Map<number, Service>;
  private clients: Map<number, Client>;
  private appointments: Map<number, Appointment>;
  private users: Map<number, User>;
  private notifications: Map<number, Notification>;
  public sessionStore: session.Store;
  
  private providerId: number;
  private serviceId: number;
  private clientId: number;
  private appointmentId: number;
  private userId: number;
  private notificationId: number;
  
  constructor() {
    const MemoryStore = createMemoryStore(session);
    this.sessionStore = new MemoryStore({ checkPeriod: 86400000 });
    
    this.providers = new Map();
    this.services = new Map();
    this.clients = new Map();
    this.appointments = new Map();
    this.users = new Map();
    this.notifications = new Map();
    
    this.providerId = 0;
    this.serviceId = 0;
    this.clientId = 0;
    this.appointmentId = 0;
    this.userId = 0;
    this.notificationId = 0;
    
    // Criar um usuário padrão admin
    this.createUser({
      name: "Admin",
      username: "admin",
      password: "$2b$10$5QCy5vy6nMpxqjhPnljcPuuDn3S1.KlQ/vykHnP1MZx95Sy9/rHfS", // password123
      role: "admin"
    });

    // Criar um usuário padrão para o provider
    const user = this.createUser({
      name: "Carlos Silva",
      username: "carlos",
      password: "$2b$10$5QCy5vy6nMpxqjhPnljcPuuDn3S1.KlQ/vykHnP1MZx95Sy9/rHfS", // password123
      role: "provider"
    });
    
    // Add a default provider
    this.createProvider({
      userId: 2, // O segundo usuário criado
      name: "Carlos Silva",
      email: "carlos@example.com",
      phone: "(11) 99999-8888",
      avatarUrl: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d",
      bookingLink: "carlos"
    });
  }
  
  // User methods
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }
  
  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(u => u.username === username);
  }
  
  async createUser(userData: InsertUser): Promise<User> {
    const id = ++this.userId;
    const newUser: User = {
      id,
      name: userData.name,
      username: userData.username,
      password: userData.password,
      role: userData.role || "provider",
      avatarUrl: userData.avatarUrl || null,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.users.set(id, newUser);
    return newUser;
  }
  
  // Método extra para pegar um provider pelo ID do usuário
  async getProviderByUserId(userId: number): Promise<Provider | undefined> {
    return Array.from(this.providers.values()).find(p => p.userId === userId);
  }
  
  // Provider methods
  async getProviders(): Promise<Provider[]> {
    return Array.from(this.providers.values());
  }
  
  async getProvider(id: number): Promise<Provider | undefined> {
    return this.providers.get(id);
  }
  
  // Método obsoleto, mantido para compatibilidade
  async getProviderByUsername(username: string): Promise<Provider | undefined> {
    // Procura o usuário pelo username
    const user = await this.getUserByUsername(username);
    if (!user) return undefined;
    
    // Se encontrou o usuário, procura o provider associado
    return await this.getProviderByUserId(user.id);
  }
  
  async createProvider(provider: InsertProvider): Promise<Provider> {
    const id = ++this.providerId;
    // Removendo os atributos do provider original
    const { phone, avatarUrl, workingHoursStart, workingHoursEnd, ...rest } = provider;
    
    const newProvider: Provider = { 
      ...rest, 
      id,
      phone: phone || null,
      avatarUrl: avatarUrl || null,
      bookingLink: rest.bookingLink ?? null,
      workingHoursStart: workingHoursStart !== undefined ? workingHoursStart : 8,
      workingHoursEnd: workingHoursEnd !== undefined ? workingHoursEnd : 18,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.providers.set(id, newProvider);
    return newProvider;
  }
  
  // Service methods
  async getServices(providerId: number): Promise<Service[]> {
    return Array.from(this.services.values()).filter(s => s.providerId === providerId);
  }
  
  async getService(id: number): Promise<Service | undefined> {
    return this.services.get(id);
  }
  
  async createService(service: InsertService): Promise<Service> {
    const id = ++this.serviceId;
    const newService: Service = { 
      ...service, 
      id,
      description: service.description || null,
      active: service.active !== undefined ? service.active : true
    };
    this.services.set(id, newService);
    return newService;
  }
  
  async updateService(id: number, service: Partial<InsertService>): Promise<Service | undefined> {
    const existingService = this.services.get(id);
    if (!existingService) return undefined;
    
    const updatedService: Service = { ...existingService, ...service };
    this.services.set(id, updatedService);
    return updatedService;
  }
  
  async deleteService(id: number): Promise<boolean> {
    return this.services.delete(id);
  }
  
  // Client methods
  async getClients(): Promise<Client[]> {
    return Array.from(this.clients.values());
  }
  
  async getClient(id: number): Promise<Client | undefined> {
    return this.clients.get(id);
  }
  
  async getClientByPhone(phone: string): Promise<Client | undefined> {
    return Array.from(this.clients.values()).find(c => c.phone === phone);
  }
  
  async createClient(client: InsertClient): Promise<Client> {
    const id = ++this.clientId;
    const newClient: Client = { 
      ...client, 
      id,
      email: client.email || null,
      notes: client.notes || null
    };
    this.clients.set(id, newClient);
    return newClient;
  }
  
  async updateClient(id: number, clientData: Partial<InsertClient>): Promise<Client | undefined> {
    const existingClient = this.clients.get(id);
    if (!existingClient) return undefined;
    
    // Atualiza o cliente existente com os novos dados, mantendo os valores existentes quando não são fornecidos
    const updatedClient: Client = { 
      ...existingClient,
      ...clientData,
      // Garantir que campos opcionais sejam tratados corretamente
      email: clientData.email !== undefined ? clientData.email : existingClient.email,
      notes: clientData.notes !== undefined ? clientData.notes : existingClient.notes
    };
    
    this.clients.set(id, updatedClient);
    console.log(`Cliente #${id} (${existingClient.phone}) atualizado: ${JSON.stringify(updatedClient)}`);
    
    return updatedClient;
  }
  
  // Appointment methods
  async getAppointments(providerId: number): Promise<Appointment[]> {
    return Array.from(this.appointments.values())
      .filter(a => a.providerId === providerId)
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }
  
  async getAppointment(id: number): Promise<Appointment | undefined> {
    return this.appointments.get(id);
  }
  
  async getAppointmentsByDate(providerId: number, date: Date): Promise<Appointment[]> {
    // Obter o ano, mês e dia da data fornecida em hora local
    const year = date.getFullYear();
    const month = date.getMonth();
    const day = date.getDate();
    
    console.log(`Filtrando agendamentos para data local: ${date.toLocaleDateString()} (${year}-${month+1}-${day})`);
    
    // Retorna todos os agendamentos para o provider
    const allAppointments = await this.getAppointments(providerId);
    
    // Filtra apenas os agendamentos daquela data
    // usando a comparação de componentes de data no fuso horário local
    const filteredAppointments = allAppointments.filter(appointment => {
      const apptDate = new Date(appointment.date);
      const apptYear = apptDate.getFullYear();
      const apptMonth = apptDate.getMonth();
      const apptDay = apptDate.getDate();
      
      const isMatch = apptYear === year && apptMonth === month && apptDay === day;
      
      if (isMatch) {
        console.log(`Encontrado agendamento para ${apptDate.toLocaleDateString()} (${apptYear}-${apptMonth+1}-${apptDay})`);
      }
      
      return isMatch;
    });
    
    console.log(`Total de ${filteredAppointments.length} agendamentos encontrados para ${date.toLocaleDateString()}`);
    return filteredAppointments;
  }
  
  async getAppointmentsByDateRange(providerId: number, startDate: Date, endDate: Date): Promise<Appointment[]> {
    return Array.from(this.appointments.values())
      .filter(a => {
        // Verifica se o appointmento é do provider correto
        if (a.providerId !== providerId) return false;
        
        // Obtém ano, mês e dia da data do agendamento para comparação em fuso horário local
        const appointmentDate = new Date(a.date);
        const appointmentYear = appointmentDate.getFullYear();
        const appointmentMonth = appointmentDate.getMonth();
        const appointmentDay = appointmentDate.getDate();
        
        // Obtém ano, mês e dia da data inicial para comparação
        const startYear = startDate.getFullYear();
        const startMonth = startDate.getMonth();
        const startDay = startDate.getDate();
        
        // Obtém ano, mês e dia da data final para comparação
        const endYear = endDate.getFullYear();
        const endMonth = endDate.getMonth();
        const endDay = endDate.getDate();
        
        // Verifica se a data do agendamento está entre startDate e endDate
        // Comparando ano, mês e dia diretamente, sem considerar hora
        
        // Data do agendamento está antes da data inicial?
        if (appointmentYear < startYear) return false;
        if (appointmentYear === startYear && appointmentMonth < startMonth) return false;
        if (appointmentYear === startYear && appointmentMonth === startMonth && appointmentDay < startDay) return false;
        
        // Data do agendamento está depois da data final?
        if (appointmentYear > endYear) return false;
        if (appointmentYear === endYear && appointmentMonth > endMonth) return false;
        if (appointmentYear === endYear && appointmentMonth === endMonth && appointmentDay > endDay) return false;
        
        // Se passou por todas as verificações, está dentro do intervalo
        return true;
      })
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }
  
  async createAppointment(appointment: InsertAppointment): Promise<Appointment> {
    const id = ++this.appointmentId;
    const newAppointment: Appointment = { 
      ...appointment, 
      id,
      createdAt: new Date(),
      notes: appointment.notes || null,
      status: appointment.status || AppointmentStatus.PENDING
    };
    this.appointments.set(id, newAppointment);
    return newAppointment;
  }
  
  async updateAppointmentStatus(id: number, status: string): Promise<Appointment | undefined> {
    const appointment = this.appointments.get(id);
    if (!appointment) return undefined;
    
    const updatedAppointment: Appointment = { ...appointment, status };
    this.appointments.set(id, updatedAppointment);
    return updatedAppointment;
  }
  
  async checkAvailability(providerId: number, date: Date, duration: number): Promise<boolean> {
    const appointments = await this.getAppointments(providerId);
    const requestEndTime = new Date(date.getTime() + duration * 60000);
    
    // Debug
    console.log(`Verificando disponibilidade para ${date.toISOString()} (${date.toLocaleTimeString()}) até ${requestEndTime.toISOString()} (${requestEndTime.toLocaleTimeString()})`);
    
    // Check if the appointment time conflicts with any existing appointment
    const isNotAvailable = appointments.some(appointment => {
      // Para comparar corretamente, precisamos garantir que a data de fim do agendamento existente seja calculada
      const appointmentDate = new Date(appointment.date);
      // Precisamos buscar a duração do serviço para calcular o fim do agendamento
      const service = this.services.get(appointment.serviceId);
      
      if (!service) {
        console.log(`Serviço ${appointment.serviceId} não encontrado para verificação.`);
        return false;
      }
      
      const appointmentDuration = service.duration;
      const appointmentEndTime = new Date(appointmentDate.getTime() + appointmentDuration * 60000);
      
      // Exibir mais informações de depuração
      console.log(`Comparando slot ${date.toLocaleTimeString()} com agendamento às ${appointmentDate.getHours()}:${appointmentDate.getMinutes()} (${appointmentDate.toLocaleDateString()}, ${appointmentDate.toLocaleTimeString()})`);
      
      const isPendingOrConfirmed = 
        appointment.status === AppointmentStatus.CONFIRMED || 
        appointment.status === AppointmentStatus.PENDING;
        
      // Comparar ano, mês, dia, hora e minuto
      const sameDate = 
        date.getUTCFullYear() === appointmentDate.getUTCFullYear() &&
        date.getUTCMonth() === appointmentDate.getUTCMonth() &&
        date.getUTCDate() === appointmentDate.getUTCDate();
      
      // Detecta se há sobreposição entre os horários
      const hasOverlap = sameDate && (
        (date >= appointmentDate && date < appointmentEndTime) || 
        (requestEndTime > appointmentDate && requestEndTime <= appointmentEndTime) ||
        (date <= appointmentDate && requestEndTime >= appointmentEndTime)
      );
      
      if (isPendingOrConfirmed && hasOverlap) {
        console.log(`Conflito detectado com agendamento ${appointment.id} (${appointmentDate.toLocaleTimeString()} - ${appointmentEndTime.toLocaleTimeString()})`);
      }
      
      return isPendingOrConfirmed && hasOverlap;
    });
    
    return !isNotAvailable;
  }
  
  // Notification methods
  async getNotifications(userId: number): Promise<Notification[]> {
    return Array.from(this.notifications.values())
      .filter(n => n.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()); // Ordenar do mais recente para o mais antigo
  }
  
  async getUnreadNotifications(userId: number): Promise<Notification[]> {
    return Array.from(this.notifications.values())
      .filter(n => n.userId === userId && !n.isRead)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
  
  async createNotification(notification: InsertNotification): Promise<Notification> {
    const id = ++this.notificationId;
    const newNotification: Notification = {
      id,
      userId: notification.userId,
      title: notification.title,
      message: notification.message,
      type: notification.type || "appointment",
      appointmentId: notification.appointmentId || null,
      isRead: false,
      createdAt: new Date()
    };
    this.notifications.set(id, newNotification);
    return newNotification;
  }
  
  async markNotificationAsRead(id: number): Promise<Notification | undefined> {
    const notification = this.notifications.get(id);
    if (!notification) return undefined;
    
    const updatedNotification: Notification = { ...notification, isRead: true };
    this.notifications.set(id, updatedNotification);
    return updatedNotification;
  }
  
  async markAllNotificationsAsRead(userId: number): Promise<void> {
    const userNotifications = await this.getUnreadNotifications(userId);
    for (const notification of userNotifications) {
      await this.markNotificationAsRead(notification.id);
    }
  }
}

export const storage = new MemStorage();