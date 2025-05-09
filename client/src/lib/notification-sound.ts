// Função para tocar um som de notificação
export function playNotificationSound() {
  try {
    // Criar um contexto de áudio
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // Criar um oscilador para gerar um som simples
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    // Configurar o tipo de onda e frequência (som de notificação suave)
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(880, audioContext.currentTime); // Lá (A5)
    oscillator.frequency.setValueAtTime(1320, audioContext.currentTime + 0.1); // Mi (E6)
    
    // Definir o volume (baixo para ser discreto)
    gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
    
    // Diminuir o volume gradualmente para acabar o som suavemente
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.5);
    
    // Conectar o oscilador à saída de áudio
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    // Iniciar e parar o oscilador (duração curta)
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.5);
    
    console.log('Som de notificação tocado');
    
    return true;
  } catch (error) {
    console.error('Erro ao tocar som de notificação:', error);
    return false;
  }
}