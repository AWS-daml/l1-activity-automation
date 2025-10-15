// components/InstanceTypeChangeModal.js
import React, { useState } from 'react';
import { changeInstanceType } from '../Services/api'; // ✅ SECURE API IMPORT

const InstanceTypeChangeModal = ({ show, onHide, instance, accountId, onSuccess }) => {
  const [newInstanceType, setNewInstanceType] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showConfirmation, setShowConfirmation] = useState(false);

  // Common instance types organized by family
  const instanceTypes = {
    'General Purpose (T2)': ['t2.nano', 't2.micro', 't2.small', 't2.medium', 't2.large', 't2.xlarge', 't2.2xlarge'],
    'General Purpose (T3)': ['t3.nano', 't3.micro', 't3.small', 't3.medium', 't3.large', 't3.xlarge', 't3.2xlarge'],
    'General Purpose (M5)': ['m5.large', 'm5.xlarge', 'm5.2xlarge', 'm5.4xlarge', 'm5.8xlarge', 'm5.12xlarge'],
    'Compute Optimized (C5)': ['c5.large', 'c5.xlarge', 'c5.2xlarge', 'c5.4xlarge', 'c5.9xlarge', 'c5.18xlarge'],
    'Memory Optimized (R5)': ['r5.large', 'r5.xlarge', 'r5.2xlarge', 'r5.4xlarge', 'r5.8xlarge', 'r5.16xlarge'],
  };

  const handleTypeSelection = () => {
    if (!newInstanceType) {
      setError('Please select a new instance type');
      return;
    }
    if (newInstanceType === instance?.InstanceType) {
      setError('Please select a different instance type');
      return;
    }
    setError('');
    setShowConfirmation(true);
  };

  // ✅ COMPLETELY FIXED - SECURE VERSION
  const executeInstanceTypeChange = async () => {
    setIsLoading(true);
    setError('');

    console.log('🔧 === SECURE INSTANCE TYPE CHANGE START ===');
    console.log('🔧 Instance:', instance);
    console.log('🔧 Account ID:', accountId);
    console.log('🔧 New Type:', newInstanceType);

    const requestData = {
      instanceId: instance.InstanceId,
      accountId: accountId,
      region: instance.Region,
      newInstanceType: newInstanceType,
      instanceName: instance.InstanceName
    };

    console.log('🔧 Request Data:', requestData);

    try {
      console.log('🔧 Using SECURE Nginx proxy via api.js...');
      
      // ✅ FIXED: Use secure api.js function (goes through Nginx proxy)
      const result = await changeInstanceType(requestData);

      console.log('🔧 SUCCESS! Secure instance type change completed:', result);
      
      // Handle the response properly
      if (result.status === "success" && result.data?.success) {
        console.log('🔧 Instance type changed successfully via secure proxy');
        onSuccess && onSuccess();
        // Reset modal
        setShowConfirmation(false);
        resetModal();
        onHide();
      } else {
        console.log('🔧 API returned error:', result.data?.error);
        setError(result.data?.error || 'Failed to change instance type');
        setShowConfirmation(false);
      }
      
    } catch (error) {
      console.error('🔧 Secure instance type change failed:', error);
      setError(error.message || 'Failed to change instance type');
      setShowConfirmation(false);
    } finally {
      setIsLoading(false);
      console.log('🔧 === SECURE INSTANCE TYPE CHANGE END ===');
    }
  };

  const resetModal = () => {
    setNewInstanceType('');
    setError('');
    setShowConfirmation(false);
    setIsLoading(false);
  };

  const handleClose = () => {
    if (!isLoading) {
      resetModal();
      onHide();
    }
  };

  if (!show || !instance) return null;

  return (
    <>
      {/* Type Selection Modal */}
      {!showConfirmation && !isLoading && (
        <div className="modal-overlay">
          <div className="modal-content instance-type-modal">
            <div className="modal-header">
              <h3>🔧 Change Instance Type</h3>
              <button className="modal-close" onClick={handleClose}>×</button>
            </div>
            
            <div className="modal-body">
              <div className="instance-details-grid">
                <div className="current-instance-details">
                  <h6>Current Instance Details:</h6>
                  <div className="instance-details-list">
                    <p><strong>Name:</strong> {instance.InstanceName || 'No Name'}</p>
                    <p><strong>ID:</strong> {instance.InstanceId}</p>
                    <p>
                      <strong>Current Type:</strong>
                      <span className="instance-type-badge current-type">
                        {instance.InstanceType}
                      </span>
                    </p>
                    <p>
                      <strong>Status:</strong>
                      <span className={`status-badge ${instance.State}`}>
                        {instance.State}
                      </span>
                    </p>
                    <p><strong>Region:</strong> {instance.Region}</p>
                  </div>
                </div>
                
                <div className="warning-section">
                  <h6>⚠️ Important:</h6>
                  <div className="warning-text">
                    • Instance will be <strong>stopped</strong> and <strong>started</strong><br/>
                    • Downtime: <strong>2-5 minutes</strong><br/>
                    • Public IP may change (unless Elastic IP)<br/>
                    • SSH sessions will be disconnected
                  </div>
                </div>
              </div>

              <hr className="modal-divider" />

              <div className="instance-type-selection">
                <h6>Select New Instance Type:</h6>
                <select
                  className="instance-type-dropdown"
                  value={newInstanceType}
                  onChange={(e) => setNewInstanceType(e.target.value)}
                >
                  <option value="">Choose new instance type...</option>
                  {Object.entries(instanceTypes).map(([family, types]) => (
                    <optgroup key={family} label={family}>
                      {types.map(type => (
                        <option 
                          key={type} 
                          value={type}
                          disabled={type === instance.InstanceType}
                        >
                          {type} {type === instance.InstanceType ? '(Current)' : ''}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              {error && (
                <div className="error-message">
                  {error}
                </div>
              )}

              {newInstanceType && newInstanceType !== instance.InstanceType && (
                <div className="change-summary">
                  <strong>Change Summary:</strong><br/>
                  {instance.InstanceType} → <strong>{newInstanceType}</strong>
                </div>
              )}
            </div>
            
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={handleClose}>
                Cancel
              </button>
              <button className="btn btn-warning" onClick={handleTypeSelection}>
                Next: Confirm Change
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirmation && !isLoading && (
        <div className="modal-overlay">
          <div className="modal-content confirmation-modal">
            <div className="modal-header danger">
              <h3>⚠️ Confirm Instance Type Change</h3>
            </div>
            
            <div className="modal-body">
              <div className="final-warning">
                <strong>⚠️ FINAL WARNING</strong><br/>
                This action will <strong>STOP</strong> and <strong>START</strong> the instance.<br/>
                <strong>Service will be interrupted for 2-5 minutes.</strong>
              </div>

              <div className="confirmation-summary">
                <h5>Change Summary:</h5>
                <p><strong>Instance:</strong> {instance.InstanceName || 'No Name'} ({instance.InstanceId})</p>
                <p className="type-change-visual">
                  <span className="old-type">{instance.InstanceType}</span>
                  <strong>→</strong>
                  <span className="new-type">{newInstanceType}</span>
                </p>
                <p className="confirmation-question">Are you absolutely sure?</p>
              </div>

              {error && (
                <div className="error-message">
                  {error}
                </div>
              )}
            </div>
            
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowConfirmation(false)}>
                Go Back
              </button>
              <button className="btn btn-danger" onClick={executeInstanceTypeChange}>
                Yes, Change Instance Type
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Progress Modal */}
      {isLoading && (
        <div className="modal-overlay">
          <div className="modal-content progress-modal">
            <div className="progress-spinner"></div>
            <h5>🔒 Securely Processing Instance Type Change...</h5>
            <div className="progress-steps">
              <strong>Step 1:</strong> Stopping instance<br/>
              <strong>Step 2:</strong> Changing instance type<br/>
              <strong>Step 3:</strong> Starting instance
            </div>
            <p className="progress-warning">
              <strong>Please wait... This takes 2-5 minutes</strong><br/>
              <small>Using secure Nginx proxy connection</small>
            </p>
            <div className="progress-bar">
              <div className="progress-fill"></div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default InstanceTypeChangeModal;
