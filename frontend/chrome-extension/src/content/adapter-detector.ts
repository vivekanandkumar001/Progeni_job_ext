import { extractJob } from './jobAdapter';

export function detectJobOnPage() {
  const result = extractJob(window.location.href, document);
  return { detected: result.supported, ...result };
}