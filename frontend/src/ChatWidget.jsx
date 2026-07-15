import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Bot, User, Loader2 } from 'lucide-react';
import { sendChatMessage } from './api';
import './ChatWidget.css';

const WELCOME_MESSAGE = {
  role: 'assistant',
  content: "Hi! I'm your data assistant. Ask me anything about the sales data — e.g. \"What were the sales in January 2013?\" or \"Which country had the highest profit in 2014?\"",
};

const SUGGESTIONS = [
  'What were the total sales in 2014?',
  'Which product had the highest profit?',
  'Compare sales across segments',
];

function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([WELCOME_MESSAGE]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [error, setError] = useState(null);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, isLoading]);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  const handleSend = async (textOverride) => {
    const text = (textOverride ?? input).trim();
    if (!text || isLoading) return;

    setMessages(prev => [...prev, { role: 'user', content: text }]);
    setInput('');
    setIsLoading(true);
    setError(null);

    try {
      const data = await sendChatMessage(text, sessionId);
      setSessionId(data.session_id);
      setMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
    } catch (err) {
      const detail = err?.response?.data?.detail || 'Something went wrong talking to the chatbot. Is the backend running and configured with Azure OpenAI credentials?';
      setError(detail);
      setMessages(prev => [...prev, { role: 'assistant', content: detail, isError: true }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      <button
        className="chat-fab"
        onClick={() => setIsOpen(prev => !prev)}
        aria-label={isOpen ? 'Close chat' : 'Open chat'}
      >
        {isOpen ? <X size={24} /> : <MessageCircle size={24} />}
      </button>

      {isOpen && (
        <div className="chat-panel">
          <div className="chat-header">
            <div className="chat-header-title">
              <Bot size={20} />
              <span>Data Assistant</span>
            </div>
            <button className="chat-close-btn" onClick={() => setIsOpen(false)} aria-label="Close chat">
              <X size={18} />
            </button>
          </div>

          <div className="chat-messages">
            {messages.map((msg, idx) => (
              <div key={idx} className={`chat-message ${msg.role} ${msg.isError ? 'chat-message-error' : ''}`}>
                <div className="chat-avatar">
                  {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
                </div>
                <div className="chat-bubble">{msg.content}</div>
              </div>
            ))}

            {isLoading && (
              <div className="chat-message assistant">
                <div className="chat-avatar"><Bot size={16} /></div>
                <div className="chat-bubble chat-typing">
                  <Loader2 size={14} className="chat-spinner" />
                  <span>Querying the data...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {messages.length <= 1 && !isLoading && (
            <div className="chat-suggestions">
              {SUGGESTIONS.map((s) => (
                <button key={s} className="chat-suggestion-chip" onClick={() => handleSend(s)}>
                  {s}
                </button>
              ))}
            </div>
          )}

          <div className="chat-input-row">
            <textarea
              ref={inputRef}
              className="chat-input"
              placeholder="Ask about sales, profit, products..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              disabled={isLoading}
            />
            <button
              className="chat-send-btn"
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

export default ChatWidget;
