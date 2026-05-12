/**
 * Компилятор Java с Оффлайн-режимом
 */

async function runJavaCodeFiles(filesObj) {
    const outputTerminal = document.getElementById('captured-output');
    const statusEl = document.getElementById('compiler-status');
    const feedbackEl = document.getElementById('task-feedback');
    
    outputTerminal.innerText = "Подготовка...";
    outputTerminal.style.color = "#ccc";
    if(feedbackEl) feedbackEl.innerText = "";
    if(statusEl) statusEl.innerText = "Компиляция...";
    outputTerminal.innerText = "Запуск программы на сервере...";

    const pistonFiles = Object.keys(filesObj).map(fileName => ({
        name: fileName,
        content: filesObj[fileName]
    }));

    // Склеенный код для оффлайн проверки
    const fullCode = pistonFiles.map(f => f.content).join('\n');

    try {
        let javaVersion = "15.0.2";
        try {
            const runtimesRes = await fetch("https://emkc.org/api/v2/piston/runtimes");
            if (runtimesRes.ok) {
                const runtimes = await runtimesRes.json();
                const javaRuntime = runtimes.find(r => r.language === 'java');
                if (javaRuntime) javaVersion = javaRuntime.version;
            }
        } catch (e) {
            console.warn("Не удалось получить версии Piston, используем версию по умолчанию.");
        }

        const response = await fetch("https://emkc.org/api/v2/piston/execute", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                language: "java",
                version: javaVersion,
                files: pistonFiles
            })
        });

        if (response.status === 429) {
            throw new Error("Сервер перегружен. Пожалуйста, подождите несколько секунд и попробуйте снова.");
        }
        if (!response.ok) {
            throw new Error(`Ошибка сервиса компиляции (Код: ${response.status})`);
        }

        const data = await response.json();
        
        let outputText = "";
        let isError = false;

        if (data.compile && data.compile.code !== 0) {
            isError = true;
            outputText = data.compile.output || data.compile.stderr;
        } else if (data.run) {
            if (data.run.code !== 0 && data.run.stderr) {
                isError = true;
                outputText = data.run.output || data.run.stderr;
            } else {
                outputText = data.run.output;
            }
        }

        if (!outputText) {
            outputText = "Программа выполнена, но ничего не вывела в консоль.";
        }

        outputTerminal.innerText = outputText;
        outputTerminal.style.color = isError ? "#ff5555" : "var(--accent)";
        outputTerminal.removeAttribute('data-mode'); // Онлайн профиль

        statusEl.innerText = isError ? "Ошибка выполнения" : "Успешно";

        // Автоматическая проверка через roadmap.js
        if (typeof verifySolution === 'function') {
            setTimeout(verifySolution, 100);
        }

    } catch (error) {
        console.error("Compilation Error:", error);
        
        // В случае ошибки (например, нет интернета) предлагаем оффлайн режим
        outputTerminal.innerText = "Не удалось подключиться к онлайн-компилятору.\n" + error.message + "\n\nПереключаемся на оффлайн проверку...";
        outputTerminal.style.color = "#ffaa00";
        
        setTimeout(() => {
            runOfflineValidation(fullCode);
        }, 1500);
    }
}

// Fallback функция на случай если где-то вызывается старый метод
async function runJavaCode(code) {
    return runJavaCodeFiles({'Main.java': code});
}

/**
 * Оффлайн проверка
 */
function runOfflineValidation(code) {
    const outputTerminal = document.getElementById('captured-output');
    
    // Получаем текущие требования задачи
    let requirements = [];
    if (window.currentTopic && window.currentTopic.tasks[window.currentTaskIndex]) {
        requirements = window.currentTopic.tasks[window.currentTaskIndex].codeContains || [];
    }

    const validation = window.OfflineValidator.validate(code, requirements);
    
    if (validation.success) {
        outputTerminal.innerText = "Синтаксическая проверка (Offline) пройдена!\n" + 
                                  "Не удалось получить вывод от онлайн-сервера для полноценной проверки (stdout).";
        outputTerminal.style.color = "#00e676";
        outputTerminal.setAttribute('data-mode', 'offline');
    } else {
        outputTerminal.innerText = validation.error || validation.feedback;
        outputTerminal.style.color = "#ff5555";
        outputTerminal.setAttribute('data-mode', 'offline');
    }

    // Запускаем проверку (в оффлайн режиме она проверит только код)
    if (typeof verifySolution === 'function') {
        setTimeout(verifySolution, 100);
    }
}
