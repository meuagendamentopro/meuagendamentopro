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
  updateClient(id: number, client: Partial<InsertClient>): Promise<Client | undefined>;
  
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
}

export const storage = new MemStorage();