import { ShieldCheck } from 'lucide-react';
import AdminPlaceholder from '../../components/AdminPlaceholder';

export default function ComplianceAutomationPolicyPage() {
  return (
    <AdminPlaceholder
      icon={ShieldCheck}
      eyebrow="Governance"
      title="Compliance & automation policy"
      description="Consent coverage, automation guardrails and policy versions for every supported platform."
      status="Demo data · wiring pending"
      tiles={[
        { label: 'Policy version', value: 'v2.4' },
        { label: 'Consent coverage', value: '100%' },
        { label: 'Audit events', value: '128k' },
        { label: 'Open exceptions', value: '0' },
      ]}
      bullets={[
        'Per-platform automation policy with manual-only fallbacks where required.',
        'Consent capture and revocation history for every candidate.',
        'Immutable audit trail for administrative credit and role changes.',
      ]}
    />
  );
}
