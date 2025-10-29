// components/InstanceDetailsTable.js
import React, { useState } from 'react';
import AlarmConfigurationModal from './AlarmConfigurationModal';
import InstanceTypeChangeModal from './InstanceTypeChangeModal';
import VolumeConversionModal from './VolumeConversionModal';  // *** NEW IMPORT ***
import { deployCloudWatchAgent, configureAlarms, discoverInstances } from '../Services/api';

const InstanceDetailsTable = ({ 
  instances, 
  setInstances, 
  accountId, 
  onInstanceSelect, 
  onAddMessage, 
  onRefresh 
}) => {
  console.log("🔍 InstanceDetailsTable received:", instances);

  // State for alarm modal and refresh
  const [alarmModal, setAlarmModal] = useState({
    show: false,
    instance: null
  });
  const [alarmLoading, setAlarmLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Instance type change modal state
  const [instanceTypeModal, setInstanceTypeModal] = useState({
    show: false,
    instance: null
  });

  // *** NEW: Volume conversion modal state ***
  const [volumeConversionModal, setVolumeConversionModal] = useState({
    show: false,
    instance: null
  });
  const [volumeLoading, setVolumeLoading] = useState(false);

  // Refresh button handler - fetches real-time data
  const handleRefreshInstances = async () => {
    if (!accountId) return;
    
    setRefreshing(true);
    
    try {
      console.log('🔄 Refreshing instance data for account:', accountId);
      
      if (onAddMessage) {
        onAddMessage('🔄 Refresh instance status', 'user');
      }
      
      const response = await discoverInstances(accountId);
      
      if (response.status === 'success' && response.data.instances) {
        setInstances(response.data.instances);
        
        if (onAddMessage) {
          const summary = response.data.summary;
          const refreshMessage = `✅ **Instance data refreshed successfully!**\n\n` +
            `📊 **Updated Summary:**\n` +
            `• **Total Instances:** ${summary.totalInstances}\n` +
            `• **Running:** ${summary.runningInstances}\n` +
            `• **CW Configured:** ${summary.configuredInstances}\n` +
            `• **Alarms Configured:** ${summary.alarmsConfiguredInstances || 0}\n` +
            `• **Needs Configuration:** ${summary.unconfiguredInstances}\n\n` +
            `🕒 **Refreshed at:** ${new Date().toLocaleTimeString()}`;
          
          setTimeout(() => {
            onAddMessage(refreshMessage, 'bot');
          }, 500);
        }
        
        console.log('✅ Instance data refreshed successfully');
      } else {
        throw new Error('Failed to fetch instance data');
      }
      
    } catch (error) {
      console.error('❌ Error refreshing instances:', error);
      
      if (onAddMessage) {
        setTimeout(() => {
          onAddMessage(
            `❌ **Failed to refresh instance data**\n\n**Error:** ${error.message}`,
            'bot'
          );
        }, 500);
      }
    } finally {
      setRefreshing(false);
    }
  };

  // Enhanced instance status detection
  const getInstanceStatus = (instance) => {
    const hasAgent = instance.CloudWatchConfigured;
    const hasAlarms = instance.AlarmsConfigured;
    
    if (hasAgent && hasAlarms) {
      return {
        status: 'alarm_configured',
        text: '🎯 Alarm Configured',
        className: 'alarm-configured',
        actionNeeded: false
      };
    } else if (hasAgent) {
      return {
        status: 'agent_configured', 
        text: instance.CloudWatchDisplay || '✅ Configured (CWAgent - diskio_io_time)',
        className: 'configured',
        actionNeeded: false
      };
    } else {
      return {
        status: 'not_configured',
        text: instance.CloudWatchDisplay || '❌ Not Configured (no metrics)',
        className: 'not-configured',
        actionNeeded: true
      };
    }
  };

  // Sort instances
  const sortedInstances = [...instances].sort((a, b) => {
    const statusA = getInstanceStatus(a);
    const statusB = getInstanceStatus(b);
    
    const priority = {
      'not_configured': 0,
      'agent_configured': 1, 
      'alarm_configured': 2
    };
    
    if (priority[statusA.status] !== priority[statusB.status]) {
      return priority[statusA.status] - priority[statusB.status];
    }
    
    if (a.State !== b.State) {
      return a.State === 'running' ? -1 : 1;
    }
    
    return 0;
  });

  // Handle alarm configuration
  const handleAlarmConfiguration = (instance) => {
    setAlarmModal({
      show: true,
      instance: instance
    });
  };

  // Handle instance type change
  const handleInstanceTypeChange = (instance) => {
    setInstanceTypeModal({
      show: true,
      instance: instance
    });
  };

  // *** NEW: Handle volume conversion ***
  const handleVolumeConversion = (instance) => {
    setVolumeConversionModal({
      show: true,
      instance: instance
    });
  };

  // Handle alarm confirmation with chat integration
  const handleConfirmAlarmConfig = async (alarmConfig) => {
    const { instance } = alarmModal;
    setAlarmModal({ show: false, instance: null });
    
    setAlarmLoading(true);
    
    try {
      console.log(`⚠️ Configuring alarms for ${instance.InstanceId}`);
      
      if (onAddMessage) {
        onAddMessage(`Configure alarms for ${instance.InstanceId}`, 'user');
      }
      
      const response = await configureAlarms({
        instanceId: instance.InstanceId,
        accountId: accountId,
        region: instance.Region,
        platform: instance.Platform,
        alarmConfig: alarmConfig
      });
      
      if (response.success) {
        if (setInstances) {
          setInstances(prevInstances => 
            prevInstances.map(inst => 
              inst.InstanceId === instance.InstanceId
                ? { ...inst, AlarmsConfigured: true }
                : inst
            )
          );
        }
        
        if (onAddMessage) {
          const alarmCount = response.alarmDetails?.successfulAlarms || response.alarmDetails?.totalAlarms || 4;
          const createdAlarms = response.alarmDetails?.createdAlarms || [];
          
          const chatMessage = formatAlarmSuccessMessage({
            instanceId: instance.InstanceId,
            instanceName: instance.InstanceName,
            platform: instance.Platform?.includes('windows') ? 'Windows' : 'Linux',
            alarmCount,
            createdAlarms
          });
          
          setTimeout(() => {
            onAddMessage(chatMessage, 'bot');
          }, 500);
        }
        
        setTimeout(() => {
          handleRefreshInstances();
        }, 2000);
        
      } else if (response.partialSuccess) {
        const successCount = response.alarmDetails.successfulAlarms;
        const totalCount = response.alarmDetails.totalAlarms;
        
        if (onAddMessage) {
          const chatMessage = `⚠️ **Partially configured ${successCount}/${totalCount} alarms for ${instance.InstanceName || instance.InstanceId}**\n\nSome alarms may need attention. Please check CloudWatch console for details.`;
          
          setTimeout(() => {
            onAddMessage(chatMessage, 'bot');
          }, 500);
        }
      } else {
        throw new Error(response.error);
      }
      
    } catch (error) {
      console.error('Error configuring alarms:', error);
      
      if (onAddMessage) {
        const errorMessage = `❌ **Failed to configure alarms for ${instance.InstanceName || instance.InstanceId}**\n\n**Error:** ${error.message}\n\n🔧 **Troubleshooting:**\n• Verify instance has CloudWatch agent installed\n• Check IAM permissions for CloudWatch alarm creation\n• Ensure instance is running and accessible`;
        
        setTimeout(() => {
          onAddMessage(errorMessage, 'bot');
        }, 500);
      }
    } finally {
      setAlarmLoading(false);
    }
  };

  // Handle successful instance type change
  const handleInstanceTypeChangeSuccess = () => {
    setInstanceTypeModal({ show: false, instance: null });
    
    if (onAddMessage) {
      const { instance } = instanceTypeModal;
      const displayName = instance.InstanceName || instance.InstanceId;
      
      const successMessage = `✅ **Instance type change completed successfully!**\n\n` +
        `🔧 **Instance:** ${displayName}\n` +
        `📊 **Account:** ${accountId}\n` +
        `⏱️ **Completed at:** ${new Date().toLocaleTimeString()}\n\n` +
        `🔄 **Refreshing instance data to show updated type...**`;
      
      setTimeout(() => {
        onAddMessage(successMessage, 'bot');
      }, 500);
    }
    
    setTimeout(() => {
      handleRefreshInstances();
    }, 2000);
  };

  // *** NEW: Handle successful volume conversion ***
  const handleVolumeConversionSuccess = (conversionResults) => {
    setVolumeConversionModal({ show: false, instance: null });
    
    if (onAddMessage) {
      const { instance } = volumeConversionModal;
      const displayName = instance.InstanceName || instance.InstanceId;
      
      const successMessage = `✅ **Volume conversion to GP3 initiated successfully!**\n\n` +
        `💿 **Instance:** ${displayName}\n` +
        `📊 **Account:** ${accountId}\n` +
        `🔄 **Volumes Converting:** ${conversionResults.totalVolumes || 'Multiple'}\n` +
        `💰 **Expected Savings:** ~20% cost reduction\n` +
        `⏱️ **Estimated Time:** 5-15 minutes per volume\n\n` +
        `🔄 **Conversion running in background...**`;
      
      setTimeout(() => {
        onAddMessage(successMessage, 'bot');
      }, 500);
    }
    
    // Refresh after a delay to allow conversion to start
    setTimeout(() => {
      handleRefreshInstances();
    }, 3000);
  };

  // Format success message for chat
  const formatAlarmSuccessMessage = ({ instanceId, instanceName, platform, alarmCount, createdAlarms }) => {
    const displayName = instanceName || instanceId;
    
    let message = `✅ **Successfully configured ${alarmCount} CloudWatch alarms for ${displayName}!**\n\n**Alarms created:**\n`;
    
    if (createdAlarms.length > 0) {
      createdAlarms.forEach(alarm => {
        if (alarm.includes('CPU-Utilization')) {
          message += `🖥️ ${alarm}\n`;
        } else if (alarm.includes('Memory-Utilization')) {
          message += `💾 ${alarm}\n`;
        } else if (alarm.includes('Disk-Utilization')) {
          message += `💿 ${alarm}\n`;
        } else if (alarm.includes('Overall-Utilization')) {
          message += `📊 ${alarm}\n`;
        } else if (alarm.includes('StatusCheck')) {
          message += `⚠️ ${alarm}\n`;
        } else {
          message += `📊 ${alarm}\n`;
        }
      });
    } else {
      message += `🖥️ ${instanceId}-CPU-Utilization\n`;
      message += `💾 ${instanceId}-Memory-Utilization\n`;
      message += `${platform === 'Windows' ? '📊' : '💿'} ${instanceId}-${platform === 'Windows' ? 'Overall' : 'Disk'}-Utilization\n`;
      message += `⚠️ ${instanceId}-StatusCheck-System\n`;
    }
    
    message += `\n**Platform:** ${platform}`;
    message += `\n**Evaluation:** 1 out of 1 datapoints within 5 minutes`;
    message += `\n\n🎯 **Next Steps:**`;
    message += `\n• Check CloudWatch Console → Alarms to view alarm status`;
    message += `\n• Monitor instance ${instanceId} for threshold breaches`;
    message += `\n• Alarms will trigger when metrics exceed configured thresholds`;
    
    return message;
  };

  return (
    <>
      <div className="instance-details-card">
        {/* Header with Refresh Button */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ margin: 0 }}>Details for Account [{accountId}]. Select an instance to configure:</h3>
          
          <button
            className="btn btn-primary"
            onClick={handleRefreshInstances}
            disabled={refreshing}
            style={{
              background: refreshing 
                ? 'linear-gradient(90deg, #9CA3AF, #6B7280)' 
                : 'linear-gradient(90deg, #814fff 0%, #7169e1 100%)',
              color: 'white',
              border: 'none',
              padding: '10px 20px',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: refreshing ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.2s ease'
            }}
          >
            <span style={{ 
              fontSize: '16px',
              animation: refreshing ? 'spin 1s linear infinite' : 'none'
            }}>
              🔄
            </span>
            {refreshing ? 'Refreshing...' : 'Refresh Status'}
          </button>
        </div>
        
        <div className="instance-table-container">
          <table className="instances-table">
            <thead>
              <tr>
                <th>INSTANCE ID</th>
                <th>INSTANCE NAME</th>
                <th>STATUS</th>
                <th>REGION</th>
                <th>PLATFORM</th>
                <th>INSTANCE TYPE</th>
                <th>CW AGENT CONFIG</th>
                <th>VOLUME CONVERSION</th>        {/* *** NEW COLUMN *** */}
                <th>INSTANCE TYPE CHANGE</th>
                <th>ALARM CONFIGURATION</th>
                <th>ALARM ACTIVE</th>
              </tr>
            </thead>
            <tbody>
              {sortedInstances.map(instance => {
                const statusInfo = getInstanceStatus(instance);
                
                return (
                  <tr 
                    key={instance.InstanceId} 
                    className={statusInfo.actionNeeded ? 'selectable' : 'configured'}
                    onClick={() => {
                      if (statusInfo.actionNeeded) {
                        onInstanceSelect(instance.InstanceId, instance.Region);
                      }
                    }}
                  >
                    
                    <td className="instance-id">
                      {statusInfo.actionNeeded ? (
                        <div className="selectable-instance">{instance.InstanceId}</div>
                      ) : (
                        instance.InstanceId
                      )}
                    </td>
                    
                    <td className="instance-name">
                      <strong>{instance.InstanceName || 'No Name'}</strong>
                    </td>
                    
                    <td>
                      <span className={`status-badge ${instance.State}`}>
                        {instance.State === 'running' ? '🟢' : instance.State === 'stopped' ? '🔴' : '🟡'} {instance.State}
                      </span>
                    </td>
                    
                    <td>{instance.Region}</td>
                    
                    <td>
                      <span className="platform-badge">
                        {instance.Platform?.includes('windows') ? '🪟 Windows' : '🐧 Linux'}
                      </span>
                    </td>
                    
                    <td>
                      <span className="instance-type-badge" style={{
                        backgroundColor: '#E0E7FF',
                        color: '#3B82F6',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: '600'
                      }}>
                        {instance.InstanceType}
                      </span>
                    </td>
                    
                    <td>
                      <span className={statusInfo.className}>
                        {statusInfo.text}
                      </span>
                    </td>
                    
                    {/* *** NEW COLUMN: Volume Conversion *** */}
                    <td style={{ textAlign: 'center' }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleVolumeConversion(instance);
                        }}
                        disabled={instance.State === 'terminated' || volumeLoading}
                        className="volume-conversion-btn"
                        style={{
                          backgroundColor: '#10B981',
                          borderColor: '#10B981',
                          color: 'white',
                          padding: '6px 12px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: '500',
                          cursor: (instance.State === 'terminated' || volumeLoading) ? 'not-allowed' : 'pointer',
                          opacity: (instance.State === 'terminated' || volumeLoading) ? 0.5 : 1,
                          border: 'none',
                          whiteSpace: 'nowrap',
                          transition: 'all 0.2s ease'
                        }}
                        title={instance.State === 'terminated' ? 'Cannot convert volumes of terminated instance' : 'Convert GP2 volumes to GP3 for cost savings'}
                      >
                        {volumeLoading ? '⏳ Converting...' : '💿 Convert Volumes'}
                      </button>
                    </td>
                    
                    {/* Instance Type Change Column */}
                    <td style={{ textAlign: 'center' }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleInstanceTypeChange(instance);
                        }}
                        disabled={instance.State === 'terminated'}
                        style={{
                          backgroundColor: '#F59E0B',
                          borderColor: '#F59E0B',
                          color: 'white',
                          padding: '6px 12px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: '500',
                          cursor: instance.State === 'terminated' ? 'not-allowed' : 'pointer',
                          opacity: instance.State === 'terminated' ? 0.5 : 1,
                          border: 'none',
                          whiteSpace: 'nowrap'
                        }}
                        title={instance.State === 'terminated' ? 'Cannot change type of terminated instance' : 'Change instance type (requires restart)'}
                      >
                        🔧 Change Type
                      </button>
                    </td>
                    
                    {/* Alarm Configuration Column */}
                    <td style={{ textAlign: 'center' }}>
                      {statusInfo.status === 'agent_configured' && instance.State === 'running' ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAlarmConfiguration(instance);
                          }}
                          disabled={alarmLoading}
                          style={{
                            backgroundColor: '#F59E0B',
                            borderColor: '#F59E0B',
                            color: 'white',
                            padding: '6px 12px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: '500',
                            cursor: alarmLoading ? 'not-allowed' : 'pointer',
                            opacity: alarmLoading ? 0.7 : 1,
                            border: 'none',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          {alarmLoading ? '⏳ Configuring...' : '⚠️ Configure Alarms'}
                        </button>
                      ) : (
                        <span style={{ color: '#9CA3AF', fontSize: '11px' }}>
                          {statusInfo.status === 'alarm_configured' ? '✅ Configured' : 
                           statusInfo.status === 'not_configured' ? 'Agent Required' : 
                           instance.State !== 'running' ? 'Instance Stopped' : 'Not Available'}
                        </span>
                      )}
                    </td>
                    
                    {/* Alarm Active Column */}
                    <td style={{ textAlign: 'center' }}>
                      {statusInfo.status === 'alarm_configured' ? (
                        <span style={{
                          color: '#7C3AED',
                          fontSize: '12px',
                          fontWeight: '600'
                        }}>
                          🎯 Alarms Active
                        </span>
                      ) : (
                        <span style={{ color: '#9CA3AF', fontSize: '11px' }}>
                          Not Active
                        </span>
                      )}
                    </td>
                    
                  </tr>
                );
              })}
            </tbody>
          </table>
          
          {/* Updated Instructions */}
          <div className="table-instructions" style={{
            padding: '16px',
            backgroundColor: '#F8FAFC',
            borderTop: '1px solid #E2E8F0',
            borderRadius: '0 0 12px 12px',
            fontSize: '14px',
            color: '#6B7280'
          }}>
            <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
              <div>
                <strong style={{ color: '#8B5CF6' }}>💡 Agent Installation:</strong> Click on unconfigured instance rows to install CloudWatch agent
              </div>
              <div>
                <strong style={{ color: '#10B981' }}>💿 Volume Conversion:</strong> Convert GP2 volumes to GP3 for 20% cost savings
              </div>
              <div>
                <strong style={{ color: '#F59E0B' }}>🔧 Instance Type Change:</strong> Use "Change Type" column to resize instances (causes downtime)
              </div>
              <div>
                <strong style={{ color: '#F59E0B' }}>⚠️ Alarm Configuration:</strong> Use "Configure Alarms" column for configured instances
              </div>
              <div>
                <strong style={{ color: '#7C3AED' }}>🎯 Alarms Active:</strong> Shows instances with both agent and alarms configured
              </div>
              <div>
                <strong style={{ color: '#814fff' }}>🔄 Refresh:</strong> Use refresh button to get real-time instance status
              </div>
            </div>
          </div>
          
          {sortedInstances.length === 0 && (
            <div className="no-instances" style={{
              textAlign: 'center',
              padding: '40px',
              color: '#6B7280'
            }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔍</div>
              <h4>No instances found</h4>
              <p>No EC2 instances were discovered in this account across all regions.</p>
            </div>
          )}
          
        </div>
        
        {/* Enhanced Summary Statistics */}
        {sortedInstances.length > 0 && (
          <div className="instance-summary" style={{
            marginTop: '20px',
            padding: '16px',
            backgroundColor: '#F8FAFC',
            borderRadius: '8px',
            border: '1px solid #E2E8F0'
          }}>
            <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
              <div>
                <strong style={{ color: '#374151' }}>Total Instances:</strong>
                <span style={{ marginLeft: '8px', color: '#6B7280' }}>{sortedInstances.length}</span>
              </div>
              <div>
                <strong style={{ color: '#374151' }}>Running:</strong>
                <span style={{ marginLeft: '8px', color: '#10B981' }}>
                  {sortedInstances.filter(i => i.State === 'running').length}
                </span>
              </div>
              <div>
                <strong style={{ color: '#374151' }}>CW Configured:</strong>
                <span style={{ marginLeft: '8px', color: '#8B5CF6' }}>
                  {sortedInstances.filter(i => i.CloudWatchConfigured).length}
                </span>
              </div>
              <div>
                <strong style={{ color: '#374151' }}>Alarms Configured:</strong>
                <span style={{ marginLeft: '8px', color: '#7C3AED' }}>
                  {sortedInstances.filter(i => i.AlarmsConfigured).length}
                </span>
              </div>
              <div>
                <strong style={{ color: '#374151' }}>Needs Configuration:</strong>
                <span style={{ marginLeft: '8px', color: '#F59E0B' }}>
                  {sortedInstances.filter(i => getInstanceStatus(i).actionNeeded && i.State === 'running').length}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Alarm Configuration Modal */}
      <AlarmConfigurationModal
        show={alarmModal.show}
        instance={alarmModal.instance}
        onConfirm={handleConfirmAlarmConfig}
        onCancel={() => setAlarmModal({ show: false, instance: null })}
      />

      {/* Instance Type Change Modal */}
      <InstanceTypeChangeModal
        show={instanceTypeModal.show}
        onHide={() => setInstanceTypeModal({ show: false, instance: null })}
        instance={instanceTypeModal.instance}
        accountId={accountId}
        onSuccess={handleInstanceTypeChangeSuccess}
      />

      {/* *** NEW: Volume Conversion Modal *** */}
      <VolumeConversionModal
        show={volumeConversionModal.show}
        onHide={() => setVolumeConversionModal({ show: false, instance: null })}
        instance={volumeConversionModal.instance}
        accountId={accountId}
        onSuccess={handleVolumeConversionSuccess}
        onLoading={(loading) => setVolumeLoading(loading)}
      />
    </>
  );
};

export default InstanceDetailsTable;
