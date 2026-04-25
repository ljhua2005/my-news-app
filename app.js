document.addEventListener('DOMContentLoaded', () => {
    // 根據時間自動切換主題
    function applyTheme() {
        const hour = new Date().getHours();
        const body = document.body;

        // 清除舊主題
        body.classList.remove('theme-morning', 'theme-sunset', 'theme-night');

        if (hour >= 6 && hour < 17) {
            body.classList.add('theme-morning');
        } else if (hour >= 17 && hour < 19) {
            body.classList.add('theme-sunset');
        } else {
            body.classList.add('theme-night');
        }
    }

    applyTheme();

    const stockList = document.getElementById('stock-list');
    const stockLoading = document.getElementById('stock-loading');

    async function fetchStocks() {
        stockLoading.classList.remove('hidden');
        try {
            const response = await fetch('/api/stocks');
            const data = await response.json();
            if (data.stocks) {
                renderStocks(data.stocks);
            }
        } catch (err) {
            console.error('Failed to fetch stocks:', err);
        } finally {
            stockLoading.classList.add('hidden');
        }
    }

    function renderStocks(stocks) {
        stockList.innerHTML = '';
        stocks.forEach(stock => {
            const div = document.createElement('div');
            div.className = 'stock-item';
            const arrow = stock.isPositive ? '↑' : '↓';
            const changeClass = stock.isPositive ? 'positive' : 'negative';
            
            div.innerHTML = `
                <div class="stock-info">
                    <span class="stock-name">${stock.name}</span>
                    <span class="stock-price">${stock.price} USD</span>
                </div>
                <div class="stock-change ${changeClass}">
                    ${arrow} ${stock.change.replace('+', '').replace('-', '')}
                </div>
            `;
            stockList.appendChild(div);
        });
    }

    // Initial fetch
    fetchStocks();
    // Refresh stocks every 1 minute
    setInterval(fetchStocks, 60000);

    const searchForm = document.getElementById('search-form');
    const searchInput = document.getElementById('search-input');
    const newsContainer = document.getElementById('news-container');
    const topicTags = document.querySelectorAll('.topic-tag');
    const loadingSpinner = document.getElementById('loading-spinner');
    const currentTopicTitle = document.getElementById('current-topic-title');
    const errorMessage = document.getElementById('error-message');

    // Default search if URL has a query parameter
    const urlParams = new URLSearchParams(window.location.search);
    const initialTopic = urlParams.get('q');
    if (initialTopic) {
        searchInput.value = initialTopic;
        fetchNews(initialTopic);
    }

    searchForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const topic = searchInput.value.trim();
        if (topic) {
            updateURL(topic);
            fetchNews(topic);
        }
    });

    topicTags.forEach(tag => {
        tag.addEventListener('click', () => {
            const topic = tag.dataset.topic;
            searchInput.value = topic;
            updateURL(topic);
            fetchNews(topic);
        });
    });

    function updateURL(topic) {
        const newUrl = new URL(window.location);
        newUrl.searchParams.set('q', topic);
        window.history.pushState({}, '', newUrl);
    }

    // Format the date strings like "Fri, 18 Apr 2026 08:52:00 GMT" to local formats
    function formatDate(dateString) {
        const date = new Date(dateString);
        // If Invalid Date
        if (isNaN(date.getTime())) return dateString;

        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffMins < 60) return `${Math.max(1, diffMins)} 分鐘前`;
        if (diffHours < 24) return `${diffHours} 小時前`;
        if (diffDays < 7) return `${diffDays} 天前`;

        return date.toLocaleDateString('zh-TW', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }

    function renderSkeletons() {
        newsContainer.innerHTML = '';
        for (let i = 0; i < 6; i++) {
            const temp = document.createElement('div');
            temp.className = 'skeleton';
            temp.innerHTML = `
                <div class="skeleton-line skeleton-source"></div>
                <div class="skeleton-line skeleton-title"></div>
                <div class="skeleton-line skeleton-title-2"></div>
                <div class="skeleton-line skeleton-date"></div>
            `;
            newsContainer.appendChild(temp);
        }
    }

    async function fetchNews(topic) {
        currentTopicTitle.textContent = `「${topic}」的最新消息`;
        errorMessage.classList.add('hidden');
        loadingSpinner.classList.remove('hidden');

        renderSkeletons();

        try {
            const response = await fetch(`/api/news?topic=${encodeURIComponent(topic)}`);
            if (!response.ok) {
                throw new Error('無法獲取新聞，請稍後再試。');
            }

            const data = await response.json();

            if (data.error) {
                throw new Error(data.error);
            }

            displayNews(data.news);
        } catch (error) {
            console.error('Error fetching news:', error);
            showError(error.message);
            newsContainer.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">⚠️</div>
                    <p>獲取新聞時發生錯誤。這可能是因為暫時的網路問題。</p>
                </div>
            `;
        } finally {
            loadingSpinner.classList.add('hidden');
        }
    }

    function showError(msg) {
        errorMessage.textContent = msg;
        errorMessage.classList.remove('hidden');
    }

    function displayNews(newsList) {
        newsContainer.innerHTML = '';

        if (!newsList || newsList.length === 0) {
            newsContainer.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📭</div>
                    <p>找不到相關新聞，請嘗試其他關鍵字。</p>
                </div>
            `;
            return;
        }

        newsList.forEach((news, index) => {
            // Clean up title (Google News appends " - Publisher Name" usually, so let's try to remove it if source is provided)
            let cleanTitle = news.title;
            if (news.source && cleanTitle.endsWith(news.source)) {
                cleanTitle = cleanTitle.substring(0, cleanTitle.lastIndexOf(' - '));
            }

            const delay = index * 0.1; // staggered animation delay

            const card = document.createElement('a');
            card.href = news.link;
            card.target = '_blank';
            card.rel = 'noopener noreferrer';
            card.className = 'news-card';
            card.style.animationDelay = `${delay}s`;

            card.innerHTML = `
                <div class="news-source-meta">
                    <span class="news-source">${news.source || '新聞來源'}</span>
                </div>
                <h3 class="news-title">${cleanTitle}</h3>
                <div class="news-footer">
                    <span>🕒 ${formatDate(news.pubDate)}</span>
                    <span class="read-more">閱讀全文 <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"></path><path d="M12 5l7 7-7 7"></path></svg></span>
                </div>
            `;

            newsContainer.appendChild(card);
        });
    }
});
