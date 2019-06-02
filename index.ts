import * as Hapi from '@hapi/hapi';
import * as Boom from '@hapi/boom';
import * as PgPromise from 'pg-promise';
import * as uuidv4 from 'uuid/v4';

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
    const res = await this.db.one(
      `INSERT INTO sessions (id, version) VALUES ($1, $2)
        ON CONFLICT (id) DO UPDATE SET version=$2
        RETURNING (id)`,
      [sessionId, version],
    );
    
    return {
      id: res.id,
    };
  }
}

if (!process.env.POSTGRES_URI) {
  console.error('Expected POSTGRES_URI in environment.');
  process.exit(2);
} else {
  (async (postgresUri: string, address: string = 'localhost', port: number = 8080) => {
    const db = new Database(postgresUri);

    const serv = new Hapi.Server({
      address,
      port,
    });

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

    serv.route({
      method: 'GET',
      path: '/handshake',
      handler: async function(req, h) {
        const {
          id,
          version,
        } = req.query;

        if (typeof id !== 'string' || typeof version !== 'string') {
          throw Boom.badRequest('Expected params: id, version');
        }

        /* Create session */
        try {
          const sess = await db.getSession(id, version);

          return h.response({
            sess,
            //sessionId: sess.id,
            //websocketLink: `/session/${encodeURIComponent(sess.id)}`,
          });
        } catch (e) {
          throw Boom.internal(e.message);
        }
      }
    });

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
