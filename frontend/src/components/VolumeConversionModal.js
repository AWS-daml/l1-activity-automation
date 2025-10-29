// components/VolumeConversionModal.js - UNIVERSAL VOLUME CONVERSION - FIXED CONVERSION
import React, { useState, useEffect } from 'react';
import { convertGp2ToGp3Volumes, findGp2Volumes } from '../Services/api';

const VolumeConversionModal = ({ 
  show, 
  onHide, 
  instance, 
  accountId, 
  onSuccess,
  onLoading 
}) => {
  const [loading, setLoading] = useState(false);
  const [discovering, setDiscovering] = useState(false);
  const [volumes, setVolumes] = useState([]);
  const [selectedVolumes, setSelectedVolumes] = useState([]);
  const [conversionScope, setConversionScope] = useState('instance'); // 'instance' or 'region'
  const [targetVolumeType, setTargetVolumeType] = useState('gp3'); // NEW: Target volume type
  const [customIops, setCustomIops] = useState(''); // NEW: Custom IOPS
  const [customThroughput, setCustomThroughput] = useState(''); // NEW: Custom throughput
  const [sourceVolumeTypeFilter, setSourceVolumeTypeFilter] = useState('gp2'); // NEW: Source filter
  const [error, setError] = useState('');
  const [step, setStep] = useState('discovery'); // 'discovery', 'selection', 'configuration', 'confirmation'

  // ✅ Universal volume type options
  const volumeTypeOptions = [
    { 
      value: 'gp2', 
      label: 'GP2 (General Purpose SSD - Previous)', 
      description: 'Previous generation SSD (not recommended for new deployments)',
      benefits: 'Legacy compatibility',
      supportsCustom: false,
      recommended: false
    }
  ];

  // ✅ Source volume type filter options
  const sourceVolumeFilters = [
    { value: 'all', label: 'All Volume Types', description: 'Show all attached volumes' },
    { value: 'gp2', label: 'GP2 Only', description: 'Show only GP2 volumes (recommended for conversion)' },
  ];

  // ✅ Get conversion benefits
  const getConversionBenefits = (sourceType, targetType) => {
    const conversions = {
      'gp2->gp3': { savings: '~20%', performance: 'Better baseline', note: 'Highly recommended', color: '#10B981' },
    };
    
    const key = `${sourceType}->${targetType}`;
    return conversions[key] || { 
      savings: 'Varies', 
      performance: 'Different', 
      note: 'Review requirements', 
      color: '#6B7280' 
    };
  };

  // ✅ Calculate optimal performance settings
  const calculateOptimalSettings = (volumeSize, targetType) => {
    const targetOption = volumeTypeOptions.find(opt => opt.value === targetType);
    if (!targetOption || !targetOption.supportsCustom) return null;

    if (targetType === 'gp3') {
      const optimalIops = Math.max(3000, Math.min(volumeSize * 3, 16000));
      const optimalThroughput = Math.max(125, Math.min(Math.floor(optimalIops / 4), 1000));
      return { iops: optimalIops, throughput: optimalThroughput };
    } else if (targetType === 'io1' || targetType === 'io2') {
      const multiplier = targetType === 'io2' ? 500 : 100;
      const optimalIops = Math.max(100, Math.min(volumeSize * multiplier, 64000));
      return { iops: optimalIops };
    }
    
    return null;
  };

  // Reset state when modal opens
  useEffect(() => {
    if (show && instance) {
      setStep('discovery');
      setVolumes([]);
      setSelectedVolumes([]);
      setError('');
      setConversionScope('instance');
      setTargetVolumeType('gp3');
      setSourceVolumeTypeFilter('gp2');
      setCustomIops('');
      setCustomThroughput('');
      discoverVolumes();
    }
  }, [show, instance]);

  // ✅ FIXED: Discover volumes with correct response handling
  const discoverVolumes = async () => {
    if (!instance || !accountId) return;
    
    setDiscovering(true);
    setError('');
    
    try {
      console.log('🔍 Starting volume discovery...');
      console.log('📋 Parameters:', {
        accountId,
        instanceId: instance.InstanceId,
        region: instance.Region,
        sourceVolumeTypeFilter
      });
      
      const response = await findGp2Volumes({
        accountId: accountId,
        region: instance.Region,
        instanceId: conversionScope === 'instance' ? instance.InstanceId : null,
        volumeTypeFilter: sourceVolumeTypeFilter
      });
      
      // ✅ FIXED: Correct response parsing
      console.log('📥 Full API response:', response);
      
      let actualData;
      if (response.status === 'success' && response.data) {
        // Flask wrapped response: {status: "success", data: {...}}
        actualData = response.data;
        console.log('📦 Using response.data:', actualData);
      } else if (response.success) {
        // Direct response: {success: true, ...}
        actualData = response;
        console.log('📦 Using direct response:', actualData);
      } else {
        console.error('❌ Invalid response structure:', response);
        throw new Error('Invalid response structure from server');
      }
      
      // Check if the actual operation was successful
      if (actualData.success) {
        const foundVolumes = actualData.volumes || [];
        console.log('💿 Found volumes:', foundVolumes);
        
        setVolumes(foundVolumes);
        
        if (foundVolumes.length === 0) {
          setStep('no_volumes');
        } else {
          // Auto-select volumes that would benefit from conversion
          const recommendedVolumes = foundVolumes.filter(v => {
            const benefits = getConversionBenefits(v.VolumeType, targetVolumeType);
            return benefits.color === '#10B981'; // Green = recommended
          });
          
          setSelectedVolumes(
            recommendedVolumes.length > 0 
              ? recommendedVolumes.map(v => v.VolumeId)
              : foundVolumes.map(v => v.VolumeId)
          );
          setStep('selection');
        }
      } else {
        throw new Error(actualData.error || actualData.message || 'Volume discovery failed');
      }
    } catch (err) {
      console.error('❌ Error discovering volumes:', err);
      setError(err.message);
      setStep('error');
    } finally {
      setDiscovering(false);
    }
  };

  // ✅ FIXED: Use API.js function instead of direct fetch
  const handleConvert = async () => {
    if (selectedVolumes.length === 0) {
      setError('Please select at least one volume to convert');
      return;
    }
    
    setLoading(true);
    if (onLoading) onLoading(true);
    
    try {
      console.log('🚀 Starting conversion for volumes:', selectedVolumes);
      console.log('🎯 Target type:', targetVolumeType);
      console.log('⚙️ Custom settings:', { customIops, customThroughput });
      
      // ✅ FIXED: Use your existing convertGp2ToGp3Volumes function
      const response = await convertGp2ToGp3Volumes({
        accountId: accountId,
        region: instance.Region,
        volumeIds: selectedVolumes,
        newVolumeType: targetVolumeType,        // ✅ Pass target type
        targetIops: customIops || null,         // ✅ Pass custom IOPS  
        targetThroughput: customThroughput || null // ✅ Pass custom throughput
      });
      
      console.log('📥 Conversion response:', response);
      
      // ✅ FIXED: Handle the response correctly
      let conversionData;
      if (response.status === 'success' && response.data) {
        conversionData = response.data;
        console.log('📦 Using response.data:', conversionData);
      } else if (response.success) {
        conversionData = response;
        console.log('📦 Using direct response:', conversionData);
      } else {
        console.error('❌ Invalid conversion response:', response);
        throw new Error('Invalid conversion response from server');
      }
      
      console.log('🔍 Conversion data:', conversionData);
      console.log('✅ Success status:', conversionData.success);
      console.log('📊 Summary:', conversionData.summary);
      
      if (conversionData.success && conversionData.summary) {
        const { successfulConversions, failedConversions, totalVolumes } = conversionData.summary;
        
        console.log('🎯 Conversion results:', { successfulConversions, failedConversions, totalVolumes });
        
        if (successfulConversions > 0) {
          const message = successfulConversions === totalVolumes 
            ? `✅ Successfully initiated conversion of all ${successfulConversions} volumes to ${targetVolumeType.toUpperCase()}!`
            : `⚠️ Partially successful: ${successfulConversions} of ${totalVolumes} volumes converted to ${targetVolumeType.toUpperCase()}`;
          
          console.log('🎉 Success message:', message);
          
          if (onSuccess) {
            onSuccess({
              totalVolumes: totalVolumes,
              successfulConversions: successfulConversions,
              failedConversions: failedConversions,
              conversionScope: conversionScope,
              targetType: targetVolumeType,
              estimatedSavings: successfulConversions * 15, // Rough estimate
              results: conversionData.conversionResults || []
            });
          }
          onHide();
        } else {
          throw new Error(`All ${totalVolumes} volume conversions failed. Check Lambda logs for details.`);
        }
      } else {
        console.error('❌ Conversion failed:', conversionData);
        throw new Error(conversionData.error || conversionData.message || 'Conversion failed - no success status');
      }
      
    } catch (err) {
      console.error('❌ Error converting volumes:', err);
      console.error('❌ Full error details:', {
        message: err.message,
        stack: err.stack,
        selectedVolumes,
        targetVolumeType,
        customIops,
        customThroughput
      });
      setError(err.message || 'Failed to convert volumes');
    } finally {
      setLoading(false);
      if (onLoading) onLoading(false);
    }
  };

  // Handle volume selection
  const handleVolumeSelect = (volumeId, checked) => {
    if (checked) {
      setSelectedVolumes(prev => [...prev, volumeId]);
    } else {
      setSelectedVolumes(prev => prev.filter(id => id !== volumeId));
    }
  };

  // ✅ Handle scope change with rediscovery
  const handleScopeChange = (newScope) => {
    setConversionScope(newScope);
    setVolumes([]);
    setSelectedVolumes([]);
    setStep('discovery');
    setTimeout(discoverVolumes, 100);
  };

  // ✅ Handle source filter change
  const handleSourceFilterChange = (newFilter) => {
    setSourceVolumeTypeFilter(newFilter);
    setVolumes([]);
    setSelectedVolumes([]);
    setStep('discovery');
    setTimeout(discoverVolumes, 100);
  };

  // ✅ Proceed to configuration step
  const proceedToConfiguration = () => {
    if (selectedVolumes.length === 0) {
      setError('Please select at least one volume to convert');
      return;
    }
    
    // Set optimal defaults for selected volumes
    const selectedVolumeObjects = volumes.filter(v => selectedVolumes.includes(v.VolumeId));
    if (selectedVolumeObjects.length > 0) {
      const avgSize = Math.round(selectedVolumeObjects.reduce((sum, v) => sum + v.Size, 0) / selectedVolumeObjects.length);
      const optimal = calculateOptimalSettings(avgSize, targetVolumeType);
      if (optimal) {
        if (optimal.iops) setCustomIops(optimal.iops.toString());
        if (optimal.throughput) setCustomThroughput(optimal.throughput.toString());
      }
    }
    
    setError('');
    setStep('configuration');
  };

  if (!show || !instance) return null;

  const selectedVolumeType = volumeTypeOptions.find(opt => opt.value === targetVolumeType);
  const selectedSourceFilter = sourceVolumeFilters.find(f => f.value === sourceVolumeTypeFilter);

  return (
    <div className="modal-overlay" style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div className="modal-content" style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        width: '95%',
        maxWidth: '700px',
        maxHeight: '95vh',
        overflow: 'hidden',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
      }}>
        
        {/* ✅ Enhanced Header */}
        <div className="volume-modal-header" style={{
          background: 'linear-gradient(90deg, #10B981, #047857)',
          color: 'white',
          padding: '20px 24px',
          borderRadius: '12px 12px 0 0'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              <h3 style={{ margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '12px', fontSize: '20px' }}>
                <span style={{ fontSize: '28px' }}>💿</span>
                Volume Converter
              </h3>
              <p style={{ margin: '0', opacity: 0.9, fontSize: '14px' }}>
                {instance.InstanceName || instance.InstanceId} • {instance.Region}
                {sourceVolumeTypeFilter !== 'all' && (
                  <span> • Converting {sourceVolumeTypeFilter.toUpperCase()} → {targetVolumeType.toUpperCase()}</span>
                )}
              </p>
            </div>
            <button
              onClick={onHide}
              style={{
                background: 'rgba(255,255,255,0.2)',
                border: 'none',
                color: 'white',
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                cursor: 'pointer',
                fontSize: '18px',
                fontWeight: 'bold'
              }}
            >
              ×
            </button>
          </div>
        </div>

        <div style={{ padding: '24px', maxHeight: 'calc(95vh - 200px)', overflow: 'auto' }}>
          
          {/* ✅ Source Volume Filter */}
          <div className="volume-info-card" style={{
            marginBottom: '20px',
            padding: '16px',
            backgroundColor: '#F8FAFC',
            borderRadius: '8px',
            border: '1px solid #E2E8F0'
          }}>
            <h4 style={{ margin: '0 0 12px 0', color: '#1E40AF' }}>
              🔍 Volume Discovery Settings
            </h4>
            
            {/* Source Volume Type Filter */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px' }}>
                Source Volume Types:
              </label>
              <select
                value={sourceVolumeTypeFilter}
                onChange={(e) => handleSourceFilterChange(e.target.value)}
                disabled={discovering || loading}
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: '6px',
                  border: '1px solid #D1D5DB',
                  fontSize: '14px'
                }}
              >
                {sourceVolumeFilters.map(filter => (
                  <option key={filter.value} value={filter.value}>
                    {filter.label} - {filter.description}
                  </option>
                ))}
              </select>
            </div>

            {/* Conversion Scope */}
            <div>
              <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px' }}>
                Discovery Scope:
              </label>
              <div style={{ display: 'flex', gap: '16px' }}>
                <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    value="instance"
                    checked={conversionScope === 'instance'}
                    onChange={() => handleScopeChange('instance')}
                    disabled={discovering || loading}
                    style={{ marginRight: '8px' }}
                  />
                  <span>
                    <strong>Instance Volumes</strong>
                    <span style={{ marginLeft: '8px', color: '#6B7280', fontSize: '13px' }}>
                      (This instance only)
                    </span>
                  </span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    value="region"
                    checked={conversionScope === 'region'}
                    onChange={() => handleScopeChange('region')}
                    disabled={discovering || loading}
                    style={{ marginRight: '8px' }}
                  />
                  <span>
                    <strong>All Region Volumes</strong>
                    <span style={{ marginLeft: '8px', color: '#6B7280', fontSize: '13px' }}>
                      (Entire {instance.Region})
                    </span>
                  </span>
                </label>
              </div>
            </div>
          </div>

          {/* ✅ Target Volume Type Selection */}
          {(step === 'selection' || step === 'configuration') && (
            <div className="volume-info-card" style={{
              marginBottom: '20px',
              padding: '16px',
              backgroundColor: '#F0F9FF',
              borderRadius: '8px',
              border: '1px solid #BAE6FD'
            }}>
              <h4 style={{ margin: '0 0 12px 0', color: '#1E40AF' }}>
                🎯 Target Volume Type
              </h4>
              <select
                value={targetVolumeType}
                onChange={(e) => setTargetVolumeType(e.target.value)}
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '6px',
                  border: '1px solid #3B82F6',
                  fontSize: '14px',
                  fontWeight: '600'
                }}
              >
                {volumeTypeOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label} {option.recommended ? '⭐ RECOMMENDED' : ''}
                  </option>
                ))}
              </select>
              
              {selectedVolumeType && (
                <div style={{ 
                  marginTop: '12px', 
                  padding: '12px', 
                  backgroundColor: 'white', 
                  borderRadius: '6px',
                  border: '1px solid #E5E7EB'
                }}>
                  <div style={{ fontWeight: '600', marginBottom: '4px', color: '#1F2937' }}>
                    {selectedVolumeType.label}
                    {selectedVolumeType.recommended && (
                      <span style={{ 
                        marginLeft: '8px', 
                        backgroundColor: '#10B981', 
                        color: 'white', 
                        fontSize: '11px', 
                        padding: '2px 6px', 
                        borderRadius: '4px' 
                      }}>
                        RECOMMENDED
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '14px', color: '#6B7280', marginBottom: '6px' }}>
                    {selectedVolumeType.description}
                  </div>
                  <div style={{ fontSize: '14px', color: '#059669', fontWeight: '600' }}>
                    ✨ {selectedVolumeType.benefits}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Discovery Step */}
          {step === 'discovery' && (
            <div className="volume-conversion-progress" style={{ textAlign: 'center', padding: '40px 20px' }}>
              <div style={{ fontSize: '48px', marginBottom: '20px' }}>🔍</div>
              <h4 style={{ marginBottom: '12px' }}>
                Discovering {selectedSourceFilter?.label || 'Volumes'}...
              </h4>
              <p style={{ color: '#6B7280', marginBottom: '20px' }}>
                Scanning {conversionScope === 'instance' ? 'instance volumes' : 'region volumes'} in {instance.Region}
              </p>
              <div style={{
                width: '100%',
                height: '4px',
                backgroundColor: '#E5E7EB',
                borderRadius: '2px',
                overflow: 'hidden'
              }}>
                <div style={{
                  height: '100%',
                  width: '30%',
                  background: 'linear-gradient(90deg, #10B981, #047857)',
                  animation: 'loading 1.5s ease-in-out infinite',
                  borderRadius: '2px'
                }}></div>
              </div>
            </div>
          )}

          {/* No Volumes Found */}
          {step === 'no_volumes' && (
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <div style={{ fontSize: '64px', marginBottom: '20px' }}>✅</div>
              <h4 style={{ color: '#047857', marginBottom: '12px' }}>
                No {selectedSourceFilter?.label || 'Volumes'} Found!
              </h4>
              <p style={{ color: '#6B7280', marginBottom: '20px' }}>
                No {sourceVolumeTypeFilter} volumes found for {conversionScope === 'instance' ? 'this instance' : 'this region'}.
              </p>
              <button
                onClick={() => handleSourceFilterChange('all')}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#10B981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: '600'
                }}
              >
                🔍 Search All Volume Types
              </button>
            </div>
          )}

          {/* Volume Selection */}
          {step === 'selection' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h4 style={{ color: '#047857', margin: 0 }}>
                  📋 Select Volumes to Convert ({volumes.length} found)
                </h4>
                <div>
                  <button
                    onClick={() => setSelectedVolumes(volumes.map(v => v.VolumeId))}
                    style={{
                      marginRight: '8px',
                      padding: '6px 12px',
                      backgroundColor: '#10B981',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      fontSize: '12px',
                      cursor: 'pointer'
                    }}
                  >
                    Select All
                  </button>
                  <button
                    onClick={() => setSelectedVolumes([])}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: '#6B7280',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      fontSize: '12px',
                      cursor: 'pointer'
                    }}
                  >
                    Clear All
                  </button>
                </div>
              </div>

              <div style={{
                maxHeight: '250px',
                overflow: 'auto',
                border: '1px solid #D1D5DB',
                borderRadius: '8px',
                padding: '8px'
              }}>
                {volumes.map((volume) => {
                  const benefits = getConversionBenefits(volume.VolumeType, targetVolumeType);
                  const isRecommended = benefits.color === '#10B981';
                  
                  return (
                    <div key={volume.VolumeId} style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '12px',
                      borderBottom: '1px solid #F3F4F6',
                      backgroundColor: selectedVolumes.includes(volume.VolumeId) ? '#ECFDF5' : 'white',
                      borderLeft: isRecommended ? '4px solid #10B981' : '4px solid transparent',
                      marginBottom: '4px',
                      borderRadius: '4px'
                    }}>
                      <input
                        type="checkbox"
                        checked={selectedVolumes.includes(volume.VolumeId)}
                        onChange={(e) => handleVolumeSelect(volume.VolumeId, e.target.checked)}
                        style={{ marginRight: '12px' }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: '600', fontSize: '14px', marginBottom: '2px' }}>
                          {volume.VolumeId}
                          {isRecommended && (
                            <span style={{ 
                              marginLeft: '8px', 
                              backgroundColor: '#10B981', 
                              color: 'white', 
                              fontSize: '10px', 
                              padding: '2px 4px', 
                              borderRadius: '3px' 
                            }}>
                              RECOMMENDED
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '4px' }}>
                          <strong>{volume.VolumeType.toUpperCase()}</strong> • {volume.Size} GB • {volume.State} • {volume.AvailabilityZone}
                          {volume.Encrypted && <span style={{ color: '#F59E0B' }}> • 🔒 Encrypted</span>}
                        </div>
                        <div style={{ fontSize: '12px', color: benefits.color, fontWeight: '600' }}>
                          {volume.VolumeType} → {targetVolumeType}: {benefits.note} • {benefits.savings}
                        </div>
                      </div>
                      <div style={{ fontSize: '12px', color: '#047857', fontWeight: '600', textAlign: 'right' }}>
                        <div>{benefits.performance}</div>
                        <div style={{ opacity: 0.7 }}>{benefits.savings}</div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={{ 
                marginTop: '16px',
                padding: '16px',
                backgroundColor: '#F0FDF4',
                borderRadius: '8px',
                border: '1px solid #BBF7D0'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <strong style={{ color: '#047857' }}>
                    Selected: {selectedVolumes.length} of {volumes.length} volumes
                  </strong>
                  <strong style={{ color: '#1F2937' }}>
                    Converting to: {targetVolumeType.toUpperCase()}
                  </strong>
                </div>
                <div style={{ fontSize: '14px', color: '#374151' }}>
                  Estimated time: 5-15 minutes per volume • No downtime required
                </div>
              </div>
            </div>
          )}

          {/* ✅ Configuration Step */}
          {step === 'configuration' && (
            <div>
              <h4 style={{ color: '#1E40AF', marginBottom: '20px' }}>
                ⚙️ Performance Configuration for {targetVolumeType.toUpperCase()}
              </h4>
              
              {selectedVolumeType?.supportsCustom ? (
                <>
                  <div style={{
                    marginBottom: '20px',
                    padding: '16px',
                    backgroundColor: '#FFFBEB',
                    borderRadius: '8px',
                    border: '1px solid #FCD34D'
                  }}>
                    <h5 style={{ margin: '0 0 8px 0', color: '#92400E' }}>
                      💡 Performance Settings (Optional)
                    </h5>
                    <p style={{ margin: '0', fontSize: '14px', color: '#78350F' }}>
                      Leave empty for auto-calculated optimal settings based on volume size.
                    </p>
                  </div>

                  {targetVolumeType === 'gp3' && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                      <div>
                        <label style={{ display: 'block', fontWeight: '600', marginBottom: '6px' }}>
                          IOPS ({selectedVolumeType.baseIops?.toLocaleString()} - {selectedVolumeType.maxIops?.toLocaleString()})
                        </label>
                        <input
                          type="number"
                          value={customIops}
                          onChange={(e) => setCustomIops(e.target.value)}
                          placeholder={`${selectedVolumeType.baseIops} (auto)`}
                          min={selectedVolumeType.baseIops}
                          max={selectedVolumeType.maxIops}
                          style={{
                            width: '100%',
                            padding: '10px',
                            borderRadius: '6px',
                            border: '1px solid #D1D5DB',
                            fontSize: '14px'
                          }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontWeight: '600', marginBottom: '6px' }}>
                          Throughput MB/s ({selectedVolumeType.baseThroughput} - {selectedVolumeType.maxThroughput})
                        </label>
                        <input
                          type="number"
                          value={customThroughput}
                          onChange={(e) => setCustomThroughput(e.target.value)}
                          placeholder={`${selectedVolumeType.baseThroughput} (auto)`}
                          min={selectedVolumeType.baseThroughput}
                          max={selectedVolumeType.maxThroughput}
                          style={{
                            width: '100%',
                            padding: '10px',
                            borderRadius: '6px',
                            border: '1px solid #D1D5DB',
                            fontSize: '14px'
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {(targetVolumeType === 'io1' || targetVolumeType === 'io2') && (
                    <div style={{ marginBottom: '20px' }}>
                      <label style={{ display: 'block', fontWeight: '600', marginBottom: '6px' }}>
                        Provisioned IOPS ({selectedVolumeType.baseIops} - {selectedVolumeType.maxIops?.toLocaleString()})
                      </label>
                      <input
                        type="number"
                        value={customIops}
                        onChange={(e) => setCustomIops(e.target.value)}
                        placeholder="Auto-calculated based on volume size"
                        min={selectedVolumeType.baseIops}
                        max={selectedVolumeType.maxIops}
                        style={{
                          width: '100%',
                          padding: '10px',
                          borderRadius: '6px',
                          border: '1px solid #D1D5DB',
                          fontSize: '14px'
                        }}
                      />
                      <div style={{ fontSize: '12px', color: '#6B7280', marginTop: '4px' }}>
                        Recommended: {targetVolumeType === 'io2' ? '500' : '100'} IOPS per GB
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div style={{
                  padding: '16px',
                  backgroundColor: '#F3F4F6',
                  borderRadius: '8px',
                  textAlign: 'center'
                }}>
                  <p style={{ color: '#6B7280', margin: 0 }}>
                    {targetVolumeType.toUpperCase()} doesn't support custom performance settings.
                  </p>
                </div>
              )}

              {/* Conversion Preview */}
              <div style={{
                padding: '16px',
                backgroundColor: '#EFF6FF',
                borderRadius: '8px',
                border: '1px solid #DBEAFE'
              }}>
                <h5 style={{ margin: '0 0 12px 0', color: '#1E40AF' }}>
                  🚀 Conversion Preview
                </h5>
                <div style={{ fontSize: '14px', lineHeight: '1.6' }}>
                  <div><strong>Volumes:</strong> {selectedVolumes.length} selected</div>
                  <div><strong>Target Type:</strong> {targetVolumeType.toUpperCase()}</div>
                  {customIops && <div><strong>IOPS:</strong> {parseInt(customIops).toLocaleString()}</div>}
                  {customThroughput && <div><strong>Throughput:</strong> {customThroughput} MB/s</div>}
                  <div><strong>Estimated Time:</strong> 5-15 minutes per volume</div>
                  <div><strong>Downtime:</strong> None (online conversion)</div>
                </div>
              </div>
            </div>
          )}

          {/* Error State */}
          {step === 'error' && (
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <div style={{ fontSize: '64px', marginBottom: '20px' }}>❌</div>
              <h4 style={{ color: '#DC2626', marginBottom: '12px' }}>Discovery Failed</h4>
              <p style={{ color: '#6B7280', marginBottom: '20px' }}>
                {error}
              </p>
              <button
                onClick={discoverVolumes}
                style={{
                  padding: '12px 24px',
                  backgroundColor: '#10B981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: '600'
                }}
              >
                🔄 Try Again
              </button>
            </div>
          )}

          {/* Error Message */}
          {error && step !== 'error' && (
            <div style={{
              marginTop: '16px',
              padding: '12px',
              backgroundColor: '#FEF2F2',
              border: '1px solid #FECACA',
              borderRadius: '6px',
              color: '#DC2626'
            }}>
              <strong>Error:</strong> {error}
            </div>
          )}
        </div>

        {/* ✅ Enhanced Footer with Step Navigation */}
        <div style={{
          padding: '20px 24px',
          borderTop: '1px solid #E5E7EB',
          backgroundColor: '#F9FAFB',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <button
            onClick={onHide}
            disabled={loading}
            style={{
              padding: '10px 20px',
              backgroundColor: 'transparent',
              border: '1px solid #D1D5DB',
              borderRadius: '6px',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.5 : 1,
              fontWeight: '600'
            }}
          >
            Cancel
          </button>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            {/* Step Indicators */}
            {step === 'selection' && (
              <div style={{ fontSize: '12px', color: '#6B7280' }}>
                Step 1 of 2: Volume Selection
              </div>
            )}
            {step === 'configuration' && (
              <div style={{ fontSize: '12px', color: '#6B7280' }}>
                Step 2 of 2: Configuration
              </div>
            )}

            {/* Action Buttons */}
            {step === 'selection' && (
              <button
                onClick={proceedToConfiguration}
                disabled={selectedVolumes.length === 0}
                style={{
                  padding: '10px 24px',
                  backgroundColor: selectedVolumes.length === 0 ? '#9CA3AF' : '#3B82F6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontWeight: '600',
                  cursor: selectedVolumes.length === 0 ? 'not-allowed' : 'pointer'
                }}
              >
                Next: Configure →
              </button>
            )}

            {step === 'configuration' && (
              <>
                <button
                  onClick={() => setStep('selection')}
                  disabled={loading}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#6B7280',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    opacity: loading ? 0.5 : 1
                  }}
                >
                  ← Back
                </button>
                <button
                  onClick={handleConvert}
                  disabled={loading || selectedVolumes.length === 0}
                  style={{
                    padding: '10px 24px',
                    background: loading 
                      ? 'linear-gradient(90deg, #9CA3AF, #6B7280)' 
                      : 'linear-gradient(90deg, #10B981, #047857)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontWeight: '600',
                    cursor: (loading || selectedVolumes.length === 0) ? 'not-allowed' : 'pointer',
                    opacity: (loading || selectedVolumes.length === 0) ? 0.5 : 1,
                    minWidth: '160px'
                  }}
                >
                  {loading ? (
                    <>
                      <span style={{ marginRight: '8px' }}>⏳</span>
                      Converting...
                    </>
                  ) : (
                    <>
                      <span style={{ marginRight: '8px' }}>🚀</span>
                      Convert {selectedVolumes.length} Volume{selectedVolumes.length !== 1 ? 's' : ''}
                    </>
                  )}
                </button>
              </>
            )}

            {step === 'no_volumes' && (
              <button
                onClick={onHide}
                style={{
                  padding: '10px 24px',
                  background: 'linear-gradient(90deg, #10B981, #047857)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                ✅ Close
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ✅ Add loading animation styles */}
      <style jsx>{`
        @keyframes loading {
          0% { transform: translateX(-100%); }
          50% { transform: translateX(0%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
};

export default VolumeConversionModal;
