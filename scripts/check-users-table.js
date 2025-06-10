import pkg from 'pg';
const { Client } = pkg;

async function checkUsersTable() {
    const client = new Client({
        connectionString: 'postgresql://postgres:SmzVnAVExJpuQGUwgspoCVcPowGzRpWG@yamabiko.proxy.rlwy.net:42960/railway'
    });

    try {
        await client.connect();
        console.log('✅ Conectado ao Railway PostgreSQL');

        // Verificar se a tabela users existe
        const tableExists = await client.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'users'
            );
        `);

        if (!tableExists.rows[0].exists) {
            console.log('❌ Tabela users não existe');
            return;
        }

        console.log('✅ Tabela users existe');

        // Verificar estrutura da tabela users
        const columns = await client.query(`
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'users'
            ORDER BY ordinal_position;
        `);

        console.log('\n📋 Estrutura da tabela users:');
        console.log('Coluna | Tipo | Nullable | Default');
        console.log('-------|------|----------|--------');
        columns.rows.forEach(col => {
            console.log(`${col.column_name} | ${col.data_type} | ${col.is_nullable} | ${col.column_default || 'NULL'}`);
        });

        // Verificar quantos registros existem
        const count = await client.query('SELECT COUNT(*) FROM users');
        console.log(`\n📊 Total de registros: ${count.rows[0].count}`);

        // Verificar alguns registros
        const users = await client.query('SELECT id, name, email, role FROM users LIMIT 5');
        console.log('\n👥 Primeiros 5 usuários:');
        users.rows.forEach(user => {
            console.log(`ID: ${user.id}, Nome: ${user.name}, Email: ${user.email}, Role: ${user.role}`);
        });

        // Verificar se há colunas duplicadas ou problemas
        const duplicateColumns = await client.query(`
            SELECT column_name, COUNT(*) as count
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'users'
            GROUP BY column_name
            HAVING COUNT(*) > 1;
        `);

        if (duplicateColumns.rows.length > 0) {
            console.log('\n⚠️ Colunas duplicadas encontradas:');
            duplicateColumns.rows.forEach(col => {
                console.log(`${col.column_name}: ${col.count} vezes`);
            });
        } else {
            console.log('\n✅ Nenhuma coluna duplicada encontrada');
        }

    } catch (error) {
        console.error('❌ Erro:', error.message);
        if (error.message.includes('column') && error.message.includes('does not exist')) {
            console.log('\n🔍 Possível problema: Coluna não existe na tabela');
            console.log('Verifique se todas as colunas do arquivo de migração existem na tabela do Railway');
        }
    } finally {
        await client.end();
    }
}

checkUsersTable(); 