#!/usr/bin/env python3
"""NewDay Notebook build: one .jsx -> production HTML + test-rig HTML.

Applies the two Babel-standalone stripping rules:
  1. remove the top-level `import { ... } from "react";` line
  2. strip the `export default` keyword from `function TodoApp()`
The HTML wrapper (head, the `const {..} = React;` preamble, and the
`ReactDOM.createRoot(...).render(...)` postamble) is reused verbatim from
the existing shipped HTML so the two builds share an identical shell.
The test-rig build additionally flips `TEST_MODE` false -> true.
"""
import sys

JSX = "app.jsx"
TEMPLATE_HTML = "index.html"   # shell reused from the prod build
OUT_PROD = "index.html"
OUT_RIG = "testrig.html"

REACT_CONST = "const { useState, useRef, useCallback, useEffect } = React;"
REACTDOM = "    ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(TodoApp));"
IMPORT_LINE = 'import { useState, useRef, useCallback, useEffect } from "react";\n'


def transform_jsx(src):
    if IMPORT_LINE not in src:
        sys.exit("ERROR: react import line not found — strip rule 1 failed")
    body = src.replace(IMPORT_LINE, "", 1)
    if "export default function TodoApp()" not in body:
        sys.exit("ERROR: `export default function TodoApp()` not found — strip rule 2 failed")
    body = body.replace("export default function TodoApp()", "function TodoApp()", 1)
    return body.strip("\n")


def main():
    with open(JSX, encoding="utf-8") as f:
        jsx = f.read()
    with open(TEMPLATE_HTML, encoding="utf-8") as f:
        shell = f.read()

    if REACT_CONST not in shell or REACTDOM not in shell:
        sys.exit("ERROR: HTML shell markers not found")
    preamble = shell[: shell.index(REACT_CONST) + len(REACT_CONST)]
    postamble = shell[shell.index(REACTDOM):]

    body = transform_jsx(jsx)

    def assemble(b):
        return preamble + "\n\n" + b + "\n\n\n\n" + postamble

    # Production (flag off)
    if "const TEST_MODE = false;" not in body:
        sys.exit("ERROR: `const TEST_MODE = false;` not found in body")
    prod = assemble(body)

    # Test rig (flag on) + distinct title
    rig_body = body.replace("const TEST_MODE = false;", "const TEST_MODE = true;", 1)
    rig = assemble(rig_body).replace(
        "<title>NewDay Notebook v1.8</title>",
        "<title>NewDay Notebook v1.8 — TEST RIG</title>", 1)

    for name, out in ((OUT_PROD, prod), (OUT_RIG, rig)):
        assert IMPORT_LINE.strip() not in out, f"{name}: react import leaked"
        assert "export default" not in out, f"{name}: export default leaked"
        assert "function TodoApp()" in out, f"{name}: TodoApp missing"
        assert out.count(REACTDOM) == 1, f"{name}: ReactDOM render count wrong"
    assert "const TEST_MODE = false;" in prod and "const TEST_MODE = true;" not in prod, "prod flag wrong"
    assert "const TEST_MODE = true;" in rig and "const TEST_MODE = false;" not in rig, "rig flag wrong"

    with open(OUT_PROD, "w", encoding="utf-8") as f:
        f.write(prod)
    with open(OUT_RIG, "w", encoding="utf-8") as f:
        f.write(rig)
    print(f"OK  production -> {OUT_PROD}  ({len(prod):,} bytes)")
    print(f"OK  test-rig   -> {OUT_RIG}  ({len(rig):,} bytes)")


if __name__ == "__main__":
    main()
