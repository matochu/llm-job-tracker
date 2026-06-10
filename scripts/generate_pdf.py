#!/usr/bin/env python3
"""
Generate a resume PDF from a Markdown file, matching the cv.pdf visual style.

Usage:
  python3 scripts/generate_pdf.py data/companies/dlocal/resume.md
  python3 scripts/generate_pdf.py data/companies/dlocal/resume.md output.pdf
"""

import sys
import subprocess
import re
import os
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent
CSS_FILE = SCRIPT_DIR / "resume.css"
REPO_VENV_PYTHON = SCRIPT_DIR / ".venv" / "bin" / "python3"
TMP_VENV_PYTHON = Path("/tmp/resume-venv/bin/python3")


def ensure_weasyprint():
    """Run via venv python if weasyprint not available in current env."""
    try:
        import weasyprint  # noqa: F401
        return False  # already available
    except ImportError:
        for python_bin in (REPO_VENV_PYTHON, TMP_VENV_PYTHON):
            if python_bin.exists():
                os.execv(str(python_bin), [str(python_bin)] + sys.argv)
        sys.exit(
            "weasyprint not found. Run: python3 -m venv /tmp/resume-venv && "
            "/tmp/resume-venv/bin/pip install weasyprint"
        )


def parse_header(md_text):
    """Extract name and contact block from the top of the markdown."""
    lines = md_text.splitlines()
    name = ""
    contact_lines = []
    body_start = 0

    for i, line in enumerate(lines):
        stripped = line.strip()
        if not name and stripped.startswith("# "):
            name = stripped[2:].strip()
        elif name and stripped == "---":
            body_start = i + 1
            break
        elif name and stripped:
            contact_lines.append(stripped)

    body = "\n".join(lines[body_start:])
    return name, contact_lines, body


def contact_to_html(contact_lines):
    """Convert contact lines to HTML, auto-linking URLs and emails."""
    parts = []
    for line in contact_lines:
        # auto-link URLs
        line = re.sub(
            r'(https?://[^\s]+)',
            r'<a href="\1">\1</a>',
            line
        )
        # auto-link emails
        line = re.sub(
            r'([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})',
            r'<a href="mailto:\1">\1</a>',
            line
        )
        parts.append(f'<p class="resume-contact">{line}</p>')
    return "\n".join(parts)


def md_to_html_body(md_text):
    """Convert markdown body to HTML using pandoc."""
    result = subprocess.run(
        ["pandoc", "--from", "markdown", "--to", "html", "-"],
        input=md_text,
        capture_output=True,
        text=True
    )
    if result.returncode != 0:
        sys.exit(f"pandoc error: {result.stderr}")
    return result.stdout


def post_process_html(html):
    """Fix rendering issues in pandoc output."""
    # Mark paragraphs inside Education/Hobbies sections so h3+p date rule
    # doesn't turn degree/interest lines gray & tiny.
    # Strategy: tag every h3+p that is inside Education or Hobbies with class="section-sub"
    # by walking the HTML with a simple state machine on <h2>/<h3>/<p> tags.
    lines = html.splitlines(keepends=True)
    result = []
    in_education_or_hobbies = False
    h3_seen = False
    for line in lines:
        stripped = line.strip()
        if re.search(r'<h2[^>]*>(Education|Hobbies)', stripped):
            in_education_or_hobbies = True
            h3_seen = False
        elif re.search(r'<h2', stripped):
            in_education_or_hobbies = False
            h3_seen = False
        if in_education_or_hobbies and re.search(r'<h3', stripped):
            h3_seen = True
        if in_education_or_hobbies and h3_seen and re.match(r'\s*<p>', line):
            line = line.replace('<p>', '<p class="section-sub">', 1)
            h3_seen = False  # only the first <p> after <h3> needs the override
        result.append(line)
    return ''.join(result)


def build_full_html(name, contact_html, body_html, css_content):
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
{css_content}
</style>
</head>
<body>

<div class="resume-name">{name}</div>
{contact_html}

{body_html}

</body>
</html>"""


def main():
    ensure_weasyprint()
    from weasyprint import HTML

    if len(sys.argv) < 2:
        sys.exit("Usage: generate_pdf.py <input.md> [output.pdf]")

    input_path = Path(sys.argv[1])
    if not input_path.exists():
        sys.exit(f"File not found: {input_path}")

    if len(sys.argv) >= 3:
        output_path = Path(sys.argv[2])
        # If only a filename was given (no directory), place it alongside the input
        if not output_path.parent or str(output_path.parent) == ".":
            output_path = input_path.parent / output_path.name
    else:
        output_path = input_path.with_suffix(".pdf")

    md_text = input_path.read_text(encoding="utf-8")
    css_content = CSS_FILE.read_text(encoding="utf-8")

    name, contact_lines, body_md = parse_header(md_text)
    contact_html = contact_to_html(contact_lines)
    body_html = md_to_html_body(body_md)
    body_html = post_process_html(body_html)

    full_html = build_full_html(name, contact_html, body_html, css_content)

    HTML(string=full_html, base_url=str(input_path.parent)).write_pdf(str(output_path))
    print(f"✓ PDF generated: {output_path}")


if __name__ == "__main__":
    main()
