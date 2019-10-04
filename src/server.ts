
import net from 'net';

export default abstract class Server {
    abstract accept(s : net.Socket): void;
}
