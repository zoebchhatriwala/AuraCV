export const PROMPTS = {
  redline(sectionTitle: string, sectionContent: string, context = ""): string {
    return `You are an expert resume coach and HR consultant.
Analyze the following resume section and provide specific, actionable redline suggestions.

Section: "${sectionTitle}"
Content:
${sectionContent}
${context ? `\nTarget role/company context: ${context}` : ""}

Respond in JSON matching this exact structure:
{
  "overall_score": <0-100>,
  "suggestions": [
    {
      "type": "improve" | "remove" | "add" | "rewrite",
      "original": "<original text snippet>",
      "suggestion": "<specific improvement>",
      "reason": "<why this helps>",
      "priority": "high" | "medium" | "low"
    }
  ],
  "strengths": ["<what is already working well>"],
  "summary": "<2-3 sentence overall assessment>"
}`;
  },

  rewrite(bullet: string, tone = "professional", role = ""): string {
    return `You are an expert resume writer.
Rewrite the following resume bullet point to be more impactful, quantifiable, and ${tone}.
${role ? `Target role: ${role}` : ""}

Original: "${bullet}"

Rules: Start with a strong action verb. Include metrics where possible. Be concise (1-2 lines max). Use active voice.

Respond in JSON:
{
  "rewritten": "<new bullet point>",
  "alternatives": ["<option 2>", "<option 3>"],
  "action_verb_used": "<verb>",
  "improvement_notes": "<what changed and why>"
}`;
  },

  atsScore(resumeText: string, jobDescription: string): string {
    return `You are an ATS (Applicant Tracking System) expert.
Analyze how well this resume matches the job description.

RESUME:
${resumeText}

JOB DESCRIPTION:
${jobDescription}

Respond in JSON:
{
  "overall_score": <0-100>,
  "keyword_match_score": <0-100>,
  "format_score": <0-100>,
  "experience_match_score": <0-100>,
  "matched_keywords": ["<keyword>"],
  "missing_keywords": ["<keyword>"],
  "section_scores": { "summary": <n>, "experience": <n>, "skills": <n>, "education": <n> },
  "recommendations": ["<action>"],
  "summary": "<2-3 sentence assessment>"
}`;
  },

  keywordGap(resumeText: string, jobDescription: string): string {
    return `You are a recruitment specialist.
Find all important keywords from the JD that are missing or underrepresented in the resume.

RESUME:
${resumeText}

JOB DESCRIPTION:
${jobDescription}

Respond in JSON:
{
  "critical_missing": [{ "keyword": "", "frequency_in_jd": 0, "suggested_context": "" }],
  "nice_to_have_missing": [{ "keyword": "", "suggested_context": "" }],
  "already_present": ["<keyword>"],
  "skills_gap": { "technical": [], "soft": [], "domain": [] },
  "summary": "<brief gap analysis>"
}`;
  },

  importParse(rawText: string): string {
    return `You are a resume parser. Extract structured information from this resume text.

RESUME TEXT:
${rawText}

Return ONLY valid JSON with this exact structure (include only sections that have content):
{
  "name": "<full name>",
  "sections": [
    {
      "section_type": "header",
      "title": "Contact Information",
      "content": [{ "name": "", "email": "", "phone": "", "location": "", "linkedin": "", "github": "", "website": "" }]
    },
    {
      "section_type": "summary",
      "title": "Professional Summary",
      "content": [{ "text": "" }]
    },
    {
      "section_type": "experience",
      "title": "Work Experience",
      "content": [{ "company": "", "role": "", "start_date": "", "end_date": "", "location": "", "bullets": [] }]
    },
    {
      "section_type": "education",
      "title": "Education",
      "content": [{ "institution": "", "degree": "", "field": "", "start_date": "", "end_date": "", "gpa": "" }]
    },
    {
      "section_type": "skills",
      "title": "Skills",
      "content": [{ "category": "Technical", "items": [] }]
    },
    {
      "section_type": "projects",
      "title": "Projects",
      "content": [{ "name": "", "description": "", "tech": [], "url": "", "bullets": [] }]
    },
    {
      "section_type": "certifications",
      "title": "Certifications",
      "content": [{ "name": "", "issuer": "", "date": "", "url": "" }]
  ]
}
`;
  },

  morphQA(
    originalQuestion: string,
    originalAnswer: string,
    targetQuestion: string,
    instructions = "",
  ): string {
    return `You are an expert career consultant and job interview coach.
A job applicant has a verified answer to a previous question and wants to adapt (morph) it to directly address a new target question.

ORIGINAL QUESTION:
"${originalQuestion}"

ORIGINAL CANDIDATE EXPERIENCE & ANSWER:
"${originalAnswer}"

TARGET QUESTION TO ANSWER:
"${targetQuestion}"

${instructions ? `SPECIAL INSTRUCTIONS / FOCUS: ${instructions}\n` : ""}
RULES:
1. Ground the response strictly in the candidate's real experiences, projects, technical stacks, and metrics from the original answer. Do NOT invent new employers, projects, or fake statistics.
2. Adapt the angle, structure (e.g. Situation, Task, Action, Result), and emphasis so it provides a compelling, direct answer to the TARGET QUESTION.
3. Be articulate, natural, and persuasive. Avoid robotic fluff.

Respond in JSON matching this exact structure:
{
  "morphed_answer": "<the tailored, complete answer to the target question>",
  "key_adaptations": ["<adaptation point 1>", "<adaptation point 2>"],
  "suggested_tags": ["<tag1>", "<tag2>"],
  "suggested_category": "<Experience | Behavioral | Leadership | Culture Fit | Logistics | General>"
}`;
  },
} satisfies Record<string, (...args: string[]) => string>;
