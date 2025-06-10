-- Adicionar campo hide_whatsapp_popup à tabela users
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS hide_whatsapp_popup BOOLEAN NOT NULL DEFAULT FALSE;

-- Adicionar comentário explicativo
COMMENT ON COLUMN users.hide_whatsapp_popup IS 'Preferência do usuário para não mostrar popup do WhatsApp'; 