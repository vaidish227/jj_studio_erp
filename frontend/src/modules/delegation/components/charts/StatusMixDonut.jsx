import MetricDonut from '../../../dashboard/components/overview/MetricDonut';
import { STATUS_META } from '../../constants/delegationStatus';
import { STATUS_COLOR, resolveVar } from './chartTheme';

// StatusMixDonut — lifecycle breakdown of every delegation in scope. Reuses the
// shared MetricDonut (centered total + value/share legend) so it matches the
// other module dashboards; we only map our status data + theme colors in.
const StatusMixDonut = ({ statusMix = [] }) => {
  const data = statusMix.map((s) => ({
    label: STATUS_META[s.status]?.label || s.status,
    value: s.count,
    color: resolveVar(STATUS_COLOR[s.status] || 'var(--text-muted)'),
  }));

  return <MetricDonut data={data} centerLabel="Total" size={172} />;
};

export default StatusMixDonut;
