import * as cookie from 'cookie';
import * as setCookieParser from 'set-cookie-parser';

export function mergeCookies(oldCookie: string = '', setCookieHeader: string | string[] | undefined): string {
    if (!setCookieHeader) return oldCookie;

    // Parse existing cookies
    const cookies = cookie.parse(oldCookie);

    // Parse Set-Cookie header(s)
    const splitCookies = setCookieParser.parse(setCookieHeader);

    // Update cookies map
    for (const newCookie of splitCookies) {
        cookies[newCookie.name] = newCookie.value;
    }

    // Reconstruct the cookie string
    return Object.entries(cookies)
        .filter((entry): entry is [string, string] => entry[1] !== undefined)
        .map(([name, value]) => cookie.serialize(name, value))
        .join('; ');
}

export function mergeFlareSolverrCookies(oldCookie: string = '', newCookies: { name: string, value: string }[]): string {
    if (!newCookies || newCookies.length === 0) return oldCookie;

    const cookies = cookie.parse(oldCookie);

    for (const nc of newCookies) {
        cookies[nc.name] = nc.value;
    }

    return Object.entries(cookies)
        .filter((entry): entry is [string, string] => entry[1] !== undefined)
        .map(([name, value]) => cookie.serialize(name, value))
        .join('; ');
}
