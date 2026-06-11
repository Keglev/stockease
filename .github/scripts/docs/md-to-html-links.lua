-- Pandoc Lua filter for StockEase documentation pipeline.
--
-- Transformations:
--   1. Link: converts .md extensions to .html so internal links work in the
--      generated static site (Pandoc preserves .md extensions by default).
--   2. CodeBlock: converts mermaid fenced code blocks to raw HTML divs so
--      mermaid.js can find and render them (Pandoc wraps them in <code> by default).

function Link(el)
  if el.target:match("%.md$") then
    el.target = el.target:gsub("%.md$", ".html")
  elseif el.target:match("%.md#") then
    el.target = el.target:gsub("%.md#", ".html#")
  end
  return el
end

function CodeBlock(el)
  if el.classes:includes('mermaid') then
    return pandoc.RawBlock('html', '<div class="mermaid">\n' .. el.text .. '\n</div>')
  end
  return el
end