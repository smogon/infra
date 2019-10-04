
let url = new URL('/__refresh-proxy__', window.location.href);
url.protocol = url.protocol.replace('http', 'ws');

let ws = new WebSocket(url.href);

ws.onmessage = (event) => {
    if (event.data === 'refresh') {
        window.location.reload();
    }
}
