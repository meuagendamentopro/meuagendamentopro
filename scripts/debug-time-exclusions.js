import pkg from 'pg';
const { Client } = pkg;

async function debugTimeExclusions() {
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

        console.log('\n🔍 DEBUGANDO TABELA time_exclusions\n');

        // 1. Verificar estrutura das duas tabelas
        console.log('📋 1. Comparando estruturas...');
        
        const localColumns = await localClient.query(`
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'time_exclusions'
            ORDER BY ordinal_position;
        `);

        const railwayColumns = await railwayClient.query(`
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'time_exclusions'
            ORDER BY ordinal_position;
        `);

        console.log('\n📋 BANCO LOCAL:');
        localColumns.rows.forEach((col, index) => {
            console.log(`   ${index + 1}. ${col.column_name} (${col.data_type}) - Nullable: ${col.is_nullable} - Default: ${col.column_default || 'NULL'}`);
        });

        console.log('\n📋 RAILWAY:');
        railwayColumns.rows.forEach((col, index) => {
            console.log(`   ${index + 1}. ${col.column_name} (${col.data_type}) - Nullable: ${col.is_nullable} - Default: ${col.column_default || 'NULL'}`);
        });

        // 2. Verificar dados existentes
        console.log('\n📊 2. Verificando dados existentes...');
        
        const localData = await localClient.query('SELECT COUNT(*) as count FROM time_exclusions');
        const railwayData = await railwayClient.query('SELECT COUNT(*) as count FROM time_exclusions');
        
        console.log(`   Local: ${localData.rows[0].count} registros`);
        console.log(`   Railway: ${railwayData.rows[0].count} registros`);

        // 3. Verificar constraints e índices
        console.log('\n🔒 3. Verificando constraints...');
        
        const railwayConstraints = await railwayClient.query(`
            SELECT constraint_name, constraint_type, column_name
            FROM information_schema.table_constraints tc
            JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
            WHERE tc.table_name = 'time_exclusions'
            ORDER BY constraint_type, constraint_name;
        `);

        if (railwayConstraints.rows.length > 0) {
            console.log('   Constraints encontradas:');
            railwayConstraints.rows.forEach(constraint => {
                console.log(`   - ${constraint.constraint_name} (${constraint.constraint_type}) em ${constraint.column_name}`);
            });
        } else {
            console.log('   ❌ Nenhuma constraint encontrada');
        }

        // 4. Testar inserção simples
        console.log('\n🧪 4. Testando inserção no Railway...');
        
        try {
            // Primeiro, vamos ver um exemplo do banco local
            const localSample = await localClient.query('SELECT * FROM time_exclusions LIMIT 1');
            
            if (localSample.rows.length > 0) {
                console.log('   📋 Exemplo do banco local:');
                console.log('   ', JSON.stringify(localSample.rows[0], null, 2));
            }

            // Tentar inserção básica no Railway
            const testInsert = await railwayClient.query(`
                INSERT INTO time_exclusions (
                    provider_id, 
                    start_time, 
                    end_time, 
                    created_at,
                    day_of_week,
                    name,
                    is_active,
                    title
                ) VALUES (
                    1, 
                    '09:00:00', 
                    '10:00:00', 
                    NOW(),
                    1,
                    'Teste Debug',
                    true,
                    'Teste de Inserção'
                ) RETURNING id;
            `);

            console.log(`   ✅ Inserção bem-sucedida! ID: ${testInsert.rows[0].id}`);

            // Remover o registro de teste
            await railwayClient.query('DELETE FROM time_exclusions WHERE id = $1', [testInsert.rows[0].id]);
            console.log('   🗑️ Registro de teste removido');

        } catch (insertError) {
            console.log('   ❌ Erro na inserção:');
            console.log('   ', insertError.message);
            console.log('   ', insertError.detail || '');
            console.log('   ', insertError.hint || '');
        }

        // 5. Verificar permissões
        console.log('\n🔐 5. Verificando permissões...');
        
        try {
            const permissions = await railwayClient.query(`
                SELECT grantee, privilege_type 
                FROM information_schema.role_table_grants 
                WHERE table_name = 'time_exclusions';
            `);
            
            if (permissions.rows.length > 0) {
                console.log('   Permissões encontradas:');
                permissions.rows.forEach(perm => {
                    console.log(`   - ${perm.grantee}: ${perm.privilege_type}`);
                });
            } else {
                console.log('   ❌ Nenhuma permissão específica encontrada');
            }
        } catch (permError) {
            console.log('   ❌ Erro ao verificar permissões:', permError.message);
        }

        console.log('\n🎯 RESUMO DO DEBUG:');
        console.log('================');
        console.log(`Local: ${localColumns.rows.length} colunas, ${localData.rows[0].count} registros`);
        console.log(`Railway: ${railwayColumns.rows.length} colunas, ${railwayData.rows[0].count} registros`);

    } catch (error) {
        console.error('❌ Erro geral:', error.message);
        console.error('Stack:', error.stack);
    } finally {
        await localClient.end();
        await railwayClient.end();
        console.log('\n🔌 Conexões fechadas');
    }
}

debugTimeExclusions(); 