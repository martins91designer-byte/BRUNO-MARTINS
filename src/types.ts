export interface Player {
  id: string;
  name: string;
  goalsWeekly: number;
  goalsMonthly: number;
  statusFinanceiro: 'em_dia' | 'devendo' | 'isento';
  paymentAmount: number;
  paymentType: 'mensalista' | 'diarista' | 'isento';
  presente: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Expense {
  id: string;
  description: string;
  amount: number;
  date: string;
  createdAt: string;
}

export type OperationType = 'create' | 'update' | 'delete' | 'list' | 'get' | 'write';

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string;
    email?: string | null;
    emailVerified?: boolean;
    isAnonymous?: boolean;
    tenantId?: string | null;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}
