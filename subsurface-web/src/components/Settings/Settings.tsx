import React, { useState, useEffect } from 'react';
import { db } from '../../services/storage/LocalStorageService';
import { syncManager } from '../../services/sync/SyncManager';

interface SettingsProps {
  onClose: () => void;
}

export const Settings: React.FC<SettingsProps> = ({ onClose }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pinOrPassword, setPinOrPassword] = useState('');
  const [repoUrl, setRepoUrl] = useState('https://cloud.subsurface-divelog.org/git');
  const [isSyncing, setIsSyncing] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    // Load saved settings
    const loadSettings = async () => {
      const savedEmail = await db.metadata.get('cloudEmail');
      const savedUrl = await db.metadata.get('cloudUrl');
      if (savedEmail) setEmail(savedEmail.value);
      if (savedUrl) setRepoUrl(savedUrl.value);
    };
    loadSettings();
  }, []);

  const handleSaveAndSync = async () => {
    setIsSyncing(true);
    setMessage('Connecting to cloud...');
    
    try {
      // Build the user-specific repo URL based on email
      // Format: https://cloud.subsurface-divelog.org/git/email%40example.com[some-id]
      // For testing, we just use the email directly if it's the standard server
      const encodedEmail = encodeURIComponent(email);
      let fullUrl = repoUrl;
      if (repoUrl === 'https://cloud.subsurface-divelog.org/git' || repoUrl === 'https://cloud.subsurface-divelog.org/git/') {
         fullUrl = `https://cloud.subsurface-divelog.org/git/${encodedEmail}`;
      }

      await db.metadata.put({ key: 'cloudEmail', value: email });
      await db.metadata.put({ key: 'cloudUrl', value: repoUrl });
      
      // Attempt initialization and sync
      await syncManager.initialize(fullUrl, email, password);
      const result = await syncManager.syncWithCloud(fullUrl, email, password);
      
      setMessage(result.status === 'success' ? '✅ Synced successfully!' : `Status: ${result.status}`);
    } catch (error: any) {
      console.error(error);
      setMessage(`❌ Sync failed: ${error.message || 'Unknown error'}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleClearData = async () => {
    if (window.confirm('Are you sure you want to delete ALL local data? This cannot be undone.')) {
      await db.dives.clear();
      await db.metadata.clear();
      setMessage('✅ All local data cleared.');
      setTimeout(() => window.location.reload(), 1000);
    }
  };

  return (
    <div className="settings-modal-overlay">
      <div className="settings-modal">
        <div className="settings-header">
          <h2>Cloud Settings</h2>
          <button className="btn-icon" onClick={onClose} style={{color: '#495057'}}>✖</button>
        </div>
        
        <div className="settings-body">
          <p className="settings-desc">
            Connect to your Subsurface Cloud account to sync your dive logs across all devices.
          </p>
          
          <div className="form-group">
            <label>Cloud Server URL</label>
            <input 
              type="text" 
              value={repoUrl} 
              onChange={e => setRepoUrl(e.target.value)}
              placeholder="https://cloud.subsurface-divelog.org/git"
            />
          </div>
          
          <div className="form-group">
            <label>Email Address</label>
            <input 
              type="email" 
              value={email} 
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>
          
          <div className="form-group">
            <label>Password or PIN</label>
            <input 
              type="password" 
              value={password} 
              onChange={e => setPassword(e.target.value)}
              placeholder="Enter your Subsurface Cloud password/PIN"
            />
            <small>Note: Credentials are kept in memory and are not stored permanently on this device for security reasons.</small>
          </div>

          {message && (
            <div className={`settings-message ${message.includes('❌') ? 'error' : 'success'}`}>
              {message}
            </div>
          )}

          <div className="settings-actions">
            <button 
              className="btn-danger" 
              onClick={handleClearData}
            >
              Clear Local Data
            </button>
            <div className="actions-right">
              <button className="btn-cancel" onClick={onClose}>Close</button>
              <button 
                className="btn-primary" 
                onClick={handleSaveAndSync}
                disabled={isSyncing || !email}
              >
                {isSyncing ? 'Syncing...' : 'Save & Sync'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
