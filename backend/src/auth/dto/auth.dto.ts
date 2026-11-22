import { IsEmail, IsString, MinLength, IsNotEmpty, IsOptional, MaxLength, Matches } from 'class-validator';

export class RegisterDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsString()
  @MinLength(3)
  @MaxLength(30)
  @Matches(/^(?!.*\.\.)[a-zA-Z0-9](?:[a-zA-Z0-9._-]*[a-zA-Z0-9])$/, { message: 'Username must start and end with a letter or number and may contain letters, numbers, dots, underscores, and hyphens (no consecutive dots)' })
  username: string;

  @IsString()
  @MinLength(12)
  @MaxLength(72, { message: 'Password must not exceed 72 characters' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/, { message: 'Password must include lowercase, uppercase, number, and special character' })
  password: string;

  @IsOptional()
  @IsString()
  displayName?: string;
}

export class LoginDto {
  @IsString()
  @IsNotEmpty()
  identifier: string; // email or username

  @IsString()
  @IsNotEmpty()
  password: string;
}

export class RefreshDto {
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}
