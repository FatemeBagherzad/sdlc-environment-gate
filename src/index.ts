import { createServer } from './server';
import { logger } from './logger';

const port = Number(process.env.PORT || 3000);
const app = createServer();

app.listen(port, () => {
  logger.info('server started', { port: port });
});
