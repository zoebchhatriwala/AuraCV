import { Router, Request, Response } from 'express';
import { join } from 'path';
import { readFileSync, existsSync } from 'fs';
import Handlebars from 'handlebars';
import { marked } from 'marked';
import { resumeQueries, sectionQueries } from '../db/database';

Handlebars.registerHelper('markdown', function (text) {
  if (!text) return '';
  // parseInline renders markdown without wrapping it in a <p> tag
  return new Handlebars.SafeString(marked.parseInline(text as string) as string);
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
  try {
    const id = String(req.params.id);
    const resume = resumeQueries.get(id);
    if (!resume) return void res.status(404).json({ error: 'Not found' });

    const { ats_mode, template } = req.body as { ats_mode?: boolean; template?: string };
    const templateId = ats_mode ? 'ats' : (template ?? resume.template_id ?? 'modern');
    const sections = sectionQueries.list(id);
    const html = renderTemplate(templateId, resume, sections);

    const puppeteer = await import('puppeteer');
    const browser = await puppeteer.default.launch({ headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      margin: { top: '15mm', bottom: '15mm', left: '15mm', right: '15mm' },
      printBackground: true,
    });
    await browser.close();

    const filename = `${resume.name.replace(/[^a-z0-9]/gi, '_')}_cv.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(Buffer.from(pdfBuffer));
  } catch (e) {
    console.error('PDF Export Error:', e);
    res.status(500).json({ error: (e as Error).message });
  }
});

// POST /api/export/:id/docx
router.post('/:id/docx', async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const resume = resumeQueries.get(id);
    if (!resume) return void res.status(404).json({ error: 'Not found' });
    const sections = sectionQueries.list(id);

    const { Document, Paragraph, TextRun, HeadingLevel, Packer, AlignmentType } = await import('docx');

    const children: InstanceType<typeof Paragraph>[] = [];

    for (const section of sections) {
      if (!section.is_visible) continue;

      // Section heading
      children.push(new Paragraph({
        text: section.title,
        heading: HeadingLevel.HEADING_2,
        thematicBreak: true,
      }));

      for (const entry of section.content) {
        const e = entry as Record<string, unknown>;

        if (section.section_type === 'header') {
          if (e.name) children.push(new Paragraph({ text: e.name as string, heading: HeadingLevel.TITLE }));
          const contactParts = [e.email, e.phone, e.location, e.linkedin, e.github].filter(Boolean);
          if (contactParts.length) {
            children.push(new Paragraph({ text: contactParts.join(' | '), alignment: AlignmentType.CENTER }));
          }
        } else if (section.section_type === 'summary') {
          children.push(new Paragraph({ text: e.text as string ?? '' }));
        } else if (section.section_type === 'experience') {
          children.push(new Paragraph({
            children: [
              new TextRun({ text: `${e.role} - ${e.company}`, bold: true }),
              new TextRun({ text: `  ${e.start_date} - ${e.end_date}`, italics: true }),
            ],
          }));
          for (const bullet of (e.bullets as string[] ?? [])) {
            children.push(new Paragraph({ text: `• ${bullet}` }));
          }
        } else if (section.section_type === 'education') {
          children.push(new Paragraph({
            children: [
              new TextRun({ text: `${e.degree} in ${e.field} - ${e.institution}`, bold: true }),
              new TextRun({ text: `  ${e.start_date} - ${e.end_date}`, italics: true }),
            ],
          }));
        } else if (section.section_type === 'skills') {
          children.push(new Paragraph({
            children: [
              new TextRun({ text: `${e.category}: `, bold: true }),
              new TextRun({ text: (e.items as string[] ?? []).join(', ') }),
            ],
          }));
        } else {
          children.push(new Paragraph({ text: JSON.stringify(entry) }));
        }
      }
    }

    const doc = new Document({ sections: [{ properties: {}, children }] });
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
  sections: Array<{ section_type: string; title: string; content: unknown[]; is_visible?: boolean | number }>
): string {
  const templateFile = join(TEMPLATES_DIR, `${templateId}.html`);
  const fallback = join(TEMPLATES_DIR, 'modern.html');
  const filePath = existsSync(templateFile) ? templateFile : fallback;
  const source = readFileSync(filePath, 'utf8');
  const template = Handlebars.compile(source);

  // Filter only visible sections (is_visible can be 1, true, or default visible if undefined)
  const isSecVisible = (s: { is_visible?: boolean | number }) => s.is_visible !== 0 && s.is_visible !== false;
  const visibleSections = sections.filter(isSecVisible);

  // Group visible sections by type for easier template access
  const sectionMap: Record<string, typeof sections[number]> = {};
  for (const s of visibleSections) {
    sectionMap[s.section_type] = s;
  }

  return template({
    resume,
    sections: visibleSections,
    sectionMap,
    header: visibleSections.find(s => s.section_type === 'header')?.content[0] ?? {},
    summary: visibleSections.find(s => s.section_type === 'summary')?.content[0] ?? {},
    experience: visibleSections.filter(s => s.section_type === 'experience').flatMap(s => s.content),
    education: visibleSections.filter(s => s.section_type === 'education').flatMap(s => s.content),
    skills: visibleSections.filter(s => s.section_type === 'skills').flatMap(s => s.content),
    projects: visibleSections.filter(s => s.section_type === 'projects').flatMap(s => s.content),
    certifications: visibleSections.filter(s => s.section_type === 'certifications').flatMap(s => s.content),
  });
}

export default router;
