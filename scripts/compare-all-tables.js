import pkg from 'pg';
const { Client } = pkg;

async function compareAllTables() {
    // Conexões
    const localClient = new Client({
        connectionString: 'postgres://postgres:linday1818@localhost:5432/agendamento'
    });
    
    const railwayClient = new Client({
        connectionString: 'postgresql://postgres:SmzVnAVExJpuQGUwgspoCVcPowGzRpWG@yamabiko.proxy.rlwy.net:42960/railway'
    });

    try {
        console.log('🔌 Conectando aos bancos...');
        await localClient.connect();
        await railwayClient.connect();
        console.log('✅ Conectado ao banco local e Railway');

        // Obter lista de tabelas do banco local
        const localTables = await localClient.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_type = 'BASE TABLE'
            ORDER BY table_name;
        `);

        console.log(`\n📋 Encontradas ${localTables.rows.length} tabelas no banco local`);

        const differences = [];

        for (const table of localTables.rows) {
            const tableName = table.table_name;
            console.log(`\n🔍 Verificando tabela: ${tableName}`);

            // Verificar se a tabela existe no Railway
            const railwayTableExists = await railwayClient.query(`
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_name = $1
                );
            `, [tableName]);

            if (!railwayTableExists.rows[0].exists) {
                console.log(`❌ Tabela ${tableName} NÃO EXISTE no Railway`);
                differences.push({
                    table: tableName,
                    issue: 'TABLE_MISSING',
                    details: 'Tabela não existe no Railway'
                });
                continue;
            }

            // Obter colunas do banco local
            const localColumns = await localClient.query(`
                SELECT column_name, data_type, is_nullable, column_default
                FROM information_schema.columns 
                WHERE table_schema = 'public' 
                AND table_name = $1
                ORDER BY ordinal_position;
            `, [tableName]);

            // Obter colunas do Railway
            const railwayColumns = await railwayClient.query(`
                SELECT column_name, data_type, is_nullable, column_default
                FROM information_schema.columns 
                WHERE table_schema = 'public' 
                AND table_name = $1
                ORDER BY ordinal_position;
            `, [tableName]);

            // Comparar colunas
            const localColNames = localColumns.rows.map(col => col.column_name);
            const railwayColNames = railwayColumns.rows.map(col => col.column_name);

            // Colunas que existem no local mas não no Railway
            const missingInRailway = localColNames.filter(col => !railwayColNames.includes(col));
            
            // Colunas que existem no Railway mas não no local
            const extraInRailway = railwayColNames.filter(col => !localColNames.includes(col));

            if (missingInRailway.length > 0 || extraInRailway.length > 0) {
                console.log(`⚠️ Diferenças encontradas na tabela ${tableName}:`);
                
                if (missingInRailway.length > 0) {
                    console.log(`   📤 Colunas faltando no Railway: ${missingInRailway.join(', ')}`);
                    differences.push({
                        table: tableName,
                        issue: 'MISSING_COLUMNS',
                        details: `Colunas faltando: ${missingInRailway.join(', ')}`
                    });
                }
                
                if (extraInRailway.length > 0) {
                    console.log(`   📥 Colunas extras no Railway: ${extraInRailway.join(', ')}`);
                    differences.push({
                        table: tableName,
                        issue: 'EXTRA_COLUMNS',
                        details: `Colunas extras: ${extraInRailway.join(', ')}`
                    });
                }
            } else {
                console.log(`✅ Tabela ${tableName} - estrutura idêntica`);
            }
        }

        // Resumo final
        console.log('\n' + '='.repeat(60));
        console.log('📊 RESUMO DA COMPARAÇÃO');
        console.log('='.repeat(60));

        if (differences.length === 0) {
            console.log('🎉 Todas as tabelas têm estrutura idêntica!');
        } else {
            console.log(`⚠️ Encontradas ${differences.length} diferenças:`);
            
            differences.forEach((diff, index) => {
                console.log(`\n${index + 1}. Tabela: ${diff.table}`);
                console.log(`   Problema: ${diff.issue}`);
                console.log(`   Detalhes: ${diff.details}`);
            });

            // Agrupar por tipo de problema
            const groupedDiffs = differences.reduce((acc, diff) => {
                if (!acc[diff.issue]) acc[diff.issue] = [];
                acc[diff.issue].push(diff.table);
                return acc;
            }, {});

            console.log('\n📈 Resumo por tipo de problema:');
            Object.entries(groupedDiffs).forEach(([issue, tables]) => {
                console.log(`   ${issue}: ${tables.length} tabela(s) - ${tables.join(', ')}`);
            });
        }

    } catch (error) {
        console.error('❌ Erro:', error.message);
    } finally {
        await localClient.end();
        await railwayClient.end();
        console.log('\n🔌 Conexões fechadas');
    }
}

compareAllTables(); 