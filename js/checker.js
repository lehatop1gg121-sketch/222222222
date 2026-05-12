/**
 * checker.js — Умная проверка решений через JDoodle API
 *
 * JDoodle вызывается прямо из браузера (поддерживает CORS),
 * не требует бэкенда и не блокируется в России.
 *
 * Порядок проверки:
 * 1. Компиляция и запуск через JDoodle API
 * 2. Ошибка компиляции → ПРОВАЛ
 * 3. Сравнение вывода с expected
 * 4. Проверка codeContains (ключевые слова в комментариях не считаются)
 */

window.SmartChecker = {

    // ── Вспомогательные методы ──────────────────────────────────────────

    /** Убирает комментарии и строковые литералы из кода */
    stripCommentsAndStrings(code) {
        let result = '';
        let i = 0;
        const len = code.length;
        while (i < len) {
            if (code[i] === '/' && code[i + 1] === '/') {
                while (i < len && code[i] !== '\n') i++;
                result += ' '; continue;
            }
            if (code[i] === '/' && code[i + 1] === '*') {
                i += 2;
                while (i < len && !(code[i] === '*' && code[i + 1] === '/')) i++;
                i += 2; result += ' '; continue;
            }
            if (code[i] === '"') {
                i++;
                while (i < len && !(code[i] === '"' && code[i - 1] !== '\\')) i++;
                i++; result += '""'; continue;
            }
            if (code[i] === "'") {
                i++;
                while (i < len && !(code[i] === "'" && code[i - 1] !== '\\')) i++;
                i++; result += "''"; continue;
            }
            result += code[i]; i++;
        }
        return result;
    },

    containsPattern(rawCode, pattern) {
        const clean = this.stripCommentsAndStrings(rawCode);
        try {
            return new RegExp(pattern, 'i').test(clean);
        } catch {
            return clean.includes(pattern.replace(/\\\\/g, '\\').replace(/\\/g, ''));
        }
    },

    normalizeOutput(str) {
        return str.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
    },

    outputMatches(actual, expected) {
        const a = this.normalizeOutput(actual);
        const e = this.normalizeOutput(expected);
        return a === e ||
               a.toLowerCase().includes(e.toLowerCase()) ||
               a.replace(/\s+/g, '') === e.replace(/\s+/g, '');
    },

    // ── Компиляция через JDoodle ─────────────────────────────────────────

    /**
     * Запускает Java-код через JDoodle API.
     * Возвращает { output, compileError, runtimeError } или бросает исключение.
     */
    async runViaJDoodle(script) {
        const cfg = window.AppConfig;

        if (!cfg || !cfg.jdoodleClientId || cfg.jdoodleClientId === 'YOUR_CLIENT_ID') {
            throw new Error('NO_API_KEY');
        }

        const requestBody = {
            script:       script,
            language:     'java',
            versionIndex: '4',
            clientId:     cfg.jdoodleClientId,
            clientSecret: cfg.jdoodleClientSecret
        };

        console.log('[SmartChecker] Отправляем запрос на JDoodle...');
        console.log('[SmartChecker] clientId:', cfg.jdoodleClientId.substring(0, 8) + '...');

        const controller = new AbortController();
        const tid = setTimeout(() => controller.abort(), 20000);

        let response;
        try {
            response = await fetch('https://api.jdoodle.com/v1/execute', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: controller.signal,
                body: JSON.stringify(requestBody)
            });
        } finally {
            clearTimeout(tid);
        }

        console.log('[SmartChecker] JDoodle HTTP статус:', response.status);

        if (!response.ok) {
            const text = await response.text().catch(() => '');
            console.error('[SmartChecker] JDoodle ошибка тела ответа:', text);
            throw new Error(`HTTP_${response.status}`);
        }

        const data = await response.json();
        console.log('[SmartChecker] JDoodle ответ:', JSON.stringify(data));

        if (data.statusCode === 401 || data.error === 'Unauthorized') {
            throw new Error('INVALID_API_KEY');
        }
        if (data.statusCode === 429) {
            throw new Error('RATE_LIMIT');
        }

        const output = (data.output || '').trim();

        const isCompileError = output.includes('error:') ||
                               output.includes('cannot find symbol') ||
                               output.includes('illegal start of expression') ||
                               output.includes(';expected') ||
                               (data.statusCode !== 200 && output.length > 0);

        if (isCompileError) {
            return { compileError: true, output };
        }

        return { output };
    },

    // ── Главная функция ──────────────────────────────────────────────────

    async check(task, filesObj) {
        const result  = { success: false, message: '', detail: '' };
        const allCode = Object.values(filesObj).join('\n');

        // Объединяем все файлы в один скрипт для JDoodle
        // (JDoodle не поддерживает несколько файлов, поэтому склеиваем)
        const combinedScript = Object.values(filesObj).join('\n\n');

        // ── Компиляция и запуск ────────────────────────────────────────
        let runResult;
        try {
            runResult = await this.runViaJDoodle(combinedScript);
        } catch (err) {
            console.error('[SmartChecker] Error:', err.name, err.message);

            if (err.message === 'NO_API_KEY') {
                result.message = '⚙️ Не настроен API-ключ компилятора';
                result.detail  = 'Зарегистрируйтесь на jdoodle.com/compiler-api и добавьте clientId/clientSecret в js/config.js';
            } else if (err.message === 'INVALID_API_KEY') {
                result.message = '⚙️ Неверный API-ключ JDoodle';
                result.detail  = 'Проверьте clientId и clientSecret в файле js/config.js';
            } else if (err.message === 'RATE_LIMIT') {
                result.message = '⚠️ Превышен дневной лимит (200 запросов/день)';
                result.detail  = 'Лимит бесплатного плана JDoodle исчерпан. Попробуйте завтра.';
            } else if (err.name === 'AbortError') {
                result.message = '⚠️ Компилятор не ответил вовремя';
                result.detail  = 'Попробуйте ещё раз.';
            } else {
                result.message = '⚠️ Не удалось запустить код';
                result.detail  = `Ошибка: ${err.message}`;
            }
            return result;
        }

        // ── Ошибка компиляции ──────────────────────────────────────────
        if (runResult.compileError) {
            result.message = '✗ Ошибка компиляции — код не является валидным Java';
            result.detail  = runResult.output
                .split('\n').filter(l => l.trim()).slice(0, 8).join('\n');
            return result;
        }

        // ── Проверка вывода ────────────────────────────────────────────
        if (!this.outputMatches(runResult.output, task.expected)) {
            result.message = '✗ Программа скомпилировалась, но вывод неверный';
            result.detail  = `Ожидалось: "${task.expected}"\nПолучено:  "${runResult.output || '(пустой вывод)'}"`;
            return result;
        }

        // ── Проверка конструкций (не в комментариях/строках) ──────────
        if (task.codeContains && task.codeContains.length > 0) {
            for (const pattern of task.codeContains) {
                if (!this.containsPattern(allCode, pattern)) {
                    const human = pattern.replace(/\\\\/g, '').replace(/\\/g, '').trim();
                    result.message = '✗ Вывод верный, но нужная конструкция не используется';
                    result.detail  = `Необходимо использовать: <code>${human}</code>\nУбедитесь, что элемент языка применён в коде, а не упомянут в комментарии.`;
                    return result;
                }
            }
        }

        // ── Всё прошло ────────────────────────────────────────────────
        result.success = true;
        result.message = '✓ Решение принято! Отличная работа!';
        result.detail  = runResult.output ? `Вывод программы: "${runResult.output}"` : '';
        return result;
    }
};
