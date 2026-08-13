// modules/websocket.js
export class WebSocketManager {
  constructor() {
    this.ws = null;
    this.isConnected = false;
    this.messageCallbacks = [];
  }

  connect(url) {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(url);
        this.ws.onopen = () => {
          this.isConnected = true;
          resolve();
        };
        this.ws.onerror = (error) => {
          reject(error);
        };
        this.ws.onmessage = (event) => {
          this.messageCallbacks.forEach(cb => cb(event.data));
        };
        this.ws.onclose = () => {
          this.isConnected = false;
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  send(message) {
    if (this.ws && this.isConnected) {
      this.ws.send(message);
      return true;
    }
    return false;
  }

  close() {
    if (this.ws) {
      this.ws.close();
      this.isConnected = false;
    }
  }

  onMessage(callback) {
    this.messageCallbacks.push(callback);
  }

  isConnected() {
    return this.isConnected;
  }
}