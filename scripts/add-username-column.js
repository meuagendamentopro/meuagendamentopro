import pkg from 'pg';
const { Client } = pkg;

async function addUsernameColumn() {
    const client = new Client({
        connectionString: 'postgresql://postgres:SmzVnAVExJpuQGUwgspoCVcPowGzRpWG@yamabiko.proxy.rlwy.net:42960/railway'
    });

    try {
        await client.connect();
        console.log('✅ Conectado ao Railway PostgreSQL');

        // Verificar se a coluna username já existe
        const columnExists = await client.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.columns 
                WHERE table_schema = 'public' 
                AND table_name = 'users'
                AND column_name = 'username'
            );
        `);

        if (!columnExists.rows[0].exists) {
            // Adicionar a coluna username
            await client.query(`ALTER TABLE users ADD COLUMN username VARCHAR(255)`);
            console.log('✅ Coluna username adicionada');
        } else {
            console.log('⚠️ Coluna username já existe');
        }

        // Verificar a estrutura final
        const columns = await client.query(`
            SELECT column_name
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'users'
            ORDER BY ordinal_position;
        `);

        console.log('\n📋 Colunas da tabela users:');
        columns.rows.forEach((col, index) => {
            console.log(`${index + 1}. ${col.column_name}`);
        });

        console.log('\n✅ Tabela users está pronta para receber os dados!');

    } catch (error) {
        console.error('❌ Erro:', error.message);
    } finally {
        await client.end();
    }
}

addUsernameColumn(); 