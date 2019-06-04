import * as PgPromise from 'pg-promise';

import { Session } from './types';

export class GGBConnectDatabase {
  private static pgp = PgPromise();
  private db: PgPromise.IDatabase<{}>;

  constructor(private uri: string) {
    this.db = GGBConnectDatabase.pgp(uri);
  }

  async init(): Promise<void> {
    await this.db.none(`
      create table if not exists sessions (
        id uuid primary key,
        version varchar(32) not null,
        created timestamp default now(),
        doc text
      );

      create index if not exists created on sessions(created);
    `);
  }

  async getSession(sessionId: string, version: string): Promise<Session> {
    const res = await this.db.oneOrNone(
      `INSERT INTO sessions (id, version) VALUES ($1, $2)
        ON CONFLICT (id) DO NOTHING RETURNING (id)`,
      [sessionId, version],
    );

    return {
      id: sessionId,
    };
  }

  async updateDoc(sessionId: string, doc: string) {
    const res = await this.db.one(
      'UPDATE sessions SET doc=$2 WHERE id=$1 RETURNING (id, doc)',
      [sessionId, doc],
    );

    return res;
  }
}
