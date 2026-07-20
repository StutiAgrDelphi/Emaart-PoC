import { ConfidentialClientApplication } from "@azure/msal-node";
import axios from 'axios';

export async function executeDaxQuery(daxQuery: string): Promise<any[]> {
    if (process.env.DEBUG) {
        console.log("Executing DAX:", daxQuery);
    }

    const tenantId = process.env.POWERBI_TENANT_ID;
    const clientId = process.env.POWERBI_CLIENT_ID;
    const clientSecret = process.env.POWERBI_CLIENT_SECRET;
    const workspaceId = process.env.POWERBI_WORKSPACE_ID;
    const datasetId = process.env.POWERBI_DATASET_ID;

    if (!tenantId || !clientId || !clientSecret || !workspaceId || !datasetId) {
        console.warn("Missing Power BI configuration in environment variables.");
        // During testing without credentials, we return empty so UI doesn't crash completely
        return [];
    }

    const msalConfig = {
        auth: {
            clientId,
            authority: `https://login.microsoftonline.com/${tenantId}`,
            clientSecret,
        }
    };

    const cca = new ConfidentialClientApplication(msalConfig);
    const tokenResponse = await cca.acquireTokenByClientCredential({
        scopes: ["https://analysis.windows.net/powerbi/api/.default"]
    });
    if (process.env.DEBUG) console.log("Power BI token acquired:", !!tokenResponse?.accessToken);

    if (!tokenResponse || !tokenResponse.accessToken) {
        throw new Error("Failed to acquire Power BI token.");
    }


    const url = `https://api.powerbi.com/v1.0/myorg/groups/${workspaceId}/datasets/${datasetId}/executeQueries`;
    
    const body = {
        queries: [{ query: daxQuery }],
        serializerSettings: { includeNulls: true }
    };

    try {
        const response = await axios.post(url, body, {
            headers: {
                "Authorization": `Bearer ${tokenResponse.accessToken}`,
                "Content-Type": "application/json"
            }
        });

        if (process.env.DEBUG) {
            console.log("Power BI Success");
        }

        return cleanupResponse(response.data);

    } catch (err: any) {

        if (process.env.DEBUG) {
            console.log("========== POWER BI ERROR ==========");

            if (err.response) {
                console.log("Status:", err.response.status);
                console.log(JSON.stringify(err.response.data, null, 2));
            } else {
                console.log(err.message);
            }

            console.log("===================================");
        }

        throw err;
    }
}

export function cleanupResponse(data: any): any[] {
    if (!data.results || !data.results[0] || !data.results[0].tables || !data.results[0].tables[0]) {
        return [];
    }
    
    const rows = data.results[0].tables[0].rows;
    return rows.map((row: any) => {
        const cleanedRow: any = {};
        for (const key in row) {
            const cleanKey = key.replace(/^.*?\[/, '').replace(/\]$/, '');
            cleanedRow[cleanKey] = row[key] === null ? 0 : row[key];
        }
        return cleanedRow;
    });
}
