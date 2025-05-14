// Arquivo para criar tabelas no banco de dados
import { pgTable, serial, text, timestamp, boolean, integer, primaryKey, varchar, unique } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// Função para criar as tabelas no banco de dados
export async function createTables(db) {
  console.log('Iniciando criação de tabelas...');

  try {
    // Usuários
    const users = pgTable('users', {
      id: serial('id').primaryKey(),
      name: text('name').notNull(),
      username: text('username').notNull().unique(),
      password: text('password').notNull(),
      email: text('email'),
      role: text('role').default('user').notNull(),
      createdAt: timestamp('created_at').defaultNow().notNull(),
      updatedAt: timestamp('updated_at').defaultNow().notNull(),
      verified: boolean('verified').default(false),
      verificationToken: text('verification_token'),
      avatarUrl: text('avatar_url'),
    });

    // Prestadores de serviço
    const providers = pgTable('providers', {
      id: serial('id').primaryKey(),
      userId: integer('user_id').references(() => users.id).notNull(),
      name: text('name').notNull(),
      description: text('description'),
      phone: text('phone'),
      bookingLink: text('booking_link'),
      linkId: text('link_id'),
      createdAt: timestamp('created_at').defaultNow().notNull(),
      updatedAt: timestamp('updated_at').defaultNow().notNull(),
    });

    // Serviços
    const services = pgTable('services', {
      id: serial('id').primaryKey(),
      providerId: integer('provider_id').references(() => providers.id).notNull(),
      name: text('name').notNull(),
      description: text('description'),
      duration: integer('duration').notNull(),
      price: integer('price').notNull(),
      active: boolean('active').default(true).notNull(),
      createdAt: timestamp('created_at').defaultNow().notNull(),
      updatedAt: timestamp('updated_at').defaultNow().notNull(),
    });

    // Clientes
    const clients = pgTable('clients', {
      id: serial('id').primaryKey(),
      name: text('name').notNull(),
      email: text('email'),
      phone: text('phone').notNull(),
      createdAt: timestamp('created_at').defaultNow().notNull(),
      updatedAt: timestamp('updated_at').defaultNow().notNull(),
    });

    // Relação entre prestadores e clientes
    const providerClients = pgTable('provider_clients', {
      id: serial('id').primaryKey(),
      providerId: integer('provider_id').references(() => providers.id).notNull(),
      clientId: integer('client_id').references(() => clients.id).notNull(),
      createdAt: timestamp('created_at').defaultNow().notNull(),
      updatedAt: timestamp('updated_at').defaultNow().notNull(),
    });

    // Agendamentos
    const appointments = pgTable('appointments', {
      id: serial('id').primaryKey(),
      providerId: integer('provider_id').references(() => providers.id).notNull(),
      clientId: integer('client_id').references(() => clients.id).notNull(),
      serviceId: integer('service_id').references(() => services.id).notNull(),
      date: timestamp('date').notNull(),
      status: text('status').default('pending').notNull(),
      notes: text('notes'),
      paymentStatus: text('payment_status').default('pending'),
      paymentMethod: text('payment_method'),
      paymentToken: text('payment_token'),
      createdAt: timestamp('created_at').defaultNow().notNull(),
      updatedAt: timestamp('updated_at').defaultNow().notNull(),
    });

    // Notificações
    const notifications = pgTable('notifications', {
      id: serial('id').primaryKey(),
      userId: integer('user_id').references(() => users.id).notNull(),
      title: text('title').notNull(),
      message: text('message').notNull(),
      read: boolean('read').default(false).notNull(),
      type: text('type').default('info'),
      link: text('link'),
      createdAt: timestamp('created_at').defaultNow().notNull(),
    });

    // Exclusões de horário
    const timeExclusions = pgTable('time_exclusions', {
      id: serial('id').primaryKey(),
      providerId: integer('provider_id').references(() => providers.id).notNull(),
      startDate: timestamp('start_date').notNull(),
      endDate: timestamp('end_date').notNull(),
      reason: text('reason'),
      createdAt: timestamp('created_at').defaultNow().notNull(),
      updatedAt: timestamp('updated_at').defaultNow().notNull(),
    });

    // Planos de assinatura
    const subscriptionPlans = pgTable('subscription_plans', {
      id: serial('id').primaryKey(),
      name: text('name').notNull(),
      description: text('description'),
      price: integer('price').notNull(),
      durationMonths: integer('duration_months').notNull(),
      isActive: boolean('is_active').default(true).notNull(),
      createdAt: timestamp('created_at').defaultNow().notNull(),
      updatedAt: timestamp('updated_at').defaultNow().notNull(),
    });

    // Transações de assinatura
    const subscriptionTransactions = pgTable('subscription_transactions', {
      id: serial('id').primaryKey(),
      userId: integer('user_id').references(() => users.id).notNull(),
      planId: integer('plan_id').references(() => subscriptionPlans.id).notNull(),
      status: text('status').default('pending').notNull(),
      paymentMethod: text('payment_method'),
      paymentToken: text('payment_token'),
      startDate: timestamp('start_date'),
      endDate: timestamp('end_date'),
      createdAt: timestamp('created_at').defaultNow().notNull(),
      updatedAt: timestamp('updated_at').defaultNow().notNull(),
    });

    // Criar as tabelas no banco de dados
    console.log('Criando tabela users...');
    await db.execute(sql`CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      email TEXT,
      role TEXT NOT NULL DEFAULT 'user',
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
      verified BOOLEAN DEFAULT FALSE,
      verification_token TEXT,
      avatar_url TEXT
    )`);

    console.log('Criando tabela providers...');
    await db.execute(sql`CREATE TABLE IF NOT EXISTS providers (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      name TEXT NOT NULL,
      description TEXT,
      phone TEXT,
      booking_link TEXT,
      link_id TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )`);

    console.log('Criando tabela services...');
    await db.execute(sql`CREATE TABLE IF NOT EXISTS services (
      id SERIAL PRIMARY KEY,
      provider_id INTEGER NOT NULL REFERENCES providers(id),
      name TEXT NOT NULL,
      description TEXT,
      duration INTEGER NOT NULL,
      price INTEGER NOT NULL,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )`);

    console.log('Criando tabela clients...');
    await db.execute(sql`CREATE TABLE IF NOT EXISTS clients (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )`);

    console.log('Criando tabela provider_clients...');
    await db.execute(sql`CREATE TABLE IF NOT EXISTS provider_clients (
      id SERIAL PRIMARY KEY,
      provider_id INTEGER NOT NULL REFERENCES providers(id),
      client_id INTEGER NOT NULL REFERENCES clients(id),
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )`);

    console.log('Criando tabela appointments...');
    await db.execute(sql`CREATE TABLE IF NOT EXISTS appointments (
      id SERIAL PRIMARY KEY,
      provider_id INTEGER NOT NULL REFERENCES providers(id),
      client_id INTEGER NOT NULL REFERENCES clients(id),
      service_id INTEGER NOT NULL REFERENCES services(id),
      date TIMESTAMP NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      notes TEXT,
      payment_status TEXT DEFAULT 'pending',
      payment_method TEXT,
      payment_token TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )`);

    console.log('Criando tabela notifications...');
    await db.execute(sql`CREATE TABLE IF NOT EXISTS notifications (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      read BOOLEAN NOT NULL DEFAULT FALSE,
      type TEXT DEFAULT 'info',
      link TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )`);

    console.log('Criando tabela time_exclusions...');
    await db.execute(sql`CREATE TABLE IF NOT EXISTS time_exclusions (
      id SERIAL PRIMARY KEY,
      provider_id INTEGER NOT NULL REFERENCES providers(id),
      start_date TIMESTAMP NOT NULL,
      end_date TIMESTAMP NOT NULL,
      reason TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )`);

    console.log('Criando tabela subscription_plans...');
    await db.execute(sql`CREATE TABLE IF NOT EXISTS subscription_plans (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      price INTEGER NOT NULL,
      duration_months INTEGER NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )`);

    console.log('Criando tabela subscription_transactions...');
    await db.execute(sql`CREATE TABLE IF NOT EXISTS subscription_transactions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      plan_id INTEGER NOT NULL REFERENCES subscription_plans(id),
      status TEXT NOT NULL DEFAULT 'pending',
      payment_method TEXT,
      payment_token TEXT,
      start_date TIMESTAMP,
      end_date TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )`);

    // Criar usuário admin padrão
    console.log('Verificando se usuário admin existe...');
    const adminExists = await db.execute(sql`SELECT * FROM users WHERE username = 'admin'`);
    
    if (adminExists.rowCount === 0) {
      console.log('Criando usuário admin padrão...');
      // Senha: admin123 (hash bcrypt)
      const adminPasswordHash = '$2b$10$3euPcmQFCiblsZeEu5s7p.9MQtWire4Vq5/MfVVr.fY4Q1QVjbE4W';
      await db.execute(sql`
        INSERT INTO users (name, username, password, role, verified)
        VALUES ('Administrador', 'admin', ${adminPasswordHash}, 'admin', TRUE)
      `);
      
      // Criar provider para o admin
      const adminUser = await db.execute(sql`SELECT id FROM users WHERE username = 'admin'`);
      if (adminUser.rowCount > 0) {
        const adminId = adminUser.rows[0].id;
        await db.execute(sql`
          INSERT INTO providers (user_id, name, booking_link, link_id)
          VALUES (${adminId}, 'Administrador', '/booking/admin', 'admin')
        `);
      }
    }

    console.log('Todas as tabelas criadas com sucesso!');
    return { success: true };
  } catch (error) {
    console.error('Erro ao criar tabelas:', error);
    throw error;
  }
}
