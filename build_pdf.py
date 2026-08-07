#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
CrowdShipping Master Blueprint — Markdown → HTML → PDF converter
Uses the PDF skill's "bypass" pipeline: raw long-form HTML + Playwright.
Renders emoji natively (Chromium color fonts), styles code/tables/Mermaid.
"""
import re
import sys
import html
import subprocess
from pathlib import Path

import markdown

BASE = Path(r"C:\Users\Ilyes\CrowdShipping")
SRC = BASE / "CROWDSHIPPING_MASTER_BLUEPRINT.md"
HTML_OUT = BASE / "CROWDSHIPPING_MASTER_BLUEPRINT_rendered.html"
PDF_OUT = BASE / "CROWDSHIPPING_MASTER_BLUEPRINT.pdf"
PDF_SKILL = Path(r"C:\Users\Ilyes\.zcode\cli\plugins\cache\zcode-plugins-official\document-skills\0.1.0\skills\pdf")
HTML2PDF = PDF_SKILL / "scripts" / "html2pdf-next.js"

# ─────────────────────────────────────────────────────────────────────
# 1. Markdown → HTML body
# ─────────────────────────────────────────────────────────────────────

def convert_markdown(md_text: str) -> str:
    # SuperFences: render mermaid blocks as <div class="mermaid"> for the
    # client-side mermaid.js library (html2pdf-next.js waits for these).
    def mermaid_formatter(source, language, css_class, options, md, **kwargs):
        return f'<div class="mermaid">{html.escape(source.strip())}</div>'

    md = markdown.Markdown(
        extensions=[
            "tables",
            "fenced_code",
            "sane_lists",
            "attr_list",
            "md_in_html",
            "pymdownx.superfences",
            "pymdownx.highlight",
        ],
        extension_configs={
            "pymdownx.highlight": {
                "css_class": "codehilite",
                "guess_lang": False,
                "linenums": False,
                "noclasses": True,        # inline styles → survives any CSS
                "pygments_style": "one-dark",  # dark theme matching code blocks
            },
            "pymdownx.superfences": {
                "custom_fences": [
                    {"name": "mermaid", "class": "mermaid", "format": mermaid_formatter},
                ],
            },
        },
    )
    return md.convert(md_text)


# ─────────────────────────────────────────────────────────────────────
# 2. Post-process: auto-id headings for TOC links, split parts onto new pages
# ─────────────────────────────────────────────────────────────────────

def slugify(text: str) -> str:
    """French-aware slug matching the document's existing TOC anchors."""
    text = text.lower()
    # strip emoji
    text = re.sub(r"[\U0001F300-\U0001FAFF\U00002600-\U000027BF\U0001F000-\U0001F9FF]", "", text)
    text = text.replace("é", "e").replace("è", "e").replace("ê", "e").replace("ë", "e")
    text = text.replace("à", "a").replace("â", "a")
    text = text.replace("î", "i").replace("ï", "i")
    text = text.replace("ô", "o").replace("ö", "o")
    text = text.replace("ù", "u").replace("û", "u").replace("ü", "u")
    text = text.replace("ç", "c")
    text = re.sub(r"[^\w\s-]", "", text)
    text = re.sub(r"\s+", "-", text.strip())
    text = re.sub(r"-+", "-", text)
    return text


def post_process(body_html: str) -> str:
    # Inject id attributes on every h1/h2 so the TOC anchor links work.
    seen = {}
    def add_id(match):
        tag, text = match.group(1), match.group(2)
        inner = re.sub(r"<[^>]+>", "", text)          # strip any inner markup
        slug = slugify(inner)
        if slug in seen:
            seen[slug] += 1
            slug = f"{slug}-{seen[slug]}"
        else:
            seen[slug] = 0
        return f'<{tag} id="{slug}">{text}</{tag}>'

    body_html = re.sub(r"<(h[12])>(.*?)</\1>", add_id, body_html, flags=re.DOTALL)

    # Each PARTIE (h1) starts on a fresh page.
    body_html = body_html.replace(
        '<h1 id="partie-',
        '<h1 class="part-title" id="partie-',
    )

    # The very first h1 (document title) is replaced by the cover, so demote it.
    # Mark the document-level first h1 (the "🚀 CrowdShipping..." title) so CSS
    # can hide it — content begins at PARTIE 1.
    body_html = re.sub(
        r'<h1 id="[^"]*">(\s*🚀.*?</h1>)',
        r'<h1 class="doc-title" id="doc-title">\1',
        body_html,
        count=1,
    )

    return body_html


# ─────────────────────────────────────────────────────────────────────
# 3. HTML shell: cover (Template 03 Monolith) + body + print CSS
# ─────────────────────────────────────────────────────────────────────

HTML_TEMPLATE = r"""<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>%(title)s</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Playfair+Display:wght@400;700;900&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
<script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
<style>
/* ════════════════════════════════════════════════════════════════
   PRINT PAGE SETUP  (A4)
   ════════════════════════════════════════════════════════════════ */
@page {
  size: A4;
  margin: 22mm 18mm 20mm 18mm;
  @bottom-center {
    content: counter(page);
    font-family: 'Inter', sans-serif;
    font-size: 9pt;
    color: #6b7280;
  }
  @top-right {
    content: "CrowdShipping Algérie — Master Blueprint";
    font-family: 'Inter', sans-serif;
    font-size: 8pt;
    color: #9ca3af;
    letter-spacing: 0.5pt;
  }
}
@page :first { margin: 0; @top-right { content: ""; } @bottom-center { content: ""; } }

/* ════════════════════════════════════════════════════════════════
   ROOT TOKENS
   ════════════════════════════════════════════════════════════════ */
:root {
  --c-bg:        #ffffff;
  --c-paper:     #fafbfc;
  --c-ink:       #0f172a;     /* slate-900 — body text */
  --c-ink-soft:  #334155;     /* slate-700 */
  --c-muted:     #64748b;     /* slate-500 */
  --c-faint:     #94a3b8;     /* slate-400 */
  --c-line:      #e2e8f0;     /* slate-200 */
  --c-accent:    #1e3a5f;     /* deep indigo — Authority */
  --c-accent-2:  #2d5f8a;     /* indigo light */
  --c-accent-tint:#eef2f7;    /* indigo 5% */
  --c-danger:    #b91c1c;
  --c-warn:      #b45309;
  --c-ok:        #15803d;
  --c-code-bg:   #1e293b;     /* slate-800 */
  --c-code-ink:  #e2e8f0;
  --shadow-card: 0 1px 3px rgba(15,23,42,.06), 0 1px 2px rgba(15,23,42,.04);
}

/* ════════════════════════════════════════════════════════════════
   COVER  (Template 03 — Monolith, Authority intent, light bg)
   Resilient flow layout — NO absolute positioning, so the converter's
   anti-overflow heuristics cannot destroy it. Uses flex column flow
   with min-height to fill the page and push footer to bottom.
   ════════════════════════════════════════════════════════════════ */
.cover {
  page-break-after: always;
  break-after: page;
  position: relative;
  min-height: 253mm;          /* 297mm - 22mm top - ~22mm bottom page margin */
  background: var(--c-bg);
  background-image:
    linear-gradient(to right, rgba(30,58,95,.022) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(30,58,95,.022) 1px, transparent 1px);
  background-size: 40px 40px;
  color: var(--c-ink);
  box-sizing: border-box;
  font-family: 'Inter', sans-serif;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
}
.cover-bar {
  width: 38mm; height: 4pt;
  background: var(--c-accent);
  margin: 0 0 14mm 0;
}
.cover-content {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
}
.cover-kicker {
  font-size: 10pt;
  font-weight: 500;
  letter-spacing: 3pt;
  text-transform: uppercase;
  color: var(--c-muted);
  margin: 0 0 10mm 0;
}
.cover-title {
  font-family: 'Playfair Display', serif;
  font-weight: 900;
  font-size: 56pt;
  line-height: 1.02;
  color: var(--c-ink);
  letter-spacing: -1.5pt;
  margin: 0 0 8mm 0;
}
.cover-title .accent { color: var(--c-accent); }
.cover-subtitle {
  font-size: 16pt;
  font-weight: 400;
  line-height: 1.4;
  color: var(--c-ink-soft);
  margin: 0 0 12mm 0;
  max-width: 150mm;
}
.cover-summary {
  font-size: 10.5pt;
  font-weight: 400;
  line-height: 1.7;
  color: var(--c-muted);
  margin: 0 0 14mm 0;
  max-width: 145mm;
}
.cover-meta-block { margin: 0 0 10mm 0; }
.cover-meta-row {
  display: flex;
  margin-bottom: 4mm;
  font-size: 10pt;
}
.cover-meta-label {
  width: 38mm;
  flex-shrink: 0;
  color: var(--c-faint);
  text-transform: uppercase;
  letter-spacing: 1.5pt;
  font-size: 8.5pt;
  font-weight: 600;
  padding-top: 1pt;
}
.cover-meta-value {
  color: var(--c-ink-soft);
  font-weight: 500;
}
.cover-confidential {
  align-self: flex-start;
  font-size: 8pt; font-weight: 700;
  letter-spacing: 2pt; text-transform: uppercase;
  color: var(--c-danger);
  padding: 2pt 6pt;
  border: 0.8pt solid var(--c-danger);
  margin: 0 0 8mm 0;
}
.cover-footer {
  margin-top: auto;
  display: flex; justify-content: space-between; align-items: flex-end;
  font-size: 9pt; color: var(--c-faint);
  border-top: 0.5pt solid var(--c-line);
  padding-top: 4mm;
}

/* ════════════════════════════════════════════════════════════════
   BODY TYPOGRAPHY
   ════════════════════════════════════════════════════════════════ */
html, body {
  margin: 0; padding: 0;
  background: var(--c-bg);
  color: var(--c-ink);
  font-family: 'Inter', 'Segoe UI', sans-serif;
  font-size: 10.5pt;
  line-height: 1.55;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}

.body-content { padding: 0; }

/* Hide the document title h1 — replaced by the cover */
h1.doc-title { display: none !important; }

/* Part title — each PARTIE starts on a new page */
h1.part-title {
  page-break-before: always;
  break-before: page;
  font-family: 'Playfair Display', serif;
  font-size: 24pt;
  font-weight: 900;
  line-height: 1.15;
  color: var(--c-accent);
  margin: 0 0 6mm 0;
  padding: 0 0 4mm 0;
  border-bottom: 2pt solid var(--c-accent);
  letter-spacing: -0.3pt;
}

h2 {
  font-family: 'Inter', sans-serif;
  font-size: 15pt;
  font-weight: 700;
  color: var(--c-ink);
  margin: 8mm 0 3mm 0;
  padding-bottom: 1.5mm;
  border-bottom: 0.5pt solid var(--c-line);
  line-height: 1.3;
  page-break-after: avoid;
  break-after: avoid;
}

h3 {
  font-family: 'Inter', sans-serif;
  font-size: 12pt;
  font-weight: 700;
  color: var(--c-accent);
  margin: 5mm 0 2mm 0;
  line-height: 1.3;
  page-break-after: avoid;
  break-after: avoid;
}

h4 {
  font-size: 10.5pt;
  font-weight: 700;
  color: var(--c-ink-soft);
  margin: 4mm 0 1.5mm 0;
  page-break-after: avoid;
  break-after: avoid;
}

p { margin: 0 0 2.5mm 0; }
strong { font-weight: 700; color: var(--c-ink); }
em { font-style: italic; }

a {
  color: var(--c-accent-2);
  text-decoration: none;
  border-bottom: 0.3pt solid var(--c-accent-2);
}

ul, ol { margin: 0 0 3mm 0; padding-left: 6mm; }
li { margin-bottom: 1mm; }
li::marker { color: var(--c-accent-2); }

hr {
  border: none;
  border-top: 0.5pt solid var(--c-line);
  margin: 5mm 0;
}

/* Blockquote — used for the document intro & callouts */
blockquote {
  margin: 3mm 0;
  padding: 3mm 5mm;
  background: var(--c-accent-tint);
  border-left: 3pt solid var(--c-accent);
  color: var(--c-ink-soft);
  font-size: 10pt;
  line-height: 1.55;
  page-break-inside: avoid;
  break-inside: avoid;
}
blockquote p { margin: 0; }

/* ════════════════════════════════════════════════════════════════
   TABLES
   ════════════════════════════════════════════════════════════════ */
table {
  width: 100%;
  border-collapse: collapse;
  margin: 3mm 0 4mm 0;
  font-size: 9pt;
  line-height: 1.4;
  page-break-inside: auto;
  border: 0.5pt solid var(--c-line);
  table-layout: auto;
}
thead { display: table-header-group; }       /* repeat header on each page */
tr { page-break-inside: avoid; break-inside: avoid; }
th {
  background: var(--c-accent);
  color: #ffffff;
  font-weight: 600;
  text-align: left;
  padding: 2.2mm 3mm;
  border: 0.5pt solid var(--c-accent);
  font-size: 8.5pt;
  text-transform: uppercase;
  letter-spacing: 0.3pt;
  vertical-align: top;
}
td {
  padding: 2mm 3mm;
  border: 0.5pt solid var(--c-line);
  vertical-align: top;
  overflow-wrap: break-word;
  word-break: break-word;
}
tbody tr:nth-child(even) { background: #f8fafc; }
tbody tr:hover { background: var(--c-accent-tint); }

/* ════════════════════════════════════════════════════════════════
   CODE BLOCKS
   ════════════════════════════════════════════════════════════════ */
pre {
  background: var(--c-code-bg) !important;
  color: var(--c-code-ink);
  padding: 3.5mm 4mm;
  border-radius: 4pt;
  overflow-x: auto;
  font-size: 8.5pt;
  line-height: 1.5;
  margin: 3mm 0 4mm 0;
  page-break-inside: avoid;
  break-inside: avoid;
  font-family: 'JetBrains Mono', 'Cascadia Code', 'Consolas', monospace;
  border: 0.5pt solid #334155;
}
/* Pygments one-dark inline overrides — ensure readable on dark bg */
pre code { background: transparent !important; }
pre .codehilite { background: transparent !important; padding: 0 !important; }

code {
  font-family: 'JetBrains Mono', 'Consolas', monospace;
  font-size: 9pt;
  background: var(--c-accent-tint);
  color: var(--c-accent);
  padding: 0.5pt 3pt;
  border-radius: 2pt;
}
/* Code inside pre should NOT be tinted */
pre code {
  background: transparent;
  color: var(--c-code-ink);
  padding: 0;
  font-size: 8.5pt;
}

/* ════════════════════════════════════════════════════════════════
   MERMAID
   ════════════════════════════════════════════════════════════════ */
.mermaid {
  text-align: center;
  margin: 4mm 0;
  page-break-inside: avoid;
  break-inside: avoid;
}
.mermaid svg { max-width: 100% !important; height: auto !important; }

/* ════════════════════════════════════════════════════════════════
   TABLE OF CONTENTS
   ════════════════════════════════════════════════════════════════ */
.toc-title {
  font-family: 'Playfair Display', serif;
  font-size: 22pt; font-weight: 900;
  color: var(--c-accent);
  margin: 0 0 6mm 0;
  padding-bottom: 3mm;
  border-bottom: 2pt solid var(--c-accent);
}
.toc { margin: 0 0 8mm 0; padding: 0; list-style: none; }
.toc ul { margin: 1mm 0 2mm 0; padding-left: 6mm; list-style: none; }
.toc li { margin-bottom: 1.2mm; font-size: 10.5pt; }
.toc a { color: var(--c-ink-soft); border: none; font-weight: 500; }
.toc a:hover { color: var(--c-accent); }
.toc > li { font-weight: 600; font-size: 11pt; margin-top: 3mm; color: var(--c-accent); }
.toc > li > a { color: var(--c-accent); }

/* First TOC after cover — give it its own page */
h2#table-des-matieres,
h2.table-of-contents {
  page-break-before: always;
  break-before: page;
}

/* Prevent orphan headings at page bottom */
h1, h2, h3, h4 { page-break-after: avoid; break-after: avoid; }
img, svg, figure { max-width: 100%; }
</style>
</head>
<body>

<!-- ════════════════════════════════════════════════════════════════
     COVER PAGE  (Template 03 — Monolith, flow layout)
     ════════════════════════════════════════════════════════════════ -->
<section class="cover">
  <div class="cover-bar"></div>
  <div class="cover-content">
    <div class="cover-kicker">Document Fondateur · Investor Pitch &amp; Engineering Specs</div>
    <div class="cover-title">CrowdShipping<br><span class="accent">Algérie</span></div>
    <div class="cover-subtitle">Master Blueprint v1.0 — Plateforme P2P de transport de colis</div>
    <div class="cover-summary">
      Cahier des charges ultime pour la conception, le développement et le lancement d'une
      marketplace bilatérale reliant la diaspora algérienne aux voyageurs réguliers.
      Six parties exhaustives : Produit &amp; UX, Architecture Technique, Ingénierie Financière
      (escrow multi-devises), Conformité Douanière, Go-To-Market, et Analyse des Risques.
    </div>
    <div class="cover-meta-block">
      <div class="cover-meta-row">
        <div class="cover-meta-label">Date</div>
        <div class="cover-meta-value">6 août 2026</div>
      </div>
      <div class="cover-meta-row">
        <div class="cover-meta-label">Version</div>
        <div class="cover-meta-value">1.0 — Release Candidate</div>
      </div>
      <div class="cover-meta-row">
        <div class="cover-meta-label">Marché</div>
        <div class="cover-meta-value">Algérie (diaspora + domestique)</div>
      </div>
      <div class="cover-meta-row">
        <div class="cover-meta-label">Auteurs</div>
        <div class="cover-meta-value">Task Force pluridisciplinaire — Product, Droit Douanier, Fintech, Architecture</div>
      </div>
    </div>
    <div class="cover-confidential">Confidentiel — Founders &amp; Dev Team Only</div>
    <div class="cover-footer">
      <span>CrowdShipping Algérie</span>
      <span>Master Blueprint · v1.0</span>
    </div>
  </div>
</section>

<!-- ════════════════════════════════════════════════════════════════
     BODY
     ════════════════════════════════════════════════════════════════ -->
<main class="body-content">
%(body)s
</main>

<script>
  // Initialize Mermaid before Playwright captures the page.
  // html2pdf-next.js waits for .mermaid elements to contain an <svg>.
  if (typeof mermaid !== 'undefined') {
    mermaid.initialize({
      startOnLoad: true,
      theme: 'default',
      themeVariables: {
        primaryColor: '#1e3a5f',
        primaryTextColor: '#ffffff',
        primaryBorderColor: '#1e3a5f',
        lineColor: '#2d5f8a',
        secondaryColor: '#eef2f7',
        tertiaryColor: '#f8fafc',
        fontFamily: 'Inter, sans-serif',
        fontSize: '13px',
      },
      flowchart: { curve: 'basis', useMaxWidth: true },
      securityLevel: 'loose',
    });
  }
</script>
</body>
</html>
"""

# ─────────────────────────────────────────────────────────────────────
# 4. Build HTML
# ─────────────────────────────────────────────────────────────────────

def main():
    md_text = SRC.read_text(encoding="utf-8")
    body_html = convert_markdown(md_text)
    body_html = post_process(body_html)

    html_doc = (HTML_TEMPLATE
                .replace("%(title)s", "CrowdShipping Algérie — Master Blueprint v1.0")
                .replace("%(body)s", body_html))
    HTML_OUT.write_text(html_doc, encoding="utf-8")
    print(f"[ok] HTML written: {HTML_OUT}  ({HTML_OUT.stat().st_size:,} bytes)")

    # 5. Render via Playwright
    print(f"[..] Rendering PDF via Playwright...")
    cmd = [
        "node", str(HTML2PDF),
        str(HTML_OUT),
        "--output", str(PDF_OUT),
        "--title", "CrowdShipping Algérie — Master Blueprint v1.0",
    ]
    r = subprocess.run(cmd, capture_output=True, text=True)
    print(r.stdout)
    if r.returncode != 0:
        print("[!!] STDERR:", r.stderr, file=sys.stderr)
        sys.exit(1)
    if r.stderr.strip():
        print("[warn]", r.stderr.strip())

    print(f"[ok] PDF written: {PDF_OUT}  ({PDF_OUT.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()
