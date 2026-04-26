import { useAppStore } from './store';

export class AlertWebSocket {
  private ws: WebSocket | null = null;
  private isIntentionalClose = false;
  
  async connect(onAlert: (data: any) => void) {
    this.isIntentionalClose = false;
    const { activeDomain: domain, jwtToken: token } = useAppStore.getState();

    if (!domain || !token) return;

    // Emular el transporte websocket nativo de Socket.IO
    this.ws = new WebSocket(`wss://${domain}/socket.io/?EIO=3&transport=websocket&token=${token}`);
    
    this.ws.onmessage = (event) => {
      try {
        const text = String(event.data);
        
        // Responder al Engine.IO PING ('2') con PONG ('3') para mantener conexión
        if (text.startsWith('2')) {
          this.ws?.send('3');
          return;
        }

        // Manejar mensajes EVENT de Socket.IO ('42')
        if (text.startsWith('42')) {
          const payload = JSON.parse(text.substring(2));
          // payload e.g. ["eventName", { data }]
          const eventName = payload[0];
          const eventData = payload[1];
          
          if (eventName === 'alert' || eventName === 'statistics' || eventData?.probability) {
            onAlert(eventData);
          }
        } else if (text.startsWith('{')) {
          // Fallback por si en algún momento mandan JSON puro
          const data = JSON.parse(text);
          if (data?.type === 'alert' || data?.probability) {
             onAlert(data);
          }
        }
      } catch (e) {
        console.log('Error parseando WS:', event.data, e);
      }
    };

    this.ws.onclose = () => {
      if (!this.isIntentionalClose) {
        setTimeout(() => this.connect(onAlert), 3000);
      }
    };
  }

  disconnect() {
    this.isIntentionalClose = true;
    this.ws?.close();
    this.ws = null;
  }
}

export const wsService = new AlertWebSocket();
