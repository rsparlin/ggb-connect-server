/// <reference path="node-geogebra.d.ts" />

import * as Hapi from '@hapi/hapi';
import * as Boom from '@hapi/boom';

import { GGBConnectDatabase } from './database';
import { GGBConnectApp } from './app';

/* Check for required environment variables */
if (!process.env.POSTGRES_URI) {
  console.error('Expected POSTGRES_URI in environment.');
  process.exit(2);
} else {
  (async (postgresUri: string, address: string = 'localhost', port: number = 8080) => {
    /* Create app instance */
    const db = new GGBConnectDatabase(postgresUri);
    const app = new GGBConnectApp(db);

    /* Create Hapi server */
    const serv = new Hapi.Server({
      address,
      port,
    });

    /* Hapi logging with 'good' module */
    await serv.register({
      plugin: require('good'),
      options: {
        ops: {
          interval: 1000
        },
        reporters: {
          myConsoleReporter: [
            {
                module: 'good-squeeze',
                name: 'Squeeze',
                args: [{ log: '*', response: '*', error: '*' }]
            },
            {
                module: 'good-console',
                args: [{
                  format: 'YYYY-MM-DDTHH:mm:ss.SSSZ',
                }]
            },
            'stdout',
          ]
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

        return h.response(await app.handshake(sessionId, version)).code(200);
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
      method: 'GET',
      path: '/getCurrSession',
      handler: async (req, h) => {
        const {
          sessionId,
        } = req.query;

        if (typeof sessionId !== 'string') {
          throw Boom.badRequest('Expected params: sessionId');
        }

        const doc = await app.getBase64(sessionId);
        
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
          id: sessionId,
        } = <{ [key: string]: any }> (req.payload || {});

        if (typeof sessionId !== 'string') {
          throw Boom.badRequest('Expected params: sessionId');
        }

        const doc = await app.saveBase64(sessionId);
        
        if (doc === null) throw Boom.notFound('Session with specified id not found.');
        return h.response(doc).code(200);
      },
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
