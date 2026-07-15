import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:8000/api',
});

// Helper to remove empty params
const cleanParams = (params) => {
  const cleaned = {};
  for (const key in params) {
    if (params[key] !== null && params[key] !== undefined && params[key] !== '') {
      cleaned[key] = params[key];
    }
  }
  return cleaned;
};

export const fetchFilters = async () => {
  const { data } = await api.get('/filters');
  return data;
};

export const fetchKPIs = async (filters) => {
  const { data } = await api.get('/kpis', { params: cleanParams(filters) });
  return data;
};

export const fetchSalesTrend = async (filters) => {
  const { data } = await api.get('/sales-trend', { params: cleanParams(filters) });
  return data;
};

export const fetchSalesByProduct = async (filters) => {
  const { data } = await api.get('/sales-by-product', { params: cleanParams(filters) });
  return data;
};

export const fetchSalesByCountry = async (filters) => {
  const { data } = await api.get('/sales-by-country', { params: cleanParams(filters) });
  return data;
};

export const fetchSalesBySegment = async (filters) => {
  const { data } = await api.get('/sales-by-segment', { params: cleanParams(filters) });
  return data;
};

export const fetchDiscountImpact = async (filters) => {
  const { data } = await api.get('/discount-impact', { params: cleanParams(filters) });
  return data;
};

export const fetchSalesVsForecast = async (filters) => {
  const { data } = await api.get('/sales-vs-forecast', { params: cleanParams(filters) });
  return data;
};

export const fetchRecords = async (filters, page = 1, pageSize = 20) => {
  const { data } = await api.get('/records', {
    params: { ...cleanParams(filters), page, page_size: pageSize },
  });
  return data;
};

export const sendChatMessage = async (message, sessionId) => {
  const { data } = await api.post('/chat', { message, session_id: sessionId });
  return data; // { response, session_id }
};

export const fetchInsights = async (filters) => {
  const { data } = await api.get('/insights', { params: cleanParams(filters) });
  return data; // { bullets: [...], generated_at }
};
