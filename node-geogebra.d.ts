declare module 'node-geogebra' {
  import { Page } from 'puppeteer';
  import { EventEmitter } from 'events';

  export class GGBPlotter {
    public pagePromise: Promise<Page>;

    constructor(opts: {
      ggb: 'remote' | 'local',
    });
    constructor(id?: number, page?: Page, releasedEmitter?: EventEmitter);
    /** Promise. When resolved, the plotter is ready to use */
    public ready(): Promise<void>;
    /** Erases the plotter. */
    public reset(): Promise<void>;
    /** Erases and returns the plotter to the pool */
    public release(): Promise<void>;
    /** Sets the dimensions of the graph.
     * script is an array that contains all the instructions required to generate your graph.
     * The language used in these commands must be GGBScript.
     * Internally, this method passes the GGBScript to the window.ggbApplet.evalCommand function.
      */
    public evalGGBScript(script: string[], width?: number, height?: number): Promise<void>;
    /** Executes the property on the window.ggbApplet object.
     * For instance plotter.exec("reset") would do the same job as plotter.reset()
     */
    public exec(property: string, args: any[]): Promise<any>;
    /** format can be: png, pdf, svg, ggb. It returns a buffer or a string depending on the format. */
    public export(format: 'png' | 'pdf' | 'svg' | 'ggb'): Promise<Buffer | string>;
    /** format can be: png, pdf, svg, ggb. It returns a string containing a base64 representation of the buffer. */
    public export64(format: 'png' | 'pdf' | 'svg' | 'ggb'): Promise<string>;
    public exportPNG(alpha: boolean, dpi: number): Promise<Buffer>;
    public exportPNG64(alpha: boolean, dpi: number): Promise<string>;
    public exportPDF(): Promise<Buffer>;
    public exportPDF64(): Promise<string>;
    public exportSVG(): Promise<Buffer>;
    public exportSVG64(): Promise<string>;
    public exportGGB(): Promise<Buffer>;
    public exportGGB64(): Promise<string>;
  }
}