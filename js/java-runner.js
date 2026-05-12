/**
 * java-runner.js — Запуск Java-кода в браузере
 * Транспилирует Java → JavaScript и выполняет в песочнице.
 * Покрывает все конструкции базового курса Java.
 */
window.JavaRunner = {

    run(javaCode) {
        const output = [];
        try {
            const js = this.transpile(javaCode);
            this.execute(js, output);
            return { success: true, output: output.join('\n') };
        } catch (e) {
            return { success: false, output: e.message, compileError: true };
        }
    },

    // ─── Транспиляция ────────────────────────────────────────────────────

    transpile(src) {
        let js = src;

        // 1. Убираем package/import
        js = js.replace(/^\s*package\s+[\w.]+\s*;/mg, '');
        js = js.replace(/^\s*import\s+[\w.*]+\s*;/mg, '');

        // 2. System.out.println/print
        js = js.replace(/System\.out\.println\s*\(/g, '__println(');
        js = js.replace(/System\.out\.print\s*\(/g,   '__print(');

        // 3. Java API → JS
        js = js.replace(/Integer\.parseInt\s*\(/g,    'parseInt(');
        js = js.replace(/Double\.parseDouble\s*\(/g,  'parseFloat(');
        js = js.replace(/Float\.parseFloat\s*\(/g,    'parseFloat(');
        js = js.replace(/String\.valueOf\s*\(/g,       'String(');
        js = js.replace(/Integer\.toString\s*\(/g,     'String(');
        js = js.replace(/Math\.pow\s*\(/g,             'Math.pow(');
        js = js.replace(/\.length\s*\(\s*\)/g,         '.length');
        js = js.replace(/\.contains\s*\(/g,            '.includes(');
        js = js.replace(/\.equals\s*\(\s*([^)]+)\s*\)/g, ' === $1');
        js = js.replace(/\.charAt\s*\(/g,              '.charAt(');
        js = js.replace(/e\.getMessage\s*\(\s*\)/g,    'e.message');
        js = js.replace(/e\.getMessage\s*\(\s*\)/g,    'e.message');

        // 4. Исключения: throw new XxxException("msg") → throw new Error("msg")
        js = js.replace(/throw\s+new\s+\w*Exception\s*\(([^)]*)\)/g, 'throw new Error($1)');
        js = js.replace(/throw\s+new\s+Exception\s*\(([^)]*)\)/g,    'throw new Error($1)');
        js = js.replace(/throws\s+[\w,\s]+(?=\s*\{)/g, '');

        // 5. Объявления переменных: тип → let/const
        js = js.replace(/\bfinal\s+(int|double|float|long|char|boolean|String)\s+(\w+)\s*=/g, 'const $2 =');
        js = js.replace(/\b(int|double|float|long|short|byte|char|boolean)\[\]\s+(\w+)\s*=/g, 'let $2 =');
        js = js.replace(/\bString\[\]\s+(\w+)\s*=/g,   'let $1 =');
        js = js.replace(/\b(int|double|float|long|short|byte|char|boolean)\s+(\w+)\s*=/g, 'let $2 =');
        js = js.replace(/\bString\s+(\w+)\s*=/g,       'let $1 =');
        js = js.replace(/\bvar\s+(\w+)\s*=/g,          'let $1 =');

        // 6. new int[N] / new String[N] → Array
        js = js.replace(/new\s+int\s*\[(\w+)\]/g,     'new Array($1).fill(0)');
        js = js.replace(/new\s+double\s*\[(\w+)\]/g,  'new Array($1).fill(0)');
        js = js.replace(/new\s+String\s*\[(\w+)\]/g,  'new Array($1).fill("")');
        js = js.replace(/new\s+boolean\s*\[(\w+)\]/g, 'new Array($1).fill(false)');

        // 7. Классы: public class X → class X
        js = js.replace(/\bpublic\s+abstract\s+class\s+/g, 'class ');
        js = js.replace(/\bpublic\s+class\s+/g,            'class ');
        js = js.replace(/\bprivate\s+class\s+/g,           'class ');

        // 8. Интерфейсы → class (заглушка)
        js = js.replace(/\binterface\s+(\w+)\s*\{[^}]*\}/g, 'class $1 {}');
        js = js.replace(/\bimplements\s+\w+/g, '');

        // 9. abstract → убираем слово
        js = js.replace(/\babstract\s+/g, '');

        // 10. Модификаторы доступа в полях/методах внутри классов → убрать
        js = js.replace(/\b(public|private|protected)\s+static\s+/g, 'static ');
        js = js.replace(/\b(public|private|protected)\s+/g, '');

        // 11. Сигнатуры методов: static тип name(params) → убрать тип
        js = js.replace(/\bstatic\s+(void|int|double|float|long|boolean|String|char|[\w\[\]]+)\s+(\w+)\s*\(([^)]*)\)\s*\{/g,
            (_, _type, name, params) => `static ${name}(${this._params(params)}) {`);

        // Обычные методы: тип name(params) { → name(params) {
        js = js.replace(/\b(?!if|for|while|switch|catch)\b(void|int|double|float|long|boolean|String|char|[\w\[\]]+)\s+([a-z]\w*)\s*\(([^)]*)\)\s*\{/g,
            (match, type, name, params) => {
                if (['if','for','while','switch','catch','return','new'].includes(name)) return match;
                // не трогаем static/class — они не являются возвращаемыми типами
                if (['static','class','else','try','finally','new'].includes(type)) return match;
                return `${name}(${this._params(params)}) {`;
            });

        // 12. Методы main: static main(String[] args) → static main(args)
        js = js.replace(/static\s+main\s*\(\s*String\s*\[\s*\]\s*\w*\s*\)/g, 'static main(args)');

        // 13. @Override → убрать
        js = js.replace(/@\w+/g, '');

        // 14. Поля класса с типом: int speed; String model; → убрать тип
        js = js.replace(/^\s*(int|double|float|long|short|byte|char|boolean|String)\s+(\w+)\s*;/mg, '');

        // 15. Вызов статических методов: ClassName.method() — оставляем как есть

        return js;
    },

    /** Убирает типы из списка параметров */
    _params(params) {
        if (!params.trim()) return '';
        return params.split(',').map(p => {
            const parts = p.trim().split(/\s+/);
            return parts[parts.length - 1];
        }).join(', ');
    },

    // ─── Выполнение ──────────────────────────────────────────────────────

    execute(jsCode, output) {
        let printBuf = null; // для print без newline

        const __println = (v) => {
            const s = (v === undefined || v === null) ? 'null' : String(v);
            if (printBuf !== null) { output.push(printBuf + s); printBuf = null; }
            else output.push(s);
        };
        const __print = (v) => {
            const s = (v === undefined || v === null) ? 'null' : String(v);
            printBuf = (printBuf ?? '') + s;
        };

        // Добавляем защиту от бесконечного цикла (макс. 100 000 итераций)
        const __guard = (() => {
            let cnt = 0;
            return () => { if (++cnt > 100000) throw new Error('Бесконечный цикл (лимит итераций превышен)'); };
        })();

        // Защита от бесконечного цикла: добавляем __guard() в тело каждого цикла
        const safe = jsCode.replace(/\b(for|while)\s*\(([^{]*)\)\s*\{/g, (m) => m + ' __guard();');

        // Находим главный класс и вызываем main
        const fn = new Function(
            '__println', '__print', '__guard',
            'Math', 'parseInt', 'parseFloat', 'String', 'Boolean', 'Number', 'Error',
            '"use strict";\n' + safe + '\n' +
            'if (typeof Main !== "undefined" && typeof Main.main === "function") {\n' +
            '    Main.main([]);\n' +
            '} else {\n' +
            '    throw new Error("\u041a\u043b\u0430\u0441\u0441 Main \u0438\u043b\u0438 \u043c\u0435\u0442\u043e\u0434 main \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d.");\n' +
            '}'
        );
        fn(__println, __print, __guard, Math, parseInt, parseFloat, String, Boolean, Number, Error);

        // Дописываем буфер print без newline
        if (printBuf !== null) output.push(printBuf);
    }
};
