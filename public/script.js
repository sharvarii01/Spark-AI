document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const chatForm = document.getElementById('chatForm');
    const messageInput = document.getElementById('messageInput');
    const chatWindow = document.getElementById('chatWindow');
    const sendBtn = document.getElementById('sendBtn');
    const newChatBtn = document.getElementById('newChatBtn');
    const historyList = document.getElementById('historyList');
    const themeToggle = document.getElementById('themeToggle');
    const menuToggle = document.getElementById('menuToggle');
    const closeSidebarBtn = document.getElementById('closeSidebarBtn');
    const sidebar = document.getElementById('sidebar');

    // App State
    let sessions = JSON.parse(localStorage.getItem('sparkAiSessions')) || [];
    let currentSessionId = null;
    let chatHistory = []; // API specific format: { role, parts: [{text}]}

    // Initialize App
    initTheme();
    renderHistoryList();
    loadNewChat();

    // Theme Logic
    function initTheme() {
        const savedTheme = localStorage.getItem('sparkAiTheme');
        if (savedTheme === 'light') {
            document.body.classList.add('light-theme');
        }
    }

    themeToggle.addEventListener('click', () => {
        document.body.classList.toggle('light-theme');
        const isLight = document.body.classList.contains('light-theme');
        localStorage.setItem('sparkAiTheme', isLight ? 'light' : 'dark');
    });

    // Mobile Sidebar
    menuToggle.addEventListener('click', () => sidebar.classList.add('open'));
    closeSidebarBtn.addEventListener('click', () => sidebar.classList.remove('open'));

    // New Chat
    newChatBtn.addEventListener('click', () => {
        loadNewChat();
        if(window.innerWidth <= 768) sidebar.classList.remove('open');
    });

    // Input Handlers
    messageInput.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight) + 'px';
        sendBtn.disabled = this.value.trim() === '';
    });

    messageInput.addEventListener('keydown', function(event) {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            if (this.value.trim() !== '') {
                chatForm.dispatchEvent(new Event('submit'));
            }
        }
    });

    // Submission Handler
    chatForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const messageText = messageInput.value.trim();
        if (!messageText) return;

        // Ensure we have an active session ID
        if (!currentSessionId) {
            currentSessionId = Date.now().toString();
            sessions.unshift({
                id: currentSessionId,
                title: messageText.substring(0, 30) + (messageText.length > 30 ? '...' : ''),
                messages: [],
                apiHistory: []
            });
        }

        // Reset input immediately
        messageInput.value = '';
        messageInput.style.height = 'auto';
        sendBtn.disabled = true;

        // Current Session Reference
        let session = sessions.find(s => s.id === currentSessionId);

        // Add User Message
        appendMessage('user', messageText);
        session.messages.push({ role: 'user', text: messageText });
        
        // Add Loading
        const loadingId = appendLoadingIndicator();

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: messageText,
                    history: session.apiHistory
                })
            });

            removeElement(loadingId);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `Server error ${response.status}`);
            }

            const data = await response.json();
            
            // Add Model Message
            appendMessage('model', data.reply);
            session.messages.push({ role: 'model', text: data.reply });

            // Update API History
            session.apiHistory.push({ role: 'user', parts: [{ text: messageText }] });
            session.apiHistory.push({ role: 'model', parts: [{ text: data.reply }] });

            saveSessions();
            renderHistoryList();

        } catch (error) {
            console.error('Error:', error);
            removeElement(loadingId);
            appendMessage('system', `⚠️ Error: ${error.message}`);
        }
    });

    // Rendering Logic
    function loadNewChat() {
        currentSessionId = null;
        chatHistory = [];
        chatWindow.innerHTML = `
            <div class="message system">
                <div class="avatar"><img src="logo.png" alt="logo"></div>
                <div class="message-content">
                    <p>Hello! I'm Spark AI. Start a new conversation below.</p>
                </div>
            </div>
        `;
        renderHistoryList();
        messageInput.focus();
    }

    function loadSession(id) {
        const session = sessions.find(s => s.id === id);
        if(!session) return;
        
        currentSessionId = id;
        chatHistory = session.apiHistory || [];
        chatWindow.innerHTML = '';
        
        session.messages.forEach(msg => {
            appendMessage(msg.role, msg.text, false);
        });
        
        renderHistoryList();
        scrollToBottom();
        if(window.innerWidth <= 768) sidebar.classList.remove('open');
    }

    function renderHistoryList() {
        historyList.innerHTML = '';
        sessions.forEach(session => {
            const li = document.createElement('li');
            li.className = `history-item ${session.id === currentSessionId ? 'active' : ''}`;
            li.textContent = session.title;
            li.addEventListener('click', () => loadSession(session.id));
            historyList.appendChild(li);
        });
    }

    function saveSessions() {
        localStorage.setItem('sparkAiSessions', JSON.stringify(sessions));
    }

    function appendMessage(role, text, animate = true) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${role === 'user' ? 'user' : 'system'}`;
        
        const avatarDiv = document.createElement('div');
        avatarDiv.className = 'avatar';
        if(role === 'user') {
            avatarDiv.textContent = 'U';
        } else {
            avatarDiv.innerHTML = '<img src="logo.png" alt="logo">';
        }
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        
        if (role === 'model' || role === 'system') {
            const rawMarkup = marked.parse(text);
            contentDiv.innerHTML = DOMPurify.sanitize(rawMarkup);
            
            if (animate) {
                messageDiv.style.opacity = '0';
                messageDiv.style.transform = 'translateY(10px)';
                messageDiv.style.transition = 'all 0.3s ease-out';
                setTimeout(() => {
                    messageDiv.style.opacity = '1';
                    messageDiv.style.transform = 'translateY(0)';
                }, 10);
            }
        } else {
            const p = document.createElement('p');
            p.textContent = text;
            contentDiv.appendChild(p);
        }
        
        messageDiv.appendChild(avatarDiv);
        messageDiv.appendChild(contentDiv);
        chatWindow.appendChild(messageDiv);
        scrollToBottom();
    }

    function appendLoadingIndicator() {
        const id = 'loading-' + Date.now();
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message system';
        messageDiv.id = id;
        
        const avatarDiv = document.createElement('div');
        avatarDiv.className = 'avatar';
        avatarDiv.innerHTML = '<img src="logo.png" alt="logo">';
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        
        const typingIndicator = document.createElement('div');
        typingIndicator.className = 'typing-indicator';
        for(let i=0; i<3; i++) {
            const dot = document.createElement('div');
            dot.className = 'typing-dot';
            typingIndicator.appendChild(dot);
        }
        
        contentDiv.appendChild(typingIndicator);
        messageDiv.appendChild(avatarDiv);
        messageDiv.appendChild(contentDiv);
        chatWindow.appendChild(messageDiv);
        scrollToBottom();
        return id;
    }

    function removeElement(id) {
        const el = document.getElementById(id);
        if (el) el.remove();
    }

    function scrollToBottom() {
        chatWindow.scrollTop = chatWindow.scrollHeight;
    }
});
