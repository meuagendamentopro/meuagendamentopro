# Configuração do Mercado Pago para PIX

## Requisitos
Para que o sistema de pagamento PIX funcione corretamente no Mercado Pago, é necessário realizar algumas configurações:

### 1. Credenciais de Produção
- É necessário usar as credenciais de **produção** do Mercado Pago, não as de teste
- O token de acesso deve começar com `APP_USR-` (produção), não com `TEST-` (teste)
- A conta deve estar verificada no Mercado Pago

### 2. Integração com PIX (Obrigatório)
De acordo com a [documentação oficial](https://www.mercadopago.com.br/developers/pt/docs/checkout-api/integration-configuration/integrate-with-pix):

1. Certifique-se que sua Conta Mercado Pago está verificada e é do tipo Vendedor
2. Cadastre uma chave PIX na sua conta Mercado Pago:
   - Acesse "Seu perfil" > "Sua conta" > "PIX" > "Suas chaves"
   - Cadastre ao menos uma chave (aleatória, CPF, email ou telefone)
3. Configure sua integração como "Empresa" no Mercado Pago
   - Isso é essencial para que o PIX seja ativado na sua conta
   - Acesse "Seu perfil" > "Configurações" > "Dados da empresa"

### 3. Configurar Webhook no Mercado Pago (Obrigatório)
Para receber notificações de pagamentos, é necessário configurar um webhook no painel do Mercado Pago:

1. Faça login na sua conta Mercado Pago
2. Acesse: "Seu perfil" > "Configurações" > "Webhooks" (ou "Notificações")
3. Clique em "Adicionar Webhook"
4. Adicione a URL: `https://meuagendamento.replit.app/api/payments/webhook`
5. Selecione apenas os eventos de tipo "payment" (pagamento)
6. Salve as configurações

> **IMPORTANTE**: Sem o webhook configurado, o sistema não será notificado quando um pagamento for concluído.

### 4. Verificações na Aplicação
A aplicação já está configurada para:

- Enviar valores monetários com formato correto (2 casas decimais)
- Registrar a URL de notificação para webhooks
- Processar webhooks de confirmação de pagamento
- Expirar códigos PIX após 30 minutos (requisito mínimo do Mercado Pago)

## Solução de Problemas

### QR Code não é gerado ou inválido
- Verificar se está usando o token de **produção** (APP_USR-...)
- Confirmar se a conta tem uma chave PIX cadastrada
- Verificar se a conta está verificada no Mercado Pago
- Confirmar se sua conta está configurada como "Empresa" na integração

### Pagamento não é confirmado automaticamente
- Verificar se o webhook está configurado corretamente
- Confirmar se a URL do webhook está acessível (sem firewalls bloqueando)
- Verificar os logs do servidor para detectar chamadas de webhook recebidas

### Erros de "Transação não concluída"
- Verificar se a conta Mercado Pago tem saldo suficiente
- Confirmar que o CPF/CNPJ informado é válido
- Verificar se a conta está habilitada para receber PIX

### Erro de expiração da data
- O Mercado Pago exige que a data de expiração do PIX seja de no mínimo 30 minutos
- O sistema está configurado para usar o tempo mínimo exigido (30 minutos)
- Certifique-se que o relógio do servidor está corretamente sincronizado

### Logs e Depuração
Para verificar se o webhook está funcionando:
1. Realize um pagamento de teste usando o QR Code
2. Verifique nos logs do servidor se há registros de chamadas à rota `/api/payments/webhook`
3. Confirme no painel do Mercado Pago se há notificações enviadas e seu status

### Formato de data correto
O Mercado Pago exige que a data de expiração seja enviada no formato ISO 8601 sem milissegundos:
- Formato correto: `2025-05-12T23:37:10Z` (não pode ter a parte de milissegundos)
- Formato incorreto: `2025-05-12T23:37:10.123Z` (com milissegundos)
- A data deve estar no futuro e respeitar o tempo mínimo de 30 minutos
- O sistema está configurado para usar 2 horas (120 minutos) como prazo de expiração para maior segurança

### Tempo de processamento do pagamento
- Após realizar o pagamento via PIX, pode levar até 1 minuto para o Mercado Pago enviar a notificação
- O sistema verificará o status automaticamente, mas você também pode clicar no botão "Verificar pagamento"
- Se após 2 minutos o pagamento não for confirmado, verifique se o webhook está configurado corretamente