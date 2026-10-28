import { SELF } from "cloudflare:test";
import { describe, it, expect } from "vitest";

describe("servidor do Malha Viva", () => {
	it("responde que não existe a um endereço sem ficheiro", async () => {
		const response = await SELF.fetch("http://example.com/nao-existe");
		expect(response.status).toBe(404);
	});

	// O endereço de cada casa abre a navegação até ela: ver src/index.ts.
	describe("o endereço de uma casa", () => {
		it("abre a navegação, com o nome da casa no título", async () => {
			for (const [caminho, nome] of [["/casa/D31", "Casa D31"], ["/casa/a20.1", "Casa A20.1"], ["/casa/D30/2/", "Casa D30"]]) {
				const response = await SELF.fetch("http://example.com" + caminho);
				expect(response.status, caminho).toBe(200);
				const html = await response.text();
				expect(html, caminho).toContain(`<title data-i18n-titulo="nav.separador">${nome} — Bairro de Penajóia</title>`);
				expect(html, caminho).toContain(`property="og:title" content="${nome} — Bairro de Penajóia"`);
				expect(html, caminho).toContain("/navegacao.mjs");
			}
		});

		it("não confunde outros endereços com o de uma casa", async () => {
			for (const caminho of ["/casa", "/casa/", "/casa/D31/0", "/casa/D31/x", "/casa/um-numero-comprido-demais"]) {
				const response = await SELF.fetch("http://example.com" + caminho);
				expect(response.status, caminho).toBe(404);
			}
		});
	});

	// O Chrome pré-carrega em segundo plano a página que prevê que vai abrir.
	// O motor 3D, a arrancar assim, deixa o separador preso: ver src/index.ts.
	describe("pré-carregamento do Chrome (prerender)", () => {
		const pre = { "Sec-Purpose": "prefetch;prerender" };

		it("recusa o pré-carregamento do bairro", async () => {
			const response = await SELF.fetch("http://example.com/", { headers: pre });
			expect(response.status).toBe(503);
			expect(response.headers.get("Cache-Control")).toBe("no-store");
		});

		it("recusa o pré-carregamento das páginas 360º", async () => {
			for (const caminho of ["/video360", "/image360"]) {
				const response = await SELF.fetch("http://example.com" + caminho, { headers: pre });
				expect(response.status, caminho).toBe(503);
			}
		});

		it("abre o bairro normalmente quando a pessoa o abre", async () => {
			const response = await SELF.fetch("http://example.com/");
			expect(response.status).toBe(200);
			expect(await response.text()).toContain("Malha Viva");
		});

		it("deixa passar o pré-carregamento simples (só descarregar), que não corre código", async () => {
			const response = await SELF.fetch("http://example.com/", { headers: { "Sec-Purpose": "prefetch" } });
			expect(response.status).toBe(200);
		});
	});
});
