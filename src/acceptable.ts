
import net from 'net';

export function listen(port : number, toServer : Acceptable) : Promise<number> {
    return new Promise((resolve, reject) => {
        let fromServer = net.createServer({pauseOnConnect: true},
                                          (s) => toServer.accept(s));
        fromServer.on('listening', () => {
            resolve((fromServer.address() as net.AddressInfo).port);
        });
        fromServer.listen(port);
    });
}

export default interface Acceptable {
    accept(s : net.Socket): void;
}
