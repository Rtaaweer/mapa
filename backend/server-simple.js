const http = require('http');

const port = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ 
    message: 'Backend funcionando', 
    timestamp: new Date().toISOString(),
    port: port
  }));
});

server.listen(port, '0.0.0.0', () => {
  console.log(`Servidor simple escuchando en puerto ${port}`);
});