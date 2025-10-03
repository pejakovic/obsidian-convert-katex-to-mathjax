# Obsidian Plugin: Convert KaTeX to MathJax

A simple plugin for [Obsidian](https://obsidian.md) that converts KaTeX notation to MathJax, ensuring seamless use of mathematical expressions copied from sources like OpenAI's ChatGPT.

---

## **Why This Plugin?**

ChatGPT and other platforms often render mathematical expressions using [**KaTeX**](https://katex.org), while Obsidian uses [**MathJax**](https://www.mathjax.org) for mathematical notation. This discrepancy can lead to formatting issues when copying and pasting content.

This plugin eliminates the hassle by automatically converting KaTeX expressions to MathJax, making it easier to integrate ChatGPT-generated content or other KaTeX-based math into your Obsidian vault.

---

## **Features**

* **Default paste conversion**: Automatically converts KaTeX expressions on paste (toggleable via settings).
* **Command Palette Actions**:

  * **Paste with conversion**: Manually paste KaTeX content with MathJax conversion applied.
  * **Convert current text file**: Convert all KaTeX expressions in the current note to MathJax.
  * **Convert all files**: Batch-convert KaTeX expressions in every markdown file across your vault.
* Works seamlessly with clipboard operations.
* Fine-grained **settings** to control conversion heuristics (see below).

---

## **Settings**

Open **Settings → Community Plugins → Convert KaTeX to MathJax** to adjust:

### ✅ Enable default paste conversion

Automatically convert KaTeX to MathJax when pasting.

**Example**
Paste:

```
\(a^2 + b^2 = c^2\)
```

Result:

```
$a^2 + b^2 = c^2$
```

---

### ✅ Wrap matrix/align environments in `$$ … $$`

Ensures multi-line math environments are recognized as display math.

**Example**
Paste:

```latex
\begin{bmatrix}1 & 0 \\ 0 & 1\end{bmatrix}
```

Result:

```latex
$$
\begin{bmatrix}1 & 0 \\ 0 & 1\end{bmatrix}
$$
```

---

### ✅ Treat plain parentheses `( … )` as math

Converts outermost parentheses to inline math if contents look LaTeX-like.

**Example**
Paste:

```
(x^2 + 1)
```

Result:

```
$x^2 + 1$
```

---

### ✅ Treat plain brackets `[ … ]` as math

Same as parentheses, but for square brackets.

**Example**
Paste:

```
[a,b]
```

Result:

```
$[a,b]$
```

---

### ✅ Convert bare inline LaTeX

Wraps common inline LaTeX tokens into `$…$`.

**Examples**

* `90^\circ` → `$90^{\circ}$`
* `\sqrt{4}` → `$\sqrt{4}$`
* `\frac{1}{2}` → `$\frac{1}{2}$`
* `x_i, y^2` → `$x_i$, $y^2$`

---

### ✅ Wrap single math lines into `$$ … $$`

Automatically converts isolated math-heavy lines into display math.

**Example**
Paste:

```
a^2 + b^2 = c^2
```

Result:

```latex
$$
a^2 + b^2 = c^2
$$
```

---

## **Installation**

### Manual Installation

1. Download or build the plugin files (`main.js` and `manifest.json`).
2. Copy them into your Obsidian vault directory:

   ```
   VaultFolder/.obsidian/plugins/obsidian-convert-katex-to-mathjax/
   ```
3. Restart Obsidian.
4. Enable the plugin in `Settings > Community Plugins`.

---

## **How to Use**

### Default Paste Behavior

1. Toggle "Enable default paste conversion" in the plugin settings.
2. Simply paste copied KaTeX content into your Obsidian editor—it's automatically converted to MathJax.

### Command Palette Actions

Open the Command Palette (`Ctrl + P` / `Cmd + P`) and search for the following commands:

* **Paste with conversion**: Pastes clipboard content with conversion applied.
* **Convert current text file**: Converts all KaTeX expressions in the current note to MathJax.
* **Convert all files**: Scans and converts KaTeX expressions in all markdown files across your vault.

---

## **Development**

If you'd like to make changes or contribute:

```bash
git clone https://github.com/your-repo/convert-katex-to-mathjax.git
cd convert-katex-to-mathjax
npm install
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