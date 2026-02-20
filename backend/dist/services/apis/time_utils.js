"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseHour = parseHour;
exports.isActiveNow = isActiveNow;
exports.nowTimeStr = nowTimeStr;
/** Parse "7 PM", "7:00 PM", "10 AM" → 24-hour number (0–23) */
function parseHour(s) {
    const m = s.match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)/i);
    if (!m)
        return null;
    let h = parseInt(m[1]);
    const pm = m[3].toUpperCase() === 'PM';
    if (pm && h < 12)
        h += 12;
    if (!pm && h === 12)
        h = 0;
    return h;
}
/**
 * Returns true if an activity with this time string is currently happening
 * or starts within the next 2 hours.
 *
 * Handles formats: "4-7 PM", "10 AM-6 PM", "5:00 - 9:00 PM",
 *   "7 PM", "All day", "Anytime", "24/7", etc.
 */
function isActiveNow(timeStr) {
    const h = new Date().getHours();
    const windowEnd = h + 2;
    // Always-available patterns
    if (/all day|anytime|24\/7|always|every day|ongoing|varies/i.test(timeStr))
        return true;
    if (/dawn|sunrise|dusk|sunset/i.test(timeStr))
        return true;
    // Time range: "4-7 PM", "10 AM-6 PM", "5:00 - 9:00 PM", "4-8PM"
    const rangeMatch = timeStr.match(/(\d{1,2}(?::\d{2})?)\s*(AM|PM)?\s*[-–]\s*(\d{1,2}(?::\d{2})?)\s*(AM|PM)/i);
    if (rangeMatch) {
        const startStr = rangeMatch[1] + ' ' + (rangeMatch[2] || rangeMatch[4]);
        const endStr = rangeMatch[3] + ' ' + rangeMatch[4];
        const start = parseHour(startStr);
        const end = parseHour(endStr);
        if (start !== null && end !== null) {
            // Active if currently in range OR starts within next 2 hours
            return (h >= start && h < end) || (start >= h && start <= windowEnd);
        }
    }
    // Single time: "7 PM", "7:00 PM"
    const singleMatch = timeStr.match(/(\d{1,2}(?::\d{2})?)\s*(AM|PM)/i);
    if (singleMatch) {
        const hour = parseHour(singleMatch[0]);
        if (hour !== null) {
            // Starts within the next 2 hours (or just started within the last hour)
            return hour >= (h - 1) && hour <= windowEnd;
        }
    }
    // Can't parse → include
    return true;
}
/** Returns a human-readable "right now" time string */
function nowTimeStr() {
    const now = new Date();
    return now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}
