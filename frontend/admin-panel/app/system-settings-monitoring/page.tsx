import { Activity } from 'lucide-react';
import AdminPlaceholder from '../../components/AdminPlaceholder';

export default function SystemSettingsMonitoringPage() {
  return (
    <AdminPlaceholder
      icon={Activity}
      eyebrow="Governance"
      title="System settings & monitoring"
      description="Service health, latency budgets and platform-wide configuration for the Progeni stack."
      status="Demo data · wiring pending"
      tiles={[
        { label: 'API uptime', value: '99.98%' },
        { label: 'p95 latency', value: '182ms' },
        { label: 'Webhook success', value: '99.9%' },
        { label: 'Error budget', value: '92%' },
      ]}
      bullets={[
        'Live health for API, database, queue workers and billing webhooks.',
        'Feature flags, rate limits and environment configuration.',
        'Incident timeline with on-call acknowledgement and postmortems.',
      ]}
    />
  );
}
