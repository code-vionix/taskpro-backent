
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor(private configService: ConfigService) {
    const user = this.configService.get('SMTP_USER');
    const pass = this.configService.get('SMTP_PASS');
    
    console.log('Initializing EmailService...');
    console.log('SMTP_USER loaded:', user ? 'Yes' : 'No');
    console.log('SMTP_PASS loaded:', pass ? 'Yes' : 'No');

    this.transporter = nodemailer.createTransport({
      host: this.configService.get('SMTP_HOST', 'smtp.gmail.com'),
      port: Number(this.configService.get('SMTP_PORT', 587)),
      secure: false,
      auth: {
        user: user,
        pass: pass,
      },
    });
  }

  async sendMagicLink(email: string, token: string, isForgotPassword: boolean = false) {
    const frontendUrl = this.configService.get('FRONTEND_URL', 'http://localhost:5173');
    const magicLink = `${frontendUrl}/verify-otp?email=${email}&token=${token}`;

    const mailOptions = {
      from: `"TaskPro Support" <${this.configService.get('SMTP_USER')}>`,
      to: email,
      subject: isForgotPassword ? 'Reset Your TaskPro Password' : 'Your Magic Login Link',
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
          <h2 style="color: #3b82f6;">${isForgotPassword ? 'Password Reset' : 'Welcome to TaskPro'}</h2>
          <p>${isForgotPassword 
              ? 'We received a request to reset your password. Click the button below to log in securely and update your credentials.' 
              : 'Click the button below to log in to your account. This link will expire in 10 minutes.'}</p>
          <a href="${magicLink}" style="display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0;">
            ${isForgotPassword ? 'Reset Password & Login' : 'Log In to TaskPro'}
          </a>
          <p style="color: #64748b; font-size: 14px;">Or copy and paste this link: <br/> ${magicLink}</p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
          <p style="color: #94a3b8; font-size: 12px;">If you didn't request this email, you can safely ignore it.</p>
        </div>
      `,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log(`${isForgotPassword ? 'Reset' : 'Magic'} link sent to ${email}`);
    } catch (error) {
      console.error('Error sending email:', error);
      throw new Error('Failed to send email');
    }
  }
}
