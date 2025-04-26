import { drizzle } from 'drizzle-orm/neon-serverless';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
import * as schema from '../shared/schema';

// Configuração para WebSockets
neonConfig.webSocketConstructor = ws;

async function setupDatabase() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  console.log('Conectando ao banco de dados...');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool, { schema });

  console.log('Criando tabelas no banco de dados...');
  try {
    // Criar o enum de status de agendamento se não existir
    await db.execute(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'appointment_status') THEN
          CREATE TYPE appointment_status AS ENUM ('pending', 'confirmed', 'cancelled', 'completed');
        END IF;
      END $$;
    `);
    
    // Criar extensão UUID se não existir
    await db.execute(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);
    
    // Criar tabelas
    await db.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        username TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'provider',
        avatar_url TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      
      CREATE UNIQUE INDEX IF NOT EXISTS username_idx ON users (username);
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS providers (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        phone TEXT,
        booking_link TEXT UNIQUE,
        avatar_url TEXT,
        working_hours_start INTEGER DEFAULT 8,
        working_hours_end INTEGER DEFAULT 18,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS services (
        id SERIAL PRIMARY KEY,
        provider_id INTEGER NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        description TEXT,
        duration INTEGER NOT NULL,
        price INTEGER NOT NULL,
        active BOOLEAN NOT NULL DEFAULT TRUE
      );
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS clients (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        phone TEXT NOT NULL,
        email TEXT,
        notes TEXT,
        active BOOLEAN NOT NULL DEFAULT TRUE
      );
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS appointments (
        id SERIAL PRIMARY KEY,
        provider_id INTEGER NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
        client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
        service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
        date TIMESTAMP NOT NULL,
        end_time TIMESTAMP NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        notes TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    
    await db.execute(`
      CREATE TABLE IF NOT EXISTS provider_clients (
        id SERIAL PRIMARY KEY,
        provider_id INTEGER NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
        client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'appointment',
        is_read BOOLEAN NOT NULL DEFAULT FALSE,
        appointment_id INTEGER REFERENCES appointments(id) ON DELETE SET NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    console.log('Tabelas criadas com sucesso!');

    // Criar usuário admin padrão se não existir
    await db.execute(`
      INSERT INTO users (name, username, password, role)
      VALUES ('Admin', 'admin', '$2b$10$5QCy5vy6nMpxqjhPnljcPuuDn3S1.KlQ/vykHnP1MZx95Sy9/rHfS', 'admin')
      ON CONFLICT (username) DO NOTHING;
    `);

    console.log('Usuário admin criado com sucesso! (admin/password123)');

    // Criar usuário de teste e prestador de serviço (se não existirem)
    await db.execute(`
      INSERT INTO users (name, username, password, role)
      VALUES ('Link Beauty', 'link', '$2b$10$5QCy5vy6nMpxqjhPnljcPuuDn3S1.KlQ/vykHnP1MZx95Sy9/rHfS', 'provider')
      ON CONFLICT (username) DO NOTHING
      RETURNING id;
    `);

    // Obter o ID do usuário 'link'
    const result = await db.execute(`
      SELECT id FROM users WHERE username = 'link'
    `);
    const linkUser = result.rows && result.rows[0] ? (result.rows[0] as { id: number }) : null;

    if (linkUser && linkUser.id) {
      await db.execute(`
        INSERT INTO providers (user_id, name, email, booking_link)
        VALUES (${linkUser.id}, 'Link Beauty Salon', 'link@example.com', 'linkbeauty')
        ON CONFLICT (user_id) DO NOTHING;
      `);
      
      console.log('Usuário link e prestador criados com sucesso! (link/password123)');
    }

    console.log('Banco de dados configurado com sucesso!');
  } catch (error) {
    console.error('Erro ao configurar banco de dados:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

setupDatabase();