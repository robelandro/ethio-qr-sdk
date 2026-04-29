import * as QRCode from 'qrcode';

// ─── Result Types ────────────────────────────────────────────────────────────

export interface QRResult {
    payload: string;
    base64: string;
}

export type QRType = 'Static' | 'Dynamic';

// ─── Merchant Account Information (Tag 28 sub-tags) ──────────────────────────

export interface IpsEtAccountInfo {
    /** UUID without hyphens, e.g. "581b314e257f41bfbbdc6384daa31d16" */
    guid: string;
    /** Creditor Institution BIC (8 or 11 chars), e.g. "CBETETAA" */
    bic: string;
    /** Merchant IBAN / Account Number (up to 24 chars) */
    accountNumber: string;
}

// ─── Additional Data Field (Tag 62 sub-tags) ─────────────────────────────────

export interface AdditionalData {
    billNumber?: string;          // 01 – up to 25
    mobileNumber?: string;        // 02 – up to 25
    storeLabel?: string;          // 03 – up to 25
    loyaltyNumber?: string;       // 04 – up to 25
    referenceLabel?: string;      // 05 – up to 25
    customerLabel?: string;       // 06 – up to 25
    terminalLabel?: string;       // 07 – up to 25
    purposeOfTransaction?: string;// 08 – up to 25 (mandatory per EthSwitch)
    additionalCustomerData?: string; // 09 – A/M/E flags
    merchantTaxId?: string;       // 10 – up to 25
    merchantChannel?: string;     // 11 – 3 chars
    dueDate?: string;             // 50 – DDMMYYYY
    amountAfterDueDate?: string;  // 51 – up to 13
}

// ─── Convenience Fee (Tags 55/56/57) ─────────────────────────────────────────

export type ConvenienceFeeType =
    | { type: 'prompt' }                    // 01 – customer enters tip
    | { type: 'fixed'; amount: string }     // 02 – fixed amount in Tag 56
    | { type: 'percentage'; percent: string }; // 03 – % in Tag 57

// ─── Merchant Language Template (Tag 64) ─────────────────────────────────────

export interface MerchantLanguageTemplate {
    languagePreference: string; // e.g. "AM" for Amharic
    alternateMerchantName: string;
    alternateMerchantCity?: string;
}

// ─── Main Options ─────────────────────────────────────────────────────────────

export interface EthioQROptions {
    /** 'Static' (reusable, no amount) or 'Dynamic' (single-use, amount embedded) */
    type: QRType;

    /** IPS ET Merchant Account Info (Tag 28) */
    ipsEtAccount: IpsEtAccountInfo;

    /** Merchant Category Code per ISO 18245 (Tag 52) */
    merchantCategoryCode: string;

    /** Merchant name as registered with acquirer, max 25 chars (Tag 59) */
    merchantName: string;

    /** City of merchant, max 15 chars (Tag 60) */
    merchantCity: string;

    /** Transaction amount – required for Dynamic, omit for Static (Tag 54) */
    amount?: string | number;

    /** Currency code per ISO 4217. Defaults to '230' (ETB) (Tag 53) */
    currencyCode?: string;

    /** Country code per ISO 3166 Alpha-2. Defaults to 'ET' (Tag 58) */
    countryCode?: string;

    /** Optional convenience / tip fee (Tags 55/56/57) */
    convenienceFee?: ConvenienceFeeType;

    /** Optional additional data fields (Tag 62) */
    additionalData?: AdditionalData;

    /** Optional merchant name in alternate/local language (Tag 64) */
    languageTemplate?: MerchantLanguageTemplate;

    /** Optional free-text context of transaction, max 50 chars (Tag 80) */
    transactionContext?: string;

    /** End-to-End ID for Dynamic RTP QRs, 35 chars (Tag 84) */
    endToEndId?: string;

    /** Transaction Type Code (Tag 85) */
    transactionTypeCode?: string;

    /** QR image generation options */
    imageOptions?: QRCode.QRCodeToDataURLOptions;
}

// ─── Decode Result ───────────────────────────────────────────────────────────

export interface DecodeResult {
    /** Fully reconstructed options object — pass straight back into generate() */
    options: Omit<EthioQROptions, 'imageOptions'>;
    /** CRC check: true = payload is intact, false = payload is corrupted */
    crcValid: boolean;
}

// ─── EthioQR Class ────────────────────────────────────────────────────────────

export class EthioQR {

    // ── TLV helpers ──────────────────────────────────────────────────────────

    private static tlv(tag: string, value: string | number | undefined | null): string {
        if (value === undefined || value === null || value === '') return '';
        const v = String(value);
        return `${tag}${String(v.length).padStart(2, '0')}${v}`;
    }

    /** Build a nested TLV container: tag wraps inner TLV string */
    private static tlvContainer(tag: string, inner: string): string {
        if (!inner) return '';
        return EthioQR.tlv(tag, inner);
    }

    // ── CRC-16/CCITT ─────────────────────────────────────────────────────────

    private static crc16(data: string): string {
        let crc = 0xFFFF;
        for (let i = 0; i < data.length; i++) {
            crc ^= data.charCodeAt(i) << 8;
            for (let j = 0; j < 8; j++) {
                crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) : (crc << 1);
            }
        }
        return (crc & 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
    }

    // ── Segment builders ─────────────────────────────────────────────────────

    /** Tag 28 – IPS ET Merchant Account Information */
    private static buildIpsEtMAI(info: IpsEtAccountInfo): string {
        const inner =
            EthioQR.tlv('00', info.guid) +
            EthioQR.tlv('01', info.bic) +
            EthioQR.tlv('02', info.accountNumber);
        return EthioQR.tlvContainer('28', inner);
    }

    /** Tags 55/56/57 – Convenience Fee */
    private static buildConvenienceFee(fee: ConvenienceFeeType): string {
        switch (fee.type) {
            case 'prompt':      return EthioQR.tlv('55', '01');
            case 'fixed':       return EthioQR.tlv('55', '02') + EthioQR.tlv('56', fee.amount);
            case 'percentage':  return EthioQR.tlv('55', '03') + EthioQR.tlv('57', fee.percent);
        }
    }

    /** Tag 62 – Additional Data Field Template */
    private static buildAdditionalData(data: AdditionalData): string {
        const inner =
            EthioQR.tlv('01', data.billNumber) +
            EthioQR.tlv('02', data.mobileNumber) +
            EthioQR.tlv('03', data.storeLabel) +
            EthioQR.tlv('04', data.loyaltyNumber) +
            EthioQR.tlv('05', data.referenceLabel) +
            EthioQR.tlv('06', data.customerLabel) +
            EthioQR.tlv('07', data.terminalLabel) +
            EthioQR.tlv('08', data.purposeOfTransaction) +
            EthioQR.tlv('09', data.additionalCustomerData) +
            EthioQR.tlv('10', data.merchantTaxId) +
            EthioQR.tlv('11', data.merchantChannel) +
            EthioQR.tlv('50', data.dueDate) +
            EthioQR.tlv('51', data.amountAfterDueDate);
        return EthioQR.tlvContainer('62', inner);
    }

    /** Tag 64 – Merchant Information Language Template */
    private static buildLanguageTemplate(tmpl: MerchantLanguageTemplate): string {
        const inner =
            EthioQR.tlv('00', tmpl.languagePreference) +
            EthioQR.tlv('01', tmpl.alternateMerchantName) +
            EthioQR.tlv('02', tmpl.alternateMerchantCity);
        return EthioQR.tlvContainer('64', inner);
    }

    /** Tags 84/85 – Scheme Specific (Dynamic RTP) */
    private static buildSchemeSpecific(endToEndId?: string, ttc?: string): string {
        return EthioQR.tlv('84', endToEndId) + EthioQR.tlv('85', ttc);
    }

    // ── Public API ────────────────────────────────────────────────────────────

    /**
     * Build the raw EMVCo-compliant payload string from options.
     * Handles all tag ordering, length encoding, and CRC automatically.
     */
    public static buildPayload(opts: EthioQROptions): string {
        const poi = opts.type === 'Static' ? '11' : '12';
        const currency = opts.currencyCode ?? '230';
        const country  = opts.countryCode  ?? 'ET';

        let payload =
            EthioQR.tlv('00', '01') +                          // PFI
            EthioQR.tlv('01', poi) +                           // Point of Initiation
            EthioQR.buildIpsEtMAI(opts.ipsEtAccount) +         // Tag 28 – IPS ET MAI
            EthioQR.tlv('52', opts.merchantCategoryCode) +     // MCC
            EthioQR.tlv('53', currency) +                      // Currency
            (opts.amount !== undefined ? EthioQR.tlv('54', opts.amount) : '') + // Amount
            (opts.convenienceFee ? EthioQR.buildConvenienceFee(opts.convenienceFee) : '') +
            EthioQR.tlv('58', country) +                       // Country Code
            EthioQR.tlv('59', String(opts.merchantName).slice(0, 25)) + // Merchant Name
            EthioQR.tlv('60', String(opts.merchantCity).slice(0, 15)) + // Merchant City
            (opts.additionalData ? EthioQR.buildAdditionalData(opts.additionalData) : '') +
            (opts.languageTemplate ? EthioQR.buildLanguageTemplate(opts.languageTemplate) : '') +
            EthioQR.tlv('80', opts.transactionContext) +       // Context of Transaction
            EthioQR.buildSchemeSpecific(opts.endToEndId, opts.transactionTypeCode);

        // Append CRC tag + 4-char checksum
        const withCrcTag = payload + '6304';
        return withCrcTag + EthioQR.crc16(withCrcTag);
    }

    /**
     * Generate a QR code as a Base64 Data URI from options.
     * Returns both the raw payload string and the image data URI.
     */
    public static async generate(opts: EthioQROptions): Promise<QRResult> {
        const payload = EthioQR.buildPayload(opts);

        const imageOpts: QRCode.QRCodeToDataURLOptions = {
            errorCorrectionLevel: 'M',
            margin: 2,
            ...opts.imageOptions,
        };

        try {
            const base64 = await QRCode.toDataURL(payload, imageOpts);
            return { payload, base64 };
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            throw new Error(`Failed to generate QR image: ${msg}`);
        }
    }

    /**
     * Convenience: generate a Static QR (no amount embedded).
     * The customer's app will prompt for the amount at scan time.
     */
    public static async generateStatic(
        opts: Omit<EthioQROptions, 'type' | 'amount'>
    ): Promise<QRResult> {
        return EthioQR.generate({ ...opts, type: 'Static' });
    }

    /**
     * Convenience: generate a Dynamic QR (amount embedded, single-use).
     * Amount is required.
     */
    public static async generateDynamic(
        opts: Omit<EthioQROptions, 'type'> & { amount: string | number }
    ): Promise<QRResult> {
        return EthioQR.generate({ ...opts, type: 'Dynamic' });
    }

    // ── Decoder ───────────────────────────────────────────────────────────────

    /**
     * Parse a flat TLV string into a Map<tag, value>.
     * Each entry is: 2-char tag | 2-char decimal length | value
     */
    private static parseTLV(data: string): Map<string, string> {
        const map = new Map<string, string>();
        let i = 0;
        while (i < data.length) {
            if (i + 4 > data.length) break;
            const tag = data.slice(i, i + 2);
            const len = parseInt(data.slice(i + 2, i + 4), 10);
            if (isNaN(len)) break;
            const value = data.slice(i + 4, i + 4 + len);
            map.set(tag, value);
            i += 4 + len;
        }
        return map;
    }

    /**
     * Decode a raw EMVCo payload string back into an EthioQROptions object.
     *
     * @param payload - The raw QR payload string (e.g. from `result.payload`)
     * @returns DecodeResult with reconstructed options and a CRC validity flag
     * @throws if the payload is missing required tags (00, 28, 52, 59, 60)
     *
     * @example
     * const { options, crcValid } = EthioQR.decode(result.payload);
     * console.log(options.merchantName); // "My Shop"
     * console.log(crcValid);             // true
     */
    public static decode(payload: string): DecodeResult {

        // ── CRC validation ───────────────────────────────────────────────────
        // Last 4 chars are the CRC value; everything before (incl. "6304") is checked
        const crcValue    = payload.slice(-4);
        const crcBody     = payload.slice(0, -4);
        const crcValid    = EthioQR.crc16(crcBody) === crcValue;

        // Strip the trailing CRC tag+value before parsing
        const body = payload.slice(0, payload.lastIndexOf('6304'));
        const root = EthioQR.parseTLV(body);

        // ── Tag 00 – Payload Format Indicator ────────────────────────────────
        if (!root.has('00')) throw new Error('Invalid payload: missing Tag 00 (PFI)');

        // ── Tag 01 – Point of Initiation ─────────────────────────────────────
        const poi  = root.get('01');
        const type: QRType = poi === '12' ? 'Dynamic' : 'Static';

        // ── Tag 28 – IPS ET Merchant Account Information ──────────────────────
        const mai28 = root.get('28');
        if (!mai28) throw new Error('Invalid payload: missing Tag 28 (IPS ET MAI)');
        const maiTags = EthioQR.parseTLV(mai28);
        const ipsEtAccount: IpsEtAccountInfo = {
            guid:          maiTags.get('00') ?? '',
            bic:           maiTags.get('01') ?? '',
            accountNumber: maiTags.get('02') ?? '',
        };

        // ── Tag 52 – MCC ──────────────────────────────────────────────────────
        const merchantCategoryCode = root.get('52');
        if (!merchantCategoryCode) throw new Error('Invalid payload: missing Tag 52 (MCC)');

        // ── Tag 53 – Currency ─────────────────────────────────────────────────
        const currencyCode = root.get('53');

        // ── Tag 54 – Amount ───────────────────────────────────────────────────
        const amountRaw = root.get('54');
        const amount    = amountRaw !== undefined ? amountRaw : undefined;

        // ── Tags 55/56/57 – Convenience Fee ──────────────────────────────────
        let convenienceFee: ConvenienceFeeType | undefined;
        const feeIndicator = root.get('55');
        if (feeIndicator === '01') {
            convenienceFee = { type: 'prompt' };
        } else if (feeIndicator === '02') {
            convenienceFee = { type: 'fixed', amount: root.get('56') ?? '' };
        } else if (feeIndicator === '03') {
            convenienceFee = { type: 'percentage', percent: root.get('57') ?? '' };
        }

        // ── Tag 58 – Country Code ─────────────────────────────────────────────
        const countryCode = root.get('58');

        // ── Tag 59 – Merchant Name ────────────────────────────────────────────
        const merchantName = root.get('59');
        if (!merchantName) throw new Error('Invalid payload: missing Tag 59 (Merchant Name)');

        // ── Tag 60 – Merchant City ────────────────────────────────────────────
        const merchantCity = root.get('60');
        if (!merchantCity) throw new Error('Invalid payload: missing Tag 60 (Merchant City)');

        // ── Tag 62 – Additional Data Field ────────────────────────────────────
        let additionalData: AdditionalData | undefined;
        const raw62 = root.get('62');
        if (raw62) {
            const t62 = EthioQR.parseTLV(raw62);
            const pick = (k: string) => t62.get(k) || undefined;
            additionalData = {
                billNumber:             pick('01'),
                mobileNumber:           pick('02'),
                storeLabel:             pick('03'),
                loyaltyNumber:          pick('04'),
                referenceLabel:         pick('05'),
                customerLabel:          pick('06'),
                terminalLabel:          pick('07'),
                purposeOfTransaction:   pick('08'),
                additionalCustomerData: pick('09'),
                merchantTaxId:          pick('10'),
                merchantChannel:        pick('11'),
                dueDate:                pick('50'),
                amountAfterDueDate:     pick('51'),
            };
            // Drop the object entirely if every field is undefined
            if (Object.values(additionalData).every(v => v === undefined)) {
                additionalData = undefined;
            }
        }

        // ── Tag 64 – Language Template ────────────────────────────────────────
        let languageTemplate: MerchantLanguageTemplate | undefined;
        const raw64 = root.get('64');
        if (raw64) {
            const t64 = EthioQR.parseTLV(raw64);
            languageTemplate = {
                languagePreference:    t64.get('00') ?? '',
                alternateMerchantName: t64.get('01') ?? '',
                alternateMerchantCity: t64.get('02') || undefined,
            };
        }

        // ── Tag 80 – Transaction Context ──────────────────────────────────────
        const transactionContext = root.get('80') || undefined;

        // ── Tags 84/85 – Scheme Specific ─────────────────────────────────────
        const endToEndId          = root.get('84') || undefined;
        const transactionTypeCode = root.get('85') || undefined;

        // ── Assemble result ───────────────────────────────────────────────────
        const options: Omit<EthioQROptions, 'imageOptions'> = {
            type,
            ipsEtAccount,
            merchantCategoryCode,
            merchantName,
            merchantCity,
            ...(amount        !== undefined && { amount }),
            ...(currencyCode  !== undefined && { currencyCode }),
            ...(countryCode   !== undefined && { countryCode }),
            ...(convenienceFee   && { convenienceFee }),
            ...(additionalData   && { additionalData }),
            ...(languageTemplate && { languageTemplate }),
            ...(transactionContext   && { transactionContext }),
            ...(endToEndId           && { endToEndId }),
            ...(transactionTypeCode  && { transactionTypeCode }),
        };

        return { options, crcValid };
    }
}
