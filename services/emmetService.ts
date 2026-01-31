
// A lightweight Emmet-like parser for the browser
// Supports: !, tag#id, tag.class, parent>child, tag*n

export const expandAbbreviation = (abbr: string): string | null => {
  if (!abbr) return null;

  // 1. Basic HTML5 Boilerplate
  if (abbr === '!') {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Document</title>
</head>
<body>
  $0
</body>
</html>`;
  }

  // Regex to validate if string looks like an emmet abbreviation
  // Allow a-z, 0-9, #, ., >, *, -, +
  const emmetRegex = /^[a-z0-9#.>*\-+]+$/i;
  if (!emmetRegex.test(abbr)) return null;

  // If it's just a simple tag like "div" or "span", usually we let standard autocomplete handle it,
  // but if it has special chars like >, ., #, * it's definitely emmet.
  const isComplex = /[#.>*\-+]/.test(abbr);
  if (!isComplex) return null; 

  try {
    return parseGroup(abbr);
  } catch (e) {
    return null;
  }
};

const parseGroup = (str: string): string => {
  // Handle Child Combinator '>'
  if (str.includes('>')) {
    const parts = str.split('>');
    // Process right to left to wrap children
    let content = '';
    // The inner-most element should get the cursor if no other content
    let hasCursor = false;
    
    for (let i = parts.length - 1; i >= 0; i--) {
       if (i === parts.length - 1) {
           content = parseNode(parts[i], '$0');
           hasCursor = true;
       } else {
           content = parseNode(parts[i], content);
       }
    }
    return content;
  }
  
  return parseNode(str, '$0');
};

const parseNode = (str: string, innerContent: string): string => {
  // Handle Multiplication '*'
  if (str.includes('*')) {
    const [base, countStr] = str.split('*');
    const count = parseInt(countStr, 10);
    if (isNaN(count)) return str;
    
    let result = '';
    for (let i = 0; i < count; i++) {
        // Only put the cursor/innerContent in the first item or handle differently?
        // Emmet standard behavior: usually content goes in each, but cursor in first.
        // For simplicity, we just put the inner content in each.
        // But if innerContent has $0, we will have multiple cursors which is bad.
        // Let's replace $0 with empty string for subsequent items.
        const content = i === 0 ? innerContent : innerContent.replace('$0', '');
        result += parseSingleNode(base, content);
    }
    return result;
  }

  return parseSingleNode(str, innerContent);
};

const parseSingleNode = (str: string, innerContent: string): string => {
  // Parsing logic for tag#id.class.class
  const parts = str.split(/([#.])/)
  
  let tagName = parts[0] || 'div'; // Default to div if empty string provided (e.g. .class)
  if (tagName === '') tagName = 'div';
  
  let id = '';
  let classes: string[] = [];

  for (let i = 1; i < parts.length; i += 2) {
    const type = parts[i];
    const val = parts[i+1];
    if (type === '#') id = val;
    if (type === '.') classes.push(val);
  }

  let attributes = '';
  if (id) attributes += ` id="${id}"`;
  if (classes.length > 0) attributes += ` class="${classes.join(' ')}"`;

  // Self closing tags handling
  const voidTags = ['img', 'input', 'br', 'hr', 'meta', 'link'];
  if (voidTags.includes(tagName)) {
      return `<${tagName}${attributes} />`;
  }

  // formatting
  if (innerContent.includes('\n') || innerContent.includes('<')) {
      return `<${tagName}${attributes}>\n\t${innerContent.replace(/\n/g, '\n\t')}\n</${tagName}>`;
  }
  
  return `<${tagName}${attributes}>${innerContent}</${tagName}>`;
};

// Helper to extract the abbreviation from the current line/cursor position
export const extractAbbreviation = (textBeforeCursor: string): string => {
    // Find the last index of a character that is NOT allowed in emmet
    // Allowed: a-z, 0-9, #, ., >, *, -, +, $
    // We iterate backwards to find the start of the abbreviation
    let i = textBeforeCursor.length - 1;
    while (i >= 0) {
        const char = textBeforeCursor[i];
        if (!/[a-zA-Z0-9#.>*\-+$]/.test(char)) {
            break;
        }
        i--;
    }
    // Slice from the character after the non-allowed char
    return textBeforeCursor.slice(i + 1);
};
