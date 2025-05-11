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
import dotenv from 'dotenv';
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
      await localPool.query(`
        INSERT INTO users (
          id, username, password, name, email, role, 
          subscription_expiry, never_expires, verification_token, 
          verification_token_expiry, is_email_verified, created_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
        )
      `, [
        user.id,
        user.username,
        user.password,
        user.name,
        user.email,
        user.role,
        user.subscriptionExpiry,
        user.neverExpires,
        user.verificationToken,
        user.verificationTokenExpiry,
        user.isEmailVerified,
        user.createdAt
      ]);
    }
    
    // Inserir provedores
    console.log('Inserindo provedores...');
    for (const provider of data.providers) {
      await localPool.query(`
        INSERT INTO providers (
          id, user_id, name, email, phone, description, 
          timezone, working_hours, working_days, booking_link,
          active, is_blocked, created_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
        )
      `, [
        provider.id,
        provider.userId,
        provider.name,
        provider.email,
        provider.phone,
        provider.description,
        provider.timezone,
        provider.workingHours,
        provider.workingDays,
        provider.bookingLink,
        provider.active,
        provider.isBlocked,
        provider.createdAt
      ]);
    }
    
    // Inserir clientes
    console.log('Inserindo clientes...');
    for (const client of data.clients) {
      await localPool.query(`
        INSERT INTO clients (
          id, name, phone, email, notes, created_at, is_active
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7
        )
      `, [
        client.id,
        client.name,
        client.phone,
        client.email,
        client.notes,
        client.createdAt,
        client.isActive
      ]);
    }
    
    // Inserir associações provedor-cliente
    console.log('Inserindo associações provedor-cliente...');
    for (const pc of data.providerClients) {
      await localPool.query(`
        INSERT INTO provider_clients (
          id, provider_id, client_id, created_at
        ) VALUES (
          $1, $2, $3, $4
        )
      `, [
        pc.id,
        pc.providerId,
        pc.clientId,
        pc.createdAt
      ]);
    }
    
    // Inserir serviços
    console.log('Inserindo serviços...');
    for (const service of data.services) {
      await localPool.query(`
        INSERT INTO services (
          id, provider_id, name, description, duration, 
          price, color, created_at, is_active
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9
        )
      `, [
        service.id,
        service.providerId,
        service.name,
        service.description,
        service.duration,
        service.price,
        service.color,
        service.createdAt,
        service.isActive
      ]);
    }
    
    // Inserir agendamentos
    console.log('Inserindo agendamentos...');
    for (const appointment of data.appointments) {
      await localPool.query(`
        INSERT INTO appointments (
          id, provider_id, client_id, service_id, date, 
          end_time, status, notes, cancellation_reason, created_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
        )
      `, [
        appointment.id,
        appointment.providerId,
        appointment.clientId,
        appointment.serviceId,
        appointment.date,
        appointment.endTime,
        appointment.status,
        appointment.notes,
        appointment.cancellationReason,
        appointment.createdAt
      ]);
    }
    
    // Inserir notificações
    console.log('Inserindo notificações...');
    for (const notification of data.notifications) {
      await localPool.query(`
        INSERT INTO notifications (
          id, user_id, title, message, type, 
          is_read, appointment_id, created_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8
        )
      `, [
        notification.id,
        notification.userId,
        notification.title,
        notification.message,
        notification.type,
        notification.isRead,
        notification.appointmentId,
        notification.createdAt
      ]);
    }
    
    // Inserir exclusões de horário
    console.log('Inserindo exclusões de horário...');
    for (const exclusion of data.timeExclusions) {
      await localPool.query(`
        INSERT INTO time_exclusions (
          id, provider_id, day_of_week, start_time, 
          end_time, recurring, created_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7
        )
      `, [
        exclusion.id,
        exclusion.providerId,
        exclusion.dayOfWeek,
        exclusion.startTime,
        exclusion.endTime,
        exclusion.recurring,
        exclusion.createdAt
      ]);
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
  const adminResult = await localPool.query(`SELECT * FROM users WHERE username = 'admin'`);
  const linkResult = await localPool.query(`SELECT * FROM users WHERE username = 'link'`);
  
  if (adminResult.rows.length === 0) {
    console.log('Criando usuário admin...');
    const hashedPassword = await hashPassword('password123');
    
    // Inserir usuário admin
    const adminInsertResult = await localPool.query(`
      INSERT INTO users (
        username, password, name, email, role, 
        never_expires, is_email_verified, created_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8
      ) RETURNING *
    `, [
      'admin',
      hashedPassword,
      'Administrador',
      'admin@example.com',
      'admin',
      true,
      true,
      new Date()
    ]);
    
    const admin = adminInsertResult.rows[0];
    
    // Criar provedor para o admin
    await localPool.query(`
      INSERT INTO providers (
        user_id, name, email, phone, description, 
        working_hours, working_days, booking_link, active, created_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
      )
    `, [
      admin.id,
      'Administrador',
      'admin@example.com',
      '11999999999',
      'Administrador do sistema',
      JSON.stringify({
        '0': [], // Domingo
        '1': [{'start': '09:00', 'end': '18:00'}], // Segunda
        '2': [{'start': '09:00', 'end': '18:00'}], // Terça
        '3': [{'start': '09:00', 'end': '18:00'}], // Quarta
        '4': [{'start': '09:00', 'end': '18:00'}], // Quinta
        '5': [{'start': '09:00', 'end': '18:00'}], // Sexta
        '6': [] // Sábado
      }),
      '1,2,3,4,5',
      'admin',
      true,
      new Date()
    ]);
    
    console.log('Usuário admin criado com sucesso!');
  }
  
  if (linkResult.rows.length === 0) {
    console.log('Criando usuário link...');
    const hashedPassword = await hashPassword('password123');
    
    // Inserir usuário link
    const linkInsertResult = await localPool.query(`
      INSERT INTO users (
        username, password, name, email, role, 
        never_expires, is_email_verified, subscription_expiry, created_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9
      ) RETURNING *
    `, [
      'link',
      hashedPassword,
      'Lincoln',
      'link@example.com',
      'user',
      false,
      true,
      new Date(Date.now() + 1000 * 60 * 60 * 24 * 90), // 90 dias
      new Date()
    ]);
    
    const link = linkInsertResult.rows[0];
    
    // Criar provedor para o link
    const providerInsertResult = await localPool.query(`
      INSERT INTO providers (
        user_id, name, email, phone, description, 
        working_hours, working_days, booking_link, active, created_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
      ) RETURNING *
    `, [
      link.id,
      'Lincoln',
      'link@example.com',
      '11987654321',
      'Provedor de serviços',
      JSON.stringify({
        '0': [], // Domingo
        '1': [{'start': '09:00', 'end': '18:00'}], // Segunda
        '2': [{'start': '09:00', 'end': '18:00'}], // Terça
        '3': [{'start': '09:00', 'end': '18:00'}], // Quarta
        '4': [{'start': '09:00', 'end': '18:00'}], // Quinta
        '5': [{'start': '09:00', 'end': '18:00'}], // Sexta
        '6': [] // Sábado
      }),
      '1,2,3,4,5',
      'link',
      true,
      new Date()
    ]);
    
    const provider = providerInsertResult.rows[0];
    
    // Criar um serviço de exemplo para o link
    await localPool.query(`
      INSERT INTO services (
        provider_id, name, description, duration, 
        price, color, is_active, created_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8
      )
    `, [
      provider.id,
      'Serviço de Exemplo',
      'Este é um serviço de exemplo',
      60,
      10000, // R$ 100,00
      '#4f46e5',
      true,
      new Date()
    ]);
    
    console.log('Usuário link criado com sucesso!');
  }
}

// Executar a migração
migrateToLocalDb();