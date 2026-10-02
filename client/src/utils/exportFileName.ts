/**
 * Utilities for normalizing and formatting export filenames.
 * Conforms to: [Candidate Name] + [CV Name] (e.g. Alex_Morgan_Senior_Staff_Engineer)
 */

export function getNormalizedExportName(
  candidateName?: string | null,
  cvName?: string | null
): string {
  const cleanCandidate = (candidateName || '')
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, '_')
    .replace(/^_+|_+$/g, '');

  let rawCv = (cvName || '').trim();
  // Strip common placeholder / default names
  if (/^(untitled(\s+resume|\s+cv)?|new\s+resume|default)$/i.test(rawCv)) {
    rawCv = '';
  }

  const cleanCv = rawCv
    .replace(/[^\p{L}\p{N}]+/gu, '_')
    .replace(/^_+|_+$/g, '');

  // If both candidate name and cv name are provided
  if (cleanCandidate && cleanCv) {
    // If CV name already contains candidate name (case-insensitive), avoid duplicate
    if (cleanCv.toLowerCase().includes(cleanCandidate.toLowerCase())) {
      return cleanCv;
    }
    return `${cleanCandidate}_${cleanCv}`;
  }

  if (cleanCandidate) {
    return `${cleanCandidate}_CV`;
  }

  if (cleanCv) {
    return cleanCv;
  }

  return 'Resume_CV';
}

export function cleanExportFileName(input?: string | null, fallback?: string): string {
  if (!input || !input.trim()) return fallback || 'Resume_CV';
  // Strip any accidental extension entered by user
  let clean = input.replace(/\.(pdf|docx|json|md)$/i, '').trim();
  clean = clean
    .replace(/[\\/:*?"<>|]+/g, '')
    .replace(/\s+/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_+|_+$/g, '');
  return clean || fallback || 'Resume_CV';
}
