/**
 * Оффлайн-валидатор Java для базовой проверки синтаксиса и логики
 * Используется как фоллбэк, если онлайн-компилятор недоступен
 */

const OfflineValidator = {
    validate: function(code, taskRequirements = []) {
        let results = {
            success: true,
            error: null,
            warnings: [],
            feedback: ""
        };

        // 1. Базовые проверки структуры
        if (!code.includes('class ')) {
            results.success = false;
            results.error = "Ошибка: Не найден класс. Код Java должен содержать 'public class Main { ... }'";
            return results;
        }

        if (!code.includes('public static void main')) {
            results.success = false;
            results.error = "Ошибка: Не найден метод main. Добавьте 'public static void main(String[] args) { ... }'";
            return results;
        }

        // 2. Проверка парности скобок
        if ((code.match(/{/g) || []).length !== (code.match(/}/g) || []).length) {
            results.warnings.push("Внимание: Возможно, пропущена фигурная скобка { }.");
        }

        // 3. Проверка требований задачи (codeContains)
        if (taskRequirements && taskRequirements.length > 0) {
            for (let term of taskRequirements) {
                // Очищаем термин от экранирования регулярок
                const cleanTerm = term.replace(/\\/g, '');
                if (!code.toLowerCase().includes(cleanTerm.toLowerCase())) {
                    results.success = false;
                    results.feedback = `В коде не найдено обязательное условие: "${cleanTerm}"`;
                    return results;
                }
            }
        }

        results.feedback = "Базовая синтаксическая проверка пройдена!";
        return results;
    }
};

window.OfflineValidator = OfflineValidator;
