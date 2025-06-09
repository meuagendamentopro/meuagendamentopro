#!/usr/bin/env node

/**
 * Script para exportar banco de dados local para migração no Railway
 * 
 * Este script:
 * 1. Conecta ao banco local
 * 2. Exporta todos os dados em formato SQL
 * 3. Gera arquivo de migração para Railway
 */

import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuração do banco local (mesmo do local-config.ts)
const LOCAL_DB_URL = 'postgres://postgres:linday1818@localhost:5432/agendamento';

async function exportDatabase() {
  const pool = new Pool({ connectionString: LOCAL_DB_URL });
  
  try {
    console.log('🔄 Conectando ao banco de dados local...');
    
    // Testar conexão
    await pool.query('SELECT 1');
    console.log('✅ Conectado ao banco local com sucesso!');
    
    // Obter lista de tabelas
    const tablesResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    
    const tables = tablesResult.rows.map(row => row.table_name);
    console.log(`📋 Encontradas ${tables.length} tabelas:`, tables.join(', '));
    
    let sqlExport = '';
    
    // Adicionar cabeçalho
    sqlExport += `-- ========================================\n`;
    sqlExport += `-- EXPORT DO BANCO DE DADOS LOCAL\n`;
    sqlExport += `-- Gerado em: ${new Date().toISOString()}\n`;
    sqlExport += `-- ========================================\n\n`;
    
    // Desabilitar verificações de chave estrangeira temporariamente
    sqlExport += `-- Desabilitar verificações temporariamente\n`;
    sqlExport += `SET session_replication_role = replica;\n\n`;
    
    // Para cada tabela, exportar dados
    for (const tableName of tables) {
      console.log(`📤 Exportando tabela: ${tableName}`);
      
      // Obter dados da tabela
      const dataResult = await pool.query(`SELECT * FROM "${tableName}"`);
      const rows = dataResult.rows;
      
      sqlExport += `-- ========================================\n`;
      sqlExport += `-- TABELA: ${tableName}\n`;
      sqlExport += `-- Registros: ${rows.length}\n`;
      sqlExport += `-- ========================================\n\n`;
      
      if (rows.length > 0) {
        // Limpar tabela antes de inserir
        sqlExport += `DELETE FROM "${tableName}";\n`;
        
        // Obter nomes das colunas
        const columns = Object.keys(rows[0]);
        
        // Gerar INSERTs
        for (const row of rows) {
          const values = columns.map(col => {
            const value = row[col];
            if (value === null) return 'NULL';
            if (typeof value === 'string') {
              return `'${value.replace(/'/g, "''")}'`;
            }
            if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
            if (value instanceof Date) return `'${value.toISOString()}'`;
            if (typeof value === 'object') return `'${JSON.stringify(value).replace(/'/g, "''")}'`;
            return value;
          });
          
          sqlExport += `INSERT INTO "${tableName}" (${columns.map(c => `"${c}"`).join(', ')}) VALUES (${values.join(', ')});\n`;
        }
      }
      
      sqlExport += `\n`;
    }
    
    // Reabilitar verificações de chave estrangeira
    sqlExport += `-- Reabilitar verificações\n`;
    sqlExport += `SET session_replication_role = DEFAULT;\n\n`;
    
    // Adicionar comandos para resetar sequences
    sqlExport += `-- ========================================\n`;
    sqlExport += `-- RESETAR SEQUENCES\n`;
    sqlExport += `-- ========================================\n\n`;
    
    const sequencesResult = await pool.query(`
      SELECT sequence_name 
      FROM information_schema.sequences 
      WHERE sequence_schema = 'public'
    `);
    
    for (const seq of sequencesResult.rows) {
      const seqName = seq.sequence_name;
      const tableName = seqName.replace('_id_seq', '');
      
      sqlExport += `SELECT setval('${seqName}', COALESCE((SELECT MAX(id) FROM "${tableName}"), 1), false);\n`;
    }
    
    // Salvar arquivo
    const exportPath = path.join(__dirname, '..', 'railway-migration.sql');
    fs.writeFileSync(exportPath, sqlExport);
    
    console.log(`\n✅ Export concluído com sucesso!`);
    console.log(`📁 Arquivo salvo em: ${exportPath}`);
    console.log(`📊 Total de tabelas exportadas: ${tables.length}`);
    
    // Criar também um arquivo de instruções
    const instructionsPath = path.join(__dirname, '..', 'RAILWAY-MIGRATION-INSTRUCTIONS.md');
    const instructions = `# Instruções para Migração do Banco de Dados para Railway

## Passos para migrar os dados:

### 1. No Railway:
1. Crie um novo projeto no Railway
2. Adicione um serviço PostgreSQL
3. Anote a DATABASE_URL fornecida pelo Railway

### 2. Execute a migração:
\`\`\`bash
# Conecte ao banco do Railway e execute o arquivo SQL
psql "sua_database_url_do_railway" -f railway-migration.sql
\`\`\`

### 3. Configure as variáveis de ambiente no Railway:
- NODE_ENV=production
- DATABASE_URL=(fornecida automaticamente pelo PostgreSQL do Railway)
- SESSION_SECRET=sua_chave_secreta_muito_segura
- APP_URL=https://seu-app.railway.app

### 4. Faça o deploy:
\`\`\`bash
# Conecte seu repositório GitHub ao Railway
# O deploy será automático
\`\`\`

## Arquivo gerado:
- \`railway-migration.sql\` - Contém todos os dados do banco local

## Verificação:
Após o deploy, acesse sua aplicação no Railway e verifique se:
- ✅ Login funciona
- ✅ Dados estão presentes
- ✅ Agendamentos funcionam
- ✅ Todas as funcionalidades estão operacionais

## Troubleshooting:
Se houver problemas, verifique:
1. Se todas as variáveis de ambiente estão configuradas
2. Se o banco PostgreSQL está conectado
3. Se não há erros nos logs do Railway
`;
    
    fs.writeFileSync(instructionsPath, instructions);
    console.log(`📋 Instruções salvas em: ${instructionsPath}`);
    
  } catch (error) {
    console.error('❌ Erro durante o export:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Executar sempre (para compatibilidade)
exportDatabase().catch(console.error);

export { exportDatabase }; 