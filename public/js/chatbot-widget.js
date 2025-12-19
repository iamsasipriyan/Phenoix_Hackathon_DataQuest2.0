class SupportChatbot extends HTMLElement {
    static get observedAttributes() { return ["title", "welcome", "accent", "position", "endpoint", "embedded"]; }

    constructor() {
        super();
        this.attachShadow({ mode: "open" });
        this.stateKey = "support-chatbot-state-v1";
        this.defaultTitle = this.getAttribute("title") || "Support";
        this.defaultWelcome = this.getAttribute("welcome") || "Hi! 👋 How can I help?";
        this.endpoint = this.getAttribute("endpoint") || "";
        this.position = this.getAttribute("position") || "bottom-right";
        this.accent = this.getAttribute("accent") || "#0ea5e9";
        this.isEmbedded = this.hasAttribute("embedded");
        this.messages = [];
        this.isOpen = false;
        this.typing = false;
        this.render();
    }

    attributeChangedCallback(name, oldVal, newVal) {
        if (oldVal === newVal) return;
        if (name === "title") this.defaultTitle = newVal;
        if (name === "welcome") this.defaultWelcome = newVal;
        if (name === "accent") this.accent = newVal;
        if (name === "position") this.position = newVal;
        if (name === "endpoint") this.endpoint = newVal || "";
        if (name === "embedded") this.isEmbedded = newVal !== null;
        this.updateStyles();
        this.persistState();
    }

    connectedCallback() {
        const saved = localStorage.getItem(this.stateKey);
        if (saved) {
            try {
                const s = JSON.parse(saved);
                this.isOpen = !!s.isOpen;
                this.messages = Array.isArray(s.messages) ? s.messages : [];
            } catch { }
        }

        // If embedded, force open logic logic might be different, but let's keep message history
        if (this.isEmbedded) {
            this.isOpen = true; // Always "open" logic-wise when embedded
        }

        if (!this.messages.length) {
            this.messages.push({ role: "assistant", content: this.defaultWelcome, ts: Date.now() });
        }
        this.renderMessages();
        this.updateOpenState(this.isOpen);
    }

    persistState() {
        localStorage.setItem(this.stateKey, JSON.stringify({ isOpen: this.isOpen, messages: this.messages.slice(-200) }));
    }

    render() {
        const posRight = (this.position || "").includes("right");
        this.shadowRoot.innerHTML = `
        <style>
          :host { all: initial; }
          *, *::before, *::after { box-sizing: border-box; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial; }
          :host {
            --chat-accent: ${this.accent};
            --chat-bg: #ffffff; 
            --chat-surface: #f3f4f6; 
            --chat-border: #e2e8f0;
            --chat-text: #1e293b; 
            --chat-muted: #64748b; 
            --radius: 16px; 
            --shadow: 0 10px 30px rgba(0,0,0,0.15);
            /* Default fixed positioning */
            position: fixed; ${posRight ? 'right:20px;' : 'left:20px;'} bottom: 20px; z-index: 2147483647;
          }
          :host([embedded]) {
            position: static !important;
            width: 100%;
            height: 100%;
            z-index: auto;
            display: block;
          }
          
          .fab { width:58px;height:58px;border-radius:50%;display:grid;place-items:center;cursor:pointer;
                 background:var(--chat-accent);color:#fff;border:none;box-shadow:var(--shadow);transition:transform .15s,box-shadow .2s;}
          .fab:hover{ transform:translateY(-1px); box-shadow:0 12px 32px rgba(0,0,0,.45); }
          
          .panel { width:min(360px,92vw); height:520px; max-height:70vh; background:var(--chat-surface); color:var(--chat-text);
                   border:1px solid var(--chat-border); border-radius:var(--radius); box-shadow:var(--shadow);
                   display:none; flex-direction:column; overflow:hidden; }
          
          /* Embedded styles override panel */
          :host([embedded]) .panel {
            width: 100% !important;
            height: 100% !important;
            max-height: none !important;
            border: none;
            border-radius: 0; /* Or keep radius if desired inside modal */
            background: transparent; /* Let container handle bg or keep it */
            box-shadow: none;
            display: flex !important; /* Always flex */
            animation: none;
          }
          :host([embedded]) .fab { display: none !important; }
          :host([embedded]) .iconbtn[data-act="min"] { display: none !important; }

          .panel.open { display:flex; animation:pop .18s ease; } 
          @keyframes pop{ from{transform:translateY(6px);opacity:0} to{transform:translateY(0);opacity:1} }
          
          .header{ display:flex; align-items:center; gap:10px; padding:12px; background:linear-gradient(180deg,rgba(0,0,0,.02),transparent); border-bottom:1px solid var(--chat-border); }
          .status{ width:10px;height:10px;border-radius:50%;background:#34d399; box-shadow:0 0 0 3px rgba(52,211,153,.15);}
          .title{ font-weight:700; letter-spacing:.2px; } .grow{flex:1}
          .iconbtn{ background:transparent;border:0;color:var(--chat-muted);cursor:pointer;padding:6px;border-radius:8px; }
          .iconbtn:hover{ background:rgba(0,0,0,.05); color:var(--chat-text); }
          .list{ flex:1; padding:14px; overflow:auto; display:flex; flex-direction:column; gap:10px; background:var(--chat-bg); }
          .bubble{ max-width:82%; padding:10px 12px; border-radius:14px; font-size:14px; line-height:1.4; white-space:pre-wrap; word-wrap:break-word; border:1px solid var(--chat-border); }
          .user{ align-self:flex-end; background:var(--chat-accent); color: white; border-color:var(--chat-accent); }
          .assistant{ align-self:flex-start; background: white; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
          .time{ display:block; margin-top:4px; font-size:11px; opacity: 0.7; color:inherit; }
          .bubble.assistant .time { color: var(--chat-muted); }
          .typing{ display:inline-flex; gap:4px; } .dot{ width:6px;height:6px;border-radius:50%;background:var(--chat-muted);opacity:.7;animation:blink 1s infinite;}
          .dot:nth-child(2){animation-delay:.15s}.dot:nth-child(3){animation-delay:.3s}@keyframes blink{0%,80%,100%{opacity:.15}40%{opacity:.9}}
          .composer{ border-top:1px solid var(--chat-border); padding:10px; background:linear-gradient(180deg,transparent,rgba(0,0,0,.02)); display:flex; gap:8px; }
          textarea{ flex:1; resize:none; background:#ffffff; color:var(--chat-text); border:1px solid var(--chat-border); border-radius:10px; min-height:42px; max-height:120px; padding:10px 12px; outline:none; transition: border-color 0.2s; }
          textarea:focus { border-color: var(--chat-accent); }
          .send{ background:var(--chat-accent); color:#fff; border:0; border-radius:10px; padding:0 14px; min-width:44px; display:grid; place-items:center; cursor:pointer; }
          .send:disabled{ opacity:.6; cursor:not-allowed }
          @media (max-width: 480px) { .panel{ width:min(96vw,400px); max-height:78vh; } }
        </style>
        <button class="fab" aria-label="Open chat" title="Chat">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 3C7.03 3 3 6.58 3 11c0 2.05 1.03 3.9 2.69 5.24-.1.86-.39 2.22-1.3 3.6 0 0 2.1-.41 3.82-1.68 1.17.36 2.43.56 3.79.56 4.97 0 9-3.58 9-8s-4.03-8-9-8z" fill="currentColor"/>
          </svg>
        </button>
        <div class="panel" role="dialog" aria-label="Chatbot" aria-modal="false">
          <div class="header">
            <span class="status" aria-label="online"></span>
            <div class="title">${this.defaultTitle}</div>
            <div class="grow"></div>
            <button class="iconbtn" data-act="min" aria-label="Minimize">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M6 19h12" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
            </button>
          </div>
          <div class="list" part="messages" aria-live="polite"></div>
          <div class="composer">
            <textarea rows="1" placeholder="Write a message…"></textarea>
            <button class="send" data-act="send" aria-label="Send">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M22 2L11 13" stroke="white" stroke-width="1.6" stroke-linecap="round"/><path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="white" stroke-width="1.6" stroke-linejoin="round"/></svg>
            </button>
          </div>
        </div>
      `;
        this.cacheEls(); this.bindEvents(); this.updateStyles();
    }

    cacheEls() {
        const $ = s => this.shadowRoot.querySelector(s);
        this.$fab = $(".fab"); this.$panel = $(".panel"); this.$list = $(".list");
        this.$ta = this.shadowRoot.querySelector("textarea"); this.$send = this.shadowRoot.querySelector(".send");
        this.$title = this.shadowRoot.querySelector(".title");
    }

    bindEvents() {
        this.$fab.addEventListener("click", () => this.updateOpenState(true));
        this.shadowRoot.querySelector('[data-act="min"]').addEventListener("click", () => this.updateOpenState(false));
        this.$send.addEventListener("click", () => this.handleSend());
        this.$ta.addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); this.handleSend(); } });
        this.$ta.addEventListener("input", () => this.autoResize());
    }

    updateStyles() {
        this.shadowRoot.host.style.setProperty('--chat-accent', this.accent);
        const posRight = (this.position || '').includes('right');

        if (this.isEmbedded) {
            // Reset fixed positioning styles if embedded, handled by :host([embedded]) css
            this.shadowRoot.host.removeAttribute('style');
            // Re-apply accent though
            this.shadowRoot.host.style.setProperty('--chat-accent', this.accent);
        } else {
            this.shadowRoot.host.style.right = posRight ? '20px' : '';
            this.shadowRoot.host.style.left = posRight ? '' : '20px';
        }

        if (this.$title) this.$title.textContent = this.defaultTitle;
    }

    updateOpenState(open) {
        if (this.isEmbedded) {
            // If embedded, panel is always displayed via CSS override, but we update internal state
            this.isOpen = true;
        } else {
            this.isOpen = open;
            this.$panel.classList.toggle('open', open);
            this.$fab.style.display = open ? 'none' : 'grid';
        }

        if (open || this.isEmbedded) {
            this.scrollToBottom();
            setTimeout(() => this.$ta.focus(), 75);
        }
        this.persistState();
    }

    autoResize() {
        this.$ta.style.height = 'auto';
        this.$ta.style.height = Math.min(this.$ta.scrollHeight, 120) + 'px';
    }

    renderMessages() {
        if (!this.$list) return;
        this.$list.innerHTML = '';
        for (const m of this.messages) {
            const item = document.createElement('div');
            item.className = `bubble ${m.role}`;
            item.innerHTML = `${this.escape(m.content)}<span class="time">${new Date(m.ts || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>`;
            this.$list.appendChild(item);
        }
        if (this.typing) {
            const t = document.createElement('div');
            t.className = 'bubble assistant';
            t.innerHTML = '<span class="typing"><span class="dot"></span><span class="dot"></span><span class="dot"></span></span>';
            this.$list.appendChild(t);
        }
        this.scrollToBottom();
        this.persistState();
    }

    scrollToBottom() { this.$list.scrollTop = this.$list.scrollHeight; }
    escape(str = "") { return str.replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c])); }
    push(role, content) { this.messages.push({ role, content, ts: Date.now() }); this.renderMessages(); }

    async handleSend() {
        const text = this.$ta.value.trim(); if (!text) return;
        this.$ta.value = ''; this.autoResize(); this.push('user', text);
        this.typing = true; this.renderMessages();
        try {
            const reply = await this.getReply(text, this.messages);
            this.typing = false; this.push('assistant', reply);
        } catch (e) {
            this.typing = false; this.push('assistant', `⚠️ ${e.message}`); console.error(e);
        }
    }

   async getReply(latestUserText) {
    if (!this.endpoint) {
        return `You said: "${latestUserText}"`;
    }

    const res = await fetch(this.endpoint, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            message: latestUserText   // ✅ BACKEND EXPECTS THIS
        })
    });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text}`);
    }

    const data = await res.json();

    return (
        data.reply ||
        data.message ||
        "No response from server"
    );
} async getReply(latestUserText, history) {
        if (this.endpoint) {
            const res = await fetch(this.endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages: history })
            });
            const text = await res.text();
            if (!res.ok) {
                let detail = text; try { detail = JSON.parse(text).error || text; } catch { }
                throw new Error(`HTTP ${res.status}: ${detail}`);
            }
            try {
                const data = JSON.parse(text);
                return data.reply || data.message || data.text || 'Thanks!';
            } catch {
                throw new Error(`Bad JSON from server: ${text.slice(0, 200)}`);
            }
        }
        await new Promise(r => setTimeout(r, 600));
        return `You said: "${latestUserText}"\n\n(This is a demo reply. Connect your backend via the 'endpoint' attribute.)`;
    }
}

customElements.define('support-chatbot', SupportChatbot);
