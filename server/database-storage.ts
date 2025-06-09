import { IStorage } from "./storage";
import { 
  users, User, InsertUser,
  providers, Provider, InsertProvider,
  services, Service, InsertService,
  clients, Client, InsertClient,
  providerClients, ProviderClient,
  appointments, Appointment, InsertAppointment,
  AppointmentStatus,
  notifications, Notification, InsertNotification,
  timeExclusions, TimeExclusion, InsertTimeExclusion,
  employees, Employee, InsertEmployee,
  employeeServices, EmployeeService, InsertEmployeeService
} from "@shared/schema";
import { db } from "./db";
import { and, eq, gte, lte, sql, inArray, ne } from "drizzle-orm";
import connectPg from "connect-pg-simple";
import session from "express-session";
import pg from 'pg';
const { Pool } = pg;
import { localConfig } from './local-config';

export class DatabaseStorage implements IStorage {
  public sessionStore: session.Store;
  private pool: pg.Pool;

  constructor() {
    console.log('Inicializando DatabaseStorage...');
    try {
      const dbUrl = process.env.DATABASE_URL || localConfig.database.url;
      console.log('Tentando conectar ao PostgreSQL com URL:', dbUrl);
      this.pool = new Pool({
        connectionString: dbUrl,
      });
      
      // Testar a conexão imediatamente
      this.pool.query('SELECT NOW()', (err: any, res: any) => {
        if (err) {
          console.error('ERRO NA CONEXÃO COM POSTGRESQL:', err);
        } else {
          console.log('Conexão com o PostgreSQL estabelecida! Timestamp do servidor:', res.rows[0].now);
        }
      });

      // Inicializar o armazenamento de sessões com configurações super otimizadas
      const PostgresSessionStore = connectPg(session);
      this.sessionStore = new PostgresSessionStore({
        pool: this.pool, 
        createTableIfMissing: true,
        tableName: 'session',
        schemaName: 'public',
        // Configurações extremamente otimizadas para evitar problemas de sessão
        pruneSessionInterval: 24 * 60 * 60, // Limpar sessões apenas uma vez por dia
        ttl: 365 * 24 * 60 * 60, // TTL de 1 ano para sessões (em segundos)
        disableTouch: false, // Garantir que cada acesso atualize o TTL da sessão
        errorLog: (err) => console.error('Erro na sessão PostgreSQL:', err)
      });
      console.log('PostgresSessionStore inicializado com sucesso!');
      
      // Criar a tabela de sessões manualmente se necessário
      this.createSessionTableIfNeeded().then(() => {
        console.log('Tabela de sessões verificada/criada com sucesso!');
      }).catch(err => {
        console.error('Erro ao criar tabela de sessões:', err);
      });
      
      console.log('Construtor do DatabaseStorage concluído com sucesso!');
    } catch (error) {
      console.error('ERRO FATAL no construtor do DatabaseStorage:', error);
      throw error;
    }
  }
  
  // Método auxiliar para criar a tabela de sessões manualmente
  private async createSessionTableIfNeeded() {
    try {
      console.log('Verificando se a tabela de sessões existe...');
      
      // Verificar se a tabela já existe
      const tableExists = await this.pool.query(
        "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'session')"
      );
      
      console.log('Resultado da verificação da tabela de sessões:', tableExists.rows);
      
      if (!tableExists.rows[0].exists) {
        console.log('Tabela de sessões não existe. Criando tabela...');
        // Criar a tabela de sessões
        await this.pool.query(`
          CREATE TABLE IF NOT EXISTS "session" (
            "sid" varchar NOT NULL COLLATE "default",
            "sess" json NOT NULL,
            "expire" timestamp(6) NOT NULL,
            CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
          )
        `);
        console.log('Tabela de sessões criada com sucesso!');
      } else {
        console.log('Tabela de sessões já existe.');
        
        // Verificar se a tabela tem a estrutura correta
        try {
          console.log('Verificando estrutura da tabela de sessões...');
          await this.pool.query('SELECT sid, sess, expire FROM "session" LIMIT 0');
          console.log('Estrutura da tabela de sessões está correta.');
        } catch (structureError) {
          console.error('Erro ao verificar estrutura da tabela de sessões:', structureError);
          console.log('Tentando recriar a tabela de sessões...');
          
          // Tentar recriar a tabela
          await this.pool.query('DROP TABLE IF EXISTS "session"');
          await this.pool.query(`
            CREATE TABLE "session" (
              "sid" varchar NOT NULL COLLATE "default",
              "sess" json NOT NULL,
              "expire" timestamp(6) NOT NULL,
              CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
            )
          `);
          console.log('Tabela de sessões recriada com sucesso!');
        }
      }
      
      return true;
    } catch (error) {
      console.error('Erro ao verificar/criar tabela de sessões:', error);
      // Não lançar o erro, apenas registrar
      return false;
    }
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    try {
      console.log(`DatabaseStorage: Buscando usuário pelo username: ${username}`);
      const result = await db.select().from(users).where(eq(users.username, username));
      console.log(`DatabaseStorage: Resultado da busca: ${JSON.stringify(result)}`);
      
      const [user] = result;
      console.log(`DatabaseStorage: Usuário encontrado: ${user ? 'Sim' : 'Não'}`);
      
      return user;
    } catch (error) {
      console.error(`DatabaseStorage: Erro ao buscar usuário pelo username ${username}:`, error);
      throw error;
    }
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async createUser(userData: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(userData).returning();
    return user;
  }
  
  async updateUser(id: number, userData: Partial<User>): Promise<User | undefined> {
    const [updatedUser] = await db
      .update(users)
      .set({
        ...userData,
        updatedAt: new Date()
      })
      .where(eq(users.id, id))
      .returning();
    return updatedUser;
  }

  async deleteUser(id: number): Promise<boolean> {
    try {
      // Verificar se é um provider e deletar dados relacionados
      const provider = await this.getProviderByUserId(id);
      if (provider) {
        // Buscar os IDs dos clientes exclusivos deste provider
        const providerClientAssociations = await db
          .select()
          .from(providerClients)
          .where(eq(providerClients.providerId, provider.id));
        
        const clientIds = providerClientAssociations.map(pc => pc.clientId);
        
        // Deletar todas as notificações relacionadas ao provider
        await db.delete(notifications)
          .where(eq(notifications.userId, id));
        
        // Deletar todos os agendamentos do provider
        await db.delete(appointments)
          .where(eq(appointments.providerId, provider.id));
        
        // Deletar todos os serviços do provider
        await db.delete(services)
          .where(eq(services.providerId, provider.id));
        
        // Deletar todas as associações provider-client
        await db.delete(providerClients)
          .where(eq(providerClients.providerId, provider.id));
        
        // Verificar se há clientes que não estão associados a nenhum outro provider
        // e excluí-los se forem exclusivos deste provider
        for (const clientId of clientIds) {
          const otherAssociations = await db
            .select()
            .from(providerClients)
            .where(
              and(
                eq(providerClients.clientId, clientId),
                ne(providerClients.providerId, provider.id)
              )
            );
          
          // Se o cliente não está associado a nenhum outro provider, excluí-lo
          if (otherAssociations.length === 0) {
            // Deletar agendamentos relacionados ao cliente
            await db.delete(appointments)
              .where(eq(appointments.clientId, clientId));
            
            // Deletar o cliente
            await db.delete(clients)
              .where(eq(clients.id, clientId));
          }
        }
        
        // Deletar o provider
        await db.delete(providers)
          .where(eq(providers.id, provider.id));
      }
      
      // Finalmente, deletar o usuário
      await db.delete(users)
        .where(eq(users.id, id));
      
      return true;
    } catch (error) {
      console.error('Erro ao excluir usuário:', error);
      return false;
    }
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
  
  async getProviderByBookingLink(bookingLink: string): Promise<Provider | undefined> {
    // Busca diretamente pelo bookingLink na tabela de providers
    const [provider] = await db.select()
      .from(providers)
      .where(eq(providers.bookingLink, bookingLink));
    
    return provider;
  }

  async createProvider(providerData: InsertProvider): Promise<Provider> {
    const [provider] = await db.insert(providers).values(providerData).returning();
    return provider;
  }
  
  async updateProvider(id: number, providerData: Partial<InsertProvider>): Promise<Provider | undefined> {
    console.log(`DatabaseStorage: Atualizando provider ${id} com campos:`, Object.keys(providerData));
    
    // Log específico para os dados do Mercado Pago (valores sensíveis não serão logados)
    if (providerData.pixMercadoPagoToken !== undefined) {
      console.log(`Atualizando token do Mercado Pago para provider ${id}`);
    }
    
    if (providerData.pixIdentificationNumber !== undefined) {
      console.log(`Atualizando número de identificação CPF/CNPJ para provider ${id}`);
    }
    
    try {
      const [updatedProvider] = await db
        .update(providers)
        .set(providerData)
        .where(eq(providers.id, id))
        .returning();
      
      console.log(`Provider ${id} atualizado com sucesso. Campos retornados:`, Object.keys(updatedProvider || {}));
      return updatedProvider;
    } catch (error) {
      console.error(`Erro ao atualizar provider ${id}:`, error);
      throw error;
    }
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
    // Busca clientes associados a este provider na tabela de associação
    const clientAssociations = await db
      .select({
        clientId: providerClients.clientId
      })
      .from(providerClients)
      .where(eq(providerClients.providerId, providerId));
      
    // Encontra todos os clientes que têm agendamentos com este provider
    const clientsWithAppointments = await db
      .select({
        clientId: appointments.clientId
      })
      .from(appointments)
      .where(eq(appointments.providerId, providerId))
      .groupBy(appointments.clientId);
      
    // Combina os dois conjuntos de IDs de clientes sem usar Set
    const associatedClientIds = clientAssociations.map(result => result.clientId);
    const appointmentClientIds = clientsWithAppointments.map(result => result.clientId);
    
    // Usar um objeto para deduplicar os IDs
    const uniqueIds: {[key: number]: boolean} = {};
    associatedClientIds.forEach(id => uniqueIds[id] = true);
    appointmentClientIds.forEach(id => uniqueIds[id] = true);
    
    const allClientIds = Object.keys(uniqueIds).map(id => parseInt(id));
    
    // Se não há clientes, retorna array vazio
    if (allClientIds.length === 0) {
      return [];
    }
    
    // Busca os detalhes completos dos clientes
    if (allClientIds.length === 1) {
      return await db
        .select()
        .from(clients)
        .where(eq(clients.id, allClientIds[0]));
    } else {
      // Para evitar problemas com o inArray, usamos uma abordagem alternativa
      const clientList = await db.select().from(clients);
      return clientList.filter(client => allClientIds.includes(client.id));
    }
  }

  async getClient(id: number): Promise<Client | undefined> {
    const [client] = await db.select().from(clients).where(eq(clients.id, id));
    return client;
  }

  async getClientByPhone(phone: string): Promise<Client | undefined> {
    // Normaliza o número de telefone (remove todos os caracteres não numéricos)
    const normalizedPhone = phone.replace(/\D/g, '');
    
    // Busca todos os clientes
    const allClients = await db.select().from(clients);
    
    // Encontra o cliente cujo número normalizado corresponde ao número buscado
    const client = allClients.find(client => {
      const clientNormalizedPhone = client.phone.replace(/\D/g, '');
      return clientNormalizedPhone === normalizedPhone;
    });
    
    return client;
  }

  async createClient(clientData: InsertClient): Promise<Client> {
    // Verifica se já existe um cliente com esse telefone antes de criar
    const existingClient = await this.getClientByPhone(clientData.phone);
    if (existingClient) {
      console.log(`Cliente já existe com o telefone ${clientData.phone}, retornando o cliente existente.`);
      return existingClient;
    }
    
    // Normaliza o número de telefone para um formato padrão: (XX) XXXXX-XXXX
    let normalizedPhone = clientData.phone.replace(/\D/g, '');
    if (normalizedPhone.length === 11) {
      // Para celulares brasileiros (11 dígitos)
      normalizedPhone = `(${normalizedPhone.substring(0, 2)}) ${normalizedPhone.substring(2, 7)}-${normalizedPhone.substring(7)}`;
    } else if (normalizedPhone.length === 10) {
      // Para telefones fixos (10 dígitos)
      normalizedPhone = `(${normalizedPhone.substring(0, 2)}) ${normalizedPhone.substring(2, 6)}-${normalizedPhone.substring(6)}`;
    }
    
    // Cria o cliente com o telefone normalizado
    const [client] = await db.insert(clients).values({
      ...clientData,
      phone: normalizedPhone
    }).returning();
    
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

  // Provider-Client association methods
  async associateClientWithProvider(providerId: number, clientId: number): Promise<ProviderClient> {
    const [association] = await db
      .insert(providerClients)
      .values({ providerId, clientId })
      .returning();
    return association;
  }

  async getProviderClients(providerId: number): Promise<ProviderClient[]> {
    return await db
      .select()
      .from(providerClients)
      .where(eq(providerClients.providerId, providerId));
  }

  async clientBelongsToProvider(providerId: number, clientId: number): Promise<boolean> {
    // Verifica se existe uma associação direta na tabela de junção
    const [association] = await db
      .select()
      .from(providerClients)
      .where(
        and(
          eq(providerClients.providerId, providerId),
          eq(providerClients.clientId, clientId)
        )
      );
      
    if (!!association) {
      return true;
    }
    
    // Se não houver associação direta, verifica se o cliente tem agendamentos com este provider
    const [appointmentExists] = await db
      .select({ count: sql<number>`count(*)` })
      .from(appointments)
      .where(
        and(
          eq(appointments.providerId, providerId),
          eq(appointments.clientId, clientId)
        )
      );
    
    // Se existe pelo menos um agendamento, também considera que o cliente pertence ao provider
    return appointmentExists && appointmentExists.count > 0;
  }

  // Appointment methods
  async getAppointments(providerId: number, includeCancelled: boolean = true): Promise<Appointment[]> {
    // Se includeCancelled for falso, excluir os cancelados
    const conditions = includeCancelled
      ? [eq(appointments.providerId, providerId)]
      : [
          eq(appointments.providerId, providerId),
          sql`${appointments.status} != ${AppointmentStatus.CANCELLED}`
        ];
    
    return await db
      .select()
      .from(appointments)
      .where(and(...conditions))
      .orderBy(appointments.date);
  }

  async getAppointment(id: number): Promise<Appointment | undefined> {
    const [appointment] = await db
      .select()
      .from(appointments)
      .where(eq(appointments.id, id));
    return appointment;
  }

  async getAppointmentsByDate(providerId: number, date: Date, includeCancelled: boolean = true): Promise<Appointment[]> {
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

    // Base de condições que sempre inclui o providerId e a faixa de data
    const conditions = [
      eq(appointments.providerId, providerId),
      gte(appointments.date, startOfDay),
      lte(appointments.date, endOfDay)
    ];
    
    // Se não queremos incluir os cancelados, adiciona a condição
    if (!includeCancelled) {
      conditions.push(sql`${appointments.status} != ${AppointmentStatus.CANCELLED}`);
    }

    const result = await db
      .select()
      .from(appointments)
      .where(and(...conditions))
      .orderBy(appointments.date);

    console.log(`Total de ${result.length} agendamentos encontrados para ${date.toLocaleDateString()}`);
    return result;
  }

  async getAppointmentsByDateRange(
    providerId: number, 
    startDate: Date, 
    endDate: Date,
    includeCancelled: boolean = true
  ): Promise<Appointment[]> {
    // Base de condições que sempre inclui o providerId e a faixa de data
    const conditions = [
      eq(appointments.providerId, providerId),
      gte(appointments.date, startDate),
      lte(appointments.date, endDate)
    ];
    
    // Se não queremos incluir os cancelados, adiciona a condição
    if (!includeCancelled) {
      conditions.push(sql`${appointments.status} != ${AppointmentStatus.CANCELLED}`);
    }
    
    return await db
      .select()
      .from(appointments)
      .where(and(...conditions))
      .orderBy(appointments.date);
  }

  async createAppointment(appointmentData: InsertAppointment): Promise<Appointment> {
    const [appointment] = await db.insert(appointments).values(appointmentData).returning();
    return appointment;
  }

  async updateAppointmentStatus(id: number, status: string, cancellationReason?: string): Promise<Appointment | undefined> {
    const updateData: Record<string, any> = { status };
    
    // Se for cancelamento e tiver motivo, salva o motivo
    if (status === AppointmentStatus.CANCELLED && cancellationReason) {
      updateData.cancellationReason = cancellationReason;
    }
    
    const [updatedAppointment] = await db
      .update(appointments)
      .set(updateData)
      .where(eq(appointments.id, id))
      .returning();
    return updatedAppointment;
  }

  async updateAppointment(id: number, appointmentData: Partial<Appointment>): Promise<Appointment | undefined> {
    console.log(`📝 Atualizando agendamento ${id} com dados:`, appointmentData);
    
    try {
      const [updatedAppointment] = await db
        .update(appointments)
        .set(appointmentData)
        .where(eq(appointments.id, id))
        .returning();
      
      console.log(`✅ Agendamento ${id} atualizado com sucesso:`, updatedAppointment);
      return updatedAppointment;
    } catch (error) {
      console.error(`❌ Erro ao atualizar agendamento ${id}:`, error);
      throw error;
    }
  }

  async deleteAppointment(id: number): Promise<boolean> {
    console.log(`🗑️ Deletando agendamento ${id}`);
    
    try {
      const result = await db
        .delete(appointments)
        .where(eq(appointments.id, id));
      
      console.log(`✅ Agendamento ${id} deletado com sucesso`);
      return true;
    } catch (error) {
      console.error(`❌ Erro ao deletar agendamento ${id}:`, error);
      return false;
    }
  }

  async checkAvailability(providerId: number, date: Date, duration: number, employeeId?: number): Promise<boolean> {
    // Calcula o tempo de término do agendamento solicitado
    const requestEndTime = new Date(date.getTime() + duration * 60000);
    
    // Debug
    console.log(`Verificando disponibilidade para ${date.toISOString()} (${date.toLocaleTimeString()}) até ${requestEndTime.toISOString()} (${requestEndTime.toLocaleTimeString()})`);
    
    // Passo 1: Verificar se a data/hora está dentro do horário de trabalho do prestador
    const provider = await this.getProvider(providerId);
    if (!provider) {
      console.log(`Provider ${providerId} não encontrado para verificação de disponibilidade.`);
      return false;
    }
    
    // Verificar horário de trabalho configurado
    const workingHoursStart = provider.workingHoursStart ?? 8;  // Padrão: 8:00
    const workingHoursEnd = provider.workingHoursEnd ?? 18;     // Padrão: 18:00
    
    // Primeiro, verificar se o dia da semana está disponível
    // Obter o dia da semana da data solicitada (1 = Segunda, ..., 7 = Domingo)
    const weekday = date.getDay() === 0 ? 7 : date.getDay(); // Convertendo 0 (domingo) para 7
    
    // Verificar se o provider tem dias de trabalho configurados
    if (provider.workingDays) {
      const workingDays = provider.workingDays.split(',').map(d => parseInt(d.trim()));
      console.log(`Verificando dias de trabalho: Solicitado ${weekday}, Configurados ${workingDays.join(', ')}`);
      
      if (!workingDays.includes(weekday)) {
        console.log(`Dia da semana ${weekday} não está nos dias de trabalho configurados`);
        return false;
      } else {
        console.log(`Dia da semana ${weekday} está disponível para trabalho`);
      }
    } else {
      console.log('Provider não tem dias de trabalho configurados, assumindo todos os dias disponíveis');
    }
    
    // Extrair a hora do agendamento solicitado (hora local)
    const requestHour = date.getHours();
    const requestEndHour = requestEndTime.getHours();
    const requestEndMinutes = requestEndTime.getMinutes();
    
    console.log(`Verificando horário de trabalho: Solicitado ${requestHour}:${date.getMinutes()} a ${requestEndHour}:${requestEndMinutes}, Configurado ${workingHoursStart}:00 a ${workingHoursEnd}:00`);
    
    // Criar objetos Date para comparar horários de forma mais precisa
    // Cria um Date só com o horário (sem data) para facilitar a comparação
    const today = new Date();
    
    // Data de referência (hoje) com horário de início de trabalho
    const workStart = new Date(today);
    workStart.setHours(workingHoursStart, 0, 0, 0);
    
    // Data de referência (hoje) com horário de fim de trabalho
    const workEnd = new Date(today);
    workEnd.setHours(workingHoursEnd, 0, 0, 0);
    
    // Horário solicitado (apenas a parte da hora)
    const requestTimeStart = new Date(today);
    requestTimeStart.setHours(date.getHours(), date.getMinutes(), 0, 0);
    
    // Horário de término solicitado (apenas a parte da hora)
    const requestTimeEnd = new Date(today);
    requestTimeEnd.setHours(requestEndTime.getHours(), requestEndTime.getMinutes(), 0, 0);
    
    console.log(`Comparando horários:
    - Horário de trabalho: ${workStart.toLocaleTimeString()} - ${workEnd.toLocaleTimeString()}
    - Horário solicitado: ${requestTimeStart.toLocaleTimeString()} - ${requestTimeEnd.toLocaleTimeString()}`);
    
    // Verificar se o horário solicitado está dentro do horário de trabalho
    if (requestTimeStart < workStart || requestTimeEnd > workEnd) {
      console.log(`Horário fora do expediente configurado (${workingHoursStart}h às ${workingHoursEnd}h)`);
      return false;
    }
    
    // Passo 2: Verificar se o horário está dentro de alguma exclusão de horário
    try {
      // Buscar exclusões para este dia da semana
      const timeExclusionsForDay = await this.getTimeExclusionsByDay(providerId, weekday);
      
      if (timeExclusionsForDay.length > 0) {
        console.log(`Encontradas ${timeExclusionsForDay.length} exclusões de horário para o dia ${weekday}`);
        
        // Extrair hora e minuto do horário solicitado para comparação com exclusões
        const requestHourStr = requestHour.toString().padStart(2, '0');
        const requestMinuteStr = date.getMinutes().toString().padStart(2, '0');
        const requestTimeStr = `${requestHourStr}:${requestMinuteStr}`;
        
        // Calcular hora e minuto do final do agendamento
        const endHourStr = requestEndHour.toString().padStart(2, '0');
        const endMinuteStr = requestEndMinutes.toString().padStart(2, '0');
        const endTimeStr = `${endHourStr}:${endMinuteStr}`;
        
        console.log(`Comparando horário solicitado ${requestTimeStr}-${endTimeStr} com exclusões`);
        
        for (const exclusion of timeExclusionsForDay) {
          console.log(`Verificando exclusão: ${exclusion.name || 'Sem nome'} - ${exclusion.startTime} às ${exclusion.endTime}`);
          
          // Verificar sobreposição entre horário solicitado e exclusão
          // Não há sobreposição se um termina antes do outro começar
          const noOverlap = 
            endTimeStr <= exclusion.startTime || 
            requestTimeStr >= exclusion.endTime;
          
          if (!noOverlap) {
            console.log(`Horário indisponível devido à exclusão: ${exclusion.name || 'Sem nome'} (${exclusion.startTime} - ${exclusion.endTime})`);
            return false;
          }
        }
      } else {
        console.log(`Nenhuma exclusão de horário encontrada para o dia ${weekday}`);
      }
    } catch (error) {
      console.error("Erro ao verificar exclusões de horário:", error);
      // Não interrompe o fluxo se falhar, continua a verificação
    }
    
    // Passo 3: Verificar se é uma conta empresa
    const providerData = await this.getProvider(providerId);
    const user = providerData ? await this.getUser(providerData.userId) : null;
    const isCompanyAccount = user?.accountType === 'company';
    
    console.log(`Verificando disponibilidade para conta ${isCompanyAccount ? 'empresa' : 'individual'}, employeeId: ${employeeId}`);
    
    // Passo 4: Seleciona todos os agendamentos para o provedor na mesma data
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
      // Use the stored endTime instead of calculating it
      const appointmentEndTime = appointment.endTime || new Date(appointmentDate.getTime() + service.duration * 60000);
      
      // Exibir mais informações de depuração
      console.log(`Verificando conflito de horários para agendamento ${appointment.id}:`);
      console.log(`- Horário solicitado: ${date.toLocaleTimeString()} - ${requestEndTime.toLocaleTimeString()}`);
      console.log(`- Agendamento existente: ${appointmentDate.toLocaleTimeString()} - ${appointmentEndTime.toLocaleTimeString()}`);
      console.log(`- Funcionário existente: ${appointment.employeeId}, Funcionário solicitado: ${employeeId}`);
      
      // Converter para objetos Date com mesmo fuso horário para comparação correta
      const startA = new Date(date);
      const endA = new Date(requestEndTime);
      const startB = new Date(appointmentDate);
      const endB = new Date(appointmentEndTime);
      
      const isPendingOrConfirmed = 
        appointment.status === AppointmentStatus.CONFIRMED || 
        appointment.status === AppointmentStatus.PENDING;
        
      // Verificar sobreposição com algoritmo simplificado:
      // Não há sobreposição se um termina antes do outro começar
      const hasOverlap = !(endA <= startB || endB <= startA);
      
      if (isPendingOrConfirmed && hasOverlap) {
        // Se for conta empresa, permitir múltiplos agendamentos no mesmo horário
        // APENAS se forem funcionários diferentes
        if (isCompanyAccount && employeeId && appointment.employeeId) {
          if (employeeId !== appointment.employeeId) {
            console.log(`Conta empresa: Permitindo agendamento no mesmo horário para funcionário diferente (${employeeId} vs ${appointment.employeeId})`);
            continue; // Não há conflito, funcionários diferentes
          } else {
            console.log(`Conta empresa: Conflito detectado - mesmo funcionário (${employeeId}) já tem agendamento no horário`);
            return false; // Mesmo funcionário já tem agendamento
          }
        } else if (isCompanyAccount && (!employeeId || !appointment.employeeId)) {
          // Se um dos agendamentos não tem funcionário atribuído, há conflito
          console.log(`Conta empresa: Conflito detectado - agendamento sem funcionário específico`);
          return false;
        } else {
          // Conta individual ou sem funcionário específico
          console.log(`Conflito detectado com agendamento ${appointment.id} (${appointmentDate.toLocaleTimeString()} - ${appointmentEndTime.toLocaleTimeString()})`);
          return false; // Não está disponível
        }
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
  
  // Métodos para TimeExclusion (Exclusões de Horário)

  // Buscar todas as exclusões de horário de um prestador
  async getTimeExclusions(providerId: number): Promise<TimeExclusion[]> {
    try {
      return await db.select()
        .from(timeExclusions)
        .where(eq(timeExclusions.providerId, providerId))
        .orderBy(timeExclusions.startTime);
    } catch (error) {
      console.error("Erro ao buscar exclusões de horário:", error);
      throw new Error("Erro ao buscar exclusões de horário");
    }
  }

  // Buscar exclusões de horário de um prestador para um dia específico da semana
  async getTimeExclusionsByDay(providerId: number, dayOfWeek: number): Promise<TimeExclusion[]> {
    try {
      return await db.select()
        .from(timeExclusions)
        .where(and(
          eq(timeExclusions.providerId, providerId),
          eq(timeExclusions.isActive, true),
          sql`(${timeExclusions.dayOfWeek} = ${dayOfWeek} OR ${timeExclusions.dayOfWeek} IS NULL)`
        ))
        .orderBy(timeExclusions.startTime);
    } catch (error) {
      console.error(`Erro ao buscar exclusões de horário para o dia ${dayOfWeek}:`, error);
      throw new Error("Erro ao buscar exclusões de horário para este dia");
    }
  }

  // Buscar uma exclusão de horário específica pelo ID
  async getTimeExclusion(id: number): Promise<TimeExclusion | undefined> {
    try {
      const [exclusion] = await db.select()
        .from(timeExclusions)
        .where(eq(timeExclusions.id, id));
      
      return exclusion;
    } catch (error) {
      console.error("Erro ao buscar exclusão de horário:", error);
      throw new Error("Erro ao buscar exclusão de horário");
    }
  }

  // Criar uma nova exclusão de horário
  async createTimeExclusion(exclusionData: InsertTimeExclusion): Promise<TimeExclusion> {
    try {
      const [newExclusion] = await db.insert(timeExclusions)
        .values(exclusionData)
        .returning();
      
      return newExclusion;
    } catch (error) {
      console.error("Erro ao criar exclusão de horário:", error);
      throw new Error("Erro ao criar exclusão de horário");
    }
  }

  // Atualizar uma exclusão de horário existente
  async updateTimeExclusion(id: number, exclusionData: Partial<InsertTimeExclusion>): Promise<TimeExclusion | undefined> {
    try {
      const [updatedExclusion] = await db.update(timeExclusions)
        .set(exclusionData)
        .where(eq(timeExclusions.id, id))
        .returning();
      
      return updatedExclusion;
    } catch (error) {
      console.error("Erro ao atualizar exclusão de horário:", error);
      throw new Error("Erro ao atualizar exclusão de horário");
    }
  }

  // Excluir uma exclusão de horário
  async deleteTimeExclusion(id: number): Promise<boolean> {
    try {
      await db.delete(timeExclusions)
        .where(eq(timeExclusions.id, id));
      
      return true;
    } catch (error) {
      console.error("Erro ao excluir exclusão de horário:", error);
      throw new Error("Erro ao excluir exclusão de horário");
    }
  }

  // Método para obter um funcionário específico
  async getEmployee(id: number): Promise<Employee | undefined> {
    try {
      const result = await db
        .select()
        .from(employees)
        .where(eq(employees.id, id))
        .limit(1);
      
      return result[0] || undefined;
    } catch (error) {
      console.error("Erro ao buscar funcionário:", error);
      throw new Error("Erro ao buscar funcionário");
    }
  }

  // Métodos para gerenciar associações entre funcionários e serviços
  async getEmployeeServices(employeeId: number): Promise<Service[]> {
    try {
      const results = await db
        .select({
          id: services.id,
          providerId: services.providerId,
          name: services.name,
          description: services.description,
          duration: services.duration,
          price: services.price,
          active: services.active
        })
        .from(employeeServices)
        .innerJoin(services, eq(employeeServices.serviceId, services.id))
        .where(eq(employeeServices.employeeId, employeeId));
      
      return results;
    } catch (error) {
      console.error("Erro ao buscar serviços do funcionário:", error);
      throw new Error("Erro ao buscar serviços do funcionário");
    }
  }

  async setEmployeeServices(employeeId: number, serviceIds: number[]): Promise<void> {
    try {
      // Remove todas as associações existentes
      await db
        .delete(employeeServices)
        .where(eq(employeeServices.employeeId, employeeId));
      
      // Adiciona as novas associações
      if (serviceIds.length > 0) {
        const associations = serviceIds.map(serviceId => ({
          employeeId,
          serviceId
        }));
        
        await db.insert(employeeServices).values(associations);
      }
    } catch (error) {
      console.error("Erro ao definir serviços do funcionário:", error);
      throw new Error("Erro ao definir serviços do funcionário");
    }
  }
}