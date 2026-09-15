import { NextRequest, NextResponse } from 'next/server';

import { getMarketingSkillsContext } from '@/lib/marketing-skills';

interface AgentChatRequest {
  agentId: string;
  message: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

interface AgentChatResponse {
  reply: string;
  agentId: string;
}

const AGENT_PROMPTS: Record<string, string> = {
  aria: "You are Aria 🧑, CEO / Chief Executive of Blue Mogul AI. Owners run a managed-IT services firm (cloud hosting, deployments, client delivery, sales/revenue) through a hierarchical team. Give sharp, strategic, concise exec advice on the business — org, budget, routing work to the right leads.",
  "cto-orion": "You are CTO Orion 💻, Chief Technology Officer responsible for infrastructure, cloud ops and the tech stack at Blue Mogul AI. Answer with concrete, technical guidance on infra, deployments, hosting reliability and stack decisions.",
  cloudmaster: "You are CLOUDMASTER ☁️, Managed IT lead for cloud hosting and deployments. Give practical ops guidance on provisioning, hosting, and pushing deployments for client environments.",
  foreman: "You are FOREMAN 📋, Project / delivery lead at Blue Mogul AI. Help with ticket triage, project scoping, priority and client delivery plans. Be organized and concise.",
  morgan: "You are Morgan 💰, Sales lead for Blue Mogul AI. Help build pipeline, write proposals, think through ARR, and qualify deals. Be sharp and commercial.",
  cro: "You are CRO 📈, Revenue lead for Blue Mogul AI. Handle quotes, renewals and revenue operations. Give direct math-minded advice on pricing and retention.",
  dealer: "You are DEALER 📝, Deal desk lead for Blue Mogul AI. Help draft proposals and assist with procurement. Be accurate and practical.",
};

export async function POST(request: NextRequest): Promise<NextResponse<AgentChatResponse | { error: string }>> {
  try {
    const body: AgentChatRequest = await request.json();
    const { agentId, message, history = [] } = body;

    // Validate inputs
    if (!agentId || !message) {
      return NextResponse.json(
        { error: 'Missing agentId or message' },
        { status: 400 }
      );
    }

    if (!AGENT_PROMPTS[agentId]) {
      return NextResponse.json(
        { error: `Unknown agent: ${agentId}` },
        { status: 400 }
      );
    }

    const systemPrompt = AGENT_PROMPTS[agentId];
    // Provider: Nous Portal (OpenAI-compatible) is the fleet standard.
    // OpenRouter is deprecated — kept only as a fallback if no Nous key is set.
    const nousKey = process.env.NOUS_API_KEY;
    const openrouterKey = process.env.OPENROUTER_API_KEY;
    const apiKey = nousKey || openrouterKey;
    const baseUrl =
      process.env.AGENT_CHAT_BASE_URL ||
      (nousKey ? "https://inference-api.nousresearch.com/v1" : "https://openrouter.ai/api/v1");
    const model =
      process.env.AGENT_CHAT_MODEL ||
      (nousKey ? "deepseek/deepseek-v4-flash-0731" : "anthropic/claude-haiku-4-5");

    // Morgan (Sales) gets the marketing skills library loaded into context so it
    // can apply real marketing/sales playbooks (pipeline, proposals, ARR, pricing).
    let enrichedPrompt = systemPrompt;
    if (agentId === "morgan") {
      const { index, core } = getMarketingSkillsContext();
      enrichedPrompt = `${systemPrompt}\n\n# Marketing Skills Library (always available, choose the right playbook)\n${index}${core ? `\n\n${core}` : ""}`;
    }

    if (!apiKey) {
      console.error('No AI provider key configured (set NOUS_API_KEY)');
      return NextResponse.json(
        { error: 'API configuration error' },
        { status: 500 }
      );
    }

    // Build messages array: system prompt + history + current message
    const messages = [
      ...history,
      { role: 'user' as const, content: message },
    ];

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: enrichedPrompt },
          ...messages,
        ],
        max_tokens: 800,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Agent chat provider error:', baseUrl, error);
      return NextResponse.json(
        { error: 'Failed to get response from AI model' },
        { status: 500 }
      );
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || '';

    if (!reply) {
      return NextResponse.json(
        { error: 'No response from AI model' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      reply,
      agentId,
    });
  } catch (error) {
    console.error('Agent chat error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
