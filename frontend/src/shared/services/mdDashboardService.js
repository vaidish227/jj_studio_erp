import apiClient from './apiClient';

export const mdDashboardService = {
  getMDOverview: (period = 'month') =>
    apiClient.get('/md/dashboard/overview', { params: { period } }),
};
