import { App, Notice, Plugin , PluginSettingTab, Setting } from "obsidian";

interface Katex2LatexConverterSettings {
  enableDefaultPasteConversion: boolean;
}

const DEFAULT_SETTINGS: Katex2LatexConverterSettings = {
  enableDefaultPasteConversion: false,
};

export default class Katex2LatexConverterPlugin extends Plugin {
  settings: Katex2LatexConverterSettings;

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
    this.addSettingTab(new LatexConverterSettingTab(this.app, this));

    // Event for default paste based on the settings 'enableDefaultPasteConversion' value
    this.registerEvent(
      this.app.workspace.on("editor-paste", async (evt, editor) => {
        const clipboardText = evt.clipboardData?.getData("text") || ""
        const convertedText = this.settings.enableDefaultPasteConversion
          ? convertKatexToLatex(clipboardText)
          : clipboardText;

          if (clipboardText) {
            evt.preventDefault();
            editor.replaceSelection(convertedText);
          }
        
      })
    );

    // Command: Paste with conversion
    this.addCommand({
      id: "paste-katex-to-latex",
      name: "Paste with Conversion",
      editorCallback: (editor) => {
        navigator.clipboard.readText().then((clipboardText) => {
          const latexText = convertKatexToLatex(clipboardText);
          editor.replaceSelection(latexText);
        });
      },
    });

    // Command: Convert existing text in the editor from KaTex to LaTeX format
    this.addCommand({
      id: "convert-editor-text-from",
      name: "Convert Editor Text",
      editorCallback: (editor) => {
        const currentText = editor.getValue();
        const convertedText = convertKatexToLatex(currentText);
        editor.setValue(convertedText);
      },
    });

    // Command: Convert all files in the vault from KaTex to LaTeX format
    this.addCommand({
      id: "convert-all-files-from",
      name: "Convert All Files",
      callback: async () => {
        const files = this.app.vault.getMarkdownFiles();
        for (const file of files) {
          const content = await this.app.vault.read(file);
          const convertedContent = convertKatexToLatex(content);
          await this.app.vault.modify(file, convertedContent);
        }
        new Notice("Text in the whole vault is converted from KaTeX to LaTeX!");
      },
    });

    console.log("Katex2LatexConverterPlugin loaded!");
  }

  onunload() {
    console.log("Katex2LatexConverterPlugin unloaded!");
  }
}

// Helper Function to convert KaTex to LaTeX
function convertKatexToLatex(input: string): string {
  return input
    .replace(/\\\(\s?/g, "$") // Replace `\( ` with `$`
    .replace(/\s?\\\)/g, "$") // Replace ` \)` with `$`
    .replace(/\\\[\s?/g, "$$$\n") // Replace `\[ ` with `$$\n`
    .replace(/\s?\\\]/g, "\n$$$"); // Replace ` \]` with `\n$$`
}

// Settings tab
class LatexConverterSettingTab extends PluginSettingTab {
  plugin: Katex2LatexConverterPlugin;

  constructor(app: App, plugin: Katex2LatexConverterPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;

    containerEl.empty();

    containerEl.createEl("h2", { text: "KaTex to LaTex Converter Settings" });

    // Toggle for enabling/disabling default paste conversion
    new Setting(containerEl)
      .setName("Enable Default Paste Conversion")
      .setDesc("Automatically converts KaTeX to LaTeX on paste action.")
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