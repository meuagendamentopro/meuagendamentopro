const { drizzle } = require('drizzle-orm/better-sqlite3');
const Database = require('better-sqlite3');
const { eq, and, gte, lte, or, sql } = require('drizzle-orm');

// Importar schemas
const schema = require('./server/db/schema.js');
const { appointments: appointmentsTable, providers, employees } = schema;

// Conectar ao banco
const sqlite = new Database('./server/db/database.sqlite');
const db = drizzle(sqlite);

async function debugAvailability() {
  try {
    console.log('=== DEBUG: Verificando disponibilidade para 16/06/2025 ===\n');
    
    const providerId = 14;
    const date = '2025-06-16';
    const employeeId = 1; // Assumindo que é o Func 1
    
    // 1. Verificar agendamentos existentes para o dia
    console.log('1. Buscando agendamentos existentes para 16/06/2025...');
    
    const [year, month, day] = date.split('-').map(Number);
    const selectedDate = new Date(year, month - 1, day);
    
    const startOfDay = new Date(selectedDate);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(selectedDate);
    endOfDay.setHours(23, 59, 59, 999);
    
    console.log('Data selecionada:', selectedDate);
    console.log('Início do dia:', startOfDay);
    console.log('Fim do dia:', endOfDay);
    
    const existingAppointments = await db
      .select({
        id: appointmentsTable.id,
        date: appointmentsTable.date,
        endTime: appointmentsTable.endTime,
        employeeId: appointmentsTable.employeeId,
        status: appointmentsTable.status,
        clientId: appointmentsTable.clientId,
      })
      .from(appointmentsTable)
      .where(
        and(
          eq(appointmentsTable.providerId, providerId),
          gte(appointmentsTable.date, startOfDay),
          lte(appointmentsTable.date, endOfDay)
        )
      );
    
    console.log(`\nEncontrados ${existingAppointments.length} agendamentos para o dia:`);
    existingAppointments.forEach(apt => {
      const startTime = new Date(apt.date);
      const endTime = new Date(apt.endTime);
      console.log(`- ID: ${apt.id}, Funcionário: ${apt.employeeId}, Status: ${apt.status}`);
      console.log(`  Horário: ${startTime.toLocaleString('pt-BR')} - ${endTime.toLocaleString('pt-BR')}`);
      console.log(`  Data raw: ${apt.date} - ${apt.endTime}`);
    });
    
    // 2. Verificar especificamente o horário das 10h00
    console.log('\n2. Verificando conflito para horário 10:00...');
    
    const slotTime = new Date(selectedDate);
    slotTime.setHours(10, 0, 0, 0);
    const slotEnd = new Date(slotTime);
    slotEnd.setMinutes(slotEnd.getMinutes() + 30);
    
    console.log('Slot 10:00:', slotTime.toLocaleString('pt-BR'));
    console.log('Slot fim:', slotEnd.toLocaleString('pt-BR'));
    
    // Filtrar apenas agendamentos confirmados/pendentes
    const activeAppointments = existingAppointments.filter(apt => 
      apt.status === 'confirmed' || apt.status === 'pending'
    );
    
    console.log(`\nAgendamentos ativos (confirmed/pending): ${activeAppointments.length}`);
    
    activeAppointments.forEach(appointment => {
      const appointmentStart = new Date(appointment.date);
      const appointmentEnd = new Date(appointment.endTime);
      
      console.log(`\nVerificando agendamento ID ${appointment.id}:`);
      console.log(`- Funcionário: ${appointment.employeeId} (buscando: ${employeeId})`);
      console.log(`- Início: ${appointmentStart.toLocaleString('pt-BR')}`);
      console.log(`- Fim: ${appointmentEnd.toLocaleString('pt-BR')}`);
      
      // Verificar se é do mesmo funcionário
      const sameEmployee = employeeId && appointment.employeeId ? 
        parseInt(employeeId) === appointment.employeeId : true;
      
      console.log(`- Mesmo funcionário: ${sameEmployee}`);
      
      if (sameEmployee) {
        // Verificar sobreposição
        const hasConflict = slotTime < appointmentEnd && slotEnd > appointmentStart;
        console.log(`- Conflito com slot 10:00: ${hasConflict}`);
        
        if (hasConflict) {
          console.log('  *** ESTE AGENDAMENTO DEVERIA BLOQUEAR O SLOT 10:00 ***');
        }
      }
    });
    
    // 3. Simular a lógica completa do endpoint
    console.log('\n3. Simulando lógica completa do endpoint...');
    
    const isOccupied = activeAppointments.some(appointment => {
      const appointmentStart = new Date(appointment.date);
      const appointmentEnd = new Date(appointment.endTime);
      
      // Se há employeeId específico, verificar apenas agendamentos do mesmo funcionário
      if (employeeId && appointment.employeeId) {
        if (parseInt(employeeId) !== appointment.employeeId) {
          return false; // Ignorar agendamentos de outros funcionários
        }
      }
      
      // Verificar sobreposição de horários
      const slotEnd = new Date(slotTime);
      slotEnd.setMinutes(slotEnd.getMinutes() + 30);
      
      const hasConflict = slotTime < appointmentEnd && slotEnd > appointmentStart;
      
      return hasConflict;
    });
    
    console.log(`\nResultado final - Slot 10:00 ocupado: ${isOccupied}`);
    
    if (!isOccupied) {
      console.log('\n*** PROBLEMA IDENTIFICADO: O slot deveria estar ocupado mas não está! ***');
    }
    
  } catch (error) {
    console.error('Erro no debug:', error);
  }
}

debugAvailability(); 