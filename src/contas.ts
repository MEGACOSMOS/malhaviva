/**
 * As contas do site: quantas visitas teve, quantas vezes se partilhou a
 * ligação de uma casa ou de um local marcado, e quantos percursos do modo
 * navegação se começaram e se fizeram (pelo menos 85% do caminho). A
 * página `public/estatisticas.html` mostra-as; quem as manda é o próprio
 * site, do navegador de quem o visita (`public/contar.js`).
 *
 * O que chega aqui é só "mais um": uma visita, uma partilha, um percurso.
 * Não vem nem se guarda nada sobre quem visita — nem quem é, nem de onde
 * vem, nem que casa procurou. Cada conta fica no dia em que aconteceu (à
 * hora de Lisboa), para a página poder dizer também quantas foram hoje,
 * nesta semana, neste mês.
 *
 * As contas vivem num "Durable Object" da Cloudflare: um pequeno servidor
 * com uma base de dados própria, um só para o site todo, por onde passam
 * todas as contas, uma de cada vez. Por isso duas visitas ao mesmo tempo
 * nunca se perdem uma à outra (o que podia acontecer se cada pedido lesse
 * o número, lhe somasse um e o escrevesse de volta).
 */
import { DurableObject } from 'cloudflare:workers';

/**
 * O que se conta, e de que maneiras. Uma partilha é da ligação de uma casa
 * (malhaviva.pt/d31), da de um local marcado (malhaviva.pt/@38.67,-9.18),
 * ou da do site (o botão de partilhar do cabeçalho, na página do bairro).
 */
export const CONTAS: Record<string, readonly string[]> = {
	visita: [''],
	partilha: ['casa', 'local', 'site'],
	percurso: ['iniciado', 'feito'],
};

/** O nome de uma conta, como a página das estatísticas o lê: `partilha.casa`, `visita`. */
export function nomeDaConta(tipo: string, qual: string): string {
	return qual ? tipo + '.' + qual : tipo;
}

/** Se é uma conta que se guarda. */
export function eUmaConta(tipo: unknown, qual: unknown): tipo is string {
	return typeof tipo === 'string' && typeof qual === 'string' &&
		Object.hasOwn(CONTAS, tipo) && CONTAS[tipo].includes(qual);
}

const DIA_EM_LISBOA = new Intl.DateTimeFormat('en-CA', {
	timeZone: 'Europe/Lisbon',
	year: 'numeric',
	month: '2-digit',
	day: '2-digit',
});

/** O dia de hoje (ou de `quando`) em Lisboa, como 2026-11-19. */
export function diaEmLisboa(quando: Date = new Date()): string {
	return DIA_EM_LISBOA.format(quando);
}

type Linha = { dia: string; tipo: string; qual: string; n: number };

/** O livro das contas: uma linha por dia e por conta, com quantas foram. */
export class Contas extends DurableObject {
	constructor(ctx: DurableObjectState, env: unknown) {
		super(ctx, env);
		ctx.storage.sql.exec(`CREATE TABLE IF NOT EXISTS contas (
			dia TEXT NOT NULL,
			tipo TEXT NOT NULL,
			qual TEXT NOT NULL,
			n INTEGER NOT NULL,
			PRIMARY KEY (dia, tipo, qual)
		)`);
	}

	/** Mais um, no dia dado. */
	contar(dia: string, tipo: string, qual: string): void {
		this.ctx.storage.sql.exec(
			`INSERT INTO contas (dia, tipo, qual, n) VALUES (?, ?, ?, 1)
			 ON CONFLICT (dia, tipo, qual) DO UPDATE SET n = n + 1`,
			dia, tipo, qual,
		);
	}

	/** Todas as linhas, do dia mais antigo para o mais recente. */
	ler(): Linha[] {
		return this.ctx.storage.sql
			.exec<Linha>('SELECT dia, tipo, qual, n FROM contas ORDER BY dia')
			.toArray();
	}
}

/** O livro das contas do site: há só um, e tem sempre o mesmo nome. */
export function livro(contas: DurableObjectNamespace<Contas>): DurableObjectStub<Contas> {
	return contas.get(contas.idFromName('malhaviva'));
}

/**
 * Quem visita por conta própria, sem ser uma pessoa: os robôs dos motores
 * de busca, os que vão buscar a pré-visualização de uma ligação para as
 * aplicações de mensagens, os navegadores sem ecrã. A maior parte nem corre
 * o código da página (e então nem chega a contar); os que correm dizem-se
 * pelo nome ("Googlebot/2.1"), ou deixam o endereço de quem os fez
 * ("+http://..."). Não se apanha só "bot": há telemóveis com essas letras
 * no nome da marca.
 */
const ROBO = /bot\/|\+https?:|crawl|spider|slurp|headlesschrome|lighthouse|pagespeed|facebookexternalhit|embedly|curl\/|wget|python-requests|go-http-client/i;

/**
 * Se o pedido vem do próprio site. Um navegador diz sempre de onde vem um
 * pedido destes (`Sec-Fetch-Site`, ou, nos mais antigos, `Origin`): sem
 * esta porta, qualquer página da Internet podia pôr os navegadores de quem
 * a visita a somar visitas ao Malha Viva.
 */
function doProprioSite(pedido: Request): boolean {
	const sitio = pedido.headers.get('Sec-Fetch-Site');
	if (sitio) return sitio === 'same-origin';
	const origem = pedido.headers.get('Origin');
	if (origem) {
		try {
			return new URL(origem).host === new URL(pedido.url).host;
		} catch {
			return false;
		}
	}
	return false;
}

const SEM_GUARDAR = { 'Cache-Control': 'no-store' };

/**
 * POST /api/contar, com `{"tipo": "partilha", "qual": "casa"}`: mais uma.
 * Responde sempre sem nada (204), conte ou não — quem manda não espera
 * pela resposta (vai pelo `sendBeacon`, que nem a lê).
 */
export async function receberConta(pedido: Request, contas: DurableObjectNamespace<Contas>): Promise<Response> {
	if (pedido.method !== 'POST') {
		return new Response(null, { status: 405, headers: { ...SEM_GUARDAR, Allow: 'POST' } });
	}
	if (!doProprioSite(pedido)) return new Response(null, { status: 403, headers: SEM_GUARDAR });
	if (ROBO.test(pedido.headers.get('User-Agent') ?? '')) return new Response(null, { status: 204, headers: SEM_GUARDAR });

	let pedida: { tipo?: unknown; qual?: unknown };
	try {
		const texto = await pedido.text();
		if (texto.length > 200) throw new Error('grande de mais');
		pedida = JSON.parse(texto);
	} catch {
		return new Response(null, { status: 400, headers: SEM_GUARDAR });
	}
	const tipo = pedida?.tipo;
	const qual = pedida?.qual ?? '';
	if (!eUmaConta(tipo, qual)) return new Response(null, { status: 400, headers: SEM_GUARDAR });

	await livro(contas).contar(diaEmLisboa(), tipo, qual as string);
	return new Response(null, { status: 204, headers: SEM_GUARDAR });
}

/**
 * As contas arrumadas para a página das estatísticas:
 *
 *   hoje   - o dia de hoje em Lisboa (2026-11-19);
 *   desde  - o primeiro dia com alguma conta, ou null se ainda não há;
 *   totais - quantas de cada, desde sempre: {"visita": 120, "partilha.casa": 4, ...};
 *   dias   - as mesmas, dia a dia, só os dias que têm alguma:
 *            {"2026-11-19": {"visita": 12, ...}, ...}.
 *
 * Todas as contas aparecem nos totais, mesmo as que ainda vão a zero.
 */
export function arrumar(linhas: Linha[], hoje: string) {
	const totais: Record<string, number> = {};
	for (const [tipo, quais] of Object.entries(CONTAS)) {
		for (const qual of quais) totais[nomeDaConta(tipo, qual)] = 0;
	}
	const dias: Record<string, Record<string, number>> = {};
	for (const { dia, tipo, qual, n } of linhas) {
		if (!eUmaConta(tipo, qual)) continue;
		const nome = nomeDaConta(tipo, qual);
		totais[nome] += n;
		(dias[dia] ??= {})[nome] = (dias[dia][nome] ?? 0) + n;
	}
	const ordem = Object.keys(dias).sort();
	return { hoje, desde: ordem[0] ?? null, totais, dias };
}

/** GET /api/estatisticas: as contas, arrumadas (ver `arrumar`). */
export async function mostrarContas(pedido: Request, contas: DurableObjectNamespace<Contas>): Promise<Response> {
	if (pedido.method !== 'GET' && pedido.method !== 'HEAD') {
		return new Response(null, { status: 405, headers: { ...SEM_GUARDAR, Allow: 'GET' } });
	}
	const linhas = await livro(contas).ler();
	return Response.json(arrumar(linhas, diaEmLisboa()), { headers: SEM_GUARDAR });
}
