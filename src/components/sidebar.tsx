"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { signOut } from "next-auth/react";
import {
  Home,
  Bot,
  ClipboardList,
  HeartPulse,
  Cpu,
  BookOpen,
  Menu,
  X,
  Target,
  Kanban,
  Sparkles,
  Boxes,
  Users,
  Wallet,
  Activity,
  Briefcase,
  MessagesSquare,
  LayoutDashboard,
  Gauge,
  ExternalLink,
  Terminal,
  ShieldCheck,
  Settings,
  Mail,
  Video,
  Mic,
  Timer,
  LogOut,
  Globe,
  Database,
  Calendar,
  UserCheck,
  Building,
  Search,
} from "lucide-react";

const navGroups = [
  {
    name: "Operate",
    items: [
      { href: "/", label: "Dashboard", icon: Home },
      { href: "/hermes", label: "Agent", icon: Cpu },
      { href: "/talk", label: "Chat", icon: MessagesSquare },
      { href: "/tasks", label: "Tasks", icon: ClipboardList },
      { href: "/terminal", label: "Terminal", icon: Terminal },
      { href: "/quality", label: "Quality Gate", icon: ShieldCheck },
      { href: "/goals", label: "Kanban", icon: Kanban },
      { href: "/projects", label: "Projects", icon: Target },
    ],
  },
  {
    name: "Setup",
    items: [
      { href: "/skills", label: "Skills", icon: Sparkles },
      { href: "/workspaces", label: "Workspaces", icon: Briefcase },
      { href: "/artifacts", label: "Artifacts", icon: Boxes },
      { href: "/models", label: "Models", icon: Database },
      { href: "/providers", label: "Providers", icon: Building },
      { href: "/mcp", label: "Tools", icon: Sparkles },
      { href: "/gateways", label: "Gateway", icon: Gauge },
      { href: "/settings", label: "Settings", icon: Settings },
    ],
  },
  {
    name: "Discover",
    items: [
      { href: "/discover", label: "Discover", icon: Search },
      { href: "/schedules", label: "Schedules", icon: Calendar },
    ],
  },
  {
    name: "Company",
    items: [
      { href: "/org", label: "Org", icon: Users },
      { href: "/agents", label: "Profiles", icon: UserCheck },
      { href: "/persona", label: "Persona", icon: Bot },
      { href: "/office", label: "Office", icon: Building },
      { href: "/cost", label: "Cost", icon: Wallet },
      { href: "/activity", label: "Activity", icon: Activity },
    ],
  },
  {
    name: "Business",
    items: [
      { href: "/client-pulse", label: "Client Pulse", icon: HeartPulse },
      { href: "/email", label: "Email Inbox", icon: Mail },
      { href: "/memory-wiki", label: "Memory Wiki", icon: BookOpen },
    ],
  },
  {
    name: "Creative",
    items: [
      { href: "/video", label: "Video Generator", icon: Video },
      { href: "/productivity", label: "Productivity", icon: Timer },
    ],
  },
  {
    // Peer surfaces — separate apps in the Blue Mogul stack.
    name: "Peers",
    external: true,
    items: [
      { href: "https://portal.bluemogul.us", label: "Portal", icon: Globe },
      { href: "https://bluemogul.us", label: "Blue Mogul", icon: Globe },
      { href: "https://mission-control.bluemogul.us", label: "Mission Control", icon: Gauge },
      { href: "https://hermes.bluemogul.us", label: "Hermes Dashboard", icon: LayoutDashboard },
    ],
  },
];

// Mobile tab bar - only show the most important
const mobileTabsRaw = [
  { href: "/", label: "Dashboard", icon: Home },
  { href: "/hermes", label: "Agent", icon: Cpu },
  { href: "/talk", label: "Chat", icon: MessagesSquare },
  { href: "/tasks", label: "Tasks", icon: ClipboardList },
  { href: "/terminal", label: "Terminal", icon: Terminal },
  { href: "/goals", label: "Kanban", icon: Kanban },
];

export function Sidebar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  // Close sidebar on route change (mobile)
  useEffect(() => {
    const frame = requestAnimationFrame(() => setIsOpen(false));
    return () => cancelAnimationFrame(frame);
  }, [pathname]);

  // Close sidebar when resizing to desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) setIsOpen(false);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const Logo = () => (
    <div className="flex items-center gap-2.5">
      <div className="w-8 h-8 rounded-[10px] bg-[var(--text)] flex items-center justify-center shadow-[inset_0_1px_0_rgba(255,255,255,0.4)]">
        <span className="text-[#0a0b0d] font-bold text-[13px] tracking-tight">H</span>
      </div>
      <span className="font-semibold text-[var(--text)] tracking-[-0.01em] text-[15px]">Blue Mogul AI</span>
    </div>
  );

  return (
    <>
      {/* Mobile header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-[var(--bg)]/90 backdrop-blur-xl border-b border-[var(--line)] px-4 py-3 flex items-center justify-between">
        <Logo />
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="p-2 text-[var(--text-2)] hover:text-[var(--text)] transition-colors rounded-lg hover:bg-[var(--surface-1)]"
          aria-label="Toggle menu"
        >
          {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile bottom tab bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[var(--bg)]/90 backdrop-blur-xl border-t border-[var(--line)] px-2 py-2 safe-area-pb">
        <nav className="flex justify-around">
          {mobileTabsRaw.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center gap-1 p-2 px-3 rounded-lg transition-all ${
                  isActive
                    ? "text-[var(--text)] bg-[var(--surface-2)]"
                    : "text-[var(--text-3)] hover:text-[var(--text-2)] active:scale-95"
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[10px] font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/60 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Desktop Sidebar */}
      <aside
        className={`
          fixed md:relative z-50 md:z-10
          w-64 md:w-[15rem] h-full
          bg-[var(--bg)] md:bg-transparent border-r border-[var(--line)]
          flex flex-col
          transition-transform duration-300 ease-in-out
          ${isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
          top-0 left-0
        `}
      >
        {/* Logo */}
        <div className="hidden md:block px-5 pt-6 pb-8">
          <Logo />
        </div>

        {/* Spacer for mobile header */}
        <div className="h-16 md:hidden" />

        {/* Nav */}
        <nav className="flex-1 px-3 overflow-y-auto">
          <div className="space-y-5">
            {navGroups.map((group) => (
              <div key={group.name}>
                <h3 className="eyebrow px-3 mb-1.5 !text-[10px] !text-[var(--text-4)]">
                  {group.name}
                </h3>
                <div className="space-y-0.5">
                  {group.items.map((item) => {
                    const isExternal = item.href.startsWith("http");
                    const isActive =
                      !isExternal &&
                      (pathname === item.href || pathname.startsWith(item.href + "/"));
                    const Icon = item.icon;
                    const itemClass = `group relative flex items-center gap-3 px-3 py-[7px] rounded-[10px] transition-all duration-150 ${
                      isActive
                        ? "bg-[var(--surface-2)] text-[var(--text)]"
                        : "text-[var(--text-2)] hover:text-[var(--text)] hover:bg-[var(--surface-1)]"
                    }`;
                    const inner = (
                      <>
                        {isActive && (
                          <span className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-[2px] rounded-full bg-[var(--accent)]" />
                        )}
                        <Icon
                          className={`w-[17px] h-[17px] shrink-0 ${
                            isActive ? "text-[var(--text)]" : "text-[var(--text-3)] group-hover:text-[var(--text-2)]"
                          }`}
                        />
                        <span className="text-[13.5px] font-medium">{item.label}</span>
                        {isExternal && (
                          <ExternalLink className="w-[12px] h-[12px] ml-auto shrink-0 text-[var(--text-4)] opacity-0 group-hover:opacity-100 transition-opacity" />
                        )}
                      </>
                    );
                    return (
                      <div key={item.href}>
                        {isExternal ? (
                          <a href={item.href} target="_blank" rel="noopener noreferrer" className={itemClass}>
                            {inner}
                          </a>
                        ) : (
                          <Link href={item.href} className={itemClass}>
                            {inner}
                          </Link>
                        )}
                        {"anchors" in group &&
                          isActive &&
                          (group as { anchors?: { href: string; label: string }[] }).anchors && (
                            <div className="ml-[26px] mt-0.5 space-y-0.5 border-l border-[var(--line)] pl-3">
                              {(group as { anchors: { href: string; label: string }[] }).anchors.map(
                                (a) => (
                                  <a
                                    key={a.href}
                                    href={a.href}
                                    className="block text-[12px] text-[var(--text-3)] hover:text-[var(--text-2)] py-1 transition-colors"
                                  >
                                    {a.label}
                                  </a>
                                )
                              )}
                            </div>
                          )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </nav>

        {/* Footer */}
        <div className="px-4 py-4 border-t border-[var(--line)]">
          <div className="flex items-center gap-2 text-[var(--text-3)] text-[11.5px] mb-2">
            <span className="relative flex w-1.5 h-1.5">
              <span className="absolute inline-flex h-full w-full rounded-full bg-[var(--up)] opacity-60 animate-ping" />
              <span className="relative inline-flex w-1.5 h-1.5 rounded-full bg-[var(--up)]" />
            </span>
            <span className="hidden md:inline">All systems online</span>
          </div>
          <button
            onClick={() => signOut()}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-[12px] font-medium text-[var(--text-2)] hover:text-[var(--text)] hover:bg-[var(--surface-1)] rounded-[8px] transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign out
          </button>
        </div>
      </aside>
    </>
  );
}
