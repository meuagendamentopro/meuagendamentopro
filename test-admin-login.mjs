// Script para testar o login com o usuário admin
import axios from 'axios';

async function testAdminLogin() {
  try {
    console.log('Testando login com usuário admin e senha admin123...');
    
    const response = await axios.post('http://localhost:3003/api/login', {
      username: 'admin',
      password: 'admin123'
    }, {
      withCredentials: true,
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Resposta do servidor:', response.status, response.statusText);
    console.log('Dados da resposta:', response.data);
    
    if (response.status === 200) {
      console.log('Login bem-sucedido!');
    } else {
      console.log('Falha no login.');
    }
  } catch (error) {
    console.error('Erro ao testar login:', error.message);
    if (error.response) {
      console.error('Detalhes do erro:', error.response.status, error.response.data);
    }
  }
}

testAdminLogin();
