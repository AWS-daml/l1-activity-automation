// components/ConfirmationModal.js
import React from 'react';

const ConfirmationModal = ({ 
  show, 
  instanceId, 
  region, 
  onConfirm, 
  onCancel 
}) => {
  if (!show) return null;

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content confirmation-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>⚙️ Confirm CloudWatch Agent Deployment</h3>
          <button className="modal-close" onClick={onCancel}>×</button>
        </div>
        
        <div className="modal-body">
          <div className="current-instance-details">
            <h6>Target Instance:</h6>
            <div className="instance-details-list">
              <p><strong>Instance ID:</strong> <code>{instanceId}</code></p>
              <p><strong>Region:</strong> <code>{region}</code></p>
            </div>
          </div>
          
          <div className="warning-section">
            <h6>⚠️ Deployment Details:</h6>
            <div className="warning-text">
              This action will:
              <ul>
                <li>Install/configure CloudWatch agent on this instance</li>
                <li>Take approximately <strong>10 minutes</strong> to complete</li>
                <li>Require SSM access to the instance</li>
                <li>Enable custom metrics collection for monitoring</li>
              </ul>
            </div>
          </div>
          
          <div className="confirmation-summary">
            <p className="confirmation-question">
              <strong>Do you want to proceed with the deployment?</strong>
            </p>
          </div>
        </div>
        
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={onConfirm}>
            Yes, Deploy Agent
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;
