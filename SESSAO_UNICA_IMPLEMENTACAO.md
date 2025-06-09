# Implementação de Sessão Única - Sistema de Agendamentos

## Resumo da Implementação

Foi implementado um sistema de **sessão única por usuário** que garante que apenas um dispositivo/navegador possa estar logado por vez com a mesma conta.

## Como Funciona

### 1. **Login (server/auth.ts)**
Quando um usuário faz login:
1. **Remove todas as sessões antigas** do usuário do banco de dados
2. **Limpa registros de sessões ativas** da tabela `active_sessions`
3. **Cria uma nova sessão** para o usuário atual
4. **Registra a nova sessão** como ativa na tabela `active_sessions`

### 2. **Middleware de Verificação (server/active-session.ts)**
A cada requisição autenticada:
1. **Verifica se a sessão atual está registrada** como ativa
2. **Se não estiver registrada:**
   - Verifica se existe outra sessão ativa para o usuário
   - Se existir outra sessão: **retorna erro 401** (sessão invalidada)
   - Se não existir: **registra a sessão atual** como ativa
3. **Se estiver registrada:** atualiza o timestamp de última atividade

### 3. **Verificação Periódica (client/src/App.tsx)**
No frontend:
1. **Verifica a validade da sessão a cada 60 segundos**
2. **Se a sessão for invalidada:** mostra notificação e redireciona para login
3. **Intercepta respostas 401** para detectar sessões invalidadas

## Estrutura do Banco de Dados

### Tabela `active_sessions`
```sql
CREATE TABLE active_sessions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  session_id VARCHAR(255) UNIQUE NOT NULL,
  user_email VARCHAR(255) NOT NULL,
  last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Tabela `session` (connect-pg-simple)
- Armazena as sessões do Express
- Contém dados da sessão em formato JSON na coluna `sess`

## Fluxo de Funcionamento

### Cenário: Usuário logado no celular tenta logar no computador

1. **Usuário A está logado no celular** (sessão ativa registrada)
2. **Usuário A faz login no computador:**
   - Sistema remove todas as sessões antigas (incluindo a do celular)
   - Cria nova sessão para o computador
   - Registra apenas a sessão do computador como ativa
3. **Celular tenta fazer uma requisição:**
   - Middleware verifica que a sessão do celular não está mais ativa
   - Retorna erro 401 com código `SESSION_INVALIDATED`
   - Frontend do celular detecta e mostra notificação de logout
4. **Apenas o computador permanece logado**

## Vantagens da Nova Implementação

### ✅ **Simplicidade**
- Lógica clara e direta
- Menos pontos de falha
- Fácil de debugar

### ✅ **Robustez**
- Não causa deslogamentos indesejados
- Trata erros graciosamente
- Fallback para permitir acesso em caso de erro

### ✅ **Performance**
- Verificações otimizadas
- Menos requisições ao banco
- Verificação periódica reduzida (60s)

### ✅ **Experiência do Usuário**
- Notificações claras sobre logout
- Não interrompe o uso normal
- Feedback visual adequado

## Configurações

### Frequência de Verificação
```typescript
// client/src/App.tsx
const intervalId = setInterval(checkSession, 60000); // 60 segundos
```

### Timeout de Sessão
```typescript
// server/auth.ts - configuração do express-session
cookie: {
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 dias
}
```

## Logs de Debug

O sistema gera logs detalhados para facilitar o debug:

```
Sessões antigas removidas para usuário 123
Registros de sessões ativas limpos para usuário 123
Nova sessão ativa registrada para usuário 123: sess_abc123
Sessão sess_xyz456 inválida para usuário 123 - existe outra sessão ativa
```

## Resolução de Problemas

### Problema: Usuário deslogando sozinho
**Causa:** Múltiplas abas/janelas do mesmo navegador
**Solução:** O sistema agora permite múltiplas abas do mesmo navegador (mesma sessão)

### Problema: Erro ao verificar sessão
**Causa:** Problemas de conectividade ou banco de dados
**Solução:** Sistema permite acesso em caso de erro para não bloquear usuário

### Problema: Sessão não invalidando em outro dispositivo
**Causa:** Dispositivo antigo não está fazendo requisições
**Solução:** Sessão será invalidada na próxima requisição do dispositivo antigo

## Monitoramento

Para monitorar o sistema:

```sql
-- Ver sessões ativas
SELECT * FROM active_sessions ORDER BY last_activity DESC;

-- Ver sessões por usuário
SELECT user_email, COUNT(*) as sessoes_ativas 
FROM active_sessions 
GROUP BY user_email;

-- Limpar sessões antigas (mais de 30 dias)
DELETE FROM active_sessions 
WHERE last_activity < NOW() - INTERVAL '30 days';
```

## Status da Implementação

✅ **Concluído:** Sistema de sessão única funcional
✅ **Testado:** Login/logout em múltiplos dispositivos
✅ **Otimizado:** Performance e experiência do usuário
✅ **Documentado:** Implementação e funcionamento

O sistema agora garante que apenas um dispositivo por usuário permaneça logado, resolvendo o problema de sessões múltiplas e deslogamentos indesejados. 