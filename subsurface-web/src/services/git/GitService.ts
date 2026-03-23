import git from 'isomorphic-git';
import http from 'isomorphic-git/http/web';
import FS from '@isomorphic-git/lightning-fs';

export class GitService {
  public fs: any;
  public dir: string;

  constructor(repoName: string = 'subsurface-cloud') {
    this.fs = new FS(repoName);
    this.dir = `/${repoName}`;
  }

  async init(): Promise<void> {
    try {
      await git.resolveRef({ fs: this.fs, dir: this.dir, ref: 'HEAD' });
    } catch {
      await git.init({ fs: this.fs, dir: this.dir });
    }
  }

  async clone(url: string, corsProxy?: string, onAuth?: any): Promise<void> {
    await git.clone({
      fs: this.fs,
      http,
      dir: this.dir,
      url,
      corsProxy,
      onAuth,
      singleBranch: true,
      depth: 1
    });
  }

  async fetch(url: string, onAuth?: any, corsProxy?: string): Promise<void> {
    await git.fetch({
      fs: this.fs,
      http,
      dir: this.dir,
      remote: 'origin',
      url,
      corsProxy,
      onAuth
    });
  }

  async merge(theirs: string = 'origin/master'): Promise<void> {
    await git.merge({
      fs: this.fs,
      dir: this.dir,
      ours: 'master',
      theirs
    });
  }

  async push(url: string, onAuth?: any, corsProxy?: string): Promise<void> {
    await git.push({
      fs: this.fs,
      http,
      dir: this.dir,
      remote: 'origin',
      ref: 'master',
      url,
      corsProxy,
      onAuth
    });
  }

  async readFile(path: string): Promise<string> {
    return await this.fs.promises.readFile(`${this.dir}/${path}`, 'utf8');
  }

  async writeFile(path: string, content: string): Promise<void> {
    await this.fs.promises.writeFile(`${this.dir}/${path}`, content, 'utf8');
  }

  async addFile(path: string): Promise<void> {
    await git.add({ fs: this.fs, dir: this.dir, filepath: path });
  }

  async commit(message: string, authorName: string = 'Subsurface Web', authorEmail: string = 'web@subsurface'): Promise<string> {
    return await git.commit({
      fs: this.fs,
      dir: this.dir,
      message,
      author: { name: authorName, email: authorEmail }
    });
  }
}

export const gitService = new GitService();
