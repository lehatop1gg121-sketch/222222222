// Инициализация рабочего пространства для страницы task.html
document.addEventListener('DOMContentLoaded', () => {
    // Проверяем, что мы на странице задания
    const monacoContainer = document.getElementById('monaco-container');
    if (monacoContainer) {
        initSplitLayout();
        initEditor();
        // Пересчитываем размеры Monaco после того, как CSS и Split.js применились
        setTimeout(() => {
            if (window.editor) {
                window.editor.layout();
                window.editor.focus();
            }
        }, 500);
    }
});

function initSplitLayout() {
    window.mainSplit = Split(['#left-column', '#right-column'], {
        sizes: [40, 60],
        minSize: [200, 300],
        gutterSize: 6,
        onDrag: function() {
            if (window.editor) window.editor.layout();
        }
    });

    window.leftSplit = Split(['#theory-panel', '#task-panel'], {
        direction: 'vertical',
        sizes: [60, 40],
        minSize: [100, 100],
        gutterSize: 6
    });
}

window.closePanel = function(panelId) {
    const el = document.getElementById(panelId);
    if (!el) return;
    el.style.display = 'none';

    if (panelId === 'theory-panel' || panelId === 'task-panel') {
        const gutters = document.querySelector('#left-column').querySelectorAll('.gutter');
        gutters.forEach(g => g.style.display = 'none');
    }
    if (window.editor) setTimeout(() => window.editor.layout(), 10);
};

window.restorePanel = function(panelId) {
    const el = document.getElementById(panelId);
    if (!el) return;
    el.style.display = 'flex';

    if (panelId === 'theory-panel' || panelId === 'task-panel') {
        const t = document.getElementById('theory-panel');
        const task = document.getElementById('task-panel');
        if (t.style.display !== 'none' && task.style.display !== 'none') {
            const gutters = document.querySelector('#left-column').querySelectorAll('.gutter');
            gutters.forEach(g => g.style.display = '');
            window.leftSplit.setSizes([60, 40]);
        }
    }
    if (window.editor) setTimeout(() => window.editor.layout(), 10);
};

// Переключение справочника
function toggleReference() {
    const panel = document.getElementById('reference-panel');
    panel.classList.toggle('open');
    if (panel.classList.contains('open')) {
        loadReferenceContent();
    }
}

function loadReferenceContent() {
    const refContent = document.getElementById('ref-content');
    refContent.innerHTML = `
        <div class="ref-section">
            <h4>Основные типы</h4>
            <pre><code>int x = 10;
double d = 5.5;
boolean b = true;
String s = "Hello";</code></pre>
        </div>
        
        <div class="ref-section">
            <h4>Вывод в консоль</h4>
            <pre><code>System.out.println("Текст");
System.out.print("Без переноса");</code></pre>
        </div>

        <div class="ref-section">
            <h4>Ветвление</h4>
            <pre><code>if (x > 0) {
  // код
} else if (x < 0) {
  // код
} else {
  // код
}</code></pre>
        </div>

        <div class="ref-section">
            <h4>Циклы</h4>
            <pre><code>// For
for (int i=0; i < 5; i++) { ... }

// While
while (условие) { ... }</code></pre>
        </div>

        <div class="ref-section">
            <h4>Массивы</h4>
            <pre><code>int[] arr = {1, 2, 3};
int val = arr[0]; // 1
int len = arr.length;</code></pre>
        </div>

        <div class="ref-section">
            <h4>Методы</h4>
            <pre><code>public static int sum(int a, int b) {
    return a + b;
}</code></pre>
        </div>
        
        <div class="ref-section">
            <h4>ООП</h4>
            <pre><code>class Home {
    int windows;
    Home(int w) { this.windows = w; }
}</code></pre>
        </div>
    `;
}

// Слушатель для изменения размера окна (Monaco адаптивность)
window.addEventListener('resize', () => {
    if (window.editor) {
        window.editor.layout();
    }
});

function updateCompilerStatus() {
    const statusEl = document.getElementById('compiler-status');
    if (statusEl) {
        statusEl.innerText = 'Online Compiler';
        statusEl.className = 'status-badge-mini online';
    }
}

// Вызываем обновление статуса при загрузке
document.addEventListener('DOMContentLoaded', updateCompilerStatus);
