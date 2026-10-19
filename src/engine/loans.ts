import type { Project } from '../types';
import { numVar } from './subscriptions';
import { simulate } from './simulate';

// حسابات القروض. أصل القرض المسترد ليس ربحًا للصندوق.

export interface Installment {
  n: number;
  principal: number;
  balance: number;
}

/** جدول استرداد بأقساط متساوية من الأصل فقط، دون أي زيادة */
export const repaymentSchedule = (amount: number, termMonths: number): Installment[] => {
  const t = Math.max(1, Math.round(termMonths));
  const each = amount / t;
  return Array.from({ length: t }, (_, i) => ({ n: i + 1, principal: each, balance: Math.max(0, amount - each * (i + 1)) }));
};

/**
 * عدد القروض السنوي المستدام لحوض سيولة معين في حالة الاستقرار.
 * متوسط الرصيد القائم للقرض الواحد خلال مدته = المبلغ × (م+1) / (2م)، ومدته م/12 سنة.
 */
export const sustainableLoansPerYear = (pool: number, avgAmount: number, termMonths: number): number | null => {
  if (pool <= 0 || avgAmount <= 0 || termMonths <= 0) return null;
  const loanYears = (avgAmount * (termMonths + 1)) / 24;
  return pool / loanYears;
};

export interface LoanStats {
  poolEndYear1: number | null;
  lendableNow: number | null;
  capacityPerYear: number | null;
  planned: number;
  disbursed: number;
  repaid: number;
  writtenOff: number;
  outstanding: number;
  unmet: number;
}

export const loanStats = (p: Project): LoanStats => {
  const r = simulate(p, 'base');
  const y1 = r.years[0];
  const poolPct = (numVar(p, 'loan_pool_pct') ?? 0) / 100;
  const pool = y1 ? poolPct * (y1.endCash + y1.loansOutstanding) : null;
  const avg = numVar(p, 'loan_avg_amount') ?? 0;
  const term = numVar(p, 'loan_term_months') ?? 0;
  const reserve = numVar(p, 'min_cash_reserve') ?? 0;
  return {
    poolEndYear1: pool,
    lendableNow: y1 ? Math.max(0, Math.min(pool! - y1.loansOutstanding, y1.endCash - reserve)) : null,
    capacityPerYear: pool != null ? sustainableLoansPerYear(pool, avg, term) : null,
    planned: r.loans.planned,
    disbursed: r.loans.disbursed,
    repaid: r.loans.repaid,
    writtenOff: r.loans.writtenOff,
    outstanding: r.loans.outstandingEnd,
    unmet: r.loans.unmet,
  };
};

export interface SensitivityCell {
  ceilingFactor: number;
  termFactor: number;
  loansPerYear: number | null;
}

/** أثر رفع السقف (ومعه متوسط القرض) وإطالة مدة السداد على عدد القروض السنوي المستدام */
export const sensitivity = (p: Project, pool: number | null): SensitivityCell[] => {
  const avg = numVar(p, 'loan_avg_amount') ?? 0;
  const term = numVar(p, 'loan_term_months') ?? 0;
  const cells: SensitivityCell[] = [];
  for (const cf of [1, 1.25, 1.5, 2]) {
    for (const tf of [1, 1.5, 2]) {
      cells.push({
        ceilingFactor: cf,
        termFactor: tf,
        loansPerYear: pool == null ? null : sustainableLoansPerYear(pool, avg * cf, term * tf),
      });
    }
  }
  return cells;
};
