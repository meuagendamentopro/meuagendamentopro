import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { drizzle as drizzleNode } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
import ws from 'ws';
import * as schema from '@shared/schema';

// Configuração para WebSockets
neonConfig.webSocketConstructor = ws;

// Verifica se a URL do banco de dados está definida
if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL deve ser definida. Você esqueceu de provisionar um banco de dados?"
  );
}

// Cria o pool de conexão
export const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Exporta a instância do Drizzle ORM
export const db = drizzle(pool, { schema });

// Configuração para queries com relacionamentos
export const dbWithQueries = {
  ...db,
  query: {
    subscriptionTransactions: {
      findMany: async (options: {
        where?: any;
        with?: Record<string, boolean>;
        orderBy?: any[];
      } = {}) => {
        const { where, with: withRelations, orderBy } = options;
        
        let query = db.select()
          .from(schema.subscriptionTransactions);
        
        if (where) {
          query = query.where(where);
        }
        
        if (orderBy && orderBy.length > 0) {
          query = query.orderBy(...orderBy);
        }
        
        const transactions = await query;
        
        if (withRelations?.plan) {
          // Buscar planos relacionados
          for (const transaction of transactions) {
            const [plan] = await db.select()
              .from(schema.subscriptionPlans)
              .where(sql`${schema.subscriptionPlans.id} = ${transaction.planId}`);
            
            if (plan) {
              (transaction as any).plan = plan;
            }
          }
        }
        
        return transactions;
      }
    }
  }
};

// Função de limpeza para encerrar o pool quando o servidor for desligado
export async function closeDb() {
  await pool.end();
}