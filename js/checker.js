/**
 * checker.js — Умная проверка решений
 *
 * Запрос к компилятору идёт через Netlify Function (/api/compile),
 * которая проксирует Piston API со стороны сервера — без блокировок ISP.
 *
 * Порядок проверки:
 * 1. Компиляция и запуск кода (через /compile функцию → Piston)
 * 2. Если ошибка компиляции → ПРОВАЛ
 * 3. Сравнение вывода программы с expected
 * 4. Проверка codeContains (ключевые слова в комментариях/строках не считаются)
 */

window.SmartChecker = {

    // ── Вспомогательные методы ──────────────────────────────────────────

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

    // ── Запуск кода ─────────────────────────────────────────────────────

    /**
     * Отправляет файлы на компиляцию через Netlify Function.
     * Функция делает запрос к Piston со стороны сервера — без ISP-блокировок.
     */
    async runCode(pistonFiles) {
        const controller = new AbortController();
        const timeoutId  = setTimeout(() => controller.abort(), 20000);

        let response;
        try {
            response = await fetch('/.netlify/functions/compile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: controller.signal,
                body: JSON.stringify({ files: pistonFiles })
            });
        } finally {
            clearTimeout(timeoutId);
        }

        if (response.status === 429) {
            throw new Error('RATE_LIMIT');
        }
        if (!response.ok) {
            const errBody = await response.json().catch(() => ({}));
            throw new Error(errBody.error || `HTTP_${response.status}`);
        }

        const data = await response.json();

        if (data.compile && data.compile.code !== 0) {
            return { compileError: true, output: (data.compile.output || data.compile.stderr || '').trim() };
        }
        if (data.run) {
            const out = (data.run.output || '').trim();
            if (data.run.code !== 0 && data.run.stderr) {
                return { runtimeError: true, output: (data.run.output || data.run.stderr || '').trim() };
            }
            return { output: out };
        }
        return { output: '' };
    },

    // ── Главная функция ──────────────────────────────────────────────────

    async check(task, filesObj) {
        const result  = { success: false, message: '', detail: '' };
        const allCode = Object.values(filesObj).join('\n');

        const pistonFiles = Object.keys(filesObj).map(name => ({
            name,
            content: filesObj[name]
        }));

        // ── Компиляция и запуск ────────────────────────────────────────
        let runResult;
        try {
            runResult = await this.runCode(pistonFiles);
        } catch (err) {
            console.error('[SmartChecker] Compile error:', err.name, err.message);

            if (err.name === 'AbortError') {
                result.message = '⚠️ Сервер компилятора не ответил вовремя';
                result.detail  = 'Попробуйте ещё раз. Если проблема повторяется — сервер временно перегружен.';
            } else if (err.message === 'RATE_LIMIT') {
                result.message = '⚠️ Сервер компилятора перегружен';
                result.detail  = 'Подождите 10–15 секунд и попробуйте снова.';
            } else {
                result.message = '⚠️ Не удалось запустить код';
                result.detail  = `Ошибка: ${err.message}\n\nПопробуйте ещё раз или обратитесь к администратору.`;
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

        // ── Ошибка выполнения ──────────────────────────────────────────
        if (runResult.runtimeError) {
            result.message = '✗ Ошибка во время выполнения программы';
            result.detail  = runResult.output
                .split('\n').filter(l => l.trim()).slice(0, 5).join('\n');
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
