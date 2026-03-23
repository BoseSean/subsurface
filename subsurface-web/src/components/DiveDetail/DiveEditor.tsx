import React, { useState } from 'react';
import type { Dive } from '../../types';
import { db } from '../../services/storage/LocalStorageService';

interface DiveEditorProps {
  dive?: Dive;
  onSave: () => void;
  onCancel: () => void;
}

export const DiveEditor: React.FC<DiveEditorProps> = ({ dive, onSave, onCancel }) => {
  const [formData, setFormData] = useState<Dive>(dive || {
    id: Date.now(),
    number: 1,
    when: Date.now(),
    duration: { seconds: 0 },
    depth: { max: 0, mean: 0 },
    temperature: {},
    notes: '',
    buddy: '',
    rating: 0,
  });

  const handleChange = (field: string, value: any) => {
    setFormData((prev) => {
      const updated = { ...prev };
      const keys = field.split('.');
      if (keys.length === 1) {
        (updated as any)[field] = value;
      } else {
        let obj: any = updated;
        for (let i = 0; i < keys.length - 1; i++) {
          obj = obj[keys[i]];
        }
        obj[keys[keys.length - 1]] = value;
      }
      return updated;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const dataToSave = {
      ...formData,
      _lastModified: Date.now(),
      _unsynced: true,
    };
    if (dive) {
      await db.dives.update(dive.id, dataToSave);
    } else {
      await db.dives.add(dataToSave as Dive);
    }
    onSave();
  };

  return (
    <div className="dive-editor">
      <h2>{dive ? 'Edit Dive' : 'New Dive'}</h2>
      <form onSubmit={handleSubmit}>
        <div className="form-row">
          <label>
            Date & Time
            <input
              type="datetime-local"
              value={new Date(formData.when).toISOString().slice(0, 16)}
              onChange={(e) => handleChange('when', new Date(e.target.value).getTime())}
              required
            />
          </label>
          <label>
            Number
            <input
              type="number"
              value={formData.number}
              onChange={(e) => handleChange('number', parseInt(e.target.value))}
              min="1"
              required
            />
          </label>
        </div>

        <div className="form-row">
          <label>
            Max Depth (m)
            <input
              type="number"
              value={formData.depth.max / 1000}
              onChange={(e) => handleChange('depth.max', parseFloat(e.target.value) * 1000)}
              step="0.1"
              min="0"
            />
          </label>
          <label>
            Duration (min)
            <input
              type="number"
              value={Math.floor(formData.duration.seconds / 60)}
              onChange={(e) => handleChange('duration.seconds', parseInt(e.target.value) * 60)}
              min="0"
            />
          </label>
          <label>
            Rating
            <select
              value={formData.rating || 0}
              onChange={(e) => handleChange('rating', parseInt(e.target.value))}
            >
              <option value="0">—</option>
              <option value="1">⭐</option>
              <option value="2">⭐⭐</option>
              <option value="3">⭐⭐⭐</option>
              <option value="4">⭐⭐⭐⭐</option>
              <option value="5">⭐⭐⭐⭐⭐</option>
            </select>
          </label>
        </div>

        <div className="form-row">
          <label>
            Water Temp (°C)
            <input
              type="number"
              value={formData.temperature.water ? (formData.temperature.water / 1000 - 273.15).toFixed(1) : ''}
              onChange={(e) => handleChange('temperature.water', (parseFloat(e.target.value) + 273.15) * 1000)}
              step="0.1"
            />
          </label>
          <label>
            Buddy
            <input
              type="text"
              value={formData.buddy || ''}
              onChange={(e) => handleChange('buddy', e.target.value)}
              placeholder="Dive buddy name"
            />
          </label>
        </div>

        <label className="full-width">
          Notes
          <textarea
            value={formData.notes || ''}
            onChange={(e) => handleChange('notes', e.target.value)}
            placeholder="Notes about this dive..."
            rows={3}
          />
        </label>

        <label>
          Tags (comma-separated)
          <input
            type="text"
            defaultValue={formData.tags?.join(', ') || ''}
            onBlur={(e) => handleChange('tags', e.target.value.split(',').map(t => t.trim()).filter(Boolean))}
            placeholder="boat, reef, training"
          />
        </label>

        <div className="form-actions">
          <button type="button" className="btn-cancel" onClick={onCancel}>Cancel</button>
          <button type="submit" className="btn-save">Save Dive</button>
        </div>
      </form>
    </div>
  );
};

export default DiveEditor;
