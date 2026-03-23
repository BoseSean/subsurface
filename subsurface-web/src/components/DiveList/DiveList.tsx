import React from 'react';
import type { Dive } from '../../types';

interface DiveListProps {
  dives: Dive[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}

export const DiveList: React.FC<DiveListProps> = ({ dives, selectedId, onSelect }) => {
  const formatDate = (ts: number) => new Date(ts).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', year: '2-digit'
  });

  return (
    <div className="dive-table-container">
      <table className="dive-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Date</th>
            <th>Depth</th>
            <th>Duration</th>
            <th>Location</th>
          </tr>
        </thead>
        <tbody>
          {dives.length === 0 ? (
            <tr><td colSpan={5} style={{textAlign: 'center', padding: '20px', color: '#868e96'}}>No dives found.</td></tr>
          ) : dives.map(dive => (
            <tr 
              key={dive.id} 
              className={dive.id === selectedId ? 'selected' : ''}
              onClick={() => onSelect(dive.id)}
            >
              <td>{dive.number}</td>
              <td>{formatDate(dive.when)}</td>
              <td>{dive.depth.max ? `${(dive.depth.max / 1000).toFixed(1)}m` : '—'}</td>
              <td>{dive.duration.seconds ? `${Math.floor(dive.duration.seconds / 60)}m` : '—'}</td>
              <td>{dive.notes?.substring(0, 15) || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
