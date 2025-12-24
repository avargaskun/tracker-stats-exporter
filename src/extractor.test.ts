import fs from 'fs';
import path from 'path';
import { getUserStats } from './extractor';

const PAGES_DIR = path.join(__dirname, '../pages');

// Replicating the multiplier logic from extractor.ts for test verification
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

function parseRawNumber(valueStr: string): number {
    const cleanStr = valueStr.replace(/,/g, "");
    return parseFloat(cleanStr);
}

function parseBytes(valueStr: string): number | undefined {
    if (!valueStr || !valueStr.trim()) return undefined;
    const match = valueStr.match(/(\d+(?:[.,]\d+)?)\s*([KMGTP]i?B)/i);
    if (!match) return undefined;
    
    const amount = parseRawNumber(match[1]);
    const unit = match[2].trim().toUpperCase();
    const multiplier = UNIT_MULTIPLIERS[unit] || 1;
    return Math.floor(amount * multiplier);
}

function parseNumber(valueStr: string): number | undefined {
    if (!valueStr || !valueStr.trim()) return undefined;
    const num = parseRawNumber(valueStr);
    return isNaN(num) ? undefined : num;
}

interface ExpectedData {
    uploaded?: number;
    downloaded?: number;
    ratio?: number;
    buffer?: number;
    bonus?: number;
    seeding?: number;
    leeching?: number;
    hitAndRuns?: number;
}

function parseComment(comment: string): ExpectedData {
    const lines = comment.split('\n');
    const data: ExpectedData = {};

    for (const line of lines) {
        const parts = line.split(':');
        if (parts.length < 2) continue;
        
        const key = parts[0].trim().toLowerCase();
        const value = parts.slice(1).join(':').trim();

        if (value === '') continue; // Skip empty values

        if (key === 'upload') {
            data.uploaded = parseBytes(value);
        } else if (key === 'download') {
            data.downloaded = parseBytes(value);
        } else if (key === 'ratio') {
            data.ratio = parseNumber(value);
        } else if (key === 'buffer') {
            data.buffer = parseBytes(value);
        } else if (key === 'bonus') {
            data.bonus = parseNumber(value);
        } else if (key === 'seeding') {
            data.seeding = parseNumber(value);
        } else if (key === 'leeching') {
            data.leeching = parseNumber(value);
        } else if (key === 'hit and runs' || key === 'hnr' || key === 'hit & run') {
            data.hitAndRuns = parseNumber(value);
        }
    }
    return data;
}

describe('Extractor Real Page Tests', () => {
    const files = fs.readdirSync(PAGES_DIR).filter(file => file.endsWith('.html'));

    files.forEach(file => {
        it(`should correctly extract stats from ${file}`, () => {
            const filePath = path.join(PAGES_DIR, file);
            let content = fs.readFileSync(filePath, 'utf-8');

            // Extract the comment block
            const commentMatch = content.match(/<!--([\s\S]*?)-->/);
            if (!commentMatch) {
                console.warn(`No comment block found in ${file}, skipping extraction check.`);
                return;
            }

            const commentBlock = commentMatch[1];
            const expected = parseComment(commentBlock);

            // Remove the comment from the content to simulate real scraping
            // We replace the entire match (<!-- ... -->) with empty string
            content = content.replace(commentMatch[0], '');

            const result = getUserStats(content);

            // Assertions
            
            if (expected.uploaded !== undefined) expect(result.uploaded).toBe(expected.uploaded);
            else expect(result.uploaded).toBeUndefined();

            if (expected.downloaded !== undefined) expect(result.downloaded).toBe(expected.downloaded);
            else expect(result.downloaded).toBeUndefined();

            if (expected.ratio !== undefined) expect(result.ratio).toBe(expected.ratio);
            else expect(result.ratio).toBeUndefined();

            if (expected.buffer !== undefined) expect(result.buffer).toBe(expected.buffer);
            else expect(result.buffer).toBeUndefined();

            if (expected.bonus !== undefined) expect(result.bonus).toBe(expected.bonus);
            else expect(result.bonus).toBeUndefined();

            if (expected.seeding !== undefined) expect(result.seeding).toBe(expected.seeding);
            else expect(result.seeding).toBeUndefined();

            if (expected.leeching !== undefined) expect(result.leeching).toBe(expected.leeching);
            else expect(result.leeching).toBeUndefined();
            
            if (expected.hitAndRuns !== undefined) expect(result.hitAndRuns).toBe(expected.hitAndRuns);
            else expect(result.hitAndRuns).toBeUndefined();
        });
    });
});