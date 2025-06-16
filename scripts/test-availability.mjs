import fetch from 'node-fetch';

async function testAvailability() {
  try {
    console.log('Testando endpoint de disponibilidade...');
    
    // Testar com provider 14 e data 16/06/2025 (SEGUNDA-FEIRA CORRETA)
    const providerId = 14;
    const date = '2025-06-16'; // Segunda-feira correta
    const employeeId = 14;
    
    const url = `http://localhost:3003/api/appointments/availability?providerId=${providerId}&date=${date}&employeeId=${employeeId}`;
    console.log('URL:', url);
    
    const response = await fetch(url);
    const data = await response.json();
    
    console.log('Status:', response.status);
    console.log('Resposta:', JSON.stringify(data, null, 2));
    
    if (data.slots) {
      const availableSlots = data.slots.filter(slot => slot.available);
      console.log(`\nSlots disponíveis: ${availableSlots.length}`);
      console.log('Primeiros 5 horários disponíveis:');
      availableSlots.slice(0, 5).forEach(slot => {
        console.log(`- ${slot.time}`);
      });
    }
    
  } catch (error) {
    console.error('Erro:', error.message);
  }
}

testAvailability(); 