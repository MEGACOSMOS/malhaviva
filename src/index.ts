/**
 * O servidor do Malha Viva.
 *
 * Tudo o que o site tem — páginas, bairro, vídeos — está na pasta `public`
 * e é servido directamente pela Cloudflare, antes de chegar aqui (ver
 * `assets` em `wrangler.jsonc`). A este código só chegam duas coisas:
 *
 *  - os pedidos das páginas pesadas do site (`run_worker_first`, em
 *    `wrangler.jsonc`), para se poder recusar o pré-carregamento (abaixo);
 *  - um endereço que não corresponda a nenhum ficheiro: o de uma casa
 *    (malhaviva.pt/d31, ver `casaDoEnderecoCurto`) é o bairro, aberto já
 *    com o percurso até ela; os outros têm sempre a resposta de que não
 *    existem.
 *
 * Porquê recusar o pré-carregamento. Quando alguém começa a escrever
 * "malhaviva.pt" na barra do Chrome, o Chrome adivinha para onde a pessoa
 * vai e carrega a página em segundo plano, escondida, para a mostrar mais
 * depressa ("prerender"). O pedido vem com o cabeçalho
 * `Sec-Purpose: prefetch;prerender`. O motor 3D do bairro, a arrancar numa
 * página escondida assim, deixa o separador preso para sempre: o círculo
 * roda, a página fica escura e o Chrome diz "Página sem resposta" — e a
 * pessoa nunca chega a ver o bairro. Respondendo a esse pedido com um erro,
 * o Chrome desiste do pré-carregamento e, quando a pessoa carrega em Enter,
 * abre a página como qualquer outra. Perde-se meio segundo de vantagem;
 * ganha-se um site que abre. (Verificado a reproduzir o bloqueio num Chrome
 * limpo e a desaparecer com esta recusa: ver `scripts/testar-prerender.mjs`.)
 */

/** Quem pede o pré-carregamento de uma página diz-o neste cabeçalho. */
export function eUmPreCarregamento(pedido: Request): boolean {
	return (pedido.headers.get('Sec-Purpose') ?? '').toLowerCase().includes('prerender');
}

/**
 * O endereço de uma casa: malhaviva.pt/d31 — e, para um número que o
 * levantamento tem em dois sítios, malhaviva.pt/d31-2. É o endereço que
 * quem mora no bairro manda a quem o vem visitar, e o dos códigos QR das
 * casas (scripts/navegacao/ligacoes.py). Não é um ficheiro: é o próprio
 * bairro, aberto já com o percurso até à casa (a pesquisa das casas, em
 * public/index.html, lê a casa do endereço).
 *
 * O bairro pode ser servido neste endereço tal como está porque ele fica
 * na raiz do site: o que a página vai buscar por caminhos que contam a
 * partir do sítio onde ela está (o motor, o bairro, as miniaturas)
 * encontra-se na mesma. Por isso uma barra no fim (/d31/) leva a /d31 —
 * com ela, a página passava a procurar tudo dentro de /d31/.
 *
 * Os números das casas são uma letra e um número (D31), às vezes com um
 * ponto (A20.1), e há dois só com algarismos (8, 23). Nenhum ficheiro do
 * site tem um nome assim: este código só vê estes endereços porque não há
 * ficheiro nenhum com esse nome.
 */
const CURTO = /^\/([A-Za-z]?\d{1,4}(?:\.\d{1,2})?)(?:-([1-9]))?(\/?)$/;

/** Os endereços de antes: /casa/D31 e /casa/D31/2 (os primeiros QR). */
const ANTIGO = /^\/casa\/([A-Za-z0-9.]{1,12})(?:\/([1-9]))?\/?$/;

/** O que pode ser o número de uma casa. */
const NUMERO = /^[A-Za-z0-9.]{1,12}$/;

type Casa = { numero: string; sitio: number };

/** A casa de um endereço curto (/d31, /d31-2), ou nada. */
export function casaDoEnderecoCurto(caminho: string): Casa | null {
	const m = CURTO.exec(caminho);
	return m ? { numero: m[1].toUpperCase(), sitio: m[2] ? Number(m[2]) : 1 } : null;
}

/** A casa de um endereço de antes (/casa/D31, /casa/D31/2), ou nada. */
export function casaDoEndereco(caminho: string): Casa | null {
	const m = ANTIGO.exec(caminho);
	return m ? { numero: m[1].toUpperCase(), sitio: m[2] ? Number(m[2]) : 1 } : null;
}

/** A casa que o bairro tinha no endereço, antes (/?casa=D31&sitio=2), ou nada. */
export function casaNoBairro(endereco: URL): Casa | null {
	const numero = endereco.searchParams.get('casa') ?? '';
	if (!NUMERO.test(numero)) return null;
	const sitio = Number(endereco.searchParams.get('sitio'));
	return { numero: numero.toUpperCase(), sitio: Number.isInteger(sitio) && sitio >= 1 && sitio <= 9 ? sitio : 1 };
}

/** O caminho curto de uma casa: /d31, ou /d31-2 para o segundo sítio. */
export function caminhoDaCasa(casa: Casa): string {
	return '/' + casa.numero.toLowerCase() + (casa.sitio > 1 ? '-' + casa.sitio : '');
}

/**
 * O endereço curto de uma casa, vindo de outro endereço do site: fica o
 * resto do que lá estava (a língua, por exemplo), sem a casa.
 */
function enderecoCurto(casa: Casa, de: URL): string {
	const destino = new URL(caminhoDaCasa(casa), de);
	for (const [k, v] of de.searchParams) {
		if (k !== 'casa' && k !== 'sitio') destino.searchParams.append(k, v);
	}
	return destino.toString();
}

/**
 * O bairro com o nome da casa no título, na descrição e na imagem do
 * endereço: é o que as aplicações de mensagens mostram na pré-visualização
 * ("Casa D31 — Bairro de Penajóia"). O número só tem letras, algarismos e
 * pontos (ver `CURTO`): pode ir para dentro da página tal como está.
 */
function paginaDaCasa(pagina: Response, casa: Casa): Response {
	const titulo = `Casa ${casa.numero} — Bairro de Penajóia`;
	const descricao = `Como chegar à casa ${casa.numero} no Bairro de Penajóia: o caminho no bairro, passo a passo.`;
	const endereco = 'https://malhaviva.pt' + caminhoDaCasa(casa);
	const propriedades: [string, string][] = [
		['og:type', 'website'],
		['og:site_name', 'Malha Viva'],
		['og:locale', 'pt_PT'],
		['og:title', titulo],
		['og:description', descricao],
		['og:url', endereco],
		['og:image', 'https://malhaviva.pt/navegacao/partilha.jpg'],
		['og:image:width', '1200'],
		['og:image:height', '630'],
	];
	const etiquetas = propriedades.map(([p, v]) => `<meta property="${p}" content="${v}">`).join('') +
		'<meta name="twitter:card" content="summary_large_image">' +
		`<link rel="canonical" href="${endereco}">`;
	const transformada = new HTMLRewriter()
		.on('title', { element(e) { e.setInnerContent(titulo); } })
		.on('meta[name="description"]', { element(e) { e.setAttribute('content', descricao); } })
		.on('head', { element(e) { e.append(etiquetas, { html: true }); } })
		.transform(pagina);
	// A página do bairro nunca se guarda (ver public/_headers): a da casa,
	// que é a mesma, também não.
	const resposta = new Response(transformada.body, transformada);
	resposta.headers.set('Cache-Control', 'no-store');
	return resposta;
}

export default {
	async fetch(pedido: Request, env: { ASSETS: Fetcher }): Promise<Response> {
		if (eUmPreCarregamento(pedido)) {
			return new Response('O pré-carregamento desta página não é aceite.', {
				status: 503,
				headers: { 'Cache-Control': 'no-store', 'Content-Type': 'text/plain; charset=utf-8' },
			});
		}
		const endereco = new URL(pedido.url);
		const caminho = endereco.pathname;

		// O endereço curto de uma casa: o bairro, com a casa.
		const curta = casaDoEnderecoCurto(caminho);
		if (curta) {
			if (caminho.endsWith('/')) return Response.redirect(enderecoCurto(curta, endereco), 302);
			const pagina = await env.ASSETS.fetch(new Request(new URL('/', endereco), pedido));
			return pagina.ok ? paginaDaCasa(pagina, curta) : pagina;
		}

		// Os endereços de antes vão dar ao curto: /casa/D31 (os primeiros
		// códigos QR), /?casa=D31 e a antiga página da navegação, que tinha
		// o mapa visto de cima (/navegacao?casa=D31).
		const antiga = casaDoEndereco(caminho);
		if (antiga) return Response.redirect(enderecoCurto(antiga, endereco), 302);
		if (caminho === '/' || caminho === '/navegacao' || caminho === '/navegacao.html') {
			const pedida = casaNoBairro(endereco);
			if (pedida) return Response.redirect(enderecoCurto(pedida, endereco), 302);
			if (caminho !== '/') return Response.redirect(new URL('/', endereco).toString(), 302);
		}

		// Tudo o resto é do site: ficheiros, ou a resposta de que não existe.
		return env.ASSETS.fetch(pedido);
	},
} satisfies ExportedHandler<{ ASSETS: Fetcher }>;
