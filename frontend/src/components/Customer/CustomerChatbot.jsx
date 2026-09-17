import React, { useState, useRef, useEffect } from 'react';
import { api } from '../../services/api';
import { MessageCircle, X, Send, Bot, User, Loader2, ChevronDown, Minimize2 } from 'lucide-react';

// ─── Suggested question chips ─────────────────────────────────────────────────
const SUGGESTED_QUESTIONS = [
  'Why was my demand rejected?',
  'How much quantity was allocated?',
  'What is the current status of my demand?',
  'Why was only part of my request accepted?',
  'When will the remaining units be available?',
  'What is my expected delivery date?',
];

// ─── Message bubble ───────────────────────────────────────────────────────────
function MessageBubble({ msg }) {
  const isUser = msg.role === 'user';
  return (
    <div className={`flex items-end gap-2 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Avatar */}
      <div className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold ${
        isUser ? 'bg-gradient-to-br from-cyan-600 to-blue-700' : 'bg-gradient-to-br from-violet-700 to-purple-800'
      }`}>
        {isUser ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
      </div>

      {/* Bubble */}
      <div className={`max-w-[80%] px-3.5 py-2.5 rounded-2xl text-[12px] leading-relaxed shadow-sm ${
        isUser
          ? 'bg-gradient-to-br from-cyan-700 to-blue-700 text-white rounded-br-sm'
          : 'bg-slate-800 text-slate-200 border border-slate-700/60 rounded-bl-sm'
      }`}>
        {msg.content}
        {msg.sources && !isUser && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {msg.sources.map((s, i) => (
              <span key={i} className="text-[9px] font-mono px-1.5 py-0.5 rounded-full bg-violet-900/50 text-violet-400 border border-violet-800/40">
                {s}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Chatbot Component ───────────────────────────────────────────────────
export default function CustomerChatbot({ demands = [] }) {
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [selectedDemandId, setSelectedDemandId] = useState('');
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'bot',
      content: "Hi! I'm your demand assistant 👋 Select a demand from the dropdown above, then ask me anything about its status, allocation, or decision history.",
      sources: null
    }
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-scroll to latest message
  useEffect(() => {
    if (open && !minimized) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, open, minimized]);

  // Focus input when opened
  useEffect(() => {
    if (open && !minimized) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open, minimized]);

  const sendMessage = async (text) => {
    const question = (text || input).trim();
    if (!question) return;
    if (!selectedDemandId) {
      setMessages(prev => [...prev, {
        id: Date.now(),
        role: 'bot',
        content: 'Please select a demand from the dropdown first so I can look up the right information for you.',
        sources: null
      }]);
      return;
    }

    const userMsg = { id: Date.now(), role: 'user', content: question };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setSending(true);

    try {
      const res = await api.customerChatbotQuery(Number(selectedDemandId), question);
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        role: 'bot',
        content: res.data.answer,
        sources: res.data.sources || null
      }]);
    } catch (err) {
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        role: 'bot',
        content: `Sorry, I couldn't retrieve that information right now. ${err.message || 'Please try again.'}`,
        sources: null
      }]);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const selectedDemand = demands.find(d => String(d.demand_id) === String(selectedDemandId));

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-gradient-to-br from-violet-600 to-purple-700 hover:from-violet-500 hover:to-purple-600 text-white shadow-2xl shadow-violet-700/40 flex items-center justify-center transition-all hover:scale-110 group"
        title="Ask your demand assistant"
      >
        <MessageCircle className="w-6 h-6" />
        {/* Pulse ring */}
        <span className="absolute w-14 h-14 rounded-full border-2 border-violet-500 animate-ping opacity-30" />
      </button>
    );
  }

  return (
    <div className={`fixed bottom-6 right-6 z-50 flex flex-col w-[360px] ${minimized ? 'h-14' : 'h-[540px]'} rounded-2xl overflow-hidden shadow-2xl shadow-violet-900/40 border border-violet-800/50 bg-slate-950 transition-all duration-300`}>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-violet-900/80 to-purple-900/60 border-b border-violet-800/40 shrink-0">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-600 to-purple-700 flex items-center justify-center shadow-lg">
            <Bot className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-[12px] font-bold text-white">Demand Assistant</p>
            <p className="text-[9px] text-violet-400 font-mono">Powered by Gemini AI</p>
          </div>
        </div>
        <div className="flex items-center space-x-1">
          <button
            onClick={() => setMinimized(m => !m)}
            className="p-1.5 rounded-lg text-violet-400 hover:text-white hover:bg-violet-800/50 transition-colors"
            title={minimized ? 'Expand' : 'Minimize'}
          >
            {minimized ? <ChevronDown className="w-4 h-4 rotate-180" /> : <Minimize2 className="w-4 h-4" />}
          </button>
          <button
            onClick={() => setOpen(false)}
            className="p-1.5 rounded-lg text-violet-400 hover:text-white hover:bg-violet-800/50 transition-colors"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {!minimized && (
        <>
          {/* ── Demand Selector ───────────────────────────────────────────── */}
          <div className="px-3 py-2 border-b border-slate-800/60 bg-slate-950/90 shrink-0">
            <select
              value={selectedDemandId}
              onChange={e => setSelectedDemandId(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-[11px] font-mono text-white focus:outline-none focus:border-violet-600 transition-colors"
            >
              <option value="">-- Select a demand --</option>
              {demands.map(d => (
                <option key={d.demand_id} value={d.demand_id}>
                  #{d.demand_id} · {d.product_name} · {d.status}
                </option>
              ))}
            </select>
            {selectedDemand && (
              <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                <span className={`text-[9px] font-bold font-mono px-1.5 py-0.5 rounded-full border ${
                  selectedDemand.status === 'APPROVED' ? 'bg-emerald-950 text-emerald-300 border-emerald-800' :
                  selectedDemand.status === 'REJECTED' ? 'bg-rose-950 text-rose-300 border-rose-800' :
                  selectedDemand.status === 'PARTIALLY_ALLOCATED' ? 'bg-amber-950 text-amber-300 border-amber-800' :
                  'bg-sky-950 text-sky-300 border-sky-800'
                }`}>
                  {selectedDemand.status}
                </span>
                <span className="text-[9px] text-slate-500 font-mono">
                  {Number(selectedDemand.requested_quantity).toLocaleString()} units · Level {selectedDemand.level}
                </span>
              </div>
            )}
          </div>

          {/* ── Message Thread ────────────────────────────────────────────── */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 scrollbar-thin scrollbar-thumb-slate-700">
            {messages.map(msg => (
              <MessageBubble key={msg.id} msg={msg} />
            ))}
            {sending && (
              <div className="flex items-end gap-2">
                <div className="shrink-0 w-7 h-7 rounded-full bg-gradient-to-br from-violet-700 to-purple-800 flex items-center justify-center">
                  <Bot className="w-3.5 h-3.5 text-white" />
                </div>
                <div className="bg-slate-800 border border-slate-700/60 rounded-2xl rounded-bl-sm px-3.5 py-2.5 flex items-center space-x-1.5">
                  <Loader2 className="w-3.5 h-3.5 text-violet-400 animate-spin" />
                  <span className="text-[11px] text-slate-400 font-mono">Looking up your demand data...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* ── Suggested Questions ───────────────────────────────────────── */}
          {messages.length <= 2 && (
            <div className="px-3 pb-2 flex flex-wrap gap-1.5 shrink-0">
              {SUGGESTED_QUESTIONS.map((q, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(q)}
                  disabled={sending}
                  className="text-[10px] font-mono px-2.5 py-1 rounded-full bg-violet-950/60 text-violet-300 border border-violet-800/50 hover:bg-violet-900/60 hover:text-violet-100 transition-colors disabled:opacity-50"
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          {/* ── Input Bar ─────────────────────────────────────────────────── */}
          <div className="px-3 pb-3 pt-1 shrink-0 border-t border-slate-800/60">
            <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 focus-within:border-violet-600 transition-colors">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={selectedDemandId ? 'Ask about your demand...' : 'Select a demand first...'}
                disabled={sending}
                className="flex-1 bg-transparent text-[12px] text-white placeholder-slate-500 outline-none font-sans"
              />
              <button
                onClick={() => sendMessage()}
                disabled={sending || !input.trim()}
                className="w-7 h-7 rounded-lg bg-violet-700 hover:bg-violet-600 disabled:opacity-40 flex items-center justify-center transition-colors shrink-0"
              >
                {sending ? <Loader2 className="w-3.5 h-3.5 text-white animate-spin" /> : <Send className="w-3.5 h-3.5 text-white" />}
              </button>
            </div>
            <p className="text-[9px] text-slate-600 text-center mt-1.5 font-mono">
              Answers are based only on your demand records • No internal data shared
            </p>
          </div>
        </>
      )}
    </div>
  );
}
