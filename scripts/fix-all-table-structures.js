import pkg from 'pg';
const { Client } = pkg;

async function fixAllTableStructures() {
    const railwayClient = new Client({
        connectionString: 'postgresql://postgres:SmzVnAVExJpuQGUwgspoCVcPowGzRpWG@yamabiko.proxy.rlwy.net:42960/railway'
    });

    try {
        await railwayClient.connect();
        console.log('✅ Conectado ao Railway PostgreSQL');

        console.log('\n🔧 Iniciando correção das estruturas das tabelas...\n');

        // 1. Corrigir tabela clinical_notes
        console.log('📋 1. Corrigindo tabela clinical_notes...');
        try {
            // Adicionar colunas faltantes
            await railwayClient.query('ALTER TABLE clinical_notes ADD COLUMN IF NOT EXISTS content TEXT');
            await railwayClient.query('ALTER TABLE clinical_notes ADD COLUMN IF NOT EXISTS is_private BOOLEAN DEFAULT false');
            
            // Remover coluna extra (se existir)
            await railwayClient.query('ALTER TABLE clinical_notes DROP COLUMN IF EXISTS notes');
            
            console.log('   ✅ clinical_notes corrigida');
        } catch (error) {
            console.log('   ❌ Erro ao corrigir clinical_notes:', error.message);
        }

        // 2. Corrigir tabela subscription_transactions
        console.log('📋 2. Corrigindo tabela subscription_transactions...');
        try {
            // Adicionar colunas faltantes
            await railwayClient.query('ALTER TABLE subscription_transactions ADD COLUMN IF NOT EXISTS plan_id INTEGER');
            await railwayClient.query('ALTER TABLE subscription_transactions ADD COLUMN IF NOT EXISTS pix_qr_code TEXT');
            await railwayClient.query('ALTER TABLE subscription_transactions ADD COLUMN IF NOT EXISTS pix_qr_code_base64 TEXT');
            await railwayClient.query('ALTER TABLE subscription_transactions ADD COLUMN IF NOT EXISTS pix_qr_code_expiration TIMESTAMP');
            await railwayClient.query('ALTER TABLE subscription_transactions ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP');
            
            console.log('   ✅ subscription_transactions corrigida');
        } catch (error) {
            console.log('   ❌ Erro ao corrigir subscription_transactions:', error.message);
        }

        // 3. Corrigir tabela time_exclusions
        console.log('📋 3. Corrigindo tabela time_exclusions...');
        try {
            // Adicionar colunas faltantes
            await railwayClient.query('ALTER TABLE time_exclusions ADD COLUMN IF NOT EXISTS day_of_week INTEGER');
            await railwayClient.query('ALTER TABLE time_exclusions ADD COLUMN IF NOT EXISTS name VARCHAR(255)');
            await railwayClient.query('ALTER TABLE time_exclusions ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true');
            await railwayClient.query('ALTER TABLE time_exclusions ADD COLUMN IF NOT EXISTS title VARCHAR(255)');
            await railwayClient.query('ALTER TABLE time_exclusions ADD COLUMN IF NOT EXISTS recurrence VARCHAR(50)');
            await railwayClient.query('ALTER TABLE time_exclusions ADD COLUMN IF NOT EXISTS recurrence_end_date DATE');
            
            console.log('   ✅ time_exclusions corrigida');
        } catch (error) {
            console.log('   ❌ Erro ao corrigir time_exclusions:', error.message);
        }

        // 4. Corrigir tabela user_session_tokens
        console.log('📋 4. Corrigindo tabela user_session_tokens...');
        try {
            // Adicionar coluna faltante
            await railwayClient.query('ALTER TABLE user_session_tokens ADD COLUMN IF NOT EXISTS session_token VARCHAR(255)');
            
            console.log('   ✅ user_session_tokens corrigida');
        } catch (error) {
            console.log('   ❌ Erro ao corrigir user_session_tokens:', error.message);
        }

        // 5. Corrigir tabela users (remover duplicatas)
        console.log('📋 5. Corrigindo tabela users (removendo colunas duplicadas)...');
        try {
            // Remover colunas duplicadas em minúsculas (mantemos as originais)
            await railwayClient.query('ALTER TABLE users DROP COLUMN IF EXISTS isemailverified');
            await railwayClient.query('ALTER TABLE users DROP COLUMN IF EXISTS verificationtoken');
            await railwayClient.query('ALTER TABLE users DROP COLUMN IF EXISTS verificationtokenexpiry');
            
            // Garantir que as colunas originais existem
            await railwayClient.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS isEmailVerified BOOLEAN DEFAULT false');
            await railwayClient.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS verificationToken VARCHAR(255)');
            await railwayClient.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS verificationTokenExpiry TIMESTAMP');
            
            console.log('   ✅ users corrigida');
        } catch (error) {
            console.log('   ❌ Erro ao corrigir users:', error.message);
        }

        console.log('\n🎉 Correção das estruturas concluída!');
        
        // Verificar se as correções foram aplicadas
        console.log('\n🔍 Verificando correções aplicadas...');
        
        const tables = ['clinical_notes', 'subscription_transactions', 'time_exclusions', 'user_session_tokens', 'users'];
        
        for (const tableName of tables) {
            const columns = await railwayClient.query(`
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_schema = 'public' 
                AND table_name = $1
                ORDER BY ordinal_position;
            `, [tableName]);
            
            console.log(`📋 ${tableName}: ${columns.rows.length} colunas`);
            console.log(`   Colunas: ${columns.rows.map(col => col.column_name).join(', ')}`);
        }

    } catch (error) {
        console.error('❌ Erro geral:', error.message);
    } finally {
        await railwayClient.end();
        console.log('\n🔌 Conexão fechada');
    }
}

fixAllTableStructures(); 