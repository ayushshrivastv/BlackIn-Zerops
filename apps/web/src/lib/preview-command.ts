const PREVIEW_COMMANDS = [
    /^(please\s+)?(deploy|preview|run)(\s+(the|this|my))?\s*(app|project|preview)?$/i,
    /^(please\s+)?start(\s+(the|this|my))?\s*(local\s+dev|dev\s+server|preview)$/i,
    /^(please\s+)?show(\s+me)?(\s+(the|this|my))?\s*(app|project|preview)$/i,
    /^(please\s+)?open(\s+(the|this|my))?\s*(app|project|preview)$/i,
];

export function isPreviewCommand(value: string): boolean {
    const normalized = value
        .trim()
        .replace(/[.!?]+$/, '')
        .trim();
    return PREVIEW_COMMANDS.some((pattern) => pattern.test(normalized));
}
