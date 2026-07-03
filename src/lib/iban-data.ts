// ============================================================
// IBAN DATA — Real bank codes per country + generation logic
// ============================================================

export interface IbanCountry {
  code: string
  label: string
  flag: string
  length: number
  bbanFormat: string
  bankCodes: string[]  // REAL bank identification codes (SWIFT-recognizable)
}

// BBAN format keys: a=alpha (A-Z), n=numeric (0-9), c=alphanumeric
// Sorted alphabetically by label
export const IBAN_COUNTRIES: IbanCountry[] = [
  // ── A ──
  { code: 'AL', label: 'Albania',              flag: '🇦🇱', length: 28, bbanFormat: '8n,16c',
    bankCodes: ['13110010','13110020','13110030','13110040','13110050','13111000','13112000','13113000','13114000','13115000'] },
  { code: 'DE', label: 'Alemania',             flag: '🇩🇪', length: 22, bbanFormat: '8n,10n',
    bankCodes: ['10010010','20040000','37040044','50010517','30050000','60050101','66010075','50060400','37050198','10070024'] },
  { code: 'AD', label: 'Andorra',              flag: '🇦🇩', length: 20, bbanFormat: '4n,4n,12c',
    bankCodes: ['0001','0002','0003','0004','0005','0006','0008','2013','2015','2030'] },
  { code: 'AE', label: 'Emiratos Árabes',      flag: '🇦🇪', length: 23, bbanFormat: '3n,16n',
    bankCodes: ['001','002','003','004','006','007','008','009','010','011'] },
  { code: 'SA', label: 'Arabia Saudita',       flag: '🇸🇦', length: 24, bbanFormat: '2n,18c',
    bankCodes: ['10','11','12','14','15','16','17','18','19','20'] },
  { code: 'AZ', label: 'Azerbaiyán',           flag: '🇦🇿', length: 28, bbanFormat: '4a,20c',
    bankCodes: ['BAVA','IBAZ','UNIB','VTBB','ABNA','CAPB','EUBA','MILB','PAVA','RABO'] },
  { code: 'AT', label: 'Austria',              flag: '🇦🇹', length: 20, bbanFormat: '5n,11n',
    bankCodes: ['12000','20111','36260','11000','16000','20400','15000','43000','48600','20310'] },

  // ── B ──
  { code: 'BA', label: 'Bosnia',               flag: '🇧🇦', length: 20, bbanFormat: '3n,3n,8n,2n',
    bankCodes: ['110','111','112','113','115','116','117','118','119','120'] },
  { code: 'BE', label: 'Bélgica',              flag: '🇧🇪', length: 16, bbanFormat: '3n,7n,2n',
    bankCodes: ['000','001','002','310','340','360','380','290','030','096'] },
  { code: 'BG', label: 'Bulgaria',             flag: '🇧🇬', length: 22, bbanFormat: '4a,6n,8c',
    bankCodes: ['BACB','BNBG','BPBI','BUBG','CCBA','FINV','GENB','PRIB','RZBB','SOMB'] },
  { code: 'BH', label: 'Baréin',               flag: '🇧🇭', length: 22, bbanFormat: '4a,14c',
    bankCodes: ['BKME','BBME','BMIH','CITI','HBMB','NBOB','SHAB','UBAB','ABNB','BKBM'] },
  { code: 'BY', label: 'Bielorrusia',          flag: '🇧🇾', length: 28, bbanFormat: '4c,20c',
    bankCodes: ['AKBB','ALFA','BELB','BPSB','BVVA','BWPB','CENA','DABR','DSBB','FTBB'] },
  { code: 'BR', label: 'Brasil',               flag: '🇧🇷', length: 29, bbanFormat: '8n,5n,10n,1a,1c',
    bankCodes: ['00000000','00000001','00000002','00000003','00000004','00000007','00000008','00000009','00000010','00000012'] },

  // ── C ──
  { code: 'CR', label: 'Costa Rica',           flag: '🇨🇷', length: 22, bbanFormat: '4n,14n',
    bankCodes: ['0001','0002','0003','0004','0005','0006','0007','0014','0015','0016'] },
  { code: 'HR', label: 'Croacia',              flag: '🇭🇷', length: 21, bbanFormat: '7n,10n',
    bankCodes: ['2380006','2484008','1001005','2360000','2423006','2500009','2524000','2600005','2614000','2340009'] },
  { code: 'CY', label: 'Chipre',               flag: '🇨🇾', length: 28, bbanFormat: '3n,5n,16c',
    bankCodes: ['002','008','010','011','012','013','014','015','016','017'] },
  { code: 'CZ', label: 'Rep. Checa',           flag: '🇨🇿', length: 24, bbanFormat: '4n,6n,10n',
    bankCodes: ['0100','0300','0600','0800','2010','2700','5500','0200','0210','0220'] },

  // ── D ──
  { code: 'DK', label: 'Dinamarca',            flag: '🇩🇰', length: 18, bbanFormat: '4n,9n,1n',
    bankCodes: ['0286','1550','3000','3005','0186','2190','0300','0400','0500','0600'] },
  { code: 'DO', label: 'Rep. Dominicana',      flag: '🇩🇴', length: 28, bbanFormat: '4c,20n',
    bankCodes: ['BAGR','BHDV','BICR','BNCN','BPEP','BPDR','BPOP','BPRO','BRDR','BSCH'] },

  // ── E ──
  { code: 'EC', label: 'Ecuador (X)',          flag: '🇪🇨', length: 0, bbanFormat: '',
    bankCodes: [] },
  { code: 'SK', label: 'Eslovaquia',           flag: '🇸🇰', length: 24, bbanFormat: '4n,6n,10n',
    bankCodes: ['0200','1100','0900','1111','3000','3100','5600','8180','8370','8100'] },
  { code: 'SI', label: 'Eslovenia',            flag: '🇸🇮', length: 19, bbanFormat: '5n,8n,2n',
    bankCodes: ['01000','02010','02900','04000','05000','05100','06000','07000','03000','01200'] },
  { code: 'ES', label: 'España',               flag: '🇪🇸', length: 24, bbanFormat: '4n,4n,1n,1n,10n',
    bankCodes: ['2100','0049','0182','0081','0128','0073','0030','0061','0487','0239'] },
  { code: 'EE', label: 'Estonia',              flag: '🇪🇪', length: 20, bbanFormat: '2n,2n,11n,1n',
    bankCodes: ['10','11','12','14','16','17','22','33','42','55'] },

  // ── F ──
  { code: 'FO', label: 'Islas Feroe',          flag: '🇫🇴', length: 18, bbanFormat: '4n,9n,1n',
    bankCodes: ['6460','9906','9901','9902','9903','9904','9905','9907','9908','9909'] },
  { code: 'FI', label: 'Finlandia',            flag: '🇫🇮', length: 18, bbanFormat: '3n,11n',
    bankCodes: ['101','105','800','375','379','405','497','571','413','529'] },
  { code: 'FR', label: 'Francia',              flag: '🇫🇷', length: 27, bbanFormat: '5n,5n,11n,2n',
    bankCodes: ['30004','30002','30003','18907','10278','30007','18707','15589','10057','11428'] },

  // ── G ──
  { code: 'GE', label: 'Georgia',              flag: '🇬🇪', length: 22, bbanFormat: '2a,16n',
    bankCodes: ['BA','BG','BK','BN','BS','BT','CB','CG','CP','EB'] },
  { code: 'GI', label: 'Gibraltar',            flag: '🇬🇮', length: 23, bbanFormat: '4a,15c',
    bankCodes: ['NATG','BARC','CHAS','CITI','DEUT','HSBC','LLOY','SANT','SCHO','TRIO'] },
  { code: 'GR', label: 'Grecia',               flag: '🇬🇷', length: 27, bbanFormat: '3n,4n,16c',
    bankCodes: ['011','014','016','017','026','032','048','056','057','061'] },
  { code: 'GL', label: 'Groenlandia',          flag: '🇬🇱', length: 18, bbanFormat: '4n,9n,1n',
    bankCodes: ['6471','9901','9902','9903','9904','9905','9906','9907','9908','9909'] },
  { code: 'GT', label: 'Guatemala',            flag: '🇬🇹', length: 28, bbanFormat: '4c,20c',
    bankCodes: ['AGGT','BICT','BCGT','BNOR','BRGT','CIBG','CITI','HSBC','INTE','PRGT'] },
  { code: 'GB', label: 'Reino Unido',          flag: '🇬🇧', length: 22, bbanFormat: '4a,6n,8n',
    bankCodes: ['BARC','NWBK','HBUK','LLOY','MIDL','RBSG','COBA','BOFS','SRLY','CLYD'] },

  // ── H ──
  { code: 'HU', label: 'Hungría',              flag: '🇭🇺', length: 28, bbanFormat: '3n,4n,1n,15n,1n',
    bankCodes: ['100','101','102','103','104','105','107','108','109','110'] },

  // ── I ──
  { code: 'IS', label: 'Islandia',             flag: '🇮🇸', length: 26, bbanFormat: '4n,6n,10n',
    bankCodes: ['0001','0002','0003','0004','0005','0014','0015','0019','0031','0032'] },
  { code: 'IE', label: 'Irlanda',              flag: '🇮🇪', length: 22, bbanFormat: '4a,6n,8n',
    bankCodes: ['AIBK','BOFI','CITI','PTSB','ULSB','TSBC','BOFS','SREL','CIRD','NWBG'] },
  { code: 'IL', label: 'Israel',               flag: '🇮🇱', length: 23, bbanFormat: '3n,3n,13n',
    bankCodes: ['010','011','012','013','014','016','017','018','019','020'] },
  { code: 'IT', label: 'Italia',               flag: '🇮🇹', length: 27, bbanFormat: '1a,5n,5n,12c',
    bankCodes: ['01005','02008','03069','05034','05428','08327','03268','05387','01015','02015'] },

  // ── J ──
  { code: 'JO', label: 'Jordania',             flag: '🇯🇴', length: 30, bbanFormat: '4a,4n,18c',
    bankCodes: ['ABJO','ARBJ','CBJO','CITI','HBHO','JOMB','NBOJ','SBAJ','UBOJ','HAJO'] },

  // ── K ──
  { code: 'XK', label: 'Kosovo',               flag: '🇽🇰', length: 20, bbanFormat: '4n,10n,2n',
    bankCodes: ['1010','1012','1014','1020','1030','1040','1050','1060','1070','1080'] },
  { code: 'KW', label: 'Kuwait',               flag: '🇰🇼', length: 30, bbanFormat: '4a,22c',
    bankCodes: ['NBOK','BKME','ABNK','BOFK','CBKU','CITI','GULF','HBKU','KFH','NBKU'] },
  { code: 'KZ', label: 'Kazajistán',           flag: '🇰🇿', length: 20, bbanFormat: '3n,13c',
    bankCodes: ['125','187','188','190','191','192','193','194','195','196'] },

  // ── L ──
  { code: 'LV', label: 'Letonia',              flag: '🇱🇻', length: 21, bbanFormat: '4a,13c',
    bankCodes: ['PARX','RNCB','HABA','LATX','RIK0','AIZL','BLBB','CITI','DABA','DIRL'] },
  { code: 'LB', label: 'Líbano',               flag: '🇱🇧', length: 28, bbanFormat: '4n,20c',
    bankCodes: ['0001','0006','0007','0009','0010','0011','0012','0013','0015','0016'] },
  { code: 'LI', label: 'Liechtenstein',        flag: '🇱🇮', length: 21, bbanFormat: '5n,12c',
    bankCodes: ['00762','00275','09000','00483','08790','08800','08810','08820','08830','08840'] },
  { code: 'LT', label: 'Lituania',             flag: '🇱🇹', length: 20, bbanFormat: '5n,11n',
    bankCodes: ['10000','10100','10200','10300','10400','10600','10700','11000','11200','11400'] },
  { code: 'LU', label: 'Luxemburgo',           flag: '🇱🇺', length: 20, bbanFormat: '3n,13c',
    bankCodes: ['001','002','003','005','008','009','011','014','015','019'] },

  // ── M ──
  { code: 'MK', label: 'Macedonia del Norte',  flag: '🇲🇰', length: 19, bbanFormat: '3n,10n,2n',
    bankCodes: ['100','105','110','115','120','125','130','135','140','145'] },
  { code: 'MT', label: 'Malta',                flag: '🇲🇹', length: 31, bbanFormat: '4a,5n,18c',
    bankCodes: ['VALL','HSBC','BOVL','BNPL','LHBI','MABS','FIMB','MEDB','BZMI','EBIL'] },
  { code: 'MA', label: 'Marruecos (X)',        flag: '🇲🇦', length: 0, bbanFormat: '',
    bankCodes: [] },
  { code: 'MC', label: 'Mónaco',               flag: '🇲🇨', length: 27, bbanFormat: '5n,5n,11n,2n',
    bankCodes: ['30004','30002','30003','18907','30007','30006','10057','11428','13827','16606'] },
  { code: 'MD', label: 'Moldavia',             flag: '🇲🇩', length: 24, bbanFormat: '2c,18c',
    bankCodes: ['AC','AE','AG','BC','BE','BF','BG','BI','BK','BL'] },
  { code: 'ME', label: 'Montenegro',           flag: '🇲🇪', length: 22, bbanFormat: '3n,13n,2n',
    bankCodes: ['100','105','107','110','115','120','125','130','135','140'] },
  { code: 'MU', label: 'Mauricio',             flag: '🇲🇺', length: 30, bbanFormat: '4a,2n,2n,12n,3n,3a',
    bankCodes: ['BOMM','MCBL','SBMC','BQIB','HSBC','STCB','BARC','DEUT','CITI','SAMP'] },
  { code: 'MR', label: 'Mauritania',           flag: '🇲🇷', length: 27, bbanFormat: '5n,5n,11n,2n',
    bankCodes: ['00010','00020','00030','00040','00050','00060','00070','00080','00090','00100'] },

  // ── N ──
  { code: 'NO', label: 'Noruega',              flag: '🇳🇴', length: 15, bbanFormat: '4n,6n,1n',
    bankCodes: ['8601','3420','5003','3000','5050','7640','5080','8047','5103','8105'] },

  // ── P ──
  { code: 'NL', label: 'Países Bajos',         flag: '🇳🇱', length: 18, bbanFormat: '4a,10n',
    bankCodes: ['INGB','ABNA','RABO','SNSB','FVLB','ASNB','BNDA','TRIO','KABA','BUNQ'] },
  { code: 'PK', label: 'Pakistán',             flag: '🇵🇰', length: 24, bbanFormat: '4a,16c',
    bankCodes: ['ABBL','AUBK','BAHL','BKCH','BLFL','BMAP','BOFA','CITI','DEUT','HABB'] },
  { code: 'PS', label: 'Palestina',            flag: '🇵🇸', length: 29, bbanFormat: '4a,21c',
    bankCodes: ['PALS','BOPC','ARAB','NATP','CITI','HBHO','ALRP','AQBP','BOMA','BABP'] },
  { code: 'PL', label: 'Polonia',              flag: '🇵🇱', length: 28, bbanFormat: '8n,16n',
    bankCodes: ['10105000','10204005','10500000','10600005','10800027','10900003','11000036','11400000','11600000','12400000'] },
  { code: 'PT', label: 'Portugal',             flag: '🇵🇹', length: 25, bbanFormat: '4n,4n,11n,2n',
    bankCodes: ['0007','0018','0023','0027','0033','0034','0045','0123','0193','0269'] },

  // ── Q ──
  { code: 'QA', label: 'Qatar',                flag: '🇶🇦', length: 29, bbanFormat: '4a,21c',
    bankCodes: ['DOHB','QNBA','CBQA','AHBB','ABQA','BKME','BARC','CITI','HSBC','MIDO'] },

  // ── R ──
  { code: 'RO', label: 'Rumania',              flag: '🇷🇴', length: 24, bbanFormat: '4a,16c',
    bankCodes: ['BACX','BPOS','BRDE','BTRL','CECR','INGB','RNCB','BCRL','CITI','ARBN'] },
  { code: 'RS', label: 'Serbia',               flag: '🇷🇸', length: 22, bbanFormat: '3n,13n,2n',
    bankCodes: ['115','160','170','190','200','205','210','220','265','285'] },

  // ── S ──
  { code: 'SM', label: 'San Marino',           flag: '🇸🇲', length: 27, bbanFormat: '3n,5n,12c',
    bankCodes: ['01005','02008','03069','03268','05034','05428','08327','02015','01015','05387'] },
  { code: 'SC', label: 'Seychelles',           flag: '🇸🇨', length: 31, bbanFormat: '4a,2n,2n,16n,3a',
    bankCodes: ['SBSC','BARC','HABS','NOVN','SSPB','ABSS','BMSS','CABS','DEUT','STBS'] },
  { code: 'CH', label: 'Suiza',                flag: '🇨🇭', length: 21, bbanFormat: '5n,12c',
    bankCodes: ['00762','00275','09000','00483','00771','00630','00787','00830','00248','02770'] },
  { code: 'SE', label: 'Suecia',               flag: '🇸🇪', length: 24, bbanFormat: '3n,16n,1n',
    bankCodes: ['500','600','800','900','300','950','910','915','923','926'] },

  // ── T ──
  { code: 'TL', label: 'Timor Oriental',       flag: '🇹🇱', length: 23, bbanFormat: '3n,14n,2n',
    bankCodes: ['001','002','003','004','005','006','007','008','009','010'] },
  { code: 'TN', label: 'Túnez',                flag: '🇹🇳', length: 24, bbanFormat: '2n,3n,13n,2n',
    bankCodes: ['10','11','12','13','14','16','17','18','19','20'] },
  { code: 'TR', label: 'Turquía',              flag: '🇹🇷', length: 26, bbanFormat: '5n,1n,16c',
    bankCodes: ['00010','00012','00100','00101','00102','00105','00106','00109','00111','00120'] },

  // ── U ──
  { code: 'UA', label: 'Ucrania',              flag: '🇺🇦', length: 29, bbanFormat: '2a,6n,19c',
    bankCodes: ['PBAN','CITI','DEUT','EABJ','EXBS','HABK','ISAE','MEBV','MPLT','OTPV'] },

  // ── V ──
  { code: 'VA', label: 'Ciudad del Vaticano',  flag: '🇻🇦', length: 22, bbanFormat: '3n,15n',
    bankCodes: ['010','011','012','013','014','015','016','017','018','019'] },
  { code: 'VG', label: 'Islas Vírgenes Brit.', flag: '🇻🇬', length: 24, bbanFormat: '4a,16n',
    bankCodes: ['VPBV','VBBV','CITI','BARC','HBUK','DEUT','BOFA','CHAS','HSBC','SCHN'] },
].filter(c => c.length > 0) // Remove placeholder entries

// ============================================================
// PARSE & RANDOM HELPERS
// ============================================================

interface BbanSegment { count: number; type: 'a' | 'n' | 'c' }

function parseBbanFormat(fmt: string): BbanSegment[] {
  return fmt.split(',').map(part => {
    const match = part.trim().match(/^(\d+)([anc])$/)
    if (!match) return { count: 0, type: 'n' as const }
    return { count: parseInt(match[1], 10), type: match[2] as 'a' | 'n' | 'c' }
  })
}

function randomChars(type: 'a' | 'n' | 'c', count: number): string {
  let result = ''
  for (let i = 0; i < count; i++) {
    if (type === 'n') {
      result += Math.floor(Math.random() * 10).toString()
    } else if (type === 'a') {
      result += String.fromCharCode(65 + Math.floor(Math.random() * 26))
    } else {
      // For 'c' (alphanumeric): mostly numeric, some alpha
      if (Math.random() < 0.75) {
        result += Math.floor(Math.random() * 10).toString()
      } else {
        result += String.fromCharCode(65 + Math.floor(Math.random() * 26))
      }
    }
  }
  return result
}

// ============================================================
// COUNTRY-SPECIFIC INTERNAL CHECK DIGITS
// ============================================================

// ── Spain (ES): 4n bank, 4n branch, 1n DC1, 1n DC2, 10n account ──
// DC1 is computed from (bank+branch) padded to 10 digits with "00"
// DC2 is computed from the 10-digit account number
// Weights: [1, 2, 4, 8, 5, 10, 9, 7, 3, 6]
function computeSpanishDC(digits10: string): number {
  const weights = [1, 2, 4, 8, 5, 10, 9, 7, 3, 6]
  let sum = 0
  for (let i = 0; i < 10; i++) {
    sum += parseInt(digits10[i]) * weights[i]
  }
  const dc = 11 - (sum % 11)
  if (dc === 10) return 1
  if (dc === 11) return 0
  return dc
}

function generateSpanishBBAN(bankCode: string): string {
  const branch = randomChars('n', 4)
  const account = randomChars('n', 10)
  // DC1: pad bank+branch (8 digits) with "00" to get 10 digits
  const dc1 = computeSpanishDC((bankCode + branch).padEnd(10, '0'))
  // DC2: use only the 10-digit account number
  const dc2 = computeSpanishDC(account)
  return `${bankCode}${branch}${dc1}${dc2}${account}`
}

// ── Italy (IT): 1a CIN, 5n ABI, 5n CAB, 12c account ──
// CIN is computed from ABI(5) + CAB(5) + account(12) = 22 chars
// Positions are 0-indexed; even positions (1-indexed) multiply by 2
// BUG FIX: for doubled values >= 20, must sum digits (e.g., 42→4+2=6), NOT subtract 9
function computeItalianCIN(abi: string, cab: string, account: string): string {
  const s = abi + cab + account // 22 chars
  let sum = 0
  for (let i = 0; i < s.length; i++) {
    const ch = s[i].toUpperCase()
    let val: number
    if (ch >= '0' && ch <= '9') {
      val = parseInt(ch)
    } else {
      val = ch.charCodeAt(0) - 65 // A=0, B=1, ..., Z=25
    }
    if (i % 2 === 1) {
      // even position (1-indexed) — multiply by 2
      val *= 2
      if (val > 9) {
        // Sum digits: e.g., 42 → 6, 24 → 6, 18 → 9, 16 → 7
        val = Math.floor(val / 10) + (val % 10)
      }
    }
    sum += val
  }
  const cinVal = (10 - (sum % 10)) % 10
  return String.fromCharCode(65 + cinVal) // 0→A, 1→B, ..., 9→J
}

function generateItalianBBAN(abiCode: string): string {
  const cab = randomChars('n', 5)
  // Italian account: 12 alphanumeric, but mostly numeric
  const account = randomChars('c', 12).toUpperCase()
  const cin = computeItalianCIN(abiCode, cab, account)
  return `${cin}${abiCode}${cab}${account}`
}

// ── France (FR) & Monaco (MC): 5n bank, 5n branch, 11n account, 2n RIB key ──
// BUG FIX: removed erroneous * 100n from RIB formula
// Correct formula: K = (97 - (89*B + 15*G + 3*C) mod 97) mod 97
function computeFrenchRIB(bank: string, branch: string, account: string): string {
  const bankNum = BigInt(parseInt(bank))
  const branchNum = BigInt(parseInt(branch))
  // Account is numeric in our case (11 digits), no letter conversion needed
  const accountNum = BigInt(account)
  const weightedSum = bankNum * BigInt(89) + branchNum * BigInt(15) + accountNum * BigInt(3)
  const remainder = weightedSum % BigInt(97)
  const ribKey = (BigInt(97) - remainder) % BigInt(97)
  return ribKey.toString().padStart(2, '0')
}

function generateFrenchBBAN(bankCode: string): string {
  const branch = randomChars('n', 5)
  const account = randomChars('n', 11)
  const ribKey = computeFrenchRIB(bankCode, branch, account)
  return `${bankCode}${branch}${account}${ribKey}`
}

// ── Portugal (PT): 4n bank, 4n branch, 11n account, 2n check ──
// BUG FIX: Correct formula is check = (98 - ((W%97)*3%97)) % 97
// This ensures the NIB mod 97 == 1
function computePortugueseCheck(bank: string, branch: string, account: string): string {
  const weights = [73, 17, 89, 38, 62, 45, 53, 15, 50, 5, 49, 34, 81, 76, 27, 90, 9, 30, 3]
  const digits = bank + branch + account // 19 chars
  let w = 0
  for (let i = 0; i < 19; i++) {
    w += parseInt(digits[i]) * weights[i]
  }
  const r = w % 97
  const check = (98 - ((r * 3) % 97)) % 97
  return check.toString().padStart(2, '0')
}

function generatePortugueseBBAN(bankCode: string): string {
  const branch = randomChars('n', 4)
  const account = randomChars('n', 11)
  const check = computePortugueseCheck(bankCode, branch, account)
  return `${bankCode}${branch}${account}${check}`
}

// ============================================================
// GENERIC BBAN GENERATION (for all other countries)
// Uses real bank code for first segment, random for the rest
// IBAN MOD-97 handles final validation
// ============================================================

function generateGenericBBAN(country: IbanCountry): string {
  const parts = parseBbanFormat(country.bbanFormat)
  const bankCode = country.bankCodes[Math.floor(Math.random() * country.bankCodes.length)]
  let result = ''
  for (let i = 0; i < parts.length; i++) {
    if (i === 0) {
      result += bankCode
    } else {
      result += randomChars(parts[i].type, parts[i].count)
    }
  }
  return result
}

// ============================================================
// MAIN BBAN GENERATOR (routes to country-specific logic)
// ============================================================

function generateBban(country: IbanCountry): string {
  const bankCode = country.bankCodes[Math.floor(Math.random() * country.bankCodes.length)]
  switch (country.code) {
    case 'ES': return generateSpanishBBAN(bankCode)
    case 'IT': return generateItalianBBAN(bankCode)
    case 'FR': return generateFrenchBBAN(bankCode)
    case 'MC': return generateFrenchBBAN(bankCode) // Monaco uses French RIB
    case 'PT': return generatePortugueseBBAN(bankCode)
    default: return generateGenericBBAN(country)
  }
}

// ============================================================
// IBAN CHECK DIGITS (MOD-97)
// ============================================================

function calculateIbanCheckDigits(countryCode: string, bban: string): string {
  const rearranged = (bban + countryCode + '00').toUpperCase()
  const numeric = rearranged.split('').map(ch => {
    const code = ch.charCodeAt(0)
    if (code >= 65 && code <= 90) return String(code - 55) // A=10
    return ch
  }).join('')
  const remainder = BigInt(numeric) % BigInt(97)
  const check = 98 - Number(remainder)
  return String(check).padStart(2, '0')
}

// ============================================================
// EXPORTED FUNCTIONS
// ============================================================

export function generateIban(country: IbanCountry): string {
  const bban = generateBban(country)
  const checkDigits = calculateIbanCheckDigits(country.code, bban)
  return `${country.code}${checkDigits}${bban}`
}

export function formatIban(iban: string): string {
  return iban.replace(/(.{4})/g, '$1 ').trim()
}