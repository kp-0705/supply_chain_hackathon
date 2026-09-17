const API_BASE = '/api';

class ApiError extends Error {
  constructor(message, errors = [], status = 500) {
    super(message);
    this.name = 'ApiError';
    this.errors = errors;
    this.status = status;
  }
}

async function request(endpoint, options = {}) {
  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const config = {
    ...options,
    headers
  };

  try {
    const response = await fetch(`${API_BASE}${endpoint}`, config);
    const data = await response.json();

    if (!response.ok || data.success === false) {
      throw new ApiError(
        data.message || 'Request failed',
        data.errors || [],
        response.status
      );
    }

    return data;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(err.message || 'Network connection failed', [], 500);
  }
}

export const api = {
  // Authentication
  login: (email, password) => request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  }),
  register: (userData) => request('/auth/register', {
    method: 'POST',
    body: JSON.stringify(userData)
  }),
  getMe: () => request('/auth/me'),

  // Admin
  getStats: () => request('/admin/stats'),
  listSupply: (productId, month) => {
    const query = new URLSearchParams();
    if (productId) query.append('product_id', productId);
    if (month) query.append('month', month);
    return request(`/supply?${query.toString()}`);
  },
  getAllDemands: () => request('/demands/all'),
  addSupply: (supplyData) => request('/admin/supply/add', {
    method: 'POST',
    body: JSON.stringify(supplyData)
  }),
  listProducts: () => request('/products'),
  createProduct: (productData) => request('/admin/products/create', {
    method: 'POST',
    body: JSON.stringify(productData)
  }),
  listCustomers: () => request('/admin/customers'),
  createCustomer: (customerData) => request('/admin/customers/create', {
    method: 'POST',
    body: JSON.stringify(customerData)
  }),

  // Customer
  submitDemand: (demandData) => request('/customer/demand/submit', {
    method: 'POST',
    body: JSON.stringify(demandData)
  }),
  getMyDemands: (customerId) => {
    const q = customerId ? `?customer_id=${customerId}` : '';
    return request(`/customer/demands${q}`);
  },
  getDemandStatus: (demandId) => request(`/customer/demand/${demandId}/status`),
  getDemandTimeline: (demandId) => request(`/customer/demand/${demandId}/timeline`),

  // Level 1
  getLevel1Demands: () => request('/level1/demands'),
  approveLevel1: (demandId, comment) => request(`/level1/demand/${demandId}/approve`, {
    method: 'POST',
    body: JSON.stringify({ comment })
  }),
  rejectLevel1: (demandId, reason, comment) => request(`/level1/demand/${demandId}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reason, comment })
  }),

  // Level 2
  getLevel2Demands: () => request('/level2/demands'),
  approveLevel2: (demandId, comment) => request(`/level2/demand/${demandId}/approve`, {
    method: 'POST',
    body: JSON.stringify({ comment })
  }),
  partialAcceptLevel2: (demandId, comment) => request(`/level2/demand/${demandId}/partial-accept`, {
    method: 'POST',
    body: JSON.stringify({ comment })
  }),
  rejectLevel2: (demandId, reason, comment) => request(`/level2/demand/${demandId}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reason, comment })
  }),

  // Level 3
  getLevel3Demands: () => request('/level3/demands'),
  allocateSupply: (demandId, manualWeeks, comment) => request(`/level3/demand/${demandId}/allocate`, {
    method: 'POST',
    body: JSON.stringify({ manualWeeks, comment })
  }),
  rejectLevel3: (demandId, reason, comment) => request(`/level3/demand/${demandId}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reason, comment })
  }),
  getSupplyAvailability: (productId, month) => request(`/level3/supply/availability?product_id=${productId}&month=${month}`),

  // Level 4
  getLevel4Demands: () => request('/level4/demands'),
  getDemandExceptions: (demandId) => request(`/level4/demand/${demandId}/exceptions`),
  approveLevel4: (demandId, comment, overrideExceptions = true) => request(`/level4/demand/${demandId}/approve`, {
    method: 'POST',
    body: JSON.stringify({ comment, override_exceptions: overrideExceptions })
  }),
  rejectLevel4: (demandId, reason, comment) => request(`/level4/demand/${demandId}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reason, comment })
  }),

  // AI Features
  getLevel2AIRecommendation: (demandId) => request(`/level2/demand/${demandId}/ai-recommendation`),
  customerChatbotQuery: (demandId, question) => request('/customer/chatbot', {
    method: 'POST',
    body: JSON.stringify({ demand_id: demandId, question })
  }),

  // Notifications
  getNotifications: () => request('/notifications'),
  markNotificationRead: (id) => request(`/notifications/${id}/read`, { method: 'PATCH' })
};
