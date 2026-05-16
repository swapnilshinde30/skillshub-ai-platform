import { ValueTransformer } from 'typeorm';

/**
 * Serializes float[] <-> pgvector literal string "[x,y,z,...]"
 * TypeORM entity columns use type:'text' + this transformer.
 * A migration then alters those columns to vector(1536).
 * All similarity queries go through raw dataSource.query() calls.
 */
export const VectorTransformer: ValueTransformer = {
  to(value: number[] | null): string | null {
    if (!value || value.length === 0) return null;
    return `[${value.join(',')}]`;
  },
  from(value: string | null): number[] | null {
    if (!value) return null;
    return value
      .replace(/^\[|\]$/g, '')
      .split(',')
      .map(Number);
  },
};
