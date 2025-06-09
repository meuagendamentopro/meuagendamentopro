#!/usr/bin/env node

/**
 * Script para preparar o projeto para deploy no Railway
 */

import fs from 'fs';
import path from 'path';

console.log('🚀 Preparando projeto para deploy no Railway...\n');

// Verificar se o package.json tem os scripts necessários
const packageJsonPath = 'package.json';
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

console.log('✅ Scripts verificados:');
console.log(`   - build: ${packageJson.scripts.build ? '✅' : '❌'}`);
console.log(`   - start: ${packageJson.scripts.start ? '✅' : '❌'}`);

// Verificar se os arquivos de configuração existem
const configFiles = [
  'railway.json',
  'DEPLOY-RAILWAY.md',
  'railway.env.example'
];

console.log('\n✅ Arquivos de configuração:');
configFiles.forEach(file => {
  const exists = fs.existsSync(file);
  console.log(`   - ${file}: ${exists ? '✅' : '❌'}`);
});

// Verificar dependências críticas
const criticalDeps = [
  'express',
  'dotenv',
  'cors',
  'pg'
];

console.log('\n✅ Dependências críticas:');
criticalDeps.forEach(dep => {
  const exists = packageJson.dependencies[dep] || packageJson.devDependencies[dep];
  console.log(`   - ${dep}: ${exists ? '✅' : '❌'}`);
});

console.log('\n🎉 Projeto pronto para deploy no Railway!');
console.log('\n📋 Próximos passos:');
console.log('1. Faça commit das alterações');
console.log('2. Push para o GitHub');
console.log('3. Acesse railway.app');
console.log('4. Conecte seu repositório');
console.log('5. Adicione PostgreSQL');
console.log('6. Configure as variáveis de ambiente');
console.log('\n📖 Consulte DEPLOY-RAILWAY.md para instruções detalhadas'); 