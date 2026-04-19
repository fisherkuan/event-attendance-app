document.addEventListener('DOMContentLoaded', async () => {
    const faqContainer = document.getElementById('faq-content');
    if (!faqContainer) return;

    try {
        const response = await fetch('faq.md');
        if (!response.ok) throw new Error(`Failed to load FAQ (status ${response.status})`);
        const markdownText = await response.text();
        faqContainer.innerHTML = renderFaqMarkdown(markdownText);
    } catch (error) {
        console.error('Error loading FAQ content:', error);
        faqContainer.innerHTML = '<p class="error-message">Unable to load FAQ content right now. Please try again later.</p>';
    } finally {
        faqContainer.setAttribute('aria-busy', 'false');
    }
});

/**
 * Renders FAQ markdown into accordion structure.
 * - `# Title` and `## Section` → section headers (<h2>).
 * - `### Question` → <details><summary>Question</summary>...answer...</details>.
 * Inline markdown: **bold**, *italic*, [label](url), line breaks.
 */
function renderFaqMarkdown(markdown) {
    const lines = markdown.split(/\r?\n/);
    let out = '';

    let currentAnswer = [];        // lines of current FAQ item answer
    let currentQuestion = null;    // current question text
    let listBuffer = null;         // { type: 'ol'|'ul', items: [] }

    const flushList = () => {
        if (!listBuffer || listBuffer.items.length === 0) {
            listBuffer = null;
            return '';
        }
        const tag = listBuffer.type;
        let html = `<${tag}>`;
        listBuffer.items.forEach(i => { html += `<li>${inline(i)}</li>`; });
        html += `</${tag}>`;
        listBuffer = null;
        return html;
    };

    const flushAnswer = () => {
        if (currentQuestion === null) return '';
        let ansHtml = '';
        let paraBuf = [];

        const flushPara = () => {
            if (paraBuf.length === 0) return;
            const text = paraBuf.join(' ').trim();
            if (text) ansHtml += `<p>${inline(text)}</p>`;
            paraBuf = [];
        };

        currentAnswer.forEach(line => {
            const ul = line.match(/^\s*[-*+]\s+(.*)$/);
            const ol = line.match(/^\s*(\d+)\.\s+(.*)$/);
            if (ul || ol) {
                flushPara();
                const type = ol ? 'ol' : 'ul';
                if (!listBuffer || listBuffer.type !== type) {
                    ansHtml += flushList();
                    listBuffer = { type, items: [] };
                }
                listBuffer.items.push(ol ? ol[2] : ul[1]);
            } else if (line.trim() === '') {
                flushPara();
                ansHtml += flushList();
            } else {
                ansHtml += flushList();
                paraBuf.push(line.trim());
            }
        });
        flushPara();
        ansHtml += flushList();

        const html = `
            <details class="faq-item">
                <summary>${inline(currentQuestion)}</summary>
                <div class="faq-answer">${ansHtml}</div>
            </details>
        `;
        currentQuestion = null;
        currentAnswer = [];
        return html;
    };

    for (const line of lines) {
        const h1 = line.match(/^#\s+(.*)$/);
        const h2 = line.match(/^##\s+(.*)$/);
        const h3 = line.match(/^###\s+(.*)$/);

        if (h3) {
            out += flushAnswer();
            currentQuestion = h3[1].trim();
            currentAnswer = [];
        } else if (h2) {
            out += flushAnswer();
            out += `<h2 class="faq-section-header" style="margin-top:1.5rem;margin-bottom:0.5rem;font-size:14px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.08em;">${inline(h2[1].trim())}</h2>`;
        } else if (h1) {
            // skip — handled in page hero
        } else if (currentQuestion !== null) {
            currentAnswer.push(line);
        }
        // otherwise ignore preamble text before first ###
    }
    out += flushAnswer();
    return out;
}

function inline(text) {
    if (!text) return '';
    // Links [label](url)
    const withLinks = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (m, label, href) => {
        const safeHref = href.trim().replace(/"/g, '&quot;');
        return `<a href="${safeHref}" target="_blank" rel="noopener noreferrer">${inline(label)}</a>`;
    });
    return withLinks
        .replace(/__(.*?)__/g, '<strong>$1</strong>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>');
}
