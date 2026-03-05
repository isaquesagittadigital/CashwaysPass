import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ExpressAdapter } from '@nestjs/platform-express';
import express from 'express';

const server = express();

export const createNestServer = async (expressInstance: express.Express) => {
  const app = await NestFactory.create(
    AppModule,
    new ExpressAdapter(expressInstance),
  );

  app.enableCors();
  await app.init();

  return app;
};

createNestServer(server)
  .then(() => console.log('Nest Ready'))
  .catch(err => console.error('Nest failed', err));

if (process.env.VERCEL !== '1') {
  const port = process.env.PORT || 3000;
  server.listen(port, () => {
    console.log(`Application is running locally on port ${port}`);
  });
}

export default server;
