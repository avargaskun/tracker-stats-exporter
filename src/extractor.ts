import { UserStats } from "./clients/tracker";

/**
 * Standard Binary Prefixes (IEC/JEDEC standards)
 * 1024-based multipliers for converting sizes to raw bytes.
 */
const UNIT_MULTIPLIERS: { [key: string]: number } = {
    B: 1,
    KB: 1024,
    KIB: 1024,
    MB: 1024 ** 2,
    MIB: 1024 ** 2,
    GB: 1024 ** 3,
    GIB: 1024 ** 3,
    TB: 1024 ** 4,
    TIB: 1024 ** 4,
    PB: 1024 ** 5,
    PIB: 1024 ** 5,
};

/**
 * Helper: Sanitizes strings to handle commas (e.g., "33,781.61") and spaces before parsing.
 */
function parseRawNumber(valueStr: string): number {
    // Remove commas, spaces, and non-breaking spaces
    const cleanStr = valueStr.replace(/[, \u00A0\u202F]/g, "");
    return parseFloat(cleanStr);
}

/**
 * Helper: Converts a number string + unit string into raw bytes.
 */
function parseBytes(valueStr: string, unitStr: string): number {
    const amount = parseRawNumber(valueStr);
    const unit = unitStr.trim().toUpperCase();
    const multiplier = UNIT_MULTIPLIERS[unit] || 1;
    return Math.floor(amount * multiplier);
}

/**
 * Helper: Runs a list of regex patterns against the HTML and returns the first match.
 * @param html The HTML content.
 * @param patterns Array of Regex patterns to try in order.
 * @param parser Callback to convert the Regex match into the desired type T.
 */
function extractMetric<T>(html: string, patterns: RegExp[], parser: (match: RegExpMatchArray) => T): T | undefined {
    for (const pattern of patterns) {
        const match = html.match(pattern);
        if (match) {
            return parser(match);
        }
    }
    return undefined;
}

// ----------------------------------------------------------------------------
// SPECIFIC EXTRACTORS
// ----------------------------------------------------------------------------

function getByteMetric(html: string, labelKeywords: string): number | undefined {
    // Strategy: Find label -> scan limited chars -> find Number -> find Unit
    // Handles: "Uploaded ... 3.1 TB" and "Uploaded ... 33.00 GB"
    // We avoid matching "Uploaded >= 1TB" (achievements) by ensuring the separator does not contain ">=" or "&gt;=".
    const separator = `(?:(?!(?:&gt;=|>=))[\\s\\S]){0,300}?`;
    const regex = new RegExp(`(?:${labelKeywords})${separator}(\\d+(?:[.,]\\d+)?)\\s*([KMGTP]i?B)`, "i");
    return extractMetric(html, [regex], (match) => parseBytes(match[1], match[2]));
}

function getCount(html: string, context: "seeding" | "leeching" | "hnr"): number | undefined {
    const patterns: RegExp[] = [];

    if (context === "seeding") {
        // 1. TorrentLeech specific: "Uploaded (Seeding) ... (296)"
        patterns.push(/Uploaded\s*\(Seeding\)[\s\S]{0,300}?\(\s*(\d+)\s*\)/i);
        // 2. BwTorrents specific: "Torrents seeding" ... > ... number
        patterns.push(/Torrents\s+seeding[\s\S]{0,300}?>[\s\S]{0,100}?(\d+)/i);
        // 3. BakaBT: "uarr ... 448"
        patterns.push(/(?:uarr|&uarr;)[\s\S]{0,50}?(\d+)/i);
        // 4. Generic/AvistaZ/Unit3D: "Seeding: 4", "Total Seeding... 4", "title='Seeding'... 4"
        patterns.push(/Seeding\s*(?:[:><"']|&nbsp;)[\s\S]{0,200}?(\d+)/i);
    } else if (context === "leeching") {
        // 1. TorrentLeech specific: "Downloaded (Leeching) ... (1)"
        patterns.push(/Downloaded\s*\(Leeching\)[\s\S]{0,300}?\(\s*(\d+)\s*\)/i);
        // 2. BwTorrents specific: "Torrents leeching" ... > ... number
        patterns.push(/Torrents\s+leeching[\s\S]{0,300}?>[\s\S]{0,100}?(\d+)/i);
        // 3. BakaBT: "darr ... 771"
        patterns.push(/(?:darr|&darr;)[\s\S]{0,50}?(\d+)/i);
        // 4. Generic/AvistaZ/Unit3D: "Leeching: 0", "Total Leeching... 0"
        patterns.push(/Leeching\s*(?:[:><"']|&nbsp;)[\s\S]{0,200}?(\d+)/i);
    } else if (context === "hnr") {
        // 1. "Hit and Run" or "Hit & Run" or "H&R" or "HnR" -> "0"
        patterns.push(/(?:Hit\s+(?:and|&)\s+Run|H&R|HnR)[\s\S]{0,200}?(\d+)/i);
    }

    return extractMetric(html, patterns, (match) => parseInt(match[1], 10));
}

function getRatio(html: string): number | undefined {
    // Handles "Ratio... 5.518" and "Ratio... 1.16"
    // Avoid "Ratio >= 5.0"
    const separator = `(?:(?!(?:&gt;=|>=))[\\s\\S]){0,100}?`;
    const patterns = [
        new RegExp(`(?:Ratio)${separator}(\\d+\\.\\d+)`, "i"), // Priority: Decimal
        new RegExp(`(?:Ratio)${separator}(\\d+)`, "i"), // Fallback: Integer
    ];
    return extractMetric(html, patterns, (match) => parseRawNumber(match[1]));
}

function getBonus(html: string): number | undefined {
    // Handles "TL Points... 33,781.61", "Bonus Points... 1300.67", "BON... 139 512"
    // We expect the label to be followed immediately (or after whitespace) by ':' or '<' or '>' or '&nbsp;' or '"' (title attribute)
    // The number regex allows commas, spaces, and non-breaking spaces as thousands separators.
    const patterns = [
        /(?:TL Points|Bonus Points|Bonus|BON)\s*(?:[:<>"']|&nbsp;)[\s\S]{0,150}?(\d+(?:[, \u00A0\u202F]\d{3})*(?:\.\d+)?)/i
    ];
    return extractMetric(html, patterns, (match) => parseRawNumber(match[1]));
}

// ----------------------------------------------------------------------------
// MAIN EXPORT
// ----------------------------------------------------------------------------

export function getUserStats(html: string): UserStats {
    return {
        uploaded: getByteMetric(html, "Uploaded|Upload"),
        downloaded: getByteMetric(html, "Downloaded|Download"),
        ratio: getRatio(html),
        bonus: getBonus(html),
        seeding: getCount(html, "seeding"),
        leeching: getCount(html, "leeching"),
        buffer: getByteMetric(html, "Buffer"),
        hitAndRuns: getCount(html, "hnr"),
    };
}
