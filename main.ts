import { App, Notice, Plugin , PluginSettingTab, Setting } from "obsidian";

interface Katex2MathjaxConverterSettings {
  enableDefaultPasteConversion: boolean;
}

const DEFAULT_SETTINGS: Katex2MathjaxConverterSettings = {
  enableDefaultPasteConversion: true,
};

export default class Katex2MathjaxConverterPlugin extends Plugin {
  settings: Katex2MathjaxConverterSettings;

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  async onload() {
    // Load plugin settings
    await this.loadSettings();

    // Add settings tab
    this.addSettingTab(new MathJaxConverterSettingTab(this.app, this));

    // Event for default paste based on the settings 'enableDefaultPasteConversion' value
    this.registerEvent(
        this.app.workspace.on("editor-paste", async (evt, editor) => {
          const clipboardText = evt.clipboardData?.getData("text") || "";
          const trimmed = clipboardText.trim();

          // Skip entirely if it's a raw URL or markdown link
          const isRawUrl = /^https?:\/\/\S+$/.test(trimmed);
          const isMarkdownLink = /^\[.*?\]\(.*?\)$/.test(trimmed);

          // Let Obsidian and other plugins handle it normally
          if (isRawUrl || isMarkdownLink) {
            return;
          }

          // Else, do KaTeX → MathJax conversion
          if (this.settings.enableDefaultPasteConversion && clipboardText) {
            evt.preventDefault();

            const convertedText = convertKatexToMathJax(clipboardText);
            editor.replaceSelection(convertedText);
          }
        })
      );

    // Command: Paste with conversion
    this.addCommand({
      id: "paste-katex-to-mathjax",
      name: "Paste with conversion",
      editorCallback: (editor) => {
        navigator.clipboard.readText().then((clipboardText) => {
          const convertedText = convertKatexToMathJax(clipboardText)
          editor.replaceSelection(convertedText);
        });
      },
    });

    // Command: Convert existing text in the editor from KaTeX to MathJax
    this.addCommand({
      id: "convert-editor-text-from",
      name: "Convert current text file",
      editorCallback: (editor) => {
        const currentText = editor.getValue();
        const convertedText = convertKatexToMathJax(currentText);
        editor.setValue(convertedText);
      },
    });

    // Command: Convert all files in the vault from KaTeX to MathJax
    this.addCommand({
      id: "convert-all-files-from",
      name: "Convert all files",
      callback: async () => {
        const files = this.app.vault.getMarkdownFiles();
        for (const file of files) {
          const content = await this.app.vault.read(file);
          const convertedContent = convertKatexToMathJax(content);
          await this.app.vault.modify(file, convertedContent);
        }
        new Notice("Text in the whole vault is converted from KaTeX to MathJax format!");
      },
    });
  }
}

/**
 * Converts KaTeX formatted strings to MathJax formatted strings.
 *
 * This function performs the following conversions:
 * 1. Replaces \(\text{sample}\) with $\text{sample}$.
 * 2. Replaces \[\text{sample}\] with $$\text{sample}$$.
 * 3. Trims spaces inside inline math expressions.
 * 4. Skips conversion inside URLs and Markdown links.
 *
 * @param input - The input string containing KaTeX formatted text.
 * @returns The converted string with MathJax formatted text.
 */
function convertKatexToMathJax(input: string): string {
  const isRawUrl = /^https?:\/\/\S+$/.test(input.trim());
  const isMarkdownLink = /^\[.*?\]\(.*?\)$/.test(input.trim());
  const isCombined = /^https?:\/\/[^\s\[]+\[.*?\]\(.*?\)/.test(input.trim());

  if (isRawUrl || isMarkdownLink || isCombined) return input;

  // First, split the input into parts: URLs vs everything else
  const urlRegex = /https?:\/\/[^\s)]+/g;
  const parts: string[] = [];
  let lastIndex = 0;

  for (const match of input.matchAll(urlRegex)) {
    // Push the non-URL text before this match
    if (match.index! > lastIndex) {
      parts.push(processMath(input.slice(lastIndex, match.index)));
    }
    // Push the URL itself unchanged
    parts.push(match[0]);
    lastIndex = match.index! + match[0].length;
  }

  // Add the final part
  if (lastIndex < input.length) {
    parts.push(processMath(input.slice(lastIndex)));
  }

  return trimEmptyLinesAroundBlockMath(parts.join(''));
}

/**
 * Removes unnecessary empty lines around block-level math expressions.
 *
 * Many Markdown renderers or KaTeX/MathJax integrations require block math
 * expressions (e.g., `$$ ... $$`) to be tightly wrapped without extra
 * blank lines before or after the math block. Otherwise, the math might
 * be misinterpreted as multiple blocks or broken into inline math.
 *
 * Example:
 *   Input:
 *     $$ 
 *     E = mc^2 
 *     $$
 *
 *   Output:
 *     $$ 
 *     E = mc^2 
 *     $$
 *
 * @param {string} text - The full Markdown/HTML source string.
 * @returns {string} The processed text with extra empty lines trimmed.
 */

function trimEmptyLinesAroundBlockMath(input: string): string {
  return input
    // Remove empty or whitespace-only line before $$ (even if space before the delimiter)
    .replace(/(?:^|\n)[ \t]*\n[ \t]*(?=\$\$)/g, '\n')
    // Remove empty or whitespace-only line after $$
    .replace(/(?<=\$\$)\n[ \t]*\n/g, '\n');
}

/**
 * Processes inline and block-level math expressions within the given text.
 *
 * This function detects math delimiters (`$...$` for inline math and
 * `$$...$$` for block math) and prepares the expressions for proper rendering.
 * It typically:
 *   - Identifies math segments using regular expressions.
 *   - Ensures delimiters are preserved and properly escaped when necessary.
 *   - Handles multiline block math without breaking rendering.
 *
 * Example:
 *   Input:  "The formula is $E = mc^2$ and it's important."
 *   Output: "The formula is <span class='math'>E = mc^2</span> and it's important."
 *
 * @param {string} text - The Markdown or HTML content containing math expressions.
 * @returns {string} The updated text with processed math expressions ready for rendering.
 */

function processMath(text: string): string {
  // 0) Normalize
  text = text.replace(/\r\n?/g, '\n').replace(/\u200B|\u00A0/g, ' ');

  // 1) Explicit LaTeX delimiters -> KaTeX
  text = text.replace(/\\\(([\s\S]*?)\\\)/g, (_m, p1) => `$${p1.trim()}$`);
  text = text.replace(/\\\[([\s\S]*?)\\\]/g, (_m, p1) => `\n$$\n${p1.trim()}\n$$\n`);

  // 2) Display math: [ ... ] on its own line -> $$...$$
  text = text.replace(/^\s*\[\s*([\s\S]*?)\s*\]\s*$/gm, (_m, body) => `\n$$\n${body.trim()}\n$$\n`);

  // 3) Inline math — whitespace style
  text = text.replace(/ \( /g, ' $');           // open
  text = text.replace(/ \) /g, '$ ');           // close with space
  text = text.replace(/ \)([.,;!?])/g, '$$$1'); // close before punctuation ($ + punct)

  // 4) Inline math — tight parens with TeX-y or function-like content (outside existing math)
  type Seg = { kind: 'text'|'blockMath'; s: string };
  const splitByBlock = (s: string): Seg[] => {
    const out: Seg[] = [];
    const re = /\$\$[\s\S]*?\$\$/g;
    let i = 0, m: RegExpExecArray | null;
    while ((m = re.exec(s))) {
      if (m.index > i) out.push({ kind: 'text', s: s.slice(i, m.index) });
      out.push({ kind: 'blockMath', s: m[0] });
      i = m.index + m[0].length;
    }
    if (i < s.length) out.push({ kind: 'text', s: s.slice(i) });
    return out;
  };

  type SubSeg = { kind: 'text'|'inlineMath'; s: string };
  const splitByInline = (s: string): SubSeg[] => {
    const out: SubSeg[] = [];
    const re = /\$[^$]*?\$/g;
    let i = 0, m: RegExpExecArray | null;
    while ((m = re.exec(s))) {
      if (m.index > i) out.push({ kind: 'text', s: s.slice(i, m.index) });
      out.push({ kind: 'inlineMath', s: m[0] });
      i = m.index + m[0]!.length;
    }
    if (i < s.length) out.push({ kind: 'text', s: s.slice(i) });
    return out;
  };

  const TEXY = /\\[a-zA-Z]+|[_^]|\{[^}]*\}/;      // \commands, superscripts/subscripts, or {...}
  const FUNCTIONY = /\b[A-Za-z]\s*\([^()]*\)/;    // y(x), u(x,t), X(x)T(t) (will be inside body)
  const tightParensNested = /\(((?:[^()]|\([^()]*\))*)\)/g; // allow one level of inner (...)

  const convertTightOutsideMath = (s: string): string =>
    splitByInline(s).map(part => {
      if (part.kind !== 'text') return part.s;
      return part.s.replace(tightParensNested, (_m, body) =>
        (TEXY.test(body) || FUNCTIONY.test(body)) ? `$${body}$` : `(${body})`
      );
    }).join('');

  text = splitByBlock(text).map(seg =>
    seg.kind === 'blockMath' ? seg.s : convertTightOutsideMath(seg.s)
  ).join('');

  // 5) Punctuation cleanup inside math
  const tidyInsideMath = (s: string): string =>
    s.replace(/;/g, '\\;').replace(/(\S),(\S)/g, '$1\\,$2');

  text = text.replace(/\$\$([\s\S]*?)\$\$/g, (_m, b) => `$$${tidyInsideMath(b)}$$`);
  text = text.replace(/\$([^$]*?)\$/g, (_m, b) => `$${tidyInsideMath(b)}$`);

  return text;
}



/**
 * Settings tab for the MathJax Converter Plugin.
 * 
 * This class creates a settings tab in the application where users can
 * configure the plugin settings.
 */
class MathJaxConverterSettingTab extends PluginSettingTab {
  plugin: Katex2MathjaxConverterPlugin;

  /**
   * Constructs a new instance of the settings tab.
   * 
   * @param app - The application instance.
   * @param plugin - The plugin instance.
   */
  constructor(app: App, plugin: Katex2MathjaxConverterPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  /**
   * Displays the settings tab.
   * 
   * This method creates the UI elements for the settings tab and sets up
   * event listeners for user interactions.
   */
  display(): void {
    const { containerEl } = this;

    containerEl.empty();

    // Toggle for enabling/disabling default paste conversion
    new Setting(containerEl)
      .setName("Enable default paste conversion")
      .setDesc("Automatically converts KaTeX to MathJax on paste action.")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.enableDefaultPasteConversion)
          .onChange(async (value) => {
            this.plugin.settings.enableDefaultPasteConversion = value;
            await this.plugin.saveSettings();
          })
      );
  }
}
