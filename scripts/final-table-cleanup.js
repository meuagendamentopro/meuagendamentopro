import pkg from 'pg';
const { Client } = pkg;

async function finalTableCleanup() {
    const railwayClient = new Client({
        connectionString: 'postgresql://postgres:SmzVnAVExJpuQGUwgspoCVcPowGzRpWG@yamabiko.proxy.rlwy.net:42960/railway'
    });

    try {
        await railwayClient.connect();
        console.log('✅ Conectado ao Railway PostgreSQL');

        console.log('\n🧹 Iniciando limpeza final das tabelas...\n');

        // 1. Limpar tabela users - remover colunas duplicadas em minúsculas
        console.log('👤 1. Limpando tabela users...');
        try {
            // Verificar quais colunas existem
            const userColumns = await railwayClient.query(`
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_schema = 'public' 
                AND table_name = 'users'
                ORDER BY ordinal_position;
            `);
            
            const columnNames = userColumns.rows.map(col => col.column_name);
            console.log('   Colunas atuais:', columnNames.join(', '));

            // Remover colunas duplicadas em minúsculas
            if (columnNames.includes('isemailverified')) {
                await railwayClient.query('ALTER TABLE users DROP COLUMN isemailverified');
                console.log('   ✅ Removida coluna duplicada: isemailverified');
            }
            
            if (columnNames.includes('verificationtoken')) {
                await railwayClient.query('ALTER TABLE users DROP COLUMN verificationtoken');
                console.log('   ✅ Removida coluna duplicada: verificationtoken');
            }
            
            if (columnNames.includes('verificationtokenexpiry')) {
                await railwayClient.query('ALTER TABLE users DROP COLUMN verificationtokenexpiry');
                console.log('   ✅ Removida coluna duplicada: verificationtokenexpiry');
            }

            // Garantir que as colunas corretas existem
            if (!columnNames.includes('isEmailVerified')) {
                await railwayClient.query('ALTER TABLE users ADD COLUMN isEmailVerified BOOLEAN DEFAULT false');
                console.log('   ✅ Adicionada coluna: isEmailVerified');
            }
            
            if (!columnNames.includes('verificationToken')) {
                await railwayClient.query('ALTER TABLE users ADD COLUMN verificationToken VARCHAR(255)');
                console.log('   ✅ Adicionada coluna: verificationToken');
            }
            
            if (!columnNames.includes('verificationTokenExpiry')) {
                await railwayClient.query('ALTER TABLE users ADD COLUMN verificationTokenExpiry TIMESTAMP');
                console.log('   ✅ Adicionada coluna: verificationTokenExpiry');
            }

            console.log('   ✅ Tabela users limpa');
        } catch (error) {
            console.log('   ❌ Erro ao limpar users:', error.message);
        }

        // 2. Verificar estrutura final de todas as tabelas problemáticas
        console.log('\n🔍 Verificando estruturas finais...');
        
        const problematicTables = ['users', 'subscription_transactions', 'time_exclusions', 'user_session_tokens'];
        
        for (const tableName of problematicTables) {
            const columns = await railwayClient.query(`
                SELECT column_name, data_type
                FROM information_schema.columns 
                WHERE table_schema = 'public' 
                AND table_name = $1
                ORDER BY ordinal_position;
            `, [tableName]);
            
            console.log(`\n📋 ${tableName} (${columns.rows.length} colunas):`);
            columns.rows.forEach(col => {
                console.log(`   - ${col.column_name} (${col.data_type})`);
            });
        }

        console.log('\n🎉 Limpeza final concluída!');

    } catch (error) {
        console.error('❌ Erro geral:', error.message);
    } finally {
        await railwayClient.end();
        console.log('\n🔌 Conexão fechada');
    }
}

finalTableCleanup(); 