import apiClient from './apiClient';
import { rangeToParams } from '../dashboard-filter/dateRangePresets';

export const mdDashboardService = {
  getMDOverview: (range = {}) =>
    apiClient.get('/md/dashboard/overview', { params: rangeToParams(range) }),
};
