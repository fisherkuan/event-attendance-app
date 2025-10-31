document.addEventListener('DOMContentLoaded', async () => {
    const faqContainer = document.getElementById('faq-content');
    const faqShell = document.querySelector('.faq-content-shell');

    if (!faqContainer) {
        return;
    }

    try {
        const response = await fetch('faq.md');
        if (!response.ok) {
            throw new Error(`Failed to load FAQ content (status ${response.status})`);
        }

        const markdownText = await response.text();
        faqContainer.innerHTML = renderMarkdown(markdownText);
    } catch (error) {
        console.error('Error loading FAQ content:', error);
        faqContainer.innerHTML = '<p class="faq-error">Unable to load FAQ content right now. Please try again later.</p>';
    } finally {
        if (faqShell) {
            faqShell.setAttribute('aria-busy', 'false');
        }
    }
});

function renderMarkdown(markdownText) {
    const lines = markdownText.split(/\r?\n/);
    let htmlOutput = '';
    let paragraphBuffer = [];
    let tableBuffer = [];
    let listBuffer = null;

    const flushParagraph = () => {
        if (paragraphBuffer.length === 0) {
            return;
        }

        const paragraphText = paragraphBuffer.join(' ').trim();
        if (paragraphText) {
            htmlOutput += `<p>${convertInlineMarkdown(paragraphText)}</p>`;
        }
        paragraphBuffer = [];
    };

    const flushList = () => {
        if (!listBuffer || listBuffer.items.length === 0) {
            listBuffer = null;
            return;
        }

        const tagName = listBuffer.type === 'ol' ? 'ol' : 'ul';
        htmlOutput += `<${tagName}>`;
        listBuffer.items.forEach(item => {
            htmlOutput += `<li>${convertInlineMarkdown(item)}</li>`;
        });
        htmlOutput += `</${tagName}>`;
        listBuffer = null;
    };

    const flushTable = () => {
        if (tableBuffer.length === 0) {
            return;
        }

        const rows = tableBuffer.map(line => line.trim());
        tableBuffer = [];

        if (rows.length === 0) {
            return;
        }

        const isDivider = row => /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/.test(row);
        const cleanRow = row => row.replace(/^\s*\|?/, '').replace(/\|?\s*$/, '');
        const splitCells = row => cleanRow(row).split('|').map(cell => convertInlineMarkdown(cell.trim()));

        let headerCells = [];
        let bodyRows = [];

        if (rows.length > 1 && isDivider(rows[1])) {
            headerCells = splitCells(rows[0]);
            bodyRows = rows.slice(2).map(splitCells);
        } else {
            headerCells = splitCells(rows[0]);
            bodyRows = rows.slice(1).map(splitCells);
        }

        htmlOutput += '<table>';
        if (headerCells.length > 0) {
            htmlOutput += '<thead><tr>';
            headerCells.forEach(cell => {
                htmlOutput += `<th>${cell}</th>`;
            });
            htmlOutput += '</tr></thead>';
        }

        if (bodyRows.length > 0) {
            htmlOutput += '<tbody>';
            bodyRows.forEach(cells => {
                htmlOutput += '<tr>';
                cells.forEach(cell => {
                    htmlOutput += `<td>${cell}</td>`;
                });
                htmlOutput += '</tr>';
            });
            htmlOutput += '</tbody>';
        }
        htmlOutput += '</table>';
    };

    const isTableLine = line => {
        const trimmed = line.trim();
        if (!trimmed) {
            return false;
        }
        if (!trimmed.includes('|')) {
            return false;
        }
        const pipeCount = (trimmed.match(/\|/g) || []).length;
        if (pipeCount < 2) {
            return false;
        }
        return true;
    };

    lines.forEach(line => {
        const unorderedMatch = line.match(/^\s*[-*+]\s+(.*)$/);
        const orderedMatch = line.match(/^\s*(\d+)\.\s+(.*)$/);

        if (tableBuffer.length > 0 && !isTableLine(line) && line.trim() !== '') {
            flushTable();
        }

        if (isTableLine(line)) {
            flushParagraph();
            flushList();
            tableBuffer.push(line);
            return;
        }

        if (/^#{1,6}\s/.test(line)) {
            flushParagraph();
            flushTable();
            flushList();
            const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
            if (!headingMatch) {
                return;
            }

            const level = headingMatch[1].length;
            const content = headingMatch[2].trim();
            htmlOutput += `<h${level}>${convertInlineMarkdown(content)}</h${level}>`;
        } else if (unorderedMatch || orderedMatch) {
            flushParagraph();
            flushTable();
            const type = orderedMatch ? 'ol' : 'ul';
            const itemText = orderedMatch ? orderedMatch[2].trim() : unorderedMatch[1].trim();

            if (!listBuffer || listBuffer.type !== type) {
                flushList();
                listBuffer = { type, items: [] };
            }
            listBuffer.items.push(itemText);
        } else if (line.trim() === '') {
            flushParagraph();
            flushTable();
            flushList();
        } else {
            if (listBuffer) {
                flushList();
            }
            paragraphBuffer.push(line.trim());
        }
    });

    flushParagraph();
    flushTable();
    flushList();
    return htmlOutput;
}

function convertInlineMarkdown(text) {
    if (!text) {
        return '';
    }

    const linkPattern = /\[([^\]]+)]\(([^)]+)\)/g;

    const withLinks = text.replace(linkPattern, (match, label, href) => {
        const safeHref = href.trim().replace(/"/g, '&quot;');
        const linkText = convertInlineMarkdown(label);
        return `<a href="${safeHref}" target="_blank" rel="noopener noreferrer">${linkText}</a>`;
    });

    return withLinks
        .replace(/__(.*?)__/g, '<strong>$1</strong>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>');
}
