'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import { Loader2, Send, X } from 'lucide-react';

type ChatMessage = { role: 'user' | 'assistant'; content: string };

/**
 * A floating "how do I..." assistant, grounded only in a description of
 * the app's own structure (see lib/helpBotKnowledge.ts) — it has no access
 * to real orders/customers/stock, so it can only help with navigation and
 * workflow, never leak or guess at actual business data. Lives in the root
 * layout rather than the Shell, so the conversation survives client-side
 * navigation between pages instead of resetting on every click.
 */
export function HelpBot({ userName }: { userName: string }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const listRef = useRef<HTMLDivElement>(null);

  function scrollToBottom() {
    requestAnimationFrame(() => {
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
    });
  }

  async function send() {
    const text = input.trim();
    if (!text || sending) return;
    setError('');
    const next = [...messages, { role: 'user' as const, content: text }];
    setMessages(next);
    setInput('');
    setSending(true);
    scrollToBottom();
    try {
      const res = await fetch('/api/help-bot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Something went wrong.');
        return;
      }
      setMessages((prev) => [...prev, { role: 'assistant', content: data.reply }]);
    } catch {
      setError('Could not reach the help assistant — check your connection.');
    } finally {
      setSending(false);
      scrollToBottom();
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-5 right-5 z-40 h-16 w-16 rounded-full shadow-pop grid place-items-center active:scale-[0.97] transition-all print:hidden overflow-hidden bg-white"
        aria-label={open ? 'Close help' : 'Open help'}
      >
        {open ? (
          <span className="h-full w-full grid place-items-center bg-brand text-white">
            <X size={22} />
          </span>
        ) : (
          <Image src="/help-bot-avatar.png" alt="" width={64} height={64} className="h-full w-full object-cover" />
        )}
      </button>

      {open && (
        <div
          className="fixed bottom-24 right-5 z-40 w-[calc(100vw-2.5rem)] max-w-sm h-[28rem] max-h-[70vh] card flex flex-col overflow-hidden shadow-pop print:hidden"
          role="dialog" aria-modal="false" aria-label="Help"
        >
          <header className="bg-forest text-white px-4 py-3 shrink-0">
            <p className="font-semibold text-sm">Help</p>
            <p className="text-xs text-white/60">Ask how to do something in the app</p>
          </header>

          <div ref={listRef} className="flex-1 overflow-y-auto p-3 space-y-2.5">
            {messages.length === 0 && (
              <p className="text-sm text-ink-muted p-2">
                Hi {userName.split(' ')[0]} — ask me anything about using the app, like &ldquo;how do I log fuel&rdquo; or
                &ldquo;where do I upload a certificate&rdquo;.
              </p>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <p className={`max-w-[85%] rounded-xl px-3 py-2 text-sm whitespace-pre-wrap ${
                  m.role === 'user' ? 'bg-brand text-white' : 'bg-canvas text-ink'
                }`}
                >
                  {m.content}
                </p>
              </div>
            ))}
            {sending && (
              <div className="flex justify-start">
                <p className="rounded-xl px-3 py-2 bg-canvas text-ink-muted">
                  <Loader2 size={14} className="animate-spin" aria-label="Thinking…" />
                </p>
              </div>
            )}
            {error && <p className="text-xs text-signal px-2">{error}</p>}
          </div>

          <div className="border-t border-hairline p-2.5 flex items-end gap-2 shrink-0">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              rows={1}
              placeholder="Ask a question…"
              className="input flex-1 resize-none text-sm"
              disabled={sending}
            />
            <button
              type="button"
              onClick={send}
              disabled={sending || !input.trim()}
              className="btn-primary btn-sm shrink-0"
              aria-label="Send"
            >
              {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
