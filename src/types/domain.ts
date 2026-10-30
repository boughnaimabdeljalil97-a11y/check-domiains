export type CheckStatus = 'pending' | 'checking' | 'completed' | 'cancelled' | 'error';
export type FlagValue = 'yes' | 'no' | '?' | 'checking' | 'pending';

export interface DomainRecord {
  id: string;
  domain: string;
  status: CheckStatus;
  registeredOn: string; // 'YYYY-MM-DD' or 'no data'
  updatedOn: string;    // 'YYYY-MM-DD' or 'no data'
  ssl: FlagValue;       // 'yes' | 'no' | 'checking' | 'pending'
  website: FlagValue;   // 'yes' | 'no' | 'checking' | 'pending'
  websiteReason?: string;
  dnsResolves?: boolean;
  registrar?: string;
  expiresOn?: string;
  nameservers?: string[];
  whoisUrl?: string;
  error?: string;
  checkedAt?: string;
  durationMs?: number;
}

export interface CheckerSummary {
  total: number;
  completed: number;
  pending: number;
  checking: number;
  sslYes: number;
  sslNo: number;
  websiteYes: number;
  websiteNo: number;
  bothYes: number;
  whoisFound: number;
}
