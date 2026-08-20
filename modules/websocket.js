export class WebSocketManager {
  constructor() {
    this.socket = null;
    this.connected = false;
    this.messageCallbacks = [];
  }

  connect(url) {
    return new Promise((resolve, reject) => {
      try {
        this.close();
        this.socket = new WebSocket(url);
        this.socket.onopen = () => {
          this.connected = true;
          resolve();
        };
        this.socket.onerror = () => {
          reject(new Error('WebSocket connection error'));
        };
        this.socket.onmessage = (event) => {
          this.messageCallbacks.forEach((cb) => cb(event.data));
        };
        this.socket.onclose = () => {
          this.connected = false;
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  send(message) {
    if (this.socket && this.connected && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(message);
      return true;
    }
    return false;
  }

  close() {
    if (this.socket) {
      this.socket.onopen = null;
      this.socket.onerror = null;
      this.socket.onmessage = null;
      this.socket.onclose = null;
      if (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING) {
        this.socket.close();
      }
      this.socket = null;
    }
    this.connected = false;
  }

  onMessage(callback) {
    this.messageCallbacks.push(callback);
    return () => {
      this.messageCallbacks = this.messageCallbacks.filter((cb) => cb !== callback);
    };
  }

  isOpen() {
    return this.connected && this.socket?.readyState === WebSocket.OPEN;
  }
}
