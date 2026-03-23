export interface Dive {
  id: number;
  number: number;
  when: number;
  duration: { seconds: number };
  depth: { max: number; mean: number };
  temperature: { air?: number; water?: number };
  notes?: string;
  buddy?: string;
  diveguide?: string;
  tags?: string[];
  rating?: number;
  visibility?: number;
  _unsynced?: boolean;
  _lastModified?: number;
  _hash?: string;
}

export interface DiveSite {
  uuid: number;
  name: string;
  description?: string;
  notes?: string;
  location?: { latitude: number; longitude: number };
}

export interface DiveTrip {
  id: string;
  location: string;
  notes?: string;
  when: number;
  dives: Dive[];
  _unsynced?: boolean;
}

export interface SyncMetadata {
  key: string;
  value: any;
  timestamp?: Date;
}
