/**
 * Convert natural language to a single shell command using an LLM.
 * Provider order: Gemini (GEMINI_API_KEY) → Anthropic (ANTHROPIC_API_KEY) → OpenAI (OPENAI_API_KEY).
 */

const SYSTEM_PROMPT = `You are a CLI assistant for managing a full AWS infrastructure from a single dashboard. The user will describe what they want to do in plain English; output exactly ONE shell command that accomplishes it on a Linux server with AWS CLI and Docker available.

Context: They manage everything on AWS from this dashboard — EC2, RDS, ElastiCache, S3, ECR, ALB, CloudWatch, ECS, Secrets Manager, IAM, Lambda, and related tooling (Docker, npm, etc.).

Rules:
- Output ONLY the raw command. No markdown, no code fences, no explanation.
- For anything AWS-related use the AWS CLI (aws): describe-*, list-*, get-*, start-instances, stop-instances, create-*, update-*, put-*, and other management commands for any AWS service. Include --region when relevant (e.g. ap-south-1).
- For containers use docker: ps, logs, images, inspect, start, stop, exec, etc.
- For local inspection use: tail, head, grep, cat, ls, pwd, env, whoami, date, hostname; for scripts npm run, npx.
- Never output: rm -rf, sudo, chmod 777, redirects to files (> file), curl -o, wget, ssh to another host, or command substitution. Do not suggest terminate-instances, delete-db-instance, or delete-db-cluster.
- If the request cannot be done with one command or is ambiguous, output: echo "Cannot convert to a single allowed command"
- Prefer aws over manual steps; one clear command per request.`;

export type InterpretResult = { command: string } | { error: string };

const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";

export async function interpretPromptToCommand(userPrompt: string): Promise<InterpretResult> {
  const prompt = userPrompt.trim();
  if (!prompt || prompt.length > 2000) {
    return { error: "Prompt is empty or too long" };
  }

  const geminiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
  if (geminiKey) return interpretWithGemini(geminiKey, prompt);

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (anthropicKey) return interpretWithAnthropic(anthropicKey, prompt);

  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey) return interpretWithOpenAI(openaiKey, prompt);

  return { error: "No AI API key configured (GEMINI_API_KEY, ANTHROPIC_API_KEY, or OPENAI_API_KEY)" };
}

async function interpretWithGemini(apiKey: string, userPrompt: string): Promise<InterpretResult> {
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: userPrompt }] }],
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        generationConfig: {
          maxOutputTokens: 256,
          temperature: 0.2,
        },
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return { error: `Gemini API error: ${res.status} ${err}` };
    }

    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
    const command = text.replace(/^```\w*\n?|```\s*$/g, "").trim();
    if (!command) return { error: "No command in response" };
    return { command };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Gemini request failed";
    return { error: message };
  }
}

async function interpretWithAnthropic(apiKey: string, userPrompt: string): Promise<InterpretResult> {
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-3-5-haiku-20241022",
        max_tokens: 256,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return { error: `Anthropic API error: ${res.status} ${err}` };
    }

    const data = (await res.json()) as {
      content?: { type: string; text?: string }[];
    };
    const text = data.content?.find((c) => c.type === "text")?.text?.trim() ?? "";
    const command = text.replace(/^```\w*\n?|```\s*$/g, "").trim();
    if (!command) return { error: "No command in response" };
    return { command };
  } catch (e) {
    const message = e instanceof Error ? e.message : "LLM request failed";
    return { error: message };
  }
}

async function interpretWithOpenAI(apiKey: string, userPrompt: string): Promise<InterpretResult> {
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_tokens: 256,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return { error: `OpenAI API error: ${res.status} ${err}` };
    }

    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const text = data.choices?.[0]?.message?.content?.trim() ?? "";
    const command = text.replace(/^```\w*\n?|```\s*$/g, "").trim();
    if (!command) return { error: "No command in response" };
    return { command };
  } catch (e) {
    const message = e instanceof Error ? e.message : "LLM request failed";
    return { error: message };
  }
}
