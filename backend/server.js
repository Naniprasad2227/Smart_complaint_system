const dotenv = require('dotenv');
const http = require('http');
const connectDB = require('./config/db');
const app = require('./app');
const { createSocketServer } = require('./socket');
const { startEscalationScheduler } = require('./jobs/escalationJob');

dotenv.config();
connectDB();

const PORT = process.env.PORT || 5000;
const httpServer = http.createServer(app);
createSocketServer(httpServer);

httpServer.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
  startEscalationScheduler();
});
