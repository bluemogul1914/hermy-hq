import { NextRequest, NextResponse } from 'next/server';

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
    const apiKey = process.env.OPENROUTER_API_KEY;

    if (!apiKey) {
      console.error('OPENROUTER_API_KEY not configured');
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

    // Call OpenRouter API
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://your-app.vercel.app',
      },
      body: JSON.stringify({
        model: 'anthropic/claude-haiku-4-5',
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages,
        ],
        max_tokens: 800,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('OpenRouter API error:', error);
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
