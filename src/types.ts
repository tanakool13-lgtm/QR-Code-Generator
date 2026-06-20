export interface TLVNode {
  tag: string;
  length: number;
  value: string;
  name: string;
  description: string;
  subNodes?: TLVNode[];
}

export type PayloadType = 'promptpay' | 'raw';

export interface PromptPayParams {
  type: 'phone' | 'national_id' | 'e_wallet';
  id: string; // Phone number or National ID or E-Wallet ID
  amount?: string; // Optional amount
  oneTime: boolean; // Dynamic (true) or Static (false)
}

export interface EMVTagInfo {
  name: string;
  description: string;
  subTags?: Record<string, { name: string; description: string }>;
}
