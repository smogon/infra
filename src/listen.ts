
import Server from './server';
import net from 'net';

export default function(port : number, toServer : Server) : Promise<number> {
    return new Promise((resolve, reject) => {
        let fromServer = net.createServer({pauseOnConnect: true},
                                          (s) => toServer.accept(s));
        fromServer.on('listening', () => {
            resolve((fromServer.address() as net.AddressInfo).port);
        });
        fromServer.listen(port);
    });
}
