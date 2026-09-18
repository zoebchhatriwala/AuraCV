import { Router, Request, Response } from 'express';
import { join } from 'path';
import { readFileSync, existsSync } from 'fs';
import Handlebars from 'handlebars';
import { marked } from 'marked';
import { resumeQueries, sectionQueries } from '../db/database';
import puppeteer from 'puppeteer';
import {
  Document,
  Paragraph,
  TextRun,
  Packer,
  AlignmentType,
  BorderStyle,
  Table,
  TableRow,
  TableCell,
  WidthType,
  convertInchesToTwip,
} from 'docx';

Handlebars.registerHelper('markdown', function (text) {
  if (!text) return '';
  // parseInline renders markdown without wrapping it in a <p> tag
  return new Handlebars.SafeString(marked.parseInline(text as string) as string);
});

Handlebars.registerHelper('eq', function (a, b) {
  return a === b;
});

const router = Router();
const TEMPLATES_DIR = join(__dirname, '..', 'templates');

// ─── Sample Resume Data for Template Previews ────────────────────────────────
const SAMPLE_RESUME = {
  id: 'sample-resume',
  name: 'Alex Morgan',
  target_role: 'Senior Staff Software Engineer',
  template_id: 'modern',
  ats_score: 96,
  is_base: 1,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const SAMPLE_SECTIONS = [
  {
    id: 's-header',
    resume_id: 'sample-resume',
    section_type: 'header',
    title: 'Personal Info',
    position: 0,
    is_visible: 1,
    content: [
      {
        name: 'Alex Morgan',
        role: 'Senior Staff Software Engineer',
        email: 'alex.morgan@example.com',
        phone: '+1 (555) 349-2810',
        location: 'San Francisco, CA (Open to Remote)',
        linkedin: 'linkedin.com/in/alexmorgan-engineer',
        github: 'github.com/alexmorgan',
        website: 'alexmorgan.dev',
      },
    ],
  },
  {
    id: 's-summary',
    resume_id: 'sample-resume',
    section_type: 'summary',
    title: 'Professional Summary',
    position: 1,
    is_visible: 1,
    content: [
      {
        text: 'Staff-level Software Engineer with 8+ years architecting high-throughput distributed systems and intuitive consumer web applications. Scaled platform infrastructure from 20k to 5M+ daily active users while reducing cloud compute expenditures by 38%. Recognized for engineering leadership, mentoring senior staff, and driving developer velocity.',
      },
    ],
  },
  {
    id: 's-exp',
    resume_id: 'sample-resume',
    section_type: 'experience',
    title: 'Experience',
    position: 2,
    is_visible: 1,
    content: [
      {
        role: 'Staff Software Engineer, Tech Lead',
        company: 'CloudScale Technologies',
        location: 'San Francisco, CA',
        start_date: '2022',
        end_date: 'Present',
        current: true,
        bullets: [
          'Architected multi-region event streaming pipeline processing 2.4B events daily with 99.995% uptime SLA.',
          'Spearheaded caching modernization across 18 microservices, lowering p99 response latencies from 420ms to 48ms.',
          'Mentored 12 senior engineers, led technical design RFCs, and standardized automated canary deployments.',
        ],
      },
      {
        role: 'Senior Software Engineer',
        company: 'Apex Digital Systems',
        location: 'New York, NY',
        start_date: '2019',
        end_date: '2022',
        current: false,
        bullets: [
          'Engineered real-time collaborative workspace interface in TypeScript and WebSockets adopted by 350+ enterprise teams.',
          'Automated CI/CD build matrix with Docker and GitHub Actions, cutting developer deployment cycle times by 65%.',
          'Collaborated with design and compliance teams to achieve WCAG 2.1 AA accessibility compliance across all customer portals.',
        ],
      },
    ],
  },
  {
    id: 's-skills',
    resume_id: 'sample-resume',
    section_type: 'skills',
    title: 'Skills and Strengths',
    position: 3,
    is_visible: 1,
    content: [
      {
        category: 'Core Technologies',
        items: ['TypeScript', 'Node.js', 'React', 'Go', 'Python', 'SQL (PostgreSQL)', 'GraphQL'],
      },
      {
        category: 'Cloud and Infrastructure',
        items: ['AWS', 'Docker', 'Kubernetes', 'Redis', 'Kafka', 'Terraform', 'CI/CD Pipelines'],
      },
      {
        category: 'Leadership and System Design',
        items: ['Distributed Systems', 'API Design', 'System Reliability', 'Mentorship and Planning', 'Agile Delivery'],
      },
    ],
  },
  {
    id: 's-edu',
    resume_id: 'sample-resume',
    section_type: 'education',
    title: 'Education',
    position: 4,
    is_visible: 1,
    content: [
      {
        degree: 'B.S. in Computer Science',
        field: 'Software Systems and Architecture',
        institution: 'University of California, Berkeley',
        location: 'Berkeley, CA',
        start_date: '2015',
        end_date: '2019',
        gpa: '3.88 / 4.0',
      },
    ],
  },
  {
    id: 's-proj',
    resume_id: 'sample-resume',
    section_type: 'projects',
    title: 'Projects',
    position: 5,
    is_visible: 1,
    content: [
      {
        name: 'StreamPulse Engine',
        role: 'Creator and Lead Maintainer',
        description: 'Open-source distributed streaming telemetry engine with zero-overhead telemetry capture.',
        technologies: 'Go, Kafka, React, Tailwind CSS',
        bullets: [
          'Surpassed 4,500 GitHub stars and adopted by over 40 production engineering organizations.',
          'Built pluggable data connectors for S3, BigQuery, and Snowflake with zero runtime dependencies.',
        ],
      },
    ],
  },
];

// GET /api/export/sample-preview — render HTML with realistic dummy data for template preview
router.get('/sample-preview', (req: Request, res: Response) => {
  try {
    const templateId = (req.query.template as string) || 'modern';
    const html = renderTemplate(templateId, SAMPLE_RESUME, SAMPLE_SECTIONS);
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

// GET /api/export/:id/preview — render HTML for live preview
router.get('/:id/preview', (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const resume = resumeQueries.get(id);
    if (!resume) return void res.status(404).json({ error: 'Not found' });

    const templateId = (req.query.template as string) ?? resume.template_id ?? 'modern';
    const sections = sectionQueries.list(id);
    const html = renderTemplate(templateId, resume, sections);
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (e) {
    console.error('Preview error:', e);
    res.status(500).json({ error: (e as Error).message });
  }
});

// POST /api/export/:id/pdf
router.post('/:id/pdf', async (req: Request, res: Response) => {
  let browser: any = null;
  try {
    const id = String(req.params.id);
    const resume = resumeQueries.get(id);
    if (!resume) return void res.status(404).json({ error: 'Not found' });

    const { ats_mode, template } = req.body as { ats_mode?: boolean; template?: string };
    const templateId = ats_mode ? 'ats' : (template ?? resume.template_id ?? 'modern');
    const sections = sectionQueries.list(id);
    const html = renderTemplate(templateId, resume, sections);

    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'domcontentloaded' });

    try {
      await Promise.race([
        page.evaluateHandle('document.fonts.ready'),
        new Promise(resolve => setTimeout(resolve, 3000)),
      ]);
    } catch {
      // Font loading fallback
    }

    const pdfBuffer = await page.pdf({
      format: 'A4',
      margin: { top: '15mm', bottom: '15mm', left: '15mm', right: '15mm' },
      printBackground: true,
    });

    const filename = `${resume.name.replace(/[^a-z0-9]/gi, '_')}_cv.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(Buffer.from(pdfBuffer));
  } catch (e) {
    console.error('PDF Export Error:', e);
    res.status(500).json({ error: (e as Error).message });
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch (closeErr) {
        console.warn('Failed to close browser:', closeErr);
      }
    }
  }
});

// POST /api/export/:id/docx
router.post('/:id/docx', async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const resume = resumeQueries.get(id);
    if (!resume) return void res.status(404).json({ error: 'Not found' });
    const sections = sectionQueries.list(id);

    const noBorder = { style: BorderStyle.NONE, size: 0, color: 'auto' };
    const noBorders = {
      top: noBorder,
      bottom: noBorder,
      left: noBorder,
      right: noBorder,
      insideHorizontal: noBorder,
      insideVertical: noBorder,
    };

    const cleanUrl = (url: unknown) => {
      return String(url || '').replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
    };

    const appendRunWithBreaks = (runs: InstanceType<typeof TextRun>[], str: string) => {
      const parts = str.split('\n');
      for (let i = 0; i < parts.length; i++) {
        if (i > 0) {
          runs.push(new TextRun({ break: 1 }));
        }
        if (parts[i].length > 0) {
          runs.push(new TextRun({ text: parts[i] }));
        }
      }
    };

    const parseMarkdownToRuns = (rawText: string): InstanceType<typeof TextRun>[] => {
      if (!rawText) return [];
      const text = rawText.replace(/\r\n/g, '\n').trim();
      const runs: InstanceType<typeof TextRun>[] = [];
      const regex = /(\*\*(.*?)\*\*|\*(.*?)\*|\[(.*?)\]\((.*?)\))/g;
      let lastIndex = 0;
      let match: RegExpExecArray | null;

      while ((match = regex.exec(text)) !== null) {
        if (match.index > lastIndex) {
          appendRunWithBreaks(runs, text.substring(lastIndex, match.index));
        }
        if (match[2] !== undefined) {
          runs.push(new TextRun({ text: match[2], bold: true }));
        } else if (match[3] !== undefined) {
          runs.push(new TextRun({ text: match[3], italics: true }));
        } else if (match[4] !== undefined) {
          runs.push(new TextRun({ text: match[4], underline: {} }));
        }
        lastIndex = regex.lastIndex;
      }
      if (lastIndex < text.length) {
        appendRunWithBreaks(runs, text.substring(lastIndex));
      }
      return runs;
    };

    const createTwoColumnRow = (
      leftText: string,
      rightText: string,
      options?: { leftBold?: boolean; rightItalics?: boolean; leftSize?: number; rightSize?: number }
    ): InstanceType<typeof Table> => {
      const leftBold = options?.leftBold ?? true;
      const rightItalics = options?.rightItalics ?? false;
      const leftSize = options?.leftSize ?? 21;
      const rightSize = options?.rightSize ?? 19;

      return new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        columnWidths: [7400, 2634],
        indent: { size: 0, type: WidthType.DXA },
        margins: { top: 0, bottom: 0, left: 0, right: 0 },
        borders: noBorders,
        rows: [
          new TableRow({
            children: [
              new TableCell({
                width: { size: 74, type: WidthType.PERCENTAGE },
                borders: noBorders,
                margins: { left: 0, right: 0, top: 0, bottom: 0 },
                children: [
                  new Paragraph({
                    children: [new TextRun({ text: leftText, bold: leftBold, size: leftSize, color: '0f172a' })],
                    spacing: { before: 80, after: 15 },
                  }),
                ],
              }),
              new TableCell({
                width: { size: 26, type: WidthType.PERCENTAGE },
                borders: noBorders,
                margins: { left: 0, right: 0, top: 0, bottom: 0 },
                children: [
                  new Paragraph({
                    alignment: AlignmentType.RIGHT,
                    children: [
                      new TextRun({
                        text: rightText,
                        italics: rightItalics,
                        size: rightSize,
                        color: '64748b',
                      }),
                    ],
                    spacing: { before: 80, after: 15 },
                  }),
                ],
              }),
            ],
          }),
        ],
      });
    };

    const children: (InstanceType<typeof Paragraph> | InstanceType<typeof Table>)[] = [];

    for (const section of sections) {
      if (!section.is_visible) continue;
      const content = Array.isArray(section.content) ? section.content : [];
      if (content.length === 0) continue;

      if (section.section_type === 'header') {
        for (const entry of content) {
          const e = entry as Record<string, unknown>;
          if (e.name) {
            children.push(new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: String(e.name), bold: true, size: 36, font: 'Calibri', color: '0f172a' })],
              spacing: { before: 0, after: 30 },
            }));
          }
          const role = (e.title || e.role || resume.meta?.target_role) as string | undefined;
          if (role) {
            children.push(new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: String(role), bold: true, size: 22, color: '2563eb' })],
              spacing: { before: 0, after: 50 },
            }));
          }

          const primaryParts = [e.email, e.phone, e.location].filter(Boolean).map(String);
          if (primaryParts.length) {
            children.push(new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: primaryParts.join('  •  '), size: 19, color: '475569' })],
              spacing: { before: 0, after: 20 },
            }));
          }

          const linkParts = [e.linkedin, e.github, e.website].filter(Boolean).map(cleanUrl);
          if (linkParts.length) {
            children.push(new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: linkParts.join('  •  '), size: 18, color: '2563eb' })],
              spacing: { before: 0, after: 150 },
            }));
          }
        }
        continue;
      }

      // Section heading with subtle bottom line
      children.push(new Paragraph({
        children: [new TextRun({ text: section.title.toUpperCase(), bold: true, size: 22, color: '0f172a' })],
        border: { bottom: { color: 'cbd5e1', space: 4, style: BorderStyle.SINGLE, size: 6 } },
        spacing: { before: 180, after: 60 },
      }));

      for (const entry of content) {
        const e = entry as Record<string, unknown>;

        if (section.section_type === 'summary') {
          const text = String(e.text || '').trim();
          if (text) {
            children.push(new Paragraph({
              children: parseMarkdownToRuns(text),
              spacing: { before: 30, after: 80 },
              alignment: AlignmentType.LEFT,
            }));
          }
        } else if (section.section_type === 'experience') {
          const role = String(e.role || '');
          const company = String(e.company || '');
          const dates = [e.start_date, e.end_date].filter(Boolean).map(String).join(' – ');
          const location = String(e.location || '');

          if (dates) {
            children.push(createTwoColumnRow(role, dates, { leftBold: true, rightItalics: true }));
          } else {
            children.push(new Paragraph({
              children: [new TextRun({ text: role, bold: true, size: 21, color: '0f172a' })],
              spacing: { before: 80, after: 15 },
            }));
          }

          const subParts: InstanceType<typeof TextRun>[] = [];
          if (company) {
            subParts.push(new TextRun({ text: company, bold: true, italics: true, color: '334155', size: 19 }));
          }
          if (location) {
            subParts.push(new TextRun({ text: (company ? '  •  ' : '') + location, color: '64748b', size: 19 }));
          }
          if (subParts.length) {
            children.push(new Paragraph({
              children: subParts,
              spacing: { before: 0, after: 30 },
            }));
          }

          const bullets = Array.isArray(e.bullets) ? (e.bullets as string[]) : [];
          for (const bullet of bullets) {
            const cleanBullet = String(bullet).trim();
            if (cleanBullet) {
              children.push(new Paragraph({
                bullet: { level: 0 },
                children: parseMarkdownToRuns(cleanBullet),
                spacing: { before: 15, after: 15 },
              }));
            }
          }
        } else if (section.section_type === 'education') {
          const degree = String(e.degree || '');
          const field = String(e.field || '');
          const degreeText = field ? `${degree} in ${field}` : degree;
          const dates = [e.start_date, e.end_date].filter(Boolean).map(String).join(' – ');
          const institution = String(e.institution || '');
          const location = String(e.location || '');
          const gpa = e.gpa ? `GPA: ${String(e.gpa).trim()}` : '';

          if (dates) {
            children.push(createTwoColumnRow(degreeText, dates, { leftBold: true, rightItalics: true }));
          } else {
            children.push(new Paragraph({
              children: [new TextRun({ text: degreeText, bold: true, size: 21, color: '0f172a' })],
              spacing: { before: 80, after: 15 },
            }));
          }

          const subParts: InstanceType<typeof TextRun>[] = [];
          if (institution) {
            subParts.push(new TextRun({ text: institution, italics: true, color: '334155', size: 19 }));
          }
          const meta = [location, gpa].filter(Boolean).join('  •  ');
          if (meta) {
            subParts.push(new TextRun({ text: (institution ? '  •  ' : '') + meta, color: '64748b', size: 19 }));
          }
          if (subParts.length) {
            children.push(new Paragraph({
              children: subParts,
              spacing: { before: 0, after: 30 },
            }));
          }
        } else if (section.section_type === 'skills') {
          const category = String(e.category || 'Skills').trim();
          const items = Array.isArray(e.items) ? (e.items as string[]).join(', ') : String(e.items || '');
          if (items.trim()) {
            children.push(new Paragraph({
              children: [
                new TextRun({ text: `${category}: `, bold: true, size: 19, color: '0f172a' }),
                new TextRun({ text: items.trim(), size: 19, color: '334155' }),
              ],
              spacing: { before: 20, after: 30 },
            }));
          }
        } else if (section.section_type === 'projects') {
          const name = String(e.name || '').trim();
          const role = String(e.role || '').trim();
          const url = cleanUrl(String(e.url || ''));
          const tech = Array.isArray(e.tech) ? (e.tech as string[]).join(', ') : String(e.technologies || e.tech || '').trim();
          const description = String(e.description || '').trim();

          const titleText = role ? `${name} — ${role}` : name;
          if (url) {
            children.push(createTwoColumnRow(titleText, url, { leftBold: true, rightItalics: true }));
          } else {
            children.push(new Paragraph({
              children: [new TextRun({ text: titleText, bold: true, size: 21, color: '0f172a' })],
              spacing: { before: 70, after: 15 },
            }));
          }

          if (tech) {
            children.push(new Paragraph({
              children: [
                new TextRun({ text: 'Technologies: ', bold: true, size: 19, color: '64748b' }),
                new TextRun({ text: tech, size: 19, color: '475569' }),
              ],
              spacing: { before: 0, after: 20 },
            }));
          }

          if (description) {
            children.push(new Paragraph({
              children: parseMarkdownToRuns(description),
              spacing: { before: 15, after: 30 },
            }));
          }

          const bullets = Array.isArray(e.bullets) ? (e.bullets as string[]) : [];
          for (const bullet of bullets) {
            const cleanBullet = String(bullet).trim();
            if (cleanBullet) {
              children.push(new Paragraph({
                bullet: { level: 0 },
                children: parseMarkdownToRuns(cleanBullet),
                spacing: { before: 15, after: 15 },
              }));
            }
          }
        } else if (section.section_type === 'certifications') {
          const name = String(e.name || '').trim();
          const issuer = String(e.issuer || '').trim();
          const date = String(e.date || '').trim();

          const titleText = issuer ? `${name} — ${issuer}` : name;
          if (date) {
            children.push(createTwoColumnRow(titleText, date, { leftBold: true, rightItalics: false }));
          } else {
            children.push(new Paragraph({
              children: [new TextRun({ text: titleText, bold: true, size: 21, color: '0f172a' })],
              spacing: { before: 50, after: 15 },
            }));
          }
        } else {
          const title = String(e.title || e.heading || '').trim();
          const description = String(e.description || e.text || '').trim();

          if (title) {
            children.push(new Paragraph({
              children: [new TextRun({ text: title, bold: true, size: 20, color: '0f172a' })],
              spacing: { before: 50, after: 15 },
            }));
          }
          if (description) {
            children.push(new Paragraph({
              children: parseMarkdownToRuns(description),
              spacing: { before: 0, after: 50 },
            }));
          }

          const bullets = Array.isArray(e.bullets) ? (e.bullets as string[]) : [];
          for (const bullet of bullets) {
            const cleanBullet = String(bullet).trim();
            if (cleanBullet) {
              children.push(new Paragraph({
                bullet: { level: 0 },
                children: parseMarkdownToRuns(cleanBullet),
                spacing: { before: 15, after: 15 },
              }));
            }
          }
        }
      }
    }

    const doc = new Document({
      styles: {
        default: {
          document: {
            run: { font: 'Calibri', size: 21, color: '1e293b' },
            paragraph: { spacing: { line: 260, before: 0, after: 40 } },
          },
          heading2: {
            run: { font: 'Calibri', size: 24, bold: true, color: '0f172a' },
          },
        },
      },
      sections: [
        {
          properties: {
            page: {
              size: {
                width: 11906,
                height: 16838,
              },
              margin: {
                top: convertInchesToTwip(0.6),
                bottom: convertInchesToTwip(0.6),
                left: convertInchesToTwip(0.65),
                right: convertInchesToTwip(0.65),
              },
            },
          },
          children,
        },
      ],
    });

    const buffer = await Packer.toBuffer(doc);
    const filename = `${resume.name.replace(/[^a-z0-9]/gi, '_')}_cv.docx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (e) {
    console.error('DOCX Export Error:', e);
    res.status(500).json({ error: (e as Error).message });
  }
});

// POST /api/export/:id/json — full backup
router.post('/:id/json', (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const resume = resumeQueries.get(id);
    if (!resume) return void res.status(404).json({ error: 'Not found' });
    const sections = sectionQueries.list(id);
    const filename = `${resume.name.replace(/[^a-z0-9]/gi, '_')}_cv_backup.json`;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.json({ resume, sections, exported_at: new Date().toISOString() });
  } catch (e) {
    console.error('JSON Export Error:', e);
    res.status(500).json({ error: (e as Error).message });
  }
});

// ─── Template renderer ────────────────────────────────────────────────────────

function renderTemplate(
  templateId: string,
  resume: { name: string; template_id?: string },
  sections: Array<{ section_type: string; title: string; content: unknown[]; is_visible?: boolean | number; position?: number }>
): string {
  const templateFile = join(TEMPLATES_DIR, `${templateId}.html`);
  const fallback = join(TEMPLATES_DIR, 'modern.html');
  const filePath = existsSync(templateFile) ? templateFile : fallback;
  const source = readFileSync(filePath, 'utf8');
  const template = Handlebars.compile(source);

  // Filter only visible sections (is_visible can be 1, true, or default visible if undefined) and sort by position
  const isSecVisible = (s: { is_visible?: boolean | number }) => s.is_visible !== 0 && s.is_visible !== false;
  const visibleSections = [...sections]
    .filter(isSecVisible)
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

  // Group visible sections by type for easier template access
  const sectionMap: Record<string, typeof sections[number]> = {};
  for (const s of visibleSections) {
    sectionMap[s.section_type] = s;
  }

  const customSections = visibleSections.filter(
    s => s.section_type === 'custom' || !['header', 'summary', 'experience', 'education', 'skills', 'projects', 'certifications'].includes(s.section_type)
  );

  const bodySections = visibleSections
    .filter(s => s.section_type !== 'header')
    .map(s => {
      const isSummary = s.section_type === 'summary';
      const isExperience = s.section_type === 'experience';
      const isEducation = s.section_type === 'education';
      const isSkills = s.section_type === 'skills';
      const isProjects = s.section_type === 'projects';
      const isCertifications = s.section_type === 'certifications';
      const isCustom = !['summary', 'experience', 'education', 'skills', 'projects', 'certifications'].includes(s.section_type);
      return {
        ...s,
        isSummary,
        isExperience,
        isEducation,
        isSkills,
        isProjects,
        isCertifications,
        isCustom,
        summaryText: isSummary ? ((s.content?.[0] as Record<string, unknown>)?.text as string ?? '') : undefined,
      };
    });

  const sidebarSections = bodySections.filter(s => s.isSkills || s.isEducation || s.isCertifications);
  const mainSections = bodySections.filter(s => s.isSummary || s.isExperience || s.isProjects || s.isCustom);

  return template({
    resume,
    sections: visibleSections,
    bodySections,
    sidebarSections,
    mainSections,
    sectionMap,
    header: (() => {
      const h = ((visibleSections.find(s => s.section_type === 'header')?.content[0] ?? {}) as Record<string, unknown>);
      return {
        ...h,
        role: (h.role as string) || (resume as any).meta?.target_role || (resume as any).target_role || '',
      };
    })(),
    summary: visibleSections.find(s => s.section_type === 'summary')?.content[0] ?? {},
    experience: visibleSections.filter(s => s.section_type === 'experience').flatMap(s => s.content),
    education: visibleSections.filter(s => s.section_type === 'education').flatMap(s => s.content),
    skills: visibleSections.filter(s => s.section_type === 'skills').flatMap(s => s.content),
    projects: visibleSections.filter(s => s.section_type === 'projects').flatMap(s => s.content),
    certifications: visibleSections.filter(s => s.section_type === 'certifications').flatMap(s => s.content),
    customSections,
  });
}

export default router;
