
Flexible build & server infrastructure.

Building this repository
========================

`yarn && yarn build`

Simple example
==============

See [examples/hello-world](examples/hello-world).

Usage
=====

From [src/index.ts](src/index.ts):

```typescript
program.option('-c, --config <file>', 'Configuration file')

program
    .command('build')

program
    .command('start [args...]')
    .option('-p, --port <port>', 'Port')
    .option('--open-browser', 'Open browser')
    .option('--skip-build', 'Skip build')
    .option('--refresh', 'Refresh the browser on build')

```

Configuration format
====================

See [src/config.ts](src/config.ts).


Worker requirements
===================

- Your worker should not bind its own server socket. Listen for the process message `connection` and manually inject the connection into your server.

- Your worker is given the opportunity to gracefully shutdown on process message `shutdown`.

Example of the former:

```typescript
declare server : http.Server;

process.on('message', (msg, h) => {
    if (msg === 'connection') {
        server.emit('connection', h);
    }
});
```
