const VPS_HOST = "45.61.148.87";
const VPS_PORT = 80;

Deno.serve(async (request) => {
  const url = new URL(request.url);
  const upgrade = request.headers.get("upgrade") || "";

  if (upgrade.toLowerCase() === "websocket") {
    try {
      const { socket: clientSocket, response } = Deno.upgradeWebSocket(request);
      const targetUrl = `ws://${VPS_HOST}:${VPS_PORT}${url.pathname}${url.search}`;
      
      const serverSocket = new WebSocket(targetUrl);

      serverSocket.onopen = () => {
        clientSocket.onmessage = (event) => {
          if (serverSocket.readyState === WebSocket.OPEN) {
            serverSocket.send(event.data);
          }
        };
      };

      serverSocket.onmessage = (event) => {
        if (clientSocket.readyState === WebSocket.OPEN) {
          clientSocket.send(event.data);
        }
      };

      serverSocket.onclose = () => { try { clientSocket.close(); } catch (_) {} };
      serverSocket.onerror = (error) => { try { clientSocket.close(); } catch (_) {} };
      clientSocket.onclose = () => { try { serverSocket.close(); } catch (_) {} };
      clientSocket.onerror = (error) => { try { serverSocket.close(); } catch (_) {} };

      return response;
    } catch (err) {
      return new Response("Failed to upgrade: " + err.message, { status: 500 });
    }
  }

  const targetUrl = `http://${VPS_HOST}:${VPS_PORT}${url.pathname}${url.search}`;
  const headers = new Headers(request.headers);
  headers.set("Host", VPS_HOST);

  try {
    const response = await fetch(targetUrl, {
      method: request.method,
      headers: headers,
      body: request.method !== "GET" && request.method !== "HEAD" ? request.body : null,
      redirect: "manual",
    });
    return response;
  } catch (err) {
    return new Response("Proxy error: " + err.message, { status: 502 });
  }
});
