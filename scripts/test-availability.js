const fetch = require('node-fetch');

async function testAvailability() {
  try {
    console.log('Testando endpoint de disponibilidade...');
    
    // Testar com provider 14 e data futura
    const providerId = 14;
    const date = '2025-06-14'; // Data futura
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
      availableSlots.forEach(slot => {
        console.log(`- ${slot.time}`);
      });
    }
    
  } catch (error) {
    console.error('Erro:', error.message);
  }
}

testAvailability(); 