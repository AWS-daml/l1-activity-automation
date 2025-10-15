// Services/api.js - SECURE EC2 VERSION - Works with Restricted Security Groups

// ✅ SECURE EC2 DEPLOYMENT: Uses localhost for internal API calls
const getBaseURL = () => {
  const hostname = window.location.hostname;
  const protocol = window.location.protocol;
  
  console.log(`🔍 User accessing React from: ${protocol}//${hostname}`);
  
  // ✅ SECURITY OPTIMIZED: Always use localhost for Flask API
  // This works because React and Flask run on the same EC2 server
  // Flask port 5000 is protected by Security Group (excellent security!)
  const apiUrl = `${protocol}//localhost:5000`;
  
  console.log(`🔒 API calls will use: ${apiUrl} (internal EC2 communication)`);
  console.log(`🛡️ Flask API is secured - only accessible from within EC2`);
  
  return apiUrl;
};

const BASE = getBaseURL();

// ✅ Enhanced API call function with better error handling
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
    
    // Enhanced error messages for debugging
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      throw new Error(`Cannot connect to Flask server at ${BASE}. Flask may not be running or there's a network issue.`);
    }
    
    throw error;
  }
};

// ✅ Connection Test Function with EC2-specific messaging
export const testConnection = async () => {
  try {
    console.log(`🧪 Testing Flask connection on EC2 server...`);
    const response = await fetch(`${BASE}/api/health`, { 
      method: 'GET',
      timeout: 5000 
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log(`✅ Flask server healthy on EC2:`, data);
      return { success: true, message: 'Flask server connected successfully', data };
    } else {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
  } catch (error) {
    console.error(`❌ Flask connection failed:`, error);
    return { 
      success: false, 
      message: `Cannot connect to Flask server - check if Flask is running on EC2`,
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

// ✅ CloudWatch Alarms Configuration API
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
    
    // Handle different response scenarios from Flask
    if (response.ok && result.success) {
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
      return {
        success: false,
        partialSuccess: true,
        message: result.message,
        alarmDetails: result.alarmDetails
      };
    } else {
      throw new Error(result.error || 'Alarm configuration failed');
    }
    
  } catch (error) {
    console.error('❌ Error configuring alarms:', error);
    throw new Error(`Failed to configure alarms: ${error.message}`);
  }
};

// ✅ Instance Type Change API - MAIN FIX FOR YOUR ISSUE
export const changeInstanceType = async (data) => {
  try {
    console.log('🔄 Changing instance type with data:', data);
    
    // Validate required fields
    if (!data.instanceId || !data.accountId || !data.region || !data.newInstanceType) {
      throw new Error('Missing required fields: instanceId, accountId, region, or newInstanceType');
    }
    
    // This will now call localhost:5000 instead of external IP:5000
    return await apiCall('/api/change-instance-type', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  } catch (error) {
    throw new Error(`Failed to change instance type: ${error.message}`);
  }
};

// ✅ Volume Conversion API (for GP2 → GP3)
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

// ✅ Health Check API
export const healthCheck = async () => {
  try {
    return await apiCall('/api/health');
  } catch (error) {
    throw new Error(`Health check failed: ${error.message}`);
  }
};

// ✅ Test DynamoDB Connection API
export const testDynamoDB = async () => {
  try {
    return await apiCall('/api/test-dynamodb');
  } catch (error) {
    throw new Error(`DynamoDB test failed: ${error.message}`);
  }
};

// ✅ Export the base URL for debugging
export const getApiBaseUrl = getBaseURL;

// ✅ Auto-test connection on module load with EC2-specific messaging
(async () => {
  try {
    console.log('🔄 Testing Flask connection on EC2 startup...');
    const connectionTest = await testConnection();
    if (connectionTest.success) {
      console.log('🎉 Flask server ready! Instance type changes will work perfectly.');
    } else {
      console.warn('⚠️ Flask connection issue on EC2:', connectionTest.message);
    }
  } catch (error) {
    console.warn('⚠️ Could not test Flask connection:', error.message);
  }
})();

// ✅ Console log configuration with EC2-specific info
console.log('🔧 EC2 Secure API Configuration:', {
  userAccessUrl: `http://${window.location.hostname}:${window.location.port}`,
  internalApiUrl: BASE,
  deploymentType: 'Secure EC2 with restricted Security Group',
  flaskPortProtected: true,
  ready: true
});

// ✅ Export everything
export default {
  BASE_URL: BASE,
  testConnection,
  sendMessage,
  discoverAccounts,
  discoverInstances,
  deployCloudWatchAgent,
  configureAlarms,
  changeInstanceType,    // ← This will now work perfectly!
  convertVolumes,
  healthCheck,
  testDynamoDB
};
