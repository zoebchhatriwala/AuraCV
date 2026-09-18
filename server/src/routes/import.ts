import { Router, Request, Response } from 'express';
import multer from 'multer';
import { join } from 'path';
import { promises as fsPromises } from 'fs';
import pdfParse from 'pdf-parse';
import { getActiveProvider } from '../ai/factory';
import { resumeQueries, sectionQueries } from '../db/database';
import type { ImportParseResult, SectionType, SectionContent } from '../types';

const router = Router();
const upload = multer({ dest: join(__dirname, '..', '..', 'uploads') });

/**
 * Intelligent deterministic heuristic parser that structures raw resume text
 * without requiring any external AI API key.
 */
function heuristicParseResume(rawText: string, defaultName: string = 'Imported Resume'): ImportParseResult {
  const rawLines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  // 1. Extract contact metadata using regex
  const emailMatch = rawText.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/);
  const email = emailMatch ? emailMatch[0] : '';

  const phoneMatch = rawText.match(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
  const phone = phoneMatch ? phoneMatch[0] : '';

  const linkedinMatch = rawText.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/([A-Za-z0-9_-]+)/i);
  const linkedin = linkedinMatch ? linkedinMatch[0] : '';

  const githubMatch = rawText.match(/(?:https?:\/\/)?(?:www\.)?github\.com\/([A-Za-z0-9_-]+)/i);
  const github = githubMatch ? githubMatch[0] : '';

  // 2. Detect candidate name and title from top 5 lines
  let detectedName = '';
  let candidateRole = '';
  for (let i = 0; i < Math.min(6, rawLines.length); i++) {
    const line = rawLines[i];
    if (
      line.includes('@') ||
      line.includes('http') ||
      line.includes('www.') ||
      /\d{5,}/.test(line) ||
      /curriculum|resume|cv/i.test(line)
    ) {
      continue;
    }
    const words = line.split(/\s+/);
    if (!detectedName && words.length >= 2 && words.length <= 4 && !/[:|•-]/.test(line)) {
      detectedName = line;
    } else if (detectedName && !candidateRole && line.length < 50 && !/[:|•-]/.test(line)) {
      candidateRole = line;
    }
  }
  if (!detectedName) detectedName = defaultName;

  // 3. Segment lines into distinct sections by headings
  const SECTION_MATCHERS: Array<{ regex: RegExp; type: SectionType; title: string }> = [
    { regex: /^(?:professional\s+)?experience|work\s+experience|employment\s+history|work\s+history/i, type: 'experience', title: 'Experience' },
    { regex: /^education|academic\s+background|academic\s+history/i, type: 'education', title: 'Education' },
    { regex: /^skills|technical\s+skills|core\s+competencies|technologies|tools/i, type: 'skills', title: 'Skills' },
    { regex: /^projects|key\s+projects|personal\s+projects/i, type: 'projects', title: 'Projects' },
    { regex: /^summary|professional\s+summary|profile|about\s+me|objective/i, type: 'summary', title: 'Summary' },
    { regex: /^certifications|licenses|credentials|courses/i, type: 'certifications', title: 'Certifications' },
  ];

  interface SectionBucket {
    type: SectionType;
    title: string;
    lines: string[];
  }

  const buckets: SectionBucket[] = [];
  let currentBucket: SectionBucket = { type: 'summary', title: 'Summary', lines: [] };

  for (const line of rawLines) {
    const matchedHeading = SECTION_MATCHERS.find(m => m.regex.test(line.replace(/[:_#-]/g, '').trim()));
    if (matchedHeading) {
      if (currentBucket.lines.length > 0) {
        buckets.push(currentBucket);
      }
      currentBucket = { type: matchedHeading.type, title: matchedHeading.title, lines: [] };
    } else {
      currentBucket.lines.push(line);
    }
  }
  if (currentBucket.lines.length > 0) {
    buckets.push(currentBucket);
  }

  // 4. Construct structured sections array
  const sections: ImportParseResult['sections'] = [];

  // Always prepend Header section
  sections.push({
    section_type: 'header',
    title: 'Personal Info',
    content: [
      {
        name: detectedName,
        role: candidateRole || 'Professional',
        email,
        phone,
        location: '',
        linkedin,
        github,
      },
    ],
  });

  for (const bucket of buckets) {
    if (bucket.lines.length === 0) continue;

    if (bucket.type === 'summary') {
      sections.push({
        section_type: 'summary',
        title: 'Professional Summary',
        content: [{ text: bucket.lines.join(' ') }],
      });
    } else if (bucket.type === 'experience') {
      const entries: SectionContent[] = [];
      let currentEntry: {
        role: string;
        company: string;
        start_date: string;
        end_date: string;
        location?: string;
        bullets: string[];
      } | null = null;

      for (const line of bucket.lines) {
        const isBullet = /^[•\-\*·]\s*/.test(line);
        const cleanLine = line.replace(/^[•\-\*·]\s*/, '').trim();

        // Check if line looks like a date range: "2020 - 2023" or "Jan 2021 - Present"
        const dateMatch = cleanLine.match(/((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|[A-Za-z]+)?\s*\d{4})\s*[-–—to]+\s*((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|[A-Za-z]+)?\s*\d{4}|Present|Current)/i);

        if (!isBullet && (dateMatch || entries.length === 0 || (!currentEntry && cleanLine.length < 60))) {
          if (currentEntry) entries.push(currentEntry);
          const parts = cleanLine.split(/[\–—|·]/).map(p => p.trim());
          currentEntry = {
            role: parts[0] || 'Software Engineer',
            company: parts[1] || 'Company',
            start_date: dateMatch ? dateMatch[1] : '2022',
            end_date: dateMatch ? dateMatch[2] : 'Present',
            bullets: [],
          };
        } else if (currentEntry) {
          currentEntry.bullets.push(cleanLine);
        } else {
          currentEntry = {
            role: 'Professional Role',
            company: 'Company',
            start_date: '2022',
            end_date: 'Present',
            bullets: [cleanLine],
          };
        }
      }
      if (currentEntry) entries.push(currentEntry);

      if (entries.length > 0) {
        sections.push({
          section_type: 'experience',
          title: 'Work Experience',
          content: entries,
        });
      }
    } else if (bucket.type === 'education') {
      const eduEntries: SectionContent[] = [];
      let currentEdu: {
        institution: string;
        degree: string;
        field: string;
        start_date: string;
        end_date: string;
      } | null = null;

      for (const line of bucket.lines) {
        const clean = line.replace(/^[•\-\*·]\s*/, '').trim();
        const dateMatch = clean.match(/(\d{4})\s*[-–—to]+\s*(\d{4}|Present)/i);
        if (!currentEdu || dateMatch) {
          if (currentEdu) eduEntries.push(currentEdu);
          currentEdu = {
            institution: clean.split(/[,|–—]/)[0] || 'University',
            degree: clean.includes('Master') ? 'M.S.' : clean.includes('PhD') ? 'Ph.D.' : 'B.S.',
            field: 'Computer Science',
            start_date: dateMatch ? dateMatch[1] : '2018',
            end_date: dateMatch ? dateMatch[2] : '2022',
          };
        }
      }
      if (currentEdu) eduEntries.push(currentEdu);

      if (eduEntries.length > 0) {
        sections.push({
          section_type: 'education',
          title: 'Education',
          content: eduEntries,
        });
      }
    } else if (bucket.type === 'skills') {
      // Group lines or comma-separated items
      const items = bucket.lines
        .flatMap(l => l.split(/[,|•;]/))
        .map(i => i.trim().replace(/^[-*]\s*/, ''))
        .filter(i => i.length > 1 && i.length < 35);

      sections.push({
        section_type: 'skills',
        title: 'Skills and Strengths',
        content: [
          {
            category: 'Core Competencies',
            items: items.length > 0 ? items.slice(0, 16) : ['Problem Solving', 'Communication', 'Teamwork'],
          },
        ],
      });
    } else if (bucket.type === 'projects') {
      const projEntries: SectionContent[] = [];
      for (const line of bucket.lines) {
        const clean = line.replace(/^[•\-\*·]\s*/, '').trim();
        projEntries.push({
          name: clean.slice(0, 40),
          description: clean,
          tech: [],
          bullets: [clean],
        });
      }
      if (projEntries.length > 0) {
        sections.push({
          section_type: 'projects',
          title: 'Projects',
          content: projEntries.slice(0, 4),
        });
      }
    } else if (bucket.type === 'certifications') {
      const certs = bucket.lines.map(l => ({
        name: l.replace(/^[•\-\*·]\s*/, '').trim(),
        issuer: 'Certification Authority',
        date: '2023',
      }));
      sections.push({
        section_type: 'certifications',
        title: 'Certifications',
        content: certs,
      });
    }
  }

  return {
    name: detectedName,
    sections,
  };
}

/**
 * Parses resume text using the active AI provider if available/configured,
 * and automatically falls back to the deterministic heuristic parser if
 * no API key exists, if cloud API is offline, or if an error occurs.
 */
async function parseResumeText(rawText: string, defaultName: string): Promise<ImportParseResult> {
  try {
    const provider = getActiveProvider();
    // Only attempt external AI call if API key exists or provider is offline/local
    if (provider && (provider.info.local || (provider as any).apiKey)) {
      const parsed = await provider.importParse(rawText);
      if (parsed && Array.isArray(parsed.sections) && parsed.sections.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('[Import] AI provider call skipped or failed, using heuristic parser:', (err as Error).message);
  }

  // Graceful fallback to heuristic parser
  return heuristicParseResume(rawText, defaultName);
}

// POST /api/import/text — parse pasted plain text
router.post('/text', async (req: Request, res: Response) => {
  try {
    const { text, name } = req.body as { text?: string; name?: string };
    if (!text || !text.trim()) return void res.status(400).json({ error: 'Text is required' });

    const defaultName = name || 'Imported Resume';
    const parsed = await parseResumeText(text, defaultName);
    const finalName = name || parsed.name || defaultName;

    const resumeId = resumeQueries.create({ name: finalName });
    let position = 0;
    for (const section of parsed.sections ?? []) {
      sectionQueries.upsert({
        resume_id: resumeId,
        section_type: section.section_type,
        title: section.title,
        content: section.content,
        position: position++,
      });
    }
    res.json({ id: resumeId, parsed });
  } catch (e) {
    console.error('[Import Text Error]:', e);
    res.status(500).json({ error: (e as Error).message || 'Failed to parse text' });
  }
});

// POST /api/import/pdf — upload a PDF and extract text
router.post('/pdf', upload.single('file'), async (req: Request, res: Response) => {
  const filePath = req.file?.path;
  try {
    if (!req.file) return void res.status(400).json({ error: 'No file uploaded' });

    const pdfBuffer = await fsPromises.readFile(filePath!);
    const data = await pdfParse(pdfBuffer);
    const text = data.text || '';

    if (!text.trim()) {
      return void res.status(400).json({
        error: 'Could not extract text from this PDF. It may be an image scan or password protected.',
      });
    }

    const defaultName = (req.body as { name?: string }).name || req.file.originalname.replace(/\.pdf$/i, '');
    const parsed = await parseResumeText(text, defaultName);
    const finalName = (req.body as { name?: string }).name || parsed.name || defaultName;

    const resumeId = resumeQueries.create({ name: finalName });
    let position = 0;
    for (const section of parsed.sections ?? []) {
      sectionQueries.upsert({
        resume_id: resumeId,
        section_type: section.section_type,
        title: section.title,
        content: section.content,
        position: position++,
      });
    }

    res.json({ id: resumeId, parsed });
  } catch (e) {
    console.error('[Import PDF Error]:', e);
    res.status(500).json({ error: (e as Error).message || 'Failed to process PDF' });
  } finally {
    if (filePath) {
      fsPromises.unlink(filePath).catch(() => {});
    }
  }
});

// POST /api/import/json — restore from AuraCV JSON backup
router.post('/json', (req: Request, res: Response) => {
  try {
    const { resume, sections } = req.body as {
      resume?: { name?: string; version_tag?: string; template_id?: string; meta?: Record<string, unknown> };
      sections?: Array<{ section_type: any; title: string; content: any[]; position?: number }>;
    };
    if (!resume) return void res.status(400).json({ error: 'Resume object required' });

    const id = resumeQueries.create({
      name: resume.name ?? 'Restored Resume',
      version_tag: resume.version_tag,
      template_id: resume.template_id,
      meta: resume.meta,
    });
    for (const s of sections ?? []) {
      sectionQueries.upsert({ ...s, resume_id: id });
    }
    res.json({ id });
  } catch (e) {
    console.error('[Import JSON Error]:', e);
    res.status(500).json({ error: (e as Error).message });
  }
});

export default router;
