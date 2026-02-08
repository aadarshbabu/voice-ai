import { EventEmitter } from 'events';

// Use a global variable to persist the emitter across HMR in development
// This is a standard pattern for singletons in Next.js (like Prisma)
const globalForSession = global as unknown as { sessionEmitter: SessionEmitter };

class SessionEmitter extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(100);
  }

  public notifyUpdate(sessionId: string, data: any) {
    this.emit(`update:${sessionId}`, data);
  }

  public notifyComplete(sessionId: string, status: string) {
    this.emit(`complete:${sessionId}`, { status });
  }
}

export const sessionEmitter = globalForSession.sessionEmitter || new SessionEmitter();

if (process.env.NODE_ENV !== 'production') {
  globalForSession.sessionEmitter = sessionEmitter;
}
