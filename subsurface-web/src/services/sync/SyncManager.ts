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
        try {
          await gitService.clone(url, 'https://cors.isomorphic-git.org', onAuth);
        } catch (e: any) {
          if (e.name === 'NotFoundError' || (e.message && e.message.includes('HEAD'))) {
             console.log('Remote repository appears to be empty. Initializing locally.');
             await gitService.init(); // Recreate .git since clone deletes it
          } else {
             throw e;
          }
        }
        
        const remoteData = await gitService.readFile('dives.xml').catch(() => null);
        if (remoteData) {
          await this.importToLocalDb(remoteData);
        }
      }
    } catch (e) {
      console.error('Git init/clone failed:', e);
      await gitService.init(); // Fallback
      throw e;
    }
  }

  async importToLocalDb(xmlContent: string): Promise<void> {
    try {
      const diveLog = await xmlParser.parseXml(xmlContent);
      await db.dives.clear();
      await db.dives.bulkAdd(diveLog.dives);
    } catch (e) {
      console.warn('Invalid XML content from remote, skipping local DB overwrite:', e);
    }
  }

  async saveChangesLocal(dives: Dive[], email?: string): Promise<void> {
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
    await gitService.commit('Sync local changes via Subsurface Web', 'Subsurface Web', email || 'web@subsurface');
  }

  async syncWithCloud(url: string, email?: string, password?: string): Promise<any> {
    const localDives = await db.dives.toArray();
    await this.saveChangesLocal(localDives, email);

    const onAuth = () => ({ username: email, password });
    
    let isRemoteEmpty = false;
    try {
      await gitService.fetch(url, onAuth, 'https://cors.isomorphic-git.org');
    } catch (e: any) {
      if (e.name === 'NotFoundError' || (e.message && e.message.includes('HEAD'))) {
         console.log('Remote repository empty during fetch, skipping merge.');
         isRemoteEmpty = true;
      } else {
         throw e;
      }
    }

    if (!isRemoteEmpty) {
      try {
        await gitService.merge();
      } catch (e: any) {
        console.warn('Merge failed or nothing to merge:', e);
      }
    }
    
    // Now push to remote
    await gitService.push(url, onAuth, 'https://cors.isomorphic-git.org');

    const mergedData = await gitService.readFile('dives.xml').catch(() => null);
    if (mergedData) {
      await this.importToLocalDb(mergedData);
    }

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
