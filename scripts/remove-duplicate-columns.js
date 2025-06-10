import pkg from 'pg';
const { Client } = pkg;

async function removeDuplicateColumns() {
    const railwayClient = new Client({
        connectionString: 'postgresql://postgres:SmzVnAVExJpuQGUwgspoCVcPowGzRpWG@yamabiko.proxy.rlwy.net:42960/railway'
    });

    try {
        await railwayClient.connect();
        console.log('✅ Conectado ao Railway PostgreSQL');

        console.log('\n🗑️ Removendo colunas duplicadas definitivamente...\n');

        // Remover as colunas duplicadas que foram criadas novamente
        console.log('👤 Limpando tabela users...');
        
        try {
            // Remover as colunas duplicadas em minúsculas que foram criadas novamente
            await railwayClient.query('ALTER TABLE users DROP COLUMN IF EXISTS isemailverified');
            console.log('   ✅ Removida: isemailverified');
            
            await railwayClient.query('ALTER TABLE users DROP COLUMN IF EXISTS verificationtoken');
            console.log('   ✅ Removida: verificationtoken');
            
            await railwayClient.query('ALTER TABLE users DROP COLUMN IF EXISTS verificationtokenexpiry');
            console.log('   ✅ Removida: verificationtokenexpiry');

        } catch (error) {
            console.log('   ❌ Erro:', error.message);
        }

        // Verificar estrutura final
        console.log('\n🔍 Verificando estrutura final da tabela users...');
        
        const userColumns = await railwayClient.query(`
            SELECT column_name, data_type
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'users'
            ORDER BY ordinal_position;
        `);
        
        console.log(`\n📋 users (${userColumns.rows.length} colunas):`);
        userColumns.rows.forEach((col, index) => {
            console.log(`   ${index + 1}. ${col.column_name} (${col.data_type})`);
        });

        console.log('\n🎉 Limpeza concluída!');

    } catch (error) {
        console.error('❌ Erro geral:', error.message);
    } finally {
        await railwayClient.end();
        console.log('\n🔌 Conexão fechada');
    }
}

removeDuplicateColumns(); 