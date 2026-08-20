export class ApiClient {
  constructor() {
    this.defaultHeaders = {};
    this.timeout = 30000;
  }

  async sendRequest(payload) {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'sendRequest',
        data: {
          timeout: this.timeout,
          ...payload,
          headers: { ...this.defaultHeaders, ...(payload.headers || {}) },
        },
      });
      return response || this.formatError('Empty response from background', 'Error');
    } catch (error) {
      return this.formatError(error.message, 'Network Error');
    }
  }

  async cancel(requestId) {
    return chrome.runtime.sendMessage({ type: 'cancelRequest', requestId });
  }

  formatError(message, statusText = 'Error') {
    return {
      ok: false,
      status: 0,
      statusText,
      headers: {},
      body: message,
      time: 0,
      size: 0,
      error: message,
    };
  }
}

export const apiClient = new ApiClient();
