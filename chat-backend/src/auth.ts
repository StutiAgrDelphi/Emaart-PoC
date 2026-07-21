import { importJWK, jwtVerify, JWK } from "jose";
import { Request, Response, NextFunction } from "express";
import { getCountryForUser } from "./graph";

export interface AuthedRequest extends Request {
    user?: { email: string; country?: string | null };
}

// Simple in-memory cache so we don't refetch the JWKS on every request
let cachedJwks: { keys: JWK[] } | null = null;
let cachedAt = 0;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

async function getJwks(): Promise<{ keys: JWK[] }> {
    if (cachedJwks && Date.now() - cachedAt < CACHE_TTL_MS) {
        return cachedJwks;
    }
    const res = await fetch(`${process.env.RAYFIN_API_URL}/.well-known/jwks.json`);
    if (!res.ok) {
        throw new Error(`Failed to fetch JWKS: ${res.status} ${res.statusText}`);
    }
    cachedJwks = await res.json() as { keys: JWK[] };
    cachedAt = Date.now();
    return cachedJwks;
}

export async function verifyAuth(req: AuthedRequest, res: Response, next: NextFunction) {
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Missing token" });
    }
    const token = header.slice(7);

    try {
        // Decode the token header to get the kid without verifying yet
        const decodedHeader = JSON.parse(
            Buffer.from(token.split(".")[0], "base64url").toString()
        );
        const kid = decodedHeader.kid;
        if (!kid) throw new Error("Token header missing kid");

        // Fetch (or reuse cached) JWKS and find the matching key
        const jwks = await getJwks();
        const rawKey = jwks.keys.find((k) => k.kid === kid);
        if (!rawKey) throw new Error(`No JWK found for kid ${kid}`);

        // Microsoft's Entra/Fabric JWKS entries carry extra metadata
        // (key_ops: [], oth: [], cloud_instance_name, x5t, x5c, etc.)
        // that jose's importJWK either misinterprets or outright rejects.
        // Allowlist only the fields RSA signature verification actually needs.
        const cleanKey: JWK = {
            kty: rawKey.kty,
            n: rawKey.n,
            e: rawKey.e,
            kid: rawKey.kid,
            alg: "RS256",
            use: "sig",
        };

        const key = await importJWK(cleanKey, "RS256");
        const { payload } = await jwtVerify(token, key);

        const attrs = payload.xms_attr as
            | Record<string, {
                rfn_email?: string;
                rfn_role?: string;
                rfn_sid?: string;
            }>
            | undefined;

        const firstEntry = attrs ? Object.values(attrs)[0] : undefined;

        const email = firstEntry?.rfn_email;

        if (!email) {
            throw new Error("No Fabric email found in token");
        }
        req.user = { email };
        next();
    } catch (err) {
        console.error("FULL JWT ERROR:");
        console.error(err);
        return res.status(401).json({
            error: "Invalid token",
            details: err instanceof Error ? err.message : String(err),
        });
    }
}

export async function resolveCountry(req: AuthedRequest, res: Response, next: NextFunction) {
    if (!req.user) {
        return res.status(401).json({ error: "Unauthenticated" });
    }
    req.user.country = await getCountryForUser(req.user.email);
    next();
}