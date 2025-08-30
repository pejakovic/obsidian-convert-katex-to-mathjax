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
  // Skip full conversion if input is a raw URL or markdown link
  const isRawUrl = /^https?:\/\/\S+$/.test(input.trim());
  const isMarkdownLink = /^\[.*?\]\(.*?\)$/.test(input.trim());
  const isCombined = /^https?:\/\/[^\s\[]+\[.*?\]\(.*?\)/.test(input.trim());

  if (isRawUrl || isMarkdownLink || isCombined) return input;

  return processMath(input);
}

/**
 * Converts \(...\) and \[...\] to $...$ and $$...$$ and trims inside inline math.
 *
 * @param text - A plain string to process.
 * @returns Processed string with math conversions.
 */
function processMath(text: string): string {
  // Convert block math: \[...\] → $$...$$ (multi-line supported)
// Match square brackets with any content inside, even single-line
text = text.replace(/\\?\[(.*?)\\?\]/gs, (_match, p1) => {
  return `\n$$\n${p1.trim()}\n$$\n`;
});
  // Convert inline math: \( ... \) → $...$
  text = text.replace(/\\\((.*?)\\\)/g, (_match, p1) => {
    return `$${p1.trim()}$`;
  });

  // Match square brackets with any content inside, even single-line
  text = text.replace(/\\?\[(.*?)\\?\]/gs, (_match, p1) => {
    return `\n$$\n${p1.trim()}\n$$\n`;
  });


  // Only trim inner contents of $...$ but don't remove outside spacing
  text = text.replace(/\$(.*?)\$/g, (_match, p1) => {
    return `$${p1.trim()}$`;
  });

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