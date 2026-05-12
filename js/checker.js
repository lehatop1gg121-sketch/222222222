/**
 * checker.js — Проверка решений через встроенный Java-транспилятор
 * Работает полностью в браузере, без внешних API.
 */
window.SmartChecker = {

    // ── Убирает комментарии и строки ────────────────────────────────────
    stripCommentsAndStrings(code) {
        let r = '', i = 0, n = code.length;
        while (i < n) {
            if (code[i]==='/' && code[i+1]==='/') { while(i<n && code[i]!=='\n') i++; r+=' '; continue; }
            if (code[i]==='/' && code[i+1]==='*') { i+=2; while(i<n && !(code[i]==='*'&&code[i+1]==='/')) i++; i+=2; r+=' '; continue; }
            if (code[i]==='"') { i++; while(i<n && !(code[i]==='"'&&code[i-1]!=='\\')) i++; i++; r+='""'; continue; }
            if (code[i]==="'") { i++; while(i<n && !(code[i]==="'"&&code[i-1]!=='\\')) i++; i++; r+="''"; continue; }
            r+=code[i]; i++;
        }
        return r;
    },

    containsPattern(rawCode, pattern) {
        const clean = this.stripCommentsAndStrings(rawCode);
        try   { return new RegExp(pattern, 'i').test(clean); }
        catch { return clean.includes(pattern.replace(/\\\\/g,'\\').replace(/\\/g,'')); }
    },

    normalizeOutput(s) { return s.replace(/\r\n/g,'\n').replace(/\r/g,'\n').trim(); },

    outputMatches(actual, expected) {
        const a = this.normalizeOutput(actual);
        const e = this.normalizeOutput(expected);
        return a===e || a.toLowerCase().includes(e.toLowerCase()) || a.replace(/\s+/g,'')===e.replace(/\s+/g,'');
    },

    // ── Главная функция ──────────────────────────────────────────────────
    async check(task, filesObj) {
        const result  = { success: false, message: '', detail: '' };
        const allCode = Object.values(filesObj).join('\n');

        // Запускаем через встроенный транспилятор
        const runResult = window.JavaRunner.run(allCode);

        // Ошибка компиляции / выполнения
        if (!runResult.success) {
            result.message = '✗ Ошибка в коде';
            result.detail  = runResult.output;
            return result;
        }

        // Проверка вывода
        if (!this.outputMatches(runResult.output, task.expected)) {
            result.message = '✗ Программа выполнилась, но вывод неверный';
            result.detail  = `Ожидалось: "${task.expected}"\nПолучено:  "${runResult.output || '(пустой вывод)'}"`;
            return result;
        }

        // Проверка codeContains (не в комментариях/строках)
        if (task.codeContains && task.codeContains.length > 0) {
            for (const pattern of task.codeContains) {
                if (!this.containsPattern(allCode, pattern)) {
                    const human = pattern.replace(/\\\\/g,'').replace(/\\/g,'').trim();
                    result.message = '✗ Вывод верный, но нужная конструкция не используется';
                    result.detail  = `Необходимо использовать: <code>${human}</code>`;
                    return result;
                }
            }
        }

        result.success = true;
        result.message = '✓ Решение принято! Отличная работа!';
        result.detail  = runResult.output ? `Вывод: "${runResult.output}"` : '';
        return result;
    }
};
