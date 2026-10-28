import { SELF } from "cloudflare:test";
import { describe, it, expect } from "vitest";

describe("servidor do Malha Viva", () => {
	it("responde que não existe a um endereço sem ficheiro", async () => {
		const response = await SELF.fetch("http://example.com/nao-existe");
		expect(response.status).toBe(404);
	});

	// O endereço de cada casa abre o bairro com o percurso até ela: ver
	// src/index.ts.
	describe("o endereço de uma casa", () => {
		it("vai dar ao bairro, com a casa no endereço", async () => {
			for (const [caminho, destino] of [["/casa/D31", "/?casa=D31"], ["/casa/a20.1", "/?casa=A20.1"], ["/casa/D30/2/", "/?casa=D30&sitio=2"]]) {
				const response = await SELF.fetch("http://example.com" + caminho, { redirect: "manual" });
				expect(response.status, caminho).toBe(302);
				expect(response.headers.get("Location"), caminho).toBe("http://example.com" + destino);
			}
		});

		it("abre o bairro com o nome da casa no título e na pré-visualização", async () => {
			for (const [endereco, nome, ligacao] of [["/?casa=D31", "Casa D31", "/casa/D31"], ["/?casa=d30&sitio=2", "Casa D30", "/casa/D30/2"]]) {
				const response = await SELF.fetch("http://example.com" + endereco);
				expect(response.status, endereco).toBe(200);
				const html = await response.text();
				expect(html, endereco).toContain(`<title data-i18n-titulo="cab.bairro">${nome} — Bairro de Penajóia</title>`);
				expect(html, endereco).toContain(`property="og:title" content="${nome} — Bairro de Penajóia"`);
				expect(html, endereco).toContain(`property="og:url" content="https://malhaviva.pt${ligacao}"`);
				expect(html, endereco).toContain("<pc-app");
			}
		});

		it("não mexe no bairro com um número que não pode ser de uma casa", async () => {
			const response = await SELF.fetch("http://example.com/?casa=" + encodeURIComponent('"><script>'));
			expect(response.status).toBe(200);
			const html = await response.text();
			expect(html).toContain('<title data-i18n-titulo="cab.bairro">Bairro de Penajóia — Malha Viva</title>');
			expect(html).not.toContain("og:title");
		});

		it("leva os endereços da antiga página da navegação ao bairro", async () => {
			for (const [caminho, destino] of [["/navegacao", "/"], ["/navegacao?casa=D31&sitio=2", "/?casa=D31&sitio=2"]]) {
				const response = await SELF.fetch("http://example.com" + caminho, { redirect: "manual" });
				expect(response.status, caminho).toBe(302);
				expect(response.headers.get("Location"), caminho).toBe("http://example.com" + destino);
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
