/** Preserve newlines and IME candidate confirmation; send only a plain Enter. */
export function shouldSendOnEnter(event: {
  key: string; shiftKey: boolean; altKey: boolean; isComposing: boolean; keyCode?: number;
}) {
  return event.key === 'Enter' && !event.shiftKey && !event.altKey && !event.isComposing && event.keyCode !== 229;
}
