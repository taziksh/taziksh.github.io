const EMBED = /!\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;

function imageUrl(target) {
  const filename = target.trim().split('/').pop();
  return `/notes/${filename.split(' ').map(encodeURIComponent).join('%20')}`;
}

function replaceEmbeds(node) {
  if (!Array.isArray(node.children)) return;

  node.children = node.children.flatMap((child) => {
    replaceEmbeds(child);
    if (child.type !== 'text' || !child.value.includes('![[')) return [child];

    const parts = [];
    let cursor = 0;
    for (const match of child.value.matchAll(EMBED)) {
      if (match.index > cursor) {
        parts.push({ type: 'text', value: child.value.slice(cursor, match.index) });
      }
      parts.push({
        type: 'image',
        url: imageUrl(match[1]),
        alt: (match[2] ?? match[1]).trim(),
      });
      cursor = match.index + match[0].length;
    }
    if (cursor < child.value.length) {
      parts.push({ type: 'text', value: child.value.slice(cursor) });
    }
    return parts.length ? parts : [child];
  });
}

export default function remarkObsidianImages() {
  return replaceEmbeds;
}
