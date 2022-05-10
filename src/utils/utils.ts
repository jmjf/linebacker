import { isDate } from 'util/types';

export function dateOrUndefinedAsDate(date: any): Date {
   if (isDate(date) || (typeof date === 'string' && !(isNaN(Date.parse(date))))) {
      return new Date(date);
   }
   return undefined as unknown as Date;
}