import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const DATASTORE_KEY = "mcp_servers";

interface McpServer {
  id: string;
  name: string;
  type: "stdio" | "http" | "sse";
  command?: string;
  url?: string;
  env?: Record<string, string>;
  enabled: boolean;
}

// GET — list all MCP servers
export async function GET() {
  try {
    const row = await prisma.dataStore.findUnique({
      where: { key: DATASTORE_KEY },
    });
    const servers = (row?.data as unknown as McpServer[]) || [];
    return NextResponse.json(servers);
  } catch {
    return NextResponse.json([]);
  }
}

// POST — add a new MCP server
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, type, command, url, env } = body;
    if (!name || !type) {
      return NextResponse.json({ error: "name and type required" }, { status: 400 });
    }

    const row = await prisma.dataStore.findUnique({
      where: { key: DATASTORE_KEY },
    });
    const servers: McpServer[] = (row?.data as unknown as McpServer[]) || [];

    const newServer: McpServer = {
      id: crypto.randomUUID(),
      name,
      type: type as "stdio" | "http" | "sse",
      command: command || undefined,
      url: url || undefined,
      env: env || undefined,
      enabled: true,
    };

    servers.push(newServer);

    await prisma.dataStore.upsert({
      where: { key: DATASTORE_KEY },
      create: { key: DATASTORE_KEY, data: servers as any },
      update: { data: servers as any },
    });

    return NextResponse.json(newServer, { status: 201 });
  } catch {
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}

// DELETE /api/mcp?id=xxx — remove an MCP server
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }

    const row = await prisma.dataStore.findUnique({
      where: { key: DATASTORE_KEY },
    });
    const servers: McpServer[] = (row?.data as unknown as McpServer[]) || [];
    const filtered = servers.filter((s) => s.id !== id);

    await prisma.dataStore.upsert({
      where: { key: DATASTORE_KEY },
      create: { key: DATASTORE_KEY, data: filtered as any },
      update: { data: filtered as any },
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
