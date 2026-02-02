
import { ForbiddenException, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async validateUser(email: string, pass: string): Promise<any> {
    const user = await this.usersService.findOne(email);
    
    if (!user) return null;

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
      user: { id: user.id, email: user.email, role: user.role }
    };
  }

  async register(userDto: any) {
    const hashedPassword = await bcrypt.hash(userDto.password, 10);
    return this.usersService.create({
      ...userDto,
      password: hashedPassword,
    });
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
}
