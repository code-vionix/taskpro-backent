
import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { EmailService } from '../common/email.service';
import { UsersService } from '../users/users.service';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private emailService: EmailService,
  ) {}

  async validateUser(email: string, pass: string): Promise<any> {
    const user = await this.usersService.findOne(email);
    
    if (!user || !user.password) return null;

    if (user.lockoutUntil && user.lockoutUntil > new Date()) {
      const waitSeconds = Math.ceil((user.lockoutUntil.getTime() - Date.now()) / 1000);
      throw new ForbiddenException(`Too many attempts. Try again in ${waitSeconds} seconds.`);
    }

    if (await bcrypt.compare(pass, user.password)) {
      // Reset attempts on success
      if (user.failedAttempts > 0 || user.lockoutUntil) {
          await this.usersService.update(user.id, { failedAttempts: 0, lockoutUntil: null });
      }
      const { password, ...result } = user;
      return result;
    } else {
        // Increment attempts on failure
        const attempts = user.failedAttempts + 1;
        let lockoutUntil = user.lockoutUntil;
        
        // Every 3 failed attempts, add penalty
        if (attempts % 3 === 0) {
            // 3rd attempt: 5s, 6th: 10s, 9th: 15s
            const multiplier = attempts / 3;
            const penaltySeconds = multiplier * 5; 
            lockoutUntil = new Date(Date.now() + penaltySeconds * 1000);
        }
        
        await this.usersService.update(user.id, { failedAttempts: attempts, lockoutUntil });
        console.warn(`User ${email} failed login attempt ${attempts}`);
        
        return null; 
    }
  }

  async login(user: any) {
    const payload = { username: user.email, sub: user.id, role: user.role };
    const refreshToken = this.jwtService.sign(payload, { 
      expiresIn: (process.env.JWT_REFRESH_EXPIRE || '7d') as any, 
      secret: process.env.JWT_REFRESH_SECRET || 'secret' 
    });
    
    // Save refresh token to db
    await this.usersService.updateRefreshToken(user.id, refreshToken);

    return {
      access_token: this.jwtService.sign(payload, { expiresIn: (process.env.JWT_EXPIRE || '15m') as any }),
      refresh_token: refreshToken,
      user: { id: user.id, email: user.email, role: user.role, name: user.name }
    };
  }

  async register(userDto: any) {
    const hashedPassword = userDto.password ? await bcrypt.hash(userDto.password, 10) : undefined;
    return this.usersService.create({
      ...userDto,
      password: hashedPassword,
    });
  }

  async requestMagicLink(email: string, forgotPassword: boolean = false) {
    let user = await this.usersService.findOne(email.toLowerCase().trim());
    
    if (!user) {
        // Auto-register user if they don't exist (only for first-time magic link)
        if (forgotPassword) {
            throw new UnauthorizedException('No account found with this email');
        }
        user = await this.usersService.create({ email: email.toLowerCase().trim() });
    } else if (user.password && !forgotPassword) {
        // User already has password set, should use password login
        throw new UnauthorizedException('You have already set a password. Please use password login or click "Forgot Password" to reset it.');
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    console.log(`Generating Magic Link for: ${email}`);
    console.log(`Token: ${token}`);

    await this.usersService.update(user.id, {
        otp: token,
        otpExpires: expires,
    });

    await this.emailService.sendMagicLink(email, token, forgotPassword);
    return { message: forgotPassword ? 'Password reset link sent to your email' : 'Magic link sent' };
  }

  async verifyMagicLink(email: string, token: string) {
    console.log(`Verifying Magic Link for: ${email}`);
    console.log(`Received Token: ${token}`);
    
    const user = await this.usersService.findOne(email.toLowerCase().trim());
    
    if (!user) {
        console.error('Verification Failed: User not found');
        throw new UnauthorizedException('Invalid or expired magic link');
    }

    console.log(`DB Token: ${user.otp}`);
    console.log(`DB Expires: ${user.otpExpires}`);
    console.log(`Current Time: ${new Date()}`);

    if (user.otp !== token) {
        console.error('Verification Failed: Token mismatch');
        throw new UnauthorizedException('Invalid or expired magic link');
    }

    if (user.otpExpires && user.otpExpires < new Date()) {
        console.error('Verification Failed: Token expired');
        throw new UnauthorizedException('Invalid or expired magic link');
    }

    // Clear OTP after use
    await this.usersService.update(user.id, {
        otp: null,
        otpExpires: null,
    });

    console.log('Verification Successful!');
    return this.login(user);
  }

  async refresh(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken, { 
        secret: process.env.JWT_REFRESH_SECRET || 'secret' 
      });
      
      const user = await this.usersService.findOneById(payload.sub);
      if (!user || user.refreshToken !== refreshToken) {
         throw new ForbiddenException('Invalid refresh token');
      }

      const newPayload = { username: user.email, sub: user.id, role: user.role };
      return {
        access_token: this.jwtService.sign(newPayload, { expiresIn: (process.env.JWT_EXPIRE || '15m') as any }),
        refresh_token: refreshToken, // Rotate if needed, for now keep same
      };
    } catch (e) {
      throw new ForbiddenException('Invalid refresh token');
    }
  }

  async guestLogin() {
      const GUEST_EMAIL = 'guest@taskpro.com';
      let user = await this.usersService.findOne(GUEST_EMAIL);
      
      if (!user) {
          user = await this.usersService.create({
              email: GUEST_EMAIL,
              name: 'Temporary Guest',
              role: Role.GUEST,
              bio: 'Observational restricted access account.'
          } as any);
      }

      return this.login(user);
  }
}
