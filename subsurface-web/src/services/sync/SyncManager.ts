import { db } from '../storage/LocalStorageService';
import { gitService } from '../git/GitService';
import { xmlParser, type DiveLog } from '../transform/XmlParser';
import type { Dive } from '../../types';

export class SyncManager {

  async initialize(url: string, email?: string, password?: string): Promise<void> {
    await gitService.init();
    try {
      const localData = await gitService.readFile('dives.xml').catch(() => null);
      if (!localData && url) {
        const onAuth = () => ({ username: email, password });
        await gitService.clone(url, 'https://cors.isomorphic-git.org', onAuth);
        const remoteData = await gitService.readFile('dives.xml');
        await this.importToLocalDb(remoteData);
      }
    } catch (e) {
      console.error('Git init/clone failed:', e);
      await gitService.init(); // Recreate .git if clone deleted it
      throw e;
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
    const localDives = await db.dives.toArray();
    await this.saveChangesLocal(localDives);

    const onAuth = () => ({ username: email, password });
    await gitService.fetch(url, onAuth, 'https://cors.isomorphic-git.org');
    await gitService.merge();
    await gitService.push(url, onAuth, 'https://cors.isomorphic-git.org');

    const mergedData = await gitService.readFile('dives.xml');
    await this.importToLocalDb(mergedData);

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
