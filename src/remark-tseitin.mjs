import katex from 'katex';

// Keep the note as ordinary Markdown for Obsidian; add interaction only on the site.
export default function remarkTseitin() {
  return (tree, file) => {
    if (!file.path?.endsWith('/Tseitin transformation.md')) return;
    const wrap = (index, expression) => `\\htmlClass{tseitin-expression-${index}}{${expression}}`;
    const original = String.raw`((x_1 \lor x_2) \Leftrightarrow x_3) \Rightarrow (\lnot x_4)`;
    const markedOriginal = wrap(4,
      wrap(2, `(${wrap(1, String.raw`(x_1 \lor x_2)`)} \\Leftrightarrow x_3)`) +
      String.raw` \Rightarrow ` + wrap(3, String.raw`(\lnot x_4)`));
    function visit(node) {
      if (node.type === 'math') {
        const definition = node.value.match(/^y_([1-4])\s/);
        const tex = node.value.replace(original, markedOriginal)
          .replace(/y_([1-4])\b/g, (_, index) => `\\htmlClass{tseitin-term tseitin-y${index}}{y_${index}}`);
        const html = katex.renderToString(tex, {
          displayMode: true,
          throwOnError: true,
          strict: false,
          trust: context => context.command === '\\htmlClass',
        });
        node.type = 'html';
        node.value = `<div class="tseitin-equation${definition ? ` tseitin-definition-${definition[1]}` : ''}">${html}</div>`;
        delete node.data;
      }
      node.children?.forEach(visit);
    }
    tree.children = tree.children.flatMap(node => {
      if (node.type !== 'math') return [node];
      if (/^y_1\s/.test(node.value)) return [{ type: 'html', value: '<div class="tseitin-definitions">' }, node];
      if (/^y_4\s/.test(node.value)) return [node, { type: 'html', value: '</div>' }];
      return [node];
    });
    visit(tree);
    tree.children.unshift({ type: 'html', value: '<link rel="stylesheet" href="/tseitin.css">' });
  };
}
