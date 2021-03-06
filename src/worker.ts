
import Acceptable from './acceptable';
import net from 'net';
import cp from 'child_process';

export interface Worker extends Acceptable {
    reload() : void;
    shutdown() : Promise<void>;
}

export class Process implements Worker {
    private entryPoint : string;
    private args : string[];
    private state : {
        mode : 'accepting',
        worker : cp.ChildProcess
    } | {
        mode : 'buffering',
        buffer : net.Socket[]
    };

    constructor(entryPoint : string, args : string[]) {
        this.entryPoint = entryPoint;
        this.args = args;
        this.state = { mode : 'accepting', worker : this.fork() };
    }

    accept(s : net.Socket) {
        switch (this.state.mode) {
            case 'accepting':
                this.state.worker.send('connection', s);
                break;
            case 'buffering':
                this.state.buffer.push(s);
                break;
        }
    }

    private fork() {
        let worker = cp.fork(this.entryPoint, this.args);
        worker.on('exit', (code, signal) => {
            throw new Error(`Worker prematurely exited.`);
        });
        return worker;
    }

    reload() {
        let worker = this.fork();
        switch (this.state.mode) {
            case 'accepting':
                // Reload is "rolling", we don't need to wait for this to end.
                void this.shutdown();
                break;
            case 'buffering':
                for (let s of this.state.buffer) {
                    worker.send('connection', s);
                }
                break;
        }
        this.state = { mode : 'accepting', worker };
    }

    async shutdown() {
        if (this.state.mode === 'buffering') {
            return;
        }

        let worker = this.state.worker;
        this.state = { mode : 'buffering', buffer : [] };

        worker.removeAllListeners('exit');
        worker.send('shutdown');
        worker.disconnect();

        let timeout = setTimeout(() => {
            worker.kill();
        }, 2000);

        return new Promise<void>((resolve, reject) => {
            worker.on('exit', () => {
                clearTimeout(timeout);
                resolve();
            });
        });
    }
}

export class Multiplexer implements Worker {
    private i : number;
    private workers : Worker[];

    constructor(workers : Worker[]) {
        this.i = 0;
        this.workers = workers;
    }

    accept(s : net.Socket) {
        // Round-robin like Node cluster
        this.workers[this.i].accept(s);
        this.i = (this.i + 1) % this.workers.length;
    }

    reload() {
        for (let worker of this.workers) {
            worker.reload();
        }
    }

    async shutdown() {
        await Promise.all(this.workers.map(worker => worker.shutdown()));
        return;
    }
}
