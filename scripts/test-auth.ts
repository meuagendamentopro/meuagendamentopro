import bcrypt from "bcrypt";

async function testPasswordMatch() {
  // Hash da senha armazenada no banco de dados
  const storedHash = '$2b$10$5QCy5vy6nMpxqjhPnljcPuuDn3S1.KlQ/vykHnP1MZx95Sy9/rHfS';
  
  // Senha fornecida pelo usuário
  const suppliedPassword = 'password123';
  
  console.log(`Testando senha '${suppliedPassword}' contra hash armazenado...`);
  
  try {
    // Teste com bcrypt.compare
    const match = await bcrypt.compare(suppliedPassword, storedHash);
    console.log(`Resultado de bcrypt.compare: ${match ? 'COINCIDE ✅' : 'NÃO COINCIDE ❌'}`);
    
    // Se não coincide, vamos criar um novo hash e ver como fica
    if (!match) {
      console.log('\nCriando um novo hash para a mesma senha:');
      const newHash = await bcrypt.hash(suppliedPassword, 10);
      console.log(`Novo hash gerado: ${newHash}`);
      
      // Verificar o novo hash
      const newMatch = await bcrypt.compare(suppliedPassword, newHash);
      console.log(`Verificação do novo hash: ${newMatch ? 'COINCIDE ✅' : 'NÃO COINCIDE ❌'}`);
      
      console.log('\nAtualização recomendada:');
      console.log('Você pode atualizar a senha do admin com o seguinte comando SQL:');
      console.log(`UPDATE users SET password = '${newHash}' WHERE username = 'admin';`);
    }
  } catch (error) {
    console.error('Erro durante a verificação:', error);
  }
}

testPasswordMatch();