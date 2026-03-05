const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = 3000;
const LOGS_DIR = __dirname;
const LOGS_FILE = path.join(LOGS_DIR, 'ip_logs.json');
const LOGS_TEXT_FILE = path.join(LOGS_DIR, 'ip_logs.txt');
const LOGS_CSV_FILE = path.join(LOGS_DIR, 'ip_logs.csv');

// Инициализируем файлы логов
function initLogs() {
    if (!fs.existsSync(LOGS_FILE)) {
        fs.writeFileSync(LOGS_FILE, JSON.stringify([], null, 2));
    }
    if (!fs.existsSync(LOGS_TEXT_FILE)) {
        fs.writeFileSync(LOGS_TEXT_FILE, 'IP LOGGER - История входов\n' + '='.repeat(80) + '\n\n');
    }
    if (!fs.existsSync(LOGS_CSV_FILE)) {
        fs.writeFileSync(LOGS_CSV_FILE, 'Timestamp,IP,ClientPort,ServerPort,UserAgent,Referer,Method,URL,Host\n');
    }
}

// ПРАВИЛЬНОЕ получение IP адреса
function getClientIP(req) {
    // Проверяем x-forwarded-for (если сервер за прокси)
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
        const ips = forwarded.split(',').map(ip => ip.trim());
        let clientIP = ips[0];
        
        // Если это IPv6 localhost, преобразуем в IPv4
        if (clientIP === '::1') {
            return '127.0.0.1';
        }
        
        // Удаляем IPv6 префикс если есть
        if (clientIP.includes('::ffff:')) {
            return clientIP.replace('::ffff:', '');
        }
        
        return clientIP;
    }
    
    // Получаем IP из socket
    let ip = req.socket.remoteAddress || req.connection.remoteAddress || 'unknown';
    
    // Преобразуем IPv6 localhost в IPv4
    if (ip === '::1') {
        return '127.0.0.1';
    }
    
    // Удаляем IPv6 префикс ::ffff:
    if (ip.includes('::ffff:')) {
        return ip.replace('::ffff:', '');
    }
    
    return ip;
}

// Экранирование для CSV
function escapeCSV(str) {
    if (typeof str !== 'string') str = '';
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
}

// Логирование данных в файл
function logToFile(data) {
    try {
        // Логирование в JSON
        const logs = JSON.parse(fs.readFileSync(LOGS_FILE, 'utf8'));
        logs.push(data);
        
        // Сохраняем только последние 10000 записей
        if (logs.length > 10000) {
            logs.shift();
        }
        
        fs.writeFileSync(LOGS_FILE, JSON.stringify(logs, null, 2));

        // Логирование в текстовый файл
        const textLog = `
ВРЕМЯ: ${data.timestamp}
IP АДРЕС: ${data.ip}
ПОРТ КЛИЕНТА: ${data.clientPort}
ПОРТ СЕРВЕРА: ${data.serverPort}
USER-AGENT: ${data.userAgent}
ХОСТ: ${data.host}
ИСТОЧНИК: ${data.referer}
МЕТОД: ${data.method}
URL: ${data.url}
====================================================================\n`;
        
        fs.appendFileSync(LOGS_TEXT_FILE, textLog);

        // Логирование в CSV
        const csvLog = `${escapeCSV(data.timestamp)},${escapeCSV(data.ip)},${escapeCSV(data.clientPort)},${escapeCSV(data.serverPort)},${escapeCSV(data.userAgent)},${escapeCSV(data.referer)},${escapeCSV(data.method)},${escapeCSV(data.url)},${escapeCSV(data.host)}\n`;
        fs.appendFileSync(LOGS_CSV_FILE, csvLog);
        
        console.log(`[${data.timestamp}] IP: ${data.ip} | Port: ${data.clientPort} | Method: ${data.method} | URL: ${data.url}`);
    } catch (error) {
        console.error('❌ Ошибка при логировании:', error.message);
    }
}

// Создание простой HTML страницы
function getHtmlPage() {
    return `<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Page</title>
    <style>
        body {
            margin: 0;
            padding: 0;
            background: #000;
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
            font-family: Arial, sans-serif;
            color: #fff;
        }
        .container {
            text-align: center;
        }
        h1 {
            font-size: 2rem;
            margin: 0;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>404</h1>
    </div>
    <script>
        // Отправляем данные на сервер
        fetch('/log', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        }).catch(() => {});
    </script>
</body>
</html>`;
}

// Создание HTTP сервера
const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;
    const clientIP = getClientIP(req);
    const clientPort = req.socket.remotePort || 'unknown';
    const serverPort = PORT;

    // Обработка главной страницы
    if (pathname === '/' || pathname === '/index.html') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(getHtmlPage());

        // Логирование главной страницы
        const logData = {
            timestamp: new Date().toLocaleString('ru-RU'),
            ip: clientIP,
            clientPort: clientPort,
            serverPort: serverPort,
            userAgent: req.headers['user-agent'] || 'unknown',
            referer: req.headers['referer'] || 'direct',
            host: req.headers['host'] || 'unknown',
            method: req.method,
            url: req.url
        };
        logToFile(logData);
        return;
    }

    // Обработка /log (POST запрос логирования)
    if (pathname === '/log' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', () => {
            try {
                const logData = {
                    timestamp: new Date().toLocaleString('ru-RU'),
                    ip: clientIP,
                    clientPort: clientPort,
                    serverPort: serverPort,
                    userAgent: req.headers['user-agent'] || 'unknown',
                    referer: req.headers['referer'] || 'direct',
                    host: req.headers['host'] || 'unknown',
                    method: req.method,
                    url: req.url
                };
                logToFile(logData);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
            } catch (error) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: error.message }));
            }
        });
        return;
    }

    // Все остальное - 404
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(getHtmlPage());

    // Логирование всех запросов
    const logData = {
        timestamp: new Date().toLocaleString('ru-RU'),
        ip: clientIP,
        clientPort: clientPort,
        serverPort: serverPort,
        userAgent: req.headers['user-agent'] || 'unknown',
        referer: req.headers['referer'] || 'direct',
        host: req.headers['host'] || 'unknown',
        method: req.method,
        url: req.url
    };
    logToFile(logData);
});

// Запуск сервера
initLogs();
server.listen(PORT, () => {
    console.log(`\n╔════════════════════════════════════════════════╗`);
    console.log(`║   ✅ IP LOGGER SERVER ЗАПУЩЕН                 ║`);
    console.log(`║   🌐 http://localhost:${PORT}                      ║`);
    console.log(`║   📂 Логи сохраняются в:                      ║`);
    console.log(`║      ✓ ip_logs.json (JSON)                   ║`);
    console.log(`║      ✓ ip_logs.txt (текст)                   ║`);
    console.log(`║      ✓ ip_logs.csv (Excel)                   ║`);
    console.log(`╚════════════════════════════════════════════════╝\n`);
});

server.on('error', (error) => {
    console.error('❌ Ошибка сервера:', error.message);
});

// Обработка завершения процесса
process.on('SIGINT', () => {
    console.log('\n\n🛑 Сервер остановлен.');
    process.exit(0);
});
