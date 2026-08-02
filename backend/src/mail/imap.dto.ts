import { IsBoolean, IsInt, IsOptional, IsString, MinLength } from 'class-validator';

export class ConnectImapDto {
  @IsString()
  @MinLength(1)
  host: string;

  @IsOptional()
  @IsInt()
  port?: number;

  @IsString()
  @MinLength(1)
  username: string;

  @IsString()
  @MinLength(1)
  password: string;

  @IsOptional()
  @IsBoolean()
  secure?: boolean;
}
