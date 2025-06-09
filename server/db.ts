import pg from 'pg';
const { Pool } = pg;
import { drizzle } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
import * as schema from '@shared/schema';
import { localConfig } from './local-config';

// Usa a URL do banco de dados do ambiente ou da configuração local
const databaseUrl = process.env.DATABASE_URL || (process.env.NODE_ENV === 'development' ? localConfig.database.url : null);

// Verifica se a URL do banco de dados está definida
if (!databaseUrl) {
  console.error('DATABASE_URL não está definida!');
  console.error('Ambiente:', process.env.NODE_ENV);
  console.error('Variáveis disponíveis:', Object.keys(process.env).filter(key => key.includes('DATABASE')));
  throw new Error(
    "DATABASE_URL deve ser definida. Você esqueceu de provisionar um banco de dados?"
  );
}

console.log('Inicializando conexão com PostgreSQL usando pg standard driver');
console.log(`URL do banco de dados: ${databaseUrl}`);

// Cria o pool de conexão usando o driver pg padrão
export const pool = new Pool({ connectionString: databaseUrl });

// Testa a conexão
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('ERRO AO CONECTAR AO POSTGRESQL:', err);
  } else {
    console.log('CONEXÃO COM POSTGRESQL BEM-SUCEDIDA! Timestamp:', res.rows[0].now);
  }
});

// Exporta a instância do Drizzle ORM usando o driver node-postgres
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
          // @ts-ignore - Ignorar erro de tipagem do Drizzle ORM
          query = query.where(where);
        }
        
        if (orderBy && orderBy.length > 0) {
          // @ts-ignore - Ignorar erro de tipagem do Drizzle ORM
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