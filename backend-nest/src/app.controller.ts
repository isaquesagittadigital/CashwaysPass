import { Controller, Get, Post, Body } from '@nestjs/common';
import { AppService } from './app.service';
import { EmailService } from './email/email.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly emailService: EmailService
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Post('email/welcome')
  async sendWelcomeEmail(@Body() data: { email: string, name: string }) {
    return this.emailService.sendWelcomeEmail(data.email, data.name);
  }
}
