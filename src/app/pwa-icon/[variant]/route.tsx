// PNG icons referenced by the web app manifest. Prerendered at build time.
import { appIcon } from "@/lib/app-icon";

const VARIANTS = {
  "192": { px: 192, safe: false },
  "512": { px: 512, safe: false },
  "maskable-512": { px: 512, safe: true },
} as const;

export function generateStaticParams() {
  return Object.keys(VARIANTS).map((variant) => ({ variant }));
}

export async function GET(_request: Request, ctx: RouteContext<"/pwa-icon/[variant]">) {
  const v = VARIANTS[(await ctx.params).variant as keyof typeof VARIANTS];
  if (!v) return new Response("Not found", { status: 404 });
  return appIcon(v.px, { safe: v.safe });
}
