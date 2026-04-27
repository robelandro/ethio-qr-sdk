import { EthioQR } from './EthioQR';

// ─── Replace these with your actual merchant details ──────────────────────────

const ipsEtAccount = {
    guid: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', // 32-char UUID without hyphens
    bic: 'BANKXXXX',                          // Creditor Institution BIC (8 or 11 chars)
    accountNumber: '000000000000000',          // Merchant account number (up to 24 chars)
};

// ─── Example 1: Static QR ─────────────────────────────────────────────────────
// No amount embedded – customer's app prompts for amount at scan time.

async function staticExample() {
    const result = await EthioQR.generateStatic({
        ipsEtAccount,
        merchantCategoryCode: '5999',
        merchantName: 'My Shop Name',
        merchantCity: 'ADDIS ABABA',
        additionalData: {
            purposeOfTransaction: 'Retail Purchase',
            storeLabel: 'Main Branch',
        },
    });

    console.log('=== STATIC QR ===');
    console.log('Payload:', result.payload);
    console.log('Base64 :', result.base64);
}

// ─── Example 2: Dynamic QR ────────────────────────────────────────────────────
// Amount is embedded – used for single-use / point-of-sale transactions.

async function dynamicExample() {
    const result = await EthioQR.generateDynamic({
        ipsEtAccount,
        merchantCategoryCode: '5812',
        merchantName: 'My Restaurant',
        merchantCity: 'ADDIS ABABA',
        amount: 450.00,
        additionalData: {
            purposeOfTransaction: 'Food & Beverage',
            billNumber: 'INV-001',
            referenceLabel: 'TABLE-01',
        },
        convenienceFee: { type: 'prompt' },
    });

    console.log('\n=== DYNAMIC QR ===');
    console.log('Payload:', result.payload);
    console.log('Base64 :', result.base64);
}

// ─── Example 3: Dynamic QR with RTP (Request to Pay) ─────────────────────────

async function rtpExample() {
    const result = await EthioQR.generateDynamic({
        ipsEtAccount,
        merchantCategoryCode: '9311',
        merchantName: 'Revenue Office',
        merchantCity: 'ADDIS ABABA',
        amount: 1200.00,
        additionalData: {
            purposeOfTransaction: 'Tax Payment',
            billNumber: 'TAX-2024-00001',
            dueDate: '30042024',
            amountAfterDueDate: '1320.00',
        },
        endToEndId: 'E2EXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX', // 35-char E2E ID
    });

    console.log('\n=== DYNAMIC QR (RTP) ===');
    console.log('Payload:', result.payload);
    console.log('Base64 :', result.base64);
}

// ─── Run examples ─────────────────────────────────────────────────────────────

(async () => {
    try {
        await staticExample();
        await dynamicExample();
        await rtpExample();
    } catch (err) {
        console.error('Error:', err);
    }
})();
