export class ApiClient {
  constructor() {
    this.defaultHeaders = {};
    this.timeout = 30000;
  }

  async sendRequest({ method, url, headers = {}, body = null, timeout = this.timeout, multipart = null, digest = null }) {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'sendRequest',
        data: {
          method,
          url,
          headers: { ...this.defaultHeaders, ...headers },
          body,
          timeout,
          multipart,
          digest,
        },
      });
      return response || this.formatError('Empty response from background', 'Error');
    } catch (error) {
      return this.formatError(error.message, 'Network Error');
    }
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

  validateUrl(url) {
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  }
}

export const apiClient = new ApiClient();
