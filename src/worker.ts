
import Acceptable from './acceptable';
import net from 'net';
import cp from 'child_process';

export default class Worker implements Acceptable {
    private entryPoint : string;
    private args : string[];
    private worker : cp.ChildProcess;

    constructor(entryPoint : string, args : string[]) {
        this.entryPoint = entryPoint;
        this.args = args;
        this.worker = this.fork();
    }

    accept(s : net.Socket) {
        this.worker.send('connection', s);
    }

    private fork() {
        let worker = cp.fork(this.entryPoint, this.args);
        worker.on('exit', (code, signal) => {
            throw new Error(`Worker prematurely exited.`);
        });
        return worker;
    }

    reload() {
        let worker = this.worker;
        this.worker = this.fork();

        worker.removeAllListeners('exit');
        worker.send('shutdown');
        worker.disconnect();

        // If it doesn't respond to shutdown in 2 seconds, forcibly kill.
        let timeout = setTimeout(() => {
            worker.kill();
        }, 2000);

        worker.on('exit', () => {
            clearTimeout(timeout);
        });
    }
}
