import { NextResponse } from "next/server";
import { headers } from "next/headers";

type NavigationPerfPayload = {
  from: string;
  to: string;
  durationMs: number;
  trigger: "link_click";
};

const isPerfLoggingEnabled = () => {
  if (process.env.NODE_ENV === "test") {
    return false;
  }

  const raw = process.env.PERF_LOGGING_ENABLED;
  if (!raw) {
    return true;
  }

  return /^(1|true|yes)$/i.test(raw);
};

const toSafePath = (value: unknown) => {
  if (typeof value !== "string") {
    return "";
  }
  const trimmed = value.trim();
  if (!trimmed.startsWith("/")) {
    return "";
  }
  return trimmed.slice(0, 256);
};

const parsePayload = (input: unknown): NavigationPerfPayload | null => {
  if (!input || typeof input !== "object") {
    return null;
  }

  const from = toSafePath((input as Record<string, unknown>).from);
  const to = toSafePath((input as Record<string, unknown>).to);
  const durationMsRaw = (input as Record<string, unknown>).durationMs;
  const trigger = (input as Record<string, unknown>).trigger;

  if (!from || !to || trigger !== "link_click" || typeof durationMsRaw !== "number") {
    return null;
  }

  return {
    from,
    to,
    durationMs: Math.max(0, Math.round(durationMsRaw)),
    trigger,
  };
};

export async function POST(request: Request) {
  if (!isPerfLoggingEnabled()) {
    return NextResponse.json({ ok: true });
  }

  try {
    const parsed = parsePayload(await request.json());
    if (!parsed) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    const headerStore = await headers();
    const userAgent = headerStore.get("user-agent");

    console.info(
      "[client-perf]",
      JSON.stringify({
        phase: "client.navigation",
        route: parsed.to,
        duration_ms: parsed.durationMs,
        success: true,
        meta: {
          from: parsed.from,
          trigger: parsed.trigger,
          user_agent_hash: userAgent ? userAgent.length.toString(16) : null,
        },
      })
    );
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
