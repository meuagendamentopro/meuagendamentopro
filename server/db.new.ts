import * as schema from '@shared/schema';

// Configurações e variáveis de banco de dados
let db: any;
let pool: any;
let sqlite: any;

// Determinar qual tipo de banco de dados usar (PostgreSQL ou SQLite)
const dbType = process.env.DATABASE_TYPE || 'postgres';
console.log(`Tipo de banco de dados: ${dbType}`);

if (dbType === 'sqlite') {
  // Configuração SQLite
  console.log('Usando SQLite como banco de dados');
  import('better-sqlite3').then((betterSqlite3) => {
    const Database = betterSqlite3.default;
    import('drizzle-orm/better-sqlite3').then(({ drizzle }) => {
      import('path').then((path) => {
        import('fs').then((fs) => {
          // Garante que o diretório de dados existe
          const DATA_DIR = path.join(process.cwd(), 'data');
          if (!fs.existsSync(DATA_DIR)) {
            fs.mkdirSync(DATA_DIR, { recursive: true });
          }

          const DB_PATH = path.join(DATA_DIR, 'agendamento_local.sqlite');
          console.log(`Caminho do banco SQLite: ${DB_PATH}`);

          // Conectar ao banco de dados SQLite
          sqlite = new Database(DB_PATH);
          db = drizzle(sqlite, { schema });
          console.log('Conexão SQLite estabelecida');
        });
      });
    });
  });
} else {
  // Configuração PostgreSQL
  console.log('Usando PostgreSQL como banco de dados');
  import('@neondatabase/serverless').then(({ Pool, neonConfig }) => {
    import('drizzle-orm/neon-serverless').then(({ drizzle }) => {
      import('ws').then((ws) => {
        // Configuração para WebSockets
        neonConfig.webSocketConstructor = ws.default;

        // Verifica se a URL do banco de dados está definida
        if (!process.env.DATABASE_URL) {
          throw new Error(
            "DATABASE_URL deve ser definida. Você esqueceu de provisionar um banco de dados?"
          );
        }

        // Cria o pool de conexão
        pool = new Pool({ connectionString: process.env.DATABASE_URL });

        // Exporta a instância do Drizzle ORM
        db = drizzle(pool, { schema });
        console.log('Conexão PostgreSQL estabelecida');
      });
    });
  });
}

// Função de limpeza para encerrar o banco de dados quando o servidor for desligado
export async function closeDb() {
  if (dbType === 'sqlite' && sqlite) {
    sqlite.close();
  } else if (pool) {
    await pool.end();
  }
}

export { db };
