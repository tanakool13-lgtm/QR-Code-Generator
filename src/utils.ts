import { TLVNode, PromptPayParams, EMVTagInfo } from './types';

// Standard EMVCo tag dictionaries
export const TAG_INFO: Record<string, EMVTagInfo> = {
  '00': {
    name: 'Payload Format Indicator',
    description: 'Defines the version of the EMVCo specification. Usually "01".',
  },
  '01': {
    name: 'Point of Initiation Method',
    description: 'Indicates if the QR code can be used multiple times (Static: 11) or is transaction-specific (Dynamic: 12).',
  },
  '29': {
    name: 'Merchant Account Information (PromptPay Credit)',
    description: 'Specific mapping for PromptPay credit transfers in Thailand.',
    subTags: {
      '00': { name: 'Application ID (AID)', description: 'PromptPay AID (typically "A000000677010111").' },
      '01': { name: 'Registered Phone Number', description: 'Phone number in international standard e.g. 0066 + 9 digits.' },
      '02': { name: 'National ID / Tax ID', description: '13-digit identification number registered with PromptPay.' },
      '03': { name: 'E-Wallet ID', description: '15-digit identification number for e-wallet transfers.' },
    },
  },
  '30': {
    name: 'Merchant Account Information (PromptPay Bill Payment)',
    description: 'Used for Biller ID transfers, typical of corporate or utility payments.',
    subTags: {
      '00': { name: 'Application ID (AID)', description: 'Biller payment AID (typically "A000000677010112").' },
      '01': { name: 'Biller Service ID', description: 'Tax ID (13 chars) + Suffix (2 chars) of the merchant.' },
      '02': { name: 'Reference 1', description: 'First transaction reference (e.g. customer ID / invoice ID).' },
      '03': { name: 'Reference 2', description: 'Second transaction reference if required.' },
    },
  },
  '52': {
    name: 'Merchant Category Code (MCC)',
    description: 'Merchant classification code as defined in ISO 18245.',
  },
  '53': {
    name: 'Transaction Currency',
    description: 'ISO 4217 Currency Code. "764" represents Thai Baht (THB).',
  },
  '54': {
    name: 'Transaction Amount',
    description: 'The numeric transaction value. Must match actual currency decimal format.',
  },
  '55': {
    name: 'Tip or Convenience Indicator',
    description: 'Indicates whether consumer is prompted to input a tip or if a flat/percentage fee is added.',
  },
  '56': {
    name: 'Value of Convenience Fee (Fixed)',
    description: 'Fixed merchant surcharge fee value.',
  },
  '57': {
    name: 'Value of Convenience Fee (Percentage)',
    description: 'Surcharge percentage added by the merchant.',
  },
  '58': {
    name: 'Country Code',
    description: 'ISO 3166 Country Code. "TH" denotes Thailand.',
  },
  '59': {
    name: 'Merchant Name',
    description: 'Name of the merchant visible during scans.',
  },
  '60': {
    name: 'Merchant City',
    description: 'City in which the merchant resides.',
  },
  '61': {
    name: 'Postal Code',
    description: 'Sellers postal code.',
  },
  '62': {
    name: 'Additional Data Fields',
    description: 'Structure containing extra tags such as reference, invoice, or store markers.',
    subTags: {
      '01': { name: 'Bill Number', description: 'The bill invoice number.' },
      '02': { name: 'Mobile Number', description: 'Primary terminal mobile identifier.' },
      '03': { name: 'Store Label', description: 'Name of the individual retail branch.' },
      '05': { name: 'Customer ID', description: 'Payer identification reference.' },
      '06': { name: 'Reference ID', description: 'Consolidated reference tag.' },
      '07': { name: 'Consumer Query ID', description: 'Payer code marker.' },
      '08': { name: 'Terminal Label', description: 'POS register device label.' },
    },
  },
  '63': {
    name: 'CRC Checksum',
    description: 'CRC-16 CCITT False checksum used to verify data integrity (must end the payload).',
  },
};

/**
 * Calculates CRC-16 CCITT False checksum for given text.
 * Runs exact polynomial 0x1021, initial value 0xFFFF, input xor-ed.
 */
export function crc16CcittFalse(text: string): string {
  let crc = 0xFFFF;

  for (let i = 0; i < text.length; i++) {
    crc ^= text.charCodeAt(i) << 8;

    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xFFFF;
      } else {
        crc = (crc << 1) & 0xFFFF;
      }
    }
  }

  return crc
    .toString(16)
    .toUpperCase()
    .padStart(4, '0');
}

/**
 * Parses nested or flat TLV (Tag-Length-Value) EMVCo format.
 */
export function parseTLV(text: string, currentTagsMap: Record<string, EMVTagInfo> = TAG_INFO): TLVNode[] {
  const result: TLVNode[] = [];
  let index = 0;

  while (index < text.length - 1) {
    if (text.length - index < 4) {
      break; // Not enough remaining characters for Tag (2) + Length (2)
    }

    const tag = text.substring(index, index + 2);
    const lengthStr = text.substring(index + 2, index + 4);
    const length = parseInt(lengthStr, 10);

    if (isNaN(length) || length < 0) {
      break; // Invalid length tag
    }

    index += 4;

    if (index + length > text.length) {
      // Out of bounds - grab the remaining part as value
      const value = text.substring(index);
      const tagDef = currentTagsMap[tag];
      result.push({
        tag,
        length,
        value,
        name: tagDef?.name || `Unknown Tag ${tag}`,
        description: tagDef?.description || 'No specialized description for this tag.',
      });
      break;
    }

    const value = text.substring(index, index + length);
    index += length;

    const tagDef = currentTagsMap[tag];
    const nodeName = tagDef?.name || `Tag ${tag}`;
    const nodeDesc = tagDef?.description || 'Custom data field.';

    // Recursive parse for nested structures
    let subNodes: TLVNode[] | undefined;
    if (tagDef?.subTags && (tag === '29' || tag === '30' || tag === '62')) {
      // Map subtags to general EMVTagInfo schema
      const subTagDefMapped: Record<string, EMVTagInfo> = {};
      for (const [subKey, subVal] of Object.entries(tagDef.subTags)) {
        subTagDefMapped[subKey] = {
          name: subVal.name,
          description: subVal.description,
        };
      }
      subNodes = parseTLV(value, subTagDefMapped);
    }

    result.push({
      tag,
      length,
      value,
      name: nodeName,
      description: nodeDesc,
      subNodes,
    });
  }

  return result;
}

/**
 * Generates initial un-checksummed PromptPay EMVCo string.
 */
export function generatePromptPayPayload(params: PromptPayParams): string {
  // 1. Format Indicator
  let payload = '000201';

  // 2. Point of Initiation Method
  // 11 = Static (default, or no amount given)
  // 12 = Dynamic (usually with amount to make sure the user registers the specific amount)
  const isOneTime = params.amount ? true : params.oneTime;
  payload += isOneTime ? '010212' : '010211';

  // 3. PromptPay Merchant Code Block Structure (Tag 29)
  // Sub-tag 00: AID A000000677010111
  let subTags = '0016A000000677010111';

  const cleanedId = params.id.replace(/[^0-9]/g, '');

  if (params.type === 'phone') {
    // Format: 0066 + 9 standard digits after removing leading '0'
    let phoneStr = cleanedId;
    if (phoneStr.startsWith('0')) {
      phoneStr = '0066' + phoneStr.substring(1);
    } else if (phoneStr.startsWith('66') && phoneStr.length <= 11) {
      phoneStr = '00' + phoneStr;
    } else if (!phoneStr.startsWith('0066')) {
      phoneStr = '0066' + phoneStr;
    }
    // Limit total digits to 13
    phoneStr = phoneStr.substring(0, 13);
    const lenStr = String(phoneStr.length).padStart(2, '0');
    subTags += '01' + lenStr + phoneStr;
  } else if (params.type === 'national_id') {
    // Format ID directly
    const nationalId = cleanedId.substring(0, 13);
    const lenStr = String(nationalId.length).padStart(2, '0');
    subTags += '02' + lenStr + nationalId;
  } else {
    // E-Wallet ID (15 chars)
    const walletId = cleanedId.substring(0, 15);
    const lenStr = String(walletId.length).padStart(2, '0');
    subTags += '03' + lenStr + walletId;
  }

  const subTagsLen = String(subTags.length).padStart(2, '0');
  payload += '29' + subTagsLen + subTags;

  // 4. Currency "764" (Thai Baht)
  payload += '5303764';

  // 5. Amount (Tag 54)
  if (params.amount) {
    const parsedAmount = parseFloat(params.amount);
    if (!isNaN(parsedAmount) && parsedAmount > 0) {
      const fixedAmount = parsedAmount.toFixed(2);
      const amountLen = String(fixedAmount.length).padStart(2, '0');
      payload += '54' + amountLen + fixedAmount;
    }
  }

  // 6. Country Code "TH"
  payload += '5802TH';

  // 7. Standard EMVCo marker for CRC16 calculation (Tag 63 length 04)
  payload += '6304';

  return payload;
}

/**
 * Extracts PromptPay preset configuration from an existing EMVCo string payload if possible.
 */
export function extractPromptPayParams(payload: string): PromptPayParams | null {
  try {
    const nodes = parseTLV(payload);
    const initNode = nodes.find(n => n.tag === '01');
    const tag29Node = nodes.find(n => n.tag === '29');
    const amountNode = nodes.find(n => n.tag === '54');

    if (!tag29Node) return null;

    const subNodes = tag29Node.subNodes || [];
    const phoneNode = subNodes.find(n => n.tag === '01');
    const idNode = subNodes.find(n => n.tag === '02');
    const walletNode = subNodes.find(n => n.tag === '03');

    let type: 'phone' | 'national_id' | 'e_wallet' = 'phone';
    let id = '';

    if (phoneNode) {
      type = 'phone';
      id = phoneNode.value;
      // Revert back local phone structure (08xxxxxxxx) if it is international 0066xxxxxxxxx
      if (id.startsWith('0066')) {
        id = '0' + id.substring(4);
      }
    } else if (idNode) {
      type = 'national_id';
      id = idNode.value;
    } else if (walletNode) {
      type = 'e_wallet';
      id = walletNode.value;
    } else {
      return null;
    }

    return {
      type,
      id,
      amount: amountNode ? amountNode.value : undefined,
      oneTime: initNode ? initNode.value === '12' : false
    };
  } catch (e) {
    return null;
  }
}

export interface CRCAnalysis {
  basePayload: string; // The part we compute CRC on (including ending 6304)
  existingCrc: string | null; // CRC that was already present in the source string
  calculatedCrc: string; // CRC computed by our system
  finalPayload: string; // Combined basePayload + calculatedCrc
  isValid: boolean; // True if was already present and matched calculated
}

/**
 * Analyzes standard EMVCo input to detect, compare with, or append a CRC16 checksum
 */
export function analyzePayloadCRC(rawInput: string): CRCAnalysis {
  const trimmed = rawInput.trim();
  const crcPattern = /6304([0-9A-Fa-f]{4})$/;
  const match = trimmed.match(crcPattern);

  if (match) {
    const existingCrc = match[1].toUpperCase();
    const index6304 = trimmed.lastIndexOf("6304");
    const basePayload = trimmed.substring(0, index6304 + 4);
    const calculatedCrc = crc16CcittFalse(basePayload);
    return {
      basePayload,
      existingCrc,
      calculatedCrc,
      finalPayload: basePayload + calculatedCrc,
      isValid: existingCrc === calculatedCrc,
    };
  } else {
    let basePayload = trimmed;
    // Handing special missing custom checksum case
    if (!basePayload.endsWith("6304")) {
      if (basePayload.includes("6304")) {
        const idx = basePayload.lastIndexOf("6304");
        basePayload = basePayload.substring(0, idx + 4);
      } else {
        basePayload += "6304";
      }
    }
    const calculatedCrc = crc16CcittFalse(basePayload);
    return {
      basePayload,
      existingCrc: null,
      calculatedCrc,
      finalPayload: basePayload + calculatedCrc,
      isValid: false,
    };
  }
}

/**
 * Clean and parse double amount input safely
 */
export function formatCurrencyString(input: string): string {
  const cleaned = input.replace(/[^0-9.]/g, '');
  // make sure only one decimal point exists
  const parts = cleaned.split('.');
  if (parts.length > 2) {
    return parts[0] + '.' + parts.slice(1).join('');
  }
  return cleaned;
}
