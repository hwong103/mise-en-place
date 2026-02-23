const stripNoscriptBlocks = (html: string) => html.replace(/<noscript[\s\S]*?<\/noscript>/gi, "");

const removeDuplicateWprmBlocks = (html: string) => {
  const blockRegex = /(<div[^>]+class=["'][^"']*wprm-recipe-container[^"']*["'][^>]*>[\s\S]*?<\/div>)/gi;
  const matches = html.match(blockRegex);
  if (!matches || matches.length <= 1) {
    return html;
  }

  return html.replace(blockRegex, (_, block: string, offset: number) => {
    const firstIndex = html.indexOf(block);
    return firstIndex === offset ? block : "";
  });
};

type AdapterResult = {
  html: string;
  adapter?: string;
};

const ADAPTERS: Array<{
  id: string;
  hostPattern: RegExp;
  run: (html: string) => string;
}> = [
  {
    id: "wprm-dedupe",
    hostPattern: /(^|\.)allrecipes\.com$|(^|\.)foodnetwork\.com$|(^|\.)pinchofyum\.com$/i,
    run: removeDuplicateWprmBlocks,
  },
  {
    id: "noscript-strip",
    hostPattern: /./,
    run: stripNoscriptBlocks,
  },
];

export const applyRecipeSiteAdapters = (sourceUrl: string, html: string): AdapterResult => {
  let hostname = "";

  try {
    hostname = new URL(sourceUrl).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return { html };
  }

  let nextHtml = html;
  const applied: string[] = [];

  for (const adapter of ADAPTERS) {
    if (!adapter.hostPattern.test(hostname)) {
      continue;
    }

    const transformed = adapter.run(nextHtml);
    if (transformed !== nextHtml) {
      nextHtml = transformed;
      applied.push(adapter.id);
    }
  }

  return {
    html: nextHtml,
    adapter: applied.length > 0 ? applied.join(",") : undefined,
  };
};
