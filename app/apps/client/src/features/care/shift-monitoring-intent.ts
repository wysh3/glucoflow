/** Only the explicit bounded workflow phrase is routed without a model request. */
export function isShiftMonitoringIntent(text: string): boolean {
  return /^monitor (?:validated )?results awaiting acknowledgement for my assigned patients until (?:the end of (?:this |my )?shift|(?:this |my )?shift end)[.!]?$/i.test(text.trim());
}
