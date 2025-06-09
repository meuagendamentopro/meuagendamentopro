#!/usr/bin/env node

/**
 * Script para configurar ambiente local
 */

import fs from 'fs';

const envContent = `# Configuração do Banco de Dados Local
DATABASE_URL=postgres://postgres:linday1818@localhost:5432/agendamento

# Configuração do Servidor
NODE_ENV=development
PORT=3003
SESSION_SECRET=sua-chave-secreta-super-segura-para-desenvolvimento-local

# Configuração de Email
EMAIL_USER=contato@meuagendamentopro.com.br
EMAIL_PASSWORD=sua-senha-do-email
`;

console.log('🔧 Configurando ambiente local...');

// Criar arquivo .env se não existir
if (!fs.existsSync('.env')) {
  fs.writeFileSync('.env', envContent);
  console.log('✅ Arquivo .env criado com sucesso!');
} else {
  console.log('ℹ️  Arquivo .env já existe');
}

console.log('\n📋 Para iniciar o servidor local:');
console.log('1. npm run dev (desenvolvimento)');
console.log('2. npm run build && npm start (produção)');
console.log('\n🔗 Servidor estará disponível em: http://localhost:3003'); 