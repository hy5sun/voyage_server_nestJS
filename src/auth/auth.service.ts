import {
  HttpStatus,
  Inject,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { JwtService } from '@nestjs/jwt';
import { Cache } from 'cache-manager';
import * as bcrypt from 'bcrypt';
import { UsersService } from 'src/users/users.service';
import { SignUpDto } from './dto/signUp.dto';
import { EmailService } from 'src/email/email.service';
import { LogInDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly emailService: EmailService,
    private readonly jwtService: JwtService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async signUp(signUpDto: SignUpDto) {
    await this.usersService.createUser(signUpDto);
    const user = await this.usersService.findByEmail(signUpDto.email);

    return {
      statusCode: HttpStatus.CREATED,
      data: {
        message: ['정상적으로 회원가입 되었습니다.'],
        email: user.email,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    };
  }

  async login(loginDto: LogInDto) {
    const user = await this.usersService.findByEmail(loginDto.email);

    const isPasswordTrue = await bcrypt.compare(
      loginDto.password,
      user.password,
    );

    if (!isPasswordTrue) {
      throw new UnauthorizedException(['비밀번호가 일치하지 않습니다.']);
    }

    const payload = {
      userEmail: user.email,
    };

    return {
      statusCode: HttpStatus.OK,
      data: {
        message: ['정상적으로 로그인되었습니다.'],
        accessToken: await this.jwtService.signAsync(payload),
        email: user.email,
        name: user.name,
        univ: user.univ,
        department: user.department,
        admissionDate: user.admissionDate,
        expectedGraduationDate: user.expectedGraduationDate,
      },
    };
  }

  async send(email: string) {
    await this.usersService.validate(email);

    const code = Math.floor(Math.random() * 10000)
      .toString()
      .padStart(4, '0');

    try {
      await this.emailService.send(email, +code);
      await this.cacheManager.set(email, code, 300 * 1000);
      return {
        statusCode: HttpStatus.CREATED,
        data: {
          message: [`${email}로 인증번호를 전송했습니다.`],
        },
      };
    } catch (e) {
      throw new InternalServerErrorException([
        '이메일 전송에 문제가 생겼습니다.',
      ]);
    }
  }

  async verifyCode(email: string, code: number) {
    await this.emailService.verifyCode(email, code.toString());

    await this.cacheManager.del(email);
    return {
      statusCode: HttpStatus.CREATED,
      data: {
        message: [`인증번호를 올바르게 입력했습니다.`],
      },
    };
  }
}
