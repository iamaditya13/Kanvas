import { io, Socket } from 'socket.io-client';
import { SocketAck } from '@/features/board/types';

const URL = process.env.NEXT_PUBLIC_WEBSOCKET_URL || 'http://localhost:3001';

class SocketService {
  private socket: Socket | null = null;
  private token: string | null = null;

  connect(token: string) {
    if (this.socket && this.token === token) {
      return this.socket;
    }

    if (this.socket) {
      this.socket.disconnect();
    }

    this.token = token;
    this.socket = io(URL, {
      withCredentials: true,
      transports: ['websocket'],
      auth: { token },
    });

    return this.socket;
  }

  getSocket(token: string) {
    return this.connect(token);
  }

  emitWithAck<TPayload, TResponse>(socket: Socket, event: string, payload: TPayload) {
    return new Promise<TResponse>((resolve, reject) => {
      socket.emit(event, payload, (ack: SocketAck<TResponse>) => {
        if (!ack.ok || !ack.data) {
          reject(new Error(ack.error?.message || 'Socket operation failed'));
          return;
        }

        resolve(ack.data);
      });
    });
  }
}

export const socketService = new SocketService();
