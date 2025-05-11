import { 
  providers, type Provider, type InsertProvider,
  services, type Service, type InsertService,
  clients, type Client, type InsertClient,
  appointments, type Appointment, type InsertAppointment,
  AppointmentStatus,
  notifications, type Notification, type InsertNotification,
  users, type User, type InsertUser,
  providerClients, type ProviderClient, type InsertProviderClient,
  timeExclusions, type TimeExclusion, type InsertTimeExclusion
} from "@shared/schema";
import session from "express-session";
import createMemoryStore from "memorystore";

export interface IStorage {
  // Propriedade para armazenar sessões
  sessionStore: session.Store;

  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, user: Partial<User>): Promise<User | undefined>;
  deleteUser(id: number): Promise<boolean>;
  getAllUsers(): Promise<User[]>;
  
  // Provider methods
  getProviders(): Promise<Provider[]>;
  getProvider(id: number): Promise<Provider | undefined>;
  getProviderByUserId(userId: number): Promise<Provider | undefined>;
  getProviderByBookingLink(bookingLink: string): Promise<Provider | undefined>;
  createProvider(provider: InsertProvider): Promise<Provider>;
  updateProvider(id: number, provider: Partial<InsertProvider>): Promise<Provider | undefined>;
  
  // Service methods
  getServices(providerId: number): Promise<Service[]>;
  getService(id: number): Promise<Service | undefined>;
  createService(service: InsertService): Promise<Service>;
  updateService(id: number, service: Partial<InsertService>): Promise<Service | undefined>;
  deleteService(id: number): Promise<boolean>;
  
  // Client methods
  getClients(): Promise<Client[]>;
  getClientsByProvider(providerId: number): Promise<Client[]>;
  getClient(id: number): Promise<Client | undefined>;
  getClientByPhone(phone: string): Promise<Client | undefined>;
  createClient(client: InsertClient): Promise<Client>;
  updateClient(id: number, client: Partial<InsertClient>): Promise<Client | undefined>;
  
  // Provider-Client association methods
  associateClientWithProvider(providerId: number, clientId: number): Promise<ProviderClient>;
  getProviderClients(providerId: number): Promise<ProviderClient[]>;
  clientBelongsToProvider(providerId: number, clientId: number): Promise<boolean>;
  
  // Appointment methods
  getAppointments(providerId: number): Promise<Appointment[]>;
  getAppointment(id: number): Promise<Appointment | undefined>;
  getAppointmentsByDate(providerId: number, date: Date): Promise<Appointment[]>;
  getAppointmentsByDateRange(providerId: number, startDate: Date, endDate: Date): Promise<Appointment[]>;
  createAppointment(appointment: InsertAppointment): Promise<Appointment>;
  updateAppointmentStatus(id: number, status: string, cancellationReason?: string): Promise<Appointment | undefined>;
  checkAvailability(providerId: number, date: Date, duration: number): Promise<boolean>;
  
  // Notification methods
  getNotifications(userId: number): Promise<Notification[]>;
  getUnreadNotifications(userId: number): Promise<Notification[]>;
  createNotification(notification: InsertNotification): Promise<Notification>;
  markNotificationAsRead(id: number): Promise<Notification | undefined>;
  markAllNotificationsAsRead(userId: number): Promise<void>;
  
  // Time Exclusion methods
  getTimeExclusions(providerId: number): Promise<TimeExclusion[]>;
  getTimeExclusionsByDay(providerId: number, dayOfWeek: number): Promise<TimeExclusion[]>;
  getTimeExclusion(id: number): Promise<TimeExclusion | undefined>;
  createTimeExclusion(exclusion: InsertTimeExclusion): Promise<TimeExclusion>;
  updateTimeExclusion(id: number, exclusion: Partial<InsertTimeExclusion>): Promise<TimeExclusion | undefined>;
  deleteTimeExclusion(id: number): Promise<boolean>;
}

export class MemStorage implements IStorage {
  // Expondo providers como público para permitir atualizações diretas do provedor
  public providers: Map<number, Provider>;
  private services: Map<number, Service>;
  private clients: Map<number, Client>;
  private providerClients: Map<number, ProviderClient>; // Nova propriedade para associação provider-client
  private appointments: Map<number, Appointment>;
  private users: Map<number, User>;
  private notifications: Map<number, Notification>;
  public sessionStore: session.Store;
  
  private providerId: number;
  private serviceId: number;
  private clientId: number;
  private providerClientId: number; // Novo contador
  private appointmentId: number;
  private userId: number;
  private notificationId: number;
  private timeExclusionId: number;
  private timeExclusions: Map<number, TimeExclusion>;
  
  constructor() {
    const MemoryStore = createMemoryStore(session);
    this.sessionStore = new MemoryStore({ checkPeriod: 86400000 });
    
    this.providers = new Map();
    this.services = new Map();
    this.clients = new Map();
    this.providerClients = new Map();
    this.appointments = new Map();
    this.users = new Map();
    this.notifications = new Map();
    this.timeExclusions = new Map();
    
    this.providerId = 0;
    this.serviceId = 0;
    this.clientId = 0;
    this.providerClientId = 0;
    this.appointmentId = 0;
    this.userId = 0;
    this.notificationId = 0;
    this.timeExclusionId = 0;
    
    // Vamos criar sincronamente para evitar a Promise
    const adminId = ++this.userId;
    const adminUser: User = {
      id: adminId,
      name: "Admin",
      username: "admin",
      password: "$2b$10$Xuyld2OS6W/hDQ0gwKBSd.qqnDfPYMBYP4hoyEZdtbWc1T.i8yPvS", // password123 - hash recém-gerado
      role: "admin",
      avatarUrl: null,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    // Salvar o usuário admin diretamente
    this.users.set(adminId, adminUser);
    
    // Criar o provider para o admin diretamente
    const providerId = ++this.providerId;
    const adminProvider: Provider = {
      id: providerId,
      userId: adminId,
      name: "Admin Provider",
      email: "admin@example.com",
      phone: "(11) 99999-9999",
      avatarUrl: null,
      bookingLink: "admin",
      workingHoursStart: 8,
      workingHoursEnd: 18,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    // Salvar o provider do admin diretamente
    this.providers.set(providerId, adminProvider);
    
    // Criar usuário "link" para testes
    const linkId = ++this.userId;
    const linkUser: User = {
      id: linkId,
      name: "Link",
      username: "link",
      password: "$2b$10$myIqlFTttbyrqybyEYK8FOU3ILvzbt80Fr7zZeWfNg1qnq9TsV2Ji", // password123
      role: "provider",
      avatarUrl: null,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    // Salvar o usuário link diretamente
    this.users.set(linkId, linkUser);
    
    // Criar um provider para o link
    const linkProviderId = ++this.providerId;
    const linkProvider: Provider = {
      id: linkProviderId,
      userId: linkId,
      name: "Link Provider",
      email: "link@example.com",
      phone: "(11) 88888-8888",
      avatarUrl: null,
      bookingLink: "link",
      workingHoursStart: 9,
      workingHoursEnd: 17,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    // Salvar o provider do link diretamente
    this.providers.set(linkProviderId, linkProvider);
  }
  
  // User methods
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }
  
  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(u => u.username === username);
  }
  
  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(u => u.email === email);
  }
  
  async createUser(userData: InsertUser): Promise<User> {
    const id = ++this.userId;
    const newUser: User = {
      id,
      name: userData.name,
      username: userData.username,
      email: userData.email || `${userData.username}@temp.com`,
      password: userData.password,
      role: userData.role || "provider",
      avatarUrl: userData.avatarUrl || null,
      isActive: userData.isActive !== undefined ? userData.isActive : true,
      subscriptionExpiry: userData.subscriptionExpiry || null, 
      neverExpires: userData.neverExpires !== undefined ? userData.neverExpires : false,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.users.set(id, newUser);
    return newUser;
  }
  
  async updateUser(id: number, userData: Partial<User>): Promise<User | undefined> {
    const existingUser = this.users.get(id);
    if (!existingUser) return undefined;
    
    const updatedUser: User = {
      ...existingUser,
      ...userData,
      updatedAt: new Date()
    };
    
    this.users.set(id, updatedUser);
    return updatedUser;
  }
  
  async deleteUser(id: number): Promise<boolean> {
    // Não permitir excluir o usuário admin principal
    if (id === 1) return false;
    
    try {
      // Verificar se é um provider e deletar primeiro
      const provider = await this.getProviderByUserId(id);
      if (provider) {
        // Remover todos os serviços do provider
        Array.from(this.services.values())
          .filter(s => s.providerId === provider.id)
          .forEach(service => this.services.delete(service.id));
          
        // Remover todas as associações provider-client
        Array.from(this.providerClients.values())
          .filter(pc => pc.providerId === provider.id)
          .forEach(pc => this.providerClients.delete(pc.id));
          
        // Remover o provider
        this.providers.delete(provider.id);
      }
      
      // Finalmente, remover o usuário
      return this.users.delete(id);
    } catch (error) {
      console.error('Erro ao excluir usuário:', error);
      return false;
    }
  }
  
  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values());
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
  
  async updateProvider(id: number, providerData: Partial<InsertProvider>): Promise<Provider | undefined> {
    const existingProvider = this.providers.get(id);
    if (!existingProvider) return undefined;
    
    const updatedProvider: Provider = { 
      ...existingProvider, 
      ...providerData,
      updatedAt: new Date()
    };
    
    this.providers.set(id, updatedProvider);
    return updatedProvider;
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
  
  // Provider-Client association methods
  async associateClientWithProvider(providerId: number, clientId: number): Promise<ProviderClient> {
    // Verificar se o provider e o cliente existem
    const provider = this.providers.get(providerId);
    const client = this.clients.get(clientId);
    
    if (!provider) {
      throw new Error(`Provider com ID ${providerId} não encontrado`);
    }
    
    if (!client) {
      throw new Error(`Cliente com ID ${clientId} não encontrado`);
    }
    
    // Verificar se já existe uma associação
    const existing = Array.from(this.providerClients.values()).find(
      pc => pc.providerId === providerId && pc.clientId === clientId
    );
    
    if (existing) {
      return existing;
    }
    
    // Criar nova associação
    const id = ++this.providerClientId;
    const association: ProviderClient = {
      id,
      providerId,
      clientId,
      createdAt: new Date()
    };
    
    console.log(`Associando provider #${providerId} com cliente #${clientId}`);
    this.providerClients.set(id, association);
    return association;
  }
  
  async getProviderClients(providerId: number): Promise<ProviderClient[]> {
    return Array.from(this.providerClients.values())
      .filter(pc => pc.providerId === providerId);
  }
  
  async clientBelongsToProvider(providerId: number, clientId: number): Promise<boolean> {
    // Verifica se existe uma associação direta na tabela de junção
    const hasDirectAssociation = Array.from(this.providerClients.values())
      .some(pc => pc.providerId === providerId && pc.clientId === clientId);
      
    if (hasDirectAssociation) {
      return true;
    }
    
    // Como verificação de compatibilidade, verifica também os agendamentos
    // Isso será removido no futuro quando todas as associações forem migradas
    const appointments = Array.from(this.appointments.values());
    return appointments.some(a => a.providerId === providerId && a.clientId === clientId);
  }
  
  async getClientsByProvider(providerId: number): Promise<Client[]> {
    // Obtém todos os IDs de clientes associados a este provider (via providerClients)
    const providerClientRecords = await this.getProviderClients(providerId);
    const clientIds = new Set(providerClientRecords.map(pc => pc.clientId));
    
    // Como fallback, também busca clientes através de agendamentos
    const appointments = Array.from(this.appointments.values())
      .filter(a => a.providerId === providerId);
    
    // Adicionar os IDs dos clientes com agendamentos ao set
    appointments.forEach(a => clientIds.add(a.clientId));
    
    // Retornar os clientes que correspondem a esses IDs
    return Array.from(this.clients.values())
      .filter(client => 
        clientIds.has(client.id) && 
        (client.active === undefined || client.active === true)  // Filtra clientes inativos
      );
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
      notes: client.notes || null,
      active: client.active !== undefined ? client.active : true
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
      .filter(a => a.providerId === providerId && a.status !== AppointmentStatus.CANCELLED)
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
    
    // Automaticamente associar o cliente ao provedor ao criar um agendamento
    // Isso garante que o cliente apareça na lista do provedor
    try {
      await this.associateClientWithProvider(appointment.providerId, appointment.clientId);
      console.log(`Cliente #${appointment.clientId} associado ao provider #${appointment.providerId} via agendamento #${id}`);
    } catch (error) {
      console.error(`Erro ao associar cliente ao provider: ${error.message}`);
    }
    
    return newAppointment;
  }
  
  async updateAppointmentStatus(id: number, status: string, cancellationReason?: string): Promise<Appointment | undefined> {
    const appointment = this.appointments.get(id);
    if (!appointment) return undefined;
    
    const updatedAppointment: Appointment = { 
      ...appointment, 
      status,
      // Adiciona o motivo de cancelamento apenas se o status for "cancelled" e o motivo for fornecido
      ...(status === AppointmentStatus.CANCELLED && cancellationReason 
        ? { cancellationReason } 
        : {})
    };
    
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

// Migração para banco de dados persistente
import { DatabaseStorage } from "./database-storage";
export const storage = new DatabaseStorage();

// Armazenamento em memória (comentado)
// export const storage = new MemStorage();