// ============================================================
// IBAN DATA — Real bank codes per country + generation logic
// ============================================================

export interface IbanCountry {
  code: string
  label: string
  flag: string
  length: number
  bbanFormat: string
  bankCodes: string[]  // REAL bank identification codes
}

// BBAN format keys: a=alpha (A-Z), n=numeric (0-9), c=alphanumeric
export const IBAN_COUNTRIES: IbanCountry[] = [
  // ── Western Europe ──
  { code: 'ES', label: 'España',              flag: '🇪🇸', length: 24, bbanFormat: '4n,4n,1n,1n,10n',
    bankCodes: ['2100','0049','0182','0081','0128','0073','0030','0061','0487','0239','0195','0156','0165','0122','0065'] },
  { code: 'DE', label: 'Alemania',             flag: '🇩🇪', length: 22, bbanFormat: '8n,10n',
    bankCodes: ['10010010','20040000','37040044','50010517','30050000','60050101','66010075','50060400','37050198','10070024','66650085','86040000','10040000','29040010','66020090'] },
  { code: 'FR', label: 'Francia',              flag: '🇫🇷', length: 27, bbanFormat: '5n,5n,11n,2n',
    bankCodes: ['30004','30002','30003','18907','10278','30007','18707','15589','10057','11428','16606','30006','18315','13827','10268'] },
  { code: 'GB', label: 'Reino Unido',          flag: '🇬🇧', length: 22, bbanFormat: '4a,6n,8n',
    bankCodes: ['BARC','NWBK','HBUK','LLOY','MIDL','RBSG','COBA','BOFS','SRLY','CLYD','PRTL','BARC','NWBK','HBUK','SRLY'] },
  { code: 'IT', label: 'Italia',               flag: '🇮🇹', length: 27, bbanFormat: '1a,5n,5n,12c',
    bankCodes: ['01005','02008','03069','05034','05428','08327','03268','05387','01015','02015','05692','06045','08024','08421','02001'] },
  { code: 'PT', label: 'Portugal',             flag: '🇵🇹', length: 25, bbanFormat: '4n,4n,11n,2n',
    bankCodes: ['0007','0018','0023','0027','0033','0034','0045','0123','0193','0269','0019','0012','0036','0035','0008'] },
  { code: 'NL', label: 'Países Bajos',         flag: '🇳🇱', length: 18, bbanFormat: '4a,10n',
    bankCodes: ['INGB','ABNA','RABO','SNSB','FVLB','ASNB','BNDA','TRIO','KABA','BUNQ','INGB','RABO','ABNA','RABO','INGB'] },
  { code: 'BE', label: 'Bélgica',              flag: '🇧🇪', length: 16, bbanFormat: '3n,7n,2n',
    bankCodes: ['000','001','002','310','340','360','380','290','030','096','539','090','330','979','510'] },
  { code: 'CH', label: 'Suiza',                flag: '🇨🇭', length: 21, bbanFormat: '5n,12c',
    bankCodes: ['00762','00275','09000','00483','00771','00630','00787','00830','00248','02770','08790','09999','00762','00275','00483'] },
  { code: 'AT', label: 'Austria',              flag: '🇦🇹', length: 20, bbanFormat: '5n,11n',
    bankCodes: ['12000','20111','36260','11000','16000','20400','15000','43000','48600','20310','60000','54000','12000','20111','36260'] },
  { code: 'IE', label: 'Irlanda',              flag: '🇮🇪', length: 22, bbanFormat: '4a,6n,8n',
    bankCodes: ['AIBK','BOFI','CITI','PTSB','ULSB','TSBC','BOFS','SREL','CIRD','NWBG','IPBS','PFSB','AIBK','BOFI','CITI'] },
  { code: 'LU', label: 'Luxemburgo',           flag: '🇱🇺', length: 20, bbanFormat: '3n,13c',
    bankCodes: ['001','002','003','005','008','009','011','014','015','019','021','028','039','049','050'] },

  // ── Nordic ──
  { code: 'SE', label: 'Suecia',               flag: '🇸🇪', length: 24, bbanFormat: '3n,16n,1n',
    bankCodes: ['500','600','800','900','300','950','910','915','923','926','940','946','990','500','600'] },
  { code: 'NO', label: 'Noruega',              flag: '🇳🇴', length: 15, bbanFormat: '4n,6n,1n',
    bankCodes: ['8601','3420','5003','3000','5050','7640','5080','8047','5103','8105','4640','5500','8601','3420','5003'] },
  { code: 'DK', label: 'Dinamarca',            flag: '🇩🇰', length: 18, bbanFormat: '4n,9n,1n',
    bankCodes: ['0286','1550','3000','3005','0186','2190','0300','0400','0500','0600','0900','1500','2010','2490','6100'] },
  { code: 'FI', label: 'Finlandia',            flag: '🇫🇮', length: 18, bbanFormat: '3n,11n',
    bankCodes: ['101','105','800','375','379','405','497','571','413','529','834','401','554','471','101'] },
  { code: 'IS', label: 'Islandia',             flag: '🇮🇸', length: 26, bbanFormat: '4n,6n,10n',
    bankCodes: ['0001','0002','0003','0004','0005','0014','0015','0019','0031','0032','0033','0051','0059','0070','0073'] },
  { code: 'FO', label: 'Islas Feroe',          flag: '🇫🇴', length: 18, bbanFormat: '4n,9n,1n',
    bankCodes: ['6460','9906','9901','9902','9903','9904','9905','9907','9908','9909','9910','9911','9912','9913','9914'] },
  { code: 'GL', label: 'Groenlandia',          flag: '🇬🇱', length: 18, bbanFormat: '4n,9n,1n',
    bankCodes: ['6471','9901','9902','9903','9904','9905','9906','9907','9908','9909','9910','9911','9912','9913','9914'] },

  // ── Eastern Europe ──
  { code: 'PL', label: 'Polonia',              flag: '🇵🇱', length: 28, bbanFormat: '8n,16n',
    bankCodes: ['10105000','10204005','10500000','10600005','10800027','10900003','11000036','11400000','11600000','12400000','10302001','11202000','12100000','13200000','16100000'] },
  { code: 'CZ', label: 'Rep. Checa',           flag: '🇨🇿', length: 24, bbanFormat: '4n,6n,10n',
    bankCodes: ['0100','0300','0600','0800','2010','2700','5500','0200','0210','0220','0500','2100','2200','3000','6000'] },
  { code: 'SK', label: 'Eslovaquia',           flag: '🇸🇰', length: 24, bbanFormat: '4n,6n,10n',
    bankCodes: ['0200','1100','0900','1111','3000','3100','5600','8180','8370','8100','0200','1100','3000','3100','5600'] },
  { code: 'HU', label: 'Hungría',              flag: '🇭🇺', length: 28, bbanFormat: '3n,4n,1n,15n,1n',
    bankCodes: ['100','101','102','103','104','105','107','108','109','110','113','114','115','116','117'] },
  { code: 'RO', label: 'Rumania',              flag: '🇷🇴', length: 24, bbanFormat: '4a,16c',
    bankCodes: ['BACX','BPOS','BRDE','BTRL','CECR','INGB','RNCB','BCRL','CITI','ARBN','BROB','OTPV','VBBU','AABR','BGFI'] },
  { code: 'BG', label: 'Bulgaria',             flag: '🇧🇬', length: 22, bbanFormat: '4a,6n,8c',
    bankCodes: ['BACB','BNBG','BPBI','BUBG','CCBA','FINV','GENB','PRIB','RZBB','SOMB','STSA','TEXB','UBBS','UNCR','VABG'] },
  { code: 'HR', label: 'Croacia',              flag: '🇭🇷', length: 21, bbanFormat: '7n,10n',
    bankCodes: ['2380006','2484008','1001005','2360000','2423006','2500009','2524000','2600005','2614000','2340009','2140009','2485008','2370000','2400008','2624000'] },
  { code: 'SI', label: 'Eslovenia',            flag: '🇸🇮', length: 19, bbanFormat: '5n,8n,2n',
    bankCodes: ['01000','02010','02900','04000','05000','05100','06000','07000','03000','01200','01500','01900','02500','02600','02800'] },
  { code: 'RS', label: 'Serbia',               flag: '🇷🇸', length: 22, bbanFormat: '3n,13n,2n',
    bankCodes: ['115','160','170','190','200','205','210','220','265','285','290','300','330','340','350'] },
  { code: 'BA', label: 'Bosnia',               flag: '🇧🇦', length: 20, bbanFormat: '3n,3n,8n,2n',
    bankCodes: ['110','111','112','113','115','116','117','118','119','120','125','130','132','135','140'] },
  { code: 'ME', label: 'Montenegro',           flag: '🇲🇪', length: 22, bbanFormat: '3n,13n,2n',
    bankCodes: ['100','105','107','110','115','120','125','130','135','140','145','150','155','160','165'] },
  { code: 'MK', label: 'Macedonia del Norte',  flag: '🇲🇰', length: 19, bbanFormat: '3n,10n,2n',
    bankCodes: ['100','105','110','115','120','125','130','135','140','145','150','155','160','165','170'] },
  { code: 'XK', label: 'Kosovo',               flag: '🇽🇰', length: 20, bbanFormat: '4n,10n,2n',
    bankCodes: ['1010','1012','1014','1020','1030','1040','1050','1060','1070','1080','1090','1100','1110','1120','1130'] },
  { code: 'AL', label: 'Albania',              flag: '🇦🇱', length: 28, bbanFormat: '8n,16c',
    bankCodes: ['13110010','13110020','13110030','13110040','13110050','13111000','13112000','13113000','13114000','13115000','13116000','13117000','13118000','13119000','13120000'] },
  { code: 'MD', label: 'Moldavia',             flag: '🇲🇩', length: 24, bbanFormat: '2c,18c',
    bankCodes: ['AC','AE','AG','BC','BE','BF','BG','BI','BK','BL','BM','BN','BR','BS','BT'] },
  { code: 'BY', label: 'Bielorrusia',          flag: '🇧🇾', length: 28, bbanFormat: '4c,20c',
    bankCodes: ['AKBB','ALFA','BELB','BPSB','BVVA','BWPB','CENA','DABR','DSBB','FTBB','GETB','HABB','IMFB','MBAB','MGKB'] },
  { code: 'UA', label: 'Ucrania',              flag: '🇺🇦', length: 29, bbanFormat: '2a,6n,19c',
    bankCodes: ['PBAN','CITI','DEUT','EABJ','EXBS','HABK','ISAE','MEBV','MPLT','OTPV','PERV','RZAT','SABR','UNCR','VTSB'] },
  { code: 'GE', label: 'Georgia',              flag: '🇬🇪', length: 22, bbanFormat: '2a,16n',
    bankCodes: ['BA','BG','BK','BN','BS','BT','CB','CG','CP','EB','GC','HB','LB','LB','TB'] },

  // ── Southern Europe ──
  { code: 'GR', label: 'Grecia',               flag: '🇬🇷', length: 27, bbanFormat: '3n,4n,16c',
    bankCodes: ['011','014','016','017','026','032','048','056','057','061','064','072','084','085','090'] },
  { code: 'CY', label: 'Chipre',               flag: '🇨🇾', length: 28, bbanFormat: '3n,5n,16c',
    bankCodes: ['002','008','010','011','012','013','014','015','016','017','018','019','020','021','022'] },
  { code: 'MT', label: 'Malta',                flag: '🇲🇹', length: 31, bbanFormat: '4a,5n,18c',
    bankCodes: ['VALL','HSBC','BOVL','BNPL','LHBI','MABS','FIMB','MEDB','BZMI','EBIL','BOVL','HSBC','VALL','BNPL','MABS'] },
  { code: 'MC', label: 'Mónaco',               flag: '🇲🇨', length: 27, bbanFormat: '5n,5n,11n,2n',
    bankCodes: ['30004','30002','30003','18907','30007','30006','10057','11428','13827','16606','30004','30002','30003','18907','30007'] },
  { code: 'SM', label: 'San Marino',           flag: '🇸🇲', length: 27, bbanFormat: '3n,5n,12c',
    bankCodes: ['01005','02008','03069','03268','05034','05428','08327','02015','01015','05387','05692','06045','08421','08024','02001'] },

  // ── Baltic ──
  { code: 'LT', label: 'Lituania',             flag: '🇱🇹', length: 20, bbanFormat: '5n,11n',
    bankCodes: ['10000','10100','10200','10300','10400','10600','10700','11000','11200','11400','11600','11800','21200','21400','21600'] },
  { code: 'LV', label: 'Letonia',              flag: '🇱🇻', length: 21, bbanFormat: '4a,13c',
    bankCodes: ['PARX','RNCB','HABA','LATX','RIK0','AIZL','BLBB','CITI','DABA','DIRL','EURV','LOMB','MIEL','RELV','SWED'] },
  { code: 'EE', label: 'Estonia',              flag: '🇪🇪', length: 20, bbanFormat: '2n,2n,11n,1n',
    bankCodes: ['10','11','12','14','16','17','22','33','42','55','68','75','77','90','93'] },

  // ── Americas ──
  { code: 'BR', label: 'Brasil',               flag: '🇧🇷', length: 29, bbanFormat: '8n,5n,10n,1a,1c',
    bankCodes: ['00000000','00000001','00000002','00000003','00000004','00000007','00000008','00000009','00000010','00000012','00000014','00000015','00000016','00000017','00000018'] },
  { code: 'CR', label: 'Costa Rica',           flag: '🇨🇷', length: 22, bbanFormat: '4n,14n',
    bankCodes: ['0001','0002','0003','0004','0005','0006','0007','0014','0015','0016','0017','0018','0020','0021','0022'] },
  { code: 'DO', label: 'Rep. Dominicana',      flag: '🇩🇴', length: 28, bbanFormat: '4c,20n',
    bankCodes: ['BAGR','BHDV','BICR','BNCN','BPEP','BPDR','BPOP','BPRO','BRDR','BSCH','BSHR','BVID','BACA','BAJD','BBRD'] },
  { code: 'LC', label: 'Santa Lucía',          flag: '🇱🇨', length: 32, bbanFormat: '4a,16c,3a',
    bankCodes: ['EJBC','ECSL','NOSC','BARC','NABK','CITI','HABK','DBOS','BOFS','CANA','ROYC','RBCS','SBIC','WIBC','EBSL'] },
  { code: 'VG', label: 'Islas Vírgenes Brit.', flag: '🇻🇬', length: 24, bbanFormat: '4a,16n',
    bankCodes: ['VPBV','VBBV','CITI','BARC','HBUK','DEUT','BOFA','CHAS','HSBC','SCHN','ABNA','UBSW','BKCH','BOFS','RABO'] },

  // ── Middle East & Africa ──
  { code: 'AE', label: 'Emiratos Árabes',      flag: '🇦🇪', length: 23, bbanFormat: '3n,16n',
    bankCodes: ['001','002','003','004','006','007','008','009','010','011','012','013','014','015','017'] },
  { code: 'IL', label: 'Israel',               flag: '🇮🇱', length: 23, bbanFormat: '3n,3n,13n',
    bankCodes: ['010','011','012','013','014','016','017','018','019','020','022','025','026','031','034'] },
  { code: 'JO', label: 'Jordania',             flag: '🇯🇴', length: 30, bbanFormat: '4a,4n,18c',
    bankCodes: ['ABJO','ARBJ','CBJO','CITI','HBHO','JOMB','NBOJ','SBAJ','UBOJ','HAJO','RJHI','BOJJ','ADBJ','AABJ','ALCJ'] },
  { code: 'SA', label: 'Arabia Saudita',       flag: '🇸🇦', length: 24, bbanFormat: '2n,18c',
    bankCodes: ['10','11','12','14','15','16','17','18','19','20','21','22','23','24','25'] },
  { code: 'QA', label: 'Qatar',                flag: '🇶🇦', length: 29, bbanFormat: '4a,21c',
    bankCodes: ['DOHB','QNBA','QNBA','CBQA','AHBB','ABQA','BKME','BARC','CITI','HSBC','MIDO','STBC','UBSW','BKCH','BOAB'] },
  { code: 'BH', label: 'Baréin',               flag: '🇧🇭', length: 22, bbanFormat: '4a,14c',
    bankCodes: ['BKME','BBME','BMIH','CITI','HBMB','NBOB','SHAB','UBAB','ABNB','BKBM','BBKH','BNPA','CHAS','CRES','DEUT'] },
  { code: 'KW', label: 'Kuwait',               flag: '🇰🇼', length: 30, bbanFormat: '4a,22c',
    bankCodes: ['NBOK','BKME','ABNK','BOFK','CBKU','CITI','GULF','HBKU','KFH','NBKU','SIBK','WIBK','BKHB','BURG','CRES'] },
  { code: 'LB', label: 'Líbano',               flag: '🇱🇧', length: 28, bbanFormat: '4n,20c',
    bankCodes: ['0001','0006','0007','0009','0010','0011','0012','0013','0015','0016','0017','0018','0019','0020','0021'] },
  { code: 'PS', label: 'Palestina',            flag: '🇵🇸', length: 29, bbanFormat: '4a,21c',
    bankCodes: ['PALS','BOPC','ARAB','NATP','CITI','HBHO','ALRP','AQBP','BOMA','BABP','BMPP','BOJY','CAPB','FABB','HJBP'] },
  { code: 'TR', label: 'Turquía',              flag: '🇹🇷', length: 26, bbanFormat: '5n,1n,16c',
    bankCodes: ['00010','00012','00100','00101','00102','00105','00106','00109','00111','00120','00124','00130','00135','00146','00150'] },
  { code: 'PK', label: 'Pakistán',             flag: '🇵🇰', length: 24, bbanFormat: '4a,16c',
    bankCodes: ['ABBL','AUBK','BAHL','BKCH','BLFL','BMAP','BOFA','CITI','DEUT','HABB','HBLP','MUCB','NBPk','SABP','SCBL'] },
  { code: 'TN', label: 'Túnez',                flag: '🇹🇳', length: 24, bbanFormat: '2n,3n,13n,2n',
    bankCodes: ['10','11','12','13','14','16','17','18','19','20','21','22','23','24','25'] },
  { code: 'MR', label: 'Mauritania',           flag: '🇲🇷', length: 27, bbanFormat: '5n,5n,11n,2n',
    bankCodes: ['00010','00020','00030','00040','00050','00060','00070','00080','00090','00100','00110','00120','00130','00140','00150'] },
  { code: 'MU', label: 'Mauricio',             flag: '🇲🇺', length: 30, bbanFormat: '4a,2n,2n,12n,3n,3a',
    bankCodes: ['BOMM','MCBL','SBMC','BQIB','HSBC','STCB','BARC','DEUT','CITI','SAMP','ABSA','FNBK','BAIN','NATM','CORP'] },
  { code: 'SC', label: 'Seychelles',           flag: '🇸🇨', length: 31, bbanFormat: '4a,2n,2n,16n,3a',
    bankCodes: ['SBSC','BARC','HABS','NOVN','SSPB','ABSS','BMSS','CABS','DEUT','STBS','NBSY','BOMS','EDBS','PRBS','BWIS'] },
  { code: 'TL', label: 'Timor Oriental',       flag: '🇹🇱', length: 23, bbanFormat: '3n,14n,2n',
    bankCodes: ['001','002','003','004','005','006','007','008','009','010','011','012','013','014','015'] },
  { code: 'GI', label: 'Gibraltar',            flag: '🇬🇮', length: 23, bbanFormat: '4a,15c',
    bankCodes: ['NATG','BARC','CHAS','CITI','DEUT','HSBC','LLOY','SANT','SCHO','TRIO','UBSW','BOFI','NWBK','BIPG','GIBA'] },
  { code: 'VA', label: 'Ciudad del Vaticano',  flag: '🇻🇦', length: 22, bbanFormat: '3n,15n',
    bankCodes: ['010','011','012','013','014','015','016','017','018','019','020','021','022','023','024'] },
  { code: 'LI', label: 'Liechtenstein',        flag: '🇱🇮', length: 21, bbanFormat: '5n,12c',
    bankCodes: ['00762','00275','09000','00483','08790','08800','08810','08820','08830','08840','08850','08860','08870','08880','08890'] },
  { code: 'AZ', label: 'Azerbaiyán',           flag: '🇦🇿', length: 28, bbanFormat: '4a,20c',
    bankCodes: ['BAVA','IBAZ','UNIB','VTBB','ABNA','CAPB','EUBA','MILB','PAVA','RABO','RESB','SOCB','TBCB','XALB','XBNK'] },
  { code: 'KZ', label: 'Kazajistán',           flag: '🇰🇿', length: 20, bbanFormat: '3n,13c',
    bankCodes: ['125','187','188','190','191','192','193','194','195','196','197','198','199','200','201'] },
  { code: 'GT', label: 'Guatemala',            flag: '🇬🇹', length: 28, bbanFormat: '4c,20c',
    bankCodes: ['AGGT','BICT','BCGT','BNOR','BRGT','CIBG','CITI','HSBC','INTE','PRGT','PROM','SCBG','GTCR','BACG','BMGT'] },
]

// ============================================================
// PARSE & RANDOM HELPERS
// ============================================================

interface BbanSegment {
  count: number
  type: 'a' | 'n' | 'c'
}

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
      if (Math.random() < 0.7) {
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
function computeSpanishDC(digits: string): number {
  const weights = [1, 2, 4, 8, 5, 10, 9, 7, 3, 6]
  let sum = 0
  for (let i = 0; i < digits.length && i < weights.length; i++) {
    sum += parseInt(digits[i]) * weights[i]
  }
  const dc = 11 - (sum % 11)
  if (dc === 10) return 1
  if (dc === 11) return 0
  return dc
}

function generateSpanishBBAN(bankCode: string): string {
  const branch = randomChars('n', 4)
  const account = randomChars('n', 10)
  const dc1 = computeSpanishDC(bankCode + branch)
  const dc2 = computeSpanishDC(bankCode + branch + account)
  return `${bankCode}${branch}${dc1}${dc2}${account}`
}

// ── Italy (IT): 1a CIN, 5n ABI, 5n CAB, 12c account ──
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
      // even position (1-indexed) — multiply by 2, reduce if >9
      val *= 2
      if (val > 9) val -= 9
    }
    sum += val
  }
  const cinVal = (10 - (sum % 10)) % 10
  return String.fromCharCode(65 + cinVal) // 0→A, 1→B, ..., 9→J
}

function generateItalianBBAN(abiCode: string): string {
  const cab = randomChars('n', 5)
  const account = randomChars('c', 12).toUpperCase()
  const cin = computeItalianCIN(abiCode, cab, account)
  return `${cin}${abiCode}${cab}${account}`
}

// ── France (FR) & Monaco (MC): 5n bank, 5n branch, 11n account, 2n RIB key ──
function charToFrenchNumber(ch: string): number {
  if (ch >= '0' && ch <= '9') return parseInt(ch)
  if (ch >= 'A' && ch <= 'I') return ch.charCodeAt(0) - 65 + 1 // A=1..I=9
  if (ch >= 'J' && ch <= 'R') return ch.charCodeAt(0) - 74      // J=1..R=9
  // S=2, T=3, U=4, V=5, W=6, X=7, Y=8, Z=9
  if (ch >= 'S' && ch <= 'Z') return ch.charCodeAt(0) - 81
  return 0
}

function accountToNumber(account: string): bigint {
  let result = 0n
  for (const ch of account) {
    result = result * 10n + BigInt(charToFrenchNumber(ch))
  }
  return result
}

function computeFrenchRIB(bank: string, branch: string, account: string): string {
  const bankNum = BigInt(parseInt(bank))
  const branchNum = BigInt(parseInt(branch))
  const accountNum = accountToNumber(account)
  const key = BigInt(97) - ((bankNum * 89n + branchNum * 15n + accountNum * 3n) * 100n % 97n)
  const ribKey = ((key % 97n) + 97n) % 97n
  return ribKey.toString().padStart(2, '0')
}

function generateFrenchBBAN(bankCode: string): string {
  const branch = randomChars('n', 5)
  const account = randomChars('n', 11)
  const ribKey = computeFrenchRIB(bankCode, branch, account)
  return `${bankCode}${branch}${account}${ribKey}`
}

// ── Portugal (PT): 4n bank, 4n branch, 11n account, 2n check ──
function computePortugueseCheck(bank: string, branch: string, account: string): string {
  const weights = [73, 17, 89, 38, 62, 45, 53, 15, 50, 5, 49, 34, 81, 76, 27, 90, 9, 30, 3]
  const digits = bank + branch + account // 19 chars
  let sum = 0
  for (let i = 0; i < digits.length && i < weights.length; i++) {
    sum += parseInt(digits[i]) * weights[i]
  }
  const check = 98 - (sum % 97)
  return check.toString().padStart(2, '0')
}

function generatePortugueseBBAN(bankCode: string): string {
  const branch = randomChars('n', 4)
  const account = randomChars('n', 11)
  const check = computePortugueseCheck(bankCode, branch, account)
  return `${bankCode}${branch}${account}${check}`
}

// ── Belgium (BE): 3n bank, 7n account, 2n check (mod 97) ──
function generateBelgianBBAN(bankCode: string): string {
  const account = randomChars('n', 7)
  const combined = bankCode + account // 10 digits
  const num = BigInt(combined) % 97n
  const check = (97n - num).toString().padStart(2, '0')
  return `${combined}${check}`
}

// ── Croatia (HR): 7n bank, 10n account ──
// No internal check digit beyond MOD-97 IBAN

// ── Slovenia (SI): 5n bank, 8n account, 2n check (mod 97) ──
function generateSlovenianBBAN(bankCode: string): string {
  const account = randomChars('n', 8)
  const combined = bankCode + account // 13 digits
  const num = BigInt(combined) % 97n
  const check = (97n - num).toString().padStart(2, '0')
  return `${combined}${check}`
}

// ── Czech Republic (CZ): 4n bank, 6n branch, 10n account ──
// No internal check digit beyond MOD-97 IBAN

// ── Slovakia (SK): 4n bank, 6n branch, 10n account ──
// No internal check digit beyond MOD-97 IBAN

// ── Serbia/ME/MK: 3n bank, 13n account, 2n check (mod 97) ──
function generateSerbianStyleBBAN(bankCode: string): string {
  const account = randomChars('n', 13)
  const combined = bankCode + account // 16 digits
  const num = BigInt(combined) % 97n
  const check = (97n - num).toString().padStart(2, '0')
  return `${combined}${check}`
}

// ── Bosnia (BA): 3n bank, 3n branch, 8n account, 2n check (mod 97) ──
function generateBosnianBBAN(bankCode: string): string {
  const branch = randomChars('n', 3)
  const account = randomChars('n', 8)
  const combined = bankCode + branch + account // 14 digits
  const num = BigInt(combined) % 97n
  const check = (97n - num).toString().padStart(2, '0')
  return `${combined}${check}`
}

// ============================================================
// GENERIC BBAN GENERATION (for countries without special logic)
// ============================================================

function generateGenericBBAN(country: IbanCountry): string {
  const parts = parseBbanFormat(country.bbanFormat)
  const bankCode = country.bankCodes[Math.floor(Math.random() * country.bankCodes.length)]
  // Use bank code as first segment, random for the rest
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
    case 'BE': return generateBelgianBBAN(bankCode)
    case 'SI': return generateSlovenianBBAN(bankCode)
    case 'RS':
    case 'ME':
    case 'MK': return generateSerbianStyleBBAN(bankCode)
    case 'BA': return generateBosnianBBAN(bankCode)
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
  const remainder = BigInt(numeric) % 97n
  const check = 98 - Number(remainder)
  return String(check).padStart(2, '0')
}

// ============================================================
// EXPORTED GENERATION FUNCTION
// ============================================================

export function generateIban(country: IbanCountry): string {
  const bban = generateBban(country)
  const checkDigits = calculateIbanCheckDigits(country.code, bban)
  return `${country.code}${checkDigits}${bban}`
}

export function formatIban(iban: string): string {
  return iban.replace(/(.{4})/g, '$1 ').trim()
}