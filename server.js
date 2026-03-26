require('dotenv').config();
const http = require('http');
const app = require('./src/app');

const PORT = process.env.PORT || 3000;

const server = http.createServer(app);

server.listen(PORT, () => {
    console.log(`VECI v2.0 API V1.0 Server running on port ${PORT}`);
});
