# Configurando o Sistema de Agendamento com SQLite

Este guia explica como configurar o sistema para usar SQLite em vez de PostgreSQL, o que facilita a execução local para demonstrações.

## Vantagens do SQLite

- Não requer instalação de servidor de banco de dados
- Banco de dados armazenado em um único arquivo
- Configurar e executar é muito mais simples
- Ideal para demonstrações e testes

## Opções de Configuração

### Opção 1: Configurar usando scripts simplificados (Recomendado)

Escolha o script adequado para seu sistema operacional:

#### Windows

1. Execute o arquivo `setup-sqlite-simple.bat`
2. Após a configuração, inicie o sistema com `npm run dev`
3. Se desejar voltar para PostgreSQL, use `restore-postgre.bat`

#### Linux/Mac

1. Dê permissão de execução ao script: `chmod +x setup-sqlite-simple.sh`
2. Execute o script: `./setup-sqlite-simple.sh`
3. Após a configuração, inicie o sistema com `npm run dev`
4. Se desejar voltar para PostgreSQL, use `./restore-postgre.sh`

### Opção 2: Configurar manualmente

1. Instale a dependência: `npm install better-sqlite3`
2. Faça backup do arquivo original: `cp server/db.ts server/db.ts.original`
3. Crie a pasta para o banco de dados: `mkdir -p data`
4. Substitua o conteúdo do arquivo `server/db.ts` com:

```typescript
import * as schema from '@shared/schema';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';

// Garante que o diretório de dados existe
const DATA_DIR = path.join(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'agendamento_local.sqlite');
console.log(`Usando SQLite: ${DB_PATH}`);

// Conectar ao banco de dados SQLite
export const sqlite = new Database(DB_PATH);
export const db = drizzle(sqlite, { schema });
export const pool = { end: () => sqlite.close() }; // Para compatibilidade

// Função para fechar o banco de dados quando o servidor for encerrado
export async function closeDb() {
  sqlite.close();
}
```

5. Inicie o sistema com `npm run dev`

## Acessando o Sistema

Após iniciar o servidor, acesse:

- **URL**: http://localhost:5000

## Usuários Padrão

- **Admin**
  - Usuário: `admin`
  - Senha: `password123`

- **Prestador de Serviço**
  - Usuário: `link`
  - Senha: `password123`

## Solução de Problemas

### Erro ao instalar better-sqlite3

- **Windows**: Pode ser necessário instalar ferramentas de compilação
  - Instale Visual Studio Build Tools com suporte a C++
  - Ou instale node-gyp: `npm install -g node-gyp`

- **Linux**: Instale as dependências de desenvolvimento
  - Debian/Ubuntu: `sudo apt-get install build-essential python`
  - Fedora/RHEL: `sudo dnf install gcc-c++ make python3`

### Outros problemas

- Verifique os logs do servidor para identificar erros específicos
- Se o banco de dados não for criado, verifique as permissões do diretório `data`
- O sistema utiliza a porta 5000 por padrão, certifique-se de que ela está disponível
