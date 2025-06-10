import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function fixMigrationColumns() {
    console.log('🔧 Corrigindo nomes das colunas no arquivo railway-migration.sql...');
    
    const migrationPath = path.resolve(__dirname, '..', 'railway-migration.sql');
    
    if (!fs.existsSync(migrationPath)) {
        console.error('❌ Arquivo railway-migration.sql não encontrado!');
        return;
    }
    
    // Ler o arquivo
    let content = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📝 Aplicando correções...');
    
    // Corrigir os nomes das colunas para minúsculas
    const corrections = [
        { from: '"isEmailVerified"', to: '"isemailverified"' },
        { from: '"verificationToken"', to: '"verificationtoken"' },
        { from: '"verificationTokenExpiry"', to: '"verificationtokenexpiry"' }
    ];
    
    corrections.forEach(correction => {
        const beforeCount = (content.match(new RegExp(correction.from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
        content = content.replace(new RegExp(correction.from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), correction.to);
        const afterCount = (content.match(new RegExp(correction.to.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
        console.log(`✅ ${correction.from} → ${correction.to} (${beforeCount} ocorrências)`);
    });
    
    // Salvar o arquivo corrigido
    fs.writeFileSync(migrationPath, content);
    
    console.log('✅ Arquivo railway-migration.sql corrigido!');
    console.log('📝 Nomes das colunas ajustados para corresponder ao banco Railway');
}

fixMigrationColumns().catch(console.error); 