# Configuração do Mercado Pago para PIX

## Requisitos
Para que o sistema de pagamento PIX funcione corretamente no Mercado Pago, é necessário realizar algumas configurações:

### 1. Credenciais de Produção
- É necessário usar as credenciais de **produção** do Mercado Pago, não as de teste
- O token de acesso deve começar com `APP_USR-` (produção), não com `TEST-` (teste)
- A conta deve estar verificada no Mercado Pago

### 2. Configurar Webhook no Mercado Pago
Para receber notificações de pagamentos, é necessário configurar um webhook no painel do Mercado Pago:

1. Faça login na sua conta Mercado Pago
2. Acesse: Dashboard > Configurações > Webhooks
3. Clique em "Adicionar Webhook"
4. Adicione a URL: `https://meuagendamento.replit.app/api/payments/webhook`
5. Selecione apenas os eventos de tipo "payment" (pagamento)
6. Salve as configurações

### 3. Modo de Homologação PIX
Para utilizar o PIX em produção, é necessário que a chave PIX esteja homologada:

1. Acesse o Mercado Pago e verifique se sua conta tem uma chave PIX cadastrada
2. Certifique-se de que sua conta é uma conta vendedor e está verificada
3. Se necessário, solicite a homologação do PIX ao Mercado Pago

### 4. Verificações na Aplicação
A aplicação já está configurada para:

- Enviar valores monetários com formato correto (2 casas decimais)
- Registrar a URL de notificação para webhooks
- Processar webhooks de confirmação de pagamento
- Expirar códigos PIX após 5 minutos

## Solução de Problemas

### QR Code não é gerado ou inválido
- Verificar se está usando o token de **produção** (APP_USR-...)
- Confirmar se a conta tem uma chave PIX cadastrada
- Verificar se a conta está verificada no Mercado Pago

### Pagamento não é confirmado automaticamente
- Verificar se o webhook está configurado corretamente
- Confirmar se a URL do webhook está acessível (sem firewalls bloqueando)
- Verificar os logs do servidor para detectar chamadas de webhook recebidas

### Erros de "Transação não concluída"
- Verificar se a conta Mercado Pago tem saldo suficiente
- Confirmar que o CPF/CNPJ informado é válido
- Verificar se a conta está habilitada para receber PIX