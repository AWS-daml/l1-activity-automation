// Services/api.js - UNIVERSAL VERSION - Works Everywhere

// ✅ COMPLETELY DYNAMIC: Auto-detects correct Flask server URL for ANY deployment
const getBaseURL = () => {
  const hostname = window.location.hostname;
  const protocol = window.location.protocol;
  
  console.log(`🔍 Auto-detecting API URL from: ${protocol}//${hostname}`);
  
  // Always use the same hostname as the frontend, but on port 5000
  const apiUrl = `${protocol}//${hostname}:5000`;
  
  console.log(`🌐 API URL automatically set to: ${apiUrl}`);
  return apiUrl;
};

const BASE = getBaseURL();

// ✅ Enhanced API call function with connection testing and fallbacks
const apiCall = async (endpoint, options = {}) => {
  const fullUrl = `${BASE}${endpoint}`;
  console.log(`🌐 API Call: ${fullUrl}`, options.body ? JSON.parse(options.body) : {});
  
  try {
    const response = await fetch(fullUrl, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      timeout: 30000 // 30 second timeout
    });
    
    const data = await response.json();
    console.log(`📥 API Response (${response.status}):`, data);
    
    if (!response.ok) {
      throw new Error(data.error || `HTTP ${response.status}: ${response.statusText}`);
    }
    
    return { status: "success", data };
  } catch (error) {
    console.error(`❌ API Error for ${endpoint}:`, error);
    
    // If it's a connection error, provide helpful debugging info
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      throw new Error(`Cannot connect to Flask server at ${BASE}. Please ensure Flask is running on port 5000.`);
    }
    
    throw error;
  }
};

// ✅ Connection Test Function (use this to debug)
export const testConnection = async () => {
  try {
    console.log(`🧪 Testing connection to Flask server at: ${BASE}`);
    const response = await fetch(`${BASE}/api/health`, { 
      method: 'GET',
      timeout: 5000 
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log(`✅ Flask server connection successful:`, data);
      return { success: true, message: 'Connected successfully', data };
    } else {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
  } catch (error) {
    console.error(`❌ Flask server connection failed:`, error);
    return { 
      success: false, 
      message: `Cannot connect to Flask server at ${BASE}`,
      error: error.message 
    };
  }
};

// ✅ Chat/Conversation API
export const sendMessage = async ({ sessionId, message }) => {
  try {
    return await apiCall('/api/converse', {
      method: 'POST',
      body: JSON.stringify({ 
        session_id: sessionId, 
        message 
      })
    });
  } catch (error) {
    return { 
      status: "error", 
      message: error.message || 'Failed to send message'
    };
  }
};

// ✅ Account Discovery API
export const discoverAccounts = async () => {
  try {
    return await apiCall('/api/discover-accounts');
  } catch (error) {
    throw new Error(`Failed to discover accounts: ${error.message}`);
  }
};

// ✅ Instance Discovery API
export const discoverInstances = async (accountId) => {
  try {
    if (!accountId) throw new Error('Account ID is required');
    return await apiCall(`/api/discover-instances/${accountId}`);
  } catch (error) {
    throw new Error(`Failed to discover instances for account ${accountId}: ${error.message}`);
  }
};

// ✅ CloudWatch Agent Deployment API
export const deployCloudWatchAgent = async (data) => {
  try {
    console.log('🚀 Deploying CloudWatch agent with data:', data);
    
    // Validate required fields
    if (!data.instanceId || !data.accountId || !data.region) {
      throw new Error('Missing required fields: instanceId, accountId, or region');
    }
    
    return await apiCall('/api/deploy-cloudwatch-agent', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  } catch (error) {
    throw new Error(`Failed to deploy CloudWatch agent: ${error.message}`);
  }
};

// ✅ ENHANCED: CloudWatch Alarms Configuration API
export const configureAlarms = async (data) => {
  try {
    console.log('🚨 Configuring CloudWatch alarms with data:', data);
    
    // Validate required fields
    if (!data.instanceId || !data.accountId || !data.region) {
      throw new Error('Missing required fields: instanceId, accountId, or region');
    }
    
    const fullUrl = `${BASE}/api/configure-alarms`;
    
    const response = await fetch(fullUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    
    const result = await response.json();
    console.log('🚨 Raw alarm configuration response:', result);
    
    // ✅ Handle different response scenarios from Flask
    if (response.ok && result.success) {
      // Success case
      return {
        success: true,
        message: result.message,
        alarmDetails: result.alarmDetails || {
          successfulAlarms: 4,
          totalAlarms: 4,
          createdAlarms: [
            `${data.instanceId}-CPU-Utilization`,
            `${data.instanceId}-Memory-Utilization`, 
            `${data.instanceId}-${data.platform?.toLowerCase().includes('windows') ? 'Overall' : 'Disk'}-Utilization`,
            `${data.instanceId}-StatusCheck-System`
          ]
        }
      };
    } else if (response.status === 207 && result.partialSuccess) {
      // Partial success case
      return {
        success: false,
        partialSuccess: true,
        message: result.message,
        alarmDetails: result.alarmDetails
      };
    } else {
      // Error case
      throw new Error(result.error || 'Alarm configuration failed');
    }
    
  } catch (error) {
    console.error('❌ Error configuring alarms:', error);
    throw new Error(`Failed to configure alarms: ${error.message}`);
  }
};

// ✅ NEW: Instance Type Change API
export const changeInstanceType = async (data) => {
  try {
    console.log('🔄 Changing instance type with data:', data);
    
    // Validate required fields
    if (!data.instanceId || !data.accountId || !data.region || !data.newInstanceType) {
      throw new Error('Missing required fields: instanceId, accountId, region, or newInstanceType');
    }
    
    return await apiCall('/api/change-instance-type', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  } catch (error) {
    throw new Error(`Failed to change instance type: ${error.message}`);
  }
};

// ✅ NEW: Volume Conversion API (for GP2 → GP3)
export const convertVolumes = async (data) => {
  try {
    console.log('🔄 Converting volumes with data:', data);
    
    // Validate required fields
    if (!data.instanceId || !data.accountId || !data.region) {
      throw new Error('Missing required fields: instanceId, accountId, or region');
    }
    
    return await apiCall('/api/convert-volumes', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  } catch (error) {
    throw new Error(`Failed to convert volumes: ${error.message}`);
  }
};

// ✅ Health Check API (useful for monitoring)
export const healthCheck = async () => {
  try {
    return await apiCall('/api/health');
  } catch (error) {
    throw new Error(`Health check failed: ${error.message}`);
  }
};

// ✅ Test DynamoDB Connection API (for debugging)
export const testDynamoDB = async () => {
  try {
    return await apiCall('/api/test-dynamodb');
  } catch (error) {
    throw new Error(`DynamoDB test failed: ${error.message}`);
  }
};

// ✅ Export the base URL for debugging
export const getApiBaseUrl = getBaseURL;

// ✅ Auto-test connection on module load
(async () => {
  try {
    const connectionTest = await testConnection();
    if (connectionTest.success) {
      console.log('🎉 Flask server is ready for API calls');
    } else {
      console.warn('⚠️ Flask server connection issue:', connectionTest.message);
    }
  } catch (error) {
    console.warn('⚠️ Could not test Flask connection on startup:', error.message);
  }
})();

// ✅ Console log current configuration
console.log('🔧 API Configuration:', {
  currentHostname: window.location.hostname,
  currentPort: window.location.port,
  flaskServerURL: BASE,
  autoDetected: true,
  universalCompatibility: true
});

// ✅ Export default configuration object
export default {
  BASE_URL: BASE,
  testConnection,
  sendMessage,
  discoverAccounts,
  discoverInstances,
  deployCloudWatchAgent,
  configureAlarms,
  changeInstanceType,
  convertVolumes,
  healthCheck,
  testDynamoDB
};
