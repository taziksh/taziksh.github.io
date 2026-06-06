const SELF = 'tazik.sh';
const cache = new Map();

async function hasFavicon(hostname) {
  if (cache.has(hostname)) return cache.get(hostname);
  let ok = false;
  try {
    const res = await fetch(`https://icons.duckduckgo.com/ip3/${hostname}.ico`);
    ok = res.ok;
  } catch {}
  cache.set(hostname, ok);
  return ok;
}

function collect(node, out) {
  if (
    node.tagName === 'a' &&
    node.properties &&
    typeof node.properties.href === 'string' &&
    /^https?:\/\//.test(node.properties.href)
  ) {
    try {
      const { hostname } = new URL(node.properties.href);
      if (hostname !== SELF && !hostname.endsWith('.' + SELF)) {
        out.push({ node, hostname });
      }
    } catch {}
  }
  if (Array.isArray(node.children)) {
    for (const child of node.children) collect(child, out);
  }
}

export default function rehypeLinkFavicons() {
  return async (tree) => {
    const targets = [];
    collect(tree, targets);
    await Promise.all(
      targets.map(async ({ node, hostname }) => {
        if (!(await hasFavicon(hostname))) return;
        node.children.push({
          type: 'element',
          tagName: 'img',
          properties: {
            src: `https://icons.duckduckgo.com/ip3/${hostname}.ico`,
            alt: '',
            className: ['link-favicon'],
            loading: 'lazy',
            decoding: 'async',
          },
          children: [],
        });
      })
    );
  };
}
