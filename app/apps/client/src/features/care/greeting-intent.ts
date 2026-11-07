/** Greeting-only navigation intent; never consumes requests containing clinical or operational detail. */
export function isCareGreeting(text: string): boolean {
 return /^(?:hi|hello|hey|hey there|good morning|good afternoon|good evening|namaste|नमस्ते|नमस्कार)(?:\s+(?:gluco|glucoflow))?[!.,\s]*$/iu.test(text.trim());
}
