import { marked } from 'marked';

function resolveUrl(url, baseUrl) {
  if (!url || url.startsWith('http://') || url.startsWith('https://') || url.startsWith('mailto:')) {
    return url;
  }
  const clean = url.replace(/^(\.\/|\/)/, '').replace(/ /g, '%20');
  return `${baseUrl}/${clean}`;
}

function preprocess(markdown, repoFullName, defaultBranch) {
  if (!markdown) return '';

  const [owner, repo] = repoFullName.split('/');
  const branch = defaultBranch || 'main';
  const rawBaseUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}`;
  const githubBaseUrl = `https://github.com/${owner}/${repo}/blob/${branch}`;

  let text = markdown;

  text = text.replace(/<picture[^>]*>/gi, '');
  text = text.replace(/<\/picture>/gi, '');
  text = text.replace(/<source[^>]*\/?>/gi, '');

  text = text.replace(
    /<a\s+[^>]*href\s*=\s*["']([^"']*)["'][^>]*>\s*(<img[^>]*>)\s*<\/a>/gi,
    (match, href, imgTag) => {
      const srcMatch = imgTag.match(/src\s*=\s*["']([^"']*)["']/i);
      const altMatch = imgTag.match(/alt\s*=\s*["']([^"']*)["']/i);
      const rawSrc = srcMatch ? srcMatch[1] : '';
      const alt = altMatch ? altMatch[1] : 'image';
      const resolvedSrc = resolveUrl(rawSrc, rawBaseUrl);
      const resolvedHref = resolveUrl(href, githubBaseUrl);
      return `<a href="${resolvedHref}"><img src="${resolvedSrc}" alt="${alt}"></a>`;
    }
  );

  text = text.replace(
    /<img\s+[^>]*src\s*=\s*["']([^"']*)["'][^>]*\/?>/gi,
    (match, src) => {
      const altMatch = match.match(/alt\s*=\s*["']([^"']*)["']/i);
      const alt = altMatch ? altMatch[1] : 'image';
      const resolvedSrc = resolveUrl(src, rawBaseUrl);
      return `<img src="${resolvedSrc}" alt="${alt}">`;
    }
  );

  text = text.replace(
    /<a\s+[^>]*href\s*=\s*["']([^"']*)["'][^>]*>([^<]*)<\/a>/gi,
    (match, href, content) => {
      const resolvedHref = resolveUrl(href, githubBaseUrl);
      return `<a href="${resolvedHref}">${content.trim()}</a>`;
    }
  );

  text = text.replace(/<[^>]*>/g, '');

  text = text.replace(
    /^[ \t]*\.\.[ \t]+image::?[ \t]+(`[^`]+`|\S+)[ \t]*\n?((?:[ \t]+:[a-zA-Z_]+:[^\n]*\n?)*)/gm,
    (match, urlRaw, opts) => {
      const url = urlRaw.replace(/^`|`$/g, '');
      let alt = '';
      let target = '';
      if (opts) {
        const altM = opts.match(/:alt:[ \t]*([^\n]+)/);
        const tgtM = opts.match(/:target:[ \t]*([^\n]+)/);
        if (altM) alt = altM[1].trim();
        if (tgtM) target = tgtM[1].trim();
      }
      const resolvedUrl = resolveUrl(url, rawBaseUrl);
      const img = `<img src="${resolvedUrl}" alt="${alt || 'image'}">`;
      if (target) {
        const resolvedTarget = resolveUrl(target, githubBaseUrl);
        return `<a href="${resolvedTarget}">${img}</a>`;
      }
      return img;
    }
  );

  text = text.replace(/:[a-zA-Z_]+:`([^`]+)`/g, (match, content) => content);

  text = text.replace(
    /!\[([^\]]*)\]\(([^)]+)\)/g,
    (match, alt, url) => {
      const resolved = resolveUrl(url, rawBaseUrl);
      return resolved !== url ? `![${alt}](${resolved})` : match;
    }
  );

  text = text.replace(
    /\[([^\]]*)\]\(([^)]+)\)/g,
    (match, textContent, url) => {
      const resolved = resolveUrl(url, githubBaseUrl);
      return resolved !== url ? `[${textContent}](${resolved})` : match;
    }
  );

  return text;
}

function getStyle(isDark) {
  if (isDark) {
    return `
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif;
  font-size: 15px;
  line-height: 1.6;
  color: #e6edf3;
  background-color: #161b22;
  padding: 16px;
  word-wrap: break-word;
}
img { max-width: 100%; height: auto; border-radius: 6px; margin-bottom: 12px; }
a { color: #58a6ff; text-decoration: none; }
a:hover { text-decoration: underline; }
h1, h2, h3, h4, h5, h6 {
  margin-top: 20px; margin-bottom: 10px; font-weight: 600; line-height: 1.25;
}
h1 { font-size: 1.8em; padding-bottom: 8px; border-bottom: 1px solid #30363d; }
h2 { font-size: 1.4em; padding-bottom: 6px; border-bottom: 1px solid #30363d; }
h3 { font-size: 1.15em; }
h4 { font-size: 1em; }
p { margin-bottom: 12px; }
ul, ol { padding-left: 2em; margin-bottom: 12px; }
li { margin-bottom: 4px; }
blockquote {
  padding: 0 1em; color: #8b949e; border-left: 4px solid #30363d; margin-bottom: 12px;
}
code {
  font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
  font-size: 0.85em; padding: 2px 5px; background-color: rgba(110,118,129,0.4); border-radius: 4px;
}
pre { margin-bottom: 12px; border-radius: 8px; overflow: hidden; font-size: 0.85em; line-height: 1.45; position: relative; }
pre code { padding: 0; background: none; font-size: inherit; }
pre > code { display: block; padding: 16px; overflow-x: auto; background-color: #161b22; color: #e6edf3; }
.hljs-lang { position: absolute; top: 4px; right: 10px; font-size: 11px; color: #8b949e; font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace; }
table { border-collapse: collapse; margin-bottom: 12px; width: 100%; }
th, td { padding: 6px 10px; border: 1px solid #30363d; text-align: left; }
th { background-color: #161b22; font-weight: 600; }
tr:nth-child(even) { background-color: #161b22; }
hr { border: none; border-top: 1px solid #30363d; margin: 20px 0; }
input[type="checkbox"] { margin-right: 6px; }
.task-list-item { list-style: none; }
.task-list-item input { margin: 0 0.2em 0.25em -1.6em; }
`;
  }
  return `
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif;
  font-size: 15px;
  line-height: 1.6;
  color: #1f2328;
  background-color: #ffffff;
  padding: 16px;
  word-wrap: break-word;
}
img { max-width: 100%; height: auto; border-radius: 6px; margin-bottom: 12px; }
a { color: #0969da; text-decoration: none; }
a:hover { text-decoration: underline; }
h1, h2, h3, h4, h5, h6 {
  margin-top: 20px; margin-bottom: 10px; font-weight: 600; line-height: 1.25;
}
h1 { font-size: 1.8em; padding-bottom: 8px; border-bottom: 1px solid #d0d7de; }
h2 { font-size: 1.4em; padding-bottom: 6px; border-bottom: 1px solid #d0d7de; }
h3 { font-size: 1.15em; }
h4 { font-size: 1em; }
p { margin-bottom: 12px; }
ul, ol { padding-left: 2em; margin-bottom: 12px; }
li { margin-bottom: 4px; }
blockquote {
  padding: 0 1em; color: #656d76; border-left: 4px solid #d0d7de; margin-bottom: 12px;
}
code {
  font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
  font-size: 0.85em; padding: 2px 5px; background-color: rgba(175,184,193,0.2); border-radius: 4px;
}
pre { margin-bottom: 12px; border-radius: 8px; overflow: hidden; font-size: 0.85em; line-height: 1.45; position: relative; }
pre code { padding: 0; background: none; font-size: inherit; }
pre > code { display: block; padding: 16px; overflow-x: auto; background-color: #0d1117; color: #e6edf3; }
.hljs-lang { position: absolute; top: 4px; right: 10px; font-size: 11px; color: #8b949e; font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace; }
table { border-collapse: collapse; margin-bottom: 12px; width: 100%; }
th, td { padding: 6px 10px; border: 1px solid #d0d7de; text-align: left; }
th { background-color: #f6f8fa; font-weight: 600; }
tr:nth-child(even) { background-color: #f6f8fa; }
hr { border: none; border-top: 1px solid #d0d7de; margin: 20px 0; }
input[type="checkbox"] { margin-right: 6px; }
.task-list-item { list-style: none; }
.task-list-item input { margin: 0 0.2em 0.25em -1.6em; }
`;
}

function buildHtml(markdownContent, isDark) {
  const html = marked.parse(markdownContent, {
    breaks: true,
    gfm: true,
  });

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
  <style>${getStyle(isDark)}</style>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/styles/github-dark.min.css">
  <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/highlight.min.js"></script>
</head>
<body>
  <div class="markdown-body">
    ${html}
  </div>
  <script>
    hljs.highlightAll();

    document.querySelectorAll('pre code').forEach(function(block) {
      var pre = block.parentElement;
      var lang = block.className.match(/language-([\\w]+)/);
      if (lang) {
        var badge = document.createElement('span');
        badge.className = 'hljs-lang';
        badge.textContent = lang[1];
        pre.appendChild(badge);
      }
    });

    var maxHeight = 0;
    var stopPolling = false;

    function getHeight() {
      return Math.max(
        document.body.scrollHeight,
        document.documentElement.scrollHeight,
        document.body.offsetHeight,
        document.documentElement.offsetHeight
      );
    }

    function reportHeight() {
      var h = Math.ceil(getHeight());
      if (h > maxHeight) {
        maxHeight = h;
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'height', height: h }));
      }
    }

    var pollCount = 0;
    function startPolling() {
      var timer = setInterval(function() {
        pollCount++;
        reportHeight();
        if (pollCount > 100) {
          clearInterval(timer);
          stopPolling = true;
        }
      }, 100);
    }

    function waitForStable() {
      var last = getHeight();
      var stableCount = 0;
      var check = setInterval(function() {
        var cur = getHeight();
        if (Math.abs(cur - last) < 2) {
          stableCount++;
        } else {
          stableCount = 0;
        }
        last = cur;
        reportHeight();
        if (stableCount >= 15 || stopPolling) {
          clearInterval(check);
          reportHeight();
        }
      }, 200);
    }

    var imgs = document.querySelectorAll('img');
    var imgLoadCount = 0;
    var totalImgs = imgs.length;

    function onImgDone() {
      imgLoadCount++;
      reportHeight();
      if (imgLoadCount >= totalImgs) {
        waitForStable();
      }
    }

    if (totalImgs === 0) {
      reportHeight();
      waitForStable();
    } else {
      imgs.forEach(function(img) {
        if (img.complete && img.naturalWidth > 0) {
          onImgDone();
        } else {
          img.addEventListener('load', onImgDone);
          img.addEventListener('error', onImgDone);
        }
      });
    }

    reportHeight();

    var observer = new MutationObserver(function() {
      reportHeight();
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['src', 'style', 'width', 'height'],
    });

    startPolling();
    setTimeout(reportHeight, 5000);
    setTimeout(reportHeight, 10000);
  </script>
</body>
</html>`;
}

export function renderReadme(markdown, repoFullName, defaultBranch, isDark) {
  if (!markdown) return null;
  const preprocessed = preprocess(markdown, repoFullName, defaultBranch);
  return buildHtml(preprocessed, isDark);
}
