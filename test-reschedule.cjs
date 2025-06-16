const fetch = require('node-fetch');

async function testReschedule() {
  try {
    console.log('🔄 Testando reagendamento...');
    
    // Primeiro, vamos buscar um agendamento existente
    const lookupResponse = await fetch('http://localhost:3003/api/appointments/lookup?phone=%2B55111111111111&providerId=14');
    const appointments = await lookupResponse.json();
    
    console.log('📋 Agendamentos encontrados:', appointments.length);
    
    if (appointments.length === 0) {
      console.log('❌ Nenhum agendamento encontrado para testar');
      return;
    }
    
    // Vamos criar um novo agendamento primeiro
    console.log('📅 Criando novo agendamento...');
    const createResponse = await fetch('http://localhost:3003/api/appointments/book', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        providerId: 14,
        serviceId: 55,
        clientName: 'Paulo Teste',
        clientPhone: '+55111111111111',
        date: '2025-06-14',
        time: '21:00'
      })
    });
    
    const newAppointment = await createResponse.json();
    console.log('✅ Novo agendamento criado:', newAppointment);
    
    if (!newAppointment.success) {
      console.log('❌ Erro ao criar agendamento:', newAppointment);
      return;
    }
    
    // Aguardar um pouco
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Agora vamos reagendar
    console.log('🔄 Reagendando agendamento...');
    const rescheduleResponse = await fetch(`http://localhost:3003/api/appointments/reschedule/${newAppointment.appointment.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        newDate: '2025-06-14',
        newTime: '22:00'
      })
    });
    
    const rescheduleResult = await rescheduleResponse.json();
    console.log('✅ Resultado do reagendamento:', rescheduleResult);
    
    if (rescheduleResult.message) {
      console.log('🎉 Reagendamento realizado com sucesso!');
      console.log('📧 Notificação deve ter sido enviada para o prestador');
    } else {
      console.log('❌ Erro no reagendamento:', rescheduleResult);
    }
    
  } catch (error) {
    console.error('❌ Erro no teste:', error);
  }
}

testReschedule(); 