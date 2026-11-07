import { BarChart3 } from 'lucide-react';
import AdminPlaceholder from '../../components/AdminPlaceholder';

export default function AnalyticsReportsPage() {
  return (
    <AdminPlaceholder
      icon={BarChart3}
      eyebrow="Intelligence"
      title="Analytics & reports"
      description="Product adoption, match conversion and credit efficiency across the candidate journey."
      status="Demo data · wiring pending"
      tiles={[
        { label: 'Weekly active', value: '12.4k' },
        { label: 'Match conversion', value: '41%' },
        { label: 'Resume exports', value: '8.2k' },
        { label: 'Credits / user', value: '84' },
      ]}
      bullets={[
        'Cohort retention and activation funnels for candidate accounts.',
        'Adapter-level extraction quality and autofill completion rates.',
        'Scheduled CSV and PDF exports for finance and leadership reviews.',
      ]}
    />
  );
}
