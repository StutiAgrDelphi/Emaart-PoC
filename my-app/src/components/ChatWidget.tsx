import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Bot, User, Loader2 } from 'lucide-react';
import { sendChatMessage } from '@/services/dataService';
import { getRayfinClient } from '@/lib/rayfin-client';
import { cn } from '@/lib/utils';

const WELCOME_MESSAGE = {
  role: 'assistant',
  content: "Hi! I'm your data assistant. Ask me anything about the sales data — e.g. \"What were the sales in January 2013?\" or \"Which country had the highest profit in 2014?\"",
};

const SUGGESTIONS = [
  'What were the total sales in 2014?',
  'Which product had the highest profit?',
  'Compare sales across segments',
];

export function ChatWidget() {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<any[]>([WELCOME_MESSAGE]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    
    // Manage sessionId in sessionStorage
    const [sessionId] = useState(() => sessionStorage.getItem('chatSessionId') || crypto.randomUUID());
    useEffect(() => { sessionStorage.setItem('chatSessionId', sessionId); }, [sessionId]);

    const [error, setError] = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    // Load history
    useEffect(() => {
        const loadHistory = async () => {
            try {
                const client = getRayfinClient();
                const history = await client.data.ChatMessage.findMany({ session_id: sessionId });
                if (history && history.length > 0) {
                    const validHistory = history.filter(
                        (m: any) => m && (m.role === 'user' || m.role === 'assistant')
                            && typeof m.content === 'string' && m.content.trim().length > 0
                    );
                    if (validHistory.length > 0) {
                        setMessages([WELCOME_MESSAGE, ...validHistory]);
                    }
                }
            } catch (err) {
                console.error("Failed to load chat history", err);
            }
        };
        loadHistory();
    }, [sessionId]);

    useEffect(() => {
        if (isOpen) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isOpen, isLoading]);

    useEffect(() => {
        if (isOpen) inputRef.current?.focus();
    }, [isOpen]);

    const handleSend = async (textOverride?: string) => {
        const text = (textOverride ?? input).trim();
        if (!text || isLoading) return;

        setMessages(prev => [...prev, { role: 'user', content: text }]);
        setInput('');
        setIsLoading(true);
        setError(null);

        try {
            const client = getRayfinClient();
            
            // 1. Hit the backend LLM (pass only previous history for context, excluding welcome message)
            const payload = {
                message: text,
                history: messages
                    .filter(m => m !== WELCOME_MESSAGE && (m.role === 'user' || m.role === 'assistant')
                        && typeof m.content === 'string' && m.content.trim().length > 0)
                    .map(m => ({ role: m.role, content: m.content }))
            };
            
            const data = await sendChatMessage(payload);

            const assistantResponse = data.response?.trim() || "Sorry, I couldn't generate a response for that.";
            setMessages(prev => [...prev, { role: 'assistant', content: assistantResponse }]);

            // 2. Persist to Rayfin GraphQL
            await client.data.ChatMessage.create({
                session_id: sessionId,
                role: 'user',
                content: text,
                timestamp: new Date().toISOString()
            });

            await client.data.ChatMessage.create({
                session_id: sessionId,
                role: 'assistant',
                content: assistantResponse,
                timestamp: new Date().toISOString()
            });
        } catch (err: any) {
            const detail = err?.response?.data?.detail || err.message || 'Something went wrong talking to the chatbot.';
            setError(detail);
            setMessages(prev => [...prev, { role: 'assistant', content: detail, isError: true }]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <>
            <button
                className="fixed bottom-l right-l h-14 w-14 bg-primary text-primary-foreground rounded-full flex items-center justify-center shadow-lg hover:shadow-xl transition-all hover:scale-105 z-50"
                onClick={() => setIsOpen(prev => !prev)}
                aria-label={isOpen ? 'Close chat' : 'Open chat'}
            >
                {isOpen ? <X size={24} /> : <MessageCircle size={24} />}
            </button>

            {isOpen && (
                <div className="fixed bottom-24 right-l w-[380px] max-w-[calc(100vw-2rem)] h-[600px] max-h-[calc(100vh-8rem)] bg-card text-card-foreground rounded-3xl shadow-2xl border border-border flex flex-col overflow-hidden z-50">
                    <div className="flex items-center justify-between p-m bg-primary text-primary-foreground">
                        <div className="flex items-center gap-xs font-semibold text-300 font-heading tracking-wide">
                            <Bot size={20} />
                            <span>Data Assistant</span>
                        </div>
                        <button className="p-xs hover:bg-black/10 rounded-full transition-colors" onClick={() => setIsOpen(false)} aria-label="Close chat">
                            <X size={18} />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-m flex flex-col gap-m bg-background">
                        {messages.map((msg, idx) => (
                            <div key={idx} className={cn("flex gap-xs max-w-[85%]", msg.role === 'user' ? "self-end flex-row-reverse" : "self-start")}>
                                <div className={cn("h-8 w-8 rounded-full flex items-center justify-center shrink-0", msg.role === 'user' ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground")}>
                                    {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
                                </div>
                                <div className={cn("p-m rounded-2xl text-300 leading-relaxed shadow-sm", msg.role === 'user' ? "bg-primary text-primary-foreground rounded-tr-none" : "bg-card border border-border rounded-tl-none", msg.isError && "bg-destructive/10 text-destructive border-destructive/20")}>
                                    {msg.content}
                                </div>
                            </div>
                        ))}

                        {isLoading && (
                            <div className="flex gap-xs max-w-[85%] self-start">
                                <div className="h-8 w-8 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center shrink-0">
                                    <Bot size={16} />
                                </div>
                                <div className="p-m rounded-2xl text-300 leading-relaxed shadow-sm bg-card border border-border rounded-tl-none flex items-center gap-xs text-muted-foreground">
                                    <Loader2 size={16} className="animate-spin" />
                                    <span>Querying data...</span>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {messages.length <= 1 && !isLoading && (
                        <div className="p-m flex flex-wrap gap-xs bg-background border-t border-border/50">
                            {SUGGESTIONS.map((s) => (
                                <button key={s} className="bg-secondary hover:bg-secondary/80 text-secondary-foreground text-200 px-s py-xs rounded-full transition-colors whitespace-nowrap" onClick={() => handleSend(s)}>
                                    {s}
                                </button>
                            ))}
                        </div>
                    )}

                    <div className="p-m bg-card border-t border-border flex gap-xs items-end">
                        <textarea
                            ref={inputRef}
                            className="flex-1 bg-background border border-input rounded-xl p-s text-300 resize-none outline-none focus:border-ring focus:ring-1 focus:ring-ring transition-all min-h-[44px] max-h-[120px]"
                            placeholder="Ask about sales..."
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            rows={1}
                            disabled={isLoading}
                        />
                        <button
                            className="h-[44px] w-[44px] bg-primary text-primary-foreground rounded-xl flex items-center justify-center shrink-0 disabled:opacity-50 hover:bg-primary/90 transition-colors"
                            onClick={() => handleSend()}
                            disabled={isLoading || !input.trim()}
                            aria-label="Send message"
                        >
                            <Send size={18} />
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}
