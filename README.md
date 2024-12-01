# Obsidian Plugin: Convert KaTeX to MathJax

A simple plugin for [Obsidian](https://obsidian.md) that converts KaTeX notation to MathJax, ensuring seamless use of mathematical expressions copied from sources like OpenAI's ChatGPT.

---

## **Why This Plugin?**

  ChatGPT and other platforms often render mathematical expressions using [**KaTeX**](https://katex.org), while Obsidian uses [**MathJax**](https://www.mathjax.org) for mathematical notation. This discrepancy can lead to formatting issues when copying and pasting content.

This plugin eliminates the hassle by automatically converting KaTeX expressions to MathJax, making it easier to integrate ChatGPT-generated content or other KaTeX-based math into your Obsidian vault.

---

## **Features**

- **Default paste conversion**: Automatically converts KaTeX expressions on paste (toggleable via settings).
- **Command Palette Actions**:
  - **Paste with conversion**: Manually paste KaTeX content with MathJax conversion applied.
  - **Convert current text file**: Convert all KaTeX expressions in the current note to MathJax.
  - **Convert all files**: Batch-convert KaTeX expressions in every markdown file across your vault.
- Easy toggle to enable or disable automatic conversion.
- Works seamlessly with clipboard operations.

---

## **Installation**

### **Manual Installation**
1. Download or build the plugin files (`main.js` and `manifest.json`).
2. Copy them into your Obsidian vault directory:
   ```
   VaultFolder/.obsidian/plugins/obsidian-convert-katex-to-mathjax/
   ```
3. Restart Obsidian.
4. Enable the plugin in `Settings > Community Plugins`.

---

## **How to Use**

### **Default Paste Behavior**
1. Toggle "Enable default paste conversion" in the plugin settings.
2. Simply paste copied KaTeX content into your Obsidian editor—it's automatically converted to MathJax.

### **Command Palette Actions**
Open the Command Palette (`Ctrl + P` / `Cmd + P`) and search for the following commands:
- **Paste with conversion**: Pastes clipboard content with conversion applied.
- **Convert current text file**: Converts all KaTeX expressions in the current note to MathJax.
- **Convert all files**: Scans and converts KaTeX expressions in all markdown files across your vault.

---

## **Development**

If you'd like to make changes or contribute:
1. Clone this repository:
   ```bash
   git clone https://github.com/your-repo/convert-katex-to-mathjax.git
   ```
2. Ensure your Node.js version is at least 16:
   ```bash
   node --version
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Start compilation in watch mode:
   ```bash
   npm run dev
   ```

---

## **Contributions**
Contributions, suggestions, and bug reports are welcome! Feel free to submit a pull request (PR) or open an issue in the repository.

---

## **Support**

If you find this plugin helpful and would like to support its development, consider buying me a coffee:

[![Buy Me A Coffee](https://www.buymeacoffee.com/assets/img/custom_images/orange_img.png)](https://www.buymeacoffee.com/darkopejakovic)

---

## **License**

This project is licensed under the [MIT License](LICENSE).