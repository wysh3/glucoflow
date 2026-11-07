/** Segment spoken text without dropping words or splitting UTF-16 characters. */
export function speechChunks(text: string, limit: number): string[] {
  if (!Number.isInteger(limit) || limit < 2) throw new Error('Invalid speech segment limit.');
  const result: string[] = [];
  let remaining = text.trim();
  while (remaining.length) {
    let end = Math.min(limit, remaining.length);
    if (end < remaining.length) {
      const whitespace = remaining.slice(0, end + 1).search(/\s+\S*$/u);
      if (whitespace > end / 2) end = whitespace;
      const previous = remaining.charCodeAt(end - 1);
      if (previous >= 0xd800 && previous <= 0xdbff) end--;
    }
    const chunk = remaining.slice(0, end).trim();
    if (chunk) result.push(chunk);
    remaining = remaining.slice(end).trimStart();
  }
  return result;
}
