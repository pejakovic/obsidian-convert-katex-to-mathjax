import { App, Notice, Plugin, PluginSettingTab, Setting } from "obsidian";

interface Katex2MathjaxConverterSettings {
  enableDefaultPasteConversion: boolean;
  wrapMatrixEnvsInDisplayMath: boolean;
  plainParensAsDelimiters: boolean;
  plainBracketsAsDelimiters: boolean;
  convertBareInlineLatex: boolean;
  wrapBareMathSingleLines: boolean;
}

const DEFAULT_SETTINGS: Katex2MathjaxConverterSettings = {
  enableDefaultPasteConversion: true,
  wrapMatrixEnvsInDisplayMath: true,
  plainParensAsDelimiters: false,
  plainBracketsAsDelimiters: false,
  convertBareInlineLatex: false,
  wrapBareMathSingleLines: false,
};

type ConvertOptions = {
  wrapMatrixEnvsInDisplayMath: boolean;
  plainParensAsDelimiters: boolean;
  plainBracketsAsDelimiters: boolean;
  convertBareInlineLatex: boolean;
  wrapBareMathSingleLines: boolean;
};


export default class Katex2MathJaxConverterPlugin extends Plugin {
  settings: Katex2MathjaxConverterSettings;

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  async onload() {
    await this.loadSettings();
    this.addSettingTab(new Katex2MathJaxConverterSettingTab(this.app, this));

    // Default paste conversion.
    this.registerEvent(
      this.app.workspace.on("editor-paste", async (evt, editor) => {
        const clipboardText = evt.clipboardData?.getData("text") || "";
        const trimmed = clipboardText.trim();

        // Skip raw URL or Markdown link blobs:
        const isRawUrl = /^https?:\/\/\S+$/.test(trimmed);
        const isMarkdownLink = /^\[.*?\]\(.*?\)$/.test(trimmed);
        const isCombined = /^https?:\/\/[^\s\[]+\[.*?\]\(.*?\)/.test(trimmed);
        if (isRawUrl || isMarkdownLink || isCombined) return;

        if (this.settings.enableDefaultPasteConversion && clipboardText) {
          evt.preventDefault();
          const convertedText = convertKatexToMathJax(
            clipboardText,
            this.settings
          );
          editor.replaceSelection(convertedText);
        }
      })
    );

    this.addCommand({
      id: "paste-katex-to-mathjax",
      name: "Paste with conversion",
      editorCallback: (editor) => {
        navigator.clipboard.readText().then((clipboardText) => {
          const convertedText = convertKatexToMathJax(
            clipboardText,
            this.settings
          );
          editor.replaceSelection(convertedText);
        });
      },
    });

    this.addCommand({
      id: "convert-editor-text-from",
      name: "Convert current text file",
      editorCallback: (editor) => {
        const currentText = editor.getValue();
        const convertedText = convertKatexToMathJax(
          currentText,
          this.settings
        );
        editor.setValue(convertedText);
      },
    });

    this.addCommand({
      id: "convert-all-files-from",
      name: "Convert all files",
      callback: async () => {
        const files = this.app.vault.getMarkdownFiles();
        for (const file of files) {
          const content = await this.app.vault.read(file);
          const convertedContent = convertKatexToMathJax(
            content,
            this.settings
          );
          await this.app.vault.modify(file, convertedContent);
        }
        new Notice("All Markdown files converted to MathJax-friendly math.");
      },
    });
  }
}

/** Top-level conversion: safe around code fences and links. */
function convertKatexToMathJax(input: string, opts: ConvertOptions): string {
  const trimmed = input.trim();
  const isRawUrl = /^https?:\/\/\S+$/.test(trimmed);
  const isMarkdownLink = /^\[.*?\]\(.*?\)$/.test(trimmed);
  const isCombined = /^https?:\/\/[^\s\[]+\[.*?\]\(.*?\)/.test(trimmed);
  if (isRawUrl || isMarkdownLink || isCombined) return input;

  // 1) Split by fenced code blocks
  const codeFenceRegex = /```[\s\S]*?```/g;
  const segments: string[] = [];
  let last = 0;
  let m: RegExpExecArray | null;

  while ((m = codeFenceRegex.exec(input)) !== null) {
    if (m.index > last) {
      segments.push(processOutsideCode(input.slice(last, m.index), opts));
    }
    segments.push(m[0]);
    last = m.index + m[0].length;
  }
  if (last < input.length) {
    segments.push(processOutsideCode(input.slice(last), opts));
  }

  return trimEmptyLinesAroundBlockMath(segments.join(""));
}

/** Process non-code text: preserve URLs; process math elsewhere. */
function processOutsideCode(text: string, opts: ConvertOptions): string {
  const urlRegex = /https?:\/\/[^\s)]+/g;
  const out: string[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(urlRegex)) {
    if (match.index! > lastIndex) {
      out.push(processMath(text.slice(lastIndex, match.index!), opts));
    }
    out.push(match[0]);
    lastIndex = match.index! + match[0].length;
  }
  if (lastIndex < text.length) {
    out.push(processMath(text.slice(lastIndex), opts));
  }
  return out.join("");
}

/** Core math processing. */
function processMath(text: string, opts: ConvertOptions): string {
  // 1) KaTeX \(...\), \[...\]    (unchanged)
  text = text.replace(/\\\((.*?)\\\)/g, (_m, p1) => `$${p1.trim()}$`);
  text = text.replace(/\\\[(.*?)\\\]/gs, (_m, p1) => `\n$$\n${p1.trim()}\n$$\n`);

  // 2) Multiline [\n … \n] -> $$ … $$  (unchanged)
  text = text.replace(
    /(^|\n)[ \t]*\[[ \t]*\n([\s\S]*?)\n[ \t]*\][ \t]*(?=\n|$)/g,
    (_m, lead, body) => `${lead}$$\n${body.trim()}\n$$`
  );

  // 3) Wrap bare matrix/align envs
  if (opts.wrapMatrixEnvsInDisplayMath) {
    text = text.replace(
      /(^|\n)([ \t]*)\\begin\{(bmatrix|pmatrix|vmatrix|Vmatrix|matrix|smallmatrix|cases|array|align|aligned)\}([\s\S]*?)\\end\{\3\}/g,
      (_m, lead, indent, env, body) => `${lead}$$\n${indent}\\begin{${env}}${body}\\end{${env}}\n$$`
    );
  }

  // 4) FIRST: make display blocks from mathy lines (outside $$ only)
  if (opts.wrapBareMathSingleLines) {
    text = wrapBareMathLinesOutside(text);
  }

  // 5) THEN: do *inline* conversions, but only outside $$…$$
  text = applyOutsideDisplay(text, seg => convertInlineDelims(seg, opts));

  if (opts.convertBareInlineLatex) {
    text = applyOutsideDisplay(text, seg => wrapInlineBareLatex(seg));
  }

  return text;
}
// Uses options to decide which plain delimiters to process.
function convertInlineDelims(text: string, opts: ConvertOptions): string {
  if (opts.plainParensAsDelimiters) {
    text = convertOutermostInline(text, "(", ")", isSafeParens, opts);
  }
  if (opts.plainBracketsAsDelimiters) {
    text = convertOutermostInline(text, "[", "]", isSafeBrackets, opts);
  }
  return text;
}

// Accepts opts for API consistency (not used internally yet).
function convertOutermostInline(
  text: string,
  openCh: "(" | "[",
  closeCh: ")" | "]",
  guard: (content: string, before: string, after: string, match: string) => boolean,
  _opts?: ConvertOptions
): string {
  let out = "";
  let lastEmit = 0;
  let depth = 0;
  let start = -1;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (ch === openCh) {
      if (depth === 0) start = i;
      depth++;
    } else if (ch === closeCh && depth > 0) {
      depth--;
      if (depth === 0 && start >= 0) {
        const original = text.slice(start, i + 1);
        const inner = text.slice(start + 1, i);
        const trimmed = inner.trim();

        const beforeCtx = text.slice(Math.max(0, start - 60), start);
        const afterCtx = text.slice(i + 1, Math.min(text.length, i + 1 + 60));

        const replaceWithMath = guard(trimmed, beforeCtx, afterCtx, original);
        const replacement = replaceWithMath ? `$${trimmed}$` : original;

        out += text.slice(lastEmit, start) + replacement;
        lastEmit = i + 1;
        start = -1;
      }
    }
  }
  if (lastEmit < text.length) out += text.slice(lastEmit);
  return out;
}

/** Segment text into outside/inside-$$ parts using a state machine (handles line-delimited $$, spaces). */
/** Robustly segment text by display-math regions, treating $$ lines as inside too. */
function segmentByDisplayMath(text: string): Array<{ inside: boolean; chunk: string }> {
  const parts: Array<{ inside: boolean; chunk: string }> = [];
  let i = 0;
  let start = 0;
  let inside = false;

  const lineBoundsAt = (pos: number) => {
    let ls = pos; while (ls > 0 && text[ls - 1] !== '\n' && text[ls - 1] !== '\r') ls--;
    let le = pos; while (le < text.length && text[le] !== '\n' && text[le] !== '\r') le++;
    // include trailing newline(s)
    let adv = le;
    if (adv < text.length && text[adv] === '\r' && text[adv + 1] === '\n') adv += 2;
    else if (adv < text.length && (text[adv] === '\n' || text[adv] === '\r')) adv += 1;
    return { ls, le, adv };
  };

  const isDelimLineAt = (pos: number) => {
    const { ls, le } = lineBoundsAt(pos);
    const line = text.slice(ls, le);
    return /^\s*\$\$\s*$/.test(line);
  };

  while (i < text.length) {
    if (isDelimLineAt(i)) {
      // emit chunk before this $$ with current inside flag
      if (i > start) parts.push({ inside, chunk: text.slice(start, i) });

      // emit the $$ line itself as INSIDE (so transforms never touch it)
      const { adv } = lineBoundsAt(i);
      parts.push({ inside: true, chunk: text.slice(i, adv) });

      // flip inside for following content, move pointers
      inside = !inside;
      i = adv;
      start = i;
      continue;
    }

    // Inline $$…$$ on same line (keep entire span as inside)
    if (text[i] === '$' && text[i + 1] === '$') {
      // emit before
      if (i > start) parts.push({ inside, chunk: text.slice(start, i) });
      // find close
      let j = i + 2;
      while (j + 1 < text.length && !(text[j] === '$' && text[j + 1] === '$')) j++;
      if (j + 1 >= text.length) {
        // no closing — treat the rest as outside
        parts.push({ inside, chunk: text.slice(i) });
        return parts;
      }
      parts.push({ inside: true, chunk: text.slice(i, j + 2) });
      i = j + 2;
      start = i;
      continue;
    }

    i++;
  }

  if (start < text.length) parts.push({ inside, chunk: text.slice(start) });
  return parts;
}

function applyOutsideDisplay(text: string, transform: (seg: string) => string): string {
  return segmentByDisplayMath(text).map(p => p.inside ? p.chunk : transform(p.chunk)).join("");
}

function wrapBareMathLinesOutside(text: string): string {
  // process only outside $$…$$ spans
  const parts = text.split(/(\$\$[\s\S]*?\$\$)/g);
  for (let i = 0; i < parts.length; i += 2) {
    parts[i] = wrapBareMathLines(parts[i]);  // only on outside prose
  }
  return parts.join("");
}

function wrapBareMathLines(segment: string): string {
  const lines = segment.split(/\r?\n/);
  const out: string[] = [];

  const isHr = (s: string) => /^(\*{3,}|-{3,}|_{3,})$/.test(s);
  const isAlreadyMathDelim = (s: string) => s.trim() === "$$";

  // “mathy” line: must contain real math tokens and not be empty/heading/bullet/hr
  const isMathLine = (s: string) => {
    if (/\$/.test(s)) return false; // don't wrap lines that already have inline math

    const t = s.trim();
    if (!t) return false;
    if (/^#{1,6}\s/.test(t)) return false;        // headings
    if (/^[-*•]\s+/.test(t)) return false;        // bullets
    if (isHr(t)) return false;
    if (/^\$.*\$$/.test(t) || /^\$\$[\s\S]*\$\$$/.test(t)) return false; // already wrapped

    // require at least one clear math token
    const hasMathToken =
      /[=^_]/.test(t) || /\\[A-Za-z]+/.test(t) || /[+\-*/]/.test(t);
    // and very few “wordy” words
    const words = (t.match(/\b[A-Za-z]{2,}\b/g) || []).length;
    return hasMathToken && words <= 4;
  };

  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();

    // Don’t wrap if adjacent to existing $$ (prevents $$ $$ stacks)
    const prevIsDelim = i > 0 && isAlreadyMathDelim(lines[i - 1].trim());
    const nextIsDelim = i + 1 < lines.length && isAlreadyMathDelim(lines[i + 1].trim());

    if (isMathLine(lines[i]) && !prevIsDelim && !nextIsDelim) {
      out.push("$$", lines[i].trimEnd(), "$$");
    } else {
      out.push(lines[i]);
    }
  }
  return out.join("\n");
}

function wrapInlineBareLatex(segment: string): string {
  // leave delimiter-only lines alone
  if (/^\s*\$\$\s*$/m.test(segment)) return segment;

  // 90^\circ
  segment = segment.replace(/(?<!\$)\b(\d+)\s*\^\s*\\circ\b(?!\$)/g, (_m, n) => `$${n}^{\\circ}$`);
  // \sqrt{…}
  segment = segment.replace(/(?<!\$)(\\sqrt\s*\{[^}]+\})(?!\$)/g, (_m, body) => `$${body}$`);
  // \frac{…}{…}
  segment = segment.replace(/(?<!\$)(\\frac\s*\{[^}]+\}\s*\{[^}]+\})(?!\$)/g, (_m, body) => `$${body}$`);
  // simple x_i / y^2 when adjacent to math-ish context
  segment = segment.replace(
    /(?<!\$)\b([A-Za-z])\s*([_^])\s*([A-Za-z0-9]+)\b(?=\s*[=+\-*/,:;.)]|$)(?!\$)/g,
    (_m, v, hat, idx) => `$${v}${hat}${idx}$`
  );
  return segment;
}

/** Guard for (…) inline: decide if we should convert to $…$. */
function isSafeParens(content: string, before: string, after: string, match: string): boolean {
  // Skip common non-math patterns:
  // (a), (b), (i), (ii), (1), (2), (note), etc.
  if (/^(?:[a-z]|[ivxlcdm]+|\d+)\)?\s*(?:$|[,\.;:!?\u2013\u2014-]\s)/i.test(content)) return false;
  if (/^(?:note|notes|see|ref|fig|figure|table|section|chapter|appendix)\b/i.test(content)) return false;

  // If it’s obviously LaTeX-ish, accept immediately.
  if (isLatexLike(content)) return true;

  // Single-letter variables like (n) in mathy prose.
  if (/^[A-Za-z]$/.test(content) && contextIsMathy(before, after)) return true;

  return false;
}

/** Guard for […] inline: convert to $…$ iff LaTeX-ish and not a markdown construct. */
function isSafeBrackets(content: string, before: string, after: string, match: string): boolean {
  // Skip Markdown links/images/footnotes:
  if (/^!?\[.*\]\(.*\)$/.test(before + match + after)) return false; // link or image
  if (/^\^[^\]]+$/.test(content)) return false; // footnote ref [^1]
  if (/^\s*!\s*[^[]/.test(before)) return false; // image starter

  // Accept if LaTeX-ish; otherwise leave alone
  return isLatexLike(content);
}

/** “Mathy context” around a single-letter var like (n). */
function contextIsMathy(before: string, after: string): boolean {
  const window = (before + " " + after).slice(-120);
  if (/[\\=_^]|[\u2200-\u22FF]/.test(window)) return true; // LaTeX or Unicode math
  if (/\b(ODE|PDE|Fourier|Taylor|polynomial|series|equation|matrix|vector|operator|rank|dimension|basis|eigen|SVD|distribution|probability|variance|expectation|gradient|divergence|curl)\b/i.test(window)) {
    return true;
  }
  // nth-order, k-th, degree n, etc.
  if (/^\s*(?:-?\s*order|th|st|nd|rd|dim|degree|term|mode|harmonic|eigen|component)\b/i.test(after)) {
    return true;
  }
  return false;
}

/** Comprehensive LaTeX-ish detector. */
function isLatexLike(s: string): boolean {
  // Quick strong signals
  if (/[\\]/.test(s)) return true;            // any LaTeX command present
  if (/[=_^]/.test(s)) return true;           // sub/sup/eq
  if (/[+\-*/]/.test(s) && /[A-Za-z0-9]/.test(s)) return true; // simple algebra
  if (/[⟨⟩]/.test(s) || /‖[^‖]+‖/.test(s)) return true;        // unicode inner product / norm
  if (/[≤≥≈≃≅≡≠→↦↔⇒⇔∝∞∑∫√∂∇∈∉⊂⊆⊃⊇∪∩∀∃]/.test(s)) return true; // common math syms

  // Functions & operators
  if (/\b(sin|cos|tan|cot|sec|csc|log|ln|exp|min|max|arg|min|max|sup|inf|det|rank|tr|trace|diag|span|null|range|im|ker|dim)\b/.test(s)) return true;

  // \command{...} families: fonts, sets, bb/cal/bf/it/tt, \text{...}, \color{...}, \operatorname{...}
  if (/\\(mathbb|mathcal|mathrm|mathbf|mathit|mathtt|boldsymbol|bm)\s*\{[A-Za-z0-9]+\}/.test(s)) return true;
  if (/\\text\s*\{[^}]+\}/.test(s)) return true;
  if (/\\operatorname\s*\{[^}]+\}/.test(s)) return true;

  // Greek letters & calculus
  if (/\\(alpha|beta|gamma|delta|epsilon|varepsilon|zeta|eta|theta|vartheta|iota|kappa|lambda|mu|nu|xi|pi|varpi|rho|sigma|varsigma|tau|upsilon|phi|varphi|chi|psi|omega|partial|nabla|sum|int|prod|frac|sqrt|binom|cdot|times|div|over|lim|to|infty)\b/.test(s)) {
    return true;
  }

  // Environments (even fragments)
  if (/\\begin\{(?:bmatrix|pmatrix|vmatrix|Vmatrix|matrix|smallmatrix|cases|array|align|aligned|gather|split)\}/.test(s)) {
    return true;
  }

  // Typical vector/matrix hints: [a,b], [[a,b],[c,d]]
  if (/\[[^[\]]+,[^[\]]+\]/.test(s) && /[A-Za-z0-9]/.test(s)) return true;

  // Subscripts/superscripts tokens
  if (/[A-Za-z]\s*[_^]\s*[0-9A-Za-z]/.test(s)) return true;

  // Function-like tokens f(x), u(x,t), P(A|B)
  if (/[A-Za-z]\s*\([^)]*\)/.test(s)) return true;

  return false;
}

/** Trim extra blank lines around $$ blocks. */
function trimEmptyLinesAroundBlockMath(input: string): string {
  return input
    .replace(/(?:^|\n)[ \t]*\n[ \t]*(?=\$\$)/g, "\n")
    .replace(/(?<=\$\$)\n[ \t]*\n/g, "\n");
}

/** Settings UI */
// interface Katex2MathjaxConverterSettings { ... }
// const DEFAULT_SETTINGS: Katex2MathjaxConverterSettings = { ... }
class Katex2MathJaxConverterSettingTab extends PluginSettingTab {
  plugin: Katex2MathJaxConverterPlugin;
  constructor(app: App, plugin: Katex2MathJaxConverterPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName("Enable default paste conversion")
      .setDesc("Automatically converts KaTeX/ChatGPT-style math on paste.")
      .addToggle(t =>
        t.setValue(this.plugin.settings.enableDefaultPasteConversion)
         .onChange(async v => {
           this.plugin.settings.enableDefaultPasteConversion = v;
           await this.plugin.saveSettings();
         })
      );

    new Setting(containerEl)
      .setName("Wrap matrix/align environments in $$ … $$")
      .setDesc("If ChatGPT pastes bare \\begin{bmatrix}/align/etc., wrap as display math.")
      .addToggle(t =>
        t.setValue(this.plugin.settings.wrapMatrixEnvsInDisplayMath)
         .onChange(async v => {
           this.plugin.settings.wrapMatrixEnvsInDisplayMath = v;
           await this.plugin.saveSettings();
         })
      );

    new Setting(containerEl)
      .setName("Treat plain parentheses ( … ) as math")
      .setDesc("Convert OUTERMOST ( … ) to $…$ if contents look LaTeX-like.")
      .addToggle(t =>
        t.setValue(this.plugin.settings.plainParensAsDelimiters)
         .onChange(async v => {
           this.plugin.settings.plainParensAsDelimiters = v;
           await this.plugin.saveSettings();
         })
      );

    new Setting(containerEl)
      .setName("Treat plain brackets [ … ] as math")
      .setDesc("Convert OUTERMOST [ … ] to $…$ if contents look LaTeX-like.")
      .addToggle(t =>
        t.setValue(this.plugin.settings.plainBracketsAsDelimiters)
         .onChange(async v => {
           this.plugin.settings.plainBracketsAsDelimiters = v;
           await this.plugin.saveSettings();
         })
      );

    new Setting(containerEl)
      .setName("Convert bare inline LaTeX")
      .setDesc("Wrap inline tokens like 90^\\circ, \\sqrt{…}, \\frac{…}{…}, x_i into $…$.")
      .addToggle(t =>
        t.setValue(this.plugin.settings.convertBareInlineLatex)
         .onChange(async v => {
           this.plugin.settings.convertBareInlineLatex = v;
           await this.plugin.saveSettings();
         })
      );

    new Setting(containerEl)
      .setName("Wrap single math lines into $$ … $$")
      .setDesc("Convert isolated math-heavy lines (e.g., a^2 + b^2 = c^2) into display math.")
      .addToggle(t =>
        t.setValue(this.plugin.settings.wrapBareMathSingleLines)
         .onChange(async v => {
           this.plugin.settings.wrapBareMathSingleLines = v;
           await this.plugin.saveSettings();
         })
      );
  }
}
