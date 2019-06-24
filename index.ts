/// <reference path="node-geogebra.d.ts" />

import * as Hapi from '@hapi/hapi';
import * as Boom from '@hapi/boom';
import * as SocketIo from 'socket.io';
import { GGBConnectDatabase } from './database';
import { GGBConnectApp } from './app';

/* Check for required environment variables */
if (!process.env.POSTGRES_URI) {
  console.error('Expected POSTGRES_URI in environment.');
  process.exit(2);
} else {
  (async (postgresUri: string, address: string = 'localhost', port: number = 8080) => {
    /* Create Hapi server */
    const serv = new Hapi.Server({
      address,
      port,
    });

    /* Create socket.io handler */
    const io = SocketIo(serv.listener);

    /* Create app instance */
    const db = new GGBConnectDatabase(postgresUri);
    await db.init();
    const app = new GGBConnectApp(db, io);

    /* Hapi logging with 'good' module */
    await serv.register({
      plugin: require('@hapi/good'),
      options: {
        ops: {
          interval: 1000,
        },
        reporters: {
          myConsoleReporter: [
            {
              module: '@hapi/good-squeeze',
              name: 'Squeeze',
              args: [{ log: '*', response: '*', error: '*' }],
            },
            {
              module: '@hapi/good-console',
              args: [{
                format: 'YYYY-MM-DDTHH:mm:ss.SSSZ',
              }],
            },
            'stdout',
          ],
        },
      },
    });

    /* Routes */
    serv.route({
      method: 'GET',
      path: '/handshake',
      handler: async (req, h) => {
        const {
          sessionId,
          version,
        } = req.query;

        if (typeof sessionId !== 'string' || typeof version !== 'string') {
          throw Boom.badRequest('Expected params: sessionId, version');
        }

        return (app.getSession(sessionId) === undefined)
          ? h.response(await app.handshake(sessionId, version)).code(200)
          : h.response(await app.getXml(sessionId) || '').code(200);
      },
    });

    serv.route({
      method: 'POST',
      path: '/command',
      handler: async (req, h) => {
        const {
          sessionId,
          command,
        } = <{ [key: string]: any }> (req.payload || {});

        if (typeof sessionId !== 'string' || typeof command !== 'string') {
          throw Boom.badRequest('Expected params: sessionId, command');
        }

        const res = await app.command(sessionId, command);

        if (!res) throw Boom.notFound('Session with specified id not found.');
        return h.response().code(200);
      },
    });

    serv.route({
      method: 'POST',
      path: '/appExec',
      handler: async (req, h) => {
        const {
          sessionId,
          property,
          args,
        } = <{ [key: string]: any }> (req.payload || {});

        if (typeof sessionId !== 'string'
        || typeof property !== 'string'
        || !(args instanceof Array)) {
          throw Boom.badRequest('Expected params: sessionId, command, args');
        }

        const res = await app.exec(sessionId, property, args);

        if (!res) throw Boom.notFound('Session with specified id not found.');
        return h.response(res.result).code(200);
      },
    });

    serv.route({
      method: 'GET',
      path: '/getCurrSession',
      handler: async (req, h) => {
        const {
          sessionId,
        } = req.query;

        if (typeof sessionId !== 'string') {
          throw Boom.badRequest('Expected params: sessionId');
        }

        const doc = await app.getXml(sessionId);

        if (doc === null) throw Boom.notFound('Session with specified id not found.');
        return h.response(doc).code(200);
      },
    });

    serv.route({
      method: 'GET',
      path: '/getPNG',
      handler: async (req, h) => {
        const {
          sessionId,
        } = req.query;

        if (typeof sessionId !== 'string') {
          throw Boom.badRequest('Expected params: sessionId');
        }

        const doc = await app.getPNG(sessionId);

        if (doc === null) throw Boom.notFound('Session with specified id not found.');
        return h.response(doc).header('content-type', 'image/png').code(200);
      },
    });

    serv.route({
      method: 'POST',
      path: '/saveCurrSession',
      handler: async (req, h) => {
        const {
          sessionId,
        } = <{ [key: string]: any }> (req.payload || {});

        if (typeof sessionId !== 'string') {
          throw Boom.badRequest('Expected params: sessionId');
        }

        const doc = await app.saveXml(sessionId);

        if (doc === null) throw Boom.notFound('Session with specified id not found.');
        return h.response(doc).code(200);
      },
    });

    /* Handle socket.io connections */
    io.on('connection', (socket) => {
      socket.on('subscribe', (sessionId: any, cb: (res: any) => {}) => {
        if (typeof sessionId !== 'string') {
          return cb({
            success: false,
            error: 'Invalid session id',
          });
        }

        /* Get session */
        const sess = app.getSession(sessionId);

        if (sess === undefined) {
          return cb({
            success: false,
            error: 'Session with specified id not found.',
          });
        }

        /* Join room for session */
        socket.join(sess.id);
      });
    });

    /* Start server */
    await serv.start();
    console.log('Hapi %s server started at: %s', serv.version, serv.info.uri);
  })(
    process.env.POSTGRES_URI,
    process.env.LISTEN_ADDRESS,
    Number(process.env.LISTEN_PORT) || undefined,
  ).catch((e: Error) => {
    console.error(e);
    process.exit(1);
  });
}
