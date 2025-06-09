#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔍 VERIFICANDO DEPENDÊNCIAS PARA MIGRAÇÃO');
console.log('=========================================');
console.log();

let allGood = true;

// Verificar se o Node.js está instalado
console.log('📦 Verificando Node.js...');
console.log(`   ✅ Node.js versão: ${process.version}`);
console.log();

// Verificar se o npm está disponível
try {
  const { execSync } = require('child_process');
  const npmVersion = execSync('npm --version', { encoding: 'utf8' }).trim();
  console.log('📦 Verificando npm...');
  console.log(`   ✅ npm versão: ${npmVersion}`);
} catch (error) {
  console.log('📦 Verificando npm...');
  console.log('   ❌ npm não encontrado');
  allGood = false;
}
console.log();

// Verificar se o package.json existe
console.log('📋 Verificando package.json...');
if (fs.existsSync('package.json')) {
  console.log('   ✅ package.json encontrado');
  
  // Ler package.json e verificar dependências
  try {
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
    
    console.log('   📦 Verificando dependência: pg');
    if (dependencies.pg) {
      console.log(`   ✅ pg versão: ${dependencies.pg}`);
    } else {
      console.log('   ⚠️  pg não encontrado - será necessário instalar');
    }
    
    console.log('   📦 Verificando dependência: dotenv');
    if (dependencies.dotenv) {
      console.log(`   ✅ dotenv versão: ${dependencies.dotenv}`);
    } else {
      console.log('   ⚠️  dotenv não encontrado - será necessário instalar');
    }
    
  } catch (error) {
    console.log('   ❌ Erro ao ler package.json');
    allGood = false;
  }
} else {
  console.log('   ❌ package.json não encontrado');
  allGood = false;
}
console.log();

// Verificar se o arquivo .env existe
console.log('🔧 Verificando configuração...');
if (fs.existsSync('.env')) {
  console.log('   ✅ Arquivo .env encontrado');
  
  // Verificar se as variáveis necessárias estão definidas
  require('dotenv').config();
  const requiredVars = ['DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'];
  
  for (const varName of requiredVars) {
    if (process.env[varName]) {
      console.log(`   ✅ ${varName} configurado`);
    } else {
      console.log(`   ⚠️  ${varName} não configurado`);
    }
  }
} else {
  console.log('   ⚠️  Arquivo .env não encontrado');
  console.log('   💡 Copie env-example.txt para .env e configure');
}
console.log();

// Verificar se o script de migração existe
console.log('📄 Verificando script de migração...');
if (fs.existsSync('migration-script.js')) {
  console.log('   ✅ migration-script.js encontrado');
} else {
  console.log('   ❌ migration-script.js não encontrado');
  allGood = false;
}
console.log();

// Tentar conectar ao banco (se as configurações estiverem disponíveis)
if (fs.existsSync('.env')) {
  require('dotenv').config();
  
  if (process.env.DB_HOST && process.env.DB_NAME && process.env.DB_USER && process.env.DB_PASSWORD) {
    console.log('🔌 Testando conexão com o banco de dados...');
    
    try {
      const { Pool } = require('pg');
      const pool = new Pool({
        host: process.env.DB_HOST,
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
        connectionTimeoutMillis: 5000,
      });
      
      pool.query('SELECT NOW()')
        .then(() => {
          console.log('   ✅ Conexão com o banco estabelecida com sucesso');
          pool.end();
        })
        .catch((error) => {
          console.log('   ❌ Erro ao conectar com o banco:');
          console.log(`   📝 ${error.message}`);
          allGood = false;
        });
        
    } catch (error) {
      console.log('   ❌ Erro ao testar conexão:');
      console.log(`   📝 ${error.message}`);
      allGood = false;
    }
  } else {
    console.log('🔌 Testando conexão com o banco de dados...');
    console.log('   ⚠️  Configurações do banco incompletas - pulando teste');
  }
} else {
  console.log('🔌 Testando conexão com o banco de dados...');
  console.log('   ⚠️  Arquivo .env não encontrado - pulando teste');
}

console.log();
console.log('📋 RESUMO');
console.log('=========');

if (allGood) {
  console.log('✅ Todas as verificações passaram!');
  console.log('✅ Você está pronto para executar a migração');
  console.log();
  console.log('🚀 Para executar a migração:');
  console.log('   node migration-script.js');
} else {
  console.log('⚠️  Algumas verificações falharam');
  console.log('📝 Siga as instruções acima para corrigir os problemas');
  console.log();
  console.log('💡 Passos recomendados:');
  console.log('   1. npm install pg dotenv');
  console.log('   2. cp env-example.txt .env');
  console.log('   3. Edite o arquivo .env com suas configurações');
  console.log('   4. node check-dependencies.js (para verificar novamente)');
  console.log('   5. node migration-script.js (para executar a migração)');
}

console.log();
console.log('📖 Para mais informações, consulte: MIGRATION-README.md'); 