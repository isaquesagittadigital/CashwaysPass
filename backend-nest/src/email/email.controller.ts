import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { EmailService } from './email.service';

export class SendEventEmailDto {
    to: string;
    schoolName: string;
    eventName: string;
    eventDate: string;
}

@Controller('email')
export class EmailController {
    constructor(private readonly emailService: EmailService) { }

    @Post('send-event-invite')
    @HttpCode(HttpStatus.OK)
    async sendEventInvite(@Body() payload: SendEventEmailDto) {
        if (!payload.to || !payload.eventName || !payload.schoolName || !payload.eventDate) {
            return { success: false, error: 'Parâmetros incompletos de envio de email' };
        }

        return this.emailService.sendEventEmail(
            payload.to,
            payload.schoolName,
            payload.eventName,
            payload.eventDate
        );
    }

    @Post('welcome')
    @HttpCode(HttpStatus.OK)
    async sendWelcome(@Body() payload: { email: string; name: string }) {
        if (!payload.email || !payload.name) {
            return { success: false, error: 'Parâmetros incompletos de envio de email de boas-vindas' };
        }

        return this.emailService.sendWelcomeEmail(payload.email, payload.name);
    }
}
