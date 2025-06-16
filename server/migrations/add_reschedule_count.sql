-- Adicionar coluna reschedule_count na tabela appointments
ALTER TABLE appointments ADD COLUMN reschedule_count INTEGER DEFAULT 0 NOT NULL;

-- Comentário explicativo
COMMENT ON COLUMN appointments.reschedule_count IS 'Contador de quantas vezes o agendamento foi reagendado pelo cliente'; 