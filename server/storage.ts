import { 
  providers, type Provider, type InsertProvider,
  services, type Service, type InsertService,
  clients, type Client, type InsertClient,
  appointments, type Appointment, type InsertAppointment,
  AppointmentStatus
} from "@shared/schema";

export interface IStorage {
  // Provider methods
  getProviders(): Promise<Provider[]>;
  getProvider(id: number): Promise<Provider | undefined>;
  getProviderByUsername(username: string): Promise<Provider | undefined>;
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
  
  // Appointment methods
  getAppointments(providerId: number): Promise<Appointment[]>;
  getAppointment(id: number): Promise<Appointment | undefined>;
  getAppointmentsByDate(providerId: number, date: Date): Promise<Appointment[]>;
  getAppointmentsByDateRange(providerId: number, startDate: Date, endDate: Date): Promise<Appointment[]>;
  createAppointment(appointment: InsertAppointment): Promise<Appointment>;
  updateAppointmentStatus(id: number, status: string): Promise<Appointment | undefined>;
  checkAvailability(providerId: number, date: Date, duration: number): Promise<boolean>;
}

export class MemStorage implements IStorage {
  // Expondo providers como público para permitir atualizações diretas do provedor
  public providers: Map<number, Provider>;
  private services: Map<number, Service>;
  private clients: Map<number, Client>;
  private appointments: Map<number, Appointment>;
  
  private providerId: number;
  private serviceId: number;
  private clientId: number;
  private appointmentId: number;
  
  constructor() {
    this.providers = new Map();
    this.services = new Map();
    this.clients = new Map();
    this.appointments = new Map();
    
    this.providerId = 0;
    this.serviceId = 0;
    this.clientId = 0;
    this.appointmentId = 0;
    
    // Add a default provider
    this.createProvider({
      name: "Carlos Silva",
      email: "carlos@example.com",
      username: "carlos",
      password: "password123",
      phone: "(11) 99999-8888",
      avatarUrl: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d",
    });
  }
  
  // Provider methods
  async getProviders(): Promise<Provider[]> {
    return Array.from(this.providers.values());
  }
  
  async getProvider(id: number): Promise<Provider | undefined> {
    return this.providers.get(id);
  }
  
  async getProviderByUsername(username: string): Promise<Provider | undefined> {
    return Array.from(this.providers.values()).find(p => p.username === username);
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
      workingHoursStart: workingHoursStart !== undefined ? workingHoursStart : 8,
      workingHoursEnd: workingHoursEnd !== undefined ? workingHoursEnd : 18
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
    // Set start time to beginning of day
    const startDate = new Date(date);
    startDate.setHours(0, 0, 0, 0);
    
    // Set end time to end of day
    const endDate = new Date(date);
    endDate.setHours(23, 59, 59, 999);
    
    return this.getAppointmentsByDateRange(providerId, startDate, endDate);
  }
  
  async getAppointmentsByDateRange(providerId: number, startDate: Date, endDate: Date): Promise<Appointment[]> {
    return Array.from(this.appointments.values())
      .filter(a => a.providerId === providerId && 
                  a.date >= startDate && 
                  a.date <= endDate)
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
    const endTime = new Date(date.getTime() + duration * 60000);
    
    // Check if the appointment time conflicts with any existing appointment
    return !appointments.some(a => 
      (a.status === AppointmentStatus.CONFIRMED || a.status === AppointmentStatus.PENDING) &&
      ((date >= a.date && date < a.endTime) || 
       (endTime > a.date && endTime <= a.endTime) ||
       (date <= a.date && endTime >= a.endTime))
    );
  }
}

export const storage = new MemStorage();