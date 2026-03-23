import Dexie, { type Table } from 'dexie';
import type { Dive, DiveSite, DiveTrip, SyncMetadata } from '../../types';

export class SubsurfaceDB extends Dexie {
  dives!: Table<Dive>;
  sites!: Table<DiveSite>;
  trips!: Table<DiveTrip>;
  metadata!: Table<SyncMetadata>;

  constructor() {
    super('subsurface-web-v1');
    this.version(1).stores({
      dives: '++id, when, _lastModified, _unsynced',
      sites: 'uuid, name, _lastModified',
      trips: '++id, when, _lastModified',
      metadata: 'key'
    });
  }
}

export const db = new SubsurfaceDB();
