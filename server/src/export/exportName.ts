import { vaultQueries } from '../db/database';

/**
 * Extracts candidate name from resume sections (specifically header section),
 * with a fallback to the vault metadata full name.
 */
export function getCandidateName(sections: any[]): string {
  const header = sections.find((s: any) => s.section_type === 'header');
  if (header && Array.isArray(header.content) && header.content.length > 0) {
    const name = (header.content[0] as any)?.name;
    if (typeof name === 'string' && name.trim()) {
      return name.trim();
    }
  }
  try {
    const meta = vaultQueries.getMetadata();
    if (meta && meta.full_name && meta.full_name.trim()) {
      return meta.full_name.trim();
    }
  } catch {}
  return '';
}

/**
 * Normalizes export filename conforming to: [Candidate Name] + [CV Name]
 * e.g. Alex_Morgan_Senior_Staff_Engineer
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
  let clean = input.replace(/\.(pdf|docx|json|md)$/i, '').trim();
  clean = clean
    .replace(/[\\/:*?"<>|]+/g, '')
    .replace(/\s+/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_+|_+$/g, '');
  return clean || fallback || 'Resume_CV';
}
