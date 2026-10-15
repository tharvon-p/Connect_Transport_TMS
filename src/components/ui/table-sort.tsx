'use client';

import React from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { TableHead } from './table';

export type SortDirection = 'asc' | 'desc';

export interface SortState {
  key: string;
  direction: SortDirection;
}

/**
 * Universal Thai-aware sorting function with natural numerical string sorting
 */
export function sortArray<T>(
  items: T[],
  key: string,
  direction: SortDirection,
  customGetter?: (item: T) => any
): T[] {
  if (!key) return items;
  return [...items].sort((a, b) => {
    let valA = customGetter ? customGetter(a) : (a as any)[key];
    let valB = customGetter ? customGetter(b) : (b as any)[key];

    if (valA === valB) return 0;
    if (valA === null || valA === undefined || valA === '') return 1;
    if (valB === null || valB === undefined || valB === '') return -1;

    let res = 0;
    if (typeof valA === 'number' && typeof valB === 'number') {
      res = valA - valB;
    } else {
      res = String(valA).localeCompare(String(valB), 'th', { numeric: true });
    }
    return direction === 'asc' ? res : -res;
  });
}

/**
 * Interactive Column Header with visual sort indicators and tooltips
 */
export function SortableHeader({
  title,
  sortKey,
  currentSort,
  onSort,
  className,
  align = 'left',
}: {
  title: string;
  sortKey: string;
  currentSort: SortState;
  onSort: (key: string) => void;
  className?: string;
  align?: 'left' | 'center' | 'right';
}) {
  const isActive = currentSort.key === sortKey;
  const isAsc = currentSort.direction === 'asc';

  return (
    <TableHead
      className={`cursor-pointer select-none transition-colors hover:bg-slate-200/90 hover:text-blue-900 group ${className || ''}`}
      onClick={() => onSort(sortKey)}
      title={`คลิกเพื่อจัดเรียงตาม ${title} (${isActive ? (isAsc ? 'เรียงจากมากไปน้อย' : 'เรียงจากน้อยไปมาก') : 'คลิกเพื่อเรียงลำดับ'})`}
    >
      <div
        className={`flex items-center gap-1.5 ${
          align === 'right'
            ? 'justify-end'
            : align === 'center'
            ? 'justify-center'
            : 'justify-start'
        }`}
      >
        <span className={isActive ? 'font-bold text-blue-900' : ''}>{title}</span>
        {isActive ? (
          isAsc ? (
            <ArrowUp className="h-3.5 w-3.5 text-blue-600 shrink-0" />
          ) : (
            <ArrowDown className="h-3.5 w-3.5 text-blue-600 shrink-0" />
          )
        ) : (
          <ArrowUpDown className="h-3 w-3 text-slate-400 opacity-40 group-hover:opacity-100 shrink-0 transition-opacity" />
        )}
      </div>
    </TableHead>
  );
}
