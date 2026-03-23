import { db } from '../storage/LocalStorageService';
import { gitService } from '../git/GitService';
import { xmlParser, type DiveLog } from '../transform/XmlParser';
import type { Dive } from '../../types';

export class SyncManager {
  
  private gitLocalOnly: boolean = true;

  async initialize(url: string): Promise<void> {
    await gitService.init();
    try {
      // First try to read local git
      const localData = await gitService.readFile('dives.xml').catch(() => null);
      if (!localData && url) {
        // If no local, clone from cloud
        await gitService.clone(url, 'https://cors.isomorphic-git.org');
        const remoteData = await gitService.readFile('dives.xml');
        await this.importToLocalDb(remoteData);
      }
    } catch (e) {
      console.error('Git init/clone failed:', e);
    }
  }

  async importToLocalDb(xmlContent: string): Promise<void> {
    const diveLog = await xmlParser.parseXml(xmlContent);
    await db.dives.clear();
    await db.dives.bulkAdd(diveLog.dives);
  }

  async saveChangesLocal(dives: Dive[]): Promise<void> {
    const diveLog: DiveLog = {
      version: 3,
      program: 'subsurface-web',
      dives,
      trips: [],
      sites: []
    };
    const xml = xmlParser.serializeXml(diveLog);
    await gitService.writeFile('dives.xml', xml);
    await gitService.addFile('dives.xml');
    await gitService.commit('Sync local changes via Subsurface Web');
  }

  async syncWithCloud(url: string, email?: string, password?: string): Promise<any> {
    // 1. Get current Dexie data
    const localDives = await db.dives.toArray();

    // 2. Commit to local git
    await this.saveChangesLocal(localDives);

    if (this.gitLocalOnly) return { status: 'local-only' };

    // 3. Fetch from remote
    const onAuth = () => ({ username: email, password });
    await gitService.fetch(url, onAuth);

    // 4. Merge
    await gitService.merge();

    // 5. Push
    await gitService.push(url, onAuth);

    // 6. Read merged data and update Dexie
    const mergedData = await gitService.readFile('dives.xml');
    await this.importToLocalDb(mergedData);

    // Clear unsynced flags
    const updatedDives = await db.dives.toArray();
    for (const dive of updatedDives) {
      if (dive._unsynced) {
        await db.dives.update(dive.id, { _unsynced: false });
      }
    }

    return { status: 'success', dives: updatedDives };
  }
}

export const syncManager = new SyncManager();
