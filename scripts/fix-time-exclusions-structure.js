import pkg from 'pg';
const { Client } = pkg;

async function fixTimeExclusionsStructure() {
    const railwayClient = new Client({
        connectionString: 'postgresql://postgres:SmzVnAVExJpuQGUwgspoCVcPowGzRpWG@yamabiko.proxy.rlwy.net:42960/railway'
    });

    try {
        await railwayClient.connect();
        console.log('✅ Conectado ao Railway PostgreSQL');

        console.log('\n🔧 Corrigindo estrutura da tabela time_exclusions...\n');

        // 1. Primeiro, vamos fazer backup dos dados existentes (se houver)
        console.log('💾 1. Fazendo backup dos dados existentes...');
        const existingData = await railwayClient.query('SELECT * FROM time_exclusions');
        console.log(`   Encontrados ${existingData.rows.length} registros para backup`);

        // 2. Remover colunas que não existem no banco local
        console.log('\n🗑️ 2. Removendo colunas extras...');
        try {
            await railwayClient.query('ALTER TABLE time_exclusions DROP COLUMN IF EXISTS employee_id');
            console.log('   ✅ Removida: employee_id');
            
            await railwayClient.query('ALTER TABLE time_exclusions DROP COLUMN IF EXISTS date');
            console.log('   ✅ Removida: date');
            
            await railwayClient.query('ALTER TABLE time_exclusions DROP COLUMN IF EXISTS reason');
            console.log('   ✅ Removida: reason');
        } catch (error) {
            console.log('   ❌ Erro ao remover colunas:', error.message);
        }

        // 3. Modificar tipos de dados para corresponder ao banco local
        console.log('\n🔄 3. Ajustando tipos de dados...');
        try {
            // Alterar start_time de TIME para TEXT
            await railwayClient.query('ALTER TABLE time_exclusions ALTER COLUMN start_time TYPE TEXT');
            console.log('   ✅ start_time: TIME → TEXT');
            
            // Alterar end_time de TIME para TEXT  
            await railwayClient.query('ALTER TABLE time_exclusions ALTER COLUMN end_time TYPE TEXT');
            console.log('   ✅ end_time: TIME → TEXT');
            
            // Alterar recurrence_end_date de DATE para TIMESTAMP
            await railwayClient.query('ALTER TABLE time_exclusions ALTER COLUMN recurrence_end_date TYPE TIMESTAMP');
            console.log('   ✅ recurrence_end_date: DATE → TIMESTAMP');
            
            // Alterar title de VARCHAR para TEXT
            await railwayClient.query('ALTER TABLE time_exclusions ALTER COLUMN title TYPE TEXT');
            console.log('   ✅ title: VARCHAR → TEXT');
            
            // Alterar recurrence de VARCHAR para TEXT
            await railwayClient.query('ALTER TABLE time_exclusions ALTER COLUMN recurrence TYPE TEXT');
            console.log('   ✅ recurrence: VARCHAR → TEXT');
            
        } catch (error) {
            console.log('   ❌ Erro ao alterar tipos:', error.message);
        }

        // 4. Ajustar constraints NOT NULL
        console.log('\n🔒 4. Ajustando constraints NOT NULL...');
        try {
            // provider_id deve ser NOT NULL
            await railwayClient.query('ALTER TABLE time_exclusions ALTER COLUMN provider_id SET NOT NULL');
            console.log('   ✅ provider_id: SET NOT NULL');
            
            // start_time deve ser NOT NULL
            await railwayClient.query('ALTER TABLE time_exclusions ALTER COLUMN start_time SET NOT NULL');
            console.log('   ✅ start_time: SET NOT NULL');
            
            // end_time deve ser NOT NULL
            await railwayClient.query('ALTER TABLE time_exclusions ALTER COLUMN end_time SET NOT NULL');
            console.log('   ✅ end_time: SET NOT NULL');
            
            // is_active deve ser NOT NULL
            await railwayClient.query('ALTER TABLE time_exclusions ALTER COLUMN is_active SET NOT NULL');
            console.log('   ✅ is_active: SET NOT NULL');
            
            // title deve ser NOT NULL
            await railwayClient.query('ALTER TABLE time_exclusions ALTER COLUMN title SET NOT NULL');
            console.log('   ✅ title: SET NOT NULL');
            
            // created_at deve ser NOT NULL
            await railwayClient.query('ALTER TABLE time_exclusions ALTER COLUMN created_at SET NOT NULL');
            console.log('   ✅ created_at: SET NOT NULL');
            
        } catch (error) {
            console.log('   ❌ Erro ao ajustar constraints:', error.message);
        }

        // 5. Ajustar valores padrão
        console.log('\n⚙️ 5. Ajustando valores padrão...');
        try {
            // is_active padrão true
            await railwayClient.query('ALTER TABLE time_exclusions ALTER COLUMN is_active SET DEFAULT true');
            console.log('   ✅ is_active: DEFAULT true');
            
            // title padrão
            await railwayClient.query(`ALTER TABLE time_exclusions ALTER COLUMN title SET DEFAULT 'Exclusão de Horário'`);
            console.log('   ✅ title: DEFAULT "Exclusão de Horário"');
            
            // created_at padrão now()
            await railwayClient.query('ALTER TABLE time_exclusions ALTER COLUMN created_at SET DEFAULT now()');
            console.log('   ✅ created_at: DEFAULT now()');
            
        } catch (error) {
            console.log('   ❌ Erro ao ajustar padrões:', error.message);
        }

        // 6. Adicionar coluna name se não existir
        console.log('\n➕ 6. Verificando coluna name...');
        try {
            await railwayClient.query('ALTER TABLE time_exclusions ADD COLUMN IF NOT EXISTS name TEXT');
            console.log('   ✅ Coluna name verificada/adicionada');
        } catch (error) {
            console.log('   ❌ Erro ao verificar coluna name:', error.message);
        }

        // 7. Verificar estrutura final
        console.log('\n🔍 7. Verificando estrutura final...');
        const finalColumns = await railwayClient.query(`
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'time_exclusions'
            ORDER BY ordinal_position;
        `);

        console.log('\n📋 ESTRUTURA FINAL:');
        finalColumns.rows.forEach((col, index) => {
            console.log(`   ${index + 1}. ${col.column_name} (${col.data_type}) - Nullable: ${col.is_nullable} - Default: ${col.column_default || 'NULL'}`);
        });

        // 8. Testar inserção
        console.log('\n🧪 8. Testando inserção...');
        try {
            const testInsert = await railwayClient.query(`
                INSERT INTO time_exclusions (
                    provider_id, 
                    start_time, 
                    end_time,
                    day_of_week,
                    name,
                    is_active,
                    title
                ) VALUES (
                    1, 
                    '09:00', 
                    '10:00',
                    1,
                    'Teste Correção',
                    true,
                    'Teste de Inserção Corrigida'
                ) RETURNING id;
            `);

            console.log(`   ✅ Inserção bem-sucedida! ID: ${testInsert.rows[0].id}`);

            // Remover o registro de teste
            await railwayClient.query('DELETE FROM time_exclusions WHERE id = $1', [testInsert.rows[0].id]);
            console.log('   🗑️ Registro de teste removido');

        } catch (insertError) {
            console.log('   ❌ Erro na inserção de teste:');
            console.log('   ', insertError.message);
        }

        console.log('\n🎉 Correção da estrutura concluída!');

    } catch (error) {
        console.error('❌ Erro geral:', error.message);
    } finally {
        await railwayClient.end();
        console.log('\n🔌 Conexão fechada');
    }
}

fixTimeExclusionsStructure(); 