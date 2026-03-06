import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class EmailService {
    private readonly logger = new Logger(EmailService.name);
    private readonly brevoApiKey: string;
    private readonly apiUrl = 'https://api.brevo.com/v3/smtp/email';

    constructor(private configService: ConfigService) {
        this.brevoApiKey = this.configService.get<string>('BREVO_API_KEY') || '';
    }

    async sendEventEmail(to: string, schoolName: string, eventName: string, eventDate: string) {
        this.logger.log(`Iniciando envio via Brevo para ${to}`);

        // Configuração do Payload JSON da API v3 da Brevo
        const payload = {
            sender: { name: 'Cashways Pass', email: 'no-reply@cashways.app' }, // Email remetente
            to: [{ email: to, name: schoolName }],
            subject: `🚨 Novo Evento Criado no Cashways Pass: ${eventName}`,
            htmlContent: `
        <div style="font-family: Arial, sans-serif; color: #111; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #4F46E5;">Olá, ${schoolName}!</h2>
          <p>Um novo evento acabou de ser configurado na plataforma <strong>Cashways Pass</strong> e já está pronto para receber os convidados.</p>
          
          <div style="background-color: #F8FAFC; border-left: 4px solid #4F46E5; padding: 15px; margin: 25px 0;">
            <p style="margin: 0 0 10px 0;"><strong>🎫 Evento:</strong> ${eventName}</p>
            <p style="margin: 0;"><strong>📅 Data do Evento:</strong> ${eventDate}</p>
          </div>
          
          <p>Acesse o painel para convidar lojistas ou conferir os alunos aptos e o faturamento estimado!</p>
          
          <br/>
          <hr style="border: 0; border-top: 1px solid #E5E7EB;" />
          <p style="font-size: 13px; color: #6B7280; text-align: center;">Cashways Pass - Plataforma de Pagamentos e Gestão Escolar</p>
        </div>
      `
        };

        try {
            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'api-key': this.brevoApiKey,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorText = await response.text();
                this.logger.error(`Brevo API Error: ${errorText}`);
                return { success: false, error: errorText };
            }

            const data = await response.json();
            this.logger.log(`E-mail disparado com sucesso! MessageId: ${data.messageId}`);
            return { success: true, messageId: data.messageId };

        } catch (error: any) {
            this.logger.error(`Falha fatal na comunicação com Brevo: ${error.message}`);
            return { success: false, error: error.message };
        }
    }
}
