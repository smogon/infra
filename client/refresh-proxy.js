
let url = new URL('/__refresh-proxy__', window.location.href);
url.protocol = url.protocol.replace('http', 'ws');

let ws = new WebSocket(url.href);
let dead = false;

ws.onmessage = (event) => {
    if (event.data === 'refresh' && !dead) {
        dead = true;
        window.location.reload();
    }
}
