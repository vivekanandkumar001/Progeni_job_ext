export type ATSPlatform =
  | 'greenhouse'
  | 'lever'
  | 'workday'
  | 'ashby'
  | 'smartrecruiters'
  | 'linkedin'
  | 'indeed'
  | 'naukri'
  | 'custom';

export type FormFieldType =
  | 'text'
  | 'email'
  | 'tel'
  | 'file'
  | 'select'
  | 'radio'
  | 'checkbox'
  | 'textarea';

export interface FormField {
  name: string;
  label: string;
  type: FormFieldType;
  required: boolean;
  selector: string;
  options?: string[];
  suggestedProfileKey?: string;
}

export interface ExtractedJob {
  title: string;
  company: string;
  location: string;
  description: string;
  url: string;
  platform: ATSPlatform;
  requiredSkills: string[];
  experienceMin: number | null;
}

export interface ATSAdapter {
  readonly platform: ATSPlatform;
  readonly name: string;
  matches(url: string, document: Document): boolean;
  extractJob(url: string, document: Document): ExtractedJob | null;
  detectApplicationForm(document: Document): FormField[];
  canAutoFill(): boolean;
  requiresManualReview(): boolean;
}

export interface AutofillField {
  id: string;
  name: string;
  label: string;
  selector: string;
  type: FormFieldType;
  value: string;
  required: boolean;
  approved: boolean;
  status: 'pending' | 'injected' | 'skipped' | 'failed';
  reason?: string;
}

export interface AutofillPlan {
  fields: AutofillField[];
  totalDetected: number;
  approvedCount: number;
  isApplicationApproved: boolean;
  requiresHumanReview: boolean;
  warning?: string;
}

export interface AutofillExecutionResult {
  ok: boolean;
  injectedCount: number;
  skippedCount: number;
  message: string;
  details: Array<{ selector: string; status: 'injected' | 'skipped' | 'failed'; label: string; reason?: string }>;
}
