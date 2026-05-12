window.files = {
    'Main.java': 'public class Main {\n    public static void main(String[] args) {\n        // Напишите ваше решение здесь\n        System.out.println("Hello Java!");\n    }\n}'
};
window.activeFile = 'Main.java';

function initEditor() {
    // Ждем загрузки require.js
    if (typeof require === 'undefined') {
        setTimeout(initEditor, 100);
        return;
    }

    require.config({ paths: { 'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.38.0/min/vs' }});

    require(['vs/editor/editor.main'], function() {
        // Создаем тему, похожую на VS Code Dark Modern или Yandex LMS Dark
        monaco.editor.defineTheme('yandex-dark', {
            base: 'vs-dark',
            inherit: true,
            rules: [],
            colors: {
                'editor.background': '#141414',
                'editor.lineHighlightBackground': '#1a1a1a',
                'editorCursor.foreground': '#ff8c00',
                'editorIndentGuide.background': '#222222',
            }
        });

        window.editor = monaco.editor.create(document.getElementById('monaco-container'), {
            value: window.files[window.activeFile],
            language: 'java',
            theme: 'yandex-dark',
            automaticLayout: true,
            padding: { top: 20 },
            minimap: { enabled: false },
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 14,
            fontWeight: '400',
            lineNumbers: 'on',
            roundedSelection: true,
            scrollBeyondLastLine: false,
            readOnly: false,
            cursorStyle: 'line'
        });

        // Сохранение изменений в активный файл
        window.editor.onDidChangeModelContent(() => {
            window.files[window.activeFile] = window.editor.getValue();
        });

        renderFileTabs();

        // Ставим фокус после инициализации, чтобы можно было сразу печатать
        setTimeout(() => {
            if (window.editor) {
                window.editor.layout();
                window.editor.focus();
            }
        }, 200);

        // Клик по контейнеру – ставим фокус (fallback)
        const monacoEl = document.getElementById('monaco-container');
        if (monacoEl) {
            monacoEl.addEventListener('mousedown', () => {
                if (window.editor) window.editor.focus();
            });
        }

        // Реакция на кнопку Run
        const runBtn = document.getElementById('run-btn');
        if (runBtn) {
            runBtn.onclick = () => {
                if (typeof runJavaCodeFiles === 'function') {
                    runJavaCodeFiles(window.files); // Из compiler.js (новая версия)
                } else if (typeof runJavaCode === 'function') {
                    runJavaCode(window.editor.getValue()); // Fallback
                }
            };
        }
    });
}

function renderFileTabs() {
    const tabsContainer = document.getElementById('file-tabs');
    if (!tabsContainer) return;
    tabsContainer.innerHTML = '';

    for (let fileName in window.files) {
        const tab = document.createElement('div');
        tab.className = 'file-tab' + (fileName === window.activeFile ? ' active' : '');
        tab.innerText = fileName;
        tab.onclick = () => switchFile(fileName);

        if (fileName !== 'Main.java') {
            const closeBtn = document.createElement('button');
            closeBtn.className = 'file-tab-close';
            closeBtn.innerText = '✕';
            closeBtn.onclick = (e) => {
                e.stopPropagation();
                closeFile(fileName);
            };
            tab.appendChild(closeBtn);
        }

        tabsContainer.appendChild(tab);
    }
}

function switchFile(fileName) {
    console.log('Attempting to switch to file:', fileName);
    if (!window.files[fileName]) {
        console.warn('File not found in window.files:', fileName);
        return;
    }
    window.activeFile = fileName;
    if (window.editor) {
        window.editor.setValue(window.files[fileName]);
        // Обновляем размеры и рендер, чтобы гарантировать отображение содержимого
        window.editor.layout();
        window.editor.focus(); // даём фокус для ввода
    } else {
        console.warn('Monaco editor not initialized yet.');
    }
    renderFileTabs();
    console.log('Switched to', fileName, 'activeFile is now', window.activeFile);
}

window.createNewFile = function() {
    let fileName = prompt('Введите имя класса (например, Car):', 'NewClass');
    if (!fileName) return;
    
    fileName = fileName.trim();
    if (fileName.endsWith('.java')) {
        fileName = fileName.replace('.java', '');
    }
    
    // Базовая защита от невалидных имен (разрешаем латиницу и кириллицу)
    fileName = fileName.replace(/[^a-zA-Z0-9_\u0400-\u04FF]/g, '');
    if (!fileName) return;

    const fullFileName = fileName + '.java';
    
    if (window.files[fullFileName]) {
        alert('Файл с таким именем уже существует!');
        return;
    }
    
    const template = `public class ${fileName} {\n    \n}`;
    window.files[fullFileName] = template;
    console.log('Created file:', fullFileName, 'Current files:', Object.keys(window.files));
    renderFileTabs();
    setTimeout(() => switchFile(fullFileName), 0);
};

function closeFile(fileName) {
    if (fileName === 'Main.java') return;
    
    // Спрашиваем подтверждение
    if (!confirm(`Удалить файл ${fileName}?`)) return;

    delete window.files[fileName];
    if (window.activeFile === fileName) {
        switchFile('Main.java');
    } else {
        renderFileTabs();
    }
}

// Функция для roadmap.js (сброс при генерации новой задачи)
window.resetEditorToDefault = function(defaultCode) {
    window.files = {
        'Main.java': defaultCode || 'public class Main {\n    public static void main(String[] args) {\n        // Напишите ваше решение здесь\n    }\n}'
    };
    window.activeFile = 'Main.java';
    if (window.editor) {
        window.editor.setValue(window.files['Main.java']);
    }
    renderFileTabs();
};
