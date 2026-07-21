export function getRayfinAccessToken(): string | null {
    const raw = localStorage.getItem("authSession");

    if (!raw) {
        return null;
    }

    try {
        const session = JSON.parse(raw);
        return session.accessToken ?? null;
    } catch {
        return null;
    }
}