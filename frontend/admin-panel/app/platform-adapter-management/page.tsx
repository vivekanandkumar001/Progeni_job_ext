import { PlugZap } from 'lucide-react';
import AdminPlaceholder from '../../components/AdminPlaceholder';

export default function PlatformAdapterManagementPage() {
  return (
    <AdminPlaceholder
      icon={PlugZap}
      eyebrow="Intelligence"
      title="Platform adapter management"
      description="ATS coverage, extraction confidence and autofill readiness for every connected job board."
      status="Demo data · wiring pending"
      tiles={[
        { label: 'ATS adapters', value: '12' },
        { label: 'Extraction success', value: '94%' },
        { label: 'Autofill ready', value: '9' },
        { label: 'Avg confidence', value: '88%' },
      ]}
      bullets={[
        'Adapter health, selector drift and detection confidence by platform.',
        'Manual-only policy switches for platforms without safe autofill.',
        'Rollout controls for staged adapter releases and rollbacks.',
      ]}
    />
  );
}
