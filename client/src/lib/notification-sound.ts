// Função para tocar um som de notificação
export function playNotificationSound() {
  try {
    // Usar o elemento de áudio HTML para maior compatibilidade
    const audio = new Audio();
    
    // Criar o som diretamente usando osciladores para maior controle
    try {
      // Criar um contexto de áudio
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Criar osciladores para uma sequência de tons
      const oscillator1 = audioContext.createOscillator();
      const oscillator2 = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      // Configurar o primeiro oscilador (tom mais alto)
      oscillator1.type = 'sine';
      oscillator1.frequency.setValueAtTime(1320, audioContext.currentTime); // Mi (E6)
      
      // Configurar o segundo oscilador (tom mais baixo)
      oscillator2.type = 'sine';
      oscillator2.frequency.setValueAtTime(880, audioContext.currentTime + 0.2); // Lá (A5)
      
      // Aumentar o volume para ser mais audível
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      
      // Conectar os osciladores
      oscillator1.connect(gainNode);
      oscillator2.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      // Tocar os sons em sequência
      oscillator1.start(audioContext.currentTime);
      oscillator1.stop(audioContext.currentTime + 0.2);
      
      oscillator2.start(audioContext.currentTime + 0.2);
      oscillator2.stop(audioContext.currentTime + 0.4);
      
      console.log('Som de notificação tocado com Web Audio API');
      return true;
    } catch (audioApiError) {
      console.warn('Erro com Web Audio API, usando fallback de áudio:', audioApiError);
      
      // Fallback usando beep simples com o elemento Audio
      audio.src = 'data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU9vT18A';
      audio.play().catch(e => console.error('Erro ao tocar áudio fallback:', e));
      return true;
    }
  } catch (error) {
    console.error('Erro ao tocar som de notificação:', error);
    return false;
  }
}