import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // CORS 配置（仅允许前端访问）
  app.enableCors({
    origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
    credentials: true,
  });
  
  const port = process.env.PORT ?? 3001;
  await app.listen(port, '127.0.0.1'); // 只监听本地
  
  console.log(`🚀 API Server running on http://127.0.0.1:${port}`);
}
bootstrap();
