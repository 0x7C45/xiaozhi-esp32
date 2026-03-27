class LingbanFrontend {
    constructor() {
        this.ws = null;
        this.isConnecting = false;
        this.history = [];
        this.messages = [];
        this.currentIdentity = null;
        this.isSpeaking = false;
        this.connectionMode = null;
        
        try {
            this.initElements();
            this.loadSettings();
            this.loadHistory();
            this.bindEvents();
            this.startCameraRefresh();
            this.renderHistory();
            this.renderChatMessages();
            this.updateLingbanStatus('idle');
            console.log('LingbanFrontend initialized successfully');
        } catch (error) {
            console.error('Initialization error:', error);
            alert('初始化错误: ' + error.message);
        }
    }

    initElements() {
        this.elements = {
            statusIndicator: document.getElementById('statusIndicator'),
            statusText: document.getElementById('statusText'),
            cameraFeed: document.getElementById('cameraFeed'),
            cameraPlaceholder: document.getElementById('cameraPlaceholder'),
            recognitionResult: document.getElementById('recognitionResult'),
            identityAvatar: document.getElementById('identityAvatar'),
            identityName: document.getElementById('identityName'),
            identityDesc: document.getElementById('identityDesc'),
            lingbanSpeech: document.getElementById('lingbanSpeech'),
            lingbanStatus: document.getElementById('lingbanStatus'),
            speechBar: document.getElementById('speechBar'),
            notificationPanel: document.getElementById('notificationPanel'),
            notificationText: document.getElementById('notificationText'),
            notificationTime: document.getElementById('notificationTime'),
            historyList: document.getElementById('historyList'),
            chatMessages: document.getElementById('chatMessages'),
            chatInput: document.getElementById('chatInput'),
            sendChatBtn: document.getElementById('sendChatBtn'),
            websocketUrl: document.getElementById('websocketUrl'),
            cameraUrl: document.getElementById('cameraUrl'),
            openclawUrl: document.getElementById('openclawUrl'),
            openclawToken: document.getElementById('openclawToken'),
            connectionMode: document.getElementById('connectionMode'),
            connectBtn: document.getElementById('connectBtn'),
            disconnectBtn: document.getElementById('disconnectBtn'),
            refreshCamera: document.getElementById('refreshCamera'),
            autoRefresh: document.getElementById('autoRefresh'),
            refreshInterval: document.getElementById('refreshInterval'),
            settingsBtn: document.getElementById('settingsBtn'),
            settingsModal: document.getElementById('settingsModal'),
            modalOverlay: document.getElementById('modalOverlay'),
            modalClose: document.getElementById('modalClose')
        };
    }

    loadSettings() {
        const settings = JSON.parse(localStorage.getItem('lingban_settings') || '{}');
        if (settings.websocketUrl) {
            this.elements.websocketUrl.value = settings.websocketUrl;
        }
        if (settings.cameraUrl) {
            this.elements.cameraUrl.value = settings.cameraUrl;
        }
        if (settings.openclawUrl) {
            this.elements.openclawUrl.value = settings.openclawUrl;
        }
        if (settings.openclawToken) {
            this.elements.openclawToken.value = settings.openclawToken;
        }
        if (settings.connectionMode) {
            this.elements.connectionMode.value = settings.connectionMode;
        }
        this.updateModeUI();
    }

    saveSettings() {
        const settings = {
            websocketUrl: this.elements.websocketUrl.value,
            cameraUrl: this.elements.cameraUrl.value,
            openclawUrl: this.elements.openclawUrl.value,
            openclawToken: this.elements.openclawToken.value,
            connectionMode: this.elements.connectionMode.value
        };
        localStorage.setItem('lingban_settings', JSON.stringify(settings));
    }

    updateModeUI() {
        try {
            const mode = this.elements.connectionMode?.value || 'xiaozhi';
            const websocketGroup = document.getElementById('websocketGroup');
            const openclawGroups = document.querySelectorAll('.openclaw-group');
            
            if (mode === 'xiaozhi') {
                if (websocketGroup) websocketGroup.style.display = 'block';
                openclawGroups.forEach(el => el.style.display = 'none');
            } else {
                if (websocketGroup) websocketGroup.style.display = 'none';
                openclawGroups.forEach(el => el.style.display = 'block');
            }
        } catch (error) {
            console.error('updateModeUI error:', error);
        }
    }

    loadHistory() {
        this.history = JSON.parse(localStorage.getItem('lingban_history') || '[]');
        this.messages = JSON.parse(localStorage.getItem('lingban_messages') || '[]');
    }

    saveHistory() {
        localStorage.setItem('lingban_history', JSON.stringify(this.history));
        localStorage.setItem('lingban_messages', JSON.stringify(this.messages));
    }

    bindEvents() {
        try {
            this.elements.connectBtn?.addEventListener('click', () => {
                console.log('Connect button clicked');
                this.connect();
            });
            this.elements.disconnectBtn?.addEventListener('click', () => this.disconnect());
            this.elements.refreshCamera?.addEventListener('click', () => this.refreshCameraFeed());
            this.elements.websocketUrl?.addEventListener('change', () => this.saveSettings());
            this.elements.cameraUrl?.addEventListener('change', () => this.saveSettings());
            this.elements.openclawUrl?.addEventListener('change', () => this.saveSettings());
            this.elements.openclawToken?.addEventListener('change', () => this.saveSettings());
            this.elements.connectionMode?.addEventListener('change', () => {
                this.updateModeUI();
                this.saveSettings();
            });
            
            this.elements.sendChatBtn?.addEventListener('click', () => this.sendChatMessage());
            this.elements.chatInput?.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.sendChatMessage();
            });
            
            this.elements.settingsBtn?.addEventListener('click', () => {
                this.elements.settingsModal?.classList.add('open');
            });
            
            this.elements.modalClose?.addEventListener('click', () => {
                this.elements.settingsModal?.classList.remove('open');
            });
            
            this.elements.modalOverlay?.addEventListener('click', () => {
                this.elements.settingsModal?.classList.remove('open');
            });

            window.addEventListener('beforeunload', () => this.disconnect());
            console.log('Events bound successfully');
        } catch (error) {
            console.error('bindEvents error:', error);
        }
    }

    sendChatMessage() {
        const text = this.elements.chatInput.value.trim();
        if (!text) return;
        
        this.elements.chatInput.value = '';
        
        if (this.connectionMode === 'openclaw') {
            this.sendChatToOpenClaw(text);
        } else if (this.ws && this.connectionMode === 'xiaozhi') {
            this.ws.send(JSON.stringify({ type: 'stt', text: text }));
            this.addChatMessage('user', text);
            this.addToStatusHistory('天天', 'talk', '说: ' + text);
        }
    }

    connect() {
        if (this.isConnecting || this.ws) return;

        const mode = this.elements.connectionMode.value;
        
        if (mode === 'openclaw') {
            this.connectOpenClaw();
        } else {
            this.connectXiaozhi();
        }
    }

    connectXiaozhi() {
        const url = this.elements.websocketUrl.value;
        if (!url) {
            alert('请输入 WebSocket 地址');
            return;
        }

        this.isConnecting = true;
        this.updateConnectionStatus('connecting');
        this.connectionMode = 'xiaozhi';

        try {
            this.ws = new WebSocket(url);

            this.ws.onopen = () => {
                this.isConnecting = false;
                this.updateConnectionStatus('connected');
                this.sendHello();
            };

            this.ws.onmessage = (event) => this.handleMessage(event);

            this.ws.onclose = () => {
                this.isConnecting = false;
                this.ws = null;
                this.updateConnectionStatus('disconnected');
                this.updateLingbanStatus('idle');
            };

            this.ws.onerror = (error) => {
                console.error('WebSocket error:', error);
                this.isConnecting = false;
                this.updateConnectionStatus('disconnected');
            };

            this.elements.connectBtn.style.display = 'none';
            this.elements.disconnectBtn.style.display = 'inline-block';
        } catch (error) {
            console.error('Connection error:', error);
            this.isConnecting = false;
            this.updateConnectionStatus('disconnected');
        }
    }

    connectOpenClaw() {
        const url = this.elements.openclawUrl.value;
        const token = this.elements.openclawToken.value;
        
        if (!url) {
            alert('请输入 OpenClaw Gateway 地址');
            return;
        }

        this.isConnecting = true;
        this.updateConnectionStatus('connecting');
        this.connectionMode = 'openclaw';

        try {
            this.ws = new WebSocket(url);

            this.ws.onopen = async () => {
                console.log('OpenClaw WebSocket connected, waiting for challenge...');
            };

            this.ws.onmessage = async (event) => {
                try {
                    const message = JSON.parse(event.data);
                    console.log('OpenClaw Received:', message);
                    
                    if (message.type === 'event' && message.event === 'connect.challenge') {
                        await this.handleOpenClawChallenge(message.payload);
                    } else if (message.type === 'res' && message.id === 'connect') {
                        if (message.ok) {
                            this.isConnecting = false;
                            this.updateConnectionStatus('connected');
                            this.updateLingbanSpeech('🌸 已连接到 OpenClaw AI！🎀');
                            this.addToStatusHistory('系统', 'happy', '🤖 已连接 OpenClaw');
                            console.log('OpenClaw handshake complete');
                        } else {
                            console.error('OpenClaw connection failed:', message.error);
                            this.disconnect();
                            alert('OpenClaw 连接失败: ' + (message.error?.message || '未知错误'));
                        }
                    } else if (message.type === 'event' && message.event === 'chat') {
                        this.handleOpenClawChat(message.payload);
                    }
                } catch (error) {
                    console.error('Error parsing message:', error);
                }
            };

            this.ws.onclose = () => {
                this.isConnecting = false;
                this.ws = null;
                this.updateConnectionStatus('disconnected');
                this.updateLingbanStatus('idle');
            };

            this.ws.onerror = (error) => {
                console.error('OpenClaw WebSocket error:', error);
                this.isConnecting = false;
                this.updateConnectionStatus('disconnected');
            };

            this.elements.connectBtn.style.display = 'none';
            this.elements.disconnectBtn.style.display = 'inline-block';
        } catch (error) {
            console.error('Connection error:', error);
            this.isConnecting = false;
            this.updateConnectionStatus('disconnected');
        }
    }

    async handleOpenClawChallenge(payload) {
        const token = this.elements.openclawToken.value;
        const requestId = 'req_' + Date.now();
        
        const connectRequest = {
            type: 'req',
            id: requestId,
            method: 'connect',
            params: {
                minProtocol: 3,
                maxProtocol: 3,
                client: {
                    id: 'lingban-web',
                    version: '1.0.0',
                    platform: 'web',
                    mode: 'operator'
                },
                role: 'operator',
                scopes: ['operator.read', 'operator.write'],
                caps: [],
                commands: [],
                permissions: {},
                auth: { token: token },
                locale: 'zh-CN',
                userAgent: 'lingban-web/1.0.0',
                device: {
                    id: 'lingban-device-' + Date.now()
                }
            }
        };
        
        this.ws.send(JSON.stringify(connectRequest));
    }

    handleOpenClawChat(payload) {
        if (payload.message?.text) {
            const text = payload.message.text;
            this.addChatMessage('lingban', text);
            this.updateLingbanSpeech(text);
            this.addToStatusHistory('灵伴', 'talk', '说: ' + text);
        }
    }

    sendChatToOpenClaw(text) {
        if (!this.ws || this.connectionMode !== 'openclaw') return;
        
        const requestId = 'req_' + Date.now();
        const chatRequest = {
            type: 'req',
            id: requestId,
            method: 'chat.send',
            params: {
                message: {
                    text: text,
                    role: 'user'
                }
            }
        };
        
        this.ws.send(JSON.stringify(chatRequest));
        this.addChatMessage('user', text);
        this.addToStatusHistory('天天', 'talk', '说: ' + text);
    }

    disconnect() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.isConnecting = false;
        this.connectionMode = null;
        this.updateConnectionStatus('disconnected');
        this.elements.connectBtn.style.display = 'inline-block';
        this.elements.disconnectBtn.style.display = 'none';
    }

    updateConnectionStatus(status) {
        const indicator = this.elements.statusIndicator;
        const text = this.elements.statusText;
        
        indicator.className = 'status-indicator ' + status;
        
        const statusTexts = {
            connected: '✨ 已连接',
            connecting: '🔄 连接中...',
            disconnected: '💤 未连接'
        };
        text.textContent = statusTexts[status] || status;
    }

    sendHello() {
        const helloMessage = {
            type: 'hello',
            version: '3',
            client_id: 'lingban-web-' + Date.now()
        };
        this.ws.send(JSON.stringify(helloMessage));
    }

    handleMessage(event) {
        try {
            const message = JSON.parse(event.data);
            console.log('Received:', message);

            switch (message.type) {
                case 'hello':
                    this.handleHello(message);
                    break;
                case 'stt':
                    this.handleSTT(message);
                    break;
                case 'llm':
                    this.handleLLM(message);
                    break;
                case 'tts':
                    this.handleTTS(message);
                    break;
                case 'identity':
                    this.handleIdentity(message);
                    break;
                case 'notification':
                    this.handleNotification(message);
                    break;
                default:
                    console.log('Unknown message type:', message.type);
            }
        } catch (error) {
            console.error('Error parsing message:', error);
        }
    }

    handleHello(message) {
        this.updateLingbanSpeech('🌸 你好呀！我是灵伴~ 🎀');
        this.addToStatusHistory('灵伴', 'wave', '🤖 设备已连接');
    }

    handleSTT(message) {
        if (message.text) {
            this.addChatMessage('user', message.text);
            this.addToStatusHistory('天天', 'talk', '👧 说: ' + message.text);
            
            if (message.text.includes('输液') || message.text.includes('完了')) {
                this.showNotification('🩺 通知护士阿姨来拔针');
            }
        }
    }

    handleLLM(message) {
        this.updateLingbanSpeech(message.text || '好的~');
        
        if (message.text) {
            this.addChatMessage('lingban', message.text);
            this.addToStatusHistory('灵伴', 'happy', '说: ' + message.text);
        }
        
        if (message.emotion) {
            this.updateLingbanEmotion(message.emotion);
        }
    }

    handleTTS(message) {
        if (message.state === 'start') {
            this.updateLingbanStatus('speaking');
            this.elements.speechBar.classList.add('speaking');
        } else if (message.state === 'stop') {
            this.updateLingbanStatus('listening');
            this.elements.speechBar.classList.remove('speaking');
        }
    }

    handleIdentity(message) {
        const identity = message.identity;
        
        if (identity === 'tiantian') {
            this.currentIdentity = 'tiantian';
            this.elements.identityAvatar.className = 'identity-avatar tiantian';
            this.elements.identityAvatar.innerHTML = '<span>👧</span>';
            this.elements.identityName.textContent = '🌸 天天';
            this.elements.identityDesc.textContent = '✨ 小主人回来啦~';
            
            this.elements.recognitionResult.className = 'recognition-tag recognized';
            this.elements.recognitionResult.textContent = '✅ 找到天天啦！';
            
            this.updateLingbanSpeech('🌸 你好呀天天，现在想做什么？ 🌸');
            this.addToStatusHistory('系统', 'recognize', '🎉 识别到小主人: 天天');
            
        } else {
            this.currentIdentity = 'stranger';
            this.elements.identityAvatar.className = 'identity-avatar stranger';
            this.elements.identityAvatar.innerHTML = '<span>👤</span>';
            this.elements.identityName.textContent = '🤔 陌生人';
            this.elements.identityDesc.textContent = '我不认识你...';
            
            this.elements.recognitionResult.className = 'recognition-tag unknown';
            this.elements.recognitionResult.textContent = '❓ 这是谁呀？';
            
            this.updateLingbanSpeech('🤖 你是谁呀？我不认识你...');
            this.addToStatusHistory('系统', 'recognize', '👀 发现陌生人');
        }
    }

    handleNotification(message) {
        if (message.action === 'nurse_called') {
            this.showNotification(message.message || '🩺 通知护士阿姨');
        }
    }

    updateLingbanSpeech(text) {
        this.elements.lingbanSpeech.textContent = text;
    }

    updateLingbanStatus(status) {
        const statusText = this.elements.lingbanStatus.querySelector('.status-text');
        const statusIcon = this.elements.lingbanStatus.querySelector('.status-icon');
        
        switch(status) {
            case 'idle':
                statusText.textContent = '待机中';
                statusIcon.textContent = '💚';
                break;
            case 'listening':
                statusText.textContent = '认真听~';
                statusIcon.textContent = '💛';
                break;
            case 'speaking':
                statusText.textContent = '说话中...';
                statusIcon.textContent = '💙';
                break;
        }
    }

    updateLingbanEmotion(emotion) {
        // 简化版，不需要动画
    }

    showNotification(text) {
        this.elements.notificationText.textContent = text;
        this.elements.notificationTime.textContent = this.formatTime(new Date());
        this.elements.notificationPanel.style.display = 'flex';
        
        setTimeout(() => {
            this.elements.notificationPanel.style.display = 'none';
        }, 5000);
    }

    addChatMessage(role, content) {
        this.messages.push({
            role,
            content,
            timestamp: new Date().toISOString()
        });
        
        if (this.messages.length > 50) {
            this.messages.shift();
        }
        
        this.saveHistory();
        this.renderChatMessages();
    }

    renderChatMessages() {
        if (this.messages.length === 0) {
            this.elements.chatMessages.innerHTML = '<div class="chat-empty"><span>暂无对话记录</span></div>';
            return;
        }
        
        this.elements.chatMessages.innerHTML = this.messages.map(msg => `
            <div class="chat-message ${msg.role}">
                <div class="message-bubble">
                    <div class="message-role">${msg.role === 'user' ? '👧 天天' : '🤖 灵伴'}</div>
                    <div class="message-text">${this.escapeHtml(msg.content)}</div>
                </div>
            </div>
        `).join('');
        
        this.elements.chatMessages.scrollTop = this.elements.chatMessages.scrollHeight;
    }

    addToStatusHistory(sender, icon, action) {
        const record = {
            timestamp: new Date().toISOString(),
            sender,
            icon,
            action
        };
        
        this.history.unshift(record);
        
        if (this.history.length > 100) {
            this.history.pop();
        }
        
        this.saveHistory();
        this.renderHistory();
    }

    renderHistory() {
        const iconMap = {
            'wave': '👋',
            'talk': '💬',
            'happy': '😊',
            'sad': '😢',
            'recognize': '🔍',
            'nurse': '🏥'
        };
        
        this.elements.historyList.innerHTML = this.history.map(item => `
            <div class="history-item">
                <span class="history-time">${this.formatTime(new Date(item.timestamp))}</span>
                <span class="history-icon">${iconMap[item.icon] || '📝'}</span>
                <span class="history-content">${this.escapeHtml(item.action)}</span>
            </div>
        `).join('');
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    formatTime(date) {
        return date.toLocaleTimeString('zh-CN', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    }

    refreshCameraFeed() {
        const cameraUrl = this.elements.cameraUrl.value;
        if (!cameraUrl) return;

        const img = this.elements.cameraFeed;
        const timestamp = Date.now();
        const separator = cameraUrl.includes('?') ? '&' : '?';
        img.src = cameraUrl + separator + '_t=' + timestamp;
        
        img.onload = () => {
            img.classList.add('active');
            this.elements.cameraPlaceholder.style.display = 'none';
        };
        
        img.onerror = () => {
            img.classList.remove('active');
            this.elements.cameraPlaceholder.style.display = 'flex';
        };
    }

    startCameraRefresh() {
        setInterval(() => {
            if (this.elements.autoRefresh.checked) {
                this.refreshCameraFeed();
            }
        }, (parseInt(this.elements.refreshInterval.value) || 2) * 1000);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.app = new LingbanFrontend();
});