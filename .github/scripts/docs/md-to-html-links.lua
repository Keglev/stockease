-- Pandoc filter for the docs build: rewrites .md links (and .md#anchor links) to
-- .html so the published site resolves them, and wraps mermaid code blocks in the
-- div the browser runtime looks for.
--
-- build-docs.sh copies this file to <project-dir>/scripts/md-to-html-links.lua,
-- which is the path the sibling build scripts pass to pandoc.
function Link(el)
  el.target = el.target:gsub("%.md#", ".html#")
  el.target = el.target:gsub("%.md$", ".html")
  return el
end

function CodeBlock(el)
  if el.classes:includes('mermaid') then
    local html = '<div class="mermaid">\n' .. el.text .. '\n</div>'
    return pandoc.RawBlock('html', html)
  end
  return el
end
