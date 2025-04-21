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
  private providers: Map<number, Provider>;
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
    
    this.providerId = 1;
    this.serviceId = 1;
    this.clientId = 1;
    this.appointmentId = 1;
    
    // Add a default provider
    this.createProvider({
      name: "Carlos Silva",
      email: "carlos@example.com",
      username: "carlos",
      password: "password123",
      phone: "(11) 99999-8888",
      avatarUrl: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d",
    });
    
    // Add some default services
    this.createService({
      providerId: 1,
      name: "Corte Masculino",
      description: "Corte de cabelo masculino",
      duration: 30,
      price: 5000, // R$50.00
      active: true
    });
    
    this.createService({
      providerId: 1,
      name: "Corte Feminino",
      description: "Corte de cabelo feminino",
      duration: 45,
      price: 7000, // R$70.00
      active: true
    });
    
    this.createService({
      providerId: 1,
      name: "Barba",
      description: "Barba completa",
      duration: 20,
      price: 3500, // R$35.00
      active: true
    });
    
    this.createService({
      providerId: 1,
      name: "Coloração",
      description: "Coloração completa",
      duration: 90,
      price: 12000, // R$120.00
      active: true
    });
    
    this.createService({
      providerId: 1,
      name: "Escova",
      description: "Escova modeladora",
      duration: 45,
      price: 6000, // R$60.00
      active: true
    });
    
    // Add some default clients
    this.createClient({
      name: "João Santos",
      phone: "(11) 98765-4321",
      email: "joao@example.com",
      notes: "Cliente frequente"
    });
    
    this.createClient({
      name: "Maria Silva",
      phone: "(11) 91234-5678",
      email: "maria@example.com",
      notes: "Prefere atendimento no período da tarde"
    });
    
    this.createClient({
      name: "Pedro Oliveira",
      phone: "(11) 92345-6789",
      email: "pedro@example.com",
      notes: ""
    });
    
    // Add some default appointments
    const today = new Date();
    today.setHours(9, 0, 0, 0);
    
    this.createAppointment({
      providerId: 1,
      clientId: 1,
      serviceId: 1,
      date: new Date(today),
      endTime: new Date(today.getTime() + 30 * 60000), // +30 minutes
      status: AppointmentStatus.CONFIRMED,
      notes: ""
    });
    
    const appointment2Date = new Date(today);
    appointment2Date.setHours(10, 0, 0, 0);
    
    this.createAppointment({
      providerId: 1,
      clientId: 3,
      serviceId: 3,
      date: new Date(appointment2Date),
      endTime: new Date(appointment2Date.getTime() + 20 * 60000), // +20 minutes
      status: AppointmentStatus.CONFIRMED,
      notes: ""
    });
    
    const appointment3Date = new Date(today);
    appointment3Date.setHours(13, 0, 0, 0);
    
    this.createAppointment({
      providerId: 1,
      clientId: 2,
      serviceId: 2,
      date: new Date(appointment3Date),
      endTime: new Date(appointment3Date.getTime() + 45 * 60000), // +45 minutes
      status: AppointmentStatus.PENDING,
      notes: ""
    });
    
    const appointment4Date = new Date(today);
    appointment4Date.setHours(14, 0, 0, 0);
    
    this.createAppointment({
      providerId: 1,
      clientId: 2,
      serviceId: 5,
      date: new Date(appointment4Date),
      endTime: new Date(appointment4Date.getTime() + 45 * 60000), // +45 minutes
      status: AppointmentStatus.CONFIRMED,
      notes: ""
    });
    
    const appointment5Date = new Date(today);
    appointment5Date.setHours(16, 0, 0, 0);
    
    this.createAppointment({
      providerId: 1,
      clientId: 1,
      serviceId: 1,
      date: new Date(appointment5Date),
      endTime: new Date(appointment5Date.getTime() + 30 * 60000), // +30 minutes
      status: AppointmentStatus.CONFIRMED,
      notes: ""
    });
    
    const appointment6Date = new Date(today);
    appointment6Date.setHours(17, 0, 0, 0);
    
    this.createAppointment({
      providerId: 1,
      clientId: 2,
      serviceId: 4,
      date: new Date(appointment6Date),
      endTime: new Date(appointment6Date.getTime() + 90 * 60000), // +90 minutes
      status: AppointmentStatus.CONFIRMED,
      notes: ""
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
    const id = this.providerId++;
    const newProvider: Provider = { ...provider, id };
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
    const id = this.serviceId++;
    const newService: Service = { ...service, id };
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
    const id = this.clientId++;
    const newClient: Client = { ...client, id };
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
    const id = this.appointmentId++;
    const newAppointment: Appointment = { 
      ...appointment, 
      id,
      createdAt: new Date()
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
