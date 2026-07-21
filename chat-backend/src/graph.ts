import { ConfidentialClientApplication } from "@azure/msal-node";

async function getGraphToken(): Promise<string> {
    const tenantId = process.env.POWERBI_TENANT_ID;
    const clientId = process.env.POWERBI_CLIENT_ID;
    const clientSecret = process.env.POWERBI_CLIENT_SECRET;

    if (!tenantId || !clientId || !clientSecret) {
        throw new Error("Missing app registration configuration for Graph token.");
    }

    const cca = new ConfidentialClientApplication({
        auth: {
            clientId,
            authority: `https://login.microsoftonline.com/${tenantId}`,
            clientSecret,
        }
    });

    const tokenResponse = await cca.acquireTokenByClientCredential({
        scopes: ["https://graph.microsoft.com/.default"]
    });

    if (!tokenResponse?.accessToken) {
        throw new Error("Failed to acquire Graph token.");
    }
    return tokenResponse.accessToken;
}

export async function getCountryForUser(email: string): Promise<string | null> {
    // TODO: swap this placeholder for the real Graph call once permission is granted:
    //
    // const token = await getGraphToken();
    // const res = await fetch(
    //     `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(email)}?$select=country,usageLocation`,
    //     { headers: { Authorization: `Bearer ${token}` } }
    // );
    // if (!res.ok) {
    //     console.error("Graph lookup failed:", res.status, await res.text());
    //     return null;
    // }
    // const data = await res.json();
    // return data.country ?? data.usageLocation ?? null;

    console.log(`[graph.ts placeholder] returning "France" for ${email}`);
    return "France";
}