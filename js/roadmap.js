let currentTopics = [];
let currentTopic = null;
let currentTaskIndex = 0;

async function loadRoadmap(isIndexPage = true, specificId = null) {
    try {
        const response = await fetch('data/roadmap.json');
        if (!response.ok) throw new Error("Данные не загружены");
        const data = await response.json();
        currentTopics = data.topics;
        
        if (isIndexPage) {
            renderTopicsGrid();
        } else if (specificId) {
            loadTopic(specificId);
        }
    } catch (e) {
        console.error(e);
    }
}

function renderTopicsGrid() {
    const grid = document.getElementById('topics-grid');
    if (!grid) return;
    grid.innerHTML = '';
    
    currentTopics.forEach(topic => {
        const isCompleted = isTopicFullyCompleted(topic.id);
        const card = document.createElement('div');
        card.className = `topic-card ${isCompleted ? 'completed' : ''} ${topic.type || 'lesson'}`;
        
        let typeLabel = "Урок";
        if (topic.type === 'independent') typeLabel = "СР";
        if (topic.type === 'control') typeLabel = "КР";

        card.innerHTML = `
            <div class="status-badge">${isCompleted ? 'Завершено ✓' : typeLabel}</div>
            <h3>${topic.title}</h3>
            <p>${topic.content ? topic.content.substring(0, 60) + '...' : 'Проверка знаний'}</p>
        `;
        card.onclick = () => window.location.href = `task.html?id=${topic.id}`;
        grid.appendChild(card);
    });
}

function loadTopic(id) {
    currentTopic = currentTopics.find(t => t.id === id);
    if (!currentTopic) {
        window.location.href = 'index.html';
        return;
    }

    currentTaskIndex = 0;
    renderTaskSelector(); // Динамическое создание точек
    renderTask();
}

function renderTaskSelector() {
    const selector = document.querySelector('.task-selector');
    if (!selector) return;

    selector.innerHTML = '';
    currentTopic.tasks.forEach((task, index) => {
        const dot = document.createElement('button');
        dot.className = 'task-dot';
        dot.innerText = index + 1;
        dot.onclick = () => {
            currentTaskIndex = index;
            renderTask();
        };
        selector.appendChild(dot);
    });
}

function renderTask() {
    const task = currentTopic.tasks[currentTaskIndex];
    if (!task) return;

    const titleEl   = document.getElementById('task-title');
    const descEl    = document.getElementById('task-description');
    const theoryEl  = document.getElementById('theory-content');
    const feedbackEl = document.getElementById('task-feedback');
    
    const isExam = currentTopic.type === 'independent' || currentTopic.type === 'control';
    
    // Теория → зелёная панель
    if (theoryEl) {
        theoryEl.innerHTML = isExam
            ? (currentTopic.content || '<p>Здесь нет теории. Удачи на самостоятельной работе!</p>')
            : (currentTopic.content || '');
    }
    
    // Задание → красная панель
    if (titleEl)    titleEl.innerText   = `${currentTopic.title} - Задание ${currentTaskIndex + 1}`;
    if (descEl)     descEl.innerHTML    = `<p style="font-size: 1.05rem; line-height: 1.6;">${task.desc}</p>`;
    if (feedbackEl) feedbackEl.innerHTML = '';

    updateTaskDots();

    // Сбросить редактор для нового задания
    if (typeof window.resetEditorToDefault === 'function') {
        window.resetEditorToDefault();
    }
}

function updateTaskDots() {
    const dots = document.querySelectorAll('.task-dot');
    const completedTasks = getCompletedTasks(currentTopic.id);
    
    dots.forEach((dot, index) => {
        dot.classList.toggle('active', index === currentTaskIndex);
        dot.classList.toggle('completed', completedTasks.includes(index));
    });
}

function getCompletedTasks(topicId) {
    const all = JSON.parse(localStorage.getItem('incode_progress') || '{}');
    return all[topicId] || [];
}

function isTopicFullyCompleted(topicId) {
    const topic = currentTopics.find(t => t.id === topicId);
    if (!topic) return false;
    const completed = getCompletedTasks(topicId);
    return (topic.tasks && completed.length >= topic.tasks.length);
}

// Умная проверка решения через SmartChecker
window.verifySolution = async function() {
    if (!currentTopic || !currentTopic.tasks[currentTaskIndex]) return;

    const task = currentTopic.tasks[currentTaskIndex];
    const feedback = document.getElementById('task-feedback');
    const checkBtn = document.getElementById('check-btn');

    // Показываем индикатор загрузки
    if (checkBtn) {
        checkBtn.disabled = true;
        checkBtn.innerText = '⏳ Проверяем...';
    }
    feedback.innerText = '';
    feedback.style.color = '';

    // Собираем код со всех файлов
    const filesObj = window.files || { 'Main.java': window.editor ? window.editor.getValue() : '' };

    try {
        const result = await window.SmartChecker.check(task, filesObj);

        if (result.success) {
            feedback.innerHTML = `<span style="color:var(--success)">${result.message}</span>`
                + (result.detail ? `<br><small style="color:var(--text-secondary);font-size:0.8rem">${result.detail}</small>` : '');

            markTaskCompleted(currentTopic.id, currentTaskIndex);
            updateTaskDots();

            if (currentTaskIndex < currentTopic.tasks.length - 1) {
                setTimeout(() => {
                    if (confirm('Отлично! Перейти к следующему заданию?')) {
                        currentTaskIndex++;
                        renderTask();
                    }
                }, 800);
            } else {
                setTimeout(() => {
                    feedback.innerHTML += '<br><span style="color:var(--accent)">🏆 Все задания темы выполнены!</span>';
                }, 500);
            }
        } else {
            feedback.innerHTML = `<span style="color:#ff4d4d">${result.message}</span>`
                + (result.detail ? `<br><small style="color:var(--text-secondary);font-size:0.8rem;white-space:pre-wrap">${result.detail}</small>` : '');
        }
    } catch (e) {
        feedback.innerHTML = '<span style="color:#ff4d4d">✗ Произошла внутренняя ошибка. Попробуйте ещё раз.</span>';
        console.error('verifySolution error:', e);
    } finally {
        // Возвращаем кнопку
        if (checkBtn) {
            checkBtn.disabled = false;
            checkBtn.innerText = 'Проверить решение';
        }
    }
};

function markTaskCompleted(topicId, taskIndex) {
    const all = JSON.parse(localStorage.getItem('incode_progress') || '{}');
    if (!all[topicId]) all[topicId] = [];
    if (!all[topicId].includes(taskIndex)) {
        all[topicId].push(taskIndex);
        localStorage.setItem('incode_progress', JSON.stringify(all));
    }
}
