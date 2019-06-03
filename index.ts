/// <reference path="node-geogebra.d.ts" />

import * as Hapi from '@hapi/hapi';
import * as Boom from '@hapi/boom';
import * as PgPromise from 'pg-promise';
import { GGBPlotter } from 'node-geogebra';
import { string } from '@hapi/joi';

type Session = {
  id: string;
  doc?: string;
};

class Database {
  private static pgp = PgPromise();
  private db: PgPromise.IDatabase<{}>;

  constructor(private uri: string) {
    this.db = Database.pgp(uri);
  }

  async getSession(sessionId: string, version: string): Promise<Session> {
    const res = await this.db.oneOrNone(
      `INSERT INTO sessions (id, version) VALUES ($1, $2)
        ON CONFLICT (id) DO NOTHING RETURNING (id)`,
      [sessionId, version],
    );
    
    return {
      id: sessionId,
    }
  }

  async updateDoc(sessionId: string, doc: string) {
    const res = await this.db.one(
      `UPDATE sessions SET doc=$2 WHERE id=$1 RETURNING (id, doc)`,
      [sessionId, doc],
    );
    
    return res;
  }
}

class GGBConnectApp {
  private plotters: Map<string, GGBPlotter>;

  constructor(private db: Database) {
    this.plotters = new Map<string, GGBPlotter>();
  }

  private getPlotter(sessionId: string): GGBPlotter | null {
    return this.plotters.get(sessionId) || null;
  }

  public async handshake(sessionId: string, version: string) {
    /* Create session */
    const sess = await this.db.getSession(sessionId, version);

    /* Add session to store and return */
    this.plotters.set(sessionId, new GGBPlotter({ ggb: 'local' }));

    return {
      sessionId: sessionId,
      websocketLink: `/session/${encodeURIComponent(sess.id)}`,
    };
  }

  public async command(sessionId: string, command: string): Promise<boolean> {
    /* Get plotter or return false if not found */
    const plotter = this.getPlotter(sessionId);

    if (plotter === null) return false;

    /* Eval command */
    await plotter.evalGGBScript([command]);

    return true;
  }

  public async getBase64(sessionId: string): Promise<string | null> {
    /* Get plotter */
    const plotter = this.getPlotter(sessionId);

    if (plotter === null) return null;

    /* Export base64 in ggb format */
    return plotter.exportGGB64();
  }

  public async saveBase64(sessionId: string): Promise<string | null> {
    /* Get base64 document */
    const doc = await this.getBase64(sessionId);

    if (doc === null) return null;

    /* Write to database and return */
    await this.db.updateDoc(sessionId, doc);
    return doc;
  }

  public async release(sessionId: string): Promise<boolean> {
    /* Get plotter */
    const plotter = this.getPlotter(sessionId);

    if (plotter === null) return false;

    /* Release and remove plotter */
    await plotter.release();
    this.plotters.delete(sessionId);
    return true;
  }
}

/* Check for required environment variables */
if (!process.env.POSTGRES_URI) {
  console.error('Expected POSTGRES_URI in environment.');
  process.exit(2);
} else {
  (async (postgresUri: string, address: string = 'localhost', port: number = 8080) => {
    /* Create app instance */
    const db = new Database(postgresUri);
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
          id,
          version,
        } = req.query;

        if (typeof id !== 'string' || typeof version !== 'string') {
          throw Boom.badRequest('Expected params: id, version');
        }

        return h.response(await app.handshake(id, version)).code(200);
      },
    });

    serv.route({
      method: 'POST',
      path: '/command',
      handler: async (req, h) => {
        const {
          id,
          command,
        } = <{ [key: string]: any }> req.payload;
        
        if (typeof id !== 'string' || typeof command !== 'string') {
          throw Boom.badRequest('Expected params: id, command');
        }
        await app.command(id, command);
        return h.response().code(200);
      },
    });

    serv.route({
      method: 'GET',
      path: '/getCurrSession',
      handler: async (req, h) => {
        const {
          id,
        } = req.query;

        if (typeof id !== 'string') {
          throw Boom.badRequest('Expected params: id');
        }

        const doc = await app.getBase64(id);
        
        if (doc === null) throw Boom.notFound('Session with specified id not found.');
        return h.response(doc).code(200);
      },
    });

    serv.route({
      method: 'POST',
      path: '/saveCurrSession',
      handler: async (req, h) => {
        const {
          id,
        } = <{ [key: string]: any }> req.payload;

        if (typeof id !== 'string') {
          throw Boom.badRequest('Expected params: id');
        }

        const doc = await app.saveBase64(id);
        
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

/*

/handshake
  Method: GET
  Parameters:
    - id: uuid string
    - version: version number string
  Response body (JSON): { sessionId, webhookLink }
  Response code 200 on success.
/command
  Method: POST
  Accepted content-types: application/json, application/x-www-form-urlencoded
  Parameters:
    - command: string
    - sessionId: string
  Response body: N/A
  Reponse code 200 on success.
/getCurrSession
  Method: GET
  Parameters:
    - sessionId: string
  Response body: ggbApplet.getBase64() string
  Response code 200 on success.
/saveCurrSession
  Method: POST
  Accepted content-types: application/json, application/x-www-form-urlencoded
  Parameters:
    - sessionId: string
  Writes ggbApplet.getBase64() base64-encoded string for specified session to database.
  Response body: ggbApplet.getBase64() string
  Response code 200 on success.
*/
