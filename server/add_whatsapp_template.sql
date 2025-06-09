-- Adicionar coluna whatsapp_template_appointment à tabela providers
ALTER TABLE providers 
ADD COLUMN IF NOT EXISTS whatsapp_template_appointment TEXT;
