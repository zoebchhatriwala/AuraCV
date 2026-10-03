export const PROMPTS = {
  redline(sectionTitle: string, sectionContent: string, context = ""): string {
    return `You are an expert career advisor and hiring manager reviewing a resume to modern, top-tier professional standards (strict 1-2 page scannability, Google X-Y-Z formula, and human, ATS-friendly clarity).

Analyze the following resume section and provide specific, actionable, fluff-free redline critique.

Section: "${sectionTitle}"
Content:
${sectionContent}
${context ? `\nTarget role/industry context: ${context}` : ""}

### TONE & LANGUAGE CONSTRAINTS:
1. Strict ban on inflated corporate jargon and AI filler: flag overused buzzwords like "spearheaded," "orchestrated," "leveraged," "revolutionized," "pivotal," "testament," "synergistic," "robust," "delve," "tapestry," "game-changing."
2. Write like an accomplished, grounded professional speaking directly to a hiring manager. Champion plain, active verbs: "built," "led," "designed," "managed," "launched," "cut," "grew," "delivered," "negotiated," "closed," "streamlined," "analyzed."
3. Evaluate statements using the Google X-Y-Z formula: "Accomplished [X], as measured by [Y], by doing [Z]" (What was achieved/the challenge -> What was done, methods or tools used -> Measurable outcome/impact).
4. Flag missing metrics and hard proof points (percentages, dollars, hours saved, volume, team size, conversion rates, error reductions).
5. Scannability & brevity: Flag fluff and filler words that waste space on a tight, scannable CV.

Respond in JSON matching this exact structure:
{
  "overall_score": <0-100>,
  "suggestions": [
    {
      "type": "improve" | "remove" | "add" | "rewrite",
      "original": "<original text snippet or word>",
      "suggestion": "<specific plain-English improvement using Google X-Y-Z format>",
      "reason": "<why this improves human clarity, ATS parsing, or hiring manager signal>",
      "priority": "high" | "medium" | "low"
    }
  ],
  "strengths": ["<what is already concrete, quantifiable, or well-communicated>"],
  "summary": "<2-3 sentence candid assessment from an experienced hiring manager's perspective>"
}`;
  },

  rewrite(bullet: string, tone = "xyz", role = ""): string {
    return `You are an expert career advisor and hiring coach helping write a resume to top global standards (grounded human tone, Google X-Y-Z format, and scannable ATS-friendly clarity).

Rewrite the following resume bullet point to be clear, quantifiable, and direct for any career field or role.

TARGET ROLE / FIELD: ${role || "Target Role"}
STYLE FOCUS: ${tone} (e.g. xyz = Google X-Y-Z Impact, concise = crisp & direct, leadership = ownership & team scope, action = action & outcome driven)

ORIGINAL BULLET:
"${bullet}"

### STRICT TONE & LANGUAGE CONSTRAINTS:
1. Strict ban on inflated corporate jargon and AI filler:
   Do NOT use words like "spearheaded," "orchestrated," "leveraged," "revolutionized," "pivotal," "testament," "synergistic," "robust," "delve," "tapestry," "game-changing," "streamlined," "utilized."
2. Write like an accomplished professional speaking directly to a hiring manager:
   Use plain, active verbs: "built," "led," "designed," "managed," "launched," "grew," "cut," "delivered," "negotiated," "closed," "created," "reduced," "analyzed."
3. Structure using the universal Google X-Y-Z formula:
   "Accomplished [X], as measured by [Y], by doing [Z]"
   - [X] What was accomplished / the core outcome or goal achieved.
   - [Y] The quantifiable metric or business impact (e.g. %, $, hours saved, growth, volume, accuracy, retention). If the original lacks hard numbers, supply realistic placeholder metrics in brackets (e.g. "[by 25%]" or "[$50K]") so the candidate can easily personalize them.
   - [Z] What actions, methods, skills, frameworks, or tools were applied.
4. Keep it tight and punchy: 1 to 2 lines max. No run-on sentences.

Respond in JSON matching this exact structure:
{
  "rewritten": "<the tight, high-impact bullet in Google X-Y-Z format>",
  "alternatives": ["<alternative angle 1>", "<alternative angle 2>"],
  "action_verb_used": "<the active verb used (e.g. built, led, designed, launched, cut, grew)>",
  "xyz_breakdown": {
    "accomplished_x": "<what was accomplished/the core outcome>",
    "measured_by_y": "<the quantified metric/impact>",
    "doing_z": "<the action, method, or skills used>"
  },
  "jargon_removed": ["<banned buzzword or fluff removed, if any>"],
  "improvement_notes": "<1-2 concise sentences explaining what fluff was cut and why>"
}`;
  },

  atsScore(resumeText: string, jobDescription: string): string {
    return `You are a recruitment specialist and hiring advisor.
Evaluate how well this resume matches the target job description based on relevant competencies, quantifiable impact, and ATS scannability.

RESUME:
${resumeText}

JOB DESCRIPTION:
${jobDescription}

### CRITERIA:
- Scored on role alignment, concrete skills verification, and quantifiable proof points (Google X-Y-Z metrics, not superficial keyword stuffing).
- Prioritize clear, natural professional language over corporate buzzwords.
- Format check for clean headings and scannable 1-2 page structure.

Respond in JSON:
{
  "overall_score": <0-100>,
  "keyword_match_score": <0-100>,
  "format_score": <0-100>,
  "experience_match_score": <0-100>,
  "matched_keywords": ["<matched skill, competency, or qualification>"],
  "missing_keywords": ["<critical missing skill, competency, or qualification>"],
  "section_scores": { "summary": <n>, "experience": <n>, "skills": <n>, "education": <n> },
  "recommendations": ["<actionable, non-jargon step to strengthen alignment>"],
  "summary": "<2-3 sentence candid assessment of alignment with target role>"
}`;
  },

  keywordGap(resumeText: string, jobDescription: string): string {
    return `You are a recruitment specialist and talent advisor.
Identify the critical skills, domain competencies, tools, methodologies, and credentials missing from the candidate's resume based on the job description. Filter out fluff buzzwords and focus on high-signal role requirements.

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
  "summary": "<brief, direct gap analysis focused on verifiable capabilities>"
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
      "content": [{ "category": "Core Competencies", "items": [] }]
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
    }
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
1. Ground the response strictly in the candidate's real experiences, projects, competencies, and metrics from the original answer. Do NOT invent new employers, projects, or fake statistics.
2. Adapt the angle, structure (e.g. Situation, Task, Action, Result), and emphasis so it provides a compelling, direct answer to the TARGET QUESTION.
3. Be articulate, natural, and persuasive. Avoid robotic fluff and inflated buzzwords.

Respond in JSON matching this exact structure:
{
  "morphed_answer": "<the tailored, complete answer to the target question>",
  "key_adaptations": ["<adaptation point 1>", "<adaptation point 2>"],
  "suggested_tags": ["<tag1>", "<tag2>"],
  "suggested_category": "<Experience | Behavioral | Leadership | Culture Fit | Logistics | General>"
}`;
  },

  cvTailorQuestions(resumeText: string, role: string, instructions: string): string {
    return `You are an elite Executive Recruiter and Resume Writer following the "Google CV Standard".
Your goal is to tailor the candidate's CV to the target role.
Google CV standards strictly require EVERY bullet to follow the X-Y-Z format: "Accomplished [X] as measured by [Y], by doing [Z]."
Before rewriting, identify gaps where metrics ([Y]) or specific actions ([Z]) are missing or weak for the target role.

RESUME:
${resumeText}

TARGET ROLE:
${role}

CUSTOM INSTRUCTIONS:
${instructions}

Ask the user a concise list of up to 5 specific, targeted questions to extract the exact missing metrics and actions needed to write perfect X-Y-Z bullets for this specific role.
Crucially, your questions MUST explicitly guide the user to provide the X, Y, and Z. For example, frame questions like: "For your work on [Project], what was the specific outcome you accomplished [X], what metric measured its success [Y], and what specific action did you take to achieve it [Z]?"

Respond in JSON matching this exact structure:
{
  "questions": [
    {
      "id": "q1",
      "question": "<specific question asking for metrics or context>"
    }
  ]
}`;
  },

  cvTailorRewrite(resumeText: string, role: string, instructions: string, qna: Array<{question: string, answer: string}>): string {
    const qnaText = qna.map(q => `Q: ${q.question}\nA: ${q.answer}`).join("\n\n");
    
    return `You are an elite Executive Recruiter and Resume Writer following the "Google CV Standard".
Transform the user's existing CV into a top-tier, interview-winning document tailored to the target role.

RESUME:
${resumeText}

TARGET ROLE:
${role}

CUSTOM INSTRUCTIONS:
${instructions}

USER ANSWERS TO CLARIFYING QUESTIONS:
${qnaText}

CORE PRINCIPLES:
1. The Google X-Y-Z Formula (STRICTLY REQUIRED): EVERY SINGLE bullet point MUST explicitly follow the format: "Accomplished [X] as measured by [Y], by doing [Z]." Do not deviate from this phrasing. It MUST literally begin with the word "Accomplished" or "Achieved" followed by what was done, then "as measured by", and then "by doing".
2. Quantifiable Impact: Replace responsibilities with measurable results based on the user's answers.
3. Hyper-Relevance: Tailor strictly to the target role.
4. Human & Authentic: Strictly avoid "AI-sounding" buzzwords (e.g. synergized, orchestrated, spearheaded). Write like a competent human.
5. ATS-Friendly: Precise and scannable.
6. DO NOT change the original Company Name or Role Title. Return them exactly as they appear in the provided resume.
7. Skills Optimization: Reorder, filter, and highlight skills in the skills sections to perfectly align with the target role.
8. Single-Page Constraint: Ensure the output helps the CV fit on a single page. Write a very brief summary (max 2 sentences), limit experience to a MAXIMUM of 3 most impactful bullets per role, and remove irrelevant skills.

Rewrite the work experience, skills, and summary sections.
Respond in JSON matching this exact structure:
{
  "summary": "<The rewritten professional summary>",
  "experience": [
    {
      "company": "<Company Name>",
      "role": "<Role Title>",
      "bullets": [
        "<rewritten bullet 1>",
        "<rewritten bullet 2>"
      ]
    }
  ],
  "skills": [
    {
      "category": "<Category Name>",
      "items": [
        "<tailored skill 1>",
        "<tailored skill 2>"
      ]
    }
  ],
  "improvement_notes": "<1-2 sentences explaining how you tailored it>"
}`;
  },
} satisfies Record<string, (...args: any[]) => string>;

