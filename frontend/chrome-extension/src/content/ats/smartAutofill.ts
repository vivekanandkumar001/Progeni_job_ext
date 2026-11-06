import type {
  AutofillField,
  AutofillPlan,
  AutofillExecutionResult,
  FormFieldType,
} from './types.js';

export function isCaptchaOrSecurityField(element: Element): boolean {
  const outer = (element.outerHTML || '').toLowerCase();
  const idAndClass = `${element.id} ${element.className}`.toLowerCase();
  return (
    idAndClass.includes('captcha') ||
    idAndClass.includes('recaptcha') ||
    idAndClass.includes('hcaptcha') ||
    idAndClass.includes('cf-turnstile') ||
    idAndClass.includes('challenge') ||
    outer.includes('recaptcha') ||
    outer.includes('hcaptcha') ||
    outer.includes('cloudflare')
  );
}

export function detectFormInputs(doc: Document): Array<{
  element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
  name: string;
  label: string;
  type: FormFieldType;
  selector: string;
  required: boolean;
}> {
  const inputs = Array.from(
    doc.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
      'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]):not([type="password"]), textarea, select',
    ),
  );

  const results: Array<{
    element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
    name: string;
    label: string;
    type: FormFieldType;
    selector: string;
    required: boolean;
  }> = [];

  for (const el of inputs) {
    if (isCaptchaOrSecurityField(el)) continue;

    // Detect field label
    let label = '';
    if (el.id) {
      const labelEl = doc.querySelector<HTMLLabelElement>(`label[for="${el.id}"]`);
      if (labelEl) label = labelEl.textContent?.trim() || '';
    }
    if (!label) {
      const parentLabel = el.closest('label');
      if (parentLabel) {
        // Clone and remove input text
        const clone = parentLabel.cloneNode(true) as HTMLElement;
        const innerInputs = clone.querySelectorAll('input, select, textarea');
        innerInputs.forEach((i) => i.remove());
        label = clone.textContent?.trim() || '';
      }
    }
    if (!label && el.getAttribute('aria-label')) {
      label = el.getAttribute('aria-label') || '';
    }
    if (!label && 'placeholder' in el && el.placeholder) {
      label = el.placeholder;
    }
    if (!label && el.name) {
      label = el.name.replace(/[_-]/g, ' ');
    }
    if (!label) {
      label = 'Unlabeled field';
    }

    // Determine type
    let fieldType: FormFieldType = 'text';
    if (el.tagName.toLowerCase() === 'textarea') {
      fieldType = 'textarea';
    } else if (el.tagName.toLowerCase() === 'select') {
      fieldType = 'select';
    } else if ('type' in el) {
      const t = el.type.toLowerCase();
      if (t === 'email') fieldType = 'email';
      else if (t === 'tel') fieldType = 'tel';
      else if (t === 'file') fieldType = 'file';
      else if (t === 'radio') fieldType = 'radio';
      else if (t === 'checkbox') fieldType = 'checkbox';
    }

    // Determine selector
    let selector = '';
    if (el.id) {
      selector = `#${el.id}`;
    } else if (el.name) {
      selector = `${el.tagName.toLowerCase()}[name="${el.name}"]`;
    } else {
      selector = `${el.tagName.toLowerCase()}`;
    }

    const required = el.required || el.getAttribute('aria-required') === 'true';

    results.push({
      element: el,
      name: el.name || el.id || label,
      label,
      type: fieldType,
      selector,
      required,
    });
  }

  return results;
}

export function mapFieldToCandidateValue(
  label: string,
  name: string,
  candidateData: {
    fullName?: string;
    email?: string;
    phone?: string;
    location?: string;
    linkedinUrl?: string;
    portfolioUrl?: string;
    coverLetter?: string;
    screeningAnswers?: Record<string, string>;
  },
): { value: string; confidence: number } {
  const text = `${label} ${name}`.toLowerCase();

  if (/first\s*name/i.test(text)) {
    const parts = (candidateData.fullName || '').split(/\s+/);
    return { value: parts[0] || '', confidence: 0.95 };
  }
  if (/last\s*name/i.test(text)) {
    const parts = (candidateData.fullName || '').split(/\s+/);
    return { value: parts.length > 1 ? parts.slice(1).join(' ') : '', confidence: 0.95 };
  }
  if (/full\s*name|your\s*name|name/i.test(text) && !/company|school|institution/i.test(text)) {
    return { value: candidateData.fullName || '', confidence: 0.95 };
  }
  if (/email/i.test(text)) {
    return { value: candidateData.email || '', confidence: 1.0 };
  }
  if (/phone|mobile|tel/i.test(text)) {
    return { value: candidateData.phone || '', confidence: 0.95 };
  }
  if (/location|city|address|residence/i.test(text)) {
    return { value: candidateData.location || '', confidence: 0.85 };
  }
  if (/linkedin/i.test(text)) {
    return { value: candidateData.linkedinUrl || '', confidence: 0.95 };
  }
  if (/portfolio|github|website|url|web/i.test(text)) {
    return { value: candidateData.portfolioUrl || '', confidence: 0.9 };
  }
  if (/cover\s*letter|letter\s*of\s*interest|message|why\s*join/i.test(text)) {
    return { value: candidateData.coverLetter || '', confidence: 0.85 };
  }

  // Check custom screening answers
  if (candidateData.screeningAnswers) {
    for (const [q, a] of Object.entries(candidateData.screeningAnswers)) {
      if (text.includes(q.toLowerCase()) || q.toLowerCase().includes(text)) {
        return { value: a, confidence: 0.9 };
      }
    }
  }

  return { value: '', confidence: 0 };
}

export function buildAutofillPlan(
  doc: Document,
  candidateData: {
    fullName?: string;
    email?: string;
    phone?: string;
    location?: string;
    linkedinUrl?: string;
    portfolioUrl?: string;
    coverLetter?: string;
    screeningAnswers?: Record<string, string>;
  },
  isApplicationApproved: boolean,
): AutofillPlan {
  const detected = detectFormInputs(doc);
  const fields: AutofillField[] = [];

  for (let i = 0; i < detected.length; i++) {
    const item = detected[i];
    const mapping = mapFieldToCandidateValue(item.label, item.name, candidateData);

    fields.push({
      id: `field_${i + 1}`,
      name: item.name,
      label: item.label,
      selector: item.selector,
      type: item.type,
      value: mapping.value,
      required: item.required,
      approved: false, // Explicit candidate approval required per field
      status: 'pending',
      reason: mapping.value ? undefined : 'No matching candidate information found',
    });
  }

  return {
    fields,
    totalDetected: fields.length,
    approvedCount: 0,
    isApplicationApproved,
    requiresHumanReview: true,
    warning: isApplicationApproved
      ? undefined
      : 'Human approval is required before autofill can populate form fields.',
  };
}

export function executeAutofill(
  doc: Document,
  plan: AutofillPlan,
): AutofillExecutionResult {
  // STRICT SAFETY GATE: Human approval invariant
  if (!plan.isApplicationApproved) {
    return {
      ok: false,
      injectedCount: 0,
      skippedCount: plan.fields.length,
      message: 'Autofill blocked: Candidate explicit approval is required before injecting values.',
      details: plan.fields.map((f) => ({
        selector: f.selector,
        status: 'skipped',
        label: f.label,
        reason: 'Application approval not granted by candidate',
      })),
    };
  }

  let injectedCount = 0;
  let skippedCount = 0;
  const details: AutofillExecutionResult['details'] = [];

  for (const field of plan.fields) {
    if (!field.approved || !field.value) {
      skippedCount++;
      details.push({
        selector: field.selector,
        status: 'skipped',
        label: field.label,
        reason: !field.approved ? 'Not approved by candidate' : 'Empty value',
      });
      continue;
    }

    try {
      const el = doc.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
        field.selector,
      );

      if (!el) {
        skippedCount++;
        details.push({
          selector: field.selector,
          status: 'failed',
          label: field.label,
          reason: 'Element not found in DOM',
        });
        continue;
      }

      // Never touch file inputs directly via value string for security
      if (field.type === 'file') {
        skippedCount++;
        details.push({
          selector: field.selector,
          status: 'skipped',
          label: field.label,
          reason: 'Resume file must be selected by candidate for browser security',
        });
        continue;
      }

      // Safe injection with proper reactive DOM event dispatches
      if (el.tagName.toLowerCase() === 'select') {
        const select = el as HTMLSelectElement;
        let matchedOption = false;
        for (const opt of Array.from(select.options)) {
          if (
            opt.value.toLowerCase() === field.value.toLowerCase() ||
            opt.text.toLowerCase().includes(field.value.toLowerCase())
          ) {
            select.value = opt.value;
            matchedOption = true;
            break;
          }
        }
        if (!matchedOption && select.options.length > 0) {
          select.value = select.options[0].value;
        }
      } else {
        el.value = field.value;
      }

      // Dispatch input, change, and blur events
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      el.dispatchEvent(new Event('blur', { bubbles: true }));

      injectedCount++;
      details.push({
        selector: field.selector,
        status: 'injected',
        label: field.label,
      });
    } catch (err: any) {
      skippedCount++;
      details.push({
        selector: field.selector,
        status: 'failed',
        label: field.label,
        reason: err.message,
      });
    }
  }

  return {
    ok: injectedCount > 0,
    injectedCount,
    skippedCount,
    message: `Safely filled ${injectedCount} approved fields. Please review all fields and submit manually.`,
    details,
  };
}

