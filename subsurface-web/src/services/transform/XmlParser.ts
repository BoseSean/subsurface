import xml2js from 'xml2js';
import type { Dive, DiveSite, DiveTrip } from '../../types';

export interface DiveLog {
  version: number;
  program: string;
  dives: Dive[];
  trips: DiveTrip[];
  sites: DiveSite[];
}

export class XmlParser {
  private parser: xml2js.Parser;
  private builder: xml2js.Builder;

  constructor() {
    this.parser = new xml2js.Parser({ explicitArray: false, mergeAttrs: true, ignoreAttrs: false });
    this.builder = new xml2js.Builder({ rootName: 'divelog', xmldec: { version: '1.0', encoding: 'utf-8' }, cdata: false });
  }

  async parseXml(xmlContent: string): Promise<DiveLog> {
    try {
      const result = await this.parser.parseStringPromise(xmlContent);
      const divelog = result.divelog || {};
      return {
        version: parseInt(divelog.version || '3', 10),
        program: divelog.program || 'subsurface',
        dives: this.parseDives(divelog.dives?.dive || []),
        trips: [],
        sites: []
      };
    } catch (e) {
      console.error('XML parsing failed:', e);
      throw e;
    }
  }

  serializeXml(diveLog: DiveLog): string {
    const obj = {
      $: { version: '3', program: diveLog.program || 'subsurface-web' },
      dives: { dive: diveLog.dives.map(d => this.diveToXmlObject(d)) }
    };
    return this.builder.buildObject(obj);
  }

  private parseDives(diveElements: any): Dive[] {
    if (!diveElements) return [];
    const elements = Array.isArray(diveElements) ? diveElements : [diveElements];
    return elements.map(elem => {
      const dateStr = elem.date || '';
      const timeStr = elem.time || '';
      const when = new Date(`${dateStr} ${timeStr}`).getTime() || Date.now();
      
      const comp = elem.divecomputer || {};
      const maxDepthStr = Array.isArray(comp.depth) ? comp.depth[0]?.max : comp.depth?.max;
      const durationStr = Array.isArray(elem.duration) ? elem.duration[0] : elem.duration;

      return {
        id: parseInt(elem.id || Math.random().toString().slice(2, 10), 10),
        number: parseInt(elem.number || '0', 10),
        when,
        duration: { seconds: this.parseDuration(durationStr) },
        depth: { max: this.parseDepth(maxDepthStr), mean: 0 },
        temperature: {},
        notes: Array.isArray(elem.notes) ? elem.notes[0] : elem.notes || '',
        buddy: Array.isArray(elem.buddy) ? elem.buddy[0] : elem.buddy || '',
        rating: parseInt(elem.rating || '0', 10)
      };
    });
  }

  private diveToXmlObject(dive: Dive): any {
    const dateObj = new Date(dive.when);
    const dateStr = dateObj.toISOString().split('T')[0];
    const timeStr = dateObj.toISOString().split('T')[1].substring(0, 5);

    return {
      $: { id: dive.id, number: dive.number, date: dateStr, time: timeStr, rating: dive.rating || 0 },
      duration: [this.formatDuration(dive.duration.seconds)],
      notes: [dive.notes || ''],
      buddy: [dive.buddy || ''],
      divecomputer: {
        $: { model: 'unknown', deviceid: 'deadbeef' },
        depth: { $: { max: this.formatDepth(dive.depth.max), mean: this.formatDepth(dive.depth.mean) } }
      }
    };
  }

  private parseDepth(depthStr: string | undefined): number {
    const match = depthStr?.match(/(\d+\.?\d*)\s*m/);
    return match ? parseFloat(match[1]) * 1000 : 0;
  }

  private formatDepth(mm: number): string {
    return `${(mm / 1000).toFixed(1)} m`;
  }

  private parseDuration(durationStr: string | undefined): number {
    const match = durationStr?.match(/(\d+):(\d+)/);
    return match ? parseInt(match[1], 10) * 60 + parseInt(match[2], 10) : 0;
  }

  private formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')} min`;
  }
}

export const xmlParser = new XmlParser();
