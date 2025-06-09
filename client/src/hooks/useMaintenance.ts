import { useState, useEffect } from 'react';

export function useMaintenance() {
  const [isMaintenance, setIsMaintenance] = useState<boolean>(
    // Verifica se há um valor salvo no localStorage ou usa false como padrão
    () => localStorage.getItem('maintenanceMode') === 'true'
  );

  // Atualiza o localStorage quando o estado de manutenção mudar
  useEffect(() => {
    if (isMaintenance) {
      localStorage.setItem('maintenanceMode', 'true');
    } else {
      localStorage.removeItem('maintenanceMode');
    }
  }, [isMaintenance]);

  // Verifica periodicamente o status de manutenção
  useEffect(() => {
    const checkMaintenance = () => {
      // Aqui você pode fazer uma chamada para uma API para verificar o status de manutenção
      // Por enquanto, estamos usando apenas o estado local
      console.log('Verificando status de manutenção...');
    };

    // Verifica a cada 5 minutos
    const interval = setInterval(checkMaintenance, 5 * 60 * 1000);
    checkMaintenance(); // Verifica imediatamente ao montar

    return () => clearInterval(interval);
  }, []);

  const enableMaintenance = () => {
    setIsMaintenance(true);
  };

  const disableMaintenance = () => {
    setIsMaintenance(false);
  };

  return {
    isMaintenance,
    enableMaintenance,
    disableMaintenance,
  };
}
