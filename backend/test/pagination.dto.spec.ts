import 'reflect-metadata';
import { validate } from 'class-validator';
import { PaginationDto } from '../src/common/dto/pagination.dto';

describe('mailbox pagination and search validation', () => {
  it('accepts the supported page and limit values', async () => {
    const dto = Object.assign(new PaginationDto(), { page: 2, limit: 50, search: 'invoice' });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects a search query longer than 200 characters', async () => {
    const dto = Object.assign(new PaginationDto(), { search: 'x'.repeat(201) });
    expect((await validate(dto)).some((error) => error.property === 'search')).toBe(true);
  });

  it('rejects mailbox values longer than 100 characters', async () => {
    const dto = Object.assign(new PaginationDto(), { mailbox: 'x'.repeat(101) });
    expect((await validate(dto)).some((error) => error.property === 'mailbox')).toBe(true);
  });

  it('rejects unsupported page sizes', async () => {
    const dto = Object.assign(new PaginationDto(), { limit: 500 });
    expect((await validate(dto)).some((error) => error.property === 'limit')).toBe(true);
  });
});
