# Browser MCP Patterns

Use Browser MCP only for sources that need session state, JavaScript rendering, filters, or login.

## Stable Calls

- For Playwright/Chrome `evaluate`, pass a JavaScript `function`, not a raw expression.
- Do not assume accessibility snapshot refs are valid selectors for a different MCP call. If a ref fails, switch to locator-based selection.
- Prefer stable locators: role/name, text, URL fragments, form labels, and fuzzy class selectors such as `[class*="jobs"]`.
- For cookie overlays and modals, close them with locator-based button clicks such as text/role matches for `Accept`, `Reject`, `Close`, or localized equivalents.
- If login is required, open the page in Browser MCP and wait for the user to authenticate manually.

## Avoid

- Do not replace sources marked browser-required in `config/source-registry.md` with plain web-search snippets.
- Do not rely on brittle full class names from browser-required sources or generated ATS pages.
- Do not click submit/apply/send/connect controls unless the active skill explicitly allows it and the user has confirmed the action in the same run.
