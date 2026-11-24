export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function inline(text) {
  // Only explicitly supported markup becomes HTML. Raw HTML is always text.
  const pattern = /\[([^\]\n]+)\]\(([^\s)]+)\)|\*\*([^*\n]+)\*\*|`([^`\n]+)`/g;
  let html = '', end = 0;
  for (const match of text.matchAll(pattern)) {
    html += escapeHtml(text.slice(end, match.index));
    if (match[1]) {
      let url;
      try { url = new URL(match[2]); } catch {}
      html += url && ['https:', 'http:', 'mailto:'].includes(url.protocol)
        ? `<a href="${escapeHtml(url.href)}" rel="noopener noreferrer">${escapeHtml(match[1])}</a>`
        : escapeHtml(match[0]);
    } else if (match[3]) html += `<strong>${escapeHtml(match[3])}</strong>`;
    else html += `<code>${escapeHtml(match[4])}</code>`;
    end = match.index + match[0].length;
  }
  return html + escapeHtml(text.slice(end));
}

export function renderMarkdown(source) {
  let html = '', paragraph = [], list = [];
  const flushParagraph = () => { if (paragraph.length) html += `<p>${paragraph.map(inline).join('<br>')}</p>`; paragraph = []; };
  const flushList = () => { if (list.length) html += `<ul>${list.map(t => `<li>${inline(t)}</li>`).join('')}</ul>`; list = []; };
  for (const line of String(source ?? '').replace(/\r\n?/g, '\n').split('\n')) {
    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    const item = /^[-*]\s+(.+)$/.exec(line);
    if (!line.trim()) { flushParagraph(); flushList(); }
    else if (heading) { flushParagraph(); flushList(); const level = heading[1].length === 3 ? 3 : 2; html += `<h${level}>${inline(heading[2])}</h${level}>`; }
    else if (item) { flushParagraph(); list.push(item[1]); }
    else { flushList(); paragraph.push(line); }
  }
  flushParagraph(); flushList();
  return html;
}

export const formatDate = value => new Intl.DateTimeFormat('de-DE', {day:'numeric',month:'long',year:'numeric',timeZone:'Europe/Berlin'}).format(new Date(value));
