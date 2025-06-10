import pkg from 'pg';
const { Client } = pkg;

async function checkUsersFinal() {
    const localClient = new Client({
        connectionString: 'postgres://postgres:linday1818@localhost:5432/agendamento'
    });
    
    const railwayClient = new Client({
        connectionString: 'postgresql://postgres:SmzVnAVExJpuQGUwgspoCVcPowGzRpWG@yamabiko.proxy.rlwy.net:42960/railway'
    });

    try {
        await localClient.connect();
        await railwayClient.connect();
        console.log('✅ Conectado aos dois bancos');

        // Verificar colunas no banco local
        const localColumns = await localClient.query(`
            SELECT column_name, data_type
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'users'
            ORDER BY ordinal_position;
        `);

        // Verificar colunas no Railway
        const railwayColumns = await railwayClient.query(`
            SELECT column_name, data_type
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'users'
            ORDER BY ordinal_position;
        `);

        console.log('\n📋 BANCO LOCAL - users:');
        localColumns.rows.forEach((col, index) => {
            console.log(`   ${index + 1}. ${col.column_name} (${col.data_type})`);
        });

        console.log('\n📋 RAILWAY - users:');
        railwayColumns.rows.forEach((col, index) => {
            console.log(`   ${index + 1}. ${col.column_name} (${col.data_type})`);
        });

        // Identificar diferenças
        const localColNames = localColumns.rows.map(col => col.column_name);
        const railwayColNames = railwayColumns.rows.map(col => col.column_name);

        const missingInRailway = localColNames.filter(col => !railwayColNames.includes(col));
        const extraInRailway = railwayColNames.filter(col => !localColNames.includes(col));

        console.log('\n🔍 ANÁLISE:');
        console.log(`   Local: ${localColNames.length} colunas`);
        console.log(`   Railway: ${railwayColNames.length} colunas`);

        if (missingInRailway.length > 0) {
            console.log(`\n❌ Faltando no Railway (${missingInRailway.length}):`);
            missingInRailway.forEach(col => console.log(`   - ${col}`));
        }

        if (extraInRailway.length > 0) {
            console.log(`\n➕ Extras no Railway (${extraInRailway.length}):`);
            extraInRailway.forEach(col => console.log(`   - ${col}`));
        }

        // Corrigir se necessário
        if (missingInRailway.length > 0) {
            console.log('\n🔧 Corrigindo colunas faltantes...');
            
            for (const colName of missingInRailway) {
                try {
                    // Buscar o tipo da coluna no banco local
                    const localCol = localColumns.rows.find(col => col.column_name === colName);
                    let dataType = 'TEXT'; // padrão
                    
                    if (localCol) {
                        switch (localCol.data_type) {
                            case 'boolean':
                                dataType = 'BOOLEAN DEFAULT false';
                                break;
                            case 'character varying':
                                dataType = 'VARCHAR(255)';
                                break;
                            case 'timestamp without time zone':
                                dataType = 'TIMESTAMP';
                                break;
                            case 'integer':
                                dataType = 'INTEGER';
                                break;
                            default:
                                dataType = 'TEXT';
                        }
                    }
                    
                    await railwayClient.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS ${colName} ${dataType}`);
                    console.log(`   ✅ Adicionada: ${colName} (${dataType})`);
                } catch (error) {
                    console.log(`   ❌ Erro ao adicionar ${colName}:`, error.message);
                }
            }
        }

        console.log('\n🎉 Verificação concluída!');

    } catch (error) {
        console.error('❌ Erro:', error.message);
    } finally {
        await localClient.end();
        await railwayClient.end();
        console.log('\n🔌 Conexões fechadas');
    }
}

checkUsersFinal(); 