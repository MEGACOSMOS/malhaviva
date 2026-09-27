/**
 * O servidor do Malha Viva.
 *
 * Tudo o que o site tem — páginas, bairro, vídeos — está na pasta `public`
 * e é servido directamente pela Cloudflare, antes de chegar aqui (ver
 * `assets` em `wrangler.jsonc`). Só chega a este código um endereço que
 * não corresponda a nenhum ficheiro, e a resposta é sempre que não existe.
 */

export default {
	async fetch(): Promise<Response> {
		return new Response('Not Found', { status: 404 });
	},
} satisfies ExportedHandler<Env>;
