/// <reference path="node-geogebra.d.ts" />
import { GGBPlotter } from 'node-geogebra';
import { EventEmitter } from 'events';

export type Session = {
  id: string;
  doc?: string;
  plotter?: GGBPlotter;
  emitter?: EventEmitter;
};

export type ActiveSession = {
  plotter: GGBPlotter;
} & Session;
