# ethio-qr-sdk

A TypeScript SDK for generating **NBE/EthSwitch-compliant, EMVCo-standard QR codes** for Ethiopian interoperable P2M (Peer-to-Merchant) payments via the IPS ET network.

Built against the official National Bank of Ethiopia specification:
[Interoperable QR Standard – NBE](https://nbe.gov.et/wp-content/uploads/2024/04/Interoperable-QR-Standard.pdf)

---

## What is this?

Ethiopia's National Bank (NBE) and EthSwitch have defined a unified QR code standard for digital merchant payments. It is based on the global **EMVCo QR Code Specification** (Merchant-Presented Mode) but tailored to the Ethiopian context — supporting the **IPS ET domestic payment scheme** alongside international schemes (Visa, Mastercard, UnionPay, etc.) in a single interoperable QR code.

This SDK handles all the low-level complexity:

- EMVCo TLV (Tag-Length-Value) encoding
- IPS ET Merchant Account Information (Tag 28) with GUID, BIC, and account sub-tags
- Static vs Dynamic QR modes (POI `11` / `12`)
- Convenience fees (prompt / fixed / percentage)
- Additional data fields (bill number, purpose, due date, loyalty, etc.)
- Alternate language template (e.g. Amharic merchant names)
- Request-to-Pay (RTP) End-to-End ID
- CRC-16/CCITT checksum (Tag 63)
- QR image generation as Base64 Data URI

---

## Installation

```bash
npm install ethio-qr-sdk
# or
bun add ethio-qr-sdk
```

---

## Quick Start

### Static QR (no amount — customer enters amount at scan time)

```typescript
import { EthioQR } from 'ethio-qr-sdk';

const result = await EthioQR.generateStatic({
  ipsEtAccount: {
    guid: '581b314e257f41bfbbdc6384daa31d16', // UUID without hyphens
    bic: 'CBETETAA',                           // Creditor Institution BIC
    accountNumber: '0000171234567890',          // Merchant account (up to 24 chars)
  },
  merchantCategoryCode: '5999',
  merchantName: 'Tewodros Spices & Grains',
  merchantCity: 'ADDIS ABABA',
});

console.log(result.payload); // Raw EMVCo string
console.log(result.base64);  // data:image/png;base64,... → use in <img src={result.base64} />
```

### Dynamic QR (amount embedded — single-use, point-of-sale)

```typescript
const result = await EthioQR.generateDynamic({
  ipsEtAccount: {
    guid: '581b314e257f41bfbbdc6384daa31d16',
    bic: 'CBETETAA',
    accountNumber: '0000171234567890',
  },
  merchantCategoryCode: '5812', // Restaurants
  merchantName: 'Habesha Restaurant',
  merchantCity: 'ADDIS ABABA',
  amount: 450.00,               // ETB 450.00 — embedded in QR
  additionalData: {
    purposeOfTransaction: 'Food & Beverage',
    billNumber: 'INV-2024-001',
  },
});
```

---

## API Reference

### `EthioQR.generateStatic(opts)`

Generates a **Static QR** — reusable, no amount embedded. The customer's banking app prompts for the amount at scan time. Maps to EMVCo Point of Initiation `11`.

### `EthioQR.generateDynamic(opts)`

Generates a **Dynamic QR** — single-use, amount is embedded. Used at POS terminals or for bill payments. Maps to EMVCo Point of Initiation `12`. `amount` is required.

### `EthioQR.generate(opts)`

Full control — pass `type: 'Static' | 'Dynamic'` explicitly.

### `EthioQR.buildPayload(opts)`

Returns only the raw EMVCo payload string without generating an image. Useful for server-side rendering or custom QR libraries.

---

## Options

```typescript
interface EthioQROptions {
  type: 'Static' | 'Dynamic';

  // IPS ET Merchant Account Info (Tag 28) — required
  ipsEtAccount: {
    guid: string;          // UUID without hyphens (32 hex chars)
    bic: string;           // Creditor Institution BIC (8 or 11 chars)
    accountNumber: string; // Merchant IBAN / account (up to 24 chars)
  };

  merchantCategoryCode: string; // ISO 18245 MCC (Tag 52)
  merchantName: string;         // Max 25 chars (Tag 59)
  merchantCity: string;         // Max 15 chars (Tag 60)

  amount?: string | number;     // Required for Dynamic (Tag 54)
  currencyCode?: string;        // ISO 4217, defaults to '230' (ETB) (Tag 53)
  countryCode?: string;         // ISO 3166 Alpha-2, defaults to 'ET' (Tag 58)

  // Convenience / tip fee (Tags 55/56/57)
  convenienceFee?:
    | { type: 'prompt' }                      // Customer enters tip
    | { type: 'fixed'; amount: string }       // Fixed tip amount
    | { type: 'percentage'; percent: string }; // Percentage tip

  // Additional data fields (Tag 62)
  additionalData?: {
    billNumber?: string;           // Invoice / voucher number
    mobileNumber?: string;         // For mobile top-up
    storeLabel?: string;           // Branch name
    loyaltyNumber?: string;        // Loyalty card identifier
    referenceLabel?: string;       // Merchant reconciliation reference
    customerLabel?: string;        // Subscriber / enrollment ID
    terminalLabel?: string;        // Till / counter ID
    purposeOfTransaction?: string; // e.g. "Fee Payment" (mandatory per EthSwitch)
    additionalCustomerData?: string; // "A" = address, "M" = mobile, "E" = email
    merchantTaxId?: string;        // Tax identification number
    merchantChannel?: string;      // 3-char channel code
    dueDate?: string;              // DDMMYYYY format
    amountAfterDueDate?: string;   // Amount if paid after due date
  };

  // Alternate language template (Tag 64) — e.g. Amharic
  languageTemplate?: {
    languagePreference: string;      // e.g. "AM"
    alternateMerchantName: string;
    alternateMerchantCity?: string;
  };

  transactionContext?: string; // Free-text context, max 50 chars (Tag 80)
  endToEndId?: string;         // 35-char E2E ID for RTP Dynamic QRs (Tag 84)
  transactionTypeCode?: string;// TTC value (Tag 85)

  imageOptions?: QRCodeToDataURLOptions; // qrcode library options
}
```

---

## Examples

### With Amharic merchant name (Tag 64)

```typescript
const result = await EthioQR.generateStatic({
  ipsEtAccount: { guid: '...', bic: 'CBETETAA', accountNumber: '...' },
  merchantCategoryCode: '5411',
  merchantName: 'Tewodros Supermarket',
  merchantCity: 'ADDIS ABABA',
  languageTemplate: {
    languagePreference: 'AM',
    alternateMerchantName: 'ቴዎድሮስ ሱፐርማርኬት',
    alternateMerchantCity: 'አዲስ አበባ',
  },
});
```

### With convenience fee (percentage tip)

```typescript
const result = await EthioQR.generateDynamic({
  ipsEtAccount: { guid: '...', bic: 'CBETETAA', accountNumber: '...' },
  merchantCategoryCode: '5812',
  merchantName: 'Kategna Restaurant',
  merchantCity: 'ADDIS ABABA',
  amount: 800,
  convenienceFee: { type: 'percentage', percent: '10' }, // 10% tip
});
```

### Bill payment with due date (Tag 62/50)

```typescript
const result = await EthioQR.generateDynamic({
  ipsEtAccount: { guid: '...', bic: 'CBETETAA', accountNumber: '...' },
  merchantCategoryCode: '4900', // Utilities
  merchantName: 'Addis Ababa Water',
  merchantCity: 'ADDIS ABABA',
  amount: 350,
  additionalData: {
    billNumber: 'UTIL-2024-88821',
    purposeOfTransaction: 'Water Bill',
    dueDate: '30042024',         // DDMMYYYY
    amountAfterDueDate: '385',   // Penalty amount after due date
  },
});
```

### Request-to-Pay (RTP) Dynamic QR (Tag 84)

```typescript
const result = await EthioQR.generateDynamic({
  ipsEtAccount: { guid: '...', bic: 'CBETETAA', accountNumber: '...' },
  merchantCategoryCode: '9311',
  merchantName: 'Addis Revenue Office',
  merchantCity: 'ADDIS ABABA',
  amount: 1200,
  endToEndId: 'E2E20240427TAXRTP00000000001', // 35-char E2E ID
  additionalData: {
    billNumber: 'TAX-2024-00987',
    purposeOfTransaction: 'Tax Payment',
  },
});
```

### Raw payload only (no image)

```typescript
import { EthioQR } from 'ethio-qr-sdk';

const payload = EthioQR.buildPayload({
  type: 'Static',
  ipsEtAccount: { guid: '...', bic: 'CBETETAA', accountNumber: '...' },
  merchantCategoryCode: '5999',
  merchantName: 'My Shop',
  merchantCity: 'ADDIS ABABA',
});

// Pass `payload` to any QR rendering library
```

---

## QR Tag Reference (NBE/EthSwitch Standard)

| Tag | Name | Notes |
|-----|------|-------|
| 00 | Payload Format Indicator | Always `01` |
| 01 | Point of Initiation | `11` Static, `12` Dynamic |
| 28 | IPS ET Merchant Account Info | GUID + BIC + Account |
| 52 | Merchant Category Code | ISO 18245 |
| 53 | Transaction Currency | `230` = ETB |
| 54 | Transaction Amount | Dynamic QR only |
| 55–57 | Convenience Fee | Prompt / Fixed / Percentage |
| 58 | Country Code | `ET` |
| 59 | Merchant Name | Max 25 chars |
| 60 | Merchant City | Max 15 chars |
| 62 | Additional Data Field | Bill no., purpose, due date, etc. |
| 63 | CRC | CRC-16/CCITT, auto-calculated |
| 64 | Language Template | Alternate (e.g. Amharic) name |
| 80 | Transaction Context | Free-text description |
| 84 | End-to-End ID | RTP Dynamic QR |
| 85 | Transaction Type Code | Scheme-specific |

---

## Standard Compliance

This SDK implements the **EthSwitch QR Code Template** as defined in the NBE Interoperable QR Standard, which is itself based on the [EMVCo QR Code Specification for Payment Systems – Merchant-Presented Mode](https://www.emvco.com/specifications/emv-qr-code-specification-for-payment-systems-emvqrcps-merchant-presented-mode/).

Key compliance points:
- Tag IDs 28–30 reserved for IPS ET (domestic scheme)
- Payload length must not exceed 512 characters (EMVCo requirement)
- CRC-16/CCITT checksum on full payload including `6304` suffix
- GUID in Tag 28/00 must be a UUID without hyphens
- Currency `230` = Ethiopian Birr (ETB) per ISO 4217
- Country `ET` per ISO 3166 Alpha-2

---

## License

MIT © NFTALEM AREGA
