import fetch from 'node-fetch';

async function testAvailability() {
  try {
    // Testar 16/06/2025 às 10:00 (segunda-feira)
    const url = 'http://localhost:3003/api/providers/14/availability?date=2025-06-16T10:00:00.000Z&serviceId=55&employeeId=14';
    console.log('Testando URL:', url);
    
    const response = await fetch(url);
    const data = await response.json();
    
    console.log('Status:', response.status);
    console.log('Resposta:', JSON.stringify(data, null, 2));
    
  } catch (error) {
    console.error('Erro:', error);
  }
}

testAvailability(); 