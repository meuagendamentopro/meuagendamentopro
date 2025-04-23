import bcrypt from 'bcrypt';
import { db } from '../server/db';
import { users } from '../shared/schema';
import { eq } from 'drizzle-orm';

async function updatePassword() {
  try {
    const username = 'carlos';
    const password = 'password123';
    const hashedPassword = await bcrypt.hash(password, 10);

    // Atualiza a senha do usuário
    const result = await db
      .update(users)
      .set({ password: hashedPassword })
      .where(eq(users.username, username))
      .returning();

    if (result.length > 0) {
      console.log(`Senha atualizada com sucesso para o usuário ${username}`);
    } else {
      console.log(`Usuário ${username} não encontrado`);
    }
  } catch (error) {
    console.error('Erro ao atualizar senha:', error);
  } finally {
    // Fecha a conexão com o banco
    process.exit(0);
  }
}

updatePassword();