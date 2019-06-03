/// <reference path="node-geogebra.d.ts" />

import { GGBPlotter } from 'node-geogebra';
import { EventEmitter } from 'events';

import { ActiveSession } from './types';
import { GGBConnectDatabase } from './database';

import { Page} from 'puppeteer';

export class GGBConnectApp {
  private sessions: Map<string, ActiveSession>;

  constructor(private db: GGBConnectDatabase) {
    this.sessions = new Map<string, ActiveSession>();
  }

  private getSession(sessionId: string): ActiveSession | undefined {
    return this.sessions.get(sessionId);
  }

  public async handshake(sessionId: string, version: string) {
    /* Create session */
    const sess = await this.db.getSession(sessionId, version);

    /* Add session to store */
    const plotter = new GGBPlotter({ ggb: 'local' });
    const emitter = new EventEmitter();

    this.sessions.set(sessionId, {
      id: sessionId,
      plotter,
      emitter,
    });

    /* Add event listeners */
    const page = await plotter.pagePromise;
    let window: any;

    page.exposeFunction('addListener', (...args: any[]) => {
      emitter.emit('add', ...args);
    });
    page.exposeFunction('removeListener', (...args: any[]) => {
      emitter.emit('remove', ...args);
    });
    page.exposeFunction('updateListener', (...args: any[]) => {
      emitter.emit('update', ...args);
    });
    page.exposeFunction('renameListener', (...args: any[]) => {
      emitter.emit('rename', ...args);
    });

    page.evaluate(() => {
      window.ggbApplet.registerAddListener('addListener');
      window.ggbApplet.registerRemoveListener('removeListener');
      window.ggbApplet.registerUpdateListener('updateListener');
      window.ggbApplet.registerRenameListener('renameListener');
    });

    /* Done */
    return {
      sessionId: sessionId,
      websocketLink: `/session/${encodeURIComponent(sess.id)}`,
    };
  }

  public async command(sessionId: string, command: string): Promise<boolean> {
    /* Get plotter or return false if not found */
    const session = this.getSession(sessionId);

    if (session === undefined) return false;
    if (session.plotter === undefined) return false;

    /* Eval command */
    await session.plotter.evalGGBScript([command]);

    return true;
  }

  public async getBase64(sessionId: string): Promise<string | null> {
    /* Get plotter */
    const session = this.getSession(sessionId);

    if (session === undefined) return null;
    if (session.plotter === undefined) return null;

    /* Export base64 in ggb format */
    return session.plotter.exportGGB64();
  }

  public async getPNG(sessionId: string): Promise<Buffer | null> {
    /* Get plotter */
    const session = this.getSession(sessionId);

    if (session === undefined) return null;
    if (session.plotter === undefined) return null;

    /* Export base64 in ggb format */
    return session.plotter.exportPNG(true, 90);
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
    const session = this.getSession(sessionId);

    if (session === undefined) return false;
    if (session.plotter === undefined) return false;

    /* Release plotter and remove session */
    await session.plotter.release();
    this.sessions.delete(sessionId);
    return true;
  }
}
