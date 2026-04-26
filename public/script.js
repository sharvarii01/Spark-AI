import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";
import { getFirestore, collection, getDocs, doc, setDoc, query, orderBy } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDnnVB_B1hzSVaHbfi3nrE4CG4ZqQjwkgQ",
  authDomain: "spark-ai-77603.firebaseapp.com",
  projectId: "spark-ai-77603",
  storageBucket: "spark-ai-77603.firebasestorage.app",
  messagingSenderId: "899248565695",
  appId: "1:899248565695:web:d44d70f56bb960b2afc50a"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

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
    const landingPage = document.getElementById('landingPage');
    const startAppBtn = document.getElementById('startAppBtn');
    
    // Auth DOM Elements
    const authModal = document.getElementById('authModal');
    const authForm = document.getElementById('authForm');
    const emailInput = document.getElementById('emailInput');
    const passwordInput = document.getElementById('passwordInput');
    const authTitle = document.getElementById('authTitle');
    const authSubmitBtn = document.getElementById('authSubmitBtn');
    const authSwitchBtn = document.getElementById('authSwitchBtn');
    const authSwitchText = document.getElementById('authSwitchText');
    const authError = document.getElementById('authError');
    const skipAuthBtn = document.getElementById('skipAuthBtn');
    const googleSignInBtn = document.getElementById('googleSignInBtn');
    const userProfile = document.getElementById('userProfile');
    const userEmail = document.getElementById('userEmail');
    const userAvatar = document.getElementById('userAvatar');
    const logoutBtn = document.getElementById('logoutBtn');

    // App State
    let sessions = [];
    let currentSessionId = null;
    let chatHistory = []; 
    let currentUser = null;
    let isRegistering = false;

    // Initialize App
    initTheme();
    loadNewChat();
    initLandingPage();

    // Firebase Auth State Listener
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;
            authModal.classList.add('hidden');
            userProfile.classList.remove('hidden');
            userEmail.textContent = user.email;
            userAvatar.textContent = user.email.charAt(0).toUpperCase();
            
            // Save user info to Firestore so it's visible in the database
            try {
                await setDoc(doc(db, 'users', user.uid), {
                    email: user.email,
                    lastLogin: Date.now()
                }, { merge: true });
            } catch (error) {
                console.error("Error saving user data:", error);
            }
            
            // Load sessions from Firestore
            await fetchSessionsFromFirestore();
            renderHistoryList();
        } else {
            currentUser = null;
            userProfile.classList.add('hidden');
            
            // Only show auth modal if they haven't explicitly skipped it and app has started
            if (!sessionStorage.getItem('sparkAiAuthSkipped') && sessionStorage.getItem('sparkAiLandingSeen')) {
                authModal.classList.remove('hidden');
            }
            
            // Load from local storage for unauthenticated usage
            sessions = JSON.parse(localStorage.getItem('sparkAiSessions')) || [];
            renderHistoryList();
        }
    });

    // Auth UI Handlers
    authSwitchBtn.addEventListener('click', () => {
        isRegistering = !isRegistering;
        if (isRegistering) {
            authTitle.textContent = 'Create an Account';
            authSubmitBtn.textContent = 'Sign Up';
            authSwitchText.textContent = 'Already have an account?';
            authSwitchBtn.textContent = 'Sign In';
        } else {
            authTitle.textContent = 'Sign In to Spark AI';
            authSubmitBtn.textContent = 'Sign In';
            authSwitchText.textContent = "Don't have an account?";
            authSwitchBtn.textContent = 'Sign Up';
        }
        authError.classList.add('hidden');
    });

    skipAuthBtn.addEventListener('click', () => {
        sessionStorage.setItem('sparkAiAuthSkipped', 'true');
        authModal.classList.add('hidden');
    });

    logoutBtn.addEventListener('click', async () => {
        try {
            await signOut(auth);
            loadNewChat(); // Clear current screen
        } catch (error) {
            console.error("Error signing out:", error);
        }
    });

    authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = emailInput.value.trim();
        const password = passwordInput.value.trim();
        authError.classList.add('hidden');
        
        try {
            if (isRegistering) {
                await createUserWithEmailAndPassword(auth, email, password);
            } else {
                await signInWithEmailAndPassword(auth, email, password);
            }
            // onAuthStateChanged will handle the UI update
            emailInput.value = '';
            passwordInput.value = '';
        } catch (error) {
            authError.textContent = error.message.replace('Firebase: ', '');
            authError.classList.remove('hidden');
        }
    });

    if (googleSignInBtn) {
        googleSignInBtn.addEventListener('click', async () => {
            authError.classList.add('hidden');
            const provider = new GoogleAuthProvider();
            try {
                await signInWithPopup(auth, provider);
                // onAuthStateChanged will handle the UI update
            } catch (error) {
                authError.textContent = error.message.replace('Firebase: ', '');
                authError.classList.remove('hidden');
            }
        });
    }

    // Landing Page Logic
    function initLandingPage() {
        if (!landingPage || !startAppBtn) return;
        
        if (sessionStorage.getItem('sparkAiLandingSeen')) {
            landingPage.style.display = 'none';
            landingPage.classList.add('hidden');
            // If they haven't skipped auth and aren't logged in, show auth modal
            if (!sessionStorage.getItem('sparkAiAuthSkipped') && !currentUser) {
                authModal.classList.remove('hidden');
            }
        }

        startAppBtn.addEventListener('click', () => {
            landingPage.classList.add('hidden');
            sessionStorage.setItem('sparkAiLandingSeen', 'true');
            setTimeout(() => {
                landingPage.style.display = 'none';
                if (!currentUser && !sessionStorage.getItem('sparkAiAuthSkipped')) {
                    authModal.classList.remove('hidden');
                } else {
                    messageInput.focus();
                }
            }, 600);
        });
    }

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
            const newSession = {
                id: currentSessionId,
                title: messageText.substring(0, 30) + (messageText.length > 30 ? '...' : ''),
                messages: [],
                apiHistory: [],
                timestamp: Date.now()
            };
            sessions.unshift(newSession);
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

    async function fetchSessionsFromFirestore() {
        if (!currentUser) return;
        try {
            const q = query(collection(db, `users/${currentUser.uid}/sessions`), orderBy("timestamp", "desc"));
            const querySnapshot = await getDocs(q);
            const fetchedSessions = [];
            querySnapshot.forEach((docSnap) => {
                fetchedSessions.push(docSnap.data());
            });
            sessions = fetchedSessions;
        } catch (error) {
            console.error("Error fetching sessions:", error);
        }
    }

    async function saveSessions() {
        if (currentUser) {
            try {
                // Save specific session to Firestore
                const currentSession = sessions.find(s => s.id === currentSessionId);
                if (currentSession) {
                    await setDoc(doc(db, `users/${currentUser.uid}/sessions/${currentSession.id}`), currentSession);
                }
            } catch (error) {
                console.error("Error saving session to Firebase:", error);
            }
        } else {
            // Save to localStorage for unauthenticated usage
            localStorage.setItem('sparkAiSessions', JSON.stringify(sessions));
        }
    }

    function appendMessage(role, text, animate = true) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${role === 'user' ? 'user' : 'system'}`;
        
        const avatarDiv = document.createElement('div');
        avatarDiv.className = 'avatar';
        if(role === 'user') {
            avatarDiv.textContent = currentUser ? currentUser.email.charAt(0).toUpperCase() : 'U';
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
