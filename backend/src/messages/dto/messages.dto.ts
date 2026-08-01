import {
  IsArray,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsBoolean,
  MaxLength,
} from 'class-validator';
import { Mailbox } from '@prisma/client';
import { Transform } from 'class-transformer';

export class CreateMessageDto {
  @IsArray()
  @IsEmail({}, { each: true })
  to: string[];

  @IsOptional()
  @IsString()
  @MaxLength(255)
  subject?: string;

  @IsOptional()
  @IsString()
  body?: string;

  @IsOptional()
  @IsEnum(Mailbox)
  mailbox?: Mailbox;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  labels?: string[];

  @IsOptional()
  @IsBoolean()
  isImportant?: boolean;
}

export class UpdateMessageDto {
  @IsOptional()
  @IsBoolean()
  isRead?: boolean;

  @IsOptional()
  @IsBoolean()
  isStarred?: boolean;

  @IsOptional()
  @IsEnum(Mailbox)
  mailbox?: Mailbox;

  @IsOptional()
  @Transform(({ value }) => (Array.isArray(value) ? value : value?.split(',')))
  @IsArray()
  @IsString({ each: true })
  labels?: string[];
}
