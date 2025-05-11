/**
 * Script para migrar os dados do banco atual para um banco PostgreSQL local
 * 
 * Este script:
 * 1. Extrai todos os dados do banco de dados atual (Neon ou outro)
 * 2. Cria as tabelas necessárias em um banco PostgreSQL local
 * 3. Insere os dados extraídos no banco local
 * 
 * Pré-requisitos:
 * - PostgreSQL instalado localmente
 * - Banco de dados chamado "agendadb" já criado (ou altere o nome abaixo)
 * - Variáveis de ambiente configuradas (ou configure o objeto localDbConfig abaixo)
 * 
 * Uso:
 * $ npx tsx scripts/migrate-to-local-db.ts
 */

import { Pool } from 'pg';
import * as schema from '../shared/schema';
import { db } from '../server/db';
import { eq, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as dotenv from 'dotenv';
import { hashPassword } from '../server/auth';
import { closeDb } from '../server/db';

// Carregar variáveis de ambiente
dotenv.config();

// Configuração do banco de dados local
// Você pode alterar esses valores conforme necessário
const localDbConfig = {
  host: process.env.LOCAL_DB_HOST || 'localhost',
  port: parseInt(process.env.LOCAL_DB_PORT || '5432'),
  database: process.env.LOCAL_DB_NAME || 'agendadb',
  user: process.env.LOCAL_DB_USER || 'postgres',
  password: process.env.LOCAL_DB_PASSWORD || 'postgres'
};

// Criar pool de conexão para o banco local
const localPool = new Pool(localDbConfig);
const localDb = drizzle(localPool, { schema });

// Função para extrair todos os dados do banco atual
async function extractData() {
  console.log('Extraindo dados do banco atual...');
  
  const users = await db.select().from(schema.users);
  console.log(`Extraídos ${users.length} usuários`);
  
  const providers = await db.select().from(schema.providers);
  console.log(`Extraídos ${providers.length} provedores`);
  
  const clients = await db.select().from(schema.clients);
  console.log(`Extraídos ${clients.length} clientes`);
  
  const providerClients = await db.select().from(schema.providerClients);
  console.log(`Extraídas ${providerClients.length} associações provedor-cliente`);
  
  const services = await db.select().from(schema.services);
  console.log(`Extraídos ${services.length} serviços`);
  
  const appointments = await db.select().from(schema.appointments);
  console.log(`Extraídos ${appointments.length} agendamentos`);
  
  const notifications = await db.select().from(schema.notifications);
  console.log(`Extraídas ${notifications.length} notificações`);
  
  const timeExclusions = await db.select().from(schema.timeExclusions);
  console.log(`Extraídas ${timeExclusions.length} exclusões de horário`);
  
  return {
    users,
    providers,
    clients,
    providerClients,
    services,
    appointments,
    notifications,
    timeExclusions
  };
}

// Função para criar as tabelas no banco local
async function createTables() {
  console.log('Criando tabelas no banco local...');
  
  try {
    // Verificar se as tabelas já existem
    const tablesExist = await localPool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    
    if (tablesExist.rows.length > 0) {
      console.log('Tabelas já existem no banco local. Realizando limpeza...');
      
      // Desativar verificações de chave estrangeira temporariamente
      await localPool.query('SET session_replication_role = replica;');
      
      // Limpar todas as tabelas existentes
      await localPool.query(`TRUNCATE TABLE 
        users, providers, clients, provider_clients, 
        services, appointments, notifications, time_exclusions
        CASCADE;`);
      
      // Reativar verificações de chave estrangeira
      await localPool.query('SET session_replication_role = DEFAULT;');
      
      console.log('Limpeza concluída.');
    } else {
      console.log('Criando esquema do banco de dados...');
      
      // Aplicar o esquema de migração usando drizzle-kit
      await localPool.query(`
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          username VARCHAR(255) NOT NULL,
          password VARCHAR(255) NOT NULL,
          name VARCHAR(255) NOT NULL,
          email VARCHAR(255),
          role VARCHAR(50) DEFAULT 'user' NOT NULL,
          subscription_expiry TIMESTAMP,
          never_expires BOOLEAN DEFAULT FALSE,
          verification_token VARCHAR(255),
          verification_token_expiry TIMESTAMP,
          is_email_verified BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
        );
        
        CREATE TABLE IF NOT EXISTS providers (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          name VARCHAR(255) NOT NULL,
          email VARCHAR(255),
          phone VARCHAR(50),
          description TEXT,
          timezone VARCHAR(50) DEFAULT 'America/Sao_Paulo',
          working_hours VARCHAR(255) DEFAULT '09:00-18:00',
          working_days VARCHAR(50) DEFAULT '1,2,3,4,5',
          booking_link VARCHAR(255),
          active BOOLEAN DEFAULT TRUE,
          is_blocked BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
        );
        
        CREATE TABLE IF NOT EXISTS clients (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          phone VARCHAR(50) NOT NULL,
          email VARCHAR(255),
          notes TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
          is_active BOOLEAN DEFAULT TRUE
        );
        
        CREATE TABLE IF NOT EXISTS provider_clients (
          id SERIAL PRIMARY KEY,
          provider_id INTEGER NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
          client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
        );
        
        CREATE TABLE IF NOT EXISTS services (
          id SERIAL PRIMARY KEY,
          provider_id INTEGER NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
          name VARCHAR(255) NOT NULL,
          description TEXT,
          duration INTEGER NOT NULL,
          price INTEGER NOT NULL,
          color VARCHAR(50),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
          is_active BOOLEAN DEFAULT TRUE
        );
        
        CREATE TABLE IF NOT EXISTS appointments (
          id SERIAL PRIMARY KEY,
          provider_id INTEGER NOT NULL REFERENCES providers(id),
          client_id INTEGER NOT NULL REFERENCES clients(id),
          service_id INTEGER NOT NULL REFERENCES services(id),
          date TIMESTAMP NOT NULL,
          end_time TIMESTAMP NOT NULL,
          status VARCHAR(50) DEFAULT 'pending' NOT NULL,
          notes TEXT,
          cancellation_reason TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
        );
        
        CREATE TABLE IF NOT EXISTS notifications (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          title VARCHAR(255) NOT NULL,
          message TEXT NOT NULL,
          type VARCHAR(50) NOT NULL,
          is_read BOOLEAN DEFAULT FALSE,
          appointment_id INTEGER REFERENCES appointments(id) ON DELETE SET NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
        );
        
        CREATE TABLE IF NOT EXISTS time_exclusions (
          id SERIAL PRIMARY KEY,
          provider_id INTEGER NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
          day_of_week INTEGER,
          start_time TIME NOT NULL,
          end_time TIME NOT NULL,
          recurring BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
        );
      `);
      
      console.log('Esquema do banco de dados criado com sucesso.');
    }
  } catch (error) {
    console.error('Erro ao criar tabelas:', error);
    throw error;
  }
}

// Função para inserir os dados no banco local
async function insertData(data: any) {
  console.log('Inserindo dados no banco local...');
  
  // Desativar verificações de chave estrangeira temporariamente
  await localPool.query('SET session_replication_role = replica;');
  
  try {
    // Inserir usuários
    console.log('Inserindo usuários...');
    for (const user of data.users) {
      await localDb.insert(schema.users).values({
        id: user.id, // Preservar os IDs originais
        username: user.username,
        password: user.password,
        name: user.name,
        email: user.email,
        role: user.role,
        subscriptionExpiry: user.subscriptionExpiry,
        neverExpires: user.neverExpires,
        verificationToken: user.verificationToken,
        verificationTokenExpiry: user.verificationTokenExpiry,
        isEmailVerified: user.isEmailVerified,
        createdAt: user.createdAt
      });
    }
    
    // Inserir provedores
    console.log('Inserindo provedores...');
    for (const provider of data.providers) {
      await localDb.insert(schema.providers).values({
        id: provider.id,
        userId: provider.userId,
        name: provider.name,
        email: provider.email,
        phone: provider.phone,
        description: provider.description,
        timezone: provider.timezone,
        workingHours: provider.workingHours,
        workingDays: provider.workingDays,
        bookingLink: provider.bookingLink,
        active: provider.active,
        isBlocked: provider.isBlocked,
        createdAt: provider.createdAt
      });
    }
    
    // Inserir clientes
    console.log('Inserindo clientes...');
    for (const client of data.clients) {
      await localDb.insert(schema.clients).values({
        id: client.id,
        name: client.name,
        phone: client.phone,
        email: client.email,
        notes: client.notes,
        createdAt: client.createdAt,
        isActive: client.isActive
      });
    }
    
    // Inserir associações provedor-cliente
    console.log('Inserindo associações provedor-cliente...');
    for (const pc of data.providerClients) {
      await localDb.insert(schema.providerClients).values({
        id: pc.id,
        providerId: pc.providerId,
        clientId: pc.clientId,
        createdAt: pc.createdAt
      });
    }
    
    // Inserir serviços
    console.log('Inserindo serviços...');
    for (const service of data.services) {
      await localDb.insert(schema.services).values({
        id: service.id,
        providerId: service.providerId,
        name: service.name,
        description: service.description,
        duration: service.duration,
        price: service.price,
        color: service.color,
        createdAt: service.createdAt,
        isActive: service.isActive
      });
    }
    
    // Inserir agendamentos
    console.log('Inserindo agendamentos...');
    for (const appointment of data.appointments) {
      await localDb.insert(schema.appointments).values({
        id: appointment.id,
        providerId: appointment.providerId,
        clientId: appointment.clientId,
        serviceId: appointment.serviceId,
        date: appointment.date,
        endTime: appointment.endTime,
        status: appointment.status,
        notes: appointment.notes,
        cancellationReason: appointment.cancellationReason,
        createdAt: appointment.createdAt
      });
    }
    
    // Inserir notificações
    console.log('Inserindo notificações...');
    for (const notification of data.notifications) {
      await localDb.insert(schema.notifications).values({
        id: notification.id,
        userId: notification.userId,
        title: notification.title,
        message: notification.message,
        type: notification.type,
        isRead: notification.isRead,
        appointmentId: notification.appointmentId,
        createdAt: notification.createdAt
      });
    }
    
    // Inserir exclusões de horário
    console.log('Inserindo exclusões de horário...');
    for (const exclusion of data.timeExclusions) {
      await localDb.insert(schema.timeExclusions).values({
        id: exclusion.id,
        providerId: exclusion.providerId,
        dayOfWeek: exclusion.dayOfWeek,
        startTime: exclusion.startTime,
        endTime: exclusion.endTime,
        recurring: exclusion.recurring,
        createdAt: exclusion.createdAt
      });
    }
    
    // Atualizar as sequências
    await updateSequences();
    
  } catch (error) {
    console.error('Erro ao inserir dados:', error);
    throw error;
  } finally {
    // Reativar verificações de chave estrangeira
    await localPool.query('SET session_replication_role = DEFAULT;');
  }
  
  console.log('Dados inseridos com sucesso!');
}

// Função para atualizar as sequências após a inserção de dados
async function updateSequences() {
  console.log('Atualizando sequências de ID...');
  
  const tables = [
    'users', 'providers', 'clients', 'provider_clients', 
    'services', 'appointments', 'notifications', 'time_exclusions'
  ];
  
  for (const table of tables) {
    await localPool.query(`
      SELECT setval(pg_get_serial_sequence('${table}', 'id'), 
        (SELECT MAX(id) FROM ${table}), true);
    `);
  }
  
  console.log('Sequências atualizadas.');
}

// Função principal
async function migrateToLocalDb() {
  console.log('Iniciando migração para banco de dados local...');
  
  try {
    // Extrair dados do banco atual
    const data = await extractData();
    
    // Criar tabelas no banco local
    await createTables();
    
    // Inserir dados extraídos no banco local
    await insertData(data);
    
    // Configuração de credenciais padrão para desenvolvimento
    console.log('Criando credenciais de teste, se não existirem...');
    await createTestCredentials();
    
    console.log('\n✅ Migração concluída com sucesso!');
    console.log(`\nBanco de dados local configurado em: ${localDbConfig.host}:${localDbConfig.port}/${localDbConfig.database}`);
    console.log('\nCredenciais de acesso:');
    console.log('- Usuário Admin: admin / password123');
    console.log('- Usuário Link: link / password123');
    
    console.log('\nPara usar o banco local, atualize suas variáveis de ambiente:');
    console.log(`DATABASE_URL=postgres://${localDbConfig.user}:${localDbConfig.password}@${localDbConfig.host}:${localDbConfig.port}/${localDbConfig.database}`);
    
  } catch (error) {
    console.error('Erro durante a migração:', error);
  } finally {
    // Fechar conexões
    await closeDb();
    await localPool.end();
  }
}

// Função para criar credenciais de teste se não existirem
async function createTestCredentials() {
  // Verificar se os usuários admin e link já existem
  const adminExists = await localDb.select().from(schema.users).where(eq(schema.users.username, 'admin'));
  const linkExists = await localDb.select().from(schema.users).where(eq(schema.users.username, 'link'));
  
  if (adminExists.length === 0) {
    console.log('Criando usuário admin...');
    const hashedPassword = await hashPassword('password123');
    
    // Inserir usuário admin
    const [admin] = await localDb.insert(schema.users).values({
      username: 'admin',
      password: hashedPassword,
      name: 'Administrador',
      email: 'admin@example.com',
      role: 'admin',
      neverExpires: true,
      isEmailVerified: true
    }).returning();
    
    // Criar provedor para o admin
    await localDb.insert(schema.providers).values({
      userId: admin.id,
      name: 'Administrador',
      email: 'admin@example.com',
      phone: '11999999999',
      description: 'Administrador do sistema',
      workingHours: '09:00-18:00',
      workingDays: '1,2,3,4,5',
      bookingLink: 'admin'
    });
    
    console.log('Usuário admin criado com sucesso!');
  }
  
  if (linkExists.length === 0) {
    console.log('Criando usuário link...');
    const hashedPassword = await hashPassword('password123');
    
    // Inserir usuário link
    const [link] = await localDb.insert(schema.users).values({
      username: 'link',
      password: hashedPassword,
      name: 'Lincoln',
      email: 'link@example.com',
      role: 'user',
      neverExpires: false,
      isEmailVerified: true,
      subscriptionExpiry: new Date(Date.now() + 1000 * 60 * 60 * 24 * 90) // 90 dias
    }).returning();
    
    // Criar provedor para o link
    const [provider] = await localDb.insert(schema.providers).values({
      userId: link.id,
      name: 'Lincoln',
      email: 'link@example.com',
      phone: '11987654321',
      description: 'Provedor de serviços',
      workingHours: '09:00-18:00',
      workingDays: '1,2,3,4,5',
      bookingLink: 'link'
    }).returning();
    
    // Criar um serviço de exemplo para o link
    await localDb.insert(schema.services).values({
      providerId: provider.id,
      name: 'Serviço de Exemplo',
      description: 'Este é um serviço de exemplo',
      duration: 60,
      price: 10000, // R$ 100,00
      color: '#4f46e5',
      isActive: true
    });
    
    console.log('Usuário link criado com sucesso!');
  }
}

// Executar a migração
migrateToLocalDb();