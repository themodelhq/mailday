import {
  IsArray,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsBoolean,
  MaxLength,
  IsDateString,
} from 'class-validator';
import { Mailbox } from '@prisma/client';
import { Transform } from 'class-transformer';

export class CreateMessageDto {
  @IsOptional()
  @IsArray()
  @IsEmail({}, { each: true })
  to?: string[];

  @IsOptional()
  @IsArray()
  @IsEmail({}, { each: true })
  cc?: string[];

  @IsOptional()
  @IsArray()
  @IsEmail({}, { each: true })
  bcc?: string[];

  @IsOptional()
  @IsString()
  threadId?: string;

  @IsOptional()
  @IsString()
  inReplyTo?: string;

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

  @IsOptional()
  @IsString()
  @MaxLength(128)
  idempotencyKey?: string;

  @IsOptional()
  @IsDateString()
  scheduledAt?: string;
}

export class UpdateMessageDto {
  @IsOptional() @IsArray() @IsEmail({}, { each: true }) to?: string[];
  @IsOptional() @IsArray() @IsEmail({}, { each: true }) cc?: string[];
  @IsOptional() @IsArray() @IsEmail({}, { each: true }) bcc?: string[];
  @IsOptional() @IsString() subject?: string;
  @IsOptional() @IsString() body?: string;
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
