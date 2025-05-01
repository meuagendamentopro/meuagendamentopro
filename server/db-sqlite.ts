import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '@shared/schema';
import * as path from 'path';
import * as fs from 'fs';

// Garante que o diretório de dados existe
const DATA_DIR = path.join(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'agendamento_local.sqlite');

// Conectar ao banco de dados SQLite
export const sqlite = new Database(DB_PATH);
export const db = drizzle(sqlite, { schema });

// Função para fechar o banco de dados quando o servidor for encerrado
export async function closeDb() {
  sqlite.close();
}
