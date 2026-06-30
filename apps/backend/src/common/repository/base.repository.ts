import { NotFoundException } from '@nestjs/common';

/**
 * Kiểu delegate Prisma tối thiểu mà BaseRepository yêu cầu.
 * Các lớp con truyền vào đúng delegate (prisma.user, prisma.contact, ...).
 */
export interface PrismaDelegate {
  findMany(args?: any): Promise<any[]>;
  findUnique(args: any): Promise<any | null>;
  findFirst(args?: any): Promise<any | null>;
  create(args: any): Promise<any>;
  update(args: any): Promise<any>;
  delete(args: any): Promise<any>;
  count(args?: any): Promise<number>;
}

export abstract class BaseRepository<TModel> {
  protected abstract get delegate(): PrismaDelegate;
  protected abstract readonly notFoundMessage: string;

  findMany(args?: Parameters<PrismaDelegate['findMany']>[0]): Promise<TModel[]> {
    return this.delegate.findMany(args);
  }

  findUnique(args: Parameters<PrismaDelegate['findUnique']>[0]): Promise<TModel | null> {
    return this.delegate.findUnique(args);
  }

  findFirst(args?: Parameters<PrismaDelegate['findFirst']>[0]): Promise<TModel | null> {
    return this.delegate.findFirst(args);
  }

  async findById(id: string, select?: Record<string, boolean>): Promise<TModel> {
    const record = await this.delegate.findUnique({ where: { id }, ...(select && { select }) });
    if (!record) throw new NotFoundException(this.notFoundMessage);
    return record;
  }

  create(data: any, select?: Record<string, boolean>): Promise<TModel> {
    return this.delegate.create({ data, ...(select && { select }) });
  }

  async update(id: string, data: any, select?: Record<string, boolean>): Promise<TModel> {
    await this.findById(id);
    return this.delegate.update({ where: { id }, data, ...(select && { select }) });
  }

  async delete(id: string): Promise<TModel> {
    await this.findById(id);
    return this.delegate.delete({ where: { id } });
  }

  count(where?: any): Promise<number> {
    return this.delegate.count({ where });
  }
}
