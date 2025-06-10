import pkg from 'pg';
const { Client } = pkg;

async function importTimeExclusionsData() {
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

        console.log('\n📊 Importando dados da tabela time_exclusions...\n');

        // 1. Buscar dados do banco local
        console.log('📤 1. Buscando dados do banco local...');
        const localData = await localClient.query('SELECT * FROM time_exclusions ORDER BY id');
        console.log(`   Encontrados ${localData.rows.length} registros no banco local`);

        if (localData.rows.length === 0) {
            console.log('   ℹ️ Nenhum dado para importar');
            return;
        }

        // 2. Mostrar dados que serão importados
        console.log('\n📋 2. Dados a serem importados:');
        localData.rows.forEach((row, index) => {
            console.log(`   ${index + 1}. ID: ${row.id} | Provider: ${row.provider_id} | ${row.start_time}-${row.end_time} | ${row.title || 'Sem título'}`);
        });

        // 3. Limpar dados existentes no Railway (se houver)
        console.log('\n🗑️ 3. Limpando dados existentes no Railway...');
        const deleteResult = await railwayClient.query('DELETE FROM time_exclusions');
        console.log(`   Removidos ${deleteResult.rowCount} registros existentes`);

        // 4. Importar dados
        console.log('\n📥 4. Importando dados...');
        let importedCount = 0;

        for (const row of localData.rows) {
            try {
                await railwayClient.query(`
                    INSERT INTO time_exclusions (
                        id,
                        provider_id,
                        start_time,
                        end_time,
                        day_of_week,
                        name,
                        is_active,
                        created_at,
                        title,
                        recurrence,
                        recurrence_end_date
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                `, [
                    row.id,
                    row.provider_id,
                    row.start_time,
                    row.end_time,
                    row.day_of_week,
                    row.name,
                    row.is_active,
                    row.created_at,
                    row.title,
                    row.recurrence,
                    row.recurrence_end_date
                ]);
                
                importedCount++;
                console.log(`   ✅ Importado registro ID: ${row.id}`);
                
            } catch (error) {
                console.log(`   ❌ Erro ao importar registro ID ${row.id}:`, error.message);
            }
        }

        // 5. Atualizar sequência do ID
        console.log('\n🔄 5. Atualizando sequência do ID...');
        try {
            const maxId = await railwayClient.query('SELECT MAX(id) as max_id FROM time_exclusions');
            const nextId = (maxId.rows[0].max_id || 0) + 1;
            
            await railwayClient.query(`SELECT setval('time_exclusions_id_seq', $1, false)`, [nextId]);
            console.log(`   ✅ Sequência atualizada para próximo ID: ${nextId}`);
        } catch (error) {
            console.log('   ❌ Erro ao atualizar sequência:', error.message);
        }

        // 6. Verificar importação
        console.log('\n🔍 6. Verificando importação...');
        const railwayCount = await railwayClient.query('SELECT COUNT(*) as count FROM time_exclusions');
        console.log(`   Railway agora tem: ${railwayCount.rows[0].count} registros`);

        // 7. Testar inserção de novo registro
        console.log('\n🧪 7. Testando inserção de novo registro...');
        try {
            const testInsert = await railwayClient.query(`
                INSERT INTO time_exclusions (
                    provider_id,
                    start_time,
                    end_time,
                    day_of_week,
                    name,
                    title
                ) VALUES (
                    1,
                    '14:00',
                    '15:00',
                    2,
                    'Teste Pós-Importação',
                    'Teste de Nova Inserção'
                ) RETURNING id;
            `);

            console.log(`   ✅ Nova inserção bem-sucedida! ID: ${testInsert.rows[0].id}`);

            // Remover o registro de teste
            await railwayClient.query('DELETE FROM time_exclusions WHERE id = $1', [testInsert.rows[0].id]);
            console.log('   🗑️ Registro de teste removido');

        } catch (insertError) {
            console.log('   ❌ Erro na nova inserção:', insertError.message);
        }

        console.log('\n🎉 IMPORTAÇÃO CONCLUÍDA!');
        console.log(`📊 Resumo: ${importedCount}/${localData.rows.length} registros importados com sucesso`);

    } catch (error) {
        console.error('❌ Erro geral:', error.message);
    } finally {
        await localClient.end();
        await railwayClient.end();
        console.log('\n🔌 Conexões fechadas');
    }
}

importTimeExclusionsData(); 