import pkg from 'pg';
const { Client } = pkg;

async function fixUsersTable() {
    const client = new Client({
        connectionString: 'postgresql://postgres:SmzVnAVExJpuQGUwgspoCVcPowGzRpWG@yamabiko.proxy.rlwy.net:42960/railway'
    });

    try {
        await client.connect();
        console.log('✅ Conectado ao Railway PostgreSQL');

        // Colunas que precisam ser adicionadas
        const columnsToAdd = [
            'username VARCHAR(255)',
            'avatar_url TEXT',
            'is_email_verified BOOLEAN DEFAULT false',
            'verification_token VARCHAR(255)',
            'verification_token_expiry TIMESTAMP',
            'subscription_expiry TIMESTAMP',
            'never_expires BOOLEAN DEFAULT false',
            'isEmailVerified BOOLEAN DEFAULT false',
            'verificationToken VARCHAR(255)',
            'verificationTokenExpiry TIMESTAMP'
        ];

        console.log('🔧 Adicionando colunas faltantes...');

        for (const column of columnsToAdd) {
            try {
                const [columnName] = column.split(' ');
                
                // Verificar se a coluna já existe
                const columnExists = await client.query(`
                    SELECT EXISTS (
                        SELECT FROM information_schema.columns 
                        WHERE table_schema = 'public' 
                        AND table_name = 'users'
                        AND column_name = $1
                    );
                `, [columnName]);

                if (!columnExists.rows[0].exists) {
                    await client.query(`ALTER TABLE users ADD COLUMN ${column}`);
                    console.log(`✅ Coluna ${columnName} adicionada`);
                } else {
                    console.log(`⚠️ Coluna ${columnName} já existe`);
                }
            } catch (error) {
                console.error(`❌ Erro ao adicionar coluna ${column}:`, error.message);
            }
        }

        // Verificar a estrutura atualizada
        const columns = await client.query(`
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'users'
            ORDER BY ordinal_position;
        `);

        console.log('\n📋 Estrutura atualizada da tabela users:');
        console.log('Coluna | Tipo | Nullable | Default');
        console.log('-------|------|----------|--------');
        columns.rows.forEach(col => {
            console.log(`${col.column_name} | ${col.data_type} | ${col.is_nullable} | ${col.column_default || 'NULL'}`);
        });

        console.log('\n✅ Tabela users corrigida com sucesso!');

    } catch (error) {
        console.error('❌ Erro:', error.message);
    } finally {
        await client.end();
    }
}

fixUsersTable(); 