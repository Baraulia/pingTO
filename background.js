// background.js - Service Worker

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'sendRequest') {
    handleRequest(message.data).then(sendResponse);
    return true;
  }
});

async function handleRequest({ method, url, headers, body }) {
  const startTime = performance.now();
  
  try {
    const fetchOptions = {
      method,
      headers: headers || {},
    };

    if (body && method !== 'GET' && method !== 'HEAD') {
      fetchOptions.body = body;
    }

    const response = await fetch(url, fetchOptions);
    const endTime = performance.now();
    const time = Math.round(endTime - startTime);

    let responseBody;
    const contentType = response.headers.get('content-type') || '';
    
    if (contentType.includes('application/json')) {
      responseBody = await response.json();
      responseBody = JSON.stringify(responseBody, null, 2);
    } else {
      responseBody = await response.text();
    }

    const responseHeaders = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    return {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
      body: responseBody,
      time,
      size: new Blob([responseBody]).size,
      ok: response.ok,
    };
  } catch (error) {
    return {
      error: error.message,
      status: 0,
      statusText: 'Network Error',
      body: `Error: ${error.message}`,
      time: 0,
      size: 0,
      ok: false,
    };
  }
}