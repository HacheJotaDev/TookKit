'use client'

import { createContext, useContext } from 'react'

// ============================================================
// Types
// ============================================================

export type Lang = 'es' | 'en' | 'pt'

export const LANG_LABELS: Record<Lang, string> = { es: 'Español', en: 'English', pt: 'Português' }

export const LOCALE_MAP: Record<Lang, string> = { es: 'es-CL', en: 'en-US', pt: 'pt-BR' }

// ============================================================
// All translations — single source of truth
// ============================================================

const T: Record<Lang, Record<string, string>> = {
  // ============================================================
  // NAV
  // ============================================================
  es: {
    'nav.tarjetas': 'Tarjetas', 'nav.checker': 'Checker', 'nav.herramientas': 'Herramientas', 'nav.ajustes': 'Ajustes',

    // ============================================================
    // TOOLS GRID
    // ============================================================
    'tools.title': 'Herramientas', 'tools.subtitle': 'Selecciona una herramienta',
    'tool.iptv': 'IPTV', 'tool.iptv_desc': 'Checker',
    'tool.email': 'Correo', 'tool.email_desc': 'Temporal',
    'tool.address': 'Direcciones', 'tool.address_desc': 'Generador',
    'tool.iban': 'IBAN', 'tool.iban_desc': 'Generador',
    'tool.binsearch': 'BIN Lookup', 'tool.binsearch_desc': 'Buscador',
    'tool.ipfraud': 'IP Fraude', 'tool.ipfraud_desc': 'Scanner',

    // ============================================================
    // CARDS TAB
    // ============================================================
    'cards.bin': 'BIN / Plantilla', 'cards.generar': 'Generar', 'cards.resultados': 'resultados',
    'cards.mes': 'Mes', 'cards.ano': 'Año',
    'cards.copiar_todo': 'Copiar Todo', 'cards.copiado': 'Copiado al portapapeles',
    'cards.tarjetas_copiadas': 'tarjetas copiadas', 'cards.ingresa_bin': 'Ingresa un BIN válido',
    'cards.generada': 'tarjeta generada', 'cards.generadas': 'tarjetas generadas',

    // ============================================================
    // CHECKER TAB
    // ============================================================
    'checker.lista': 'Lista de CC', 'checker.verificar': 'Verificar', 'checker.analizando': 'Analizando...',
    'checker.detener': 'Detener', 'checker.total': 'Total', 'checker.aprobadas': 'Aprobadas', 'checker.rechazadas': 'Rechazadas',
    'checker.ingresa_cc': 'Ingresa al menos una tarjeta', 'checker.listo_aprobadas': 'aprobadas',
    'checker.listo_rechazadas': 'rechazadas', 'checker.detenido': 'Proceso detenido',
    'checker.copiado': 'Copiado', 'checker.error_conexion': 'Error de conexión',
    'checker.aprobada_msg': 'Aprobada', 'checker.rechazada_msg': 'Rechazada',

    // ============================================================
    // EMAIL TAB
    // ============================================================
    'email.tu_correo': 'Tu Correo Temporal', 'email.actualizar': 'Actualizar bandeja',
    'email.token_exp': 'Token expirado — genera un nuevo correo', 'email.temporal': 'Correo Temporal',
    'email.temp_desc': 'Genera un correo temporal para recibir mensajes', 'email.generar': 'Generar Correo',
    'email.creando': 'Creando...', 'email.creado': 'Correo temporal creado',
    'email.error_crear': 'Error al crear correo. Verifica tu conexión.', 'email.eliminada': 'Cuenta eliminada',
    'email.error_eliminar': 'Error al eliminar cuenta', 'email.copiado': 'Correo copiado',
    'email.bandeja': 'Bandeja de Entrada', 'email.sin_mensajes': 'Sin mensajes aún',
    'email.mensajes_auto': 'Los mensajes aparecerán aquí automáticamente', 'email.recuperando': 'Recuperando correo...',
    'email.sin_contenido': 'Sin contenido', 'email.sin_asunto': 'Sin asunto', 'email.desconocido': 'Desconocido',
    'email.error_cargar': 'Error al cargar mensaje',

    // ============================================================
    // ADDRESS TAB
    // ============================================================
    'addr.pais': 'País', 'addr.cantidad': 'Cantidad', 'addr.generar': 'Generar Direcciones', 'addr.generando': 'Generando...',
    'addr.copiar_todo': 'Copiar Todo', 'addr.copiada': 'Dirección copiada', 'addr.copiadas': 'direcciones copiadas',
    'addr.resultado': 'resultado', 'addr.error_gen': 'Error al generar direcciones. Intenta de nuevo.',
    'addr.error_net': 'Error de conexión. Verifica tu internet.', 'addr.cp': 'CP', 'addr.tel': 'Tel',

    // ============================================================
    // IBAN TAB
    // ============================================================
    'iban.pais': 'País', 'iban.cantidad': 'Cantidad', 'iban.generar': 'Generar IBAN',
    'iban.copiar_todo': 'Copiar Todo', 'iban.copiado': 'IBAN copiado', 'iban.copiados': 'IBANs copiados',
    'iban.resultado': 'resultado', 'iban.selecciona': 'Selecciona un país válido', 'iban.codigo': 'Código',
    'iban.caracteres': 'caracteres', 'iban.generados': 'IBANs generados',

    // ============================================================
    // SETTINGS TAB
    // ============================================================
    'set.tema': 'Tema', 'set.oscuro': 'Oscuro', 'set.claro': 'Claro', 'set.apariencia': 'Cambiar apariencia',
    'set.limpiar': 'Limpiar datos', 'set.almacenamiento': 'Almacenamiento', 'set.limpiar_btn': 'Limpiar',
    'set.confirmar': 'Confirmar', 'set.no': 'No', 'set.limpiado': 'Datos limpiados correctamente',
    'set.fallo_limpiar': 'No se pudo limpiar', 'set.acerca': 'Acerca de', 'set.dev': 'Desarrollado por HacheJota',
    'set.compartir': 'Compartir APK', 'set.compartir_titulo': 'Compartir HJTools X',
    'set.donde_compartir': 'Elige dónde compartir la app', 'set.cancelar': 'Cancelar',
    'set.copiar_link': 'Copiar Link', 'set.portapapeles': 'Copiar al portapapeles', 'set.copiado': 'Copiado!',
    'set.idioma': 'Idioma', 'set.idioma_desc': 'Seleccionar idioma',
    'set.pantalla': 'Pantalla activa', 'set.pantalla_desc': 'Evitar que se apague',
    'set.pantalla_no': 'No soportado en esta app',
    'set.about_desc': 'HJTools X — Generador de Tarjetas, CCS Checker, IPTV Checker, Generador de Correo, Direcciones e IBAN.',

    // ============================================================
    // IPTV CHECKER
    // ============================================================
    'iptv.na': 'N/A', 'iptv.unlimited': 'Unlimited', 'iptv.timeAgoNow': 'Ahora',
    'iptv.hitCopied': 'Hit copiado', 'iptv.hidePassword': 'Ocultar', 'iptv.showPassword': 'Mostrar',
    'iptv.copy': 'Copiar', 'iptv.m3uUrlCopied': 'M3U URL copiada',
    'iptv.onlyTxtFiles': 'Solo archivos .txt',
    'iptv.combosLoaded': ' combos cargados', 'iptv.proxysLoaded': ' proxys cargados',
    'iptv.enterProxys': 'Ingresa proxies',
    'iptv.noProxysAvailable': 'Sin proxys disponibles', 'iptv.errorValidatingProxys': 'Error validando proxys',
    'iptv.loadComboOrPaste': 'Carga un combo o pega líneas',
    'iptv.enterServer': 'Ingresa el servidor (host:port)',
    'iptv.activateProxysFirst': 'Activa los proxys primero',
    'iptv.analyzingLines': 'Analizando ', 'iptv.linesSuffix': ' líneas...',
    'iptv.completed': 'Completado: ', 'iptv.cancelled': 'Cancelado: ',
    'iptv.hitsFoundText': ' hits encontrados',
    'iptv.cancelling': 'Cancelando...', 'iptv.noHitsToSave': 'No hay hits para guardar',
    'iptv.hitsSaved': ' hits guardados',
    'iptv.urlMode': 'URL Mode', 'iptv.comboMode': 'Combo Mode',
    'iptv.serverPlaceholder': 'Servidor host:port  ej: canal-pro.xyz:8080',
    'iptv.pasteUrlsHere': 'Pega URLs IPTV aquí...',
    'iptv.uploadCombo': 'Subir combo .txt', 'iptv.linesCount': ' líneas',
    'iptv.proxies': 'Proxies', 'iptv.activeCount': ' activos',
    'iptv.proxyPlaceholderLine1': 'ip:port  o  ip:port:user:pass',
    'iptv.proxyPlaceholderLine2': 'Un proxy por línea...',
    'iptv.file': 'Archivo', 'iptv.validating': 'Validando...', 'iptv.validateProxies': 'Validar Proxies',
    'iptv.validProxysCount': ' proxies válidos',
    'iptv.proxiesCleared': 'Proxies eliminados', 'iptv.clearProxies': 'Limpiar proxies',
    'iptv.threads': 'Hilos', 'iptv.checking': 'Verificando...', 'iptv.startCheck': 'Iniciar Check',
    'iptv.proxyIndicator': ' · proxy',
    'iptv.statTotal': 'Total', 'iptv.statHits': 'Hits', 'iptv.statBad': 'Bad', 'iptv.statTimeout': 'Timeout',
    'iptv.hitsFound': 'Hits Encontrados',
    'iptv.save': 'Guardar', 'iptv.copyAll': 'Copiar Todo',
    'iptv.history': 'Historial', 'iptv.deleteAll': 'Borrar todo', 'iptv.historyDeleted': 'Historial eliminado',
    'iptv.close': 'Cerrar', 'iptv.hitsCount': ' hits',
    'iptv.deleteSession': 'Eliminar sesión', 'iptv.sessionDeleted': 'Sesión eliminada',
    'iptv.previousSessionHits': 'Hits de sesión anterior',
    // IPTV copy format labels
    'iptv.copyHost': 'Host:', 'iptv.copyUser': 'User:', 'iptv.copyPass': 'Pass:',
    'iptv.copyStatus': 'Status:', 'iptv.copyCreated': 'Created:', 'iptv.copyExp': 'Exp:', 'iptv.copyTz': 'TZ:', 'iptv.copyM3u': 'M3U:',

    // ============================================================
    // BIN SEARCHER
    // ============================================================
    'bin.errorLoadCountry': 'Error al cargar datos del país',
    'bin.errorLoadBank': 'Error al cargar datos del banco',
    'bin.binCopied': 'BIN copiado', 'bin.country': 'País', 'bin.bank': 'Banco', 'bin.bins': 'BINs',
    'bin.goBack': 'Volver', 'bin.searchCountry': 'Buscar país...',
    'bin.banksAvailable': ' bancos disponibles', 'bin.searchBank': 'Buscar banco...',
    'bin.binCount': ' BINs', 'bin.filteredBinCount': ' de ',
    'bin.allNetworks': 'Todas las redes', 'bin.allTypes': 'Todos los tipos',
    'bin.searchBin': 'Buscar BIN...', 'bin.noBinsFound': 'No se encontraron BINs',
    'bin.loading': 'Cargando...', 'bin.binsSuffix': ' BINs',

    // ============================================================
    // IP FRAUD
    // ============================================================
    'ipfraud.title': 'IP Fraude', 'ipfraud.subtitle': 'Analiza el riesgo de fraude de una IP',
    'ipfraud.yourIp': 'Tu IP detectada', 'ipfraud.analyzing': 'Analizando IP...',
    'ipfraud.checkBtn': 'Analizar IP', 'ipfraud.refreshBtn': 'Analizar de nuevo',
    'ipfraud.errorFetch': 'Error al analizar la IP. Intenta de nuevo.',
    'ipfraud.copied': 'IP copiada', 'ipfraud.operator': 'Operador',
    'ipfraud.location': 'Ubicación', 'ipfraud.proxies': 'Proxies & VPN',
    'ipfraud.riskLow': 'Bajo Riesgo', 'ipfraud.riskMedium': 'Riesgo Medio',
    'ipfraud.riskHigh': 'Alto Riesgo', 'ipfraud.riskUnknown': 'Desconocido',
    'ipfraud.detected': 'Detectado', 'ipfraud.no': 'No',
    'ipfraud.safe': 'Seguro', 'ipfraud.riskLabel': 'Riesgo',
    // Proxy labels
    'ipfraud.proxy_vpn': 'VPN Anonimizadora', 'ipfraud.proxy_tor': 'Nodo de Salida Tor',
    'ipfraud.proxy_server': 'Servidor', 'ipfraud.proxy_public': 'Proxy Público',
    'ipfraud.proxy_bot': 'Robot de Motor de Búsqueda', 'ipfraud.proxy_blacklisted': 'En Lista Negra',
    // Operator labels
    'ipfraud.isp': 'ISP', 'ipfraud.org': 'Organización', 'ipfraud.connectionType': 'Tipo de Conexión',
    // Location labels
    'ipfraud.countryLabel': 'País', 'ipfraud.state': 'Estado / Provincia',
    'ipfraud.district': 'Distrito', 'ipfraud.city': 'Ciudad', 'ipfraud.postalCode': 'Código Postal',
  },

  // ============================================================
  // ENGLISH
  // ============================================================
  en: {
    'nav.tarjetas': 'Cards', 'nav.checker': 'Checker', 'nav.herramientas': 'Tools', 'nav.ajustes': 'Settings',
    'tools.title': 'Tools', 'tools.subtitle': 'Select a tool',
    'tool.iptv': 'IPTV', 'tool.iptv_desc': 'Checker',
    'tool.email': 'Email', 'tool.email_desc': 'Temp',
    'tool.address': 'Addresses', 'tool.address_desc': 'Generator',
    'tool.iban': 'IBAN', 'tool.iban_desc': 'Generator',
    'tool.binsearch': 'BIN Lookup', 'tool.binsearch_desc': 'Search',
    'tool.ipfraud': 'IP Fraud', 'tool.ipfraud_desc': 'Scanner',

    'cards.bin': 'BIN / Template', 'cards.generar': 'Generate', 'cards.resultados': 'results',
    'cards.mes': 'Month', 'cards.ano': 'Year',
    'cards.copiar_todo': 'Copy All', 'cards.copiado': 'Copied to clipboard',
    'cards.tarjetas_copiadas': 'cards copied', 'cards.ingresa_bin': 'Enter a valid BIN',
    'cards.generada': 'card generated', 'cards.generadas': 'cards generated',

    'checker.lista': 'CC List', 'checker.verificar': 'Verify', 'checker.analizando': 'Analyzing...',
    'checker.detener': 'Stop', 'checker.total': 'Total', 'checker.aprobadas': 'Approved', 'checker.rechazadas': 'Declined',
    'checker.ingresa_cc': 'Enter at least one card', 'checker.listo_aprobadas': 'approved',
    'checker.listo_rechazadas': 'declined', 'checker.detenido': 'Process stopped',
    'checker.copiado': 'Copied', 'checker.error_conexion': 'Connection error',
    'checker.aprobada_msg': 'Approved', 'checker.rechazada_msg': 'Declined',

    'email.tu_correo': 'Your Temp Email', 'email.actualizar': 'Refresh inbox',
    'email.token_exp': 'Token expired — generate a new email', 'email.temporal': 'Temp Email',
    'email.temp_desc': 'Generate a temp email to receive messages', 'email.generar': 'Generate Email',
    'email.creando': 'Creating...', 'email.creado': 'Temp email created',
    'email.error_crear': 'Error creating email. Check your connection.', 'email.eliminada': 'Account deleted',
    'email.error_eliminar': 'Error deleting account', 'email.copiado': 'Email copied',
    'email.bandeja': 'Inbox', 'email.sin_mensajes': 'No messages yet',
    'email.mensajes_auto': 'Messages will appear here automatically', 'email.recuperando': 'Recovering email...',
    'email.sin_contenido': 'No content', 'email.sin_asunto': 'No subject', 'email.desconocido': 'Unknown',
    'email.error_cargar': 'Error loading message',

    'addr.pais': 'Country', 'addr.cantidad': 'Quantity', 'addr.generar': 'Generate Addresses', 'addr.generando': 'Generating...',
    'addr.copiar_todo': 'Copy All', 'addr.copiada': 'Address copied', 'addr.copiadas': 'addresses copied',
    'addr.resultado': 'result', 'addr.error_gen': 'Error generating addresses. Try again.',
    'addr.error_net': 'Connection error. Check your internet.', 'addr.cp': 'ZIP', 'addr.tel': 'Tel',

    'iban.pais': 'Country', 'iban.cantidad': 'Quantity', 'iban.generar': 'Generate IBAN',
    'iban.copiar_todo': 'Copy All', 'iban.copiado': 'IBAN copied', 'iban.copiados': 'IBANs copied',
    'iban.resultado': 'result', 'iban.selecciona': 'Select a valid country', 'iban.codigo': 'Code',
    'iban.caracteres': 'characters', 'iban.generados': 'IBANs generated',

    'set.tema': 'Theme', 'set.oscuro': 'Dark', 'set.claro': 'Light', 'set.apariencia': 'Change appearance',
    'set.limpiar': 'Clear data', 'set.almacenamiento': 'Storage', 'set.limpiar_btn': 'Clear',
    'set.confirmar': 'Confirm', 'set.no': 'No', 'set.limpiado': 'Data cleared successfully',
    'set.fallo_limpiar': 'Could not clear', 'set.acerca': 'About', 'set.dev': 'Developed by HacheJota',
    'set.compartir': 'Share APK', 'set.compartir_titulo': 'Share HJTools X',
    'set.donde_compartir': 'Choose where to share the app', 'set.cancelar': 'Cancel',
    'set.copiar_link': 'Copy Link', 'set.portapapeles': 'Copy to clipboard', 'set.copiado': 'Copied!',
    'set.idioma': 'Language', 'set.idioma_desc': 'Select language',
    'set.pantalla': 'Keep screen on', 'set.pantalla_desc': 'Prevent screen off',
    'set.pantalla_no': 'Not supported on this app',
    'set.about_desc': 'HJTools X — Card Generator, CCS Checker, IPTV Checker, Email Generator, Addresses & IBAN.',

    'iptv.na': 'N/A', 'iptv.unlimited': 'Unlimited', 'iptv.timeAgoNow': 'Just now',
    'iptv.hitCopied': 'Hit copied', 'iptv.hidePassword': 'Hide', 'iptv.showPassword': 'Show',
    'iptv.copy': 'Copy', 'iptv.m3uUrlCopied': 'M3U URL copied',
    'iptv.onlyTxtFiles': 'Only .txt files',
    'iptv.combosLoaded': ' combos loaded', 'iptv.proxysLoaded': ' proxies loaded',
    'iptv.enterProxys': 'Enter proxies',
    'iptv.noProxysAvailable': 'No proxies available', 'iptv.errorValidatingProxys': 'Error validating proxies',
    'iptv.loadComboOrPaste': 'Load a combo or paste lines',
    'iptv.enterServer': 'Enter the server (host:port)',
    'iptv.activateProxysFirst': 'Activate proxies first',
    'iptv.analyzingLines': 'Analyzing ', 'iptv.linesSuffix': ' lines...',
    'iptv.completed': 'Completed: ', 'iptv.cancelled': 'Cancelled: ',
    'iptv.hitsFoundText': ' hits found',
    'iptv.cancelling': 'Cancelling...', 'iptv.noHitsToSave': 'No hits to save',
    'iptv.hitsSaved': ' hits saved',
    'iptv.urlMode': 'URL Mode', 'iptv.comboMode': 'Combo Mode',
    'iptv.serverPlaceholder': 'Server host:port  e.g.: canal-pro.xyz:8080',
    'iptv.pasteUrlsHere': 'Paste IPTV URLs here...',
    'iptv.uploadCombo': 'Upload combo .txt', 'iptv.linesCount': ' lines',
    'iptv.proxies': 'Proxies', 'iptv.activeCount': ' active',
    'iptv.proxyPlaceholderLine1': 'ip:port  or  ip:port:user:pass',
    'iptv.proxyPlaceholderLine2': 'One proxy per line...',
    'iptv.file': 'File', 'iptv.validating': 'Validating...', 'iptv.validateProxies': 'Validate Proxies',
    'iptv.validProxysCount': ' valid proxies',
    'iptv.proxiesCleared': 'Proxies cleared', 'iptv.clearProxies': 'Clear proxies',
    'iptv.threads': 'Threads', 'iptv.checking': 'Checking...', 'iptv.startCheck': 'Start Check',
    'iptv.proxyIndicator': ' · proxy',
    'iptv.statTotal': 'Total', 'iptv.statHits': 'Hits', 'iptv.statBad': 'Bad', 'iptv.statTimeout': 'Timeout',
    'iptv.hitsFound': 'Hits Found',
    'iptv.save': 'Save', 'iptv.copyAll': 'Copy All',
    'iptv.history': 'History', 'iptv.deleteAll': 'Delete all', 'iptv.historyDeleted': 'History deleted',
    'iptv.close': 'Close', 'iptv.hitsCount': ' hits',
    'iptv.deleteSession': 'Delete session', 'iptv.sessionDeleted': 'Session deleted',
    'iptv.previousSessionHits': 'Hits from previous session',
    'iptv.copyHost': 'Host:', 'iptv.copyUser': 'User:', 'iptv.copyPass': 'Pass:',
    'iptv.copyStatus': 'Status:', 'iptv.copyCreated': 'Created:', 'iptv.copyExp': 'Exp:', 'iptv.copyTz': 'TZ:', 'iptv.copyM3u': 'M3U:',

    'bin.errorLoadCountry': 'Error loading country data',
    'bin.errorLoadBank': 'Error loading bank data',
    'bin.binCopied': 'BIN copied', 'bin.country': 'Country', 'bin.bank': 'Bank', 'bin.bins': 'BINs',
    'bin.goBack': 'Go back', 'bin.searchCountry': 'Search country...',
    'bin.banksAvailable': ' banks available', 'bin.searchBank': 'Search bank...',
    'bin.binCount': ' BINs', 'bin.filteredBinCount': ' of ',
    'bin.allNetworks': 'All networks', 'bin.allTypes': 'All types',
    'bin.searchBin': 'Search BIN...', 'bin.noBinsFound': 'No BINs found',
    'bin.loading': 'Loading...', 'bin.binsSuffix': ' BINs',

    'ipfraud.title': 'IP Fraud', 'ipfraud.subtitle': 'Analyze the fraud risk of an IP',
    'ipfraud.yourIp': 'Your detected IP', 'ipfraud.analyzing': 'Analyzing IP...',
    'ipfraud.checkBtn': 'Analyze IP', 'ipfraud.refreshBtn': 'Analyze again',
    'ipfraud.errorFetch': 'Error analyzing IP. Try again.',
    'ipfraud.copied': 'IP copied', 'ipfraud.operator': 'Operator',
    'ipfraud.location': 'Location', 'ipfraud.proxies': 'Proxies & VPN',
    'ipfraud.riskLow': 'Low Risk', 'ipfraud.riskMedium': 'Medium Risk',
    'ipfraud.riskHigh': 'High Risk', 'ipfraud.riskUnknown': 'Unknown',
    'ipfraud.detected': 'Detected', 'ipfraud.no': 'No',
    'ipfraud.safe': 'Safe', 'ipfraud.riskLabel': 'Risk',
    'ipfraud.proxy_vpn': 'Anonymizing VPN', 'ipfraud.proxy_tor': 'Tor Exit Node',
    'ipfraud.proxy_server': 'Server', 'ipfraud.proxy_public': 'Public Proxy',
    'ipfraud.proxy_bot': 'Search Engine Robot', 'ipfraud.proxy_blacklisted': 'Blacklisted',
    'ipfraud.isp': 'ISP', 'ipfraud.org': 'Organization', 'ipfraud.connectionType': 'Connection Type',
    'ipfraud.countryLabel': 'Country', 'ipfraud.state': 'State / Province',
    'ipfraud.district': 'District', 'ipfraud.city': 'City', 'ipfraud.postalCode': 'Postal Code',
  },

  // ============================================================
  // PORTUGUÊS
  // ============================================================
  pt: {
    'nav.tarjetas': 'Cartões', 'nav.checker': 'Checker', 'nav.herramientas': 'Ferramentas', 'nav.ajustes': 'Configurações',
    'tools.title': 'Ferramentas', 'tools.subtitle': 'Selecione uma ferramenta',
    'tool.iptv': 'IPTV', 'tool.iptv_desc': 'Checker',
    'tool.email': 'Email', 'tool.email_desc': 'Temporário',
    'tool.address': 'Endereços', 'tool.address_desc': 'Gerador',
    'tool.iban': 'IBAN', 'tool.iban_desc': 'Gerador',
    'tool.binsearch': 'BIN Lookup', 'tool.binsearch_desc': 'Pesquisa',
    'tool.ipfraud': 'IP Fraude', 'tool.ipfraud_desc': 'Scanner',

    'cards.bin': 'BIN / Modelo', 'cards.generar': 'Gerar', 'cards.resultados': 'resultados',
    'cards.mes': 'Mês', 'cards.ano': 'Ano',
    'cards.copiar_todo': 'Copiar Tudo', 'cards.copiado': 'Copiado para a área de transferência',
    'cards.tarjetas_copiadas': 'cartões copiados', 'cards.ingresa_bin': 'Insira um BIN válido',
    'cards.generada': 'cartão gerado', 'cards.generadas': 'cartões gerados',

    'checker.lista': 'Lista de CC', 'checker.verificar': 'Verificar', 'checker.analizando': 'Analisando...',
    'checker.detener': 'Parar', 'checker.total': 'Total', 'checker.aprobadas': 'Aprovadas', 'checker.rechazadas': 'Rejeitadas',
    'checker.ingresa_cc': 'Insira pelo menos um cartão', 'checker.listo_aprobadas': 'aprovadas',
    'checker.listo_rechazadas': 'rejeitadas', 'checker.detenido': 'Processo parado',
    'checker.copiado': 'Copiado', 'checker.error_conexion': 'Erro de conexão',
    'checker.aprobada_msg': 'Aprovada', 'checker.rechazada_msg': 'Rejeitada',

    'email.tu_correo': 'Seu Email Temp', 'email.actualizar': 'Atualizar caixa',
    'email.token_exp': 'Token expirado — gere um novo email', 'email.temporal': 'Email Temporário',
    'email.temp_desc': 'Gere um email temporário para receber mensagens', 'email.generar': 'Gerar Email',
    'email.creando': 'Criando...', 'email.creado': 'Email temporário criado',
    'email.error_crear': 'Erro ao criar email. Verifique sua conexão.', 'email.eliminada': 'Conta excluída',
    'email.error_eliminar': 'Erro ao excluir conta', 'email.copiado': 'Email copiado',
    'email.bandeja': 'Caixa de Entrada', 'email.sin_mensajes': 'Sem mensagens ainda',
    'email.mensajes_auto': 'As mensagens aparecerão aqui automaticamente', 'email.recuperando': 'Recuperando email...',
    'email.sin_contenido': 'Sem conteúdo', 'email.sin_asunto': 'Sem assunto', 'email.desconocido': 'Desconhecido',
    'email.error_cargar': 'Erro ao carregar mensagem',

    'addr.pais': 'País', 'addr.cantidad': 'Quantidade', 'addr.generar': 'Gerar Endereços', 'addr.generando': 'Gerando...',
    'addr.copiar_todo': 'Copiar Tudo', 'addr.copiada': 'Endereço copiado', 'addr.copiadas': 'endereços copiados',
    'addr.resultado': 'resultado', 'addr.error_gen': 'Erro ao gerar endereços. Tente novamente.',
    'addr.error_net': 'Erro de conexão. Verifique sua internet.', 'addr.cp': 'CEP', 'addr.tel': 'Tel',

    'iban.pais': 'País', 'iban.cantidad': 'Quantidade', 'iban.generar': 'Gerar IBAN',
    'iban.copiar_todo': 'Copiar Tudo', 'iban.copiado': 'IBAN copiado', 'iban.copiados': 'IBANs copiados',
    'iban.resultado': 'resultado', 'iban.selecciona': 'Selecione um país válido', 'iban.codigo': 'Código',
    'iban.caracteres': 'caracteres', 'iban.generados': 'IBANs gerados',

    'set.tema': 'Tema', 'set.oscuro': 'Escuro', 'set.claro': 'Claro', 'set.apariencia': 'Alterar aparência',
    'set.limpiar': 'Limpar dados', 'set.almacenamiento': 'Armazenamento', 'set.limpiar_btn': 'Limpar',
    'set.confirmar': 'Confirmar', 'set.no': 'Não', 'set.limpiado': 'Dados limpos com sucesso',
    'set.fallo_limpiar': 'Não foi possível limpar', 'set.acerca': 'Sobre', 'set.dev': 'Desenvolvido por HacheJota',
    'set.compartir': 'Compartilhar APK', 'set.compartir_titulo': 'Compartilhar HJTools X',
    'set.donde_compartir': 'Escolha onde compartilhar o app', 'set.cancelar': 'Cancelar',
    'set.copiar_link': 'Copiar Link', 'set.portapapeles': 'Copiar para a área de transferência', 'set.copiado': 'Copiado!',
    'set.idioma': 'Idioma', 'set.idioma_desc': 'Selecionar idioma',
    'set.pantalla': 'Tela ativa', 'set.pantalla_desc': 'Evitar que a tela desligue',
    'set.pantalla_no': 'Não suportado neste app',
    'set.about_desc': 'HJTools X — Gerador de Cartões, CCS Checker, IPTV Checker, Gerador de Email, Endereços e IBAN.',

    'iptv.na': 'N/A', 'iptv.unlimited': 'Ilimitado', 'iptv.timeAgoNow': 'Agora',
    'iptv.hitCopied': 'Hit copiado', 'iptv.hidePassword': 'Ocultar', 'iptv.showPassword': 'Mostrar',
    'iptv.copy': 'Copiar', 'iptv.m3uUrlCopied': 'URL M3U copiada',
    'iptv.onlyTxtFiles': 'Apenas arquivos .txt',
    'iptv.combosLoaded': ' combos carregados', 'iptv.proxysLoaded': ' proxies carregados',
    'iptv.enterProxys': 'Insira proxies',
    'iptv.noProxysAvailable': 'Sem proxies disponíveis', 'iptv.errorValidatingProxys': 'Erro ao validar proxies',
    'iptv.loadComboOrPaste': 'Carregue um combo ou cole linhas',
    'iptv.enterServer': 'Insira o servidor (host:port)',
    'iptv.activateProxysFirst': 'Ative os proxies primeiro',
    'iptv.analyzingLines': 'Analisando ', 'iptv.linesSuffix': ' linhas...',
    'iptv.completed': 'Concluído: ', 'iptv.cancelled': 'Cancelado: ',
    'iptv.hitsFoundText': ' hits encontrados',
    'iptv.cancelling': 'Cancelando...', 'iptv.noHitsToSave': 'Sem hits para salvar',
    'iptv.hitsSaved': ' hits salvos',
    'iptv.urlMode': 'Modo URL', 'iptv.comboMode': 'Modo Combo',
    'iptv.serverPlaceholder': 'Servidor host:port  ex: canal-pro.xyz:8080',
    'iptv.pasteUrlsHere': 'Cole as URLs IPTV aqui...',
    'iptv.uploadCombo': 'Carregar combo .txt', 'iptv.linesCount': ' linhas',
    'iptv.proxies': 'Proxies', 'iptv.activeCount': ' ativos',
    'iptv.proxyPlaceholderLine1': 'ip:port  ou  ip:port:user:pass',
    'iptv.proxyPlaceholderLine2': 'Um proxy por linha...',
    'iptv.file': 'Arquivo', 'iptv.validating': 'Validando...', 'iptv.validateProxies': 'Validar Proxies',
    'iptv.validProxysCount': ' proxies válidos',
    'iptv.proxiesCleared': 'Proxies removidos', 'iptv.clearProxies': 'Limpar proxies',
    'iptv.threads': 'Threads', 'iptv.checking': 'Verificando...', 'iptv.startCheck': 'Iniciar Check',
    'iptv.proxyIndicator': ' · proxy',
    'iptv.statTotal': 'Total', 'iptv.statHits': 'Hits', 'iptv.statBad': 'Bad', 'iptv.statTimeout': 'Timeout',
    'iptv.hitsFound': 'Hits Encontrados',
    'iptv.save': 'Salvar', 'iptv.copyAll': 'Copiar Tudo',
    'iptv.history': 'Histórico', 'iptv.deleteAll': 'Apagar tudo', 'iptv.historyDeleted': 'Histórico apagado',
    'iptv.close': 'Fechar', 'iptv.hitsCount': ' hits',
    'iptv.deleteSession': 'Excluir sessão', 'iptv.sessionDeleted': 'Sessão excluída',
    'iptv.previousSessionHits': 'Hits da sessão anterior',
    'iptv.copyHost': 'Host:', 'iptv.copyUser': 'Usuário:', 'iptv.copyPass': 'Senha:',
    'iptv.copyStatus': 'Status:', 'iptv.copyCreated': 'Criado:', 'iptv.copyExp': 'Expira:', 'iptv.copyTz': 'Fuso:', 'iptv.copyM3u': 'M3U:',

    'bin.errorLoadCountry': 'Erro ao carregar dados do país',
    'bin.errorLoadBank': 'Erro ao carregar dados do banco',
    'bin.binCopied': 'BIN copiado', 'bin.country': 'País', 'bin.bank': 'Banco', 'bin.bins': 'BINs',
    'bin.goBack': 'Voltar', 'bin.searchCountry': 'Buscar país...',
    'bin.banksAvailable': ' bancos disponíveis', 'bin.searchBank': 'Buscar banco...',
    'bin.binCount': ' BINs', 'bin.filteredBinCount': ' de ',
    'bin.allNetworks': 'Todas as redes', 'bin.allTypes': 'Todos os tipos',
    'bin.searchBin': 'Buscar BIN...', 'bin.noBinsFound': 'Nenhum BIN encontrado',
    'bin.loading': 'Carregando...', 'bin.binsSuffix': ' BINs',

    'ipfraud.title': 'IP Fraude', 'ipfraud.subtitle': 'Analise o risco de fraude de um IP',
    'ipfraud.yourIp': 'Seu IP detectado', 'ipfraud.analyzing': 'Analisando IP...',
    'ipfraud.checkBtn': 'Analisar IP', 'ipfraud.refreshBtn': 'Analisar novamente',
    'ipfraud.errorFetch': 'Erro ao analisar o IP. Tente novamente.',
    'ipfraud.copied': 'IP copiado', 'ipfraud.operator': 'Operador',
    'ipfraud.location': 'Localização', 'ipfraud.proxies': 'Proxies & VPN',
    'ipfraud.riskLow': 'Baixo Risco', 'ipfraud.riskMedium': 'Risco Médio',
    'ipfraud.riskHigh': 'Alto Risco', 'ipfraud.riskUnknown': 'Desconhecido',
    'ipfraud.detected': 'Detectado', 'ipfraud.no': 'Não',
    'ipfraud.safe': 'Seguro', 'ipfraud.riskLabel': 'Risco',
    'ipfraud.proxy_vpn': 'VPN Anonimizada', 'ipfraud.proxy_tor': 'Nó de Saída Tor',
    'ipfraud.proxy_server': 'Servidor', 'ipfraud.proxy_public': 'Proxy Público',
    'ipfraud.proxy_bot': 'Robô de Mecanismo de Busca', 'ipfraud.proxy_blacklisted': 'Na Lista Negra',
    'ipfraud.isp': 'ISP', 'ipfraud.org': 'Organização', 'ipfraud.connectionType': 'Tipo de Conexão',
    'ipfraud.countryLabel': 'País', 'ipfraud.state': 'Estado / Província',
    'ipfraud.district': 'Distrito', 'ipfraud.city': 'Cidade', 'ipfraud.postalCode': 'Código Postal',
  },
}

// ============================================================
// Context & Hook
// ============================================================

interface LangContextValue {
  lang: Lang
  setLang: (l: Lang) => void
  t: (k: string) => string
}

export const LangContext = createContext<LangContextValue>({
  lang: 'es', setLang: () => {}, t: (k: string) => T.es[k] || k,
})

export function useT() { return useContext(LangContext) }

export { T }
