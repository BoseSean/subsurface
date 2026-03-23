import React, { useState } from 'react';
import type { Dive } from '../../types';

interface DiveDetailProps {
  dive: Dive;
  onUpdate: (updates: Partial<Dive>) => void;
  onDelete: () => void;
}

export const DiveDetail: React.FC<DiveDetailProps> = ({ dive, onUpdate, onDelete }) => {
  const [activeTab, setActiveTab] = useState<'info' | 'equipment' | 'notes'>('info');

  const handleChange = (field: string, value: any) => {
    const keys = field.split('.');
    if (keys.length === 1) {
      onUpdate({ [field]: value });
    } else {
      const updated = { ...dive };
      let obj: any = updated;
      for (let i = 0; i < keys.length - 1; i++) {
        obj = obj[keys[i]];
      }
      obj[keys[keys.length - 1]] = value;
      onUpdate(updated);
    }
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onUpdate({ when: new Date(e.target.value).getTime() });
  };

  const dateValue = new Date(dive.when).toISOString().slice(0, 16);

  return (
    <div className="pane-detail">
      <div className="detail-header">
        <div className="detail-title">
          <h2>Dive #{dive.number}</h2>
          <div className="detail-subtitle">{new Date(dive.when).toLocaleString()}</div>
        </div>
        <div className="detail-actions">
          <button className="btn-icon" style={{color: '#fa5252'}} onClick={onDelete}>🗑️ Delete</button>
        </div>
      </div>
      
      <div className="detail-body">
        {/* Profile Graph Placeholder */}
        <div className="profile-graph">
          📈 Profile Graph (To be rendered with SVG or Canvas)
        </div>

        <div className="detail-tabs">
          <div className="tabs-header">
            <button className={`tab-btn ${activeTab === 'info' ? 'active' : ''}`} onClick={() => setActiveTab('info')}>Information</button>
            <button className={`tab-btn ${activeTab === 'equipment' ? 'active' : ''}`} onClick={() => setActiveTab('equipment')}>Equipment</button>
            <button className={`tab-btn ${activeTab === 'notes' ? 'active' : ''}`} onClick={() => setActiveTab('notes')}>Notes</button>
          </div>

          <div className="tab-content">
            {activeTab === 'info' && (
              <>
                <div className="info-group">
                  <span className="info-label">Date & Time</span>
                  <div className="info-value">
                    <input type="datetime-local" value={dateValue} onChange={handleDateChange} />
                  </div>
                </div>
                <div className="info-group">
                  <span className="info-label">Rating</span>
                  <div className="info-value">
                    <select value={dive.rating || 0} onChange={e => handleChange('rating', parseInt(e.target.value))}>
                      <option value="0">—</option>
                      {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{'⭐'.repeat(n)}</option>)}
                    </select>
                  </div>
                </div>
                <div className="info-group">
                  <span className="info-label">Max Depth (m)</span>
                  <div className="info-value">
                    <input type="number" step="0.1" value={dive.depth.max / 1000 || ''} onChange={e => handleChange('depth.max', parseFloat(e.target.value) * 1000)} />
                  </div>
                </div>
                <div className="info-group">
                  <span className="info-label">Duration (min)</span>
                  <div className="info-value">
                    <input type="number" value={Math.floor(dive.duration.seconds / 60) || ''} onChange={e => handleChange('duration.seconds', parseInt(e.target.value) * 60)} />
                  </div>
                </div>
                <div className="info-group">
                  <span className="info-label">Water Temp (°C)</span>
                  <div className="info-value">
                    <input type="number" step="0.1" value={dive.temperature.water ? (dive.temperature.water / 1000 - 273.15).toFixed(1) : ''} onChange={e => handleChange('temperature.water', (parseFloat(e.target.value) + 273.15) * 1000)} />
                  </div>
                </div>
                <div className="info-group">
                  <span className="info-label">Air Temp (°C)</span>
                  <div className="info-value">
                    <input type="number" step="0.1" value={dive.temperature.air ? (dive.temperature.air / 1000 - 273.15).toFixed(1) : ''} onChange={e => handleChange('temperature.air', (parseFloat(e.target.value) + 273.15) * 1000)} />
                  </div>
                </div>
              </>
            )}

            {activeTab === 'equipment' && (
              <>
                <div className="info-group full-width" style={{textAlign: 'center', padding: '40px', color: '#868e96'}}>
                  Cylinders and Weights module to be implemented
                </div>
              </>
            )}

            {activeTab === 'notes' && (
              <>
                <div className="info-group">
                  <span className="info-label">Divemaster</span>
                  <div className="info-value">
                    <input type="text" value={dive.diveguide || ''} onChange={e => handleChange('diveguide', e.target.value)} placeholder="Name" />
                  </div>
                </div>
                <div className="info-group">
                  <span className="info-label">Buddy</span>
                  <div className="info-value">
                    <input type="text" value={dive.buddy || ''} onChange={e => handleChange('buddy', e.target.value)} placeholder="Name" />
                  </div>
                </div>
                <div className="info-group full-width">
                  <span className="info-label">Tags</span>
                  <div className="info-value">
                    <input type="text" defaultValue={dive.tags?.join(', ') || ''} onBlur={e => handleChange('tags', e.target.value.split(',').map(t => t.trim()).filter(Boolean))} placeholder="boat, drift, deep" />
                  </div>
                </div>
                <div className="info-group full-width">
                  <span className="info-label">Notes</span>
                  <div className="info-value">
                    <textarea value={dive.notes || ''} onChange={e => handleChange('notes', e.target.value)} placeholder="How was the dive?" />
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
