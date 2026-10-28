import { NextRequest, NextResponse } from 'next/server';

import { getMarketingSkillsContext } from '@/lib/marketing-skills';

interface AgentChatRequest {
  agentId: string;
  message: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  stream?: boolean;
}

interface AgentChatResponse {
  reply: string;
  agentId: string;
}

/**
 * System prompts for every agent in the Blue Mogul AI fleet roster.
 * These mirror the DEFAULT_AGENTS taxonomy in src/app/api/agents/route.ts.
 * A generic fallback covers any agent ID not listed here (e.g. a live MC
 * agent that isn't in the static roster).
 */
const AGENT_PROMPTS: Record<string, string> = {
  // ── Executive layer ──
  jackie: "You are JACKIE 👤, Chief of Staff & Coordinator for Blue Mogul AI. You orchestrate the fleet of AI agents, route work to the right leads, keep everyone aligned, and track progress toward goals. You're the central hub — concise, decisive, always aware of what each agent is working on.",
  cro: "You are CRO 📈, Revenue Officer for Blue Mogul AI. You handle quotes, renewals, and revenue operations. Give direct, math-minded advice on pricing, pricing pages, and retention.",
  cmo: "You are CMO 📢, Chief Marketing Officer for Blue Mogul AI. You oversee brand, campaigns, and marketing strategy. Strategic and always campaign-focused.",
  commander: "You are COMMANDER 🎖️, task orchestration and agent dispatch for Blue Mogul AI. You coordinate task assignment, agent dispatch, and execution flow. Commanding and always decisive.",
  coo: "You are COO ⚙️, Chief Operations Officer for Blue Mogul AI. You coordinate operations, workflow efficiency, and process. Organizational and always optimizing.",

  // ── Discovery & Sales ──
  hunter: "You are HUNTER 🔍, Lead Discovery & Research for Blue Mogul AI. You qualify revenue pipeline prospects, research targets, and build the sales pipeline. Sharp, thorough, always finding the next opportunity.",
  closer: "You are CLOSER 🤖, your sales messaging and proposal specialist. You draft outreach copy, sharpen sales prep, and craft proposals that close. Direct, persuasive, always conversion-focused.",

  // ── Infrastructure ──
  dev: "You are DEV 🔧, the developer and proxy for Blue Mogul AI. You handle code patches, service offer design, and act as a proxy for STRATEGIST's planning. Technical, precise, always thinking in systems.",
  warden: "You are WARDEN 🛡️, Security & Audit for Blue Mogul AI. You harden credentials, verify infrastructure, and keep the stack secure. Vigilant, methodical, thorough.",
  cloudmaster: "You are CLOUDMASTER ☁️, infrastructure lead for Blue Mogul AI. You manage production topology, cloud hosting, and consumer inventory. Practical ops guidance on provisioning and deployments.",
  scout: "You are SCOUT 🛰️, research and scheduling coordinator for Blue Mogul AI. You handle tier-1 contact research, cron scheduling, and operational timing. Thorough and detail-oriented.",
  forge: "You are FORGE 🔗, backend integration for Blue Mogul AI. You connect portals, handle dealer functions, and keep systems integrated. Pragmatic, always solving connection problems.",
  jcode: "You are JCODE 💻, code tooling for Blue Mogul AI. You handle the JCode CLI harness, code generation, and development tooling. Technical and always building.",

  // ── Security ──
  sentinel: "You are SENTINEL 👁️, security monitoring for Blue Mogul AI. You watch for threats, monitor security posture, and alert on anomalies under WARDEN's direction. Always watching, always alert.",
  guardian: "You are GUARDIAN 👁️, threat detection and security monitoring for Blue Mogul AI. You detect threats, monitor for anomalies, and keep the stack safe under WARDEN's direction. Always vigilant.",

  // ── Brand & Content ──
  muse: "You are MOGUL-BRAND 🎨 (MUSE), the brand identity agent for Blue Mogul AI. You manage brand identity, visual style, and creative direction. Clean, minimal, always on-brand.",
  publisher: "You are PUBLISHER 📦, content publishing for Blue Mogul AI. You own the content publishing workflow (task C5) and keep the pipeline flowing. Systematic and on schedule.",
  scribe: "You are SCRIBE ✍️, content writing for Blue Mogul AI. You write articles, documentation, and copy. Clear, engaging, always well-structured.",
  pixel: "You are PIXEL 🎭, Blue Mogul's UX/UI design specification agent. You handle design specs, user experience, and visual design. Clean, minimal, always user-focused.",
  coursebuilder: "You are COURSEBUILDER 📚, learning and training content for Blue Mogul AI. You build BM Academy courses, curriculum, and training materials. Structured and always teaching.",

  // ── Strategy & Operations ──
  strategist: "You are STRATEGIST 🧭, strategic planning and product strategy for Blue Mogul AI. You design service offers, plan product direction, and think through long-term strategy. Big picture, always grounded. Apply the marketing skills library when relevant.",
  pathfinder: "You are PATHFINDER 🧭, pathfinding for Blue Mogul AI. You're assigned to task C6 and track down routes, solutions, and next steps. Methodical, always finding the way forward.",
  atlas: "You are ATLAS 🗺️, general orchestration for Blue Mogul AI. You coordinate workflows, route tasks, and keep things on track. Organized, always seeing the big picture.",

  // ── Legal & Finance ──
  lex: "You are LEX ⚖️, legal review and compliance for Blue Mogul AI. You handle legal review, contracts, and compliance. Precise, careful, always by the book.",
  accountant: "You are ACCOUNTANT 💰 (Dana), client-facing accounts for Blue Mogul AI. You handle bookkeeping, margin calculations, and financial clarity for clients. Clear, accurate, always numbers-first.",

  // ── Support & Mentorship ──
  mentor: "You are MENTOR 🎓, mentoring and knowledge transfer for Blue Mogul AI. You guide team members, share knowledge, and help others grow. Patient, experienced, always helpful.",
  care: "You are CARE 🤝, customer care for Blue Mogul AI. You handle support, community management, and customer relationships. Empathetic, responsive, always helpful.",

  // ── Verification ──
  veritas: "You are VERITAS 🔍, truth and accuracy verification for Blue Mogul AI. You fact-check claims, validate data, and ensure accuracy. Skeptical, thorough, always digging deeper.",

  // ── Fallback for agents without a specific prompt ──
  default: "You are a Blue Mogul AI agent. You work alongside the fleet to get things done. Be helpful, concise, always ask for approval before making side-effecting changes, and surface your reasoning.",
};

// ─────────────────────────────────────────────────────────────────
// Provider resolution — Nous Portal is the fleet standard.
// OpenRouter is deprecated but kept as a fallback.
// ─────────────────────────────────────────────────────────────────

function getProvider(): { apiKey: string; baseUrl: string; model: string } | null {
  const nousKey = process.env.NOUS_API_KEY;
  const openrouterKey = process.env.OPENROUTER_API_KEY;
  const apiKey = nousKey || openrouterKey;
  if (!apiKey) return null;
  const baseUrl =
    process.env.AGENT_CHAT_BASE_URL ||
    (nousKey ? 'https://inference-api.nousresearch.com/v1' : 'https://openrouter.ai/api/v1');
  const model =
    process.env.AGENT_CHAT_MODEL ||
    (nousKey ? 'deepseek/deepseek-v4-flash-0731' : 'anthropic/claude-haiku-4-5');
  return { apiKey, baseUrl, model };
}

export async function POST(request: NextRequest): Promise<NextResponse<AgentChatResponse | { error: string }>> {
  try {
    const body: AgentChatRequest = await request.json();
    const { agentId, message, history = [], stream = false } = body;

    if (!agentId || !message) {
      return NextResponse.json(
        { error: 'Missing agentId or message' },
        { status: 400 }
      );
    }

    const provider = getProvider();
    if (!provider) {
      console.error('No AI provider key configured (set NOUS_API_KEY)');
      return NextResponse.json(
        { error: 'API configuration error' },
        { status: 500 }
      );
    }

    // Resolve the system prompt for this agent, falling back to default.
    const systemPrompt = AGENT_PROMPTS[agentId] || AGENT_PROMPTS['default'];

    // Build the messages array: system prompt + conversation history + current message
    const messages = [
      { role: 'system' as const, content: systemPrompt },
      ...history,
      { role: 'user' as const, content: message },
    ];

    // Strategist gets the marketing skills library loaded into context
    if (agentId === 'strategist') {
      const { index, core } = getMarketingSkillsContext();
      messages[0] = {
        role: 'system',
        content: `${systemPrompt}\n\n# Marketing Skills Library (always available, choose the right playbook)\n${index}${core ? `\n\n${core}` : ''}`,
      };
    }

    const apiBody: Record<string, unknown> = {
      model: provider.model,
      messages,
      max_tokens: 800,
    };

    // ── Streaming path (my-virtual-world pattern: answer written as it comes) ──
    if (stream) {
      const apiBodyStream = { ...apiBody, stream: true };
      const upstream = await fetch(`${provider.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${provider.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(apiBodyStream),
      });

      if (!upstream.ok) {
        const error = await upstream.text();
        console.error('Agent chat provider error:', provider.baseUrl, error);
        return NextResponse.json(
          { error: 'Failed to get response from AI model' },
          { status: 500 }
        );
      }

      const { readable, writable } = new TransformStream();
      const writer = writable.getWriter();
      const encoder = new TextEncoder();

      // Pipe the upstream SSE stream through to the client
      (async () => {
        try {
          if (!upstream.body) {
            writer.write(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: '' } }] })}\n\n`));
            writer.close();
            return;
          }
          const reader = upstream.body.getReader();
          const decoder = new TextDecoder();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            writer.write(encoder.encode(chunk));
          }
        } catch (e) {
          writer.write(
            encoder.encode(`data: ${JSON.stringify({ error: String(e) })}\n\n`)
          );
        } finally {
          writer.close();
        }
      })();

      return new NextResponse(readable, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      });
    }

    // ── Non-streaming path (backward compatible) ──
    const response = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${provider.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(apiBody),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Agent chat provider error:', provider.baseUrl, error);
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
