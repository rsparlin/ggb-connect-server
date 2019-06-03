import * as socketIoClient from 'socket.io-client';

(async () => {
  const sock = socketIoClient('http://localhost:8080');

  sock.on('connect', () => console.log('connected'));
  sock.on('disconnect', () => {
    console.log('disconnected');
    process.exit(0);
  });
  sock.on('connect_error', (e: any) => {
    console.error('Failed to connect:', e);
    process.exit(1);
  });

  sock.on('add', (...args: any[]) => console.log('add:', ...args));
  sock.on('remove', (...args: any[]) => console.log('remove:', ...args));
  sock.on('update', (...args: any[]) => console.log('update:', ...args));
  sock.on('rename', (...args: any[]) => console.log('rename:', ...args));

  sock.emit('subscribe', process.argv[2] || 'c55d57b8-8624-11e9-bc42-526af7764f64', (res: {
    success: boolean,
    error?: string,
  }) => {
    if (res.success) {
      console.log('Subscribe:', res.success, res.error);
    } else {
      console.error('Subscribe failed: %s', res.error);
      process.exit(1);
    }
  });
})();
