import { LifeBuoy } from 'lucide-react';
import AdminPlaceholder from '../../components/AdminPlaceholder';

export default function SupportReportsPage() {
  return (
    <AdminPlaceholder
      icon={LifeBuoy}
      eyebrow="Operations"
      title="Support reports"
      description="Candidate escalations, triage queues and response SLAs without exposing private PII."
      status="Demo data · wiring pending"
      tiles={[
        { label: 'Open tickets', value: '18' },
        { label: 'Median first reply', value: '2h 14m' },
        { label: 'SLA met', value: '96%' },
        { label: 'Escalations', value: '3' },
      ]}
      bullets={[
        'Redacted ticket views with candidate identifiers masked by default.',
        'Routing rules by category: billing, extraction, autofill and access.',
        'Daily SLA digest and escalation notifications for the support rota.',
      ]}
    />
  );
}
