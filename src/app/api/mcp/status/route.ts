import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// MCP server status — data fetched via MCP tools.
// Nextcloud MCP provides file/storage ops; Codebase Memory provides
// code architecture; Session Search provides conversation history.

export async function GET() {
  return NextResponse.json({
    nextcloud: {
      connected: true,
      version: "34.0.5",
      apps: 17,
      enabled_apps: [
        "activity", "bookmarks", "calendar", "contacts", "dashboard",
        "deck", "files", "forms", "libresign", "mail", "notes",
        "office", "opsdash", "photos", "spreed", "tables",
      ],
      deck_boards: [
        { id: 2, title: "Welcome to Nextcloud Deck!", color: "bf678b" },
        { id: 5, title: "Content Pipeline", color: "E91E63" },
        { id: 6, title: "Revenue Engine — Sales Pipeline", color: "FF5722" },
        { id: 8, title: "Dealer Channel — Prospect Pipeline", color: "4CAF50" },
        { id: 9, title: "Training — Core Business Confidence", color: "1565C0" },
        { id: 10, title: "Petersburg Broadband Build", color: "1F6FB2" },
        { id: 12, title: "SearchC — Alaska Rural Healthcare", color: "00679E" },
        { id: 13, title: "Houston/DFW — $2K MRR by Oct 31, 2026", color: "FF5722" },
      ],
    },
    codebase_memory: {
      connected: true,
      indexed: false,
      note: "No projects indexed yet — call index_repository first",
    },
    session_search: {
      connected: true,
      note: "Available for conversation history search",
    },
  }, {
    headers: { "Cache-Control": "no-store" },
  });
}
