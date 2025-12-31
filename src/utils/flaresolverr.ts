import { fetch } from 'undici';
import { getLogger } from '../logger';
import { ProxyConfig } from '../config';
import * as cookie from 'cookie';

const logger = getLogger('FlareSolverr');

export interface FlareSolverrCookie {
    name: string;
    value: string;
    domain?: string;
    path?: string;
    expiry?: number;
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: string;
}

export interface FlareSolverrResponse {
    status: string;
    message: string;
    startTimestamp: number;
    endTimestamp: number;
    version: string;
    solution: {
        url: string;
        status: number;
        cookies: FlareSolverrCookie[];
        userAgent: string;
        headers: Record<string, string>;
        response: string;
    };
}

export async function solveChallenge(
    serviceUrl: string,
    targetUrl: string,
    timeout: number,
    cookies: string,
    proxy?: ProxyConfig
): Promise<{ html: string; cookies: FlareSolverrCookie[] }> {
    logger.info(`Attempting to solve challenge for ${targetUrl} via ${serviceUrl}`);

    const parsedCookies = cookie.parse(cookies);
    const cookieList = Object.entries(parsedCookies).map(([name, value]) => ({
        name,
        value,
        // Domain and path are tricky without context, but FlareSolverr usually handles basic ones.
        // We might need to infer domain from targetUrl if FlareSolverr is strict.
        // For now, sending just name/value.
    }));

    const payload: any = {
        cmd: 'request.get',
        url: targetUrl,
        maxTimeout: timeout,
        cookies: cookieList
    };

    if (proxy) {
        // format: "http://user:pass@host:port" or "http://host:port"
        let proxyUrl = proxy.url;
        if (proxy.username && proxy.password) {
            try {
                const urlObj = new URL(proxy.url);
                urlObj.username = proxy.username;
                urlObj.password = proxy.password;
                proxyUrl = urlObj.toString();
            } catch (e) {
                logger.warn(`Failed to construct authenticated proxy URL for FlareSolverr: ${e}`);
            }
        }
        payload.proxy = { url: proxyUrl };
    }

    try {
        const response = await fetch(serviceUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`FlareSolverr service returned ${response.status} ${response.statusText}`);
        }

        const data = (await response.json()) as FlareSolverrResponse;

        if (data.status === 'error') {
            throw new Error(`FlareSolverr failed: ${data.message}`);
        }

        // Even if status is 'ok', check the solution status code
        if (data.solution.status >= 400) {
            throw new Error(`Target site returned ${data.solution.status} after FlareSolverr attempt.`);
        }

        return {
            html: data.solution.response,
            cookies: data.solution.cookies
        };

    } catch (error) {
        logger.error(`Error communicating with FlareSolverr: ${error}`);
        throw error;
    }
}
