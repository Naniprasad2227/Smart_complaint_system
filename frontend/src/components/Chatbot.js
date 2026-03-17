import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { complaintApi } from '../services/api';

const QUICK_PROMPTS = [
  'What is my complaint status?',
  'How many pending complaints do I have?',
  'How do I submit a complaint?',
  'Show my resolved complaints',
];

const Chatbot = () => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      from: 'bot',
      text: "Hi! I'm your support assistant. Ask me about your complaint status, category, department, or how to use the system.",
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [actions, setActions] = useState([]);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (open) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, open]);

  const sendMessage = async (text) => {
    const userText = (text || input).trim();
    if (!userText) return;

    setInput('');
    setMessages((prev) => [...prev, { from: 'user', text: userText }]);
    setLoading(true);

    try {
      const { data } = await complaintApi.chat(userText);
      setMessages((prev) => [...prev, { from: 'bot', text: data.reply }]);

      const normalized = userText.toLowerCase();
      if (normalized.includes('submit')) {
        setActions([{ label: 'Open Submit Complaint', path: '/submit' }]);
      } else if (normalized.includes('track') || normalized.includes('status') || normalized.includes('history')) {
        setActions([
          { label: 'Open Track Complaint', path: '/track-complaint' },
          { label: 'Open My Complaints', path: '/my-complaints' },
        ]);
      } else {
        setActions([]);
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          from: 'bot',
          text: err.response?.status === 401
            ? 'Please log in to use the support assistant.'
            : 'Sorry, I encountered an error. Please try again.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end">
      {open && (
        <div
          className="mb-3 bg-white border border-slate-200 rounded-xl shadow-xl flex flex-col"
          style={{ width: '320px', height: '440px' }}
        >
          {/* Header */}
          <div className="bg-blue-600 text-white rounded-t-xl px-4 py-3 flex justify-between items-center shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-lg">🤖</span>
              <div>
                <p className="font-semibold text-sm">Support Assistant</p>
                <p className="text-xs text-blue-200">AI-powered · Always available</p>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-white hover:text-blue-200 text-lg leading-none"
              aria-label="Close chat"
            >
              ✕
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.from === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] px-3 py-2 rounded-lg text-sm leading-5 ${
                    msg.from === 'user'
                      ? 'bg-blue-600 text-white rounded-br-sm'
                      : 'bg-slate-100 text-slate-800 rounded-bl-sm'
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-slate-100 text-slate-400 px-3 py-2 rounded-lg text-sm italic">
                  Thinking...
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick prompts */}
          {messages.length <= 2 && !loading && (
            <div className="px-3 pb-2 flex flex-wrap gap-1 shrink-0">
              {QUICK_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => sendMessage(prompt)}
                  className="text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-2 py-1 hover:bg-blue-100"
                >
                  {prompt}
                </button>
              ))}
            </div>
          )}

            {actions.length > 0 && !loading && (
              <div className="px-3 pb-2 flex flex-wrap gap-1 shrink-0">
                {actions.map((action) => (
                  <button
                    key={action.path}
                    onClick={() => {
                      navigate(action.path);
                      setOpen(false);
                    }}
                    className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full px-2 py-1 hover:bg-emerald-100"
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            )}

          {/* Input */}
          <div className="p-3 border-t border-slate-200 flex gap-2 shrink-0">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !loading && sendMessage()}
              placeholder="Ask a question..."
              className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
              disabled={loading}
            />
            <button
              onClick={() => sendMessage()}
              disabled={loading || !input.trim()}
              className="bg-blue-600 text-white px-3 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-40"
            >
              ➤
            </button>
          </div>
        </div>
      )}

      {/* Toggle button */}
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="bg-blue-600 text-white w-14 h-14 rounded-full shadow-lg flex items-center justify-center hover:bg-blue-700 transition-transform hover:scale-105 text-2xl"
        aria-label="Toggle support chat"
      >
        {open ? '✕' : '💬'}
      </button>
    </div>
  );
};

export default Chatbot;
