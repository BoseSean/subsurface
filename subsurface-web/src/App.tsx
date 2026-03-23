import { useEffect, useState } from 'react';
import type { Dive } from './types';
import { db } from './services/storage/LocalStorageService';
import { DiveList } from './components/DiveList/DiveList';
import { DiveDetail } from './components/DiveDetail/DiveDetail';
import { xmlParser } from './services/transform/XmlParser';
import { Settings } from './components/Settings/Settings';
import './App.css';

function App() {
  const [dives, setDives] = useState<Dive[]>([]);
  const [selectedDiveId, setSelectedDiveId] = useState<number | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  const loadDives = async () => {
    try {
      const allDives = await db.dives.orderBy('when').reverse().toArray();
      setDives(allDives);
    } catch (err) {
      console.error('Failed to load dives:', err);
    }
  };

  useEffect(() => {
    loadDives();
  }, []);

  const handleSelectDive = (id: number) => {
    setSelectedDiveId(id);
  };

  const handleAddDive = () => {
    const newDive: Dive = {
      id: Date.now(),
      number: dives.length ? Math.max(...dives.map(d => d.number)) + 1 : 1,
      when: Date.now(),
      duration: { seconds: 0 },
      depth: { max: 0, mean: 0 },
      temperature: {},
      rating: 0,
      notes: '',
      buddy: '',
      tags: [],
      _unsynced: true,
      _lastModified: Date.now()
    };
    db.dives.add(newDive).then(() => {
      loadDives();
      setSelectedDiveId(newDive.id);
    });
  };

  const handleUpdateDive = async (id: number, updates: Partial<Dive>) => {
    updates._lastModified = Date.now();
    updates._unsynced = true;
    await db.dives.update(id, updates);
    loadDives();
  };

  const handleDeleteDive = async (id: number) => {
    if (window.confirm('Delete this dive?')) {
      await db.dives.delete(id);
      if (selectedDiveId === id) setSelectedDiveId(null);
      loadDives();
    }
  };

  const handleExportXML = async () => {
    const currentDives = await db.dives.toArray();
    const xml = xmlParser.serializeXml({
      version: 3,
      program: 'subsurface-web',
      dives: currentDives,
      trips: [],
      sites: []
    });
    
    const blob = new Blob([xml], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'dives.xml';
    a.click();
    URL.revokeObjectURL(url);
  };

  const selectedDive = dives.find(d => d.id === selectedDiveId) || null;

  return (
    <div className="app">
      <header className="app-toolbar">
        <div className="toolbar-brand">
          <span>🤿</span> Subsurface Web
        </div>
        <div className="toolbar-actions">
          <div className="sync-badge offline" title="Not connected to Cloud">
            <span className="sync-dot"></span>
            Offline
          </div>
          <button className="btn-icon" onClick={handleExportXML}>💾 Export XML</button>
          <button className="btn-icon" onClick={() => setShowSettings(true)}>⚙️ Settings</button>
        </div>
      </header>

      <div className="app-workspace">
        <div className="pane-list">
          <div className="list-header">
            <h3>Logbook ({dives.length})</h3>
            <button className="btn-primary" onClick={handleAddDive}>+ Add</button>
          </div>
          <DiveList 
            dives={dives} 
            selectedId={selectedDiveId} 
            onSelect={handleSelectDive} 
          />
        </div>
        
        <div className="pane-detail">
          {selectedDive ? (
            <DiveDetail 
              dive={selectedDive} 
              onUpdate={(updates) => handleUpdateDive(selectedDive.id, updates)}
              onDelete={() => handleDeleteDive(selectedDive.id)}
            />
          ) : (
            <div className="detail-empty">
              <span className="icon">🤿</span>
              <h3>No dive selected</h3>
              <p>Select a dive from the logbook or add a new one.</p>
            </div>
          )}
        </div>
      </div>

      {showSettings && <Settings onClose={() => setShowSettings(false)} />}
    </div>
  );
}

export default App;
