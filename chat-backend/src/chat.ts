import { Request, Response } from 'express';
import { OpenAIClient, AzureKeyCredential } from '@azure/openai';
import { toolSchemas, executeTool } from './tools';
import { AuthedRequest } from './auth';

const systemInstructions = `You are a data analyst assistant for a financial sales dashboard covering 2013-2014.
Known dimension values (use these exact strings when calling tools, do not guess or invent variants):
Years: 2013, 2014
Months: January, February, March, April, May, June, July, August, September, October, November, December
Products: Carretera, Montana, Paseo, Velo, VTT, Amarilla
Segments: Government, Midmarket, Channel Partners, Enterprise, Small Business
Countries: Canada, Germany, France, Mexico, United States of America
Discount Bands: None, Low, Medium, High
Map casual user phrasing to these exact values (e.g. 'US' or 'USA' -> 'United States of America').
Always call the relevant tool(s) to get real numbers before answering — never estimate or make up figures.
Format currency values clearly (e.g. $1,234,567) and percentages with 2 decimal places.
Keep answers concise and conversational, a few sentences, not a report.
If a question needs comparison across multiple filters (e.g. 'compare Germany vs France'), call the relevant tool once per filter value and compare the results yourself.`;

export async function handleChat(req: AuthedRequest, res: Response) {
    try {
        const { message, history = [], session_id } = req.body;
        const userCountry = req.user?.country;
        
        const sanitizedHistory = (Array.isArray(history) ? history : []).filter(
            (m: any) => m && (m.role === 'user' || m.role === 'assistant')
                && typeof m.content === 'string' && m.content.trim().length > 0
        );

        const currentSessionId = session_id || Math.random().toString(36).substring(7);

        const scopedSystemPrompt = userCountry
            ? `${systemInstructions}\n\nIMPORTANT: This user's access is restricted to ${userCountry} only. All tool results are automatically scoped to ${userCountry}, regardless of what country is requested. If the user asks about another country or a comparison across countries, tell them plainly that you can only access ${userCountry}'s data — do not present ${userCountry}'s numbers as if they belong to the requested country.`
            : systemInstructions;

        const messages = [
            { role: "system", content: scopedSystemPrompt },
            ...sanitizedHistory,
            { role: "user", content: message }
        ];

        const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
        const apiKey = process.env.AZURE_OPENAI_API_KEY;
        const deployment = process.env.AZURE_OPENAI_DEPLOYMENT;
        const apiVersion = process.env.AZURE_OPENAI_API_VERSION || "2024-10-21";

        if (!endpoint || !apiKey || !deployment) {
            throw new Error("Missing Azure OpenAI configuration.");
        }
        
        // AzureKeyCredential is the standard way for @azure/openai
        const client = new OpenAIClient(endpoint, new AzureKeyCredential(apiKey), { apiVersion });

        let iterations = 0;
        let finalResponse = "";

        while (iterations < 5) {
            iterations++;
            
            const response = await client.getChatCompletions(deployment, messages, {
                tools: toolSchemas
            });
            if (process.env.DEBUG) {
                console.log(
                    JSON.stringify(response.choices[0].message, null, 2)
                );
            }

            const choice = response.choices[0];
            const responseMessage = choice.message;

            if (!responseMessage) break;

            messages.push(responseMessage as any);

            if (responseMessage.toolCalls && responseMessage.toolCalls.length > 0) {
                for (const toolCall of responseMessage.toolCalls) {
                    const call = toolCall as any;
                    let result;
                    try {
                        const args = JSON.parse(call.function?.arguments || "{}");
                        result = await executeTool(call.function?.name || "", args, req.user?.country);                    } catch (e: any) {
                        result = { error: e.message };
                    }

                    messages.push({
                        role: "tool",
                        toolCallId: toolCall.id,
                        content: JSON.stringify(result)
                    });
                }
            } else {
                finalResponse = responseMessage.content || "";
                break;
            }
        }

        if (iterations >= 5 && !finalResponse) {
            finalResponse = "I needed too many steps to figure this out. Please try asking in a simpler way.";
        }

        res.json({ response: finalResponse, session_id: currentSessionId });
    } catch (error: any) {
        console.error("Chat error:", error);
        res.status(500).json({ error: error.message });
    }
}
